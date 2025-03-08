/**
 * Mock ChromaDB module for client-side
 * This file completely mocks the ChromaDB module to prevent client-side errors
 */

// Create a mock ChromaDB class
const MockChroma = {
  fromDocuments: () => Promise.resolve({}),
  fromExistingCollection: () => Promise.resolve({}),
  withClient: () => Promise.resolve({}),
  as_retriever: () => ({}),
  similaritySearch: () => Promise.resolve([]),
};

// Export a mock module
module.exports = {
  Chroma: MockChroma,
  default: MockChroma,
};

// Also support ES modules
module.exports.__esModule = true; 