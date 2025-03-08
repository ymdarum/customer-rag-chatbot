/**
 * Simple Chat API Route
 * This API provides a basic chatbot response without using ChromaDB
 * or other complex dependencies that cause build issues.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchSimilarCustomers } from "@/lib/vectorDb";
import { generateRagResponse } from "@/lib/ollama";

// Define Customer interface instead of importing it
interface Customer {
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
  dateOfBirth?: string;
  joinDate?: string;
  customerRating?: number;
  products: any[];
  recentTransactions?: any[];
  notes?: string;
}

// Rate limiting: store client IPs and their request timestamps
const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;
const ONE_MINUTE = 60 * 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST handler for chat API
 * Implements RAG (Retrieval Augmented Generation) with persistent vector database
 */
export async function POST(req: NextRequest) {
  console.log("Chat API route called");
  const startTime = Date.now();
  
  try {
    // Get the request body
    const requestData = await req.json();
    
    // Handle different request formats
    let userMessage: string;
    
    // Check which format the request is using
    if (requestData.messages && Array.isArray(requestData.messages) && requestData.messages.length > 0) {
      // Format: { messages: [{ role: "user", content: "message" }, ...] }
      userMessage = requestData.messages[requestData.messages.length - 1].content;
    } else if (requestData.query && typeof requestData.query === 'string') {
      // Format: { query: "message" }
      userMessage = requestData.query;
    } else {
      // Invalid request format
      throw new Error("Invalid request format. Expected either 'messages' array or 'query' string.");
    }
    
    // Log the extracted query
    console.log("User query:", userMessage);
    
    // Define patterns to detect comprehensive search requests
    const comprehensiveSearchPatterns = [
      /how many customers/i,               // Counting questions
      /customers? with more than/i,         // Filtering by threshold
      /list top \d+ customers?/i,           // Listing top N customers
      /top \d+ customers? with/i,           // Another top N pattern
      /most products?/i,                    // Questions about most products
      /all customers?/i,                    // Explicit all customers requests
      /count/i                              // General counting requests
    ];
    
    // Check if this is a comprehensive search query
    const isComprehensiveSearch = comprehensiveSearchPatterns.some(pattern => 
      pattern.test(userMessage)
    );
    
    console.log(`Comprehensive search: ${isComprehensiveSearch}`);
    
    // Set search limit based on query type
    const searchLimit = isComprehensiveSearch ? 1000 : 3;
    
    // Search for similar customers
    const searchResults = await searchSimilarCustomers(userMessage, searchLimit);
    
    console.log(`Found ${searchResults.length} customers relevant to query`);
    
    // Format customer data for context
    const formattedCustomers = searchResults.map(customer => {
      // Basic customer info
      let customerInfo = `CUSTOMER ID: ${customer.customerId}\n`;
      customerInfo += `NAME: ${customer.firstName} ${customer.lastName}\n`;
      customerInfo += `EMAIL: ${customer.email}\n`;
      customerInfo += `PHONE: ${customer.phoneNumber}\n`;
      customerInfo += `ADDRESS: ${customer.address.street}, ${customer.address.city}, ${customer.address.state} ${customer.address.zipCode}\n`;
      customerInfo += `CUSTOMER RATING: ${customer.customerRating}/5\n\n`;
      
      // Product information
      customerInfo += "PRODUCTS:\n";
      if (customer.products && customer.products.length > 0) {
        customer.products.forEach(product => {
          customerInfo += `- ${product.type} (${product.accountNumber})\n`;
          
          // Include specific financial details based on product type
          if ('balance' in product) {
            customerInfo += `  Balance: $${product.balance.toFixed(2)}\n`;
          }
          if ('interestRate' in product) {
            customerInfo += `  Interest Rate: ${product.interestRate}%\n`;
          }
          if ('creditLimit' in product) {
            customerInfo += `  Credit Limit: $${product.creditLimit.toFixed(2)}\n`;
          }
          if ('outstandingBalance' in product) {
            customerInfo += `  Outstanding Balance: $${product.outstandingBalance.toFixed(2)}\n`;
          }
          if ('originalAmount' in product) {
            customerInfo += `  Original Amount: $${product.originalAmount.toFixed(2)}\n`;
          }
          if ('currentBalance' in product) {
            customerInfo += `  Current Balance: $${product.currentBalance.toFixed(2)}\n`;
          }
          
          customerInfo += `  Opened: ${product.openedDate}\n`;
        });
      } else {
        customerInfo += "No products found.\n";
      }
      
      // Recent transactions
      customerInfo += "\nRECENT TRANSACTIONS:\n";
      if (customer.recentTransactions && customer.recentTransactions.length > 0) {
        customer.recentTransactions.slice(0, 5).forEach(transaction => {
          customerInfo += `- ${transaction.date}: ${transaction.type} - $${Math.abs(transaction.amount).toFixed(2)} - ${transaction.description}\n`;
        });
      } else {
        customerInfo += "No recent transactions found.\n";
      }
      
      return customerInfo;
    }).join("\n" + "=".repeat(50) + "\n\n");
    
    // Include database stats for comprehensive searches
    let contextPrefix = "";
    if (isComprehensiveSearch) {
      // Add database statistics to context for comprehensive searches
      contextPrefix = `DATABASE SUMMARY:
- Total customers examined: ${searchResults.length}
- This is a comprehensive database search result
- The following customers match your query criteria\n\n`;
    }
    
    const context = contextPrefix + formattedCustomers;
    
    // Generate a RAG response using context
    const assistantResponse = await generateRagResponse(
      userMessage, 
      context,
      isComprehensiveSearch  // Pass flag to inform the LLM this is a comprehensive search
    );
    
    // Calculate processing time
    const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds
    
    console.log(`Request processed in ${processingTime.toFixed(2)} seconds`);
    
    // Return the assistant's response
    return NextResponse.json({
      role: "assistant",
      content: assistantResponse,
      processingTime: processingTime
    });
    
  } catch (error) {
    console.error("Error in chat route:", error);
    return NextResponse.json(
      { error: "Failed to process your request: " + (error as Error).message },
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