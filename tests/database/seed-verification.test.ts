import { describe, test, expect, beforeAll } from 'vitest';
import { createServiceRoleClient } from '../utils/supabase-test-client';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Database Seeding Verification', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createServiceRoleClient();
  });

  describe('Icon Categories', () => {
    test('At least 12 icon categories exist after seeding', async () => {
      const { data, error } = await supabase
        .from('icon_categories')
        .select('id, name');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(12);

      // Verify required categories from milestone exist
      const categoryIds = data?.map((c) => c.id) || [];
      expect(categoryIds).toContain('bioicons-chemistry');
      expect(categoryIds).toContain('bioicons-biology');
      expect(categoryIds).toContain('bioicons-physics');
      expect(categoryIds).toContain('bioicons-medical');
      expect(categoryIds).toContain('cells');
      expect(categoryIds).toContain('molecules');
      expect(categoryIds).toContain('lab');
      expect(categoryIds).toContain('anatomy');
      expect(categoryIds).toContain('plants');
      expect(categoryIds).toContain('animals');
      expect(categoryIds).toContain('symbols');
      expect(categoryIds).toContain('other');
    });

    test('Each seeded icon category has at least one sample icon', async () => {
      // Only check the 12 categories that are explicitly seeded
      const seededCategories = [
        'bioicons-chemistry',
        'bioicons-biology',
        'bioicons-physics',
        'bioicons-medical',
        'cells',
        'molecules',
        'lab',
        'anatomy',
        'plants',
        'animals',
        'symbols',
        'other',
      ];

      for (const categoryId of seededCategories) {
        const { data: icons, error: iconError } = await supabase
          .from('icons')
          .select('id')
          .eq('category', categoryId)
          .limit(1);

        expect(iconError).toBeNull();
        expect(icons).toBeDefined();
        expect(icons?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Blog Data', () => {
    test('Blog categories exist', async () => {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('id, name, slug');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(3);

      // Verify expected categories
      const slugs = data?.map((c) => c.slug) || [];
      expect(slugs).toContain('tutorials');
      expect(slugs).toContain('research-tips');
      expect(slugs).toContain('updates');
    });

    test('Blog tags exist', async () => {
      const { data, error } = await supabase
        .from('blog_tags')
        .select('id, name, slug');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(5);

      // Verify some expected tags
      const slugs = data?.map((t) => t.slug) || [];
      expect(slugs).toContain('figure-design');
      expect(slugs).toContain('workflow-tips');
    });
  });

  describe('Site Settings', () => {
    test('Site settings exist with correct keys', async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_key, setting_value');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(3);

      const settingKeys = data?.map((s) => s.setting_key) || [];
      expect(settingKeys).toContain('rate_limits');
      expect(settingKeys).toContain('feature_flags');
      expect(settingKeys).toContain('email_settings');

      // Verify rate_limits structure
      const rateLimits = data?.find((s) => s.setting_key === 'rate_limits');
      expect(rateLimits?.setting_value).toHaveProperty('ai_icon_generation_monthly_limit');
      expect(rateLimits?.setting_value).toHaveProperty('download_quota_default');

      // Verify feature_flags structure
      const featureFlags = data?.find((s) => s.setting_key === 'feature_flags');
      expect(featureFlags?.setting_value).toHaveProperty('enable_blog');
      expect(featureFlags?.setting_value).toHaveProperty('enable_community_showcase');
    });
  });

  describe('Testimonials', () => {
    test('Testimonials are seeded', async () => {
      const { data, error } = await supabase
        .from('testimonials')
        .select('id, name, is_approved');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(5);

      // All seeded testimonials should be approved
      const allApproved = data?.every((t) => t.is_approved === true);
      expect(allApproved).toBe(true);
    });
  });

  describe('Admin Role', () => {
    test('Admin role can be assigned if user exists', async () => {
      // Check if admin email user exists
      const adminEmail = 'quarde@yahoo.com';
      const { data: users } = await supabase.auth.admin.listUsers();

      const adminUser = users?.users.find((u) => u.email === adminEmail);

      if (adminUser) {
        // If admin user exists, verify they have admin role
        const { data: roles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', adminUser.id)
          .eq('role', 'admin');

        expect(error).toBeNull();
        expect(roles).toBeDefined();
        expect(roles?.length).toBe(1);
      } else {
        // If admin user doesn't exist yet, that's expected
        console.log(`Admin user ${adminEmail} not found - this is expected if they haven't signed up yet`);
        expect(true).toBe(true);
      }
    });
  });

  describe('Sample Icons', () => {
    test('At least 20 sample icons are seeded across categories', async () => {
      const { data, error } = await supabase
        .from('icons')
        .select('id, name, category');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(20);

      // Verify icons are distributed across multiple categories
      const uniqueCategories = new Set(data?.map((i) => i.category));
      expect(uniqueCategories.size).toBeGreaterThanOrEqual(10);
    });
  });
});
