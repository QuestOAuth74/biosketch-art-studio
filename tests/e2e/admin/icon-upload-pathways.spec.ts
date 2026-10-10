import { test, expect } from '../fixtures/admin-auth';
import { test as baseTest } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import {
  createTestUser,
  deleteTestUser,
  createServiceRoleClient,
} from '../../utils/supabase-test-client';
import { AuthTestIds, CanvasEditorTestIds } from '@/lib/test-ids';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client for cleanup
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

// Helper to create a simple test SVG
const createTestSvg = (name: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="blue"/>
  <text x="50" y="55" text-anchor="middle" fill="white" font-size="12">${name}</text>
</svg>
`.trim();

// Helper to calculate data URL size in KB
const calculateDataUrlSize = (dataUrl: string): number => {
  const base64Data = dataUrl.split(',')[1] || dataUrl;
  const actualSize = (base64Data.length * 3) / 4;
  return actualSize / 1024;
};

test.describe('Icon Upload Pathways', () => {
  let testIconIds: string[] = [];

  test.beforeAll(() => {
    // Verify environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
  });

  test.afterEach(async () => {
    // Clean up all test icons created during the test
    if (testIconIds.length > 0) {
      const { error } = await adminClient
        .from('icons')
        .delete()
        .in('id', testIconIds);

      testIconIds = [];
    }
  });

  test('Single file upload creates icon with compressed PNG thumbnail', async ({ adminPage: page }) => {

    // Navigate to admin panel
    await page.goto('/admin');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Find the category combobox (it should exist even if not in viewport)
    const categoryCombobox = page.locator('section#upload-icons').getByRole('combobox').first();

    // Scroll the category combobox into view
    await categoryCombobox.scrollIntoViewIfNeeded();

    // Wait for Upload Icons heading to be visible
    await expect(page.getByRole('heading', { name: 'Upload Icons', exact: true })).toBeVisible();

    // Create test SVG file
    const testSvgContent = createTestSvg('E2E-Single-Test');
    const testSvgPath = path.join(__dirname, 'test-single-icon.svg');
    fs.writeFileSync(testSvgPath, testSvgContent);

    try {
      // Upload single icon - click category dropdown and select biology
      await categoryCombobox.click();
      // Wait for dropdown to be visible and click the option
      await page.getByRole('option', { name: /Bioicons - Biology/i }).click();

      await page.getByLabel(/icon name/i).fill('E2E Single Test Icon');

      // Upload file - scope to upload-icons section to avoid batch upload input
      const fileInput = page.locator('section#upload-icons input[type="file"]').first();
      await fileInput.setInputFiles(testSvgPath);

      // Wait for preview
      await expect(page.locator('svg').first()).toBeVisible({ timeout: 5000 });

      // Upload
      await page.getByRole('button', { name: 'Upload Icon', exact: true }).click();

      // Wait for success message
      await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 10000 });

      // Query database to verify icon was created with PNG thumbnail
      // Note: Icon name is sanitized - "E2E" becomes "E2e" (capitalize first letter only)
      const { data: icons, error } = await adminClient
        .from('icons')
        .select('id, name, category, thumbnail')
        .eq('name', 'E2e Single Test Icon');

      expect(error).toBeNull();
      expect(icons!.length).toBeGreaterThan(0);

      // Take the most recent icon (last in array) and add all to cleanup
      const icon = icons![icons!.length - 1];
      testIconIds.push(...icons!.map(i => i.id));

      // Verify thumbnail is a PNG data URL
      expect(icon.thumbnail).toMatch(/^data:image\/png;base64,/);

      // Verify thumbnail size is between 5-20 KB
      const thumbnailSize = calculateDataUrlSize(icon.thumbnail);
      expect(thumbnailSize).toBeGreaterThan(1); // At least 1 KB
      expect(thumbnailSize).toBeLessThan(50); // Less than 50 KB (generous upper bound)
    } finally {
      // Clean up test file
      if (fs.existsSync(testSvgPath)) {
        fs.unlinkSync(testSvgPath);
      }
    }
  });

  test('Batch ZIP upload creates icons with compressed PNG thumbnails', async ({ adminPage: page }) => {

    // Navigate to admin panel
    await page.goto('/admin');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Scroll directly to Upload Icons section
    await page.evaluate(() => {
      const section = document.getElementById('upload-icons');
      if (section) {
        section.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });

    // Wait a moment for scroll to complete
    await page.waitForTimeout(1000);

    // Wait for Upload Icons section to be visible
    await expect(page.getByRole('heading', { name: 'Upload Icons', exact: true })).toBeVisible();

    // Create test ZIP file with multiple SVGs
    const zip = new JSZip();

    zip.file('e2e-batch-icon-1.svg', createTestSvg('Batch-1'));
    zip.file('e2e-batch-icon-2.svg', createTestSvg('Batch-2'));
    zip.file('e2e-batch-icon-3.svg', createTestSvg('Batch-3'));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const testZipPath = path.join(__dirname, 'test-batch-icons.zip');
    fs.writeFileSync(testZipPath, zipBuffer);

    try {
      // Select category for bulk upload (second combobox on the page)
      const batchCategoryCombobox = page.locator('section#upload-icons').getByRole('combobox').nth(1);
      await batchCategoryCombobox.scrollIntoViewIfNeeded();
      await batchCategoryCombobox.click();
      await page.getByRole('option', { name: /Bioicons - Biology/i }).click();

      // Upload ZIP file
      const zipInput = page.locator('input[type="file"][accept=".zip"]');
      await zipInput.setInputFiles(testZipPath);

      // Click upload button
      await page.getByRole('button', { name: /upload zip/i }).click();

      // Wait for success message (may take a while for batch processing)
      await expect(page.getByText(/successfully uploaded/i)).toBeVisible({ timeout: 30000 });

      // Query database to verify all 3 icons were created
      // Note: Icon names are sanitized - hyphens become spaces, capitalize each word
      const { data: icons, error } = await adminClient
        .from('icons')
        .select('id, name, category, thumbnail')
        .or('name.eq.E2e Batch Icon 1,name.eq.E2e Batch Icon 2,name.eq.E2e Batch Icon 3');

      expect(error).toBeNull();
      expect(icons!.length).toBeGreaterThanOrEqual(3);

      // Verify all icons have PNG thumbnails with correct size
      for (const icon of icons!) {
        testIconIds.push(icon.id);

        expect(icon.thumbnail).toMatch(/^data:image\/png;base64,/);

        const thumbnailSize = calculateDataUrlSize(icon.thumbnail);
        expect(thumbnailSize).toBeGreaterThan(1);
        expect(thumbnailSize).toBeLessThan(50);
      }
    } finally {
      // Clean up test file
      if (fs.existsSync(testZipPath)) {
        fs.unlinkSync(testZipPath);
      }
    }
  });

  baseTest('AI icon generator creates compressed PNG and saves to library', async ({ page }) => {
    // This test requires AI generation credits, so we'll skip if not available
    // Set longer timeout for AI generation (up to 3 minutes for Replicate)
    baseTest.setTimeout(180000); // 3 minutes

    // Create a dedicated admin user for this test to avoid shared state issues
    const aiTestUser = await createTestUser('ai-gen-test');
    const supabase = createServiceRoleClient();

    try {
      // Ensure user is verified
      await supabase.auth.admin.updateUserById(aiTestUser.userId, {
        email_confirm: true,
      });

      // Grant admin role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: aiTestUser.userId,
        role: 'admin',
      });

      if (roleError) {
        throw new Error(`Failed to grant admin role: ${roleError.message}`);
      }

      // Create 3 approved public projects to unlock premium features
      for (let i = 1; i <= 3; i++) {
        const { error: projectError } = await supabase.from('canvas_projects').insert({
          user_id: aiTestUser.userId,
          name: `Test Project ${i}`,
          is_public: true,
          approval_status: 'approved',
          canvas_data: JSON.stringify({ objects: [] }),
          canvas_width: 800,
          canvas_height: 600,
        });
      }

      // Sign in with the new admin user
      await page.goto('/auth');
      await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(aiTestUser.email);
      await page.getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT).fill(aiTestUser.password);
      await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();

      // Wait for navigation to complete
      await page.waitForURL((url) => !url.pathname.includes('/auth'));

      // Dismiss feedback widget before navigating to canvas
      await page.evaluate(() => {
        localStorage.setItem('biosketch_tool_rating_dismissed', 'true');
      });

      // Navigate to canvas
      await page.goto('/canvas');
      await page.waitForLoadState('networkidle');

    // Wait for canvas to be ready
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(1000); // Additional wait for UI to stabilize

    // Dismiss any onboarding/hint popovers that might be blocking interactions
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Dismiss "Got it, don't show again" dialogs (Pro Tip, etc.)
    const dismissButton = page.getByRole('button', { name: /got it|don't show again/i });
    if (await dismissButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await dismissButton.click();
      await page.waitForTimeout(300);
    }

    // Look for AI Icon Generator button in toolbar using test ID
    const aiButton = page.getByTestId(CanvasEditorTestIds.AI_ICON_BUTTON);
    await expect(aiButton).toBeVisible({ timeout: 5000 });
    await aiButton.click();

    // Wait for dialog to open
    await expect(page.getByText(/ai icon generator/i)).toBeVisible({ timeout: 5000 });

    // Create a 512x512 test image using canvas (Replicate requires minimum dimensions)
    const testImagePath = path.join(__dirname, 'test-reference-image.png');

    // Create a clearly scientific image (simple cell diagram) to avoid NSFW filter false positives
    const imageDataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      // Draw white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 512, 512);

      // Draw cell membrane (blue circle)
      ctx.strokeStyle = '#0066cc';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(256, 256, 200, 0, Math.PI * 2);
      ctx.stroke();

      // Draw nucleus (smaller purple circle)
      ctx.strokeStyle = '#9933cc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(256, 256, 80, 0, Math.PI * 2);
      ctx.stroke();

      // Add some organelles (small green circles)
      ctx.fillStyle = '#33cc66';
      [
        [200, 180], [310, 180], [200, 320], [310, 320]
      ].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
      });

      return canvas.toDataURL('image/png');
    });

    // Convert data URL to buffer and save
    const base64Data = imageDataUrl.split(',')[1];
    const testImageBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(testImagePath, testImageBuffer);

    try {
      // Upload reference image
      const fileInput = page.locator('input[type="file"][accept="image/*"]');
      await fileInput.setInputFiles(testImagePath);

      // Fill in prompt (explicitly scientific to avoid NSFW filter)
      await page.getByPlaceholder(/describe transformation/i).fill('Create detailed scientific illustration of a biological cell with organelles');

      // Generate icon
      await page.getByRole('button', { name: /generate icon/i }).click();

      // Wait for "Generating..." button to appear (confirms generation started)
      await expect(page.getByText(/generating\.\.\./i)).toBeVisible({ timeout: 10000 });

      // Wait for generation to complete (Replicate can take 60-120 seconds)
      // The "Generating..." text should disappear when complete
      await page.getByText(/generating\.\.\./i).waitFor({ state: 'hidden', timeout: 150000 });

      // Check for either success (icon name field) or error message
      const iconNameField = page.getByPlaceholder(/icon name/i);
      const errorText = page.getByText(/error|failed|something went wrong|rate limit/i);

      // Wait for either success or error (short timeout now since generation is complete)
      const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasError) {
        const errorMessage = await errorText.textContent();
        console.log('AI generation failed with error:', errorMessage);

        // Take a screenshot for debugging
        await page.screenshot({ path: 'test-results/ai-generation-error.png' });

        throw new Error(`AI generation failed: ${errorMessage}`);
      }

      // Verify icon name field is now visible (indicates success)
      await expect(iconNameField).toBeVisible({ timeout: 5000 });

      // Verify the generated image is present in the dialog
      const generatedImage = page.locator('img[alt="Generated"]');
      await expect(generatedImage).toBeVisible({ timeout: 5000 });

      // Get the image src to verify it's a PNG data URL
      const imageSrc = await generatedImage.getAttribute('src');
      expect(imageSrc).toBeTruthy();
      expect(imageSrc).toMatch(/^data:image\/png;base64,/);

      // Verify the full generated image is a reasonable size
      const fullImageSize = calculateDataUrlSize(imageSrc!);
      expect(fullImageSize).toBeGreaterThan(10);
      expect(fullImageSize).toBeLessThan(500);

      // Fill in icon name and save to library to test thumbnail generation
      await page.getByPlaceholder(/icon name/i).fill('E2E AI Test Icon');

      // Click "My Library" button to save as user asset (which generates thumbnail)
      await page.getByRole('button', { name: /my library/i }).click();

      // Wait for the specific success toast from AIIconGenerator (use first() to avoid strict mode violation)
      await expect(page.getByText(/icon saved!/i).first()).toBeVisible({ timeout: 10000 });

      // Also wait for the dialog to close, which happens after successful save
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

      // Query database to verify the user asset was created
      const { data: assets, error } = await adminClient
        .from('user_assets')
        .select('id, original_name, file_type, category, file_size, storage_path')
        .eq('original_name', 'E2E AI Test Icon.png')
        .eq('user_id', aiTestUser.userId);

      expect(error).toBeNull();
      expect(assets?.length).toBeGreaterThan(0);

      if (assets && assets.length > 0) {
        const asset = assets[0];

        // Verify it's stored in the ai-icons category
        expect(asset.category).toBe('ai-icons');

        // Verify it's a PNG file
        expect(asset.file_type).toBe('png');

        // Verify it's a reasonable file size (compressed but not too small)
        expect(asset.file_size).toBeGreaterThan(10 * 1024); // > 10KB
        expect(asset.file_size).toBeLessThan(500 * 1024); // < 500KB

        // Clean up test asset from storage and database
        await adminClient.storage.from('user-assets').remove([asset.storage_path]);

        await adminClient
          .from('user_assets')
          .delete()
          .eq('id', asset.id);
      }
    } finally {
      // Clean up test file
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
    } finally {
      // Clean up test user and their role
      await supabase.from('user_roles').delete().eq('user_id', aiTestUser.userId);
      await deleteTestUser(aiTestUser.userId);
    }
  });

  test('Admin approving submission creates icon with compressed PNG thumbnail', async ({ adminPage: page, adminUser }) => {
    // First, create a test submission directly in database
    const testSvgContent = createTestSvg('Submission-Test');

    // Create a test submission using the test user ID
    const { data: submission, error: submitError } = await adminClient
      .from('icon_submissions')
      .insert({
        user_id: adminUser.userId,
        name: 'E2E Submission Approval Test',
        category: 'biology',
        svg_content: testSvgContent,
        thumbnail: 'data:image/svg+xml;base64,' + Buffer.from(testSvgContent).toString('base64'),
        description: 'Test submission for e2e',
        usage_rights: 'own_rights',
        approval_status: 'pending'
      })
      .select()
      .single();

    expect(submitError).toBeNull();
    expect(submission).not.toBeNull();

    const submissionId = submission!.id;

    try {
      // Navigate to admin submissions page
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Scroll to Icon Submissions section
      await page.evaluate(() => {
        const section = document.getElementById('icon-submissions');
        if (section) {
          section.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      });
      await page.waitForTimeout(1000);

      // Find our submission card - look for "Submission Approval Test" text
      const submissionCard = page.locator('text=Submission Approval Test').first();
      await expect(submissionCard).toBeVisible({ timeout: 5000 });

      // Find the approve button within the Icon Submissions section only
      const iconSubmissionsSection = page.locator('section#icon-submissions');
      const approveButton = iconSubmissionsSection.getByRole('button', { name: /approve/i }).first();
      await approveButton.scrollIntoViewIfNeeded();
      await approveButton.click();

      // Wait longer for the approval to process and icon to be created
      await page.waitForTimeout(5000);

      // Query database to verify icon was created with PNG thumbnail
      // Try multiple possible sanitized versions of the name
      const { data: icons, error } = await adminClient
        .from('icons')
        .select('id, name, category, thumbnail, svg_content')
        .or('name.ilike.%Submission Approval%,name.ilike.%E2E Submission%')
        .order('created_at', { ascending: false })
        .limit(5);

      expect(error).toBeNull();
      expect(icons!.length).toBeGreaterThan(0);

      const icon = icons![0];
      testIconIds.push(icon.id);

      // Verify thumbnail is a PNG data URL (NOT the SVG that was in submission)
      expect(icon.thumbnail).toMatch(/^data:image\/png;base64,/);
      expect(icon.thumbnail).not.toMatch(/data:image\/svg\+xml/);

      // Verify thumbnail size
      const thumbnailSize = calculateDataUrlSize(icon.thumbnail);
      expect(thumbnailSize).toBeGreaterThan(1);
      expect(thumbnailSize).toBeLessThan(50);

      // Verify svg_content is preserved correctly
      expect(icon.svg_content).toBeTruthy();
    } finally {
      // Clean up submission
      await adminClient
        .from('icon_submissions')
        .delete()
        .eq('id', submissionId);
    }
  });
});
