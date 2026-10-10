import { test, expect } from '../fixtures/auth';
import { CanvasEditorPage } from '../utils/page-objects/CanvasEditorPage';
import { createServiceRoleClient } from '../../utils/supabase-test-client';
import { CanvasEditorTestIds, IconLibraryTestIds } from '@/lib/test-ids';

test.describe('Milestone B: UI Redesign - Save Button', () => {
  let canvasPage: CanvasEditorPage;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test('Save button shows correct states during save operation', async ({ authenticatedPage: page, testUser }) => {
    const saveButton = page.getByTestId(CanvasEditorTestIds.SAVE_BUTTON);

    // For new empty projects, there's no initial auto-save
    // Create a canvas change to enable saving
    await canvasPage.createRectangle(100, 100, 150, 100);
    await page.waitForTimeout(500);

    // Verify save button is enabled and shows "Save"
    await expect(saveButton).toBeEnabled();
    await expect(saveButton).toContainText('Save');

    // Click save button
    await saveButton.click();

    // Verify button shows "Saving..." with spinner
    await expect(saveButton).toBeDisabled();
    await expect(saveButton).toContainText('Saving');

    // Wait for save to complete and verify button shows "Saved ✓"
    await expect(saveButton).toContainText('Saved', { timeout: 5000 });
    await expect(saveButton).toBeDisabled();

    // Make another change
    await canvasPage.createCircle(300, 300, 50);
    await page.waitForTimeout(500);

    // Verify save button is enabled again and shows "Save"
    await expect(saveButton).toBeEnabled();
    await expect(saveButton).toContainText('Save');
  });
});

test.describe('Milestone B: UI Redesign - Premium Features (Locked State)', () => {
  let canvasPage: CanvasEditorPage;
  let supabase: ReturnType<typeof createServiceRoleClient>;

  test.beforeEach(async ({ authenticatedPage: page, testUser }) => {
    supabase = createServiceRoleClient();

    // Ensure user has <3 approved projects (locked state)
    // Delete any existing projects for this user
    await supabase
      .from('canvas_projects')
      .delete()
      .eq('user_id', testUser.userId);

    // Create 0-2 public projects (to keep locked state)
    // We'll create 1 project for testing
    const { error: insertError } = await supabase
      .from('canvas_projects')
      .insert({
        user_id: testUser.userId,
        name: 'Test Project 1',
        is_public: true,
        approval_status: 'pending',
        canvas_data: JSON.stringify({ objects: [] }),
        canvas_width: 800,
        canvas_height: 600,
        paper_size: 'custom',
      });

    if (insertError) {
      throw new Error(`Failed to create test project: ${insertError.message}`);
    }

    // Wait a bit to ensure database transaction completes
    await page.waitForTimeout(500);

    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test.afterEach(async ({ testUser }) => {
    // Cleanup: Delete test projects
    await supabase
      .from('canvas_projects')
      .delete()
      .eq('user_id', testUser.userId);
  });

  test('Clicking AI Icon Generator button opens premium features popover', async ({ authenticatedPage: page }) => {
    const aiIconButton = page.getByTestId(CanvasEditorTestIds.AI_ICON_BUTTON);
    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);

    // Wait for feature access check to complete (button will no longer be disabled from loading)
    await page.waitForTimeout(2000);

    // Click AI Icon Generator button (force click since it has aria-disabled but is clickable)
    await aiIconButton.click({ force: true });
    await page.waitForTimeout(300);

    // Verify premium features popover opens
    await expect(premiumPopover).toBeVisible();
  });

  test('Clicking PowerPoint Generator button opens premium features popover', async ({ authenticatedPage: page }) => {
    const powerPointButton = page.getByTestId(CanvasEditorTestIds.POWERPOINT_BUTTON);
    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);

    // Wait for feature access check to complete
    await page.waitForTimeout(2000);

    // Click PowerPoint Generator button (force click since it has aria-disabled but is clickable)
    await powerPointButton.click({ force: true });
    await page.waitForTimeout(300);

    // Verify premium features popover opens
    await expect(premiumPopover).toBeVisible();
  });

  test('Clicking Share button opens ShareProjectDialog, not popover', async ({ authenticatedPage: page }) => {
    const shareButton = page.getByTestId(CanvasEditorTestIds.SHARE_BUTTON);

    // Click Share button
    await shareButton.click();
    await page.waitForTimeout(500);

    // Verify Publish Project dialog opens
    const shareDialog = page.getByTestId(CanvasEditorTestIds.PUBLISH_PROJECT_DIALOG);
    await expect(shareDialog).toBeVisible({ timeout: 3000 });

    // Verify premium popover does NOT open
    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);
    await expect(premiumPopover).not.toBeVisible();
  });

  test('Premium features popover displays correct progress information', async ({ authenticatedPage: page }) => {
    const aiIconButton = page.getByTestId(CanvasEditorTestIds.AI_ICON_BUTTON);

    // Wait for feature access check to complete
    await page.waitForTimeout(2000);

    // Open premium features popover
    await aiIconButton.click({ force: true });
    await page.waitForTimeout(300);

    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);
    await expect(premiumPopover).toBeVisible();

    // Wait for the query to fetch project count data
    await page.waitForTimeout(1000);

    // Verify shared projects count shows "1/3" (we created 1 public project in beforeEach)
    const progressText = page.getByTestId(CanvasEditorTestIds.PREMIUM_PROGRESS_TEXT);
    await expect(progressText).toContainText('1/3');

    // Verify progress bar is visible
    const progressBar = page.getByTestId(CanvasEditorTestIds.PREMIUM_PROGRESS_BAR);
    await expect(progressBar).toBeVisible();
  });

  test('Clicking Share button in popover opens ShareProjectDialog', async ({ authenticatedPage: page }) => {
    const aiIconButton = page.getByTestId(CanvasEditorTestIds.AI_ICON_BUTTON);

    // Wait for feature access check to complete
    await page.waitForTimeout(2000);

    // Open premium features popover
    await aiIconButton.click({ force: true });
    await page.waitForTimeout(300);

    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);
    await expect(premiumPopover).toBeVisible();

    // Click Share button inside popover
    const premiumShareButton = page.getByTestId(CanvasEditorTestIds.PREMIUM_SHARE_BUTTON);
    await premiumShareButton.click();
    await page.waitForTimeout(500);

    // Verify Publish Project dialog opens
    const shareDialog = page.getByTestId(CanvasEditorTestIds.PUBLISH_PROJECT_DIALOG);
    await expect(shareDialog).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Milestone B: UI Redesign - Premium Features (Unlocked State)', () => {
  let canvasPage: CanvasEditorPage;
  let supabase: ReturnType<typeof createServiceRoleClient>;

  test.beforeEach(async ({ authenticatedPage: page, testUser }) => {
    supabase = createServiceRoleClient();

    // Delete any existing projects for this user
    await supabase
      .from('canvas_projects')
      .delete()
      .eq('user_id', testUser.userId);

    // Create 3 approved public projects to unlock features
    const projects = [
      {
        user_id: testUser.userId,
        name: 'Approved Project 1',
        is_public: true,
        approval_status: 'approved',
        canvas_data: JSON.stringify({ objects: [] }),
        canvas_width: 800,
        canvas_height: 600,
        paper_size: 'custom',
      },
      {
        user_id: testUser.userId,
        name: 'Approved Project 2',
        is_public: true,
        approval_status: 'approved',
        canvas_data: JSON.stringify({ objects: [] }),
        canvas_width: 800,
        canvas_height: 600,
        paper_size: 'custom',
      },
      {
        user_id: testUser.userId,
        name: 'Approved Project 3',
        is_public: true,
        approval_status: 'approved',
        canvas_data: JSON.stringify({ objects: [] }),
        canvas_width: 800,
        canvas_height: 600,
        paper_size: 'custom',
      },
    ];

    await supabase
      .from('canvas_projects')
      .insert(projects);

    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test.afterEach(async ({ testUser }) => {
    // Cleanup: Delete test projects
    await supabase
      .from('canvas_projects')
      .delete()
      .eq('user_id', testUser.userId);
  });

  test('Clicking AI Icon Generator button opens AI Icon Generator dialog (not popover)', async ({ authenticatedPage: page }) => {
    const aiIconButton = page.getByTestId(CanvasEditorTestIds.AI_ICON_BUTTON);

    // Wait for feature access check to complete
    await page.waitForTimeout(2000);

    // Click AI Icon Generator button
    await aiIconButton.click();
    await page.waitForTimeout(500);

    // Verify AI Icon Generator dialog opens (look for AI-specific dialog)
    const aiDialog = page.locator('[role="dialog"]').filter({ hasText: /ai.*icon.*generator/i });
    await expect(aiDialog).toBeVisible({ timeout: 3000 });

    // Verify premium popover does NOT open
    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);
    await expect(premiumPopover).not.toBeVisible();
  });

  test('Clicking PowerPoint Generator button opens PowerPoint dialog (not popover)', async ({ authenticatedPage: page }) => {
    const powerPointButton = page.getByTestId(CanvasEditorTestIds.POWERPOINT_BUTTON);

    // Wait for feature access check to complete
    await page.waitForTimeout(2000);

    // Click PowerPoint Generator button
    await powerPointButton.click();
    await page.waitForTimeout(500);

    // Verify PowerPoint dialog opens
    const powerPointDialog = page.locator('[role="dialog"]').filter({ hasText: /powerpoint/i });
    await expect(powerPointDialog).toBeVisible({ timeout: 3000 });

    // Verify premium popover does NOT open
    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);
    await expect(premiumPopover).not.toBeVisible();
  });

  test('Clicking Share button opens ShareProjectDialog', async ({ authenticatedPage: page }) => {
    const shareButton = page.getByTestId(CanvasEditorTestIds.SHARE_BUTTON);

    // Click Share button
    await shareButton.click();
    await page.waitForTimeout(500);

    // Verify Publish Project dialog opens
    const shareDialog = page.getByTestId(CanvasEditorTestIds.PUBLISH_PROJECT_DIALOG);
    await expect(shareDialog).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Milestone B: UI Redesign - AI Generated Icons Section', () => {
  let canvasPage: CanvasEditorPage;
  let supabase: ReturnType<typeof createServiceRoleClient>;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    supabase = createServiceRoleClient();
    canvasPage = new CanvasEditorPage(page);
    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();
  });

  test('Generate with AI button in Icon Library opens premium popover when locked', async ({ authenticatedPage: page, testUser }) => {
    // Ensure user has <3 approved projects (locked state)
    await supabase
      .from('canvas_projects')
      .delete()
      .eq('user_id', testUser.userId);

    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();

    // Wait for feature access check to complete
    await page.waitForTimeout(2000);

    // Icon library should be open by default - verify we're on Icons tab
    const iconsTab = page.getByTestId(IconLibraryTestIds.ICONS_TAB);
    await expect(iconsTab).toBeVisible();

    // Find the "AI Icon" button in the icon library header
    const aiGenerateButton = page.getByTestId(IconLibraryTestIds.AI_GENERATE_BUTTON);
    await expect(aiGenerateButton).toBeVisible();

    // Click the button (force click since it has opacity-50 but is clickable)
    await aiGenerateButton.click({ force: true });
    await page.waitForTimeout(300);

    // Verify premium features popover opens
    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);
    await expect(premiumPopover).toBeVisible();
  });

  test('Generate with AI button in Icon Library opens AI Icon Generator when unlocked', async ({ authenticatedPage: page, testUser }) => {
    // Ensure user has ≥3 approved projects (unlocked state)
    await supabase
      .from('canvas_projects')
      .delete()
      .eq('user_id', testUser.userId);

    const projects = Array.from({ length: 3 }, (_, i) => ({
      user_id: testUser.userId,
      name: `Approved Project ${i + 1}`,
      is_public: true,
      approval_status: 'approved',
      canvas_data: JSON.stringify({ objects: [] }),
      canvas_width: 800,
      canvas_height: 600,
      paper_size: 'custom',
    }));

    await supabase
      .from('canvas_projects')
      .insert(projects);

    // Wait a bit to ensure database transaction completes
    await page.waitForTimeout(500);

    await canvasPage.goto();
    await canvasPage.waitForCanvasReady();

    // Wait for feature access check to complete
    await page.waitForTimeout(2000);

    // Icon library should be open by default - verify we're on Icons tab
    const iconsTab = page.getByTestId(IconLibraryTestIds.ICONS_TAB);
    await expect(iconsTab).toBeVisible();

    // Find the "AI Icon" button in the icon library header
    const aiGenerateButton = page.getByTestId(IconLibraryTestIds.AI_GENERATE_BUTTON);
    await expect(aiGenerateButton).toBeVisible();

    // Click the button
    await aiGenerateButton.click();
    await page.waitForTimeout(500);

    // Verify AI Icon Generator dialog opens (look for AI-specific dialog)
    const aiDialog = page.locator('[role="dialog"]').filter({ hasText: /ai.*icon.*generator/i });
    await expect(aiDialog).toBeVisible({ timeout: 3000 });

    // Verify premium popover does NOT open
    const premiumPopover = page.getByTestId(CanvasEditorTestIds.PREMIUM_POPOVER);
    await expect(premiumPopover).not.toBeVisible();
  });
});
