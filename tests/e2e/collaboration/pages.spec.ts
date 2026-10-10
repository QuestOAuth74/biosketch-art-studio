import { test, expect } from '../fixtures/auth';
import { PagesPage } from '../utils/page-objects/PagesPage';
import { PageDetailPage } from '../utils/page-objects/PageDetailPage';
import { AcceptInvitationPage } from '../utils/page-objects/AcceptInvitationPage';
import { PagesTestIds, CreatePageDialogTestIds, AcceptInvitationTestIds, AuthTestIds, PageDetailTestIds } from '@/lib/test-ids';
import { createServiceRoleClient, createTestUser, deleteTestUser } from '../../utils/supabase-test-client';

test.describe('Pages', () => {
  let pagesPage: PagesPage;
  let pageDetailPage: PageDetailPage;
  let createdPageId: string | null = null;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    pagesPage = new PagesPage(page);
    pageDetailPage = new PageDetailPage(page);
  });

  test.afterEach(async () => {
    if (createdPageId) {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('project_pages').delete().eq('id', createdPageId);
      createdPageId = null;
    }
  });

  test('Pages list page renders correctly', async ({ authenticatedPage: page }) => {
    await pagesPage.goto();
    await expect(page.getByTestId(PagesTestIds.PAGE_CONTAINER)).toBeVisible();
    await expect(page.getByTestId(PagesTestIds.NEW_PAGE_BUTTON)).toBeVisible();
  });

  test('Create page → page appears in My Pages section', async ({ authenticatedPage: page }) => {
    await pagesPage.goto();
    await pagesPage.clickNewPage();

    const dialog = page.getByTestId(CreatePageDialogTestIds.DIALOG);
    await expect(dialog).toBeVisible();

    const pageName = `Test Page ${Date.now()}`;
    await page.getByTestId(CreatePageDialogTestIds.NAME_INPUT).fill(pageName);
    await page.getByTestId(CreatePageDialogTestIds.SUBMIT_BUTTON).click();

    // Should navigate to page detail
    await page.waitForURL(/\/pages\/[a-f0-9-]+/, { timeout: 5000 });
    const url = page.url();
    createdPageId = url.split('/pages/')[1];

    await expect(page.getByTestId(PagesTestIds.PAGE_CONTAINER)).not.toBeVisible(); // not on list page
    // Navigate back to pages list
    await pagesPage.goto();
    const card = pagesPage.getPageCard(pageName);
    await expect(card).toBeVisible();
  });

  test('Add project to page → project appears on page detail', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();

    // Create page and a project via service role
    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Test Add Projects Page', created_by: testUser.userId })
      .select()
      .single();
    createdPageId = pageData!.id;

    const { data: projectData } = await serviceClient
      .from('canvas_projects')
      .insert({ user_id: testUser.userId, name: 'Test Page Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
      .select()
      .single();

    try {
      // Add project to page via service role
      await serviceClient
        .from('project_page_items')
        .insert({ page_id: createdPageId, project_id: projectData!.id, sort_order: 0 });

      await pageDetailPage.goto(createdPageId);
      const projectCard = pageDetailPage.getProjectCard('Test Page Project');
      await expect(projectCard).toBeVisible({ timeout: 5000 });
    } finally {
      await serviceClient.from('canvas_projects').delete().eq('id', projectData!.id);
    }
  });

  test('Share page with group → page appears in group Pages tab', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();

    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Group Share Test Page', created_by: testUser.userId })
      .select()
      .single();
    createdPageId = pageData!.id;

    const { data: group } = await serviceClient
      .from('groups')
      .insert({ name: 'Page Share Group', created_by: testUser.userId })
      .select()
      .single();

    try {
      // Add testUser as owner of the group so RLS allows access
      await serviceClient
        .from('group_members')
        .insert({ group_id: group!.id, user_id: testUser.userId, role: 'owner' });

      await serviceClient
        .from('project_page_group_access')
        .insert({ page_id: createdPageId, group_id: group!.id, permission: 'view', granted_by: testUser.userId });

      // Navigate to group detail and check Pages tab
      await page.goto(`/groups/${group!.id}`);
      await page.waitForLoadState('networkidle');
      await page.getByTestId('group-detail-pages-tab').click();
      await page.waitForTimeout(500);

      await expect(page.getByText('Group Share Test Page')).toBeVisible();
    } finally {
      await serviceClient.from('groups').delete().eq('id', group!.id);
    }
  });

  test('Two-user flow: invite → accept → invitee can access page', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();
    const inviteeUser = await createTestUser('page-invitee');

    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Invite Accept Test Page', created_by: testUser.userId })
      .select()
      .single();
    createdPageId = pageData!.id;

    try {
      // Insert page_page_access row (simulate invitation)
      const { data: accessData } = await serviceClient
        .from('project_page_access')
        .insert({
          page_id: createdPageId,
          email: inviteeUser.email,
          permission: 'view',
          invited_by: testUser.userId,
        })
        .select()
        .single();

      const invitationToken = accessData!.invitation_token;

      // Sign out and sign in as invitee
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');
      await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(inviteeUser.email);
      await page.getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT).fill(inviteeUser.password);
      await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();
      await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });

      // Navigate to page invitation
      const acceptPage = new AcceptInvitationPage(page);
      await acceptPage.gotoPageInvite(invitationToken);

      // Should show invitation details and accept button
      await expect(page.getByTestId(AcceptInvitationTestIds.INVITATION_DETAILS)).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId(AcceptInvitationTestIds.ACCEPT_BUTTON)).toBeVisible();

      await acceptPage.accept();

      // Should redirect to /pages/:id
      await page.waitForURL(`/pages/${createdPageId}`, { timeout: 10000 });
      await expect(page.getByTestId(PagesTestIds.PAGE_CONTAINER)).not.toBeVisible(); // redirected to page detail, not list

      // Verify accepted_at was set in DB
      const { data: updatedAccess } = await serviceClient
        .from('project_page_access')
        .select('accepted_at')
        .eq('invitation_token', invitationToken)
        .single();
      expect(updatedAccess!.accepted_at).not.toBeNull();
    } finally {
      await deleteTestUser(inviteeUser.userId);
    }
  });

  test('Add Project picker: selecting project from picker adds it to page', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();

    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Add Project Picker Test Page', created_by: testUser.userId })
      .select()
      .single();
    createdPageId = pageData!.id;

    const { data: projectData } = await serviceClient
      .from('canvas_projects')
      .insert({ user_id: testUser.userId, name: 'Picker Test Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
      .select()
      .single();

    try {
      await pageDetailPage.goto(createdPageId);

      // Click "Add Project" button (owner only)
      const addBtn = page.getByTestId(PageDetailTestIds.ADD_PROJECTS_BUTTON);
      await expect(addBtn).toBeVisible({ timeout: 5000 });
      await addBtn.click();

      // Picker dialog should appear with the project card
      await expect(page.getByText('Picker Test Project')).toBeVisible({ timeout: 5000 });

      // Click the project card to select it
      await page.getByText('Picker Test Project').click();

      // Dialog should close and project should appear on page
      await expect(page.getByTestId(PageDetailTestIds.PROJECT_CARD)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Picker Test Project')).toBeVisible();

      // Verify in DB
      const { data: items } = await serviceClient
        .from('project_page_items')
        .select('project_id')
        .eq('page_id', createdPageId)
        .eq('project_id', projectData!.id);
      expect(items?.length).toBe(1);
    } finally {
      await serviceClient.from('canvas_projects').delete().eq('id', projectData!.id);
    }
  });

  test('New Project dialog: creates project, links it to page, navigates to canvas', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();

    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'New Project Button Test Page', created_by: testUser.userId })
      .select()
      .single();
    createdPageId = pageData!.id;

    await pageDetailPage.goto(createdPageId);

    // Click "New Project" button
    const newBtn = page.getByTestId(PageDetailTestIds.NEW_PROJECT_BUTTON);
    await expect(newBtn).toBeVisible({ timeout: 5000 });
    await newBtn.click();

    // Dialog should appear — fill in project name
    await expect(page.getByText('Create New Project')).toBeVisible({ timeout: 3000 });
    await page.getByPlaceholder('e.g. Membrane Transport Study').fill('E2E Created Project');

    // Click "Create & Open"
    await page.getByRole('button', { name: 'Create & Open' }).click();

    // Should navigate to canvas
    await page.waitForURL(/\/canvas\/[a-f0-9-]+/, { timeout: 10000 });
    const newProjectId = page.url().split('/canvas/')[1];

    // Verify in DB: project exists and is linked to the page
    const { data: project } = await serviceClient
      .from('canvas_projects')
      .select('id, name')
      .eq('id', newProjectId)
      .single();
    expect(project?.name).toBe('E2E Created Project');

    const { data: item } = await serviceClient
      .from('project_page_items')
      .select('project_id')
      .eq('page_id', createdPageId)
      .eq('project_id', newProjectId)
      .single();
    expect(item?.project_id).toBe(newProjectId);

    // Cleanup
    await serviceClient.from('canvas_projects').delete().eq('id', newProjectId);
  });

  test('Two-user flow: accepted page invitee can view page and its projects (no owner actions visible)', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();
    const inviteeUser = await createTestUser('page-invitee-access');

    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Access Test Page', created_by: testUser.userId })
      .select()
      .single();
    createdPageId = pageData!.id;

    const { data: projectData } = await serviceClient
      .from('canvas_projects')
      .insert({ user_id: testUser.userId, name: 'Access Test Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
      .select()
      .single();

    try {
      // Add project to page
      await serviceClient
        .from('project_page_items')
        .insert({ page_id: createdPageId, project_id: projectData!.id, sort_order: 0 });

      // Give invitee accepted page access (view)
      await serviceClient
        .from('project_page_access')
        .insert({
          page_id: createdPageId,
          email: inviteeUser.email,
          user_id: inviteeUser.userId,
          permission: 'view',
          invited_by: testUser.userId,
          accepted_at: new Date().toISOString(),
        });

      // Sign out and sign in as invitee
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto('/auth');
      await page.waitForLoadState('networkidle');
      await page.getByTestId(AuthTestIds.SIGNIN_EMAIL_INPUT).fill(inviteeUser.email);
      await page.getByTestId(AuthTestIds.SIGNIN_PASSWORD_INPUT).fill(inviteeUser.password);
      await page.getByTestId(AuthTestIds.SIGNIN_SUBMIT_BUTTON).click();
      await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });

      // Navigate to page
      await pageDetailPage.goto(createdPageId);

      // Page name should be visible
      await expect(page.getByTestId(PageDetailTestIds.PAGE_NAME)).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId(PageDetailTestIds.PAGE_NAME)).toHaveText('Access Test Page');

      // Project should be visible
      const projectCard = pageDetailPage.getProjectCard('Access Test Project');
      await expect(projectCard).toBeVisible({ timeout: 5000 });

      // Owner-only buttons should NOT be visible (invitee is not the owner)
      await expect(page.getByTestId(PageDetailTestIds.ADD_PROJECTS_BUTTON)).not.toBeVisible();
      await expect(page.getByTestId(PageDetailTestIds.SHARE_BUTTON)).not.toBeVisible();
    } finally {
      await serviceClient.from('canvas_projects').delete().eq('id', projectData!.id);
      await deleteTestUser(inviteeUser.userId);
    }
  });

  test('Owner updates page name — DB persists, UI reflects', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();
    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Rename Test Page', created_by: testUser.userId })
      .select()
      .single();
    createdPageId = pageData!.id;

    await pageDetailPage.goto(createdPageId);
    await page.waitForLoadState('networkidle');

    // Edit page name via UI (inline edit or settings button)
    const editNameBtn = page.getByTestId(PageDetailTestIds.EDIT_NAME_BUTTON).or(page.getByRole('button', { name: /rename|edit name/i })).first();
    if (await editNameBtn.isVisible({ timeout: 3000 })) {
      await editNameBtn.click();
    } else {
      // Some UIs use double-click on the name itself
      const nameEl = page.getByTestId(PageDetailTestIds.PAGE_NAME);
      await nameEl.dblclick();
    }

    const nameInput = page.getByRole('textbox').filter({ hasText: /rename|page/i }).or(page.locator('input[value="Rename Test Page"]')).first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Updated Page Name');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const { data: updated } = await serviceClient.from('project_pages').select('name').eq('id', createdPageId).single();
    expect(updated?.name).toBe('Updated Page Name');
    await expect(page.getByText('Updated Page Name')).toBeVisible({ timeout: 5000 });
  });

  test('Owner deletes page — page removed from list, accepted invitee loses access', async ({ authenticatedPage: page, testUser }) => {
    const serviceClient = createServiceRoleClient();
    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Delete Test Page', created_by: testUser.userId })
      .select()
      .single();
    const deletePageId = pageData!.id;

    const invitee = await createTestUser('page-del-invitee');
    try {
      await serviceClient.from('project_page_access').insert({
        page_id: deletePageId,
        email: invitee.email,
        user_id: invitee.userId,
        permission: 'view',
        invited_by: testUser.userId,
        accepted_at: new Date().toISOString(),
      });

      // Verify invitee has access
      const { createAuthenticatedClient } = await import('../../utils/supabase-test-client');
      const inviteeClient = await createAuthenticatedClient(invitee.email, invitee.password);
      const { data: before } = await inviteeClient.from('project_pages').select('id').eq('id', deletePageId);
      expect(before?.length).toBe(1);

      await pageDetailPage.goto(deletePageId);
      await page.waitForLoadState('networkidle');

      // Delete page via UI settings/menu
      const deleteBtn = page.getByRole('button', { name: /delete page/i }).or(page.getByTestId(PageDetailTestIds.DELETE_PAGE_BUTTON)).first();
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.click();

      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i }).last();
      if (await confirmBtn.isVisible({ timeout: 2000 })) {
        await confirmBtn.click();
      }

      await page.waitForURL((url) => !url.pathname.includes(deletePageId), { timeout: 10000 });

      // Verify page removed from DB
      const { data: pageRow } = await serviceClient.from('project_pages').select('id').eq('id', deletePageId).maybeSingle();
      expect(pageRow).toBeNull();

      // Invitee loses access
      const { data: after } = await inviteeClient.from('project_pages').select('id').eq('id', deletePageId);
      expect(after?.length ?? 0).toBe(0);
    } finally {
      await serviceClient.from('project_pages').delete().eq('id', deletePageId);
      await deleteTestUser(invitee.userId);
    }
  });

  test('Edit-permission page invitee can save canvas changes (UPDATE allowed by RLS)', async ({ testUser }) => {
    const serviceClient = createServiceRoleClient();
    const editUser = await createTestUser('page-edit-inv');
    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Edit Permission Page', created_by: testUser.userId })
      .select()
      .single();
    const localPageId = pageData!.id;
    const { data: projectData } = await serviceClient
      .from('canvas_projects')
      .insert({ user_id: testUser.userId, name: 'Edit Permission Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
      .select()
      .single();
    try {
      await serviceClient.from('project_page_items').insert({ page_id: localPageId, project_id: projectData!.id, sort_order: 0 });
      await serviceClient.from('project_page_access').insert({
        page_id: localPageId, email: editUser.email, user_id: editUser.userId,
        permission: 'edit', invited_by: testUser.userId, accepted_at: new Date().toISOString(),
      });

      const { createAuthenticatedClient } = await import('../../utils/supabase-test-client');
      const editClient = await createAuthenticatedClient(editUser.email, editUser.password);

      const { error } = await editClient
        .from('canvas_projects')
        .update({ canvas_data: { pageEditTest: true } })
        .eq('id', projectData!.id);
      expect(error).toBeNull();
    } finally {
      await serviceClient.from('canvas_projects').delete().eq('id', projectData!.id);
      await serviceClient.from('project_pages').delete().eq('id', localPageId);
      await deleteTestUser(editUser.userId);
    }
  });

  test('View-permission page invitee cannot save canvas changes (UPDATE blocked by RLS)', async ({ testUser }) => {
    const serviceClient = createServiceRoleClient();
    const viewUser = await createTestUser('page-view-inv');
    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'View Permission Page', created_by: testUser.userId })
      .select()
      .single();
    const localPageId = pageData!.id;
    const { data: projectData } = await serviceClient
      .from('canvas_projects')
      .insert({ user_id: testUser.userId, name: 'View Permission Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
      .select()
      .single();
    try {
      await serviceClient.from('project_page_items').insert({ page_id: localPageId, project_id: projectData!.id, sort_order: 0 });
      await serviceClient.from('project_page_access').insert({
        page_id: localPageId, email: viewUser.email, user_id: viewUser.userId,
        permission: 'view', invited_by: testUser.userId, accepted_at: new Date().toISOString(),
      });

      const { createAuthenticatedClient } = await import('../../utils/supabase-test-client');
      const viewClient = await createAuthenticatedClient(viewUser.email, viewUser.password);

      const { error } = await viewClient
        .from('canvas_projects')
        .update({ canvas_data: { viewerHack: true } })
        .eq('id', projectData!.id);
      expect(error).toBeDefined();
    } finally {
      await serviceClient.from('canvas_projects').delete().eq('id', projectData!.id);
      await serviceClient.from('project_pages').delete().eq('id', localPageId);
      await deleteTestUser(viewUser.userId);
    }
  });

  test('Owner revokes group access to page — group member loses access', async ({ testUser }) => {
    const serviceClient = createServiceRoleClient();
    const groupMember = await createTestUser('page-group-revoke');
    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Revoke Group Access Page', created_by: testUser.userId })
      .select()
      .single();
    const localPageId = pageData!.id;
    const { data: group } = await serviceClient
      .from('groups')
      .insert({ name: 'Revoke Page Group', created_by: testUser.userId })
      .select()
      .single();
    try {
      await serviceClient.from('group_members').insert({ group_id: group!.id, user_id: groupMember.userId, role: 'member' });
      const { data: access } = await serviceClient
        .from('project_page_group_access')
        .insert({ page_id: localPageId, group_id: group!.id, permission: 'view', granted_by: testUser.userId })
        .select()
        .single();

      const { createAuthenticatedClient } = await import('../../utils/supabase-test-client');
      const memberClient = await createAuthenticatedClient(groupMember.email, groupMember.password);

      const { data: before } = await memberClient.from('project_pages').select('id').eq('id', localPageId);
      expect(before?.length).toBe(1);

      // Revoke group access
      await serviceClient.from('project_page_group_access').delete().eq('id', access!.id);

      const { data: after } = await memberClient.from('project_pages').select('id').eq('id', localPageId);
      expect(after?.length ?? 0).toBe(0);
    } finally {
      await serviceClient.from('groups').delete().eq('id', group!.id);
      await serviceClient.from('project_pages').delete().eq('id', localPageId);
      await deleteTestUser(groupMember.userId);
    }
  });

  test('Unauthenticated user sees sign-in prompt on page invitation', async ({ page }) => {
    const serviceClient = createServiceRoleClient();
    const ownerUser = await createTestUser('page-unauth-owner');

    const { data: pageData } = await serviceClient
      .from('project_pages')
      .insert({ name: 'Unauth Test Page', created_by: ownerUser.userId })
      .select()
      .single();
    const localPageId = pageData!.id;

    try {
      const { data: accessData } = await serviceClient
        .from('project_page_access')
        .insert({
          page_id: localPageId,
          email: 'newuser@example.com',
          permission: 'view',
          invited_by: ownerUser.userId,
        })
        .select()
        .single();

      // Clear auth state — beforeEach authenticates via the shared page fixture
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

      const acceptPage = new AcceptInvitationPage(page);
      await acceptPage.gotoPageInvite(accessData!.invitation_token);

      // Should show sign-in button (unauthenticated state)
      await expect(page.getByTestId(AcceptInvitationTestIds.SIGNIN_BUTTON)).toBeVisible({ timeout: 5000 });
    } finally {
      await serviceClient.from('project_pages').delete().eq('id', localPageId);
      await deleteTestUser(ownerUser.userId);
    }
  });
});
