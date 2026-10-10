/**
 * Utility functions for database operation logging
 * These helpers extract metadata from database operations for diagnostic purposes
 */

/**
 * Extract the source (calling function/file) from the call stack
 * Filters out internal Supabase and logger stack frames to find the actual caller
 */
export function extractSourceFromStack(): string {
  const stack = new Error().stack;
  if (!stack) return 'unknown';

  const lines = stack.split('\n');

  // Skip the first few lines (Error, extractSourceFromStack, logging function)
  // and find the first line that's not from supabase internals or logger
  for (let i = 3; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];

    // Skip supabase internal calls and logger calls
    if (
      line.includes('supabase/client') ||
      line.includes('supabase/logger') ||
      line.includes('node_modules') ||
      line.includes('webpack')
    ) {
      continue;
    }

    // Extract file path and function name
    const match = line.match(/at\s+(?:async\s+)?(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    if (match) {
      const [, functionName, filePath, lineNumber] = match;
      const shortPath = filePath.replace(/.*\/src\//, 'src/');
      return `${functionName} (${shortPath}:${lineNumber})`;
    }

    // Fallback for anonymous functions
    const simpleMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);
    if (simpleMatch) {
      const [, filePath, lineNumber] = simpleMatch;
      const shortPath = filePath.replace(/.*\/src\//, 'src/');
      return `${shortPath}:${lineNumber}`;
    }
  }

  return 'unknown';
}

/**
 * Estimate the size of data in KB
 * Used for tracking data volume in database operations
 */
export function estimateDataSize(data: any): number {
  if (!data) return 0;

  try {
    const jsonString = JSON.stringify(data);
    const bytes = new Blob([jsonString]).size;
    return Math.round((bytes / 1024) * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.warn('Failed to estimate data size:', error);
    return 0;
  }
}

/**
 * Parse operation type from the query builder method chain
 * Determines if it's a SELECT, INSERT, UPDATE, DELETE, or RPC operation
 */
export function parseOperationType(method: string): string {
  const methodUpper = method.toUpperCase();

  if (methodUpper === 'SELECT') return 'SELECT';
  if (methodUpper === 'INSERT') return 'INSERT';
  if (methodUpper === 'UPDATE') return 'UPDATE';
  if (methodUpper === 'DELETE') return 'DELETE';
  if (methodUpper === 'RPC') return 'RPC';
  if (methodUpper === 'UPSERT') return 'UPSERT';

  return 'UNKNOWN';
}

/**
 * Sanitize query details to remove sensitive information
 * Extracts relevant metadata without including actual data values
 */
export function sanitizeQueryDetails(details: any): Record<string, any> {
  if (!details) return {};

  const sanitized: Record<string, any> = {};

  // Include safe metadata fields
  if (details.method) sanitized.method = details.method;
  if (details.count) sanitized.count = details.count;
  if (details.limit) sanitized.limit = details.limit;
  if (details.offset) sanitized.offset = details.offset;
  if (details.order) sanitized.order = details.order;
  if (details.filters) {
    // Include filter keys but not values
    sanitized.filterKeys = Object.keys(details.filters);
  }

  return sanitized;
}

/**
 * Format error for logging
 * Extracts error message and relevant details
 */
export function formatError(error: any): string {
  if (!error) return '';

  if (typeof error === 'string') return error;

  if (error.message) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
