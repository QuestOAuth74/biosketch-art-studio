/**
 * Mock Resend API for testing edge functions
 * Simulates Resend email sending without making actual API calls
 */

export interface EmailSendParams {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export interface EmailSendResponse {
  id: string;
  from: string;
  to: string[];
  created_at: string;
}

export interface EmailCall {
  params: EmailSendParams;
  response: EmailSendResponse;
  timestamp: number;
}

/**
 * Mock Resend class that mimics the real Resend API
 */
export class MockResend {
  private calls: EmailCall[] = [];
  private shouldFail: boolean = false;
  private failureError: Error | null = null;

  constructor() {
    this.calls = [];
    this.shouldFail = false;
  }

  /**
   * Mock emails.send method
   */
  emails = {
    send: async (params: EmailSendParams): Promise<EmailSendResponse> => {
      // Simulate API failure if configured
      if (this.shouldFail) {
        throw this.failureError || new Error('Mock Resend API error');
      }

      // Create mock response
      const response: EmailSendResponse = {
        id: `mock-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: params.from,
        to: params.to,
        created_at: new Date().toISOString(),
      };

      // Record the call
      this.calls.push({
        params,
        response,
        timestamp: Date.now(),
      });

      return response;
    },
  };

  /**
   * Configure mock to fail on next send
   */
  setFailure(error?: Error): void {
    this.shouldFail = true;
    this.failureError = error || new Error('Mock Resend API error');
  }

  /**
   * Reset failure state
   */
  clearFailure(): void {
    this.shouldFail = false;
    this.failureError = null;
  }

  /**
   * Get all recorded email send calls
   */
  getAllCalls(): EmailCall[] {
    return [...this.calls];
  }

  /**
   * Get the most recent email send call
   */
  getLastCall(): EmailCall | null {
    return this.calls.length > 0 ? this.calls[this.calls.length - 1] : null;
  }

  /**
   * Get number of calls made
   */
  getCallCount(): number {
    return this.calls.length;
  }

  /**
   * Clear all recorded calls
   */
  clearCalls(): void {
    this.calls = [];
  }

  /**
   * Reset the mock to initial state
   */
  reset(): void {
    this.calls = [];
    this.shouldFail = false;
    this.failureError = null;
  }

  /**
   * Check if an email was sent to a specific address
   */
  wasSentTo(email: string): boolean {
    return this.calls.some((call) => call.params.to.includes(email));
  }

  /**
   * Check if an email with a specific subject was sent
   */
  wasSentWithSubject(subject: string): boolean {
    return this.calls.some((call) => call.params.subject === subject);
  }

  /**
   * Get all emails sent to a specific address
   */
  getEmailsTo(email: string): EmailCall[] {
    return this.calls.filter((call) => call.params.to.includes(email));
  }

  /**
   * Get all emails with a specific subject
   */
  getEmailsWithSubject(subject: string): EmailCall[] {
    return this.calls.filter((call) => call.params.subject === subject);
  }
}

/**
 * Create a new mock Resend instance
 */
export function createMockResend(): MockResend {
  return new MockResend();
}
