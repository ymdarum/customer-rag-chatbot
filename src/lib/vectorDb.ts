/**
 * Vector Database Module (Server-Only)
 * This module provides a persistent vector database using SQLite for efficient similarity search.
 * It pre-computes and stores embeddings for all customers, making queries much faster.
 */

import 'server-only';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import customerData from '@/data/customers.json';
import { getEmbedding } from './ollama';
import { Customer } from './vectorStore';

// Define constants for the database
const DB_DIR = path.join(process.cwd(), 'vector_db');
const DB_PATH = path.join(DB_DIR, 'customer_vectors.db');

// Global database connection
let db: any = null;
let isInitialized = false;

/**
 * Initialize the vector database
 * This creates the DB directory if it doesn't exist, connects to the database,
 * and ensures the customer embeddings table is created and populated.
 */
export async function initVectorDb() {
  if (isInitialized) {
    return;
  }

  console.log("Initializing vector database...");

  // Create DB directory if it doesn't exist
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log(`Created vector database directory at ${DB_DIR}`);
  }

  try {
    // Connect to the database
    db = new Database(DB_PATH);
    
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        customer_id TEXT UNIQUE,
        full_name TEXT,
        email TEXT,
        content TEXT
      );
      
      CREATE TABLE IF NOT EXISTS embeddings (
        customer_id TEXT PRIMARY KEY,
        vector BLOB,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
      );
    `);
    
    // Check if we need to populate the database
    const count = db.prepare('SELECT COUNT(*) as count FROM customers').get();
    
    if (count.count === 0) {
      console.log("Customer embeddings table is empty, populating it...");
      await populateDatabase();
    } else {
      console.log(`Using existing customer embeddings (${count.count} records)`);
    }
    
    isInitialized = true;
    console.log("Vector database initialization complete");
  } catch (error) {
    console.error("Error initializing vector database:", error);
    throw error;
  }
}

/**
 * Populate the database with customer data and embeddings
 * This is a one-time operation that creates embeddings for all customers
 */
async function populateDatabase() {
  console.log("Creating embeddings for all customers - this may take a while...");
  
  // Prepare statements for inserting data
  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, customer_id, full_name, email, content)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertEmbedding = db.prepare(`
    INSERT INTO embeddings (customer_id, vector)
    VALUES (?, ?)
  `);
  
  // Begin transaction
  const transaction = db.transaction((customers) => {
    for (const customer of customers) {
      insertCustomer.run(
        customer.id,
        customer.customerId,
        `${customer.firstName} ${customer.lastName}`,
        customer.email,
        customer.content
      );
      
      if (customer.embedding) {
        // Store embedding as a JSON string
        insertEmbedding.run(
          customer.customerId,
          JSON.stringify(customer.embedding)
        );
      }
    }
  });
  
  // Convert customer data to the format we need
  const customers = customerData as Customer[];
  const documents = customers.map(customer => {
    const content = `
      Customer ID: ${customer.customerId}
      Name: ${customer.firstName} ${customer.lastName}
      Email: ${customer.email}
      Phone: ${customer.phoneNumber}
      Address: ${customer.address.street}, ${customer.address.city}, ${customer.address.state} ${customer.address.zipCode}
      Products: ${customer.products.map(p => p.type).join(", ")}
      Customer Rating: ${customer.customerRating || 'N/A'}
      Join Date: ${customer.joinDate || 'N/A'}
      Notes: ${customer.notes || 'N/A'}
    `;
    
    return {
      id: customer.id,
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      content,
    };
  });
  
  // Process documents in batches to avoid overwhelming Ollama
  const BATCH_SIZE = 5;
  const completedDocuments = [];
  
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);
    
    // Process each document in the batch in parallel
    const batchPromises = batch.map(async (doc) => {
      try {
        const embedding = await getEmbedding(doc.content);
        return {
          ...doc,
          embedding,
        };
      } catch (error) {
        console.error(`Error embedding document for customer ${doc.customerId}:`, error);
        return doc; // Return without embedding
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    completedDocuments.push(...batchResults);
  }
  
  // Execute the transaction
  transaction(completedDocuments);
  console.log(`Successfully stored ${completedDocuments.length} customer records with embeddings`);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same dimensions");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search for customers using vector similarity
 * This function takes a query, converts it to an embedding, and finds similar customers
 */
export async function searchSimilarCustomers(query: string, limit: number = 3): Promise<Customer[]> {
  try {
    await initVectorDb();
    
    console.log(`Searching for customers similar to query: "${query}"`);
    
    // Get embedding for the query
    const queryEmbedding = await getEmbedding(query);
    
    // Get all embeddings from the database
    const allEmbeddings = db.prepare(`
      SELECT c.customer_id, c.full_name, e.vector
      FROM customers c
      JOIN embeddings e ON c.customer_id = e.customer_id
    `).all();
    
    // Calculate similarity scores
    const scoredResults = allEmbeddings
      .map((row: any) => {
        try {
          const embedding = JSON.parse(row.vector);
          const similarity = cosineSimilarity(queryEmbedding, embedding);
          
          return {
            customerId: row.customer_id,
            similarity
          };
        } catch (error) {
          console.error(`Error processing embedding for ${row.customer_id}:`, error);
          return {
            customerId: row.customer_id,
            similarity: 0
          };
        }
      })
      .filter((result: any) => result.similarity > 0);
    
    // Sort by similarity (highest first) and take top results
    const topResults = scoredResults
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit);
    
    // Get the full customer data for the top results
    const customers = topResults.map((result: any) => {
      return customerData.find((c: any) => c.customerId === result.customerId) as Customer;
    }).filter(Boolean);
    
    console.log(`Found ${customers.length} customers using vector search`);
    return customers;
  } catch (error) {
    console.error("Error searching vector database:", error);
    // Fall back to returning a few customers if the search fails
    return (customerData as Customer[]).slice(0, limit);
  }
}

/**
 * Add a new customer to the vector database
 * This function is useful for keeping the vector DB in sync with new customer data
 */
export async function addCustomerToVectorDb(customer: Customer): Promise<void> {
  try {
    await initVectorDb();
    
    // Create the content text for the customer
    const content = `
      Customer ID: ${customer.customerId}
      Name: ${customer.firstName} ${customer.lastName}
      Email: ${customer.email}
      Phone: ${customer.phoneNumber}
      Address: ${customer.address.street}, ${customer.address.city}, ${customer.address.state} ${customer.address.zipCode}
      Products: ${customer.products.map(p => p.type).join(", ")}
      Customer Rating: ${customer.customerRating || 'N/A'}
      Join Date: ${customer.joinDate || 'N/A'}
      Notes: ${customer.notes || 'N/A'}
    `;
    
    // Generate embedding for the customer
    const embedding = await getEmbedding(content);
    
    // Insert the customer data
    const insertCustomer = db.prepare(`
      INSERT OR REPLACE INTO customers (id, customer_id, full_name, email, content)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertCustomer.run(
      customer.id,
      customer.customerId,
      `${customer.firstName} ${customer.lastName}`,
      customer.email,
      content
    );
    
    // Insert the embedding
    const insertEmbedding = db.prepare(`
      INSERT OR REPLACE INTO embeddings (customer_id, vector)
      VALUES (?, ?)
    `);
    
    insertEmbedding.run(
      customer.customerId,
      JSON.stringify(embedding)
    );
    
    console.log(`Added/updated customer ${customer.customerId} in vector database`);
  } catch (error) {
    console.error("Error adding customer to vector database:", error);
    throw error;
  }
} 