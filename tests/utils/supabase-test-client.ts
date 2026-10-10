import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase URL and keys from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const testEmailDomain = process.env.TEST_USER_EMAIL_DOMAIN || 'gazzola.dev';

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required for tests');
}

/**
 * Create a Supabase client with service role key (bypasses RLS)
 * Use this for tests that need to verify data exists regardless of RLS
 */
export function createServiceRoleClient(): SupabaseClient {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service role tests');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with anon key (subject to RLS)
 * Use this for tests that verify unauthenticated user access
 */
export function createAnonClient(): SupabaseClient {
  if (!anonKey) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required for anon tests');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client and sign in as a test user
 * Use this for tests that verify authenticated user access
 */
export async function createAuthenticatedClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  if (!anonKey) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required for authenticated tests');
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return client;
}

/**
 * Create a test user account
 * Returns the user email and password for subsequent authentication
 */
export async function createTestUser(
  emailPrefix: string = 'test',
  emailConfirmed: boolean = true
): Promise<{ email: string; password: string; userId: string }> {
  const serviceClient = createServiceRoleClient();
  const timestamp = Date.now();
  const email = `${emailPrefix}-${timestamp}@${testEmailDomain}`;
  const password = `TestPassword123!${timestamp}`;

  const { data, error} = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: emailConfirmed,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message}`);
  }

  return {
    email,
    password,
    userId: data.user.id,
  };
}

/**
 * Comprehensive cleanup of all user-related data before deleting the user
 * Handles tables with ON DELETE SET NULL and tables without proper foreign keys
 */
export async function cleanupUserData(userId: string): Promise<void> {
  const serviceClient = createServiceRoleClient();
  const errors: string[] = [];

  // Manual cleanup for tables with ON DELETE SET NULL or no cascade
  const cleanupOperations = [
    // Tables with ON DELETE SET NULL that should be deleted
    { table: 'tool_feedback', column: 'user_id' },
    { table: 'testimonials', column: 'user_id' },
    { table: 'contact_messages', column: 'user_id' },

    // Tables with orphaned references (approved_by, updated_by, created_by fields)
    { table: 'icon_submissions', column: 'approved_by' },

    // Tables without proper foreign key constraints
    { table: 'project_versions', column: 'user_id' },

    // Collaboration tables
    { table: 'group_members', column: 'user_id' },
    { table: 'group_invitations', column: 'invited_by' },
    { table: 'project_collaborators', column: 'user_id' },
    { table: 'project_collaborators', column: 'invited_by' },
    { table: 'project_group_access', column: 'granted_by' },
    { table: 'project_page_access', column: 'invited_by' },
    { table: 'project_page_group_access', column: 'granted_by' },
    { table: 'project_pages', column: 'created_by' },
  ];

  // Delete records that reference the user
  for (const { table, column } of cleanupOperations) {
    const { error } = await serviceClient
      .from(table)
      .delete()
      .eq(column, userId);

    if (error) {
      errors.push(`Failed to cleanup ${table}.${column}: ${error.message}`);
    }
  }

  // Set NULL for audit/tracking fields that should be preserved
  const nullifyOperations = [
    { table: 'icons', column: 'uploaded_by' },
    { table: 'site_settings', column: 'updated_by' },
    { table: 'ai_provider_settings', column: 'updated_by' },
    { table: 'powerpoint_custom_templates', column: 'created_by' },
    { table: 'groups', column: 'created_by' },
  ];

  for (const { table, column } of nullifyOperations) {
    const { error } = await serviceClient
      .from(table)
      .update({ [column]: null })
      .eq(column, userId);

    if (error) {
      errors.push(`Failed to nullify ${table}.${column}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`User data cleanup failed:\n${errors.join('\n')}`);
  }
}

/**
 * Delete a test user account
 * Performs comprehensive cleanup of all related data before deletion
 */
export async function deleteTestUser(userId: string): Promise<void> {
  // First, clean up all user-related data
  await cleanupUserData(userId);

  // Then delete the user (this will cascade to properly configured tables)
  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Failed to delete test user ${userId}: ${error.message}`);
  }
}

/**
 * Helper to clean up test data
 * Use with caution - only for test data!
 */
export async function cleanupTestData(tableName: string, condition: Record<string, any>): Promise<void> {
  const serviceClient = createServiceRoleClient();

  const { error } = await serviceClient
    .from(tableName)
    .delete()
    .match(condition);

  if (error) {
    throw new Error(`Failed to cleanup test data from ${tableName}: ${error.message}`);
  }
}
