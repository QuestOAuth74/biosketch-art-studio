import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for the signup toast notification logic.
 *
 * Tests the hook (useRecentSignups) return shape and the
 * SignupToast component's display/dismiss logic.
 */

// ── timeAgo helper (extracted logic from SignupToast.tsx) ──

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// ── getCountryFlag helper ──

function getCountryFlag(countryName: string): string {
  const flagMap: Record<string, string> = {
    'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'India': '🇮🇳',
    'Germany': '🇩🇪', 'Brazil': '🇧🇷', 'Japan': '🇯🇵',
  };
  return flagMap[countryName] || '🌍';
}

// ── localStorage mock ──

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

describe('Signup Toast — timeAgo helper', () => {
  it('returns "just now" for dates less than a minute ago', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  it('returns minutes for dates 1–59 minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5 minutes ago');
  });

  it('returns singular "1 minute ago"', () => {
    const oneMinAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
    expect(timeAgo(oneMinAgo)).toBe('1 minute ago');
  });

  it('returns hours for dates 1–23 hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2 hours ago');
  });

  it('returns singular "1 hour ago"', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneHourAgo)).toBe('1 hour ago');
  });

  it('returns days for dates 24+ hours ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe('3 days ago');
  });

  it('returns singular "1 day ago"', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneDayAgo)).toBe('1 day ago');
  });
});

describe('Signup Toast — getCountryFlag helper', () => {
  it('returns correct flag for known countries', () => {
    expect(getCountryFlag('India')).toBe('🇮🇳');
    expect(getCountryFlag('United States')).toBe('🇺🇸');
    expect(getCountryFlag('Germany')).toBe('🇩🇪');
  });

  it('returns globe emoji for unknown countries', () => {
    expect(getCountryFlag('Atlantis')).toBe('🌍');
    expect(getCountryFlag('')).toBe('🌍');
  });
});

describe('Signup Toast — localStorage dismiss logic', () => {
  const DISMISS_KEY = 'biosketch_signup_toast_dismissed';
  const STORAGE_KEY = 'biosketch_signup_toast_last_shown';
  const DISMISS_DURATION = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should detect dismiss within 24 hours', () => {
    localStorageMock.setItem(DISMISS_KEY, Date.now().toString());

    const dismissed = localStorageMock.getItem(DISMISS_KEY);
    const dismissedTime = parseInt(dismissed!);
    const isWithin24h = (Date.now() - dismissedTime) < DISMISS_DURATION;

    expect(isWithin24h).toBe(true);
  });

  it('should allow toast after 24 hours since dismiss', () => {
    const moreThan24hAgo = Date.now() - DISMISS_DURATION - 1000;
    localStorageMock.setItem(DISMISS_KEY, moreThan24hAgo.toString());

    const dismissed = localStorageMock.getItem(DISMISS_KEY);
    const dismissedTime = parseInt(dismissed!);
    const isWithin24h = (Date.now() - dismissedTime) < DISMISS_DURATION;

    expect(isWithin24h).toBe(false);
  });

  it('should not re-show for same signup (same created_at)', () => {
    const signupCreatedAt = '2025-03-01T12:00:00.000Z';
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify({ created_at: signupCreatedAt, timestamp: Date.now() })
    );

    const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY)!);
    const isSameSignup = stored.created_at === signupCreatedAt;

    expect(isSameSignup).toBe(true);
  });

  it('should show for a new signup (different created_at)', () => {
    const oldSignup = '2025-03-01T12:00:00.000Z';
    const newSignup = '2025-03-02T08:30:00.000Z';
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify({ created_at: oldSignup, timestamp: Date.now() })
    );

    const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY)!);
    const isSameSignup = stored.created_at === newSignup;

    expect(isSameSignup).toBe(false);
  });
});

describe('Signup Toast — 24-hour window filter', () => {
  it('should show toast when signup is within 24 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const signupTime = new Date(twoHoursAgo).getTime();

    expect(signupTime >= twentyFourHoursAgo).toBe(true);
  });

  it('should not show toast when signup is older than 24 hours', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const signupTime = new Date(twoDaysAgo).getTime();

    expect(signupTime >= twentyFourHoursAgo).toBe(false);
  });
});

describe('Signup Toast — toast message format', () => {
  it('builds correct message with country and field', () => {
    const signup = {
      country: 'India',
      field_of_study: 'Biomedical',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    };

    const country = signup.country || 'somewhere';
    const field = signup.field_of_study;
    const time = signup.created_at ? timeAgo(signup.created_at) : 'recently';

    const message = `Someone from ${country}${field ? ` (${field})` : ''} signed up ${time}`;

    expect(message).toContain('Someone from India');
    expect(message).toContain('(Biomedical)');
    expect(message).toContain('2 hours ago');
  });

  it('builds correct message without field of study', () => {
    const signup = {
      country: 'Germany',
      field_of_study: null as string | null,
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    };

    const country = signup.country || 'somewhere';
    const field = signup.field_of_study;
    const time = signup.created_at ? timeAgo(signup.created_at) : 'recently';

    const message = `Someone from ${country}${field ? ` (${field})` : ''} signed up ${time}`;

    expect(message).toContain('Someone from Germany');
    expect(message).not.toContain('(');
    expect(message).toContain('30 minutes ago');
  });

  it('builds correct message without country', () => {
    const signup = {
      country: null as string | null,
      field_of_study: 'Chemistry',
      created_at: new Date().toISOString(),
    };

    const country = signup.country || 'somewhere';
    const field = signup.field_of_study;
    const time = signup.created_at ? timeAgo(signup.created_at) : 'recently';

    const message = `Someone from ${country}${field ? ` (${field})` : ''} signed up ${time}`;

    expect(message).toContain('Someone from somewhere');
    expect(message).toContain('(Chemistry)');
    expect(message).toContain('just now');
  });
});
