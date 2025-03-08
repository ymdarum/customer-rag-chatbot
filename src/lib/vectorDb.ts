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
 * Search for customers similar to the query
 * @param query The search query
 * @param limit Maximum number of results to return
 * @returns Array of matching customers
 */
export async function searchSimilarCustomers(query: string, limit: number = 3): Promise<Customer[]> {
  console.log(`Searching for customers similar to: "${query}" with limit: ${limit}`);
  try {
    // For more comprehensive searches, use a different approach
    if (limit > 50) {
      console.log("Performing comprehensive database search");
      
      // Get all customers for direct analysis - more efficient for comprehensive searches
      const allCustomers = customerData as Customer[];
      console.log(`Total customers in database: ${allCustomers.length}`);
      
      // Check for queries asking about "top N customers" or sorting by product count
      const topNPattern = /top\s+(\d+)\s+customers?|(\d+)\s+customers?\s+with\s+(most|highest|greatest)/i;
      const listTopNMatch = query.toLowerCase().match(topNPattern);
      
      // Special handling for queries about product counts and top customers
      if (query.toLowerCase().includes("product")) {
        console.log("Detected product-related query, analyzing product counts directly");
        
        // Add product count to each customer for easier sorting
        const customersWithProductCount = allCustomers.map(customer => ({
          customer,
          productCount: customer.products ? customer.products.length : 0
        }));
        
        // Sort customers by product count (highest first)
        const sortedCustomers = customersWithProductCount.sort((a, b) => 
          b.productCount - a.productCount
        );
        
        // Calculate product count distribution for logging
        const zeroProducts = sortedCustomers.filter(c => c.productCount === 0).length;
        const oneToThreeProducts = sortedCustomers.filter(c => c.productCount > 0 && c.productCount <= 3).length;
        const fourPlusProducts = sortedCustomers.filter(c => c.productCount > 3).length;
        
        console.log(`Product count distribution: 
          0 products: ${zeroProducts} customers
          1-3 products: ${oneToThreeProducts} customers
          4+ products: ${fourPlusProducts} customers`
        );
        
        // If query is about top N customers with most products
        if (listTopNMatch) {
          // Extract N from "top N" or default to 5
          const topN = parseInt(listTopNMatch[1] || listTopNMatch[2] || "5");
          console.log(`Query is asking for top ${topN} customers by product count`);
          
          // Get top N customers with most products
          const topCustomers = sortedCustomers
            .slice(0, topN)
            .map(c => c.customer);
          
          console.log(`Returning top ${topCustomers.length} customers by product count`);
          return topCustomers;
        }
        
        // If query is about customers with more than X products
        if (query.toLowerCase().includes("more than") && query.toLowerCase().includes("product")) {
          // Extract the number after "more than"
          const moreThanMatch = query.match(/more than\s+(\d+)/i);
          if (moreThanMatch && moreThanMatch[1]) {
            const threshold = parseInt(moreThanMatch[1]);
            console.log(`Query is asking for customers with more than ${threshold} products`);
            
            // Calculate how many customers exceed the threshold
            const customersAboveThreshold = sortedCustomers.filter(c => c.productCount > threshold).length;
            console.log(`Found ${customersAboveThreshold} customers with more than ${threshold} products`);
            
            // Get filtered customers
            const filteredCustomers = sortedCustomers
              .filter(c => c.productCount > threshold)
              .map(c => c.customer);
            
            // If the query is combined with "list top N", we need to limit the results
            // Parse for "list top N" or "top N" pattern
            const listTopPattern = /list\s+top\s+(\d+)|top\s+(\d+)/i;
            const listTopMatch = query.match(listTopPattern);
            
            if (listTopMatch) {
              const topN = parseInt(listTopMatch[1] || listTopMatch[2] || "5");
              console.log(`Combined query detected: returning top ${topN} customers with more than ${threshold} products`);
              
              // Return the top N customers with more than threshold products
              return filteredCustomers.slice(0, topN);
            }
            
            // If the query includes both "how many" and "list", we should return a reasonable number
            // This handles the case of "how many customers have more than X products? list top N"
            if (query.toLowerCase().includes("how many") && query.toLowerCase().includes("list")) {
              const listMatch = query.match(/list\s+(\d+)|list\s+top\s+(\d+)/i);
              const listN = listMatch ? parseInt(listMatch[1] || listMatch[2] || "5") : 5;
              
              console.log(`Query has both count and list components. Returning top ${listN} of ${filteredCustomers.length} matching customers`);
              return filteredCustomers.slice(0, listN);
            }
            
            return filteredCustomers.slice(0, limit);
          }
        }
        
        // For general product-related queries, return customers sorted by product count
        const limitN = Math.min(sortedCustomers.length, limit);
        console.log(`General product query: returning top ${limitN} customers by product count`);
        return sortedCustomers.slice(0, limitN).map(c => c.customer);
      }
      
      // For queries not specifically about products
      console.log(`Non-product specific query, returning up to ${limit} customers`);
      return allCustomers.slice(0, limit);
    }
    
    // For non-comprehensive searches, use the original vector search method
    // Check if the query contains a specific customer ID pattern (CUST-XXXXX)
    const customerIdMatch = query.match(/CUST-\d{5,6}/i);
    
    // If a customer ID is explicitly mentioned, prioritize exact matches
    if (customerIdMatch) {
      const customerId = customerIdMatch[0].toUpperCase();
      console.log(`Detected specific customer ID in query: ${customerId}`);
      
      // First try to find the exact customer in the database
      const exactCustomer = (customerData as Customer[]).find(c => 
        c.customerId.toUpperCase() === customerId
      );
      
      if (exactCustomer) {
        console.log(`Found exact match for customer ID: ${customerId}`);
        // Log the actual product count to help with debugging
        console.log(`Customer ${customerId} has ${exactCustomer.products.length} products`);
        return [exactCustomer];
      }
    }
    
    // Also check for customer names in the query (first name + last name)
    const allCustomers = customerData as Customer[];
    const potentialNameMatches = allCustomers.filter(customer => {
      const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
      return query.toLowerCase().includes(fullName);
    });
    
    if (potentialNameMatches.length > 0) {
      console.log(`Found ${potentialNameMatches.length} customers by name match`);
      return potentialNameMatches.slice(0, limit);
    }
    
    // Continue with vector search if no exact match was found
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
      const customer = customerData.find((c: any) => c.customerId === result.customerId) as Customer;
      if (customer) {
        // Log the actual product count to help with debugging
        console.log(`Customer ${customer.customerId} has ${customer.products.length} products`);
      }
      return customer;
    }).filter(Boolean);
    
    console.log(`Found ${customers.length} customers using vector search`);
    return customers;
  } catch (error) {
    console.error("Error searching for similar customers:", error);
    return [];
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