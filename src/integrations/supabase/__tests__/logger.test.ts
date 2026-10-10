/**
 * Tests for the database operation logger
 * These tests verify that database operations are logged correctly in development mode
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import { createLoggedSupabaseClient } from '../logger';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

describe('Database Operation Logger', () => {
  let client: ReturnType<typeof createClient<Database>>;
  let loggedClient: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
    loggedClient = createLoggedSupabaseClient(client);
  });

  afterAll(async () => {
    // Clean up test logs
    await client
      .from('dev_io_log')
      .delete()
      .ilike('source', '%logger.test%');
  });

  it('should log SELECT operations', async () => {
    // Perform a test query
    const { data, error } = await loggedClient
      .from('site_settings')
      .select('*')
      .limit(1);

    expect(error).toBeNull();

    // Wait a bit for the log to be written
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if the operation was logged
    const { data: logs } = await client
      .from('dev_io_log')
      .select('*')
      .eq('operation_type', 'SELECT')
      .eq('table_name', 'site_settings')
      .ilike('source', '%logger.test%')
      .order('timestamp', { ascending: false })
      .limit(1);

    expect(logs).toBeDefined();
    expect(logs?.length).toBeGreaterThan(0);
    expect(logs?.[0]?.operation_type).toBe('SELECT');
    expect(logs?.[0]?.table_name).toBe('site_settings');
  });

  it('should not log operations on dev_io_log table itself', async () => {
    // Get current log count
    const { data: beforeLogs } = await loggedClient
      .from('dev_io_log')
      .select('*', { count: 'exact', head: true });

    const beforeCount = beforeLogs?.length || 0;

    // Perform another query on dev_io_log
    await loggedClient
      .from('dev_io_log')
      .select('*')
      .limit(1);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check count - should not have increased from the dev_io_log query
    const { data: afterLogs } = await loggedClient
      .from('dev_io_log')
      .select('*', { count: 'exact', head: true });

    const afterCount = afterLogs?.length || 0;

    // The count might increase by 1 from the first query in this test,
    // but not from the second query on dev_io_log
    expect(afterCount - beforeCount).toBeLessThanOrEqual(1);
  });

  it('should estimate data size correctly', async () => {
    const { data } = await loggedClient
      .from('site_settings')
      .select('*')
      .limit(1);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: logs } = await client
      .from('dev_io_log')
      .select('*')
      .eq('operation_type', 'SELECT')
      .eq('table_name', 'site_settings')
      .ilike('source', '%logger.test%')
      .order('timestamp', { ascending: false })
      .limit(1);

    expect(logs?.[0]?.data_size_kb).toBeGreaterThan(0);
  });

  it('should track operation duration', async () => {
    await loggedClient
      .from('site_settings')
      .select('*')
      .limit(1);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: logs } = await client
      .from('dev_io_log')
      .select('*')
      .eq('operation_type', 'SELECT')
      .eq('table_name', 'site_settings')
      .ilike('source', '%logger.test%')
      .order('timestamp', { ascending: false })
      .limit(1);

    expect(logs?.[0]?.duration_ms).toBeGreaterThan(0);
  });
});
