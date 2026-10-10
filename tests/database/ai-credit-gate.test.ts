import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  createServiceRoleClient,
  createAuthenticatedClient,
  createTestUser,
  deleteTestUser,
} from '../utils/supabase-test-client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * E2E test for the 24h AI credit onboarding gate.
 *
 * Server-side is the source of truth — this file exercises the actual RPCs
 * the client would call:
 *   * is_within_gate_period(user_id) — the predicate
 *   * get_ai_generation_balance(user_id) — exposes gate.locked + unlock_at
 *   * deduct_ai_generation(user_id, feature) — raises WAITING_PERIOD when gated
 *
 * Four scenarios cover every branch of the gate rule:
 *   fresh signup, admin, past purchaser, >24h old user.
 */
describe('AI credit 24h gate', () => {
  const service = createServiceRoleClient();

  let freshUser:     { email: string; password: string; userId: string };
  let adminUser:     { email: string; password: string; userId: string };
  let purchaserUser: { email: string; password: string; userId: string };
  let oldUser:       { email: string; password: string; userId: string };

  /** Backdate a user's profile.created_at to simulate an older signup. */
  async function backdateProfile(userId: string, hoursAgo: number): Promise<void> {
    const backdated = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    const { error } = await service
      .from('profiles')
      .update({ created_at: backdated })
      .eq('id', userId);
    if (error) throw new Error(`Failed to backdate profile: ${error.message}`);
  }

  beforeAll(async () => {
    freshUser     = await createTestUser('gate-fresh');
    adminUser     = await createTestUser('gate-admin');
    purchaserUser = await createTestUser('gate-purchaser');
    oldUser       = await createTestUser('gate-old');

    // Admin: grant admin role so has_role() returns true.
    const { error: adminErr } = await service
      .from('user_roles')
      .insert({ user_id: adminUser.userId, role: 'admin' });
    if (adminErr) throw new Error(`Failed to grant admin: ${adminErr.message}`);

    // Purchaser: insert a synthetic Stripe purchase row so the gate predicate
    // sees them as "has ever paid". Uses a unique fake session id per run.
    const { error: purchaseErr } = await service
      .from('ai_credit_purchases')
      .insert({
        user_id: purchaserUser.userId,
        stripe_session_id: `test_gate_${Date.now()}_${purchaserUser.userId}`,
        amount_usd: 5,
        generations_granted: 50,
      });
    if (purchaseErr) throw new Error(`Failed to seed purchase: ${purchaseErr.message}`);

    // Old user: profile created 25h ago so they're past the 24h window.
    await backdateProfile(oldUser.userId, 25);
  });

  afterAll(async () => {
    // deleteTestUser cleans up profiles, user_roles, ai_generations, and
    // ai_credit_purchases via cascade — see tests/utils/supabase-test-client.ts.
    await Promise.all([
      deleteTestUser(freshUser.userId),
      deleteTestUser(adminUser.userId),
      deleteTestUser(purchaserUser.userId),
      deleteTestUser(oldUser.userId),
    ]);
  });

  // ── is_within_gate_period() predicate ────────────────────────────────────

  describe('is_within_gate_period()', () => {
    test('fresh non-admin non-purchaser signup → true', async () => {
      const { data, error } = await service.rpc('is_within_gate_period', {
        p_user_id: freshUser.userId,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    test('admin → false (bypass)', async () => {
      const { data, error } = await service.rpc('is_within_gate_period', {
        p_user_id: adminUser.userId,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    test('user with any purchase history → false (bypass)', async () => {
      const { data, error } = await service.rpc('is_within_gate_period', {
        p_user_id: purchaserUser.userId,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    test('user signed up >24h ago → false', async () => {
      const { data, error } = await service.rpc('is_within_gate_period', {
        p_user_id: oldUser.userId,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  // ── get_ai_generation_balance() surfaces gate to the client ──────────────

  describe('get_ai_generation_balance() → gate object', () => {
    test('fresh signup → gate.locked true, unlock_at is a valid future ISO', async () => {
      const client = await createAuthenticatedClient(freshUser.email, freshUser.password);
      const { data, error } = await client.rpc('get_ai_generation_balance', {
        p_user_id: freshUser.userId,
      });
      expect(error).toBeNull();
      expect(data.gate).toBeDefined();
      expect(data.gate.locked).toBe(true);
      expect(data.gate.unlock_at).toBeTruthy();
      const unlockMs = new Date(data.gate.unlock_at).getTime();
      const now = Date.now();
      // Must lift within the next 24h (with a small clock-skew tolerance).
      expect(unlockMs).toBeGreaterThan(now - 60_000);
      expect(unlockMs).toBeLessThanOrEqual(now + 24 * 60 * 60 * 1000 + 60_000);
    });

    test('admin → gate.locked false, unlock_at null', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const { data, error } = await client.rpc('get_ai_generation_balance', {
        p_user_id: adminUser.userId,
      });
      expect(error).toBeNull();
      expect(data.gate.locked).toBe(false);
      expect(data.gate.unlock_at).toBeNull();
    });

    test('past purchaser → gate.locked false', async () => {
      const client = await createAuthenticatedClient(
        purchaserUser.email,
        purchaserUser.password,
      );
      const { data, error } = await client.rpc('get_ai_generation_balance', {
        p_user_id: purchaserUser.userId,
      });
      expect(error).toBeNull();
      expect(data.gate.locked).toBe(false);
    });

    test('>24h old user → gate.locked false', async () => {
      const client = await createAuthenticatedClient(oldUser.email, oldUser.password);
      const { data, error } = await client.rpc('get_ai_generation_balance', {
        p_user_id: oldUser.userId,
      });
      expect(error).toBeNull();
      expect(data.gate.locked).toBe(false);
    });
  });

  // ── deduct_ai_generation() enforces the gate server-side ─────────────────

  describe('deduct_ai_generation() enforcement', () => {
    test('fresh signup → raises WAITING_PERIOD', async () => {
      const client = await createAuthenticatedClient(freshUser.email, freshUser.password);
      const { data, error } = await client.rpc('deduct_ai_generation', {
        p_user_id: freshUser.userId,
        p_feature: 'test-gate-fresh',
      });
      expect(data).toBeNull();
      expect(error).toBeDefined();
      expect(error?.message).toContain('WAITING_PERIOD');
    });

    test('admin → succeeds (returns generation UUID)', async () => {
      const client = await createAuthenticatedClient(adminUser.email, adminUser.password);
      const { data, error } = await client.rpc('deduct_ai_generation', {
        p_user_id: adminUser.userId,
        p_feature: 'test-gate-admin',
      });
      // Admins bypass the gate. NOTE: admin isn't unlimited via this RPC —
      // deduct_ai_generation just doesn't apply the WAITING_PERIOD to them.
      // (Real admin unlimited-access lives in can_user_generate, not here.)
      // So the deduct either succeeds with a UUID or fails INSUFFICIENT_CREDITS
      // if the admin somehow has no grant — either way it must NOT be WAITING_PERIOD.
      if (error) {
        expect(error.message).not.toContain('WAITING_PERIOD');
      } else {
        expect(typeof data).toBe('string');
        // Refund so we don't leave state behind.
        await client.rpc('refund_ai_generation', { p_generation_id: data });
      }
    });

    test('past purchaser → succeeds (returns generation UUID)', async () => {
      const client = await createAuthenticatedClient(
        purchaserUser.email,
        purchaserUser.password,
      );
      const { data, error } = await client.rpc('deduct_ai_generation', {
        p_user_id: purchaserUser.userId,
        p_feature: 'test-gate-purchaser',
      });
      expect(error).toBeNull();
      expect(typeof data).toBe('string');
      await client.rpc('refund_ai_generation', { p_generation_id: data });
    });

    test('>24h old user → succeeds (returns generation UUID)', async () => {
      const client = await createAuthenticatedClient(oldUser.email, oldUser.password);
      const { data, error } = await client.rpc('deduct_ai_generation', {
        p_user_id: oldUser.userId,
        p_feature: 'test-gate-old',
      });
      expect(error).toBeNull();
      expect(typeof data).toBe('string');
      await client.rpc('refund_ai_generation', { p_generation_id: data });
    });
  });
});
