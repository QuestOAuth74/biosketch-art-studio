import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock supabase client to prevent localStorage reference at import time (node environment)
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      untrack: vi.fn(),
      track: vi.fn(),
      presenceState: vi.fn(() => ({})),
    })),
    removeChannel: vi.fn(),
  },
}));

import { getUserColor, buildPresentUsers } from '@/hooks/usePresence';

// ─── Helper functions extracted for unit testing ────────────────────────────

/** Permission helpers (replicated from CommentThread for unit testing) */
function canResolveComment(
  userId: string,
  commentAuthorId: string,
  projectOwnerId: string,
): boolean {
  return userId === commentAuthorId || userId === projectOwnerId;
}

function canDeleteComment(
  userId: string,
  commentAuthorId: string,
  projectOwnerId: string,
): boolean {
  return userId === commentAuthorId || userId === projectOwnerId;
}

/** Last-write-wins conflict resolution */
interface TrackedProperty {
  value: unknown;
  timestamp: number;
}

type ObjectTimestamps = Map<string, TrackedProperty>;

function applyRemoteProperty(
  tracked: ObjectTimestamps,
  key: string,
  value: unknown,
  timestamp: number,
): boolean {
  const existing = tracked.get(key);
  if (existing && existing.timestamp >= timestamp) {
    return false; // Ignore — local is newer or equal
  }
  tracked.set(key, { value, timestamp });
  return true; // Applied
}

