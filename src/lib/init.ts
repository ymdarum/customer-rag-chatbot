/**
 * Initialization Module
 * 
 * This module handles initialization tasks that should run when the server starts.
 * It ensures the vector database is properly initialized before it's needed.
 */

import { initVectorDb } from './vectorDb';

/**
 * Initialize application services
 * This is called at server startup to ensure everything is ready
 */
export async function initializeServices() {
  try {
    console.log('Initializing application services...');
    
    // Initialize the vector database first - this ensures embeddings are ready
    await initVectorDb();
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    // We don't throw the error as we want the server to continue starting
    // even if initialization fails. Individual services will handle errors.
  }
}

// Start initialization immediately when this module is imported
initializeServices()
  .then(() => console.log('Initialization process started'))
  .catch(error => console.error('Error during initialization process:', error)); 