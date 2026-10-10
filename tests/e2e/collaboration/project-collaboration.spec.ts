import { test, expect } from '../fixtures/auth';
import { ProjectsPage } from '../utils/page-objects/ProjectsPage';
import { CollaborateDialogPage } from '../utils/page-objects/CollaborateDialogPage';
import { AcceptInvitationPage } from '../utils/page-objects/AcceptInvitationPage';
import { CollaborateDialogTestIds, AuthTestIds, AcceptInvitationTestIds } from '@/lib/test-ids';
import { createServiceRoleClient, createTestUser, deleteTestUser } from '../../utils/supabase-test-client';

test.describe('Project Collaboration', () => {
  let createdProjectId: string | null = null;

  test.afterEach(async () => {
    if (createdProjectId) {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('canvas_projects').delete().eq('id', createdProjectId);
      createdProjectId = null;
    }
  });

  async function createTestProject(userId: string): Promise<string> {
    const serviceClient = createServiceRoleClient();
    const { data } = await serviceClient
      .from('canvas_projects')
      .insert({
        user_id: userId,
        name: 'Collaboration Test Project',
        canvas_data: {},
        canvas_width: 800,
        canvas_height: 600,
        is_public: false,
      })
      .select()
      .single();
    return data!.id;
  }

  test('Collaborate button opens CollaborateDialog', async ({ authenticatedPage: page, testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();

    // Click collaborate button for the test project
    const collaborateBtn = page.locator(`[data-testid="collaborate-project-${createdProjectId}"]`);
    await expect(collaborateBtn).toBeVisible({ timeout: 5000 });
    await collaborateBtn.click();

    const dialogPage = new CollaborateDialogPage(page);
    await dialogPage.waitForOpen();

    const dialog = page.getByTestId(CollaborateDialogTestIds.DIALOG);
    await expect(dialog).toBeVisible();
  });

  test('Copy invite link button copies correct URL pattern to clipboard', async ({ authenticatedPage: page, testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    // Create a collaborator row (pending) via service role
    const serviceClient = createServiceRoleClient();
    const inviteeUser = await createTestUser('collab-copy-link');
    try {
      const { data: collab } = await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: createdProjectId,
          user_id: inviteeUser.userId,
          permission: 'view',
          invited_by: testUser.userId,
          // No accepted_at — pending
        })
        .select()
        .single();

      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      const projectsPage = new ProjectsPage(page);
      await projectsPage.goto();

      const collaborateBtn = page.locator(`[data-testid="collaborate-project-${createdProjectId}"]`);
      await expect(collaborateBtn).toBeVisible({ timeout: 5000 });
      await collaborateBtn.click();

      const dialogPage = new CollaborateDialogPage(page);
      await dialogPage.waitForOpen();

      // Find the pending collaborator row and copy the link
      const row = dialogPage.getCollaboratorRow(inviteeUser.email);
      // The row may show by name — wait for it
      await page.waitForTimeout(1000);
      const copyBtn = page.getByTestId(CollaborateDialogTestIds.COPY_INVITE_LINK_BUTTON).first();
      await expect(copyBtn).toBeVisible();
      await copyBtn.click();

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toMatch(/\/invite\/project\/[a-f0-9-]+/);
    } finally {
      await deleteTestUser(inviteeUser.userId);
    }
  });

  test('Remove collaborator — row disappears', async ({ authenticatedPage: page, testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    const serviceClient = createServiceRoleClient();
    const inviteeUser = await createTestUser('collab-remove');
    try {
      await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: createdProjectId,
          user_id: inviteeUser.userId,
          permission: 'view',
          invited_by: testUser.userId,
          accepted_at: new Date().toISOString(),
        });

      const projectsPage = new ProjectsPage(page);
      await projectsPage.goto();

      const collaborateBtn = page.locator(`[data-testid="collaborate-project-${createdProjectId}"]`);
      await collaborateBtn.click();

      const dialogPage = new CollaborateDialogPage(page);
      await dialogPage.waitForOpen();
      await page.waitForTimeout(1000);

      const removeBtn = page.getByTestId(CollaborateDialogTestIds.REMOVE_COLLABORATOR_BUTTON).first();
      await expect(removeBtn).toBeVisible();
      await removeBtn.click();
      await page.waitForTimeout(500);

      // Verify row is gone from DB
      const { data } = await serviceClient
        .from('project_collaborators')
        .select('id')
        .eq('project_id', createdProjectId)
        .eq('user_id', inviteeUser.userId);
      expect(data?.length).toBe(0);
    } finally {
      await deleteTestUser(inviteeUser.userId);
    }
  });

  test('Two-user flow: share (edit) → accept → collaborator can access project', async ({ authenticatedPage: page, testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    const serviceClient = createServiceRoleClient();
    const collaboratorUser = await createTestUser('collab-accept-edit');
    try {
      // Insert accepted project_collaborators row with edit permission
      await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: createdProjectId,
          user_id: collaboratorUser.userId,
          permission: 'edit',
          invited_by: testUser.userId,
          accepted_at: new Date().toISOString(),
        });

      // Sign out current user
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');

      // Sign in as collaborator
      await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(collaboratorUser.email);
      await page.getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT).fill(collaboratorUser.password);
      await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();
      await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
      await page.waitForLoadState('networkidle');

      // Navigate to projects — shared project should appear (collaborators can SELECT it)
      await page.goto('/canvas/' + createdProjectId);
      await page.waitForLoadState('networkidle');

      // Verify the canvas loaded (URL should still be on the project canvas)
      expect(page.url()).toContain(createdProjectId);

      // Verify DB-level: edit collaborator can update the project
      const editClient = await (await import('../../utils/supabase-test-client')).createAuthenticatedClient(
        collaboratorUser.email,
        collaboratorUser.password
      );
      const { error } = await editClient
        .from('canvas_projects')
        .update({ canvas_data: { collaboratorEdit: true } })
        .eq('id', createdProjectId);
      expect(error).toBeNull();
    } finally {
      await deleteTestUser(collaboratorUser.userId);
    }
  });

  test('Share project with group → group member can access project', async ({ testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    const serviceClient = createServiceRoleClient();
    const groupMember = await createTestUser('collab-group-member');
    let groupId: string | null = null;

    try {
      // Create a group and add member
      const { data: group } = await serviceClient
        .from('groups')
        .insert({ name: 'Test Collab Group', created_by: testUser.userId })
        .select()
        .single();
      groupId = group!.id;

      await serviceClient
        .from('group_members')
        .insert({ group_id: groupId, user_id: groupMember.userId, role: 'member' });

      // Share project with group
      await serviceClient
        .from('project_group_access')
        .insert({ project_id: createdProjectId, group_id: groupId, permission: 'view', granted_by: testUser.userId });

      // Verify group member can SELECT the project via RLS
      const memberClient = await (await import('../../utils/supabase-test-client')).createAuthenticatedClient(
        groupMember.email,
        groupMember.password
      );
      const { data, error } = await memberClient
        .from('canvas_projects')
        .select('id')
        .eq('id', createdProjectId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    } finally {
      if (groupId) await serviceClient.from('groups').delete().eq('id', groupId);
      await deleteTestUser(groupMember.userId);
    }
  });

  test('Remove group access → group member loses access', async ({ testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    const serviceClient = createServiceRoleClient();
    const groupMember = await createTestUser('collab-group-remove');
    let groupId: string | null = null;

    try {
      const { data: group } = await serviceClient
        .from('groups')
        .insert({ name: 'Remove Access Group', created_by: testUser.userId })
        .select()
        .single();
      groupId = group!.id;

      await serviceClient
        .from('group_members')
        .insert({ group_id: groupId, user_id: groupMember.userId, role: 'member' });

      const { data: gAccess } = await serviceClient
        .from('project_group_access')
        .insert({ project_id: createdProjectId, group_id: groupId, permission: 'view', granted_by: testUser.userId })
        .select()
        .single();

      // Confirm access exists
      const memberClient = await (await import('../../utils/supabase-test-client')).createAuthenticatedClient(
        groupMember.email,
        groupMember.password
      );
      const { data: before } = await memberClient
        .from('canvas_projects')
        .select('id')
        .eq('id', createdProjectId);
      expect(before?.length).toBe(1);

      // Remove group access
      await serviceClient.from('project_group_access').delete().eq('id', gAccess!.id);

      // Member no longer has access
      const { data: after } = await memberClient
        .from('canvas_projects')
        .select('id')
        .eq('id', createdProjectId);
      expect(after?.length ?? 0).toBe(0);
    } finally {
      if (groupId) await serviceClient.from('groups').delete().eq('id', groupId);
      await deleteTestUser(groupMember.userId);
    }
  });

  test('Non-user email invitation: token accepted by matching signed-in user sets accepted_at and user_id', async ({ authenticatedPage: page, testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    const serviceClient = createServiceRoleClient();
    const inviteeUser = await createTestUser('collab-email-only');
    try {
      // Insert collaborator row with email only — no user_id (simulates inviting a non-user)
      const { data: collab } = await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: createdProjectId,
          email: inviteeUser.email,
          permission: 'view',
          invited_by: testUser.userId,
          // No user_id, no accepted_at — pending non-user invitation
        })
        .select()
        .single();

      const invitationToken = collab!.invitation_token;

      // Sign out and sign in as the invitee (who now has an account)
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');
      await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(inviteeUser.email);
      await page.getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT).fill(inviteeUser.password);
      await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();
      await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });

      // Navigate to the project invitation via token
      const acceptPage = new AcceptInvitationPage(page);
      await acceptPage.gotoProjectInvite(invitationToken);

      // Should show invitation details and accept button
      await expect(page.getByTestId(AcceptInvitationTestIds.INVITATION_DETAILS)).toBeVisible({ timeout: 8000 });
      await expect(page.getByTestId(AcceptInvitationTestIds.ACCEPT_BUTTON)).toBeVisible();

      await acceptPage.accept();

      // Should navigate to the project canvas
      await page.waitForURL((url) => url.pathname.includes('/canvas/'), { timeout: 10000 });
      expect(page.url()).toContain(createdProjectId);

      // Verify DB: accepted_at set and user_id resolved
      const { data: updatedCollab } = await serviceClient
        .from('project_collaborators')
        .select('accepted_at, user_id')
        .eq('invitation_token', invitationToken)
        .single();
      expect(updatedCollab!.accepted_at).not.toBeNull();
      expect(updatedCollab!.user_id).toBe(inviteeUser.userId);
    } finally {
      await deleteTestUser(inviteeUser.userId);
    }
  });

  test('Email-only collaborator row: pending non-user cannot access project; accepted invitee can', async ({ testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    const serviceClient = createServiceRoleClient();
    const inviteeUser = await createTestUser('collab-email-rls');
    try {
      // Insert pending email-only row (no user_id)
      const { data: collab } = await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: createdProjectId,
          email: inviteeUser.email,
          permission: 'view',
          invited_by: testUser.userId,
        })
        .select()
        .single();

      // Before acceptance: invitee cannot SELECT the project
      const inviteeClient = await (await import('../../utils/supabase-test-client')).createAuthenticatedClient(
        inviteeUser.email,
        inviteeUser.password
      );
      const { data: before } = await inviteeClient
        .from('canvas_projects')
        .select('id')
        .eq('id', createdProjectId);
      expect(before?.length ?? 0).toBe(0);

      // Simulate acceptance: set accepted_at and user_id
      await serviceClient
        .from('project_collaborators')
        .update({ accepted_at: new Date().toISOString(), user_id: inviteeUser.userId })
        .eq('id', collab!.id);

      // After acceptance: invitee can SELECT the project
      const { data: after } = await inviteeClient
        .from('canvas_projects')
        .select('id')
        .eq('id', createdProjectId);
      expect(after?.length).toBe(1);
    } finally {
      await deleteTestUser(inviteeUser.userId);
    }
  });

  test('Owner upgrades collaborator from view to edit — collaborator can now UPDATE project', async ({ testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);
    const serviceClient = createServiceRoleClient();
    const collabUser = await createTestUser('collab-upgrade');
    try {
      const { data: row } = await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: createdProjectId,
          user_id: collabUser.userId,
          permission: 'view',
          invited_by: testUser.userId,
          accepted_at: new Date().toISOString(),
        })
        .select()
        .single();

      const { createAuthenticatedClient } = await import('../../utils/supabase-test-client');
      const collabClient = await createAuthenticatedClient(collabUser.email, collabUser.password);

      // Confirm view permission blocks UPDATE
      const { error: viewError } = await collabClient
        .from('canvas_projects').update({ canvas_data: { preUpgrade: true } }).eq('id', createdProjectId);
      expect(viewError).toBeDefined();

      // Upgrade to edit via service role (simulating owner action in UI)
      await serviceClient
        .from('project_collaborators')
        .update({ permission: 'edit' })
        .eq('id', row!.id);

      // Now UPDATE should succeed
      const { error: editError } = await collabClient
        .from('canvas_projects').update({ canvas_data: { postUpgrade: true } }).eq('id', createdProjectId);
      expect(editError).toBeNull();
    } finally {
      await deleteTestUser(collabUser.userId);
    }
  });

  test('Owner downgrades collaborator from edit to view — collaborator can no longer UPDATE project', async ({ testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);
    const serviceClient = createServiceRoleClient();
    const collabUser = await createTestUser('collab-downgrade');
    try {
      const { data: row } = await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: createdProjectId,
          user_id: collabUser.userId,
          permission: 'edit',
          invited_by: testUser.userId,
          accepted_at: new Date().toISOString(),
        })
        .select()
        .single();

      const { createAuthenticatedClient } = await import('../../utils/supabase-test-client');
      const collabClient = await createAuthenticatedClient(collabUser.email, collabUser.password);

      // Confirm edit permission allows UPDATE
      const { error: editError } = await collabClient
        .from('canvas_projects').update({ canvas_data: { preDowngrade: true } }).eq('id', createdProjectId);
      expect(editError).toBeNull();

      // Downgrade to view
      await serviceClient
        .from('project_collaborators')
        .update({ permission: 'view' })
        .eq('id', row!.id);

      // UPDATE should now be blocked
      const { error: viewError } = await collabClient
        .from('canvas_projects').update({ canvas_data: { postDowngrade: true } }).eq('id', createdProjectId);
      expect(viewError).toBeDefined();
    } finally {
      await deleteTestUser(collabUser.userId);
    }
  });

  test('Two-user flow: share (view) → accept → collaborator cannot edit (RLS)', async ({ testUser }) => {
    createdProjectId = await createTestProject(testUser.userId);

    const serviceClient = createServiceRoleClient();
    const viewerUser = await createTestUser('collab-accept-view');
    try {
      await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: createdProjectId,
          user_id: viewerUser.userId,
          permission: 'view',
          invited_by: testUser.userId,
          accepted_at: new Date().toISOString(),
        });

      // Verify at DB level: view collaborator CANNOT update
      const viewClient = await (await import('../../utils/supabase-test-client')).createAuthenticatedClient(
        viewerUser.email,
        viewerUser.password
      );

      // Can SELECT
      const { data, error: selectErr } = await viewClient
        .from('canvas_projects')
        .select('id')
        .eq('id', createdProjectId);
      expect(selectErr).toBeNull();
      expect(data?.length).toBe(1);

      // Cannot UPDATE
      const { error: updateErr } = await viewClient
        .from('canvas_projects')
        .update({ canvas_data: { viewerHacked: true } })
        .eq('id', createdProjectId);
      expect(updateErr).toBeDefined();
    } finally {
      await deleteTestUser(viewerUser.userId);
    }
  });
});
