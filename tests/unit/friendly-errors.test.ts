/**
 * Unit tests for the friendly error message mapper.
 */
import { describe, it, expect } from 'vitest';
import { toFriendlyError } from '../../src/lib/friendly-errors';

describe('toFriendlyError', () => {
  describe('Edge Function / Serverless errors', () => {
    it('maps "Edge Function returned an error"', () => {
      expect(toFriendlyError('Edge Function returned an error')).toBe(
        'Something went wrong on our end. Please try again in a moment.'
      );
    });

    it('maps "Edge Function returned a non-2xx status code"', () => {
      expect(toFriendlyError('Edge Function returned a non-2xx status code')).toBe(
        'Something went wrong on our end. Please try again in a moment.'
      );
    });

    it('maps "FunctionsHttpError: Edge Function invocation failed"', () => {
      expect(toFriendlyError('FunctionsHttpError: Edge Function invocation failed')).toBe(
        'Something went wrong on our end. Please try again in a moment.'
      );
    });

    it('maps internal server error', () => {
      expect(toFriendlyError('Internal Server Error')).toBe(
        'Something went wrong on our end. Please try again in a moment.'
      );
    });
  });

  describe('Network / Connectivity errors', () => {
    it('maps "Failed to fetch"', () => {
      expect(toFriendlyError('Failed to fetch')).toBe(
        'Connection issue. Please check your internet and try again.'
      );
    });

    it('maps "TypeError: NetworkError when attempting to fetch resource"', () => {
      expect(toFriendlyError('TypeError: NetworkError when attempting to fetch resource')).toBe(
        'Connection issue. Please check your internet and try again.'
      );
    });

    it('maps "FetchError: request to ... failed"', () => {
      expect(toFriendlyError('FetchError: request to https://example.com failed')).toBe(
        'Connection issue. Please check your internet and try again.'
      );
    });

    it('maps network timeout', () => {
      expect(toFriendlyError('Network timeout during save')).toBe(
        'The request timed out. Please check your connection and try again.'
      );
    });

    it('maps load failed', () => {
      expect(toFriendlyError('Load failed')).toBe(
        'Connection issue. Please check your internet and try again.'
      );
    });
  });

  describe('Auth / Session errors', () => {
    it('maps JWT expired', () => {
      expect(toFriendlyError('JWT expired')).toBe(
        'Your session has expired. Please sign in again.'
      );
    });

    it('maps token expired', () => {
      expect(toFriendlyError('Invalid Refresh Token: Already Used')).toBe(
        'Your session has expired. Please sign in again.'
      );
    });

    it('maps not authenticated', () => {
      expect(toFriendlyError('not authenticated')).toBe(
        'You need to be signed in to do this.'
      );
    });

    it('maps invalid credentials', () => {
      expect(toFriendlyError('Invalid login credentials')).toBe(
        'Invalid email or password. Please try again.'
      );
    });

    it('maps email already registered', () => {
      expect(toFriendlyError('User already registered')).toContain('already exists');
    });

    it('maps rate limiting', () => {
      expect(toFriendlyError('Rate limit exceeded, too many requests')).toBe(
        'Too many attempts. Please wait a moment and try again.'
      );
    });

    it('maps email not confirmed', () => {
      expect(toFriendlyError('Email not confirmed')).toBe(
        'Please verify your email before signing in. Check your inbox.'
      );
    });
  });

  describe('Database / Storage errors', () => {
    it('maps RLS errors', () => {
      expect(toFriendlyError('new row violates row-level security policy')).toBe(
        "You don't have permission to perform this action."
      );
    });

    it('maps 403 permission denied', () => {
      expect(toFriendlyError('403 Forbidden')).toBe(
        "You don't have permission to perform this action."
      );
    });

    it('maps payload too large', () => {
      expect(toFriendlyError('Payload too large')).toBe(
        'The data is too large. Try reducing the content and saving again.'
      );
    });

    it('maps duplicate key', () => {
      expect(toFriendlyError('duplicate key value violates unique constraint')).toBe(
        'This item already exists. Please use a different name.'
      );
    });

    it('maps PostgREST errors', () => {
      expect(toFriendlyError('PGRST116: The result contains 0 rows')).toBe(
        'Something went wrong with the database. Please try again.'
      );
    });
  });

  describe('CORS errors', () => {
    it('maps cross-origin errors', () => {
      expect(toFriendlyError('Cross-origin request blocked')).toBe(
        'A resource could not be loaded due to security restrictions. Please try re-uploading it.'
      );
    });

    it('maps CORS policy errors', () => {
      expect(toFriendlyError('Blocked by CORS policy')).toBe(
        'A resource could not be loaded due to security restrictions. Please try re-uploading it.'
      );
    });
  });

  describe('Generic / edge cases', () => {
    it('maps [object Object]', () => {
      expect(toFriendlyError('[object Object]')).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('maps TypeError stack traces', () => {
      expect(toFriendlyError('TypeError: Cannot read properties of undefined')).toBe(
        'Something unexpected happened. Please try again.'
      );
    });

    it('maps very long messages to generic error', () => {
      const longMessage = 'A'.repeat(250);
      expect(toFriendlyError(longMessage)).toBe(
        'Something went wrong. Please try again.'
      );
    });

    it('maps null/undefined/empty to generic error', () => {
      expect(toFriendlyError(null)).toBe('Something went wrong. Please try again.');
      expect(toFriendlyError(undefined)).toBe('Something went wrong. Please try again.');
      expect(toFriendlyError('')).toBe('Something went wrong. Please try again.');
      expect(toFriendlyError('   ')).toBe('Something went wrong. Please try again.');
    });

    it('passes through already-friendly messages unchanged', () => {
      expect(toFriendlyError('Failed to save project')).toBe('Failed to save project');
      expect(toFriendlyError('Please select an object first')).toBe('Please select an object first');
      expect(toFriendlyError('Canvas name cannot be empty')).toBe('Canvas name cannot be empty');
    });

    it('maps JSON string bodies to generic error', () => {
      expect(toFriendlyError('{"error":"some_code","message":"details"}')).toBe(
        'Something went wrong. Please try again.'
      );
    });
  });
});
