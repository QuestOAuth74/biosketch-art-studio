import { describe, test, expect } from 'vitest';

// ─── Logic extracted for unit testing ───────────────────────────────────────

type NotifChannel = 'in_app' | 'email';
type PrefsMap = Record<string, Record<NotifChannel, boolean>>;

const DEFAULT_PREFS: PrefsMap = {
  group_invitation:   { in_app: true, email: true },
  project_invitation: { in_app: true, email: true },
  page_invitation:    { in_app: true, email: true },
  comment_new:        { in_app: true, email: true },
  comment_reply:      { in_app: true, email: true },
  project_locked:     { in_app: true, email: false },
};

function shouldNotify(prefs: PrefsMap, type: string, channel: NotifChannel): boolean {
  const pref = prefs[type];
  if (!pref) return true; // Unknown type defaults to enabled
  return pref[channel] !== false;
}

function mergeWithDefaults(saved: Partial<PrefsMap>, defaults: PrefsMap): PrefsMap {
  const merged: PrefsMap = { ...defaults };
  for (const [key, val] of Object.entries(saved)) {
    merged[key] = { ...(defaults[key] ?? { in_app: true, email: true }), ...val };
  }
  return merged;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('shouldNotify', () => {
  test('returns true when in_app is true', () => {
    expect(shouldNotify(DEFAULT_PREFS, 'group_invitation', 'in_app')).toBe(true);
  });

  test('returns false when email is false for project_locked', () => {
    expect(shouldNotify(DEFAULT_PREFS, 'project_locked', 'email')).toBe(false);
  });

  test('returns true when in_app is true for project_locked', () => {
    expect(shouldNotify(DEFAULT_PREFS, 'project_locked', 'in_app')).toBe(true);
  });

  test('returns false when email disabled for group_invitation', () => {
    const prefs: PrefsMap = {
      ...DEFAULT_PREFS,
      group_invitation: { in_app: true, email: false },
    };
    expect(shouldNotify(prefs, 'group_invitation', 'email')).toBe(false);
  });

  test('returns true for in_app when email is disabled', () => {
    const prefs: PrefsMap = {
      ...DEFAULT_PREFS,
      group_invitation: { in_app: true, email: false },
    };
    expect(shouldNotify(prefs, 'group_invitation', 'in_app')).toBe(true);
  });

  test('unknown event type defaults to true for both channels', () => {
    expect(shouldNotify(DEFAULT_PREFS, 'future_event_type', 'in_app')).toBe(true);
    expect(shouldNotify(DEFAULT_PREFS, 'future_event_type', 'email')).toBe(true);
  });

  test('returns true for all channels when all defaults are true', () => {
    const types = ['group_invitation', 'project_invitation', 'page_invitation', 'comment_new', 'comment_reply'];
    types.forEach((t) => {
      expect(shouldNotify(DEFAULT_PREFS, t, 'in_app')).toBe(true);
      expect(shouldNotify(DEFAULT_PREFS, t, 'email')).toBe(true);
    });
  });
});

describe('mergeWithDefaults', () => {
  test('fills in missing keys from defaults', () => {
    const saved: Partial<PrefsMap> = {
      group_invitation: { in_app: false, email: true },
    };
    const merged = mergeWithDefaults(saved, DEFAULT_PREFS);
    // Overridden key
    expect(merged.group_invitation.in_app).toBe(false);
    // Missing keys should come from defaults
    expect(merged.project_invitation).toEqual(DEFAULT_PREFS.project_invitation);
    expect(merged.comment_new).toEqual(DEFAULT_PREFS.comment_new);
  });

  test('does not overwrite saved values', () => {
    const saved: Partial<PrefsMap> = {
      comment_new:   { in_app: false, email: false },
      comment_reply: { in_app: true, email: false },
    };
    const merged = mergeWithDefaults(saved, DEFAULT_PREFS);
    expect(merged.comment_new.in_app).toBe(false);
    expect(merged.comment_new.email).toBe(false);
    expect(merged.comment_reply.email).toBe(false);
  });

  test('new event types in saved prefs are preserved', () => {
    const saved: Partial<PrefsMap> = {
      new_future_event: { in_app: true, email: false },
    };
    const merged = mergeWithDefaults(saved, DEFAULT_PREFS);
    expect(merged.new_future_event).toBeDefined();
    expect(merged.new_future_event.email).toBe(false);
  });

  test('result contains all default keys', () => {
    const merged = mergeWithDefaults({}, DEFAULT_PREFS);
    Object.keys(DEFAULT_PREFS).forEach((key) => {
      expect(merged).toHaveProperty(key);
    });
  });
});
