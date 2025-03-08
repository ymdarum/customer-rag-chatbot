/**
 * Vector Store Module
 * This module provides functions for working with vector embeddings and similarity search.
 */

import customerData from '@/data/customers.json';
import { getEmbedding } from './ollama';

// Define customer interface
export interface Customer {
  id: number;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  products: Array<any>;
  recentTransactions: Array<any>;
  notes: string;
  dateOfBirth?: string;
  joinDate?: string;
  customerRating?: number;
}

// Define the document interface for vector search
export interface CustomerDocument {
  customer: Customer;
  content: string;
  embedding?: number[];
}

// In-memory cache for embeddings
let customerDocuments: CustomerDocument[] = [];
let documentsInitialized = false;

/**
 * Initialize customer documents with embeddings
 * This is an expensive operation, so we cache the results
 */
export async function initializeCustomerDocuments(): Promise<CustomerDocument[]> {
  if (documentsInitialized && customerDocuments.length > 0) {
    return customerDocuments;
  }

  console.log("Initializing customer documents with embeddings...");
  const customers = customerData as Customer[];
  
  // Create text representations for all customers
  const documents: CustomerDocument[] = customers.map(customer => {
    // Create a text representation of the customer
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
      customer,
      content,
    };
  });

  // Generate embeddings for each document
  try {
    // Process documents in batches to avoid overwhelming Ollama
    const BATCH_SIZE = 5;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);
      
      // Process each document in the batch
      await Promise.all(batch.map(async (doc) => {
        try {
          doc.embedding = await getEmbedding(doc.content);
        } catch (error) {
          console.error(`Error embedding document for customer ${doc.customer.customerId}:`, error);
        }
      }));
    }

    // Filter out documents without embeddings
    customerDocuments = documents.filter(doc => doc.embedding);
    documentsInitialized = true;
    console.log(`Successfully created embeddings for ${customerDocuments.length} customers`);
    return customerDocuments;
  } catch (error) {
    console.error("Error initializing customer documents:", error);
    throw error;
  }
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
 * @param query - The search query
 * @param limit - Maximum number of results to return
 * @returns Array of customers sorted by relevance
 */
export async function vectorSearch(query: string, limit: number = 3): Promise<Customer[]> {
  try {
    console.log(`Performing vector search for: "${query}"`);
    
    // Ensure documents are initialized
    const documents = await initializeCustomerDocuments();
    
    if (documents.length === 0) {
      console.warn("No customer documents available for search");
      return [];
    }
    
    // Get embedding for the query
    const queryEmbedding = await getEmbedding(query);
    
    // Calculate similarity scores
    const scoredResults = documents
      .map(doc => {
        if (!doc.embedding) {
          return { customer: doc.customer, similarity: 0 };
        }
        
        const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
        return {
          customer: doc.customer,
          similarity
        };
      })
      .filter(result => result.similarity > 0); // Filter out zero scores
    
    // Sort by similarity (highest first) and take top results
    const topResults = scoredResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(result => result.customer);
    
    console.log(`Found ${topResults.length} relevant customers via vector search`);
    return topResults;
  } catch (error) {
    console.error("Error in vector search:", error);
    // Fall back to simple text search if vector search fails
    return simpleSearch(query, limit);
  }
}

/**
 * Simple text search as fallback
 */
function simpleSearch(query: string, limit: number = 3): Promise<Customer[]> {
  console.log(`Falling back to simple search for: "${query}"`);
  
  if (!query || query.trim() === '') {
    return Promise.resolve([]);
  }
  
  const queryLower = query.toLowerCase();
  const terms = queryLower.split(/\s+/);
  
  // Create a simple scorer function
  function score(text: string): number {
    text = text.toLowerCase();
    let score = 0;
    
    if (text.includes(queryLower)) {
      score += 10;
    }
    
    for (const term of terms) {
      if (term.length > 2 && text.includes(term)) {
        score += 2;
      }
    }
    
    return score;
  }
  
  const customers = customerData as Customer[];
  const results = customers
    .map(customer => {
      const searchText = `
        ${customer.customerId}
        ${customer.firstName} ${customer.lastName}
        ${customer.email}
        ${customer.phoneNumber}
        ${customer.address.street} ${customer.address.city} ${customer.address.state} ${customer.address.zipCode}
        ${customer.products.map(p => p.type).join(' ')}
        ${customer.notes || ''}
      `;
      
      const relevance = score(searchText);
      
      return {
        customer,
        relevance
      };
    })
    .filter(r => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
    .map(r => r.customer);
  
  console.log(`Found ${results.length} relevant customers via simple search`);
  return Promise.resolve(results);
} 