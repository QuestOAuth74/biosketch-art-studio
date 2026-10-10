// Shared helpers for AI credit accounting.
//
// Every AI edge function should wrap its Gemini call like:
//   const r = await deductGeneration(supabase, userId, 'my-feature');
//   if (r.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
//   if (r.status === 'waiting')      return waitingPeriodResponse(r.unlockAt, corsHeaders);
//   const gid = r.id;
//   try {
//     // ... AI work
//   } catch (err) {
//     await refundGeneration(supabase, gid);
//     throw err;
//   }
//
// For features that produce multiple images per call (variants), pass the
// variant count — each variant is billed as one generation per product policy:
//   const b = await deductGenerationsBatch(supabase, userId, 'my-feature', variantCount);
//   if (b.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
//   if (b.status === 'waiting')      return waitingPeriodResponse(b.unlockAt, corsHeaders);
//   const generationIds = b.ids;

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

export type DeductResult =
  | { status: "ok"; id: string }
  | { status: "insufficient" }
  | { status: "waiting"; unlockAt: string | null };

export type DeductBatchResult =
  | { status: "ok"; ids: string[] }
  | { status: "insufficient" }
  | { status: "waiting"; unlockAt: string | null };

/**
 * Look up when the user's 24h gate lifts. Used to include unlock_at in the
 * WAITING_PERIOD response so the client can render a countdown.
 * Returns null if the profile row is missing.
 */
async function fetchUnlockAt(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single();
  if (error || !data?.created_at) return null;
  const created = new Date(data.created_at as string).getTime();
  return new Date(created + 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Deduct one generation. Returns a discriminated result: `ok` with the
 * generation_id (for later refund), `insufficient` if out of credits, or
 * `waiting` if the user is still inside the 24h onboarding gate.
 */
export async function deductGeneration(
  supabase: SupabaseClient,
  userId: string,
  feature: string,
): Promise<DeductResult> {
  const { data, error } = await supabase.rpc("deduct_ai_generation", {
    p_user_id: userId,
    p_feature: feature,
  });
  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) {
      return { status: "insufficient" };
    }
    if (error.message?.includes("WAITING_PERIOD")) {
      const unlockAt = await fetchUnlockAt(supabase, userId);
      return { status: "waiting", unlockAt };
    }
    throw error;
  }
  return { status: "ok", id: data as string };
}

/**
 * Deduct N generations. If credits run out or the gate trips mid-batch,
 * refunds whatever was already deducted and returns the corresponding status.
 */
export async function deductGenerationsBatch(
  supabase: SupabaseClient,
  userId: string,
  feature: string,
  count: number,
): Promise<DeductBatchResult> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = await deductGeneration(supabase, userId, feature);
    if (r.status === "ok") {
      ids.push(r.id);
      continue;
    }
    if (ids.length > 0) await refundGenerations(supabase, ids);
    if (r.status === "insufficient") return { status: "insufficient" };
    return { status: "waiting", unlockAt: r.unlockAt };
  }
  return { status: "ok", ids };
}

/**
 * Refund one previously-deducted generation. Safe to call with null/undefined
 * (idempotent no-op).
 */
export async function refundGeneration(
  supabase: SupabaseClient,
  generationId: string | null | undefined,
): Promise<void> {
  if (!generationId) return;
  try {
    await supabase.rpc("refund_ai_generation", { p_generation_id: generationId });
  } catch (err) {
    // Refund failure is logged but not thrown — the caller is already in an
    // error path and we don't want to mask the original error.
    console.error("[aiCredits] refund failed:", err);
  }
}

/** Refund a batch (all-or-nothing best effort). */
export async function refundGenerations(
  supabase: SupabaseClient,
  generationIds: string[],
): Promise<void> {
  await Promise.all(generationIds.map((id) => refundGeneration(supabase, id)));
}

/** Standard 402 response for out-of-credits. Frontend recognises this. */
export function insufficientCreditsResponse(corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ success: false, error: "INSUFFICIENT_CREDITS" }),
    {
      status: 402,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

/**
 * 429 response for the 24h onboarding gate. `unlockAt` is an ISO timestamp
 * (or null if we couldn't determine it — client falls back to a generic
 * "come back tomorrow" message).
 */
export function waitingPeriodResponse(
  unlockAt: string | null,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ success: false, error: "WAITING_PERIOD", unlock_at: unlockAt }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

/**
 * Convenience for edge functions that call `deduct_ai_generation` RPC directly
 * (not via `deductGeneration`) — fetches the unlock timestamp for the user and
 * builds the 429 response.
 */
export async function waitingPeriodResponseForUser(
  supabase: SupabaseClient,
  userId: string,
  corsHeaders: Record<string, string> = {},
): Promise<Response> {
  const unlockAt = await fetchUnlockAt(supabase, userId);
  return waitingPeriodResponse(unlockAt, corsHeaders);
}
