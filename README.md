# Customer RAG Chatbot

A Retrieval Augmented Generation (RAG) chatbot for querying customer information using Ollama and SQLite for vector storage.

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/ymdarum/customer-rag-chatbot)

## Features

- 🤖 **RAG Implementation**: Uses Retrieval Augmented Generation with Ollama
- 🔍 **SQLite Vector Database**: Persistent storage of embeddings for fast retrieval
- 💾 **Pre-computed Embeddings**: Vectorizes customer data once, not on every query
- 🚀 **Fast Responsive UI**: Clean, intuitive chat interface with Shadcn UI
- 🔄 **Fallback Mechanism**: Falls back to simple text search if vector search fails
- 🔒 **Rate Limiting**: Built-in protection against excessive requests

## System Architecture

This application implements a RAG (Retrieval Augmented Generation) approach with persistent vector storage:

1. **Embedding Generation**: Customer data is converted to vector embeddings using Ollama (one-time process)
2. **SQLite Storage**: Embeddings are stored in a SQLite database for persistence and fast retrieval
3. **Vector Search**: When users ask questions, only the query is vectorized and compared against stored embeddings
4. **Context Retrieval**: The most relevant customer data is retrieved based on vector similarity
5. **Response Generation**: Ollama generates natural language responses based on the retrieved context

## Prerequisites

- Node.js 18+ and npm
- [Ollama](https://ollama.ai/) installed locally
- nomic-embed-text and llama3.2 models pulled in Ollama

## Quick Start

1. **Clone the repository**

```bash
git clone <repository-url>
cd customer-rag-chatbot
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up Ollama**

First, [install Ollama](https://ollama.ai/download) for your platform.

Then, pull the required models:

```bash
ollama pull nomic-embed-text     # For embeddings
ollama pull llama3.2   # For chat responses
```

Verify that Ollama is running and the API is available at http://localhost:11434.

4. **Run the application**

```bash
npm run dev
```

The first time you run the application, it will:
- Create a SQLite database in the `vector_db` directory
- Generate embeddings for all customer data (this may take a few minutes)
- Store these embeddings for future use

5. **Open your browser**

Navigate to `http://localhost:3000` to use the chatbot.

## Project Structure

```
customer-rag-chatbot/
├── src/
│   ├── app/                    # Next.js app routes
│   │   ├── api/                # API routes
│   │   │   └── chat/           # Chat API endpoint
│   │   └── page.tsx            # Main chat interface
│   ├── components/             # UI components
│   │   ├── ui/                 # Shadcn UI components
│   │   └── Chat.tsx            # Main chat component
│   ├── lib/                    # Utility functions
│   │   ├── ollama.ts           # Ollama API client
│   │   ├── vectorDb.ts         # SQLite vector database implementation
│   │   ├── vectorStore.ts      # Vector utilities and interfaces
│   │   ├── init.ts             # Initialization module
│   │   └── simpleSearch.ts     # Legacy text search (fallback)
│   └── data/                   # Customer data (JSON)
├── vector_db/                  # SQLite database for vector storage
├── public/                     # Static assets
└── package.json                # Project dependencies
```

## How It Works

### Vector Database Implementation

The application uses SQLite to store and retrieve vector embeddings:

```typescript
// Initialize the database
await initVectorDb();

// Search for similar customers
const customers = await searchSimilarCustomers(query, 3);
```

The vector database:
1. Stores customer data and embeddings in separate tables
2. Uses JSON serialization for vector storage
3. Implements cosine similarity for vector comparison
4. Provides functions to add/update customer embeddings

### RAG Process Flow

1. **User Query**: The user asks a question about customer data
2. **Query Vectorization**: The question is converted to a vector embedding
3. **Vector Search**: The query embedding is compared against stored customer embeddings
4. **Context Retrieval**: The most relevant customer records are retrieved
5. **Context Formatting**: Customer data is formatted as context for the LLM
6. **Response Generation**: Ollama generates a response based on the context and query

## Customization

### Using Different Models

You can change the models used in `src/lib/ollama.ts`:

```typescript
// Default model for embeddings
const EMBEDDING_MODEL = "nomic-embed-text";
// Default model for chat completions
const CHAT_MODEL = "llama3.2";
```

### Modifying Customer Data

The application uses mock customer data located in `src/data/customers.json`. You can modify this file to include your own customer data.

After changing customer data, you should delete the `vector_db` directory to force regeneration of embeddings.

## Troubleshooting

### Ollama Connection Issues

If you encounter issues connecting to Ollama:

1. Verify Ollama is running: `ollama ps`
2. Check if the API is accessible: `curl http://localhost:11434/api/version`
3. Ensure the models are downloaded: `ollama list`

### Database Issues

If you encounter issues with the vector database:

1. Delete the `vector_db` directory to force regeneration
2. Check server logs for specific error messages
3. Ensure your system has SQLite support

### Next.js Build Issues

If you encounter build issues:

1. Make sure you're using the latest version of Next.js
2. Check that the `webpack` configuration in `next.config.js` is correct
3. Verify that the `server-only` package is properly installed

## Performance Considerations

- The first query after server start may be slower as the database initializes
- Subsequent queries will be much faster as embeddings are pre-computed
- The application is optimized for a few hundred customer records
- For very large datasets, consider using a more specialized vector database

## License

[MIT License](LICENSE)
