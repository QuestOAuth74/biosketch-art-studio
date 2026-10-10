/**
 * Maps raw technical error messages to user-friendly alternatives.
 *
 * Used by the toast layer so every error shown to users is human-readable,
 * regardless of whether the caller remembered to write a nice message.
 */

interface ErrorPattern {
  /** Regex or substring to match against the raw message (case-insensitive). */
  test: RegExp;
  /** The friendly message to show instead. */
  friendly: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // ── Edge Function / Serverless ──
  {
    test: /edge function/i,
    friendly: 'Something went wrong on our end. Please try again in a moment.',
  },
  {
    test: /function.*returned.*error/i,
    friendly: 'Something went wrong on our end. Please try again in a moment.',
  },
  {
    test: /functions.*invoke/i,
    friendly: 'Something went wrong on our end. Please try again in a moment.',
  },
  {
    test: /internal server error|500/i,
    friendly: 'Something went wrong on our end. Please try again in a moment.',
  },

  // ── Network / Connectivity ──
  {
    test: /failed to fetch|fetch.*error|networkerror/i,
    friendly: 'Connection issue. Please check your internet and try again.',
  },
  {
    test: /network.*timeout|timeout.*network|ETIMEDOUT|ECONNREFUSED/i,
    friendly: 'The request timed out. Please check your connection and try again.',
  },
  {
    test: /ERR_INTERNET_DISCONNECTED|ERR_NETWORK/i,
    friendly: 'You appear to be offline. Please check your internet connection.',
  },
  {
    test: /load failed|net::ERR_/i,
    friendly: 'Connection issue. Please check your internet and try again.',
  },

  // ── Auth / Session ──
  {
    test: /jwt.*expired|token.*expired|refresh_token|invalid.*refresh.*token/i,
    friendly: 'Your session has expired. Please sign in again.',
  },
  {
    test: /not authenticated|unauthorized|401/i,
    friendly: 'You need to be signed in to do this.',
  },
  {
    test: /invalid.*credentials|invalid.*password|invalid.*email/i,
    friendly: 'Invalid email or password. Please try again.',
  },
  {
    test: /email.*already.*registered|already.*registered|already.*exists|duplicate.*key.*email|user.*already/i,
    friendly: 'An account with this email already exists. Try signing in instead.',
  },
  {
    test: /email.*not.*confirmed|email.*not.*verified/i,
    friendly: 'Please verify your email before signing in. Check your inbox.',
  },
  {
    test: /rate.*limit|too many requests|429/i,
    friendly: 'Too many attempts. Please wait a moment and try again.',
  },

  // ── Database / Storage ──
  {
    test: /row.*level.*security|RLS|permission denied|403/i,
    friendly: 'You don\'t have permission to perform this action.',
  },
  {
    test: /payload.*too large|request.*entity.*too large|413/i,
    friendly: 'The data is too large. Try reducing the content and saving again.',
  },
  {
    test: /storage.*quota|quota.*exceeded/i,
    friendly: 'Storage limit reached. Please delete some files to free up space.',
  },
  {
    test: /duplicate.*key|unique.*constraint|already exists/i,
    friendly: 'This item already exists. Please use a different name.',
  },
  {
    test: /foreign.*key|referenced.*by/i,
    friendly: 'This item is still in use. Remove references to it first.',
  },
  {
    test: /PGRST|postgrest/i,
    friendly: 'Something went wrong with the database. Please try again.',
  },

  // ── CORS / Cross-origin ──
  {
    test: /cross-origin|cors|blocked by.*policy/i,
    friendly: 'A resource could not be loaded due to security restrictions. Please try re-uploading it.',
  },

  // ── Generic catch-all for very technical messages ──
  {
    test: /^\[object Object\]$/,
    friendly: 'Something went wrong. Please try again.',
  },
  {
    test: /^TypeError:|^SyntaxError:|^RangeError:|^ReferenceError:/,
    friendly: 'Something unexpected happened. Please try again.',
  },
];

/**
 * Convert a raw error message to a user-friendly version.
 *
 * If the message is already friendly (doesn't match any technical pattern),
 * it is returned as-is.
 */
export function toFriendlyError(raw: string | undefined | null): string {
  if (!raw || raw.trim() === '') {
    return 'Something went wrong. Please try again.';
  }

  const trimmed = raw.trim();

  for (const { test, friendly } of ERROR_PATTERNS) {
    if (test.test(trimmed)) {
      return friendly;
    }
  }

  // If the message looks overly technical (contains stack traces, code references,
  // or very long strings), replace it with a generic message.
  if (
    trimmed.length > 200 ||
    /\bat line \d|at [\w.]+\.ts|at [\w.]+\.js|\n\s+at /i.test(trimmed) ||
    /^{.*}$/s.test(trimmed) // Raw JSON objects
  ) {
    return 'Something went wrong. Please try again.';
  }

  return trimmed;
}
