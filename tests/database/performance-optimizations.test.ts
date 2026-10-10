import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createServiceRoleClient, createTestUser, deleteTestUser } from '../utils/supabase-test-client';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Performance Optimization RPC Functions', () => {
  let serviceClient: SupabaseClient;
  let testUser: { email: string; password: string; userId: string };

  beforeAll(async () => {
    serviceClient = createServiceRoleClient();
    testUser = await createTestUser('rpc-test-user');

    // Seed test data
    await seedTestData(serviceClient, testUser.userId);
  });

  afterAll(async () => {
    await cleanupTestData(serviceClient);
    await deleteTestUser(testUser.userId);
  });

  describe('get_admin_notification_counts()', () => {
    test('returns all required count fields', async () => {
      const { data, error } = await serviceClient
        .rpc('get_admin_notification_counts')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('pending_projects');
      expect(data).toHaveProperty('pending_testimonials');
      expect(data).toHaveProperty('pending_icons');
      expect(data).toHaveProperty('unread_messages');
      expect(data).toHaveProperty('unviewed_feedback');
    });

    test('counts match actual database records', async () => {
      // Create 3 pending projects
      const { error: projectError } = await serviceClient.from('canvas_projects').insert([
        { user_id: testUser.userId, name: `count-test-pending-${Date.now()}-1`, title: 'Test 1', approval_status: 'pending', is_public: true, canvas_data: {}, canvas_width: 800, canvas_height: 600 },
        { user_id: testUser.userId, name: `count-test-pending-${Date.now()}-2`, title: 'Test 2', approval_status: 'pending', is_public: true, canvas_data: {}, canvas_width: 800, canvas_height: 600 },
        { user_id: testUser.userId, name: `count-test-pending-${Date.now()}-3`, title: 'Test 3', approval_status: 'pending', is_public: true, canvas_data: {}, canvas_width: 800, canvas_height: 600 }
      ]);
      expect(projectError).toBeNull();

      // Create 2 unread messages
      const { error: messageError } = await serviceClient.from('contact_messages').insert([
        { email: `counttest1-${Date.now()}@example.com`, full_name: 'Test 1', country: 'Test', message: 'Test msg 1', is_read: false },
        { email: `counttest2-${Date.now()}@example.com`, full_name: 'Test 2', country: 'Test', message: 'Test msg 2', is_read: false }
      ]);
      expect(messageError).toBeNull();

      const { data } = await serviceClient
        .rpc('get_admin_notification_counts')
        .single();

      expect(data).toBeDefined();
      expect(data.pending_projects).toBeGreaterThanOrEqual(3);
      expect(data.unread_messages).toBeGreaterThanOrEqual(2);

      // Cleanup
      await serviceClient.from('canvas_projects').delete().ilike('name', 'count-test-pending-%');
      await serviceClient.from('contact_messages').delete().ilike('email', 'counttest%@example.com');
    });

    test('returns zero counts when no pending items', async () => {
      // Clean all pending items
      await cleanupAllPendingItems(serviceClient);

      const { data } = await serviceClient
        .rpc('get_admin_notification_counts')
        .single();

      expect(data).toBeDefined();
      expect(data.pending_projects).toBe(0);
      expect(data.pending_testimonials).toBe(0);
      expect(data.pending_icons).toBe(0);
      expect(data.unread_messages).toBe(0);
      expect(data.unviewed_feedback).toBe(0);
    });

    test('executes in under 400ms', async () => {
      const start = Date.now();
      await serviceClient.rpc('get_admin_notification_counts').single();
      const duration = Date.now() - start;

      // Should be fast due to partial indexes and batched query
      expect(duration).toBeLessThan(400);
    });
  });

  describe('get_user_analytics()', () => {
    test('returns correct structure with all fields', async () => {
      const { data, error } = await serviceClient.rpc('get_user_analytics', {
        limit_count: 20,
        offset_count: 0
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      if (data && data.length > 0) {
        const firstUser = data[0];
        expect(firstUser).toHaveProperty('id');
        expect(firstUser).toHaveProperty('email');
        expect(firstUser).toHaveProperty('full_name');
        expect(firstUser).toHaveProperty('project_count');
        expect(firstUser).toHaveProperty('total_count');
      }
    });

    test('aggregates project counts correctly', async () => {
      // Create 5 projects for test user
      const { error } = await serviceClient.from('canvas_projects').insert([
        { user_id: testUser.userId, name: `analytics-test-project-${Date.now()}-1`, title: 'Test 1', approval_status: 'approved', is_public: true, canvas_data: {}, canvas_width: 800, canvas_height: 600 },
        { user_id: testUser.userId, name: `analytics-test-project-${Date.now()}-2`, title: 'Test 2', approval_status: 'approved', is_public: true, canvas_data: {}, canvas_width: 800, canvas_height: 600 },
        { user_id: testUser.userId, name: `analytics-test-project-${Date.now()}-3`, title: 'Test 3', approval_status: 'approved', is_public: true, canvas_data: {}, canvas_width: 800, canvas_height: 600 },
        { user_id: testUser.userId, name: `analytics-test-project-${Date.now()}-4`, title: 'Test 4', approval_status: 'approved', is_public: true, canvas_data: {}, canvas_width: 800, canvas_height: 600 },
        { user_id: testUser.userId, name: `analytics-test-project-${Date.now()}-5`, title: 'Test 5', approval_status: 'approved', is_public: true, canvas_data: {}, canvas_width: 800, canvas_height: 600 }
      ]);
      expect(error).toBeNull();

      const { data } = await serviceClient.rpc('get_user_analytics', {
        limit_count: 100,
        offset_count: 0
      });

      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      const userData = data?.find((u: any) => u.id === testUser.userId);
      expect(userData).toBeDefined();
      expect(userData.project_count).toBeGreaterThanOrEqual(5);

      // Cleanup
      await serviceClient.from('canvas_projects').delete().ilike('name', 'analytics-test-project-%');
    });

    test('respects pagination limits', async () => {
      const { data } = await serviceClient.rpc('get_user_analytics', {
        limit_count: 5,
        offset_count: 0
      });

      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(5);
    });

    test('pagination offset works correctly', async () => {
      const { data: page1 } = await serviceClient.rpc('get_user_analytics', {
        limit_count: 5,
        offset_count: 0
      });

      const { data: page2 } = await serviceClient.rpc('get_user_analytics', {
        limit_count: 5,
        offset_count: 5
      });

      expect(page1).toBeDefined();
      expect(page2).toBeDefined();
      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);

      // Pages should have different users (if there are enough users)
      if (page1.length > 0 && page2.length > 0) {
        const page1Ids = page1.map((u: any) => u.id);
        const page2Ids = page2.map((u: any) => u.id);
        const overlap = page1Ids.filter(id => page2Ids.includes(id));

        expect(overlap.length).toBe(0);
      }
    });
  });
});

