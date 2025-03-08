/**
 * Simple Chat API Route
 * This API provides a basic chatbot response without using ChromaDB
 * or other complex dependencies that cause build issues.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchSimilarCustomers } from "@/lib/vectorDb";
import { generateRagResponse } from "@/lib/ollama";

// Rate limiting: store client IPs and their request timestamps
const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;
const ONE_MINUTE = 60 * 1000;

/**
 * POST handler for chat API
 * Implements RAG (Retrieval Augmented Generation) with persistent vector database
 */
export async function POST(request: NextRequest) {
  try {
    // Start timing the request processing
    const startTime = performance.now();
    
    // Rate limiting check
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    if (rateLimitMap.has(clientIp)) {
      const timestamps = rateLimitMap.get(clientIp) || [];
      // Filter out timestamps older than 1 minute
      const recentTimestamps = timestamps.filter(ts => now - ts < ONE_MINUTE);
      
      if (recentTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
      
      rateLimitMap.set(clientIp, [...recentTimestamps, now]);
    } else {
      rateLimitMap.set(clientIp, [now]);
    }
    
    // Clean up old entries in the rate limit map
    if (rateLimitMap.size > 1000) {
      for (const [ip, timestamps] of rateLimitMap.entries()) {
        const recentTimestamps = timestamps.filter(ts => now - ts < ONE_MINUTE);
        if (recentTimestamps.length === 0) {
          rateLimitMap.delete(ip);
        } else {
          rateLimitMap.set(ip, recentTimestamps);
        }
      }
    }
    
    // Parse the request body
    const { query } = await request.json();
    
    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    console.log(`Chat API received query: "${query}"`);
    
    // Step 1: Retrieve relevant customer data using vector database search
    // This is much faster now since embeddings are pre-computed and stored
    const customers = await searchSimilarCustomers(query, 3);
    
    // Step 2: Format customer information as context for the RAG system
    let context = '';
    
    if (customers.length > 0) {
      context = customers.map(customer => {
        return `--- Customer Information ---
ID: ${customer.customerId}
Name: ${customer.firstName} ${customer.lastName}
Email: ${customer.email}
Phone: ${customer.phoneNumber}
Address: ${customer.address.street}, ${customer.address.city}, ${customer.address.state} ${customer.address.zipCode}
Products: ${customer.products.map(p => p.type).join(", ")}
Transactions: ${customer.recentTransactions.map(t => `${t.date}: ${t.amount} for ${t.description}`).join("; ")}
Customer Rating: ${customer.customerRating || 'Not rated'}
Join Date: ${customer.joinDate || 'Unknown'}
Additional Notes: ${customer.notes || 'No additional notes'}
`;
      }).join('\n\n');
    } else {
      context = "No matching customer records found.";
    }
    
    // Step 3: Generate a response using the RAG approach with Ollama
    const response = await generateRagResponse(query, context);
    
    // Calculate the total processing time in milliseconds
    const endTime = performance.now();
    const processingTimeMs = Math.round(endTime - startTime);
    
    // Convert milliseconds to seconds with 2 decimal places
    const processingTime = (processingTimeMs / 1000).toFixed(2);
    
    return NextResponse.json({
      response,
      matchedCustomers: customers.map(c => ({
        id: c.customerId,
        name: `${c.firstName} ${c.lastName}`,
      })),
      processingTime, // Processing time in seconds
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

/**
 * Generate a response based on the query and context
 * This is a simplified rule-based approach that doesn't require an LLM
 */
function generateResponse(query: string, context: string): string {
  // Simple response for no data found
  if (context === "No relevant customer information found.") {
    return "I'm sorry, I couldn't find any relevant customer information for your query.";
  }
  
  // Parse the customer data back from JSON
  const customerObjects = context.split("\n\n").map(json => {
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
  
  // No customer data found
  if (customerObjects.length === 0) {
    return "I'm sorry, I couldn't find any information that would help answer your question.";
  }
  
  // Get the first customer as our main subject
  const customer = customerObjects[0];
  
  // Simple pattern matching for common questions
  const queryLower = query.toLowerCase();
  
  // Contact information requests
  if (queryLower.includes("email") || queryLower.includes("contact")) {
    return `${customer.firstName} ${customer.lastName}'s email is ${customer.email} and their phone number is ${customer.phoneNumber}.`;
  }
  
  // Product information
  if (queryLower.includes("product") || queryLower.includes("account") || queryLower.includes("have")) {
    const products = customer.products.map((p: any) => p.type).join(", ");
    return `${customer.firstName} ${customer.lastName} has the following products: ${products}.`;
  }
  
  // Transaction information
  if (queryLower.includes("transaction") || queryLower.includes("purchase") || queryLower.includes("bought")) {
    if (customer.recentTransactions && customer.recentTransactions.length > 0) {
      const transactions = customer.recentTransactions.map((t: any) => 
        `${t.date}: ${t.description} - $${t.amount}`
      ).join("\n- ");
      return `Here are ${customer.firstName} ${customer.lastName}'s recent transactions:\n- ${transactions}`;
    } else {
      return `I don't have any transaction information for ${customer.firstName} ${customer.lastName}.`;
    }
  }
  
  // Customer notes
  if (queryLower.includes("note") || queryLower.includes("comment")) {
    return customer.notes 
      ? `Notes for ${customer.firstName} ${customer.lastName}: ${customer.notes}`
      : `There are no notes for ${customer.firstName} ${customer.lastName}.`;
  }
  
  // Address information
  if (queryLower.includes("address") || queryLower.includes("live") || queryLower.includes("location")) {
    return `${customer.firstName} ${customer.lastName} is located in ${customer.address.city}, ${customer.address.state}.`;
  }
  
  // Default response with basic info
  return `I found information for ${customer.firstName} ${customer.lastName} (Customer ID: ${customer.customerId}). What specific details would you like to know? I can tell you about their contact information, products, or recent transactions.`;
} 