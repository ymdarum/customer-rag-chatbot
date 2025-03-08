/**
 * ChromaDB Initialization Script
 * This script loads customer data into ChromaDB for vector search.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { ChromaClient } = require('chromadb');
const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');
const { Document } = require('@langchain/core/documents');
const { Chroma } = require('@langchain/community/vectorstores/chroma');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Configuration
const CUSTOMER_DATA_PATH = path.join(__dirname, '../src/data/customers.json');
const CHROMA_API_URL = process.env.CHROMA_DB_URL || 'http://localhost:8000';
const OLLAMA_API_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const COLLECTION_NAME = 'customer_data';

/**
 * Check if a service is running
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} - Whether the service is running
 */
async function isServiceRunning(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      method: 'GET'
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Create a text representation of a customer
 * @param {Object} customer - The customer object
 * @returns {string} - Text representation of the customer
 */
function createCustomerText(customer) {
  return `
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
}

/**
 * Initialize ChromaDB with customer data
 */
async function initializeChromaDB() {
  console.log(`${colors.blue}Initializing ChromaDB with customer data...${colors.reset}`);
  console.log(`${colors.cyan}ChromaDB URL: ${CHROMA_API_URL}${colors.reset}`);
  console.log(`${colors.cyan}Ollama URL: ${OLLAMA_API_URL}${colors.reset}`);
  
  // Check if ChromaDB is running
  const isChromaRunning = await isServiceRunning(CHROMA_API_URL);
  if (!isChromaRunning) {
    console.error(`${colors.red}Error: ChromaDB is not running at ${CHROMA_API_URL}${colors.reset}`);
    console.log(`${colors.yellow}Please start ChromaDB with: docker run -d -p 8000:8000 chromadb/chroma${colors.reset}`);
    process.exit(1);
  }
  
  // Check if Ollama is running
  const isOllamaRunning = await isServiceRunning(OLLAMA_API_URL);
  if (!isOllamaRunning) {
    console.error(`${colors.red}Error: Ollama is not running at ${OLLAMA_API_URL}${colors.reset}`);
    console.log(`${colors.yellow}Please start Ollama and ensure the llama3.2 model is available${colors.reset}`);
    process.exit(1);
  }
  
  // Check if customer data exists
  if (!fs.existsSync(CUSTOMER_DATA_PATH)) {
    console.error(`${colors.red}Error: Customer data not found at ${CUSTOMER_DATA_PATH}${colors.reset}`);
    process.exit(1);
  }
  
  try {
    // Load customer data
    const customersData = JSON.parse(fs.readFileSync(CUSTOMER_DATA_PATH, 'utf8'));
    console.log(`${colors.green}Loaded ${customersData.length} customers from data file${colors.reset}`);
    
    // Create embeddings using Ollama
    const embeddings = new OllamaEmbeddings({
      model: "llama3.2",
      baseUrl: OLLAMA_API_URL,
    });
    
    // Connect to ChromaDB
    const client = new ChromaClient({ path: CHROMA_API_URL });
    
    // Check if collection exists and delete it if it does
    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === COLLECTION_NAME);
    
    if (collectionExists) {
      console.log(`${colors.yellow}Collection '${COLLECTION_NAME}' already exists. Deleting...${colors.reset}`);
      await client.deleteCollection({ name: COLLECTION_NAME });
    }
    
    // Prepare documents for the vector store
    const documents = customersData.map(customer => {
      // Create a text representation of the customer
      const customerText = createCustomerText(customer);
      
      // Return document with metadata
      return new Document({
        pageContent: customerText,
        metadata: { 
          customerId: customer.customerId,
          fullData: JSON.stringify(customer)
        }
      });
    });
    
    // Create the vector store
    console.log(`${colors.blue}Creating vector store with ${documents.length} documents...${colors.reset}`);
    await Chroma.fromDocuments(documents, embeddings, {
      collectionName: COLLECTION_NAME,
      url: CHROMA_API_URL,
    });
    
    console.log(`${colors.green}Successfully initialized ChromaDB with customer data!${colors.reset}`);
    console.log(`${colors.cyan}Collection: ${COLLECTION_NAME}${colors.reset}`);
    console.log(`${colors.cyan}Documents: ${documents.length}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error initializing ChromaDB:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the initialization
initializeChromaDB().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
}); 