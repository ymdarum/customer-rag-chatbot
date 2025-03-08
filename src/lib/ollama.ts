/**
 * Ollama API Client
 * This module provides functions for interacting with the Ollama API.
 * Ollama should be running locally on port 11434.
 */

// Base URL for Ollama API
const OLLAMA_BASE_URL = "http://localhost:11434/api";
// Default model for embeddings
const EMBEDDING_MODEL = "nomic-embed-text";
// Default model for chat completions
const CHAT_MODEL = "llama3.2";

// Interface for chat message
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Interface for embedding response
interface EmbeddingResponse {
  embedding: number[];
}

// Interface for chat generation options
interface GenerationOptions {
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// Interface for chat completion response
interface ChatCompletionResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
}

/**
 * Generate embeddings for a text using Ollama
 * @param text - The text to generate embeddings for
 * @returns A vector representation of the text
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    console.log(`Generating embedding for text (${text.length} chars)`);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Embedding API error:", error);
      throw new Error(`Ollama embedding API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as EmbeddingResponse;
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Invalid embedding response from Ollama API");
    }
    
    return data.embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Get a chat response from Ollama
 * @param messages - Array of chat messages
 * @param options - Generation options
 * @returns The assistant's response
 */
export async function getChatResponse(
  messages: ChatMessage[],
  options: GenerationOptions = {}
): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: messages,
        temperature: options.temperature ?? 0.7,
        // Use 0 for unlimited tokens
        max_tokens: options.max_tokens ?? 0,
        stream: options.stream ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Chat API error:", error);
      throw new Error(`Ollama chat API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as ChatCompletionResponse;
    return data.message.content;
  } catch (error) {
    console.error("Error getting chat response:", error);
    throw error;
  }
}

/**
 * Generate a RAG response using context and Ollama
 * @param userQuery - The user's question
 * @param context - Relevant context for the query
 * @param isComprehensiveSearch - Whether this query is a comprehensive database search
 * @returns The assistant's response with context-enhanced knowledge
 */
export async function generateRagResponse(
  userQuery: string,
  context: string,
  isComprehensiveSearch: boolean = false
): Promise<string> {
  const systemPrompt = `You are a helpful customer service assistant. 
Use the following customer information to answer the user's question.
Only use information provided in the context below. If you don't know 
the answer based on the provided context, say so politely.

IMPORTANT INSTRUCTIONS FOR PRODUCT INFORMATION:
1. The customer data contains two COMPLETELY SEPARATE sections:
   - "PRODUCTS" section lists the financial products a customer has, including account details and balances
   - "RECENT TRANSACTIONS" section lists the customer's recent financial transactions
2. These are DIFFERENT pieces of information and should NEVER be confused.
3. When asked about balances or financial information, check the detailed PRODUCTS section.
4. Each product may have different financial values:
   - Savings/Checking Accounts have "Balance"
   - Credit Cards have "Current Balance" and "Credit Limit"
   - Loans have "Outstanding Balance" and "Original Amount"
5. Always provide precise financial information when available in the data.
6. Format currency values with dollar signs and two decimal places (e.g., $1,234.56).

IMPORTANT INSTRUCTIONS FOR LISTING AND COUNTING CUSTOMERS:
1. When asked to list "top N customers" or customers with the "most products", present the results in a clear, numbered list.
2. For each customer in such a list, include:
   - Their ID and name
   - The exact number of products they have
   - A brief list of their product types
3. For questions asking "how many customers have more than X products?", provide an exact count.
4. When a query asks both for a count AND a list (e.g., "how many customers have more than 3 products? list top 5"), answer BOTH parts of the question.
5. Always make your answers data-driven based on the exact information provided, not general knowledge.

${isComprehensiveSearch ? `
COMPREHENSIVE SEARCH INSTRUCTIONS:
1. This query is a comprehensive search of the entire customer database
2. Analyze ALL customers provided in the context, not just a few examples
3. Provide a thorough and accurate answer based on ALL the customer data
4. If counting or summarizing data, make sure to include ALL customers
5. Be explicit about how many total customers were examined
` : ''}

Customer information:
${context}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuery }
  ];

  try {
    return await getChatResponse(messages, {
      temperature: 0.1, // Very low temperature for highly factual responses
    });
  } catch (error) {
    console.error("RAG response error:", error);
    return "I'm sorry, I'm having trouble accessing the customer information right now. Please try again in a moment.";
  }
} 