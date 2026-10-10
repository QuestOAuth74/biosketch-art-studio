import { describe, test, expect } from 'vitest';

/**
 * Unit tests for send-comment-notification edge function business logic.
 *
 * The edge function (supabase/functions/send-comment-notification/index.ts) runs
 * in Deno and cannot be imported directly in a Node/Vitest environment.
 * Pure logic is extracted here as plain functions mirroring the edge function's
 * decision tree, allowing full coverage without network or DB calls.
 */

// ─── Pure logic extracted from send-comment-notification ────────────────────

/**
 * Determine who should be notified and what notification type to use.
 *
 * New comment  → notify project owner, unless the commenter IS the owner.
 * Reply        → notify the parent comment's author, unless they are the same user.
 */
function determineRecipient(
  commentAuthorId: string,
  projectOwnerId: string,
  isReply: boolean,
  parentAuthorId: string | null,
): { targetUserId: string | null; notifType: 'comment_new' | 'comment_reply' } {
  if (!isReply) {
    const targetUserId = projectOwnerId !== commentAuthorId ? projectOwnerId : null;
    return { targetUserId, notifType: 'comment_new' };
  }

  const targetUserId =
    parentAuthorId && parentAuthorId !== commentAuthorId ? parentAuthorId : null;
  return { targetUserId, notifType: 'comment_reply' };
}

/**
 * Build the notification subject line.
 * Mirrors the template in the edge function (lines 130–133).
 */
function buildSubject(isReply: boolean, authorName: string, projectName: string): string {
  return isReply
    ? `${authorName} replied to your comment on "${projectName}"`
    : `New comment on your project "${projectName}"`;
}

/**
 * Build the short notification message body.
 * Content is truncated to 200 characters with an ellipsis if needed.
 */
function buildMessage(authorName: string, content: string): string {
  const truncated = content.slice(0, 200) + (content.length > 200 ? '\u2026' : '');
  return `${authorName}: "${truncated}"`;
}

/**
 * Determine whether the email channel is enabled for a notification type.
 * Defaults to enabled (true) when the preference is absent.
 */
function isEmailEnabled(
  prefs: Record<string, { in_app?: boolean; email?: boolean }>,
  notifType: string,
): boolean {
  return prefs[notifType]?.email !== false;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('determineRecipient — new top-level comment', () => {
  const OWNER = 'owner-uuid';
  const AUTHOR = 'author-uuid';

  test('notifies project owner when commenter is not the owner', () => {
    const { targetUserId, notifType } = determineRecipient(AUTHOR, OWNER, false, null);
    expect(targetUserId).toBe(OWNER);
    expect(notifType).toBe('comment_new');
  });

  test('returns null when commenter IS the project owner (self-comment)', () => {
    const { targetUserId } = determineRecipient(OWNER, OWNER, false, null);
    expect(targetUserId).toBeNull();
  });

  test('notifType is always comment_new for top-level comments', () => {
    const { notifType } = determineRecipient(AUTHOR, OWNER, false, null);
    expect(notifType).toBe('comment_new');
  });
});

describe('determineRecipient — reply', () => {
  const REPLIER = 'replier-uuid';
  const PARENT_AUTHOR = 'parent-author-uuid';

  test('notifies parent comment author when replier is different user', () => {
    const { targetUserId, notifType } = determineRecipient(REPLIER, 'owner', true, PARENT_AUTHOR);
    expect(targetUserId).toBe(PARENT_AUTHOR);
    expect(notifType).toBe('comment_reply');
  });

  test('returns null when replier replies to their own comment', () => {
    const { targetUserId } = determineRecipient(REPLIER, 'owner', true, REPLIER);
    expect(targetUserId).toBeNull();
  });

  test('returns null when parentAuthorId is null (orphaned reply)', () => {
    const { targetUserId } = determineRecipient(REPLIER, 'owner', true, null);
    expect(targetUserId).toBeNull();
  });

  test('notifType is always comment_reply for replies', () => {
    const { notifType } = determineRecipient(REPLIER, 'owner', true, PARENT_AUTHOR);
    expect(notifType).toBe('comment_reply');
  });
});

describe('buildSubject', () => {
  test('new comment format includes project name', () => {
    const subject = buildSubject(false, 'Alice', 'Protein Transport Study');
    expect(subject).toBe('New comment on your project "Protein Transport Study"');
  });

  test('reply format includes author name and project name', () => {
    const subject = buildSubject(true, 'Alice', 'Protein Transport Study');
    expect(subject).toBe('Alice replied to your comment on "Protein Transport Study"');
  });

  test('author name fallback ("A BioSketch user") appears in reply subject when full_name is null', () => {
    // The edge function uses `authorProfile?.full_name ?? "A BioSketch user"` before calling buildSubject.
    // For a reply, the author name is embedded in the subject.
    const subject = buildSubject(true, 'A BioSketch user', 'My Project');
    expect(subject).toContain('A BioSketch user');
    expect(subject).toContain('replied to your comment');
  });
});

describe('buildMessage', () => {
  test('short content is included verbatim', () => {
    const msg = buildMessage('Alice', 'Great diagram!');
    expect(msg).toBe('Alice: "Great diagram!"');
  });

  test('content longer than 200 characters is truncated with ellipsis', () => {
    const longContent = 'a'.repeat(250);
    const msg = buildMessage('Bob', longContent);
    expect(msg).toContain('\u2026'); // ellipsis character
    // Truncated at 200 chars: Alice: "aaa...aaa…"
    const contentPart = msg.slice(msg.indexOf('"') + 1, msg.lastIndexOf('"'));
    expect(contentPart.length).toBe(201); // 200 chars + ellipsis
  });

  test('content exactly 200 characters is not truncated', () => {
    const content = 'b'.repeat(200);
    const msg = buildMessage('Carol', content);
    expect(msg).not.toContain('\u2026');
    expect(msg).toBe(`Carol: "${content}"`);
  });
});

describe('isEmailEnabled', () => {
  test('defaults to enabled when notification type has no preference entry', () => {
    expect(isEmailEnabled({}, 'comment_new')).toBe(true);
  });

  test('defaults to enabled when email key is absent but type entry exists', () => {
    expect(isEmailEnabled({ comment_new: { in_app: true } }, 'comment_new')).toBe(true);
  });

  test('returns false when email is explicitly set to false', () => {
    expect(isEmailEnabled({ comment_new: { in_app: true, email: false } }, 'comment_new')).toBe(false);
  });

  test('returns true when email is explicitly set to true', () => {
    expect(isEmailEnabled({ comment_reply: { in_app: true, email: true } }, 'comment_reply')).toBe(true);
  });

  test('different notification types have independent preferences', () => {
    const prefs = {
      comment_new: { in_app: true, email: false },
      comment_reply: { in_app: true, email: true },
    };
    expect(isEmailEnabled(prefs, 'comment_new')).toBe(false);
    expect(isEmailEnabled(prefs, 'comment_reply')).toBe(true);
  });
});
