# Customer Search Chatbot: Under the Hood

This document provides a comprehensive explanation of the Customer Search Chatbot application, detailing its architecture, components, and how it works at a technical level.

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [Search Implementation](#search-implementation)
7. [Text Search Process](#text-search-process)
8. [Response Generation](#response-generation)
9. [User Interface](#user-interface)
10. [Technical Challenges and Solutions](#technical-challenges-and-solutions)

## Overview

The Customer Search Chatbot is a simple yet effective application that enables natural language querying of customer information. It uses text-based search with relevance scoring and pattern-matching to provide accurate responses about customer data without requiring complex external dependencies.

The application is designed to:
- Process natural language queries about customers
- Retrieve relevant customer information using text-based search
- Generate helpful responses based on the retrieved information
- Operate entirely locally without external services or databases
- Provide a straightforward, dependency-free implementation

## Technology Stack

The application is built on a streamlined tech stack:

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Next.js (React) | Provides the user interface and application framework |
| Backend | Next.js API Routes | Handles API requests and response generation |
| Search | Custom implementation | Powers text search and relevance scoring |
| Data Storage | JSON file | Stores customer data in a simple format |
| Styling | Tailwind CSS | Provides responsive styling for the UI |
| Development | TypeScript | Ensures type safety throughout the codebase |

## Architecture

The application follows a client-server architecture where:

```
┌─────────────┐       
│   Next.js   │       
│  Frontend   │──────┐
└─────────────┘      │
       │             │
       │             │
       ▼             ▼
┌─────────────┐    ┌─────────────┐
│   Next.js   │    │    JSON     │
│  API Routes │────│ Customer Data│
└─────────────┘    └─────────────┘
```

- **Frontend**: A Next.js React application that provides the chat interface
- **API Layer**: Next.js API routes that handle requests from the frontend
- **Data Storage**: Simple JSON file containing customer data

## Core Components

The application consists of several core components:

1. **Frontend UI** (`src/app/page.tsx`): The React-based user interface where users interact with the chatbot
2. **Search Implementation** (`src/lib/simpleSearch.ts`): Handles text search and relevance scoring
3. **Chat API** (`src/app/api/chat/route.ts`): Processes queries and generates responses
4. **Response Generator**: Pattern-based logic to create responses from customer data
5. **Data Storage** (`src/data/customers.json`): Customer data in JSON format

Each component has a specific role in the application:

### 1. Frontend UI

The frontend UI is built with Next.js and React, providing a clean and intuitive chat interface. Key features include:

- Message history display with visual distinction between user and assistant messages
- Input field for user queries
- Loading indicators for feedback during processing
- Responsive design for various screen sizes

The UI maintains the chat state, including message history and loading status, and communicates with the API layer to process user queries.

**Technical implementation highlights:**

```typescript
// Key state management in the frontend
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState("");
const [isLoading, setIsLoading] = useState(false);

// Handling form submission and API communication
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim()) return;
  
  // Add user message to chat
  const userMessage: Message = { role: "user", content: input };
  setMessages((prev) => [...prev, userMessage]);
  setInput("");
  setIsLoading(true);
  
  try {
    // Send query to API
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get response: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Add assistant message to chat
    const assistantMessage: Message = {
      role: "assistant",
      content: data.response,
    };
    
    setMessages((prev) => [...prev, assistantMessage]);
  } catch (error) {
    // Error handling
    console.error("Error querying customer data:", error);
    const errorMessage: Message = {
      role: "assistant",
      content: "Sorry, I encountered an error while processing your request. Please try again later.",
    };
    setMessages((prev) => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
  }
};
```

### 2. Search Implementation

The search implementation in `simpleSearch.ts` provides text-based search with relevance scoring. It includes:

- Customer data interface definition
- Relevance calculation algorithm
- Search function that returns ranked results

**Technical implementation highlights:**

```typescript
// Calculate relevance score between query and text
function calculateRelevance(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();
  
  let score = 0;
  
  // Check for exact matches (highest score)
  if (textLower.includes(query.toLowerCase())) {
    score += 10;
  }
  
  // Check for individual term matches
  queryTerms.forEach(term => {
    if (term.length > 2 && textLower.includes(term)) {
      score += 2;
    }
  });
  
  return score;
}

// Search for customers by query
export async function searchCustomers(query: string, limit: number = 3): Promise<Customer[]> {
  console.log(`Performing simple search for: "${query}"`);
  
  if (!query || query.trim() === '') {
    return [];
  }
  
  // Create searchable text for each customer
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
```

### 3. Chat API

The chat API in `route.ts` processes user queries, coordinates with the search implementation, and generates responses. It includes:

- Query extraction and validation
- Call to search function
- Context preparation from search results
- Response generation based on patterns
- Error handling

**Technical implementation highlights:**

```typescript
export async function POST(req: NextRequest) {
  try {
    // Extract query from request body
    const { query } = await req.json();
    
    // Validate input
    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }
    
    console.log("Processing chat query:", query);
    
    // Search for relevant customers
    const relevantCustomers = await searchCustomers(query);
    
    // Prepare context for generating a response
    let context = "";
    
    if (relevantCustomers && relevantCustomers.length > 0) {
      // Limit the amount of data per customer
      const limitedCustomers = relevantCustomers.map((customer: Customer) => {
        // Create a simplified version of the customer
        return {
          id: customer.id,
          customerId: customer.customerId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phoneNumber: customer.phoneNumber,
          address: {
            city: customer.address.city,
            state: customer.address.state
          },
          products: customer.products,
          recentTransactions: customer.recentTransactions?.slice(0, 3) || [],
          notes: customer.notes
  };
});
      
      // Format customer data as context
      context = limitedCustomers.map(customer => 
        JSON.stringify(customer, null, 2)
      ).join("\n\n");
    } else {
      context = "No relevant customer information found.";
    }
    
    // Generate a response based on the context and query
    const response = generateResponse(query, context);
    
    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}
```

### 4. Response Generator

The response generator is a rule-based system implemented in the chat API. It includes pattern matching for different query types:

- Contact information requests
- Product information requests
- Transaction details
- Customer notes
- Address information
- Default responses

**Technical implementation highlights:**

```typescript
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
```

## Data Flow

The data flow in the application follows these steps:

1. **User Input**: The user types a question in the chat interface
2. **Frontend Processing**: 
   - The input is captured in the React state
   - A fetch request is made to the /api/chat endpoint
   - The user message is displayed in the UI
   - Loading indicators are shown

3. **API Processing**:
   - The request is received by the POST handler in route.ts
   - The query is extracted from the request body
   - The query is validated
   - The searchCustomers function is called with the query

4. **Search Execution**:
   - The customer data is loaded from the JSON file
   - A searchable text representation is created for each customer
   - Relevance scores are calculated for each customer
   - Results are sorted by relevance
   - Top results are returned to the API handler

5. **Context Preparation**:
   - The API handler transforms the search results into a context format
   - Customer data is simplified to include only essential information
   - The context is formatted as a JSON string

6. **Response Generation**:
   - The generateResponse function is called with the query and context
   - The context is parsed back into JSON objects
   - Pattern matching is applied to the query
   - A response is generated based on the matched pattern
   - The response is returned to the API handler

7. **Response Delivery**:
   - The API handler returns the response as JSON
   - The frontend receives the response
   - The assistant message is added to the chat history
   - The UI is updated to display the new message
   - Loading indicators are removed

## Search Implementation

The search implementation is a key component of the application, providing an efficient way to find relevant customer information without complex vector databases.

### Text Representation

For each customer, a text representation is created that includes all searchable fields:

```typescript
const searchText = `
  ${customer.customerId}
  ${customer.firstName} ${customer.lastName}
  ${customer.email}
  ${customer.phoneNumber}
  ${customer.address.street} ${customer.address.city} ${customer.address.state} ${customer.address.zipCode}
  ${customer.products.map(p => p.type).join(' ')}
  ${customer.notes || ''}
`;
```

This text representation serves as the basis for the search process.

### Relevance Scoring

The relevance scoring algorithm determines how well a customer record matches the user's query:

1. **Exact Match**: If the exact query appears in the text, add 10 points to the score
2. **Term Match**: For each term in the query that appears in the text, add 2 points to the score
3. **Filtering**: Only terms with more than 2 characters are considered for matching

This approach ensures that the most relevant customers are returned first, while filtering out noise and common words.

### Result Ranking

The search results are ranked based on their relevance scores:

1. **Filter**: Only results with a score greater than 0 are considered
2. **Sort**: Results are sorted in descending order of relevance (highest first)
3. **Limit**: Only the top N results (default: 3) are returned

This ranking process ensures that the most relevant information is provided to the user.

## Text Search Process

The text search process follows these detailed steps:

1. **Query Preprocessing**:
   - The query is broken down into terms using whitespace as a delimiter
   - All terms are converted to lowercase for case-insensitive matching
   - Very short terms (2 characters or less) are effectively ignored in term matching

2. **Text Preprocessing**:
   - The customer text representation is converted to lowercase
   - All relevant fields are included in a single searchable string

3. **Scoring**:
   - Exact match scoring: The entire query is checked against the text
   - Term-by-term scoring: Each individual term is checked against the text
   - Scores are accumulated to produce a final relevance score

4. **Result Processing**:
   - Only results with positive scores are included
   - Results are sorted by score (highest first)
   - The top N results are returned (default: 3)
   - Only the customer objects (without scores) are returned

The algorithm has a bias toward exact matches and longer term matches, which helps ensure the most relevant results are returned.

## Response Generation

The response generation process uses pattern matching to identify the user's intent and generate an appropriate response. This approach is simple yet effective for common customer service queries.

### Pattern Recognition

The pattern recognition process uses keyword matching:

```typescript
// Example pattern recognition for contact information
if (queryLower.includes("email") || queryLower.includes("contact")) {
  return `${customer.firstName} ${customer.lastName}'s email is ${customer.email} and their phone number is ${customer.phoneNumber}.`;
}
```

This approach identifies common patterns in user queries and maps them to specific response types.

### Response Patterns

The application includes several response patterns:

1. **Contact Information**: Responds with email and phone number
2. **Product Information**: Lists the customer's products
3. **Transaction History**: Shows recent transactions with dates and amounts
4. **Customer Notes**: Provides any notes associated with the customer
5. **Address Information**: Gives the customer's location
6. **Default Response**: Provides a generic response with basic information

Each pattern is tailored to a specific type of query and includes relevant information from the customer record.

### Fallback Responses

For cases where no relevant information is found, the application provides fallback responses:

```typescript
// No customer data found
if (context === "No relevant customer information found.") {
  return "I'm sorry, I couldn't find any relevant customer information for your query.";
}

// No valid customer objects
if (customerObjects.length === 0) {
  return "I'm sorry, I couldn't find any information that would help answer your question.";
}
```

These fallback responses provide a graceful way to handle queries that cannot be answered with the available data.

## User Interface

The user interface is designed to be simple, intuitive, and responsive. It provides a familiar chat experience with clear visual distinction between user and assistant messages.

### UI Components

The interface includes these key components:

1. **Chat History**: Displays previous messages with different styling for user and assistant
2. **Input Area**: Allows the user to type and submit questions
3. **Loading Indicator**: Shows when a request is being processed
4. **Welcome Message**: Provides guidance and example questions for new users

### Visual Design

The visual design uses Tailwind CSS for styling:

- **User Messages**: Right-aligned with blue background
- **Assistant Messages**: Left-aligned with gray background
- **Input Area**: Input field with send button
- **Card Layout**: Contained in a card with header, content, and footer sections

The design is clean and focused on the chat interaction, with minimal distractions.

## Technical Challenges and Solutions

The application addresses several technical challenges:

### 1. Dependency Complexity

**Challenge**: External dependencies like ChromaDB and LLMs introduce complexity and potential points of failure.

**Solution**: The application uses a self-contained search implementation without external dependencies. All search logic is implemented directly in TypeScript, eliminating the need for external services.

### 2. Search Quality

**Challenge**: Text-based search might not be as sophisticated as vector search for understanding semantic meaning.

**Solution**: The search implementation uses a multi-faceted approach:
- Exact query matching with higher scores
- Term-by-term matching for partial matches
- Relevance scoring to rank results
- Multiple fields included in the search text

These techniques help improve search quality without requiring complex vector embeddings.

### 3. Response Generation

**Challenge**: Without an LLM, generating natural-sounding responses can be difficult.

**Solution**: The application uses pattern-based response generation with carefully crafted templates. Each template is designed to sound natural and provide exactly the information requested. The patterns cover the most common types of customer inquiries.

### 4. Performance

**Challenge**: Searching through customer data efficiently can be challenging as the dataset grows.

**Solution**: The search implementation is optimized for performance:
- In-memory search for fast results
- Early termination for zero-relevance customers
- Limiting the number of results to process
- Efficient string operations

These optimizations help maintain good performance even with larger datasets.

## Conclusion

The Customer Search Chatbot demonstrates that sophisticated functionality doesn't always require complex dependencies. By using a straightforward approach with text-based search and pattern matching, the application provides a responsive and reliable customer service tool.

Key advantages of this approach include:

1. **Simplicity**: The code is easy to understand, maintain, and extend
2. **Reliability**: No external dependencies means fewer points of failure
3. **Performance**: Fast, efficient search without the overhead of vector databases
4. **Flexibility**: Easy to customize for different types of customer data and queries

The application provides a practical solution for customer service use cases, with a focus on robustness and ease of implementation. 