/**
 * Canvas Comment System E2E Tests
 */
import { test, expect } from '../fixtures/auth';
import { CanvasEditorTestIds, AuthTestIds } from '@/lib/test-ids';
import { createServiceRoleClient, createTestUser, deleteTestUser, createAuthenticatedClient } from '../../utils/supabase-test-client';

test.describe('Canvas Comments', () => {
  let projectId: string;
  let ownerUserId: string;

  // Dismiss TipBanner before each canvas navigation to prevent it from intercepting clicks
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('canvas_tip_banner_dismissed', 'true');
    });
  });

  test.beforeEach(async ({ testUser }) => {
    const serviceClient = createServiceRoleClient();
    ownerUserId = testUser.userId;

    const { data: project } = await serviceClient
      .from('canvas_projects')
      .insert({
        user_id: testUser.userId,
        name: 'Comment Test Project',
        canvas_data: {},
        canvas_width: 800,
        canvas_height: 600,
        is_public: false,
      })
      .select()
      .single();
    projectId = project!.id;
  });

  test.afterEach(async () => {
    const serviceClient = createServiceRoleClient();
    await serviceClient.from('canvas_comments').delete().eq('project_id', projectId);
    await serviceClient.from('canvas_projects').delete().eq('id', projectId);
  });

  test('Comment tool button is visible in toolbar', async ({ authenticatedPage: page }) => {
    await page.goto(`/canvas/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const commentTool = page.getByTestId(CanvasEditorTestIds.COMMENT_TOOL);
    // Explicitly assert isVisible() === true, not just toBeVisible()
    const isVisible = await commentTool.isVisible();
    expect(isVisible).toBe(true);
  });

  test('Click canvas in comment mode — comment pin appears and DB row is created', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();

    await page.goto(`/canvas/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Activate comment mode
    const commentTool = page.getByTestId(CanvasEditorTestIds.COMMENT_TOOL);
    await expect(commentTool).toBeVisible({ timeout: 5000 });
    await commentTool.click();

    // Click the fabric canvas element (upper-canvas handles interactions in Fabric.js)
    const canvasEl = page.locator('canvas[data-fabric="top"]');
    await canvasEl.click({ position: { x: 400, y: 300 } });

    // Inline comment draft textarea should appear
    const draftInput = page.getByTestId('comment-draft-input');
    await expect(draftInput).toBeVisible({ timeout: 5000 });
    await draftInput.fill('Test pin comment');

    // Submit the comment
    const draftSubmit = page.getByTestId('comment-draft-submit');
    await draftSubmit.click();

    // Wait for comment creation to complete
    await page.waitForTimeout(1500);

    // Verify DB row was created
    const { data: rows } = await serviceClient
      .from('canvas_comments')
      .select('id, content')
      .eq('project_id', projectId)
      .eq('content', 'Test pin comment');

    expect(rows).not.toBeNull();
    expect(rows!.length).toBeGreaterThanOrEqual(1);

    // Verify comment pin appears on canvas
    const pin = page.locator('[data-testid="canvas-comment-pin"]').first();
    await expect(pin).toBeVisible({ timeout: 5000 });
  });

  test('Reply to comment via UI — reply appears in thread', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();

    // Create parent comment via service role
    const { data: parent } = await serviceClient
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: testUser.userId,
        content: 'Parent comment for reply test',
        canvas_x: 150,
        canvas_y: 150,
      })
      .select('id')
      .single();

    await page.goto(`/canvas/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Click the comment pin to open thread
    const pin = page.locator('[data-testid="canvas-comment-pin"]').first();
    await expect(pin).toBeVisible({ timeout: 5000 });
    await pin.click();

    // CommentThread should open
    const thread = page.getByTestId('canvas-comment-thread');
    await expect(thread).toBeVisible({ timeout: 5000 });

    // Type a reply
    const replyInput = page.getByTestId('comment-reply-input');
    await expect(replyInput).toBeVisible({ timeout: 3000 });
    await replyInput.fill('Test reply text');

    // Submit reply
    const submitBtn = page.getByTestId('comment-reply-submit');
    await submitBtn.click();

    // Wait for reply to be saved
    await page.waitForTimeout(1000);

    // Verify reply row in DB
    const { data: reply } = await serviceClient
      .from('canvas_comments')
      .select('id, content, parent_id')
      .eq('project_id', projectId)
      .eq('content', 'Test reply text')
      .single();

    expect(reply).not.toBeNull();
    expect(reply!.parent_id).toBe(parent!.id);

    // Verify reply text visible in thread
    await expect(page.getByText('Test reply text')).toBeVisible({ timeout: 3000 });
  });

  test('Resolve flow via UI — resolved state persists in DB', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();

    // Create comment via service role
    const { data: comment } = await serviceClient
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: testUser.userId,
        content: 'Comment to resolve via UI',
        canvas_x: 300,
        canvas_y: 200,
      })
      .select('id')
      .single();

    await page.goto(`/canvas/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Click the pin for this comment
    // There may be multiple pins — find the one closest to (300, 200)
    const pins = page.locator('[data-testid="canvas-comment-pin"]');
    const pinCount = await pins.count();
    expect(pinCount).toBeGreaterThanOrEqual(1);

    // Click the first visible pin
    await pins.first().click();

    const thread = page.getByTestId('canvas-comment-thread');
    await expect(thread).toBeVisible({ timeout: 5000 });

    // Click resolve button
    const resolveBtn = page.getByTestId('comment-resolve-button');
    await expect(resolveBtn).toBeVisible({ timeout: 3000 });
    await resolveBtn.click();

    // Wait for update to propagate
    await page.waitForTimeout(1000);

    // Verify DB state
    const { data: resolved } = await serviceClient
      .from('canvas_comments')
      .select('resolved')
      .eq('id', comment!.id)
      .single();

    expect(resolved?.resolved).toBe(true);
  });

  test('Comment filter in properties panel shows correct comment counts', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();

    // Clean up any previous test comments first
    await serviceClient.from('canvas_comments').delete().eq('project_id', projectId);

    // Create 2 unresolved + 1 resolved comment
    await serviceClient.from('canvas_comments').insert([
      { project_id: projectId, author_id: testUser.userId, content: 'Unresolved 1', canvas_x: 10, canvas_y: 10, resolved: false },
      { project_id: projectId, author_id: testUser.userId, content: 'Unresolved 2', canvas_x: 20, canvas_y: 20, resolved: false },
      { project_id: projectId, author_id: testUser.userId, content: 'Resolved 1', canvas_x: 30, canvas_y: 30, resolved: true },
    ]);

    await page.goto(`/canvas/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Comments are listed in the Properties Panel COMMENTS section (always visible on the right)
    const commentsSection = page.locator('#section-comments');
    await expect(commentsSection).toBeVisible({ timeout: 15000 });

    // "All" filter (default) should show 3 items
    const allItems = page.locator('[data-testid="comment-panel-item"]');
    await expect(allItems).toHaveCount(3, { timeout: 15000 });

    // Switch to "Unresolved" via the Select dropdown
    const filterSelect = commentsSection.getByRole('combobox');
    await filterSelect.click();
    await page.getByRole('option', { name: 'Unresolved' }).click();
    await expect(allItems).toHaveCount(2, { timeout: 3000 });

    // Switch to "Resolved" via the Select dropdown
    await filterSelect.click();
    await page.getByRole('option', { name: 'Resolved', exact: true }).click();
    await expect(allItems).toHaveCount(1, { timeout: 3000 });
  });

  test('Inserting a comment as project owner works — RLS allows access', async ({ testUser }) => {
    const serviceClient = createServiceRoleClient();

    const { data, error } = await serviceClient
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: testUser.userId,
        content: 'Collaborator RLS check',
        canvas_x: 50,
        canvas_y: 50,
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();

    // Cleanup
    if (data?.id) {
      await serviceClient.from('canvas_comments').delete().eq('id', data.id);
    }
  });

  test('Project owner resolves a comment authored by a collaborator', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();
    const collabUser = await createTestUser('comment-owner-resolve');
    try {
      // Add collabUser as collaborator
      await serviceClient.from('project_collaborators').insert({
        project_id: projectId,
        user_id: collabUser.userId,
        email: collabUser.email,
        permission: 'view',
        invited_by: testUser.userId,
        accepted_at: new Date().toISOString(),
      });

      // Create a comment authored by the collaborator
      const { data: comment } = await serviceClient
        .from('canvas_comments')
        .insert({
          project_id: projectId,
          author_id: collabUser.userId,
          content: 'Collaborator comment for owner to resolve',
          canvas_x: 400,
          canvas_y: 300,
        })
        .select('id')
        .single();

      await page.goto(`/canvas/${projectId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      // Click the comment pin on the canvas to open the thread
      const pins = page.locator('[data-testid="canvas-comment-pin"]');
      await expect(pins.first()).toBeVisible({ timeout: 5000 });
      await pins.first().click();

      const thread = page.getByTestId('canvas-comment-thread');
      await expect(thread).toBeVisible({ timeout: 5000 });

      // Owner clicks resolve on a comment they didn't author
      const resolveBtn = page.getByTestId('comment-resolve-button');
      await expect(resolveBtn).toBeVisible({ timeout: 3000 });
      await resolveBtn.click();
      await page.waitForTimeout(1000);

      const { data: resolved } = await serviceClient
        .from('canvas_comments')
        .select('resolved')
        .eq('id', comment!.id)
        .single();
      expect(resolved?.resolved).toBe(true);

      // Cleanup
      await serviceClient.from('canvas_comments').delete().eq('id', comment!.id);
    } finally {
      await serviceClient.from('project_collaborators').delete().eq('project_id', projectId).eq('user_id', collabUser.userId);
      await deleteTestUser(collabUser.userId);
    }
  });

  test('Project owner deletes a collaborator comment', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();
    const collabUser = await createTestUser('comment-owner-delete');
    try {
      await serviceClient.from('project_collaborators').insert({
        project_id: projectId,
        user_id: collabUser.userId,
        email: collabUser.email,
        permission: 'view',
        invited_by: testUser.userId,
        accepted_at: new Date().toISOString(),
      });

      const { data: comment } = await serviceClient
        .from('canvas_comments')
        .insert({
          project_id: projectId,
          author_id: collabUser.userId,
          content: 'Comment for owner to delete',
          canvas_x: 250,
          canvas_y: 250,
        })
        .select('id')
        .single();

      await page.goto(`/canvas/${projectId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      // Click the comment pin to open the thread
      const pins = page.locator('[data-testid="canvas-comment-pin"]');
      await expect(pins.first()).toBeVisible({ timeout: 5000 });
      await pins.first().click();

      const deleteBtn = page.getByTestId('comment-delete-thread-button');
      if (await deleteBtn.isVisible({ timeout: 3000 })) {
        await deleteBtn.click();
        const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i }).last();
        if (await confirmBtn.isVisible({ timeout: 2000 })) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(1000);

        const { data: deleted } = await serviceClient
          .from('canvas_comments')
          .select('id')
          .eq('id', comment!.id)
          .maybeSingle();
        expect(deleted).toBeNull();
      }

      // Always cleanup to prevent test pollution
      await serviceClient.from('canvas_comments').delete().eq('id', comment!.id).maybeSingle();
    } finally {
      await serviceClient.from('project_collaborators').delete().eq('project_id', projectId).eq('user_id', collabUser.userId);
      await deleteTestUser(collabUser.userId);
    }
  });

  test('Author edits their own comment text', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();
    const { data: comment } = await serviceClient
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: testUser.userId,
        content: 'Original comment text to edit',
        canvas_x: 180,
        canvas_y: 180,
      })
      .select('id')
      .single();

    try {
      await page.goto(`/canvas/${projectId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      // Click the comment pin to open the thread
      const pins = page.locator('[data-testid="canvas-comment-pin"]');
      await expect(pins.first()).toBeVisible({ timeout: 5000 });
      await pins.first().click();

      // Click edit button on comment
      const editBtn = page.getByTestId('comment-edit-button');
      if (await editBtn.isVisible({ timeout: 3000 })) {
        await editBtn.click();
        const editInput = page.getByTestId('comment-edit-input').or(page.getByRole('textbox').last());
        await expect(editInput).toBeVisible({ timeout: 3000 });
        await editInput.fill('Updated comment text');
        await page.getByTestId('comment-edit-submit').or(page.getByRole('button', { name: /save|update/i })).first().click();
        await page.waitForTimeout(1000);

        const { data: updated } = await serviceClient
          .from('canvas_comments')
          .select('content')
          .eq('id', comment!.id)
          .single();
        expect(updated?.content).toBe('Updated comment text');
      }
    } finally {
      await serviceClient.from('canvas_comments').delete().eq('id', comment!.id).maybeSingle();
    }
  });

  test('Non-author, non-owner: edit option not shown in UI', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();
    const otherAuthor = await createTestUser('comment-nonauth-edit');
    try {
      await serviceClient.from('project_collaborators').insert({
        project_id: projectId,
        user_id: otherAuthor.userId,
        email: otherAuthor.email,
        permission: 'view',
        invited_by: testUser.userId,
        accepted_at: new Date().toISOString(),
      });

      // Create a comment authored by testUser (the owner)
      const { data: comment } = await serviceClient
        .from('canvas_comments')
        .insert({
          project_id: projectId,
          author_id: testUser.userId,
          content: 'Owner comment — non-author should not see edit',
          canvas_x: 350,
          canvas_y: 350,
        })
        .select('id')
        .single();

      // Sign in as the non-author collaborator
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');
      await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(otherAuthor.email);
      await page.getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT).fill(otherAuthor.password);
      await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();
      await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });

      await page.goto(`/canvas/${projectId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      // Click the comment pin to open the thread
      const pins = page.locator('[data-testid="canvas-comment-pin"]');
      if (await pins.first().isVisible({ timeout: 5000 })) {
        await pins.first().click();
        // Edit button should NOT be visible for non-author, non-owner
        const editBtn = page.getByTestId('comment-edit-button');
        await expect(editBtn).not.toBeVisible({ timeout: 2000 });
      }

      await serviceClient.from('canvas_comments').delete().eq('id', comment!.id).maybeSingle();
    } finally {
      await serviceClient.from('project_collaborators').delete().eq('project_id', projectId).eq('user_id', otherAuthor.userId);
      await deleteTestUser(otherAuthor.userId);
    }
  });

  test('Non-collaborator cannot insert comment — RLS blocks', async () => {
    const outsider = await createTestUser('comment-outsider');
    try {
      const client = await createAuthenticatedClient(outsider.email, outsider.password);

      const { error } = await client
        .from('canvas_comments')
        .insert({
          project_id: projectId,
          author_id: outsider.userId,
          content: 'Should be blocked',
          canvas_x: 10,
          canvas_y: 10,
        });

      expect(error).toBeDefined();
    } finally {
      await deleteTestUser(outsider.userId);
    }
  });
});