/** Whether edits should be blocked */
function isEditBlocked(isLocked: boolean, canManageLock: boolean): boolean {
  return isLocked && !canManageLock;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Presence tracking', () => {
  test('getUserColor returns deterministic color for same userId', () => {
    const userId = 'user-abc-123';
    const c1 = getUserColor(userId);
    const c2 = getUserColor(userId);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('different users get potentially different colors', () => {
    // Not guaranteed to differ, but with 8 colors and different IDs the set should vary
    const colors = new Set(['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8']
      .map(getUserColor));
    // At minimum we should get valid hex strings
    colors.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
  });

  test('color assignment is deterministic per userId — multiple calls same result', () => {
    const ids = ['abc', 'def', 'xyz', '123', 'foo'];
    const first = ids.map(getUserColor);
    const second = ids.map(getUserColor);
    expect(first).toEqual(second);
  });
});

describe('Last-write-wins conflict resolution', () => {
  let timestamps: ObjectTimestamps;

  beforeEach(() => {
    timestamps = new Map();
  });

  test('earlier timestamp after later timestamp is ignored', () => {
    // Apply timestamp 100 first
    applyRemoteProperty(timestamps, 'left', 200, 100);
    // Now try to apply timestamp 50 (older) — should be rejected
    const applied = applyRemoteProperty(timestamps, 'left', 100, 50);
    expect(applied).toBe(false);
    expect(timestamps.get('left')?.value).toBe(200); // original value kept
  });

  test('later timestamp overwrites earlier timestamp', () => {
    applyRemoteProperty(timestamps, 'top', 100, 50);
    const applied = applyRemoteProperty(timestamps, 'top', 999, 200);
    expect(applied).toBe(true);
    expect(timestamps.get('top')?.value).toBe(999);
  });

  test('equal timestamps do not overwrite (first writer wins)', () => {
    applyRemoteProperty(timestamps, 'angle', 45, 100);
    const applied = applyRemoteProperty(timestamps, 'angle', 90, 100);
    expect(applied).toBe(false);
    expect(timestamps.get('angle')?.value).toBe(45);
  });

  test('first application always succeeds', () => {
    const applied = applyRemoteProperty(timestamps, 'fill', 'red', 1000);
    expect(applied).toBe(true);
    expect(timestamps.get('fill')?.value).toBe('red');
  });
});

describe('Manual project lock', () => {
  test('locked project blocks non-admin edits', () => {
    expect(isEditBlocked(true, false)).toBe(true);
  });

  test('locked project does NOT block admin/owner edits', () => {
    expect(isEditBlocked(true, true)).toBe(false);
  });

  test('unlocked project never blocks edits', () => {
    expect(isEditBlocked(false, false)).toBe(false);
    expect(isEditBlocked(false, true)).toBe(false);
  });
});

describe('Comment permission helpers', () => {
  const OWNER_ID = 'owner-123';
  const AUTHOR_ID = 'author-456';
  const THIRD_USER = 'other-789';

  test('comment author can resolve their own comment', () => {
    expect(canResolveComment(AUTHOR_ID, AUTHOR_ID, OWNER_ID)).toBe(true);
  });

  test('project owner can resolve any comment', () => {
    expect(canResolveComment(OWNER_ID, AUTHOR_ID, OWNER_ID)).toBe(true);
  });

  test('third user cannot resolve another user\'s comment', () => {
    expect(canResolveComment(THIRD_USER, AUTHOR_ID, OWNER_ID)).toBe(false);
  });

  test('comment author can delete their own comment', () => {
    expect(canDeleteComment(AUTHOR_ID, AUTHOR_ID, OWNER_ID)).toBe(true);
  });

  test('project owner can delete any comment', () => {
    expect(canDeleteComment(OWNER_ID, AUTHOR_ID, OWNER_ID)).toBe(true);
  });

  test('third user cannot delete another user\'s comment', () => {
    expect(canDeleteComment(THIRD_USER, AUTHOR_ID, OWNER_ID)).toBe(false);
  });
});

describe('Presence state machine', () => {
  const MY_USER_ID = 'my-user-id';

  function makePresenceState(entries: Array<{ key: string; userId: string; displayName?: string; color?: string }>) {
    return Object.fromEntries(
      entries.map(({ key, userId, displayName, color }) => [
        key,
        [{
          userId,
          displayName: displayName ?? 'User ' + userId,
          avatarUrl: null,
          color: color ?? '#ef4444',
          cursorX: null,
          cursorY: null,
        }],
      ]),
    );
  }

  test('excludes my own userId from the returned list', () => {
    const state = makePresenceState([
      { key: MY_USER_ID, userId: MY_USER_ID, displayName: 'Me' },
      { key: 'other-user', userId: 'other-user', displayName: 'Other' },
    ]);
    const users = buildPresentUsers(state, MY_USER_ID);
    expect(users).toHaveLength(1);
    expect(users[0].userId).toBe('other-user');
  });

  test('joining user is included with correct display name', () => {
    const state = makePresenceState([
      { key: 'alice', userId: 'alice', displayName: 'Alice' },
      { key: 'bob', userId: 'bob', displayName: 'Bob' },
    ]);
    const users = buildPresentUsers(state, MY_USER_ID);
    expect(users).toHaveLength(2);
    const names = users.map((u) => u.displayName);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  test('leaving user is absent when not in presenceState', () => {
    // Alice left — only Bob remains
    const state = makePresenceState([
      { key: 'bob', userId: 'bob', displayName: 'Bob' },
    ]);
    const users = buildPresentUsers(state, MY_USER_ID);
    expect(users).toHaveLength(1);
    expect(users[0].displayName).toBe('Bob');
  });

  test('empty presence state returns empty array', () => {
    const users = buildPresentUsers({}, MY_USER_ID);
    expect(users).toHaveLength(0);
  });

  test('returns correct color from presenceState payload', () => {
    const state = makePresenceState([
      { key: 'alice', userId: 'alice', color: '#3b82f6' },
    ]);
    const users = buildPresentUsers(state, MY_USER_ID);
    expect(users[0].color).toBe('#3b82f6');
  });
});

describe('Canvas snapshot tombstone logic', () => {
  /** Simulates the tombstone-aware object filtering used in applySnapshot */
  function filterForApply(
    localIds: string[],
    remoteIds: string[],
    tombstones: string[],
    activeIds: string[],
    remoteTimestamps: Record<string, number>,
    localTimestamps: Record<string, number>,
  ) {
    const tombstoneSet = new Set(tombstones);
    const activeSet = new Set(activeIds);
    const remoteById = new Map(remoteIds.map((id) => [id, remoteTimestamps[id] ?? 0]));

    const toRemove: string[] = [];
    const toAdd: string[] = [];
    const kept: string[] = [];

    for (const id of localIds) {
      if (tombstoneSet.has(id) && !activeSet.has(id)) {
        toRemove.push(id);
        continue;
      }
      if (remoteById.has(id)) {
        remoteById.delete(id);
        if (activeSet.has(id)) { kept.push(id); continue; }
        const rt = remoteTimestamps[id] ?? 0;
        const lt = localTimestamps[id] ?? 0;
        if (rt > lt) { toRemove.push(id); toAdd.push(id); }
        else kept.push(id);
      } else {
        kept.push(id); // only local — keep
      }
    }
    for (const [id] of remoteById) {
      if (!tombstoneSet.has(id)) toAdd.push(id);
    }
    return { toRemove, toAdd, kept };
  }

  test('remote-deleted object is removed from local canvas', () => {
    const { toRemove } = filterForApply(['obj-1'], [], ['obj-1'], [], {}, {});
    expect(toRemove).toContain('obj-1');
  });

  test('active (selected) object is never removed even if tombstoned', () => {
    const { toRemove, kept } = filterForApply(['obj-1'], [], ['obj-1'], ['obj-1'], {}, {});
    expect(toRemove).not.toContain('obj-1');
    expect(kept).toContain('obj-1');
  });

  test('remote-only object is added locally', () => {
    const { toAdd } = filterForApply([], ['obj-2'], [], [], {}, {});
    expect(toAdd).toContain('obj-2');
  });

  test('local-only object is kept (remote hasn\'t seen our last broadcast)', () => {
    const { kept, toRemove } = filterForApply(['obj-1'], [], [], [], {}, {});
    expect(kept).toContain('obj-1');
    expect(toRemove).not.toContain('obj-1');
  });

  test('remote newer timestamp replaces local object', () => {
    const { toRemove, toAdd } = filterForApply(
      ['obj-1'], ['obj-1'], [], [],
      { 'obj-1': 200 }, { 'obj-1': 100 },
    );
    expect(toRemove).toContain('obj-1');
    expect(toAdd).toContain('obj-1');
  });

  test('local newer timestamp keeps local object', () => {
    const { kept, toRemove } = filterForApply(
      ['obj-1'], ['obj-1'], [], [],
      { 'obj-1': 100 }, { 'obj-1': 200 },
    );
    expect(kept).toContain('obj-1');
    expect(toRemove).not.toContain('obj-1');
  });

  test('simultaneous edits to different objects: both survive', () => {
    // User edits obj-B, collaborator edits obj-A
    const { kept, toAdd, toRemove } = filterForApply(
      ['obj-A', 'obj-B'],
      ['obj-A', 'obj-B'],
      [],
      [],
      { 'obj-A': 200, 'obj-B': 50 },  // remote newer for A, older for B
      { 'obj-A': 50,  'obj-B': 200 }, // local newer for B, older for A
    );
    // obj-A: remote wins (200 > 50) → removed + re-added
    expect(toRemove).toContain('obj-A');
    expect(toAdd).toContain('obj-A');
    // obj-B: local wins (200 > 50) → kept unchanged
    expect(kept).toContain('obj-B');
    expect(toRemove).not.toContain('obj-B');
  });
});
