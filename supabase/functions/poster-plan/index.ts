// ============================================================================
// poster-plan edge function — Stage 2 of Poster-from-Doc
// ============================================================================
// Runs a single gemini-2.5-flash pass on the parsed .docx content to draft a
// full scientific-poster layout plan:
//
//   * Title / authors / affiliation extracted from the manuscript.
//   * A one-sentence key takeaway (shown as a headline on the poster).
//   * 4-6 sections (Introduction / Methods / Results / Discussion / etc.)
//     with 2-4 bullet points each, ready to render into panel bodies.
//   * A figures inventory — every figure the poster needs — annotated as
//     either "embedded" (reuse image N from the doc) or "generate" (Stage 4
//     will draw it via gemini-3-pro-image).
//   * A cross-check block. The planner is asked in the SAME call to review
//     its own output for empty sections / missing key results / mismatched
//     figures, so we don't need a separate credit for verification.
//
// Cost: 1 credit, tagged as `poster-plan`. Stage 3 (figure generation) is
// charged separately, 1 credit per "generate" figure. Total credit disclosure
// happens on the client after this call returns.
//
// Regenerate mode: not supported here — replanning is cheap enough that the
// user re-uploads the doc if they need a fresh plan.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { waitingPeriodResponseForUser } from '../_shared/aiCredits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FigureEntry {
  caption: string;
  source: 'embedded' | 'generate';
  embeddedIndex?: number;
  generatePrompt?: string;
}

interface PosterPlan {
  title: string;
  authors: string;
  affiliation: string;
  keyTakeaway: string;
  sections: {
    name: string;
    bullets: string[];
    figureIdx?: number;
  }[];
  figures: FigureEntry[];
  crossCheck: {
    ok: boolean;
    issues: string[];
  };
}

// Response schema — tight enough that flash almost always returns valid JSON.
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    authors: { type: 'string' },
    affiliation: { type: 'string' },
    keyTakeaway: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
          figureIdx: { type: 'integer' },
        },
        required: ['name', 'bullets'],
      },
    },
    figures: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          caption: { type: 'string' },
          source: { type: 'string', enum: ['embedded', 'generate'] },
          embeddedIndex: { type: 'integer' },
          generatePrompt: { type: 'string' },
        },
        required: ['caption', 'source'],
      },
    },
    crossCheck: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
      },
      required: ['ok', 'issues'],
    },
  },
  required: ['title', 'authors', 'keyTakeaway', 'sections', 'figures', 'crossCheck'],
};

/**
 * Coerce the model's JSON into a strict PosterPlan. flash mostly obeys
 * responseSchema but we still defensively clamp counts and defaults so a
 * slightly-off plan renders without crashing the client.
 */
function normalizePlan(raw: any, docImageCount: number): PosterPlan {
  const asStringArray = (v: any, cap: number): string[] =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((s) => s.length > 0).slice(0, cap)
      : [];

  const sections = Array.isArray(raw?.sections)
    ? raw.sections
        .map((s: any) => ({
          name: typeof s?.name === 'string' ? s.name.substring(0, 60) : '',
          bullets: asStringArray(s?.bullets, 6),
          figureIdx:
            Number.isFinite(Number(s?.figureIdx)) && Number(s.figureIdx) >= 0
              ? Number(s.figureIdx)
              : undefined,
        }))
        .filter((s: any) => s.name.length > 0)
        .slice(0, 8)
    : [];

  const figures: FigureEntry[] = Array.isArray(raw?.figures)
    ? raw.figures
        .map((f: any): FigureEntry | null => {
          const caption = typeof f?.caption === 'string' ? f.caption.substring(0, 240) : '';
          if (!caption) return null;
          const source = f?.source === 'embedded' ? 'embedded' : 'generate';
          if (source === 'embedded') {
            const idx = Number(f?.embeddedIndex);
            // Bound to available images or drop the entry.
            if (!Number.isFinite(idx) || idx < 0 || idx >= docImageCount) return null;
            return { caption, source: 'embedded', embeddedIndex: idx };
          }
          const prompt = typeof f?.generatePrompt === 'string' ? f.generatePrompt.substring(0, 400) : '';
          if (!prompt) return null;
          return { caption, source: 'generate', generatePrompt: prompt };
        })
        .filter((x: FigureEntry | null): x is FigureEntry => x !== null)
        .slice(0, 8)
    : [];

  const crossCheck = raw?.crossCheck && typeof raw.crossCheck === 'object'
    ? {
        ok: raw.crossCheck.ok === true,
        issues: asStringArray(raw.crossCheck.issues, 6),
      }
    : { ok: true, issues: [] };

  return {
    title: typeof raw?.title === 'string' ? raw.title.substring(0, 240) : 'Untitled poster',
    authors: typeof raw?.authors === 'string' ? raw.authors.substring(0, 240) : '',
    affiliation: typeof raw?.affiliation === 'string' ? raw.affiliation.substring(0, 240) : '',
    keyTakeaway: typeof raw?.keyTakeaway === 'string' ? raw.keyTakeaway.substring(0, 320) : '',
    sections,
    figures,
    crossCheck,
  };
}