// Helper functions
async function seedTestData(client: SupabaseClient, userId: string) {
  await createPendingProjects(client, userId, 2);
  await createUnreadMessages(client, 2);
  await createProjects(client, userId, 3);
}

async function createPendingProjects(client: SupabaseClient, userId: string, count: number) {
  const projects = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    name: `test-pending-${Date.now()}-${i}`,
    title: `Test Pending ${i}`,
    approval_status: 'pending',
    is_public: true,
    canvas_data: {},
    canvas_width: 800,
    canvas_height: 600
  }));

  const { error } = await client.from('canvas_projects').insert(projects);
  if (error) {
    console.error('Error creating pending projects:', error);
  }
}

async function createUnreadMessages(client: SupabaseClient, count: number) {
  const messages = Array.from({ length: count }, (_, i) => ({
    email: `test${Date.now()}${i}@example.com`,
    full_name: `Test User ${i}`,
    country: 'Test',
    message: `Test message ${i}`,
    is_read: false
  }));

  const { error } = await client.from('contact_messages').insert(messages);
  if (error) {
    console.error('Error creating unread messages:', error);
  }
}

async function createProjects(client: SupabaseClient, userId: string, count: number) {
  const projects = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    name: `test-project-${Date.now()}-${i}`,
    title: `Test Project ${i}`,
    approval_status: 'approved',
    is_public: true,
    canvas_data: {},
    canvas_width: 800,
    canvas_height: 600
  }));

  const { error } = await client.from('canvas_projects').insert(projects);
  if (error) {
    console.error('Error creating projects:', error);
  }
}

async function cleanupTestData(client: SupabaseClient) {
  await client.from('canvas_projects').delete().ilike('name', 'test-pending-%');
  await client.from('canvas_projects').delete().ilike('name', 'test-project-%');
  await client.from('contact_messages').delete().ilike('email', 'test%@example.com');
}

async function cleanupAllPendingItems(client: SupabaseClient) {
  await client.from('canvas_projects').delete().eq('approval_status', 'pending');
  await client.from('contact_messages').delete().eq('is_read', false);
  await client.from('testimonials').delete().eq('is_approved', false);
  await client.from('icon_submissions').delete().eq('approval_status', 'pending');
  await client.from('tool_feedback').delete().eq('is_viewed', false);
}
