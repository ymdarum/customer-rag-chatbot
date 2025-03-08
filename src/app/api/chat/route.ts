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
    
    // Analyze the query to determine if we should search the entire database
    // Check for multiple patterns that would indicate a comprehensive search:
    // 1. Explicit requests to search the entire database
    // 2. Questions about counting or "how many" across all customers
    // 3. Questions comparing customers based on criteria
    const comprehensiveSearchPatterns = [
      // Explicit requests for full database search
      /search.*(whole|entire|all|complete|full).*database/i,
      /(all|every).*customers?/i,
      
      // Count or statistics questions
      /how many customers?/i,
      /count.*customers?/i,
      /number of customers?/i,
      
      // Questions about criteria across all customers
      /customers?.*(with|having|more than)/i,
      /which customers?/i,
      /find.*customers?/i
    ];
    
    // Check if any of the patterns match the query
    const searchWholeDatabase = comprehensiveSearchPatterns.some(pattern => pattern.test(query));
    
    // Set the search limit based on the query analysis
    // Use a high limit (effectively no limit) if the comprehensive search is needed
    const searchLimit = searchWholeDatabase ? 1000 : 3;
    console.log(`Search mode: ${searchWholeDatabase ? 'comprehensive search' : 'limited search'} with limit: ${searchLimit}`);
    
    // Step 1: Retrieve relevant customer data using vector database search
    // This is much faster now since embeddings are pre-computed and stored
    const customers = await searchSimilarCustomers(query, searchLimit);
    
    // For comprehensive searches, add a note about how many customers were actually found
    let comprehensiveSearchNote = '';
    if (searchWholeDatabase) {
      comprehensiveSearchNote = `\n\nNote: This response is based on a comprehensive search of all ${customers.length} matching customers in the database.`;
    }
    
    // Step 2: Format customer information as context for the RAG system
    let context = '';
    
    if (customers.length > 0) {
      context = customers.map(customer => {
        // Format the products section with explicit count and detailed product information including balances
        let productsSection = '';
        if (customer.products && customer.products.length > 0) {
          // Create a header for the products section
          productsSection = `PRODUCTS (${customer.products.length}):\n`;
          
          // Add detailed information for each product including balance and other details
          customer.products.forEach((product, index) => {
            productsSection += `  ${index + 1}. ${product.type}`;
            
            // Add account/card number if available
            if (product.accountNumber) {
              productsSection += ` (${product.accountNumber})`;
            } else if (product.cardNumber) {
              productsSection += ` (${product.cardNumber})`;
            } else if (product.loanNumber) {
              productsSection += ` (${product.loanNumber})`;
            }
            
            // Add balance information based on product type
            if (product.balance !== undefined) {
              productsSection += ` - Balance: $${product.balance.toFixed(2)}`;
            } else if (product.currentBalance !== undefined) {
              productsSection += ` - Current Balance: $${product.currentBalance.toFixed(2)}`;
              if (product.creditLimit !== undefined) {
                productsSection += `, Credit Limit: $${product.creditLimit.toFixed(2)}`;
              }
            } else if (product.outstandingBalance !== undefined) {
              productsSection += ` - Outstanding Balance: $${product.outstandingBalance.toFixed(2)}`;
              if (product.originalAmount !== undefined) {
                productsSection += `, Original Amount: $${product.originalAmount.toFixed(2)}`;
              }
            }
            
            // Add interest rate if available
            if (product.interestRate !== undefined) {
              productsSection += `, Interest Rate: ${product.interestRate}%`;
            }
            
            productsSection += '\n';
          });
        } else {
          productsSection = `PRODUCTS (0): Customer has NO products`;
        }
        
        // Format the transactions section clearly separated from products
        let transactionsSection = '';
        if (customer.recentTransactions && customer.recentTransactions.length > 0) {
          transactionsSection = `RECENT TRANSACTIONS (${customer.recentTransactions.length}): ${customer.recentTransactions.map(t => `${t.date}: ${t.amount} for ${t.description}`).join("; ")}`;
        } else {
          transactionsSection = `RECENT TRANSACTIONS (0): No recent transactions`;
        }
        
        return `--- Customer Information ---
ID: ${customer.customerId}
Name: ${customer.firstName} ${customer.lastName}
Email: ${customer.email}
Phone: ${customer.phoneNumber}
Address: ${customer.address.street}, ${customer.address.city}, ${customer.address.state} ${customer.address.zipCode}
${productsSection}${transactionsSection}
Customer Rating: ${customer.customerRating || 'Not rated'}
Join Date: ${customer.joinDate || 'Unknown'}
Additional Notes: ${customer.notes || 'No additional notes'}
`;
      }).join('\n\n');
    } else {
      context = "No matching customer records found.";
    }
    
    // Step 3: Generate a response using the RAG approach with Ollama
    const response = await generateRagResponse(query, context, searchWholeDatabase);
    
    // Step 4: Validate the response for common hallucinations about products
    let validatedResponse = response;
    
    // Add the comprehensive search note to the response if applicable
    if (searchWholeDatabase && comprehensiveSearchNote) {
      validatedResponse = validatedResponse + comprehensiveSearchNote;
    }
    
    // Check for potential hallucinations about product counts
    if (response.toLowerCase().includes('product') && customers.length > 0) {
      // Examine each customer mentioned in the response
      for (const customer of customers) {
        const customerId = customer.customerId;
        const customerName = `${customer.firstName} ${customer.lastName}`;
        const productCount = customer.products.length;
        
        // Check for incorrect product counts
        const incorrectPatterns = [
          // For customers with no products
          productCount === 0 && new RegExp(`${customerId}[^.]*?has [1-9][0-9]* products`, 'i'),
          productCount === 0 && new RegExp(`${customerName}[^.]*?has [1-9][0-9]* products`, 'i'),
          
          // For customers with products
          productCount > 0 && new RegExp(`${customerId}[^.]*?has 0 products`, 'i'),
          productCount > 0 && new RegExp(`${customerName}[^.]*?has 0 products`, 'i'),
          
          // For customers with specific product counts
          productCount > 0 && new RegExp(`${customerId}[^.]*?has [1-9][0-9]* products`, 'i')
        ].filter(Boolean);
        
        const hasIncorrectInfo = incorrectPatterns.some(pattern => pattern && pattern.test(response));
        
        if (hasIncorrectInfo) {
          console.log(`Detected potential hallucination about ${customerId} product count`);
          
          // Add a correction note to the response
          const correction = `\n\nCORRECTION: Customer ${customerId} (${customerName}) has exactly ${productCount} products. Please note that products are different from transactions.`;
          validatedResponse = response + correction;
          break; // Stop after finding the first hallucination
        }
      }
    }
    
    // Calculate the total processing time in milliseconds
    const endTime = performance.now();
    const processingTimeMs = Math.round(endTime - startTime);
    
    // Convert milliseconds to seconds with 2 decimal places
    const processingTime = (processingTimeMs / 1000).toFixed(2);
    
    return NextResponse.json({
      response: validatedResponse,
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