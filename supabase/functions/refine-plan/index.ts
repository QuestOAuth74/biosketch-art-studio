// ============================================================================
// refine-plan edge function — planner for FigureLabs-style chat refinement
// ============================================================================
// Runs a cheap gemini-2.5-flash pass on {previous image, user request, recent
// chat} and returns a small JSON edit plan the client uses to route the actual
// image call:
//
//   scope="local"  → client builds an auto rectangle mask from `region` and
//                    fires refine-image mode=region (pixel-lock outside mask
//                    via compositeWithMask).
//   scope="global" → client fires ai-illustrator refineChat with the returned
//                    `preserve` string injected as a hard constraint.
//   scope="fresh"  → client fires ai-illustrator normal generate (user is
//                    asking for a new subject, not an edit).
//
// The planner does NOT charge a credit — cost is absorbed into the refine
// feature so users don't get double-billed for the plan + image.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanRegion { x0: number; y0: number; x1: number; y1: number; }
interface Plan {
  scope: 'local' | 'global' | 'fresh';
  region: PlanRegion | null;
  changeSummary: string;
  preserve: string;
  reasoning: string;
}

/**
 * Coerce the model's JSON into a strict Plan. gemini-2.5-flash mostly obeys
 * responseSchema but occasionally returns strings for numbers or missing keys.
 * We clamp and default rather than throw so a slightly malformed plan still
 * lets the client fall back to global-refine.
 */
function normalizePlan(raw: any): Plan {
  const scope = (raw?.scope === 'local' || raw?.scope === 'global' || raw?.scope === 'fresh')
    ? raw.scope
    : 'global';

  let region: PlanRegion | null = null;
  if (scope === 'local' && raw?.region && typeof raw.region === 'object') {
    const clamp = (v: any) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(1, n));
    };
    const x0 = clamp(raw.region.x0);
    const y0 = clamp(raw.region.y0);
    const x1 = clamp(raw.region.x1);
    const y1 = clamp(raw.region.y1);
    if (x0 !== null && y0 !== null && x1 !== null && y1 !== null && x1 > x0 && y1 > y0) {
      region = { x0, y0, x1, y1 };
    }
  }

  return {
    // If we said local but couldn't parse a region, downgrade to global so the
    // client doesn't try to build an empty mask.
    scope: scope === 'local' && !region ? 'global' : scope,
    region,
    changeSummary: typeof raw?.changeSummary === 'string' ? raw.changeSummary.substring(0, 240) : '',
    preserve: typeof raw?.preserve === 'string' ? raw.preserve.substring(0, 240) : '',
    reasoning: typeof raw?.reasoning === 'string' ? raw.reasoning.substring(0, 240) : '',
  };
}

function buildPlannerPrompt(userPrompt: string, chatHistory: any[]): string {
  const historyText = Array.isArray(chatHistory) && chatHistory.length > 0
    ? '\n\nRecent conversation (oldest first):\n' +
      chatHistory.slice(-6).map((t: any) => {
        const role = t?.role === 'assistant' ? 'AI' : 'User';
        const text = typeof t?.text === 'string' ? t.text.substring(0, 200) : '';
        return `- ${role}: ${text}`;
      }).join('\n')
    : '';

  return [
    'You are the PLANNER for a scientific figure refinement tool.',
    'You are shown the CURRENT figure (attached image) and the user\'s next request.',
    'Your job: classify the edit and mark the region so the executor knows what to preserve.',
    '',
    'CLASSIFICATION:',
    '- "local"  = change affects ONE identifiable region (e.g. "make the mitochondrion blue", "remove the label X", "add an arrow to Y", "change the nucleus shape").',
    '             region MUST be set — a tight axis-aligned box around only the affected area, with ~5% padding.',
    '- "global" = change affects MOST of the image (e.g. "recolor everything to warm palette", "restyle in Nature journal look", "add outlines to all shapes").',
    '             region = null.',
    '- "fresh"  = user wants a DIFFERENT subject, not an edit (e.g. "now show a neuron instead", "generate a mitochondrion").',
    '             region = null.',
    '',
    'PREFER "local" WHEN POSSIBLE. Only pick global if the change genuinely touches most of the image.',
    '',
    'REGION FORMAT: axis-aligned bounding box in NORMALIZED coordinates (0.0-1.0), top-left origin.',
    '  x0 = left edge, y0 = top edge, x1 = right edge, y1 = bottom edge.',
    '  Must satisfy 0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1.',
    '  Tight around the affected element, plus ~5% padding on each side.',
    '',
    'RESPOND WITH ONLY JSON matching this schema — no prose:',
    '{',
    '  "scope": "local" | "global" | "fresh",',
    '  "region": { "x0": <float>, "y0": <float>, "x1": <float>, "y1": <float> } | null,',
    '  "changeSummary": "<one short sentence: what will change>",',
    '  "preserve": "<one sentence: what must stay pixel-identical>",',
    '  "reasoning": "<one sentence justifying the scope choice>"',
    '}',
    historyText,
    '',
    'USER REQUEST:',
    userPrompt,
  ].join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { previousImage, prompt, chatHistory } = body ?? {};

    if (!previousImage || typeof previousImage !== 'string' || !previousImage.startsWith('data:image/')) {
      throw new Error('previousImage must be a data URL (data:image/...)');
    }
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Missing prompt');
    }

    const dataUrlMatch = previousImage.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
    if (!dataUrlMatch) throw new Error('previousImage data URL malformed');
    const [, imgMime, imgBase64] = dataUrlMatch;

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    const plannerPrompt = buildPlannerPrompt(prompt, Array.isArray(chatHistory) ? chatHistory : []);

    // gemini-2.5-flash with structured output. Short timeout — planner should
    // return in well under 3s; longer usually means it's off the rails.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: plannerPrompt },
              { inlineData: { mimeType: imgMime, data: imgBase64 } },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                scope: { type: 'string', enum: ['local', 'global', 'fresh'] },
                region: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    x0: { type: 'number' },
                    y0: { type: 'number' },
                    x1: { type: 'number' },
                    y1: { type: 'number' },
                  },
                },
                changeSummary: { type: 'string' },
                preserve: { type: 'string' },
                reasoning: { type: 'string' },
              },
              required: ['scope', 'changeSummary', 'preserve', 'reasoning'],
            },
            temperature: 0.2, // Low — this is a classifier, not creative work.
          },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`[refine-plan] Gemini error ${geminiResponse.status}:`, errorText);
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
      // Rare — schema mode nearly always returns valid JSON. Fall back to a
      // safe "global" plan so the client still runs the refine.
      console.warn('[refine-plan] JSON parse failed, falling back to global. Raw:', textPart.text.substring(0, 200));
      parsed = {
        scope: 'global',
        region: null,
        changeSummary: prompt.substring(0, 100),
        preserve: 'The overall composition, subject, and style of the figure.',
        reasoning: 'Planner output was not valid JSON; falling back to global refine.',
      };
    }

    const plan = normalizePlan(parsed);

    console.log(`[refine-plan] user=${user.id} scope=${plan.scope} region=${plan.region ? 'yes' : 'no'}`);

    return new Response(
      JSON.stringify({ success: true, plan }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[refine-plan] Error:', error);
    let status = 500;
    if (error.message === 'RATE_LIMITED') status = 429;
    if (error.message === 'Unauthorized') status = 401;
    return new Response(
      JSON.stringify({ success: false, error: error.message ?? 'Unknown error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
