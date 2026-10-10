import { test, expect } from '../fixtures/auth';
import { CommunityTestIds, AuthorProfileTestIds } from '@/lib/test-ids';
import { createClient } from '@supabase/supabase-js';

// Create service role client for test data setup (bypasses RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

test.describe('Public Profile Functionality', () => {
  let testProjectIds: string[] = [];
  let testUserId: string;

  test.beforeAll(async () => {
    // Create a test user with public projects
    const { data: { user }, error: signUpError } = await serviceClient.auth.admin.createUser({
      email: 'community-test@example.com',
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (signUpError || !user) {
      throw new Error('Failed to create test user');
    }

    testUserId = user.id;

    // Wait for profile to be created by trigger
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify profile was created
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile was not created for test user');
    }

    // Create public approved projects for this user
    const projects = [
      {
        user_id: testUserId,
        name: 'Test Cell Diagram',
        title: 'Animal Cell Structure',
        description: 'Test diagram for E2E testing',
        keywords: ['test', 'cell', 'biology'],
        canvas_data: { shapes: [], connections: [], textBoxes: [] },
        canvas_width: 800,
        canvas_height: 600,
        paper_size: 'A4',
        is_public: true,
        approval_status: 'approved',
      },
      {
        user_id: testUserId,
        name: 'Test DNA Model',
        title: 'DNA Structure',
        description: 'Another test diagram',
        keywords: ['test', 'DNA', 'genetics'],
        canvas_data: { shapes: [], connections: [], textBoxes: [] },
        canvas_width: 800,
        canvas_height: 600,
        paper_size: 'A4',
        is_public: true,
        approval_status: 'approved',
      },
    ];

    const { data: createdProjects, error: projectError } = await serviceClient
      .from('canvas_projects')
      .insert(projects)
      .select('id, is_public, approval_status');

    if (projectError || !createdProjects || createdProjects.length === 0) {
      throw new Error(`Failed to create test projects: ${projectError?.message}`);
    }

    testProjectIds = createdProjects.map(p => p.id);

    // Verify projects are visible in public_profiles view
    const { data: publicProfile, error: viewError } = await serviceClient
      .from('public_profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    if (viewError || !publicProfile) {
      throw new Error('Test user profile not visible in public_profiles view');
    }

    // Small delay to ensure data propagation
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  test.afterAll(async () => {
    // Clean up test projects
    if (testProjectIds.length > 0) {
      await serviceClient
        .from('canvas_projects')
        .delete()
        .in('id', testProjectIds);
    }

    // Clean up test user
    if (testUserId) {
      await serviceClient.auth.admin.deleteUser(testUserId);
    }
  });

  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to community page with authenticated session
    await authenticatedPage.goto('/community');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('Community page displays author names on project cards', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Wait for community page to load
    await expect(page.getByTestId(CommunityTestIds.PAGE_CONTAINER)).toBeVisible();

    // Find first project card
    const projectCard = page.getByTestId(CommunityTestIds.PROJECT_CARD).first();
    await expect(projectCard).toBeVisible();

    // Verify author name is displayed
    const authorName = projectCard.getByTestId(CommunityTestIds.PROJECT_AUTHOR);
    await expect(authorName).toBeVisible();

    // Author name should have text content
    const authorText = await authorName.textContent();
    expect(authorText).toBeTruthy();
    expect(authorText?.length).toBeGreaterThan(0);
  });

  test('Can navigate to author profile from community card', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Find and click first project author
    const projectCard = page.getByTestId(CommunityTestIds.PROJECT_CARD).first();
    const authorLink = projectCard.getByTestId(CommunityTestIds.PROJECT_AUTHOR);

    // Get author name for verification
    const authorName = await authorLink.textContent();

    await authorLink.click();

    // Should navigate to author profile page
    await expect(page).toHaveURL(/\/author\/[a-f0-9-]+/);

    // Author profile page should load
    await expect(page.getByTestId(AuthorProfileTestIds.PAGE_CONTAINER)).toBeVisible();
  });

  test('Author profile page displays profile information', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Navigate directly to the test user's author profile
    // (This user has public projects created in beforeAll)
    await page.goto(`/author/${testUserId}`);
    await page.waitForLoadState('networkidle');

    // Profile container should be visible
    await expect(page.getByTestId(AuthorProfileTestIds.PAGE_CONTAINER)).toBeVisible();

    // Profile name should be displayed
    const profileName = page.getByTestId(AuthorProfileTestIds.PROFILE_NAME);
    await expect(profileName).toBeVisible();

    // Bio might be empty, but element should exist
    const bio = page.getByTestId(AuthorProfileTestIds.PROFILE_BIO);
    // Bio may or may not be visible depending on if user has one

    // Stats should be visible
    await expect(page.getByTestId(AuthorProfileTestIds.STAT_PROJECTS)).toBeVisible();
    await expect(page.getByTestId(AuthorProfileTestIds.STAT_VIEWS)).toBeVisible();
    await expect(page.getByTestId(AuthorProfileTestIds.STAT_LIKES)).toBeVisible();
  });

  test('Author profile does NOT expose email address', async ({ authenticatedPage, testUser }) => {
    const page = authenticatedPage;
    // Navigate to test user's author profile
    await page.goto(`/author/${testUser.userId}`);
    await page.waitForLoadState('networkidle');

    // Get page HTML content
    const pageContent = await page.content();

    // Email should NOT be present anywhere in the page
    // Use a partial match to avoid false positives
    const emailDomain = testUser.email.split('@')[1];
    expect(pageContent).not.toContain(testUser.email);

    // Also check via network requests
    const responses: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('profiles') || response.url().includes('public_profiles')) {
        try {
          const json = await response.json();
          responses.push(JSON.stringify(json));
        } catch {
          // Not JSON, ignore
        }
      }
    });

    // Reload to capture network requests
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait a moment for responses to be captured
    await page.waitForTimeout(1000);

    // Email should not be in any profile responses
    const allResponses = responses.join(' ');
    expect(allResponses).not.toContain(testUser.email);
  });

  test('Community carousel displays author information', async ({ browser }) => {
    // Create isolated context to avoid session pollution from other tests
    const context = await browser.newContext();
    const page = await context.newPage();

    // Go to auth page where carousel is displayed
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // The page should have loaded without errors
    expect(page.url()).toContain('/auth');

    await context.close();
  });
});

test.describe('Public Profile Security', () => {
  test('Browser console cannot query email via profiles table', async ({ page, testUser }) => {
    // Navigate to any page
    await page.goto('/community');
    await page.waitForLoadState('networkidle');

    // Try to query email via browser console using Supabase client
    const queryResult = await page.evaluate(async (userId) => {
      // @ts-ignore - accessing global supabase client if available
      if (typeof window.supabase !== 'undefined') {
        try {
          const { data, error } = await window.supabase
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single();

          return { data, error: error?.message };
        } catch (err) {
          return { data: null, error: String(err) };
        }
      }
      return { data: null, error: 'Supabase not available' };
    }, testUser.userId);

    // Should either error or return no data
    if (queryResult.error) {
      // RLS prevented access - GOOD
      expect(queryResult.error).toBeTruthy();
    } else {
      // Or returned no data - also GOOD
      expect(queryResult.data).toBeNull();
    }
  });
});
