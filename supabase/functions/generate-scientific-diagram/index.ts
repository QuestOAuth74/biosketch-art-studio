/**
 * generate-scientific-diagram — multi-agent scientific-diagram pipeline.
 * ----------------------------------------------------------------------
 * API ROUTE
 *   POST /functions/v1/generate-scientific-diagram   (verify_jwt = true)
 *   Body : { text, category }                       — fresh generation
 *        | { category, instruction, current }       — refine an existing one
 *   200  : { diagram: SciDiagram, meta }
 *   4xx/5xx: { error: string }
 *
 * PIPELINE
 *   prose ─▶ [1 PLANNER · pro] ─▶ plan
 *         ─▶ [2 DESIGNER · flash, responseSchema] ─▶ raw JSON
 *         ─▶ [GATEKEEPER · deterministic] ─┐
 *         ─▶ [3 REVIEWER · flash] ─────────┴▶ repair loop (≤3 designs)
 *         ─▶ normalise() ─▶ SciDiagram ─▶ client renderer
 *
 * Refine mode skips the Planner — the instruction is itself the plan.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { Category } from "./schema.ts";
import { runPlanner } from "./planner.ts";
import { runDesigner, DesignContext } from "./designer.ts";
import { runReviewer } from "./reviewer.ts";
import { validateRaw } from "./validate.ts";
import { normalise } from "./normalize.ts";
import {
  deductGeneration,
  deductGenerationsBatch,
  refundGeneration,
  refundGenerations,
  insufficientCreditsResponse,
  waitingPeriodResponse,
} from "../_shared/aiCredits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CATEGORIES: Category[] = ["cellular", "chemical", "physics", "lab"];

const PLANNER_MODEL = "gemini-2.5-pro";    // stronger model for scientific planning
const DESIGNER_MODEL = "gemini-2.5-flash"; // fast schema-constrained generation
const REVIEWER_MODEL = "gemini-2.5-flash";
const MAX_DESIGNS = 3;                     // 1 initial + up to 2 repairs

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── auth (anon client for getUser — matches the known-working functions) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Please sign in to use AI generation" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return json({
        error: userError
          ? `Authentication failed: ${userError.message}`
          : "Not signed in — please log in to generate diagrams.",
      }, 401);
    }

    // ── AI credits ──
    const { data: usage, error: rpcErr } = await supabase.rpc(
      "can_user_generate", { _user_id: user.id },
    );
    if (rpcErr) console.error("can_user_generate rpc error:", rpcErr.message);
    if (!usage?.canGenerate && !usage?.isAdmin) {
      return json({
        error: rpcErr
          ? `Credit check failed: ${rpcErr.message}`
          : "No AI credits remaining. Earn more by contributing icons or completing your profile.",
      }, 403);
    }

    // ── input — fresh generation or refine ──
    const { text, category, instruction, current } = await req.json();
    if (!CATEGORIES.includes(category)) return json({ error: "Unknown category" }, 400);
    const cat = category as Category;

    const isRefine =
      typeof instruction === "string" && instruction.trim().length >= 3 &&
      current && typeof current === "object";

    if (isRefine) {
      if (instruction.length > 600) {
        return json({ error: "Instruction too long (max 600 characters)" }, 400);
      }
    } else {
      if (!text || typeof text !== "string" || text.trim().length < 10) {
        return json({ error: "Provide at least 10 characters of scientific text" }, 400);
      }
      if (text.length > 4000) return json({ error: "Text too long (max 4000 characters)" }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "AI service not configured" }, 500);

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    supabaseForRefund = supabase;
    try {
      const dr = await deductGeneration(supabase, user.id, 'generate-scientific-diagram');
      if (dr.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (dr.status === 'waiting') return waitingPeriodResponse(dr.unlockAt, corsHeaders);
      const gid = dr.id;
      creditIds = [gid];
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    /* ═════════════════ multi-agent pipeline ═════════════════ */

    // 1 · PLANNER — skipped for refine (the instruction is the plan)
    const plan = isRefine
      ? null
      : await runPlanner(cat, text, PLANNER_MODEL, GEMINI_API_KEY);

    const ctx: DesignContext = {
      category: cat,
      prose: isRefine ? "" : text,
      plan,
      instruction: isRefine ? instruction : null,
      current: isRefine ? current : null,
    };
    const intent = isRefine ? instruction : text;

    // 2 · DESIGNER — first attempt
    let raw: unknown;
    try {
      raw = await runDesigner(ctx, [], DESIGNER_MODEL, GEMINI_API_KEY);
    } catch (e) {
      console.error("Designer failed", e);
      if (creditIds.length > 0) {
        await refundGenerations(supabase, creditIds);
      }
      return json({ error: e instanceof Error ? e.message : "Diagram generation failed" }, 502);
    }

    // GATEKEEPER + REVIEWER with a bounded repair loop
    let designs = 1;
    let lastReview: string[] = [];
    while (designs < MAX_DESIGNS) {
      const gate = validateRaw(cat, raw);
      if (!gate.ok) {
        try {
          raw = await runDesigner(ctx, gate.errors, DESIGNER_MODEL, GEMINI_API_KEY);
        } catch (e) { console.error("repair (gate) failed", e); break; }
        designs++;
        continue;
      }
      // 3 · REVIEWER — semantic critique
      const review = await runReviewer(cat, intent, raw, REVIEWER_MODEL, GEMINI_API_KEY);
      lastReview = review.issues;
      if (review.ok) break;
      try {
        raw = await runDesigner(ctx, review.issues, DESIGNER_MODEL, GEMINI_API_KEY);
      } catch (e) { console.error("repair (review) failed", e); break; }
      designs++;
    }

    // normalise → renderable SciDiagram (drops any residual dangling edges)
    let diagram;
    try {
      diagram = normalise(cat, raw);
    } catch (e) {
      console.error("Normalise failed", e);
      if (creditIds.length > 0) {
        await refundGenerations(supabase, creditIds);
      }
      return json({ error: "The generated diagram was malformed" }, 502);
    }

    // best-effort usage log
    try {
      await supabase.from("diagram_generations").insert({
        user_id: user.id,
        prompt: String(intent).slice(0, 500),
        diagram_type: `scientific-${cat}`,
      });
    } catch (_) { /* table optional — ignore */ }

    return json({
      diagram,
      meta: { planned: !!plan, designs, reviewIssues: lastReview },
    });
  } catch (e) {
    console.error("generate-scientific-diagram fatal", e);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }
    return json({ error: "Unexpected server error" }, 500);
  }
});