function buildPlannerPrompt(
  text: string,
  sections: string[],
  imageCount: number,
  notes: string,
  embeddedOnly: boolean,
): string {
  const sectionsHint =
    sections.length > 0
      ? '\nDetected headings in the manuscript (use as section names when they fit): ' + sections.join(', ')
      : '';
  const imagesHint = embeddedOnly
    ? imageCount > 0
      ? `\nEMBEDDED-ONLY MODE — the user has asked you to use ONLY the ${imageCount} embedded image${imageCount === 1 ? '' : 's'} (indexed 0..${imageCount - 1}). Do NOT mark any figure with source: "generate". Every entry in the figures array must have source: "embedded" and a valid embeddedIndex. If some sections don't have a natural figure to attach, leave figureIdx unset for that section rather than inventing a figure.`
      : `\nEMBEDDED-ONLY MODE — the user has asked to skip AI figure generation, but the manuscript contains NO embedded images. Return figures as an empty array and set crossCheck.ok = false with a note in issues explaining this.`
    : imageCount > 0
      ? `\nThe manuscript already contains ${imageCount} embedded image${imageCount === 1 ? '' : 's'}, indexed 0..${imageCount - 1}. Prefer to REUSE those (source: "embedded", embeddedIndex: N) rather than regenerating — only mark a figure "generate" when a needed panel is not present.`
      : `\nThe manuscript has no embedded images — every figure will need to be generated.`;
  const notesBlock = notes.trim().length > 0 ? '\n\nAdditional layout notes from the user:\n' + notes.trim() : '';

  return [
    'You are the planner for a landscape A0 scientific poster.',
    'Read the manuscript below and produce a JSON plan that a downstream renderer will execute.',
    '',
    'REQUIRED OUTPUT (strict JSON — no prose):',
    '- title: the paper\'s title. Trim any journal/DOI suffix.',
    '- authors: authors in normal reading order, comma-separated.',
    '- affiliation: primary institution string; empty string if unclear.',
    '- keyTakeaway: ONE sentence of 15-25 words. Plain language, aimed at a poster session attendee walking by. Not a question. Not a list.',
    '- sections: 4-6 poster sections in reading order. Standard set: Introduction / Methods / Results / Discussion / Conclusion. Optionally include Abstract at the top and References / Acknowledgements at the end.',
    '  * name: 1-3 words. "Introduction", "Methods", "Results", "Key Findings" — not full sentences.',
    '  * bullets: 2-4 bullets per section. STRICTLY 8-16 words per bullet. Bullets within a section must feel like a set — similar length (within +/- 5 words of each other), similar grammatical form (all noun phrases OR all short sentences, not mixed).',
    '  * Each section may reference ONE figure by index into the `figures` array via `figureIdx`.',
    '- figures: 3-6 figures the poster should contain, in reading order.',
    '  * Each figure has a `caption` (one short sentence).',
    '  * Each figure has a `source`: "embedded" (reuse manuscript image, requires embeddedIndex) or "generate" (new figure, requires generatePrompt).',
    '  * generatePrompt is a concrete description a scientific illustrator can execute — e.g. "Signaling cascade from EGFR at plasma membrane through Ras/Raf/MEK/ERK1/2 to nuclear transcription factor ELK1".',
    '- crossCheck: ok (true if plan looks complete) and issues (list of concerns).',
    '',
    'CROSS-CHECK your own plan before returning. Set ok=false and populate `issues` if:',
    '- Any section has fewer than 2 bullets.',
    '- Any single bullet exceeds 20 words or falls under 6 words.',
    '- Bullet lengths within one section vary by more than 8 words.',
    '- Any section name is longer than 3 words.',
    '- Results section has no figure attached.',
    embeddedOnly
      ? '- Any figure has source "generate" (embedded-only mode is enforced).'
      : '- More than 2 figures marked "generate" while embedded images are unused.',
    '- keyTakeaway is longer than one sentence OR outside the 15-25 word range.',
    sectionsHint,
    imagesHint,
    notesBlock,
    '',
    'MANUSCRIPT TEXT (truncated to first 12k characters):',
    text.substring(0, 12_000),
  ].join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let generationId: string | null = null;
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    supabaseForRefund = supabase;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const {
      text,
      sections,
      imageCount,
      notes,
      embeddedOnly,
    } = body ?? {};

    if (typeof text !== 'string' || text.trim().length < 100) {
      throw new Error('text must be at least 100 characters');
    }
    if (typeof imageCount !== 'number' || imageCount < 0 || imageCount > 60) {
      throw new Error('imageCount must be a non-negative integer <= 60');
    }
    const sectionList: string[] = Array.isArray(sections)
      ? sections.map((s: any) => (typeof s === 'string' ? s : '')).filter((s: string) => s.length > 0).slice(0, 30)
      : [];
    const notesStr = typeof notes === 'string' ? notes : '';

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    // ── Credit deduction ─────────────────────────────────────────────────────
    const { data: deductedId, error: deductError } = await supabase.rpc(
      'deduct_ai_generation',
      { p_user_id: user.id, p_feature: 'poster-plan' },
    );
    if (deductError) {
      if (deductError.message?.includes('INSUFFICIENT_CREDITS')) {
        return new Response(
          JSON.stringify({ success: false, error: 'INSUFFICIENT_CREDITS' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (deductError.message?.includes('WAITING_PERIOD')) {
        return await waitingPeriodResponseForUser(supabase, user.id, corsHeaders);
      }
      throw deductError;
    }
    generationId = deductedId as string;

    const plannerPrompt = buildPlannerPrompt(text, sectionList, imageCount, notesStr, embeddedOnly === true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: plannerPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: PLAN_SCHEMA,
            temperature: 0.25,
          },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`[poster-plan] Gemini error ${geminiResponse.status}:`, errorText);
      if (geminiResponse.status === 429) throw new Error('RATE_LIMITED');
      throw new Error('AI API error: ' + geminiResponse.status);
    }

    const geminiData = await geminiResponse.json();
    const textPart = geminiData?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p.text === 'string');
    if (!textPart) throw new Error('Planner returned no text');

    let parsed: any;
    try {
      parsed = JSON.parse(textPart.text);
    } catch {
      console.error('[poster-plan] JSON parse failed. Raw:', textPart.text.substring(0, 400));
      throw new Error('Planner returned invalid JSON');
    }

    const plan = normalizePlan(parsed, imageCount);

    // Belt + suspenders: even with the prompt directive, flash occasionally
    // sneaks in a "generate" entry. In embeddedOnly mode we hard-strip them
    // and reindex any figureIdx references so the client never sees a
    // "generate" figure it shouldn't render.
    if (embeddedOnly === true) {
      const keep: number[] = [];
      const filteredFigures = plan.figures.filter((f, i) => {
        if (f.source === 'embedded') {
          keep.push(i);
          return true;
        }
        return false;
      });
      const oldToNew = new Map<number, number>();
      keep.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));
      plan.figures = filteredFigures;
      plan.sections = plan.sections.map((s) => {
        if (typeof s.figureIdx !== 'number') return s;
        const remapped = oldToNew.get(s.figureIdx);
        return { ...s, figureIdx: remapped };
      });
      if (imageCount === 0) {
        plan.crossCheck = {
          ok: false,
          issues: [
            'Embedded-only mode is on, but the document has no embedded images.',
            ...plan.crossCheck.issues,
          ].slice(0, 6),
        };
      }
    }

    if (plan.sections.length === 0) {
      throw new Error('Planner produced an empty plan — try a longer or more specific manuscript');
    }

    // Non-blocking usage log.
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      await supabase.from('ai_generation_usage').insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: plan.title.substring(0, 200),
        style: 'poster-plan',
        generation_type: 'poster',
      });
    } catch (usageErr) {
      console.error('[poster-plan] usage insert failed:', usageErr);
    }

    console.log(`[poster-plan] user=${user.id} sections=${plan.sections.length} figures=${plan.figures.length} generate=${plan.figures.filter((f) => f.source === 'generate').length} ok=${plan.crossCheck.ok}`);

    // Success — clear generationId so the top-level catch doesn't refund.
    generationId = null;

    return new Response(
      JSON.stringify({ success: true, plan }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[poster-plan] Error:', error);

    if (generationId && supabaseForRefund) {
      try {
        await supabaseForRefund.rpc('refund_ai_generation', { p_generation_id: generationId });
      } catch (refundErr) {
        console.error('[poster-plan] Refund failed:', refundErr);
      }
    }

    let status = 500;
    if (error.message === 'RATE_LIMITED') status = 429;
    if (error.message === 'Unauthorized') status = 401;

    return new Response(
      JSON.stringify({ success: false, error: error.message ?? 'Unknown error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
