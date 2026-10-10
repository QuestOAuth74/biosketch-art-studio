/**
 * Test fixtures for send-email edge function
 * Provides payload generators for different email types
 */

export interface AuthEmailRequest {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change';
    site_url: string;
  };
}

/**
 * Create a signup email payload
 */
export function createSignupPayload(email: string = 'test@example.com'): AuthEmailRequest {
  return {
    user: {
      email,
    },
    email_data: {
      token: 'mock-token-123',
      token_hash: 'mock-hash-456',
      redirect_to: 'http://localhost:8080/projects',
      email_action_type: 'signup',
      site_url: 'http://localhost:8080',
    },
  };
}

/**
 * Create a recovery (password reset) email payload
 */
export function createRecoveryPayload(email: string = 'test@example.com'): AuthEmailRequest {
  return {
    user: {
      email,
    },
    email_data: {
      token: 'mock-recovery-token-789',
      token_hash: 'mock-recovery-hash-012',
      redirect_to: 'http://localhost:8080/auth',
      email_action_type: 'recovery',
      site_url: 'http://localhost:8080',
    },
  };
}

/**
 * Create an invite email payload
 */
export function createInvitePayload(email: string = 'invite@example.com'): AuthEmailRequest {
  return {
    user: {
      email,
    },
    email_data: {
      token: 'mock-invite-token-345',
      token_hash: 'mock-invite-hash-678',
      redirect_to: 'http://localhost:8080',
      email_action_type: 'invite',
      site_url: 'http://localhost:8080',
    },
  };
}

/**
 * Create a magic link email payload
 */
export function createMagicLinkPayload(email: string = 'magic@example.com'): AuthEmailRequest {
  return {
    user: {
      email,
    },
    email_data: {
      token: 'mock-magic-token-901',
      token_hash: 'mock-magic-hash-234',
      redirect_to: 'http://localhost:8080',
      email_action_type: 'magiclink',
      site_url: 'http://localhost:8080',
    },
  };
}

/**
 * Create an email change payload
 */
export function createEmailChangePayload(email: string = 'newemail@example.com'): AuthEmailRequest {
  return {
    user: {
      email,
    },
    email_data: {
      token: 'mock-change-token-567',
      token_hash: 'mock-change-hash-890',
      redirect_to: 'http://localhost:8080/profile',
      email_action_type: 'email_change',
      site_url: 'http://localhost:8080',
    },
  };
}

/**
 * Create a payload with missing required fields (for error testing)
 */
export function createInvalidPayload(): Partial<AuthEmailRequest> {
  return {
    user: undefined,
    email_data: undefined,
  };
}

/**
 * Create a payload with missing email
 */
export function createMissingEmailPayload(): Partial<AuthEmailRequest> {
  return {
    user: {
      email: undefined as any,
    },
    email_data: {
      token: 'mock-token',
      token_hash: 'mock-hash',
      redirect_to: 'http://localhost:8080',
      email_action_type: 'signup',
      site_url: 'http://localhost:8080',
    },
  };
}

/**
 * Create a payload with missing email_data
 */
export function createMissingEmailDataPayload(): Partial<AuthEmailRequest> {
  return {
    user: {
      email: 'test@example.com',
    },
    email_data: undefined as any,
  };
}
