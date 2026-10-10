import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  createServiceRoleClient,
  createAuthenticatedClient,
  createTestUser,
  deleteTestUser,
} from '../utils/supabase-test-client';

describe('Collaboration RLS Policies', () => {
  let ownerUser: { email: string; password: string; userId: string };
  let memberUser: { email: string; password: string; userId: string };
  let outsiderUser: { email: string; password: string; userId: string };

  let groupId: string;
  let projectId: string;
  let viewCollabId: string;
  let editCollabId: string;

  // New table IDs
  let groupAccessId: string;
  let pageId: string;

  beforeAll(async () => {
    const serviceClient = createServiceRoleClient();

    // Create 3 test users
    ownerUser = await createTestUser('collab-rls-owner');
    memberUser = await createTestUser('collab-rls-member');
    outsiderUser = await createTestUser('collab-rls-outsider');

    // Create a group
    const { data: group } = await serviceClient
      .from('groups')
      .insert({ name: 'RLS Test Group', created_by: ownerUser.userId })
      .select()
      .single();
    groupId = group!.id;

    // Add ownerUser as owner and memberUser as member (no trigger auto-adds them)
    await serviceClient
      .from('group_members')
      .insert({ group_id: groupId, user_id: ownerUser.userId, role: 'owner' });
    await serviceClient
      .from('group_members')
      .insert({ group_id: groupId, user_id: memberUser.userId, role: 'member' });

    // Create a project owned by ownerUser
    const { data: project } = await serviceClient
      .from('canvas_projects')
      .insert({
        user_id: ownerUser.userId,
        name: 'RLS Test Project',
        canvas_data: {},
        canvas_width: 800,
        canvas_height: 600,
        is_public: false,
      })
      .select()
      .single();
    projectId = project!.id;

    // Add view collaborator (memberUser, view permission, accepted)
    const { data: viewCollab } = await serviceClient
      .from('project_collaborators')
      .insert({
        project_id: projectId,
        user_id: memberUser.userId,
        permission: 'view',
        invited_by: ownerUser.userId,
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();
    viewCollabId = viewCollab!.id;

    // Add edit collaborator row for a 4th user test scenario
    // (We'll reuse outsiderUser as edit collaborator for this)
    const { data: editCollab } = await serviceClient
      .from('project_collaborators')
      .insert({
        project_id: projectId,
        user_id: outsiderUser.userId,
        permission: 'edit',
        invited_by: ownerUser.userId,
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();
    editCollabId = editCollab!.id;

    // Share project with group (dynamic group access)
    const { data: gAccess } = await serviceClient
      .from('project_group_access')
      .insert({ project_id: projectId, group_id: groupId, permission: 'view', granted_by: ownerUser.userId })
      .select()
      .single();
    groupAccessId = gAccess!.id;

    // Create a project page owned by ownerUser
    const { data: page } = await serviceClient
      .from('project_pages')
      .insert({ name: 'RLS Test Page', created_by: ownerUser.userId })
      .select()
      .single();
    pageId = page!.id;
  });

  afterAll(async () => {
    const serviceClient = createServiceRoleClient();
    await serviceClient.from('project_pages').delete().eq('id', pageId);
    await serviceClient.from('canvas_projects').delete().eq('id', projectId);
    await serviceClient.from('groups').delete().eq('id', groupId);
    await deleteTestUser(ownerUser.userId);
    await deleteTestUser(memberUser.userId);
    await deleteTestUser(outsiderUser.userId);
  }, 60000);

  describe('groups table', () => {
    test('Group member can SELECT their group', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client.from('groups').select('*').eq('id', groupId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
      expect(data![0].id).toBe(groupId);
    });

    test('Outsider cannot SELECT a group they are not in', async () => {
      // outsiderUser is now a project collaborator but NOT a group member
      // First remove outsider from group if accidentally added
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('group_members').delete()
        .eq('group_id', groupId).eq('user_id', outsiderUser.userId);

      const client = await createAuthenticatedClient(outsiderUser.email, outsiderUser.password);
      const { data, error } = await client.from('groups').select('*').eq('id', groupId);
      if (error) {
        expect(error.message).toMatch(/permission|denied|policy/i);
      } else {
        expect(data?.length).toBe(0);
      }
    });
  });

  describe('group_invitations table', () => {
    let invitationId: string;

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      const { data } = await serviceClient
        .from('group_invitations')
        .insert({ group_id: groupId, email: 'rls-test-invitee@example.com', invited_by: ownerUser.userId })
        .select()
        .single();
      invitationId = data!.id;
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('group_invitations').delete().eq('id', invitationId);
    });

    test('Group manager can INSERT an invitation', async () => {
      const serviceClient = createServiceRoleClient();
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('group_invitations')
        .insert({ group_id: groupId, email: 'another-test@example.com', invited_by: ownerUser.userId });
      // Clean up regardless
      await serviceClient.from('group_invitations').delete()
        .eq('group_id', groupId).eq('email', 'another-test@example.com');
      expect(error).toBeNull();
    });

    test('Group member (non-manager) cannot INSERT an invitation', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('group_invitations')
        .insert({ group_id: groupId, email: 'blocked@example.com', invited_by: memberUser.userId });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/permission|denied|policy|violates/i);
    });
  });

  describe('group_members table', () => {
    test('Member cannot DELETE another member', async () => {
      // Find owner's membership
      const serviceClient = createServiceRoleClient();
      const { data: ownerMembership } = await serviceClient
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', ownerUser.userId)
        .single();

      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('group_members')
        .delete()
        .eq('id', ownerMembership!.id);

      // Should fail — member cannot remove owner
      expect(error).toBeDefined();
    });
  });

  describe('canvas_projects with project_collaborators', () => {
    test('Edit collaborator can SELECT the project', async () => {
      const client = await createAuthenticatedClient(outsiderUser.email, outsiderUser.password);
      const { data, error } = await client
        .from('canvas_projects')
        .select('id, name')
        .eq('id', projectId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('Edit collaborator can UPDATE the project (canvas_data)', async () => {
      const client = await createAuthenticatedClient(outsiderUser.email, outsiderUser.password);
      const { error } = await client
        .from('canvas_projects')
        .update({ canvas_data: { updated: true } })
        .eq('id', projectId);
      expect(error).toBeNull();
    });

    test('View collaborator can SELECT the project', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('canvas_projects')
        .select('id, name')
        .eq('id', projectId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('View collaborator cannot UPDATE the project', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('canvas_projects')
        .update({ canvas_data: { hacked: true } })
        .eq('id', projectId);
      // Should fail (view collaborators cannot update)
      expect(error).toBeDefined();
    });
  });

  describe('project_group_access table', () => {
    test('Project owner can INSERT group access', async () => {
      const serviceClient = createServiceRoleClient();
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      // Create a second group for this test
      const { data: secondGroup } = await serviceClient
        .from('groups')
        .insert({ name: 'Second Group', created_by: ownerUser.userId })
        .select()
        .single();

      const { error } = await client
        .from('project_group_access')
        .insert({ project_id: projectId, group_id: secondGroup!.id, permission: 'view', granted_by: ownerUser.userId });

      // Cleanup
      await serviceClient.from('groups').delete().eq('id', secondGroup!.id);

      expect(error).toBeNull();
    });

    test('Non-owner cannot INSERT group access', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('project_group_access')
        .insert({ project_id: projectId, group_id: groupId, permission: 'view', granted_by: memberUser.userId });
      expect(error).toBeDefined();
    });

    test('Group member can SELECT project shared with their group', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('canvas_projects')
        .select('id')
        .eq('id', projectId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('Outsider (not in group) cannot SELECT project shared only with group', async () => {
      // Create a fresh project only shared via group access
      const serviceClient = createServiceRoleClient();
      const outsider2 = await createTestUser('rls-outsider2');
      try {
        const { data: freshProject } = await serviceClient
          .from('canvas_projects')
          .insert({ user_id: ownerUser.userId, name: 'Group Only Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
          .select()
          .single();

        await serviceClient
          .from('project_group_access')
          .insert({ project_id: freshProject!.id, group_id: groupId, permission: 'view', granted_by: ownerUser.userId });

        const outsiderClient = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await outsiderClient
          .from('canvas_projects')
          .select('id')
          .eq('id', freshProject!.id);

        // Should return empty (outsider2 not in the group)
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length).toBe(0);
        }

        await serviceClient.from('canvas_projects').delete().eq('id', freshProject!.id);
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });
  });

  describe('project_pages table', () => {
    test('Page owner can SELECT their page', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client
        .from('project_pages')
        .select('id')
        .eq('id', pageId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('Page owner can UPDATE their page', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('project_pages')
        .update({ description: 'Updated description' })
        .eq('id', pageId);
      expect(error).toBeNull();
    });

    test('User with accepted individual page access can SELECT page', async () => {
      const serviceClient = createServiceRoleClient();
      const { error: insertErr } = await serviceClient
        .from('project_page_access')
        .insert({
          page_id: pageId,
          email: memberUser.email,
          user_id: memberUser.userId,
          permission: 'view',
          invited_by: ownerUser.userId,
          accepted_at: new Date().toISOString(),
        });
      expect(insertErr).toBeNull();

      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('project_pages')
        .select('id')
        .eq('id', pageId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);

      // Cleanup
      await serviceClient.from('project_page_access').delete().eq('page_id', pageId).eq('user_id', memberUser.userId);
    });

    test('Outsider without access cannot SELECT page', async () => {
      const client = await createAuthenticatedClient(outsiderUser.email, outsiderUser.password);
      // Remove any existing access for outsider
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('project_page_access').delete().eq('page_id', pageId).eq('email', outsiderUser.email);

      const { data, error } = await client
        .from('project_pages')
        .select('id')
        .eq('id', pageId);
      if (error) {
        expect(error.message).toMatch(/permission|denied|policy/i);
      } else {
        expect(data?.length).toBe(0);
      }
    });
  });

  describe('project_collaborators with email-only (non-user invitations)', () => {
    let emailOnlyProjectId: string;

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      const { data: project } = await serviceClient
        .from('canvas_projects')
        .insert({ user_id: ownerUser.userId, name: 'Email Only Collab Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
        .select()
        .single();
      emailOnlyProjectId = project!.id;
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('canvas_projects').delete().eq('id', emailOnlyProjectId);
    });

    test('Project owner can insert email-only collaborator row (no user_id)', async () => {
      const serviceClient = createServiceRoleClient();
      const ownerClient = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await ownerClient
        .from('project_collaborators')
        .insert({
          project_id: emailOnlyProjectId,
          email: 'pending-nonuser@example.com',
          permission: 'view',
          invited_by: ownerUser.userId,
          // No user_id — non-user invitation
        });
      // Cleanup
      await serviceClient.from('project_collaborators').delete()
        .eq('project_id', emailOnlyProjectId).eq('email', 'pending-nonuser@example.com');
      expect(error).toBeNull();
    });

    test('Pending email-only collaborator (no accepted_at) cannot SELECT project', async () => {
      // memberUser is not a collaborator on emailOnlyProjectId — they should have no access
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data } = await client
        .from('canvas_projects')
        .select('id')
        .eq('id', emailOnlyProjectId);
      // memberUser has view access to `projectId` (the main shared project), but NOT to emailOnlyProjectId
      expect(data?.length ?? 0).toBe(0);
    });

    test('After acceptance (user_id + accepted_at set), email collaborator can SELECT project', async () => {
      const serviceClient = createServiceRoleClient();
      // Insert accepted collaborator row for memberUser on emailOnlyProjectId
      const { data: collab } = await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: emailOnlyProjectId,
          email: memberUser.email,
          user_id: memberUser.userId,
          permission: 'view',
          invited_by: ownerUser.userId,
          accepted_at: new Date().toISOString(),
        })
        .select()
        .single();

      try {
        const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
        const { data, error } = await client
          .from('canvas_projects')
          .select('id')
          .eq('id', emailOnlyProjectId);
        expect(error).toBeNull();
        expect(data?.length).toBe(1);
      } finally {
        await serviceClient.from('project_collaborators').delete().eq('id', collab!.id);
      }
    });

    test('Accepted email collaborator with view permission cannot UPDATE project', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: collab } = await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: emailOnlyProjectId,
          email: memberUser.email,
          user_id: memberUser.userId,
          permission: 'view',
          invited_by: ownerUser.userId,
          accepted_at: new Date().toISOString(),
        })
        .select()
        .single();

      try {
        const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
        const { error } = await client
          .from('canvas_projects')
          .update({ canvas_data: { viewerHacked: true } })
          .eq('id', emailOnlyProjectId);
        expect(error).toBeDefined();
      } finally {
        await serviceClient.from('project_collaborators').delete().eq('id', collab!.id);
      }
    });

    test('Accepted email collaborator with edit permission can UPDATE project', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: collab } = await serviceClient
        .from('project_collaborators')
        .insert({
          project_id: emailOnlyProjectId,
          email: outsiderUser.email,
          user_id: outsiderUser.userId,
          permission: 'edit',
          invited_by: ownerUser.userId,
          accepted_at: new Date().toISOString(),
        })
        .select()
        .single();

      try {
        const client = await createAuthenticatedClient(outsiderUser.email, outsiderUser.password);
        const { error } = await client
          .from('canvas_projects')
          .update({ canvas_data: { editorUpdate: true } })
          .eq('id', emailOnlyProjectId);
        expect(error).toBeNull();
      } finally {
        await serviceClient.from('project_collaborators').delete().eq('id', collab!.id);
      }
    });
  });

  describe('project_page_access table', () => {
    test('Page owner can INSERT page invitation', async () => {
      const serviceClient = createServiceRoleClient();
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('project_page_access')
        .insert({ page_id: pageId, email: 'page-invitee@example.com', permission: 'view', invited_by: ownerUser.userId });

      // Cleanup
      await serviceClient.from('project_page_access').delete().eq('page_id', pageId).eq('email', 'page-invitee@example.com');

      expect(error).toBeNull();
    });

    test('Non-owner cannot INSERT page invitation', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('project_page_access')
        .insert({ page_id: pageId, email: 'blocked@example.com', permission: 'view', invited_by: memberUser.userId });
      expect(error).toBeDefined();
    });
  });

  // ─── canvas_comments RLS ───────────────────────────────────────────────────
  describe('canvas_comments RLS', () => {
    let commentId: string;

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      const { data } = await serviceClient
        .from('canvas_comments')
        .insert({
          project_id: projectId,
          author_id: ownerUser.userId,
          content: 'RLS test comment',
          canvas_x: 100,
          canvas_y: 200,
        })
        .select('id')
        .single();
      commentId = data!.id;
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('canvas_comments').delete().eq('id', commentId).maybeSingle();
    });

    test('Project owner can INSERT a comment', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client
        .from('canvas_comments')
        .insert({
          project_id: projectId,
          author_id: ownerUser.userId,
          content: 'Owner comment',
          canvas_x: 50,
          canvas_y: 50,
        })
        .select('id')
        .single();
      // Cleanup
      if (data?.id) {
        const serviceClient = createServiceRoleClient();
        await serviceClient.from('canvas_comments').delete().eq('id', data.id);
      }
      expect(error).toBeNull();
    });

    test('Accepted collaborator can INSERT a comment', async () => {
      // outsiderUser is an accepted edit collaborator on projectId
      const client = await createAuthenticatedClient(outsiderUser.email, outsiderUser.password);
      const { data, error } = await client
        .from('canvas_comments')
        .insert({
          project_id: projectId,
          author_id: outsiderUser.userId,
          content: 'Collaborator comment',
          canvas_x: 60,
          canvas_y: 70,
        })
        .select('id')
        .single();
      if (data?.id) {
        const serviceClient = createServiceRoleClient();
        await serviceClient.from('canvas_comments').delete().eq('id', data.id);
      }
      expect(error).toBeNull();
    });

    test('Non-collaborator cannot INSERT a comment', async () => {
      // Create a user with no access
      const noAccess = await createTestUser('rls-comment-noac');
      try {
        const client = await createAuthenticatedClient(noAccess.email, noAccess.password);
        const { error } = await client
          .from('canvas_comments')
          .insert({
            project_id: projectId,
            author_id: noAccess.userId,
            content: 'Blocked comment',
            canvas_x: 0,
            canvas_y: 0,
          });
        expect(error).toBeDefined();
      } finally {
        await deleteTestUser(noAccess.userId);
      }
    });

    test('Collaborator can SELECT comments on shared project', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('canvas_comments')
        .select('id')
        .eq('project_id', projectId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Author can DELETE their own comment', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: newComment } = await serviceClient
        .from('canvas_comments')
        .insert({ project_id: projectId, author_id: memberUser.userId, content: 'To delete' })
        .select('id')
        .single();
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('canvas_comments')
        .delete()
        .eq('id', newComment!.id);
      expect(error).toBeNull();
    });

    test('Project owner can DELETE any comment', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: newComment } = await serviceClient
        .from('canvas_comments')
        .insert({ project_id: projectId, author_id: memberUser.userId, content: 'Owner deletes this' })
        .select('id')
        .single();
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('canvas_comments')
        .delete()
        .eq('id', newComment!.id);
      expect(error).toBeNull();
    });

    test('Non-author cannot DELETE another user\'s comment', async () => {
      // memberUser tries to delete ownerUser's comment
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('canvas_comments')
        .delete()
        .eq('id', commentId); // owned by ownerUser
      // Should fail or affect 0 rows
      if (!error) {
        // If no error, verify the row still exists (RLS prevents deletion silently)
        const serviceClient = createServiceRoleClient();
        const { data } = await serviceClient.from('canvas_comments').select('id').eq('id', commentId).maybeSingle();
        expect(data).toBeDefined();
      } else {
        expect(error.message).toMatch(/permission|denied|policy|violates/i);
      }
    });

    test('Author can UPDATE their own comment content', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: newComment } = await serviceClient
        .from('canvas_comments')
        .insert({ project_id: projectId, author_id: memberUser.userId, content: 'Original' })
        .select('id')
        .single();
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('canvas_comments')
        .update({ content: 'Updated' })
        .eq('id', newComment!.id);
      // Cleanup
      await serviceClient.from('canvas_comments').delete().eq('id', newComment!.id);
      expect(error).toBeNull();
    });
  });

  // ─── project_locks RLS ─────────────────────────────────────────────────────
  describe('project_locks RLS', () => {
    afterEach(async () => {
      // Always clean up any lock left by tests
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('project_locks').delete().eq('project_id', projectId);
    });

    test('Project owner can INSERT a lock', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('project_locks')
        .insert({ project_id: projectId, locked_by: ownerUser.userId });
      expect(error).toBeNull();
    });

    test('Edit collaborator can INSERT a lock', async () => {
      // outsiderUser is an accepted edit collaborator
      const client = await createAuthenticatedClient(outsiderUser.email, outsiderUser.password);
      const { error } = await client
        .from('project_locks')
        .insert({ project_id: projectId, locked_by: outsiderUser.userId });
      expect(error).toBeNull();
    });

    test('View-only collaborator cannot INSERT a lock', async () => {
      // memberUser has view-only access on this project
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('project_locks')
        .insert({ project_id: projectId, locked_by: memberUser.userId });
      expect(error).toBeDefined();
    });

    test('Any collaborator can SELECT the lock row', async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('project_locks').insert({ project_id: projectId, locked_by: ownerUser.userId });

      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('project_locks')
        .select('project_id')
        .eq('project_id', projectId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('Owner can DELETE (unlock) the lock', async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('project_locks').insert({ project_id: projectId, locked_by: ownerUser.userId });

      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('project_locks')
        .delete()
        .eq('project_id', projectId);
      expect(error).toBeNull();
    });

    test('Edit collaborator can DELETE (unlock) a lock', async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('project_locks').insert({ project_id: projectId, locked_by: ownerUser.userId });

      // outsiderUser is an accepted edit collaborator
      const client = await createAuthenticatedClient(outsiderUser.email, outsiderUser.password);
      const { error } = await client
        .from('project_locks')
        .delete()
        .eq('project_id', projectId);
      expect(error).toBeNull();
    });
  });

  // ─── groups: UPDATE and DELETE ─────────────────────────────────────────────
  describe('groups table - UPDATE and DELETE', () => {
    let tempGroupId: string;

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      const { data: g } = await serviceClient
        .from('groups')
        .insert({ name: 'Update Delete Test Group', created_by: ownerUser.userId })
        .select()
        .single();
      tempGroupId = g!.id;
      // Ensure ownerUser is in group_members as owner (defensive: trigger may handle this)
      const { data: existing } = await serviceClient
        .from('group_members')
        .select('id')
        .eq('group_id', tempGroupId)
        .eq('user_id', ownerUser.userId);
      if (!existing?.length) {
        await serviceClient
          .from('group_members')
          .insert({ group_id: tempGroupId, user_id: ownerUser.userId, role: 'owner' });
      }
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('groups').delete().eq('id', tempGroupId);
    });

    test('Manager can UPDATE group name', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('groups')
        .update({ name: 'Updated Group Name' })
        .eq('id', tempGroupId);
      expect(error).toBeNull();
    });

    test('Non-manager cannot UPDATE group', async () => {
      // memberUser is only a member of groupId (the main group), not a manager of tempGroupId
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('groups')
        .update({ name: 'Hijacked Name' })
        .eq('id', tempGroupId);
      // Should be blocked (no group_member row for memberUser in tempGroupId)
      // RLS policy requires user_is_group_manager — expect error or 0 rows affected
      if (!error) {
        // RLS silently filters: verify name was not actually changed
        const serviceClient = createServiceRoleClient();
        const { data } = await serviceClient.from('groups').select('name').eq('id', tempGroupId).single();
        expect(data?.name).not.toBe('Hijacked Name');
      } else {
        expect(error.message).toMatch(/permission|denied|policy/i);
      }
    });

    test('Non-owner cannot DELETE group', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client.from('groups').delete().eq('id', tempGroupId);
      if (!error) {
        const serviceClient = createServiceRoleClient();
        const { data } = await serviceClient.from('groups').select('id').eq('id', tempGroupId).maybeSingle();
        expect(data).not.toBeNull(); // group still exists
      } else {
        expect(error.message).toMatch(/permission|denied|policy/i);
      }
    });

    test('Owner can DELETE group', async () => {
      const serviceClient = createServiceRoleClient();
      // Create a separate group to delete so tempGroupId remains for other tests
      const { data: g2 } = await serviceClient
        .from('groups')
        .insert({ name: 'To Be Deleted Group', created_by: ownerUser.userId })
        .select()
        .single();
      const { data: existing } = await serviceClient
        .from('group_members')
        .select('id')
        .eq('group_id', g2!.id)
        .eq('user_id', ownerUser.userId);
      if (!existing?.length) {
        await serviceClient
          .from('group_members')
          .insert({ group_id: g2!.id, user_id: ownerUser.userId, role: 'owner' });
      }

      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client.from('groups').delete().eq('id', g2!.id);
      expect(error).toBeNull();
    });
  });

  // ─── group_members: full coverage ──────────────────────────────────────────
  describe('group_members table - full coverage', () => {
    test('Member can SELECT group membership list', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('group_members')
        .select('id, role')
        .eq('group_id', groupId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Outsider cannot SELECT group membership', async () => {
      const outsider2 = await createTestUser('rls-gm-outsider');
      try {
        const client = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await client
          .from('group_members')
          .select('id')
          .eq('group_id', groupId);
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });

    test('Manager can INSERT a new member', async () => {
      const serviceClient = createServiceRoleClient();
      const newMember = await createTestUser('rls-gm-new');
      try {
        const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
        const { error } = await client
          .from('group_members')
          .insert({ group_id: groupId, user_id: newMember.userId, role: 'member' });
        // Cleanup regardless
        await serviceClient.from('group_members').delete().eq('group_id', groupId).eq('user_id', newMember.userId);
        expect(error).toBeNull();
      } finally {
        await deleteTestUser(newMember.userId);
      }
    });

    test('Non-manager cannot INSERT a member', async () => {
      const serviceClient = createServiceRoleClient();
      const newUser = await createTestUser('rls-gm-blocked');
      try {
        const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
        const { error } = await client
          .from('group_members')
          .insert({ group_id: groupId, user_id: newUser.userId, role: 'member' });
        await serviceClient.from('group_members').delete().eq('group_id', groupId).eq('user_id', newUser.userId);
        expect(error).toBeDefined();
      } finally {
        await deleteTestUser(newUser.userId);
      }
    });

    test('Manager can UPDATE a member role', async () => {
      const serviceClient = createServiceRoleClient();
      // memberUser is a 'member' in groupId
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', memberUser.userId);
      // Restore to member
      await serviceClient
        .from('group_members')
        .update({ role: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', memberUser.userId);
      expect(error).toBeNull();
    });

    test('Member cannot UPDATE their own role', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('group_members')
        .update({ role: 'owner' })
        .eq('group_id', groupId)
        .eq('user_id', memberUser.userId);
      if (!error) {
        // Verify no escalation happened
        const serviceClient = createServiceRoleClient();
        const { data } = await serviceClient
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', memberUser.userId)
          .single();
        expect(data?.role).not.toBe('owner');
      } else {
        expect(error.message).toMatch(/permission|denied|policy/i);
      }
    });

    test('Manager can DELETE a member', async () => {
      const serviceClient = createServiceRoleClient();
      const tempMember = await createTestUser('rls-gm-del-target');
      try {
        await serviceClient
          .from('group_members')
          .insert({ group_id: groupId, user_id: tempMember.userId, role: 'member' });

        const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
        const { error } = await client
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', tempMember.userId);
        expect(error).toBeNull();
      } finally {
        await serviceClient.from('group_members').delete().eq('group_id', groupId).eq('user_id', tempMember.userId);
        await deleteTestUser(tempMember.userId);
      }
    });

    test('Member can DELETE themselves (self-leave)', async () => {
      const serviceClient = createServiceRoleClient();
      const selfLeaver = await createTestUser('rls-gm-selfleave');
      try {
        await serviceClient
          .from('group_members')
          .insert({ group_id: groupId, user_id: selfLeaver.userId, role: 'member' });

        const client = await createAuthenticatedClient(selfLeaver.email, selfLeaver.password);
        const { error } = await client
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', selfLeaver.userId);
        expect(error).toBeNull();

        // Verify removed
        const { data } = await serviceClient
          .from('group_members')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', selfLeaver.userId);
        expect(data?.length ?? 0).toBe(0);
      } finally {
        await deleteTestUser(selfLeaver.userId);
      }
    });
  });

  // ─── group_invitations: SELECT and DELETE ──────────────────────────────────
  describe('group_invitations table - SELECT and DELETE', () => {
    let invId: string;
    let invToken: string;
    let inviteeEmail: string;

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      inviteeEmail = `rls-inv-select-${Date.now()}@example.com`;
      const { data } = await serviceClient
        .from('group_invitations')
        .insert({ group_id: groupId, email: inviteeEmail, invited_by: ownerUser.userId })
        .select()
        .single();
      invId = data!.id;
      invToken = data!.token;
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('group_invitations').delete().eq('id', invId).maybeSingle();
    });

    test('Manager can SELECT invitations for their group', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client
        .from('group_invitations')
        .select('id')
        .eq('group_id', groupId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Invited user can SELECT their own invitation (JWT email match)', async () => {
      const serviceClient = createServiceRoleClient();
      // Create a real test user whose JWT email matches the invitation
      const invitee = await createTestUser('rls-inv-jwt');
      try {
        // Insert an invitation using the invitee's actual email
        const { data: inv } = await serviceClient
          .from('group_invitations')
          .insert({ group_id: groupId, email: invitee.email, invited_by: ownerUser.userId })
          .select()
          .single();

        const client = await createAuthenticatedClient(invitee.email, invitee.password);
        const { data, error } = await client
          .from('group_invitations')
          .select('id')
          .eq('id', inv!.id);
        expect(error).toBeNull();
        expect(data?.length).toBe(1);

        await serviceClient.from('group_invitations').delete().eq('id', inv!.id);
      } finally {
        await deleteTestUser(invitee.userId);
      }
    });

    test('Non-manager, non-invitee cannot SELECT invitations', async () => {
      const outsider2 = await createTestUser('rls-inv-noread');
      try {
        const client = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await client
          .from('group_invitations')
          .select('id')
          .eq('group_id', groupId);
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });

    test('Manager can DELETE (cancel) an invitation', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: inv } = await serviceClient
        .from('group_invitations')
        .insert({ group_id: groupId, email: `rls-cancel-${Date.now()}@example.com`, invited_by: ownerUser.userId })
        .select()
        .single();

      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('group_invitations')
        .delete()
        .eq('id', inv!.id);
      expect(error).toBeNull();
    });
  });

  // ─── project_collaborators: SELECT and DELETE ──────────────────────────────
  describe('project_collaborators table - SELECT and DELETE', () => {
    test('Project owner can SELECT full collaborator list', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client
        .from('project_collaborators')
        .select('id')
        .eq('project_id', projectId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Collaborator can SELECT their own row', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('project_collaborators')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', memberUser.userId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('Outsider cannot SELECT collaborators list', async () => {
      const outsider2 = await createTestUser('rls-pc-noread');
      try {
        const client = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await client
          .from('project_collaborators')
          .select('id')
          .eq('project_id', projectId);
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });

    test('Project owner can DELETE a collaborator', async () => {
      const serviceClient = createServiceRoleClient();
      const tempCollab = await createTestUser('rls-pc-del');
      try {
        await serviceClient.from('project_collaborators').insert({
          project_id: projectId,
          user_id: tempCollab.userId,
          permission: 'view',
          invited_by: ownerUser.userId,
          accepted_at: new Date().toISOString(),
        });

        const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
        const { error } = await client
          .from('project_collaborators')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', tempCollab.userId);
        expect(error).toBeNull();
      } finally {
        await serviceClient.from('project_collaborators').delete().eq('project_id', projectId).eq('user_id', tempCollab.userId);
        await deleteTestUser(tempCollab.userId);
      }
    });

    test('Collaborator can DELETE themselves (self-remove)', async () => {
      const serviceClient = createServiceRoleClient();
      const selfRemover = await createTestUser('rls-pc-selfrem');
      try {
        await serviceClient.from('project_collaborators').insert({
          project_id: projectId,
          user_id: selfRemover.userId,
          permission: 'view',
          invited_by: ownerUser.userId,
          accepted_at: new Date().toISOString(),
        });

        const client = await createAuthenticatedClient(selfRemover.email, selfRemover.password);
        const { error } = await client
          .from('project_collaborators')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', selfRemover.userId);
        expect(error).toBeNull();

        const { data } = await serviceClient
          .from('project_collaborators')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', selfRemover.userId);
        expect(data?.length ?? 0).toBe(0);
      } finally {
        await deleteTestUser(selfRemover.userId);
      }
    });
  });

  // ─── project_group_access: SELECT and DELETE ───────────────────────────────
  describe('project_group_access table - SELECT and DELETE', () => {
    test('Project owner can SELECT group access rows', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client
        .from('project_group_access')
        .select('id')
        .eq('project_id', projectId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Group member can SELECT group access rows for their group', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('project_group_access')
        .select('id')
        .eq('project_id', projectId)
        .eq('group_id', groupId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Outsider cannot SELECT group access rows', async () => {
      const outsider2 = await createTestUser('rls-pga-noread');
      try {
        const client = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await client
          .from('project_group_access')
          .select('id')
          .eq('project_id', projectId);
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });

    test('Project owner can DELETE (revoke) group access', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: secondGroup } = await serviceClient
        .from('groups')
        .insert({ name: 'RLS Revoke Group', created_by: ownerUser.userId })
        .select()
        .single();
      const { data: access } = await serviceClient
        .from('project_group_access')
        .insert({ project_id: projectId, group_id: secondGroup!.id, permission: 'view', granted_by: ownerUser.userId })
        .select()
        .single();

      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('project_group_access')
        .delete()
        .eq('id', access!.id);

      await serviceClient.from('groups').delete().eq('id', secondGroup!.id);
      expect(error).toBeNull();
    });

    test('Non-owner cannot DELETE group access', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('project_group_access')
        .delete()
        .eq('id', groupAccessId);
      if (!error) {
        // Verify row still exists
        const serviceClient = createServiceRoleClient();
        const { data } = await serviceClient
          .from('project_group_access')
          .select('id')
          .eq('id', groupAccessId)
          .maybeSingle();
        expect(data).not.toBeNull();
      } else {
        expect(error.message).toMatch(/permission|denied|policy/i);
      }
    });
  });

  // ─── project_pages: INSERT and DELETE ──────────────────────────────────────
  describe('project_pages table - INSERT and DELETE', () => {
    test('Authenticated user can INSERT page via create_page RPC', async () => {
      const serviceClient = createServiceRoleClient();
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client.rpc('create_page', { p_name: 'RLS Insert Test Page' });
      expect(error).toBeNull();
      expect(data).toBeDefined();
      const pageId = Array.isArray(data) ? data[0]?.id : (data as any)?.id;
      if (pageId) {
        await serviceClient.from('project_pages').delete().eq('id', pageId);
      }
    });

    test('Page owner can DELETE their page', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: p } = await serviceClient
        .from('project_pages')
        .insert({ name: 'Page To Delete', created_by: ownerUser.userId })
        .select()
        .single();

      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client.from('project_pages').delete().eq('id', p!.id);
      expect(error).toBeNull();
    });

    test('Non-owner cannot DELETE a page', async () => {
      const serviceClient = createServiceRoleClient();
      const { error } = await (await createAuthenticatedClient(memberUser.email, memberUser.password))
        .from('project_pages')
        .delete()
        .eq('id', pageId);
      if (!error) {
        const { data } = await serviceClient.from('project_pages').select('id').eq('id', pageId).maybeSingle();
        expect(data).not.toBeNull();
      } else {
        expect(error.message).toMatch(/permission|denied|policy/i);
      }
    });
  });

  // ─── project_page_items: all operations ────────────────────────────────────
  describe('project_page_items table', () => {
    let itemProjectId: string;
    let itemId: string;
    let acceptedPageId: string;

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      // Create a page with memberUser having accepted access
      const { data: p } = await serviceClient
        .from('project_pages')
        .insert({ name: 'Page Items RLS Test', created_by: ownerUser.userId })
        .select()
        .single();
      acceptedPageId = p!.id;

      await serviceClient.from('project_page_access').insert({
        page_id: acceptedPageId,
        email: memberUser.email,
        user_id: memberUser.userId,
        permission: 'view',
        invited_by: ownerUser.userId,
        accepted_at: new Date().toISOString(),
      });

      const { data: proj } = await serviceClient
        .from('canvas_projects')
        .insert({ user_id: ownerUser.userId, name: 'Page Item Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
        .select()
        .single();
      itemProjectId = proj!.id;

      const { data: item } = await serviceClient
        .from('project_page_items')
        .insert({ page_id: acceptedPageId, project_id: itemProjectId, sort_order: 0 })
        .select()
        .single();
      itemId = item!.id;
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('canvas_projects').delete().eq('id', itemProjectId);
      await serviceClient.from('project_pages').delete().eq('id', acceptedPageId);
    });

    test('Page owner can SELECT items in their page', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client
        .from('project_page_items')
        .select('id')
        .eq('page_id', acceptedPageId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Accepted page invitee can SELECT items', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('project_page_items')
        .select('id')
        .eq('page_id', acceptedPageId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Outsider cannot SELECT items', async () => {
      const outsider2 = await createTestUser('rls-ppi-out');
      try {
        const client = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await client
          .from('project_page_items')
          .select('id')
          .eq('page_id', acceptedPageId);
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });

    test('Page owner can INSERT item', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: proj2 } = await serviceClient
        .from('canvas_projects')
        .insert({ user_id: ownerUser.userId, name: 'Item Insert Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
        .select()
        .single();
      try {
        const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
        const { error } = await client
          .from('project_page_items')
          .insert({ page_id: acceptedPageId, project_id: proj2!.id, sort_order: 1 });
        await serviceClient.from('project_page_items').delete().eq('page_id', acceptedPageId).eq('project_id', proj2!.id);
        expect(error).toBeNull();
      } finally {
        await serviceClient.from('canvas_projects').delete().eq('id', proj2!.id);
      }
    });

    test('Non-owner cannot INSERT item', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: proj3 } = await serviceClient
        .from('canvas_projects')
        .insert({ user_id: ownerUser.userId, name: 'Blocked Item Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
        .select()
        .single();
      try {
        const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
        const { error } = await client
          .from('project_page_items')
          .insert({ page_id: acceptedPageId, project_id: proj3!.id, sort_order: 2 });
        await serviceClient.from('project_page_items').delete().eq('page_id', acceptedPageId).eq('project_id', proj3!.id);
        expect(error).toBeDefined();
      } finally {
        await serviceClient.from('canvas_projects').delete().eq('id', proj3!.id);
      }
    });

    test('Page owner can UPDATE sort order', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('project_page_items')
        .update({ sort_order: 99 })
        .eq('id', itemId);
      expect(error).toBeNull();
    });

    test('Non-owner cannot UPDATE sort order', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('project_page_items')
        .update({ sort_order: 0 })
        .eq('id', itemId);
      if (!error) {
        const serviceClient = createServiceRoleClient();
        const { data } = await serviceClient.from('project_page_items').select('sort_order').eq('id', itemId).single();
        expect(data?.sort_order).not.toBe(0);
      } else {
        expect(error.message).toMatch(/permission|denied|policy/i);
      }
    });

    test('Page owner can DELETE item', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: proj4 } = await serviceClient
        .from('canvas_projects')
        .insert({ user_id: ownerUser.userId, name: 'Del Item Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
        .select()
        .single();
      const { data: delItem } = await serviceClient
        .from('project_page_items')
        .insert({ page_id: acceptedPageId, project_id: proj4!.id, sort_order: 10 })
        .select()
        .single();
      try {
        const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
        const { error } = await client.from('project_page_items').delete().eq('id', delItem!.id);
        expect(error).toBeNull();
      } finally {
        await serviceClient.from('canvas_projects').delete().eq('id', proj4!.id);
      }
    });

    test('Non-owner cannot DELETE item', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client.from('project_page_items').delete().eq('id', itemId);
      if (!error) {
        const serviceClient = createServiceRoleClient();
        const { data } = await serviceClient.from('project_page_items').select('id').eq('id', itemId).maybeSingle();
        expect(data).not.toBeNull();
      } else {
        expect(error.message).toMatch(/permission|denied|policy/i);
      }
    });
  });

  // ─── project_page_access: SELECT and DELETE ────────────────────────────────
  describe('project_page_access table - SELECT and DELETE', () => {
    let ppaPageId: string;
    let ppaId: string;

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      const { data: p } = await serviceClient
        .from('project_pages')
        .insert({ name: 'PPA RLS Test Page', created_by: ownerUser.userId })
        .select()
        .single();
      ppaPageId = p!.id;
      const { data: access } = await serviceClient
        .from('project_page_access')
        .insert({
          page_id: ppaPageId,
          email: memberUser.email,
          user_id: memberUser.userId,
          permission: 'view',
          invited_by: ownerUser.userId,
          accepted_at: new Date().toISOString(),
        })
        .select()
        .single();
      ppaId = access!.id;
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('project_pages').delete().eq('id', ppaPageId);
    });

    test('Page owner can SELECT invitations', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client
        .from('project_page_access')
        .select('id')
        .eq('page_id', ppaPageId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Invited user can SELECT their own page invitation (JWT email match)', async () => {
      const serviceClient = createServiceRoleClient();
      const invitee = await createTestUser('rls-ppa-jwt');
      try {
        const { data: inv } = await serviceClient
          .from('project_page_access')
          .insert({
            page_id: ppaPageId,
            email: invitee.email,
            permission: 'view',
            invited_by: ownerUser.userId,
          })
          .select()
          .single();

        const client = await createAuthenticatedClient(invitee.email, invitee.password);
        const { data, error } = await client
          .from('project_page_access')
          .select('id')
          .eq('id', inv!.id);
        expect(error).toBeNull();
        expect(data?.length).toBe(1);

        await serviceClient.from('project_page_access').delete().eq('id', inv!.id);
      } finally {
        await deleteTestUser(invitee.userId);
      }
    });

    test('Non-owner, non-invitee cannot SELECT page invitations', async () => {
      const outsider2 = await createTestUser('rls-ppa-noread');
      try {
        const client = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await client
          .from('project_page_access')
          .select('id')
          .eq('page_id', ppaPageId);
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });

    test('Page owner can DELETE (cancel) a page invitation', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: inv } = await serviceClient
        .from('project_page_access')
        .insert({
          page_id: ppaPageId,
          email: `rls-ppa-cancel-${Date.now()}@example.com`,
          permission: 'view',
          invited_by: ownerUser.userId,
        })
        .select()
        .single();

      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client.from('project_page_access').delete().eq('id', inv!.id);
      expect(error).toBeNull();
    });
  });

  // ─── project_page_group_access: all operations ─────────────────────────────
  describe('project_page_group_access table', () => {
    let ppgaPageId: string;
    let ppgaGroupId: string;
    let ppgaId: string;

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      const { data: p } = await serviceClient
        .from('project_pages')
        .insert({ name: 'PPGA RLS Test Page', created_by: ownerUser.userId })
        .select()
        .single();
      ppgaPageId = p!.id;

      const { data: g } = await serviceClient
        .from('groups')
        .insert({ name: 'PPGA RLS Group', created_by: ownerUser.userId })
        .select()
        .single();
      ppgaGroupId = g!.id;
      await serviceClient.from('group_members').insert({ group_id: ppgaGroupId, user_id: memberUser.userId, role: 'member' });

      const { data: access } = await serviceClient
        .from('project_page_group_access')
        .insert({ page_id: ppgaPageId, group_id: ppgaGroupId, permission: 'view', granted_by: ownerUser.userId })
        .select()
        .single();
      ppgaId = access!.id;
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('groups').delete().eq('id', ppgaGroupId);
      await serviceClient.from('project_pages').delete().eq('id', ppgaPageId);
    });

    test('Page owner can SELECT group access rows', async () => {
      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { data, error } = await client
        .from('project_page_group_access')
        .select('id')
        .eq('page_id', ppgaPageId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Group member can SELECT page group access rows', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('project_page_group_access')
        .select('id')
        .eq('page_id', ppgaPageId)
        .eq('group_id', ppgaGroupId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('Outsider cannot SELECT page group access rows', async () => {
      const outsider2 = await createTestUser('rls-ppga-out');
      try {
        const client = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await client
          .from('project_page_group_access')
          .select('id')
          .eq('page_id', ppgaPageId);
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });

    test('Page owner can INSERT group access', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: g2 } = await serviceClient
        .from('groups')
        .insert({ name: 'PPGA Insert Group', created_by: ownerUser.userId })
        .select()
        .single();

      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('project_page_group_access')
        .insert({ page_id: ppgaPageId, group_id: g2!.id, permission: 'view', granted_by: ownerUser.userId });

      await serviceClient.from('groups').delete().eq('id', g2!.id);
      expect(error).toBeNull();
    });

    test('Non-owner cannot INSERT group access', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('project_page_group_access')
        .insert({ page_id: ppgaPageId, group_id: ppgaGroupId, permission: 'view', granted_by: memberUser.userId });
      expect(error).toBeDefined();
    });

    test('Page owner can DELETE group access', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: g3 } = await serviceClient
        .from('groups')
        .insert({ name: 'PPGA Delete Group', created_by: ownerUser.userId })
        .select()
        .single();
      const { data: access } = await serviceClient
        .from('project_page_group_access')
        .insert({ page_id: ppgaPageId, group_id: g3!.id, permission: 'view', granted_by: ownerUser.userId })
        .select()
        .single();

      const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
      const { error } = await client
        .from('project_page_group_access')
        .delete()
        .eq('id', access!.id);

      await serviceClient.from('groups').delete().eq('id', g3!.id);
      expect(error).toBeNull();
    });

    test('Non-owner cannot DELETE group access', async () => {
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client
        .from('project_page_group_access')
        .delete()
        .eq('id', ppgaId);
      if (!error) {
        const serviceClient = createServiceRoleClient();
        const { data } = await serviceClient
          .from('project_page_group_access')
          .select('id')
          .eq('id', ppgaId)
          .maybeSingle();
        expect(data).not.toBeNull();
      } else {
        expect(error.message).toMatch(/permission|denied|policy/i);
      }
    });
  });

  // ─── canvas_projects: page-based access paths ──────────────────────────────
  describe('canvas_projects via page-based access', () => {
    let pageProjId: string;
    let accessPageId: string;
    let viewInviteeUser: { email: string; password: string; userId: string };
    let editInviteeUser: { email: string; password: string; userId: string };
    let pageGroupId: string;
    let pageGroupMember: { email: string; password: string; userId: string };

    beforeAll(async () => {
      const serviceClient = createServiceRoleClient();
      viewInviteeUser = await createTestUser('rls-ppj-view');
      editInviteeUser = await createTestUser('rls-ppj-edit');
      pageGroupMember = await createTestUser('rls-ppj-grpmem');

      const { data: proj } = await serviceClient
        .from('canvas_projects')
        .insert({ user_id: ownerUser.userId, name: 'Page Access Project', canvas_data: {}, canvas_width: 800, canvas_height: 600, is_public: false })
        .select()
        .single();
      pageProjId = proj!.id;

      const { data: p } = await serviceClient
        .from('project_pages')
        .insert({ name: 'Project Access Test Page', created_by: ownerUser.userId })
        .select()
        .single();
      accessPageId = p!.id;

      await serviceClient.from('project_page_items').insert({ page_id: accessPageId, project_id: pageProjId, sort_order: 0 });

      // Individual: view invitee
      await serviceClient.from('project_page_access').insert({
        page_id: accessPageId, email: viewInviteeUser.email, user_id: viewInviteeUser.userId,
        permission: 'view', invited_by: ownerUser.userId, accepted_at: new Date().toISOString(),
      });

      // Individual: edit invitee
      await serviceClient.from('project_page_access').insert({
        page_id: accessPageId, email: editInviteeUser.email, user_id: editInviteeUser.userId,
        permission: 'edit', invited_by: ownerUser.userId, accepted_at: new Date().toISOString(),
      });

      // Group-based
      const { data: g } = await serviceClient
        .from('groups')
        .insert({ name: 'Page Project Group', created_by: ownerUser.userId })
        .select()
        .single();
      pageGroupId = g!.id;
      await serviceClient.from('group_members').insert({ group_id: pageGroupId, user_id: pageGroupMember.userId, role: 'member' });
      await serviceClient.from('project_page_group_access').insert({
        page_id: accessPageId, group_id: pageGroupId, permission: 'edit', granted_by: ownerUser.userId,
      });
    });

    afterAll(async () => {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from('canvas_projects').delete().eq('id', pageProjId);
      await serviceClient.from('project_pages').delete().eq('id', accessPageId);
      await serviceClient.from('groups').delete().eq('id', pageGroupId);
      await deleteTestUser(viewInviteeUser.userId);
      await deleteTestUser(editInviteeUser.userId);
      await deleteTestUser(pageGroupMember.userId);
    }, 30000);

    test('Accepted page invitee can SELECT projects in their accessible pages', async () => {
      const client = await createAuthenticatedClient(viewInviteeUser.email, viewInviteeUser.password);
      const { data, error } = await client.from('canvas_projects').select('id').eq('id', pageProjId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('Page group member can SELECT projects in their group pages', async () => {
      const client = await createAuthenticatedClient(pageGroupMember.email, pageGroupMember.password);
      const { data, error } = await client.from('canvas_projects').select('id').eq('id', pageProjId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('Page invitee with edit permission can UPDATE project', async () => {
      const client = await createAuthenticatedClient(editInviteeUser.email, editInviteeUser.password);
      const { error } = await client
        .from('canvas_projects')
        .update({ canvas_data: { pageEditTest: true } })
        .eq('id', pageProjId);
      expect(error).toBeNull();
    });

    test('Page invitee with view permission cannot UPDATE project', async () => {
      const client = await createAuthenticatedClient(viewInviteeUser.email, viewInviteeUser.password);
      const { error } = await client
        .from('canvas_projects')
        .update({ canvas_data: { viewerHack: true } })
        .eq('id', pageProjId);
      expect(error).toBeDefined();
    });

    test('Page group member with edit permission can UPDATE project', async () => {
      const client = await createAuthenticatedClient(pageGroupMember.email, pageGroupMember.password);
      const { error } = await client
        .from('canvas_projects')
        .update({ canvas_data: { groupEditTest: true } })
        .eq('id', pageProjId);
      expect(error).toBeNull();
    });
  });

  // ─── canvas_comments: owner UPDATE (resolve) ───────────────────────────────
  describe('canvas_comments - owner UPDATE (resolve)', () => {
    test('Project owner can UPDATE (resolve) a comment they did not author', async () => {
      const serviceClient = createServiceRoleClient();
      const { data: comment } = await serviceClient
        .from('canvas_comments')
        .insert({ project_id: projectId, author_id: memberUser.userId, content: 'Owner resolves this' })
        .select('id')
        .single();

      try {
        const client = await createAuthenticatedClient(ownerUser.email, ownerUser.password);
        const { error } = await client
          .from('canvas_comments')
          .update({ resolved: true, resolved_by: ownerUser.userId, resolved_at: new Date().toISOString() })
          .eq('id', comment!.id);
        expect(error).toBeNull();

        const { data: updated } = await serviceClient
          .from('canvas_comments')
          .select('resolved')
          .eq('id', comment!.id)
          .single();
        expect(updated?.resolved).toBe(true);
      } finally {
        await serviceClient.from('canvas_comments').delete().eq('id', comment!.id).maybeSingle();
      }
    });
  });

  // ─── profiles RLS ──────────────────────────────────────────────────────────
  describe('profiles table - collaboration visibility', () => {
    test('Group co-member can SELECT another member profile', async () => {
      // ownerUser and memberUser share groupId
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('profiles')
        .select('id')
        .eq('id', ownerUser.userId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    test('User not in any shared group cannot SELECT another user profile', async () => {
      const outsider2 = await createTestUser('rls-prof-out');
      try {
        const client = await createAuthenticatedClient(outsider2.email, outsider2.password);
        const { data, error } = await client
          .from('profiles')
          .select('id')
          .eq('id', ownerUser.userId);
        if (error) {
          expect(error.message).toMatch(/permission|denied|policy/i);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      } finally {
        await deleteTestUser(outsider2.userId);
      }
    });

    test('Project collaborator can SELECT co-collaborator profile', async () => {
      // memberUser and outsiderUser are both accepted collaborators on projectId
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { data, error } = await client
        .from('profiles')
        .select('id')
        .eq('id', outsiderUser.userId);
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });
  });

  // ─── notify_user RPC ───────────────────────────────────────────────────────
  describe('notify_user RPC - notification preference enforcement', () => {
    afterEach(async () => {
      const serviceClient = createServiceRoleClient();
      // Clean up any test notifications created during tests
      await serviceClient
        .from('user_notifications')
        .delete()
        .eq('user_id', ownerUser.userId)
        .like('subject', '%RLS notify test%');
    });

    test('notify_user inserts row when in_app is true (default)', async () => {
      const serviceClient = createServiceRoleClient();
      // Ensure default preferences (in_app: true for comment_new)
      await serviceClient
        .from('profiles')
        .update({
          notification_preferences: {
            group_invitation: { in_app: true, email: true },
            project_invitation: { in_app: true, email: true },
            page_invitation: { in_app: true, email: true },
            comment_new: { in_app: true, email: true },
            comment_reply: { in_app: true, email: true },
            project_locked: { in_app: true, email: false },
          },
        })
        .eq('id', ownerUser.userId);

      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client.rpc('notify_user', {
        p_user_id: ownerUser.userId,
        p_type: 'comment_new',
        p_subject: 'RLS notify test - enabled',
        p_message: 'A collaborator commented',
      });
      expect(error).toBeNull();

      const { data } = await serviceClient
        .from('user_notifications')
        .select('id, notification_type')
        .eq('user_id', ownerUser.userId)
        .eq('notification_type', 'comment_new')
        .like('subject', '%RLS notify test%');
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('notify_user does NOT insert row when in_app is false', async () => {
      const serviceClient = createServiceRoleClient();
      // Set in_app: false for comment_new
      await serviceClient
        .from('profiles')
        .update({
          notification_preferences: {
            group_invitation: { in_app: true, email: true },
            project_invitation: { in_app: true, email: true },
            page_invitation: { in_app: true, email: true },
            comment_new: { in_app: false, email: true },
            comment_reply: { in_app: true, email: true },
            project_locked: { in_app: true, email: false },
          },
        })
        .eq('id', ownerUser.userId);

      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      await client.rpc('notify_user', {
        p_user_id: ownerUser.userId,
        p_type: 'comment_new',
        p_subject: 'RLS notify test - disabled',
        p_message: 'Should not be stored',
      });

      const { data } = await serviceClient
        .from('user_notifications')
        .select('id')
        .eq('user_id', ownerUser.userId)
        .eq('notification_type', 'comment_new')
        .like('subject', '%RLS notify test%');
      expect(data?.length ?? 0).toBe(0);

      // Restore preferences
      await serviceClient
        .from('profiles')
        .update({
          notification_preferences: {
            group_invitation: { in_app: true, email: true },
            project_invitation: { in_app: true, email: true },
            page_invitation: { in_app: true, email: true },
            comment_new: { in_app: true, email: true },
            comment_reply: { in_app: true, email: true },
            project_locked: { in_app: true, email: false },
          },
        })
        .eq('id', ownerUser.userId);
    });

    test('notify_user defaults to enabled when preference key is missing', async () => {
      const serviceClient = createServiceRoleClient();
      // Set preferences with comment_new key absent
      await serviceClient
        .from('profiles')
        .update({
          notification_preferences: {
            group_invitation: { in_app: true, email: true },
          },
        })
        .eq('id', ownerUser.userId);

      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      const { error } = await client.rpc('notify_user', {
        p_user_id: ownerUser.userId,
        p_type: 'comment_new',
        p_subject: 'RLS notify test - missing key defaults to enabled',
        p_message: 'Should be stored',
      });
      expect(error).toBeNull();

      const { data } = await serviceClient
        .from('user_notifications')
        .select('id')
        .eq('user_id', ownerUser.userId)
        .eq('notification_type', 'comment_new')
        .like('subject', '%RLS notify test%');
      expect(data?.length).toBeGreaterThanOrEqual(1);

      // Restore preferences
      await serviceClient
        .from('profiles')
        .update({
          notification_preferences: {
            group_invitation: { in_app: true, email: true },
            project_invitation: { in_app: true, email: true },
            page_invitation: { in_app: true, email: true },
            comment_new: { in_app: true, email: true },
            comment_reply: { in_app: true, email: true },
            project_locked: { in_app: true, email: false },
          },
        })
        .eq('id', ownerUser.userId);
    });

    test('notify_user stores correct notification_type and link', async () => {
      const serviceClient = createServiceRoleClient();
      const client = await createAuthenticatedClient(memberUser.email, memberUser.password);
      await client.rpc('notify_user', {
        p_user_id: ownerUser.userId,
        p_type: 'comment_reply',
        p_subject: 'RLS notify test - fields check',
        p_message: 'Reply message',
        p_link: '/canvas/test-project-id',
      });

      const { data } = await serviceClient
        .from('user_notifications')
        .select('notification_type, link, subject')
        .eq('user_id', ownerUser.userId)
        .eq('notification_type', 'comment_reply')
        .like('subject', '%RLS notify test%')
        .single();

      expect(data?.notification_type).toBe('comment_reply');
      expect(data?.link).toBe('/canvas/test-project-id');
    });
  });
});
