/**
 * Database operation logger for development diagnostics
 * Wraps Supabase client to log all database operations to dev_io_log table
 * Only active when import.meta.env.DEV === true
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import {
  extractSourceFromStack,
  estimateDataSize,
  parseOperationType,
  sanitizeQueryDetails,
  formatError,
} from './logger-utils';

// Track if we're currently logging to prevent infinite loops
let isLogging = false;

/**
 * Log a database operation to the dev_io_log table
 */
async function logOperation(
  client: SupabaseClient<Database>,
  operationType: string,
  tableName: string | null,
  source: string,
  queryDetails: any = null,
  dataSize: number = 0,
  duration: number = 0,
  error: string | null = null
) {
  // Prevent logging the logging operation itself
  if (isLogging) return;

  // Don't log operations on the dev_io_log table
  if (tableName === 'dev_io_log') return;

  try {
    isLogging = true;

    // Use a direct insert without going through the wrapper
    await client
      .from('dev_io_log')
      .insert({
        operation_type: operationType,
        table_name: tableName,
        source,
        query_details: queryDetails,
        data_size_kb: dataSize,
        duration_ms: duration,
        error,
      });
  } catch (err) {
    // Log errors to console in dev mode so we can debug logging issues
    console.error('[dev_io_log] Failed to log operation:', err);
  } finally {
    isLogging = false;
  }
}

/**
 * Wrap a query builder to log the operation when executed
 */
function wrapQueryBuilder(
  builder: any,
  baseClient: SupabaseClient<Database>,
  tableName: string,
  operationType: string
): any {
  const source = extractSourceFromStack();
  const startTime = performance.now();

  // Store the original then method
  const originalThen = builder.then?.bind(builder);

  if (originalThen) {
    // Override the then method to intercept when the promise resolves
    builder.then = function (onFulfilled?: any, onRejected?: any) {
      return originalThen(
        (result: any) => {
          const duration = performance.now() - startTime;
          const dataSize = estimateDataSize(result.data);

          // Log the successful operation using the BASE client (not wrapped)
          logOperation(
            baseClient,
            operationType,
            tableName,
            source,
            sanitizeQueryDetails({ method: operationType }),
            dataSize,
            duration,
            result.error ? formatError(result.error) : null
          );

          return onFulfilled ? onFulfilled(result) : result;
        },
        (error: any) => {
          const duration = performance.now() - startTime;

          // Log the failed operation using the BASE client (not wrapped)
          logOperation(
            baseClient,
            operationType,
            tableName,
            source,
            sanitizeQueryDetails({ method: operationType }),
            0,
            duration,
            formatError(error)
          );

          return onRejected ? onRejected(error) : Promise.reject(error);
        }
      );
    };
  }

  return builder;
}

/**
 * Create a logged version of the Supabase client
 * This wrapper intercepts all database operations and logs them to dev_io_log
 */
export function createLoggedSupabaseClient(
  client: SupabaseClient<Database>
): SupabaseClient<Database> {
  // Only enable logging in development or test environments
  const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');
  const isDev = typeof import.meta.env !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'test');
  const forceLogging = typeof import.meta.env !== 'undefined' && import.meta.env.VITE_ENABLE_DB_LOGGING === 'true';
  const isDevOrTest = isDev || isTest || forceLogging;

  if (!isDevOrTest) {
    return client;
  }

  // Store original methods
  const originalFrom = client.from.bind(client);
  const originalRpc = client.rpc.bind(client);

  // Create a proxy to intercept method calls
  const proxiedClient = new Proxy(client, {
    get(target, prop, receiver) {
      // Intercept .from() calls
      if (prop === 'from') {
        return (table: string) => {
          const queryBuilder = originalFrom(table);

          // Wrap common query methods
          const originalSelect = queryBuilder.select?.bind(queryBuilder);
          const originalInsert = queryBuilder.insert?.bind(queryBuilder);
          const originalUpdate = queryBuilder.update?.bind(queryBuilder);
          const originalDelete = queryBuilder.delete?.bind(queryBuilder);
          const originalUpsert = queryBuilder.upsert?.bind(queryBuilder);

          if (originalSelect) {
            queryBuilder.select = function (...args: any[]) {
              const builder = originalSelect(...args);
              return wrapQueryBuilder(builder, target, table, 'SELECT');
            };
          }

          if (originalInsert) {
            queryBuilder.insert = function (...args: any[]) {
              const builder = originalInsert(...args);
              return wrapQueryBuilder(builder, target, table, 'INSERT');
            };
          }

          if (originalUpdate) {
            queryBuilder.update = function (...args: any[]) {
              const builder = originalUpdate(...args);
              return wrapQueryBuilder(builder, target, table, 'UPDATE');
            };
          }

          if (originalDelete) {
            queryBuilder.delete = function (...args: any[]) {
              const builder = originalDelete(...args);
              return wrapQueryBuilder(builder, target, table, 'DELETE');
            };
          }

          if (originalUpsert) {
            queryBuilder.upsert = function (...args: any[]) {
              const builder = originalUpsert(...args);
              return wrapQueryBuilder(builder, target, table, 'UPSERT');
            };
          }

          return queryBuilder;
        };
      }

      // Intercept .rpc() calls
      if (prop === 'rpc') {
        return async (fn: string, params?: any) => {
          const source = extractSourceFromStack();
          const startTime = performance.now();

          try {
            const result = await originalRpc(fn, params);
            const duration = performance.now() - startTime;
            const dataSize = estimateDataSize(result.data);

            // Use the base client (target) for logging, not the proxied version
            logOperation(
              target,
              'RPC',
              null,
              source,
              sanitizeQueryDetails({ function: fn }),
              dataSize,
              duration,
              result.error ? formatError(result.error) : null
            );

            return result;
          } catch (error) {
            const duration = performance.now() - startTime;

            // Use the base client (target) for logging, not the proxied version
            logOperation(
              target,
              'RPC',
              null,
              source,
              sanitizeQueryDetails({ function: fn }),
              0,
              duration,
              formatError(error)
            );

            throw error;
          }
        };
      }

      // For all other properties, return the original value
      return Reflect.get(target, prop, receiver);
    },
  });

  return proxiedClient as SupabaseClient<Database>;
}
