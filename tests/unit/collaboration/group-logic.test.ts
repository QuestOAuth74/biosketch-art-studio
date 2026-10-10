import { describe, test, expect } from 'vitest';

// Pure helper functions for collaboration logic (no DB calls)

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function expiresInSevenDays(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function canInvite(role: 'owner' | 'admin' | 'member'): boolean {
  return role === 'owner' || role === 'admin';
}

function canRemoveMember(
  actorRole: 'owner' | 'admin' | 'member',
  targetRole: 'owner' | 'admin' | 'member',
  isSelf: boolean
): boolean {
  if (isSelf && actorRole !== 'owner') return true; // self-leave
  if (actorRole === 'owner') return !isSelf; // owner can remove anyone except themselves
  if (actorRole === 'admin') return targetRole === 'member'; // admin can only remove members
  return false;
}

function isPendingInvitation(acceptedAt: string | null): boolean {
  return acceptedAt === null;
}

function isActiveCollaborator(acceptedAt: string | null): boolean {
  return acceptedAt !== null;
}

function canEditProject(permission: 'view' | 'edit'): boolean {
  return permission === 'edit';
}

describe('Group invitation logic', () => {
  test('isExpired returns true for past dates', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  test('isExpired returns false for future dates', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isExpired(future)).toBe(false);
  });

  test('expiresInSevenDays is exactly 7 days from now (within 5 second margin)', () => {
    const expiry = new Date(expiresInSevenDays()).getTime();
    const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiry - sevenDays)).toBeLessThan(5000);
  });
});

describe('Role hierarchy: who can invite', () => {
  test('owner can invite', () => {
    expect(canInvite('owner')).toBe(true);
  });

  test('admin can invite', () => {
    expect(canInvite('admin')).toBe(true);
  });

  test('member cannot invite', () => {
    expect(canInvite('member')).toBe(false);
  });
});

describe('Role hierarchy: who can remove members', () => {
  test('owner can remove an admin', () => {
    expect(canRemoveMember('owner', 'admin', false)).toBe(true);
  });

  test('owner can remove a member', () => {
    expect(canRemoveMember('owner', 'member', false)).toBe(true);
  });

  test('owner cannot remove themselves', () => {
    expect(canRemoveMember('owner', 'owner', true)).toBe(false);
  });

  test('admin can remove a member', () => {
    expect(canRemoveMember('admin', 'member', false)).toBe(true);
  });

  test('admin cannot remove another admin', () => {
    expect(canRemoveMember('admin', 'admin', false)).toBe(false);
  });

  test('member can leave (remove self)', () => {
    expect(canRemoveMember('member', 'member', true)).toBe(true);
  });

  test('member cannot remove other members', () => {
    expect(canRemoveMember('member', 'member', false)).toBe(false);
  });
});

describe('Invitation history display', () => {
  test('isPendingInvitation is true when acceptedAt is null', () => {
    expect(isPendingInvitation(null)).toBe(true);
  });

  test('isPendingInvitation is false when acceptedAt is set', () => {
    expect(isPendingInvitation(new Date().toISOString())).toBe(false);
  });

  test('isActiveCollaborator is true when acceptedAt is set', () => {
    expect(isActiveCollaborator(new Date().toISOString())).toBe(true);
  });

  test('isActiveCollaborator is false when acceptedAt is null', () => {
    expect(isActiveCollaborator(null)).toBe(false);
  });
});

describe('Project collaboration permissions', () => {
  test('edit permission allows editing', () => {
    expect(canEditProject('edit')).toBe(true);
  });

  test('view permission does not allow editing', () => {
    expect(canEditProject('view')).toBe(false);
  });
});

// Page access helpers
function canAccessPage(
  isOwner: boolean,
  acceptedAt: string | null,
  isGroupMember: boolean
): boolean {
  if (isOwner) return true;
  if (acceptedAt !== null) return true;
  if (isGroupMember) return true;
  return false;
}

function canEditPage(permission: 'view' | 'edit'): boolean {
  return permission === 'edit';
}

describe('Page access logic', () => {
  test('page owner can access page', () => {
    expect(canAccessPage(true, null, false)).toBe(true);
  });

  test('user with accepted individual invitation can access page', () => {
    expect(canAccessPage(false, new Date().toISOString(), false)).toBe(true);
  });

  test('group member can access page shared with their group', () => {
    expect(canAccessPage(false, null, true)).toBe(true);
  });

  test('outsider without invite or group membership cannot access page', () => {
    expect(canAccessPage(false, null, false)).toBe(false);
  });

  test('pending invitee (acceptedAt null) and not group member cannot access page', () => {
    expect(canAccessPage(false, null, false)).toBe(false);
  });
});

describe('Page edit permissions', () => {
  test('edit permission on page allows editing', () => {
    expect(canEditPage('edit')).toBe(true);
  });

  test('view permission on page does not allow editing', () => {
    expect(canEditPage('view')).toBe(false);
  });
});

// Email-based invitation helpers
function isEmailOnlyCollaborator(userId: string | null): boolean {
  return userId === null;
}

function collaboratorDisplayName(email: string, fullName: string | null): string {
  return fullName ?? email;
}

function isAcceptedCollaborator(acceptedAt: string | null, userId: string | null): boolean {
  return acceptedAt !== null && userId !== null;
}

describe('Email-only (non-user) invitation logic', () => {
  test('isEmailOnlyCollaborator is true when user_id is null', () => {
    expect(isEmailOnlyCollaborator(null)).toBe(true);
  });

  test('isEmailOnlyCollaborator is false when user_id is set', () => {
    expect(isEmailOnlyCollaborator('some-user-id')).toBe(false);
  });

  test('collaboratorDisplayName falls back to email when fullName is null', () => {
    expect(collaboratorDisplayName('user@example.com', null)).toBe('user@example.com');
  });

  test('collaboratorDisplayName returns fullName when available', () => {
    expect(collaboratorDisplayName('user@example.com', 'Jane Doe')).toBe('Jane Doe');
  });

  test('isAcceptedCollaborator is true when both accepted_at and user_id are set', () => {
    expect(isAcceptedCollaborator(new Date().toISOString(), 'some-user-id')).toBe(true);
  });

  test('isAcceptedCollaborator is false when accepted_at is null (pending)', () => {
    expect(isAcceptedCollaborator(null, null)).toBe(false);
  });

  test('isAcceptedCollaborator is false when user_id is null (email-only, not yet accepted)', () => {
    expect(isAcceptedCollaborator(new Date().toISOString(), null)).toBe(false);
  });
});
