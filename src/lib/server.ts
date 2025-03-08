/**
 * Server Utilities
 * This file contains utility functions for server-side code.
 */

/**
 * Ensures a module is only imported on the server side
 * This prevents client-side imports of server-only modules which can cause build errors
 */
export function ensureServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('This module can only be used on the server side');
  }
} 