/**
 * Simple Search Module
 * This is a basic text search implementation that doesn't rely on ChromaDB
 * or other complex vector databases that cause build issues.
 */

import customerData from '@/data/customers.json';

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

/**
 * Calculate a simple relevance score between a query and text
 * Higher score = better match
 */
function calculateRelevance(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();
  
  let score = 0;
  
  // Check for exact matches
  if (textLower.includes(query.toLowerCase())) {
    score += 10;
  }
  
  // Check for term matches
  queryTerms.forEach(term => {
    if (term.length > 2 && textLower.includes(term)) {
      score += 2;
    }
  });
  
  return score;
}

/**
 * Search for customers by query string
 */
export async function searchCustomers(query: string, limit: number = 3): Promise<Customer[]> {
  console.log(`Performing simple search for: "${query}"`);
  
  if (!query || query.trim() === '') {
    return [];
  }
  
  // Create text representation of each customer for searching
  const customers = customerData as Customer[];
  const results = customers.map(customer => {
    // Create a searchable text representation
    const searchText = `
      ${customer.customerId}
      ${customer.firstName} ${customer.lastName}
      ${customer.email}
      ${customer.phoneNumber}
      ${customer.address.street} ${customer.address.city} ${customer.address.state} ${customer.address.zipCode}
      ${customer.products.map(p => p.type).join(' ')}
      ${customer.notes || ''}
    `;
    
    // Calculate relevance score
    const relevance = calculateRelevance(query, searchText);
    
    return {
      customer,
      relevance
    };
  });
  
  // Sort by relevance (highest first) and take top results
  const topResults = results
    .filter(r => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
    .map(r => r.customer);
  
  console.log(`Found ${topResults.length} relevant customers`);
  return topResults;
} 