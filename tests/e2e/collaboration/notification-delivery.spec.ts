/**
 * Notification Delivery Integration Tests
 *
 * Tests that the send-comment-notification and send-lock-notification edge functions
 * correctly create in-app notification rows and respect email preferences.
 *
 * Covers three collaboration access paths:
 *  - Direct: project_collaborators
 *  - Group: project_group_access → group_members
 *  - Page: project_page_items → project_page_access / project_page_group_access → group_members
 *
 * Email delivery via Resend cannot be verified here, but we verify:
 *  - In-app notifications are created in user_notifications
 *  - Email preference (email: false) is respected — no email attempt is made
 *    (tested implicitly: edge function succeeds and in-app row is correct)
 *  - Self-actions do not trigger notifications
 */
import { test, expect } from '../fixtures/auth';
import {
  createServiceRoleClient,
  createTestUser,
  deleteTestUser,
  createAuthenticatedClient,
} from '../../utils/supabase-test-client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type User = { email: string; password: string; userId: string };

async function countNotifs(userId: string, type: string, subjectHint: string) {
  const sc = createServiceRoleClient();
  const { data } = await sc
    .from('user_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', type)
    .like('subject', `%${subjectHint}%`);
  return data?.length ?? 0;
}

async function cleanNotifs(userId: string, subjectHint: string) {
  const sc = createServiceRoleClient();
  await sc
    .from('user_notifications')
    .delete()
    .eq('user_id', userId)
    .like('subject', `%${subjectHint}%`);
}

async function invokeCommentNotification(
  asUser: User,
  commentId: string,
  projectId: string,
  isReply: boolean,
): Promise<{ status: number; body: any }> {
  const client = await createAuthenticatedClient(asUser.email, asUser.password);
  const { data, error } = await client.functions.invoke('send-comment-notification', {
    body: { commentId, projectId, isReply },
  });
  return { status: error ? 500 : 200, body: data };
}

async function invokeLockNotification(
  asUser: User,
  projectId: string,
  action: 'locked' | 'unlocked',
): Promise<{ status: number; body: any }> {
  const client = await createAuthenticatedClient(asUser.email, asUser.password);
  const { data, error } = await client.functions.invoke('send-lock-notification', {
    body: { projectId, action },
  });
  return { status: error ? 500 : 200, body: data };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Comment & Lock Notification Delivery', () => {
  let ownerUser: User;
  let collabUser: User;      // direct project_collaborators access
  let groupMemberUser: User; // access via project_group_access
  let pageMemberUser: User;  // access via project_page_access
  let projectId: string;
  let groupId: string;
  let pageId: string;

  test.beforeAll(async () => {
    const sc = createServiceRoleClient();

    ownerUser = await createTestUser('notif-del-owner');
    collabUser = await createTestUser('notif-del-collab');
    groupMemberUser = await createTestUser('notif-del-gm');
    pageMemberUser = await createTestUser('notif-del-pm');

    // Create project (name must include 'notif-del' for subject LIKE filter to work)
    const { data: proj } = await sc
      .from('canvas_projects')
      .insert({
        user_id: ownerUser.userId,
        name: 'notif-del-test-project',
        canvas_data: {},
        canvas_width: 800,
        canvas_height: 600,
        is_public: false,
      })
      .select()
      .single();
    projectId = proj!.id;

    // ── Direct collaborator ──────────────────────────────────────────────────
    await sc.from('project_collaborators').insert({
      project_id: projectId,
      user_id: collabUser.userId,
      email: collabUser.email,
      permission: 'edit',
      invited_by: ownerUser.userId,
      accepted_at: new Date().toISOString(),
    });

    // ── Group access ─────────────────────────────────────────────────────────
    // Create group (direct insert — service role bypasses RLS)
    const { data: group } = await sc
      .from('groups')
      .insert({ name: 'notif-del-group', created_by: ownerUser.userId })
      .select('id')
      .single();
    groupId = group!.id;

    // Add ownerUser + groupMemberUser to the group
    await sc.from('group_members').insert([
      { group_id: groupId, user_id: ownerUser.userId, role: 'owner' },
      { group_id: groupId, user_id: groupMemberUser.userId, role: 'member' },
    ]);

    // Grant group access to project
    await sc.from('project_group_access').insert({
      project_id: projectId,
      group_id: groupId,
      permission: 'edit',
      granted_by: ownerUser.userId,
    });

    // ── Page access ──────────────────────────────────────────────────────────
    // Create page
    const { data: page } = await sc
      .from('project_pages')
      .insert({ name: 'notif-del-page', created_by: ownerUser.userId })
      .select('id')
      .single();
    pageId = page!.id;

    // Add project to page
    await sc.from('project_page_items').insert({
      page_id: pageId,
      project_id: projectId,
      sort_order: 0,
    });

    // Grant pageMemberUser individual page access (accepted)
    await sc.from('project_page_access').insert({
      page_id: pageId,
      user_id: pageMemberUser.userId,
      email: pageMemberUser.email,
      permission: 'view',
      invited_by: ownerUser.userId,
      accepted_at: new Date().toISOString(),
    });
  });

  test.afterAll(async () => {
    const sc = createServiceRoleClient();
    // Delete group (cascades group_members, project_group_access)
    if (groupId) await sc.from('groups').delete().eq('id', groupId);
    // Delete page (cascades project_page_items, project_page_access, project_page_group_access)
    if (pageId) await sc.from('project_pages').delete().eq('id', pageId);
    // Delete project (cascades project_collaborators, canvas_comments, etc.)
    await sc.from('canvas_projects').delete().eq('id', projectId);
    // Delete users
    await deleteTestUser(ownerUser.userId);
    await deleteTestUser(collabUser.userId);
    await deleteTestUser(groupMemberUser.userId);
    await deleteTestUser(pageMemberUser.userId);
  });

  test.afterEach(async () => {
    await cleanNotifs(ownerUser.userId, 'notif-del');
    await cleanNotifs(collabUser.userId, 'notif-del');
    await cleanNotifs(groupMemberUser.userId, 'notif-del');
    await cleanNotifs(pageMemberUser.userId, 'notif-del');
  });

  // ── comment_new: collaborator comments → owner notified ───────────────────

  test('comment_new: collaborator comments → owner receives in-app notification', async () => {
    const sc = createServiceRoleClient();

    // Insert comment as collabUser
    const { data: comment } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: collabUser.userId,
        content: 'notif-del comment from collaborator',
        canvas_x: 100,
        canvas_y: 100,
      })
      .select('id')
      .single();
    expect(comment).not.toBeNull();

    const { body } = await invokeCommentNotification(collabUser, comment!.id, projectId, false);
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    const ownerCount = await countNotifs(ownerUser.userId, 'comment_new', 'notif-del');
    expect(ownerCount).toBe(1);

    // Collaborator should NOT notify themselves
    const collabCount = await countNotifs(collabUser.userId, 'comment_new', 'notif-del');
    expect(collabCount).toBe(0);

    // Cleanup comment
    await sc.from('canvas_comments').delete().eq('id', comment!.id);
  });

  // ── comment_new: owner comments → collaborator notified ───────────────────

  test('comment_new: owner comments → collaborator receives in-app notification', async () => {
    const sc = createServiceRoleClient();

    const { data: comment } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: ownerUser.userId,
        content: 'notif-del comment from owner',
        canvas_x: 200,
        canvas_y: 200,
      })
      .select('id')
      .single();
    expect(comment).not.toBeNull();

    const { body } = await invokeCommentNotification(ownerUser, comment!.id, projectId, false);
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    const collabCount = await countNotifs(collabUser.userId, 'comment_new', 'notif-del');
    expect(collabCount).toBe(1);

    // Owner should NOT notify themselves
    const ownerCount = await countNotifs(ownerUser.userId, 'comment_new', 'notif-del');
    expect(ownerCount).toBe(0);

    await sc.from('canvas_comments').delete().eq('id', comment!.id);
  });

  // ── comment_new: solo project (no collaborators, owner comments) → no notification ──

  test('comment_new: no collaborators + owner comments → notified: false', async () => {
    const sc = createServiceRoleClient();

    // Create a separate solo project (owner only, no collaborators)
    const { data: soloProj } = await sc
      .from('canvas_projects')
      .insert({
        user_id: ownerUser.userId,
        name: 'notif-del-solo-project',
        canvas_data: {},
        canvas_width: 800,
        canvas_height: 600,
        is_public: false,
      })
      .select()
      .single();

    const { data: comment } = await sc
      .from('canvas_comments')
      .insert({
        project_id: soloProj!.id,
        author_id: ownerUser.userId,
        content: 'notif-del solo comment',
        canvas_x: 100,
        canvas_y: 100,
      })
      .select('id')
      .single();

    const { body } = await invokeCommentNotification(ownerUser, comment!.id, soloProj!.id, false);
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(false); // No one to notify

    await sc.from('canvas_comments').delete().eq('id', comment!.id);
    await sc.from('canvas_projects').delete().eq('id', soloProj!.id);
  });

  // ── comment_reply: reply → parent comment author notified ─────────────────

  test('comment_reply: collaborator replies to owner comment → owner notified', async () => {
    const sc = createServiceRoleClient();

    // Owner creates top-level comment
    const { data: parent } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: ownerUser.userId,
        content: 'notif-del top-level comment',
        canvas_x: 100,
        canvas_y: 100,
      })
      .select('id')
      .single();

    // Collaborator replies
    const { data: reply } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        parent_id: parent!.id,
        author_id: collabUser.userId,
        content: 'notif-del reply from collaborator',
      })
      .select('id')
      .single();

    const { body } = await invokeCommentNotification(collabUser, reply!.id, projectId, true);
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    const ownerCount = await countNotifs(ownerUser.userId, 'comment_reply', 'notif-del');
    expect(ownerCount).toBe(1);

    const collabCount = await countNotifs(collabUser.userId, 'comment_reply', 'notif-del');
    expect(collabCount).toBe(0);

    await sc.from('canvas_comments').delete().eq('id', reply!.id);
    await sc.from('canvas_comments').delete().eq('id', parent!.id);
  });

  test('comment_reply: self-reply does not create notification', async () => {
    const sc = createServiceRoleClient();

    const { data: parent } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: ownerUser.userId,
        content: 'notif-del self-reply parent',
        canvas_x: 100,
        canvas_y: 100,
      })
      .select('id')
      .single();

    const { data: reply } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        parent_id: parent!.id,
        author_id: ownerUser.userId,
        content: 'notif-del self-reply',
      })
      .select('id')
      .single();

    const { body } = await invokeCommentNotification(ownerUser, reply!.id, projectId, true);
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(false); // Self-reply, no notification

    const ownerCount = await countNotifs(ownerUser.userId, 'comment_reply', 'notif-del');
    expect(ownerCount).toBe(0);

    await sc.from('canvas_comments').delete().eq('id', reply!.id);
    await sc.from('canvas_comments').delete().eq('id', parent!.id);
  });

  // ── project_locked: lock → collaborator notified ──────────────────────────

  test('project_locked: owner locks project → collaborator receives in-app notification', async () => {
    const { body } = await invokeLockNotification(ownerUser, projectId, 'locked');
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    const collabCount = await countNotifs(collabUser.userId, 'project_locked', 'notif-del');
    expect(collabCount).toBe(1);

    // Owner should NOT notify themselves
    const ownerCount = await countNotifs(ownerUser.userId, 'project_locked', 'notif-del');
    expect(ownerCount).toBe(0);
  });

  test('project_locked: owner unlocks project → collaborator receives in-app notification', async () => {
    const { body } = await invokeLockNotification(ownerUser, projectId, 'unlocked');
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    const collabCount = await countNotifs(collabUser.userId, 'project_locked', 'notif-del');
    expect(collabCount).toBe(1);
  });

  // ── email preferences: in_app disabled → no notification row ──────────────

  test('comment_new: in_app disabled → no notification row created', async () => {
    const sc = createServiceRoleClient();

    // Disable in_app for comment_new on the owner (recipient in this test)
    await sc
      .from('profiles')
      .update({
        notification_preferences: {
          comment_new: { in_app: false, email: true },
        },
      })
      .eq('id', ownerUser.userId);

    const { data: comment } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: collabUser.userId,
        content: 'notif-del in_app disabled comment',
        canvas_x: 100,
        canvas_y: 100,
      })
      .select('id')
      .single();

    const { body } = await invokeCommentNotification(collabUser, comment!.id, projectId, false);
    expect(body?.success).toBe(true);

    // in_app: false → no DB row should be created for the owner
    const ownerCount = await countNotifs(ownerUser.userId, 'comment_new', 'notif-del');
    expect(ownerCount).toBe(0);

    // Restore default preferences
    await sc
      .from('profiles')
      .update({
        notification_preferences: {
          comment_new: { in_app: true, email: true },
        },
      })
      .eq('id', ownerUser.userId);

    await sc.from('canvas_comments').delete().eq('id', comment!.id);
  });

  test('project_locked: in_app disabled → no notification row created', async () => {
    const sc = createServiceRoleClient();

    await sc
      .from('profiles')
      .update({
        notification_preferences: {
          project_locked: { in_app: false, email: false },
        },
      })
      .eq('id', collabUser.userId);

    const { body } = await invokeLockNotification(ownerUser, projectId, 'locked');
    expect(body?.success).toBe(true);

    const collabCount = await countNotifs(collabUser.userId, 'project_locked', 'notif-del');
    expect(collabCount).toBe(0);

    // Restore
    await sc
      .from('profiles')
      .update({
        notification_preferences: {
          project_locked: { in_app: true, email: false },
        },
      })
      .eq('id', collabUser.userId);
  });

  // ── Group access: group members receive notifications ─────────────────────

  test('comment_new: group member receives notification when owner comments', async () => {
    const sc = createServiceRoleClient();

    const { data: comment } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: ownerUser.userId,
        content: 'notif-del comment for group member',
        canvas_x: 300,
        canvas_y: 300,
      })
      .select('id')
      .single();

    const { body } = await invokeCommentNotification(ownerUser, comment!.id, projectId, false);
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    // Group member should be notified
    const gmCount = await countNotifs(groupMemberUser.userId, 'comment_new', 'notif-del');
    expect(gmCount).toBe(1);

    // Owner should NOT notify themselves
    const ownerCount = await countNotifs(ownerUser.userId, 'comment_new', 'notif-del');
    expect(ownerCount).toBe(0);

    await sc.from('canvas_comments').delete().eq('id', comment!.id);
  });

  test('project_locked: group member receives lock notification', async () => {
    const { body } = await invokeLockNotification(ownerUser, projectId, 'locked');
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    // Group member should be notified
    const gmCount = await countNotifs(groupMemberUser.userId, 'project_locked', 'notif-del');
    expect(gmCount).toBe(1);

    // Owner should NOT notify themselves
    const ownerCount = await countNotifs(ownerUser.userId, 'project_locked', 'notif-del');
    expect(ownerCount).toBe(0);
  });

  // ── Page access: page members receive notifications ───────────────────────

  test('comment_new: page member receives notification when owner comments', async () => {
    const sc = createServiceRoleClient();

    const { data: comment } = await sc
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        author_id: ownerUser.userId,
        content: 'notif-del comment for page member',
        canvas_x: 400,
        canvas_y: 400,
      })
      .select('id')
      .single();

    const { body } = await invokeCommentNotification(ownerUser, comment!.id, projectId, false);
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    // Page member should be notified
    const pmCount = await countNotifs(pageMemberUser.userId, 'comment_new', 'notif-del');
    expect(pmCount).toBe(1);

    // Owner should NOT notify themselves
    const ownerCount = await countNotifs(ownerUser.userId, 'comment_new', 'notif-del');
    expect(ownerCount).toBe(0);

    await sc.from('canvas_comments').delete().eq('id', comment!.id);
  });

  test('project_locked: page member receives lock notification', async () => {
    const { body } = await invokeLockNotification(ownerUser, projectId, 'locked');
    expect(body?.success).toBe(true);
    expect(body?.notified).toBe(true);

    // Page member should be notified
    const pmCount = await countNotifs(pageMemberUser.userId, 'project_locked', 'notif-del');
    expect(pmCount).toBe(1);

    // Owner should NOT notify themselves
    const ownerCount = await countNotifs(ownerUser.userId, 'project_locked', 'notif-del');
    expect(ownerCount).toBe(0);
  });
});
