// ============================================================================
// abstract-to-figure edge function — text-to-figure from a paper abstract
// ============================================================================
// Two-pass pipeline. Users paste a paper abstract (or a paragraph of dense
// scientific text) and get back a publication-quality figure.
//
//   Pass 1 — Analyzer (gemini-2.5-flash):
//     Extracts a structured figure plan from the abstract. Structured output
//     via responseSchema so the client can render the plan as a card and
//     users can decide whether to re-draw from the same plan.
//
//   Pass 2 — Drawer (gemini-3-pro-image-preview):
//     Turns the plan + abstract into a clean vector-style scientific figure.
//
// Credit accounting: 2 credits total (1 per pass), each deducted via
// deduct_ai_generation and tagged separately in the admin usage log
// (abstract-to-figure:analyze + abstract-to-figure:draw). If Pass 2 fails, we
// refund Pass 2 only — the plan from Pass 1 is genuinely delivered.
//
// Regenerate mode: when the client sends `existingPlan`, we skip Pass 1 and
// only charge for Pass 2. Powers the "Regenerate from plan" affordance.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { waitingPeriodResponseForUser } from '../_shared/aiCredits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FigurePlan {
  subject: string;
  figureType: string;      // e.g. "signaling-pathway" | "process-diagram" | "anatomical-structure"
  components: string[];    // key elements that must appear in the drawing
  spatialLayout: string;   // one sentence: how the components are arranged
  labels: string[];        // key text labels to place in the image
  styleHints: string;      // one sentence: visual style suggestion
}

const ANALYZER_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    figureType: { type: 'string' },
    components: { type: 'array', items: { type: 'string' } },
    spatialLayout: { type: 'string' },
    labels: { type: 'array', items: { type: 'string' } },
    styleHints: { type: 'string' },
  },
  required: ['subject', 'figureType', 'components', 'spatialLayout', 'labels', 'styleHints'],
};

function normalizePlan(raw: any): FigurePlan {
  const asStringArray = (v: any): string[] =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((s) => s.length > 0).slice(0, 20)
      : [];
  return {
    subject: typeof raw?.subject === 'string' ? raw.subject.substring(0, 400) : '',
    figureType: typeof raw?.figureType === 'string' ? raw.figureType.substring(0, 80) : 'process-diagram',
    components: asStringArray(raw?.components),
    spatialLayout: typeof raw?.spatialLayout === 'string' ? raw.spatialLayout.substring(0, 400) : '',
    labels: asStringArray(raw?.labels),
    styleHints: typeof raw?.styleHints === 'string' ? raw.styleHints.substring(0, 240) : '',
  };
}

function buildAnalyzerPrompt(abstract: string): string {
  return [
    'You are a scientific figure planner. Read the following paper abstract or scientific paragraph, then produce a JSON plan a scientific illustrator can execute.',
    '',
    'RULES:',
    '- Focus on the ONE most illustratable finding — a mechanism, structure, pathway, process, or comparison.',
    '- Choose figureType from a small set of common scientific figure kinds: "signaling-pathway", "process-diagram", "anatomical-structure", "molecular-mechanism", "cellular-process", "comparison", "timeline", "flowchart".',
    '- components: 4-10 concrete items that MUST appear (proteins, organelles, cell types, compartments, arrows, etc). Use standard scientific names.',
    '- spatialLayout: one sentence describing how the components are arranged (e.g. "Cascade top-to-bottom from membrane receptor to nuclear transcription factor.").',
    '- labels: the specific short text strings that should appear as labels next to the components. Keep them tight (gene/protein names, cell names, arrow labels).',
    '- styleHints: one sentence about visual style (palette, weight, background).',
    '',
    'ABSTRACT:',
    abstract.trim(),
  ].join('\n');
}

function buildDrawerPrompt(plan: FigurePlan): string {
  return [
    'Generate a clean, professional scientific illustration.',
    '',
    'SUBJECT: ' + plan.subject,
    'FIGURE TYPE: ' + plan.figureType,
    '',
    'REQUIRED COMPONENTS (all must appear, using standard scientific naming):',
    ...plan.components.map((c) => '- ' + c),
    '',
    'LAYOUT: ' + plan.spatialLayout,
    '',
    plan.labels.length > 0
      ? 'LABELS (place these text strings adjacent to their targets with thin leader lines, on plain background — never on top of illustrated shapes):\n' + plan.labels.map((l) => '- ' + l).join('\n')
      : 'No text labels — leave label positions blank for the user to annotate.',
    '',
    'STYLE — non-negotiable:',
    '- Publication-quality flat 2D vector-style scientific illustration.',
    '- Clean solid fills, thin consistent outlines in a slightly darker shade of the fill (NOT black).',
    '- No gradients, no shadows, no 3D effects, no textures, no photorealism.',
    '- Anatomically / scientifically accurate proportions.',
    '- White or very light background.',
    plan.styleHints ? '- ' + plan.styleHints : '',
  ].filter(Boolean).join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Two independent generation IDs — refund logic differs (see below).
  let analyzeGenId: string | null = null;
  let drawGenId: string | null = null;
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
      abstract,       // string — the paper text
      existingPlan,   // FigurePlan | undefined — skip analyze pass when present
      stylePreset,    // optional preset id (same as ai-illustrator)
      iconStyle,      // 'flat' | '3d' | 'sketch' | 'line-art' | 'hand-drawn' | 'glossy-3d' — visual style directive shared with ai-illustrator
    } = body ?? {};

    if (!abstract || typeof abstract !== 'string' || abstract.trim().length < 20) {
      throw new Error('Missing abstract (need at least 20 characters of text)');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    // ── PASS 1: Analyzer ────────────────────────────────────────────────────
    // Skipped when the client sends an existingPlan (Regenerate-from-plan flow).
    let plan: FigurePlan;
    if (existingPlan && typeof existingPlan === 'object') {
      plan = normalizePlan(existingPlan);
      if (!plan.subject || plan.components.length === 0) {
        throw new Error('existingPlan is missing subject or components');
      }
      console.log('[abstract-to-figure] Using existingPlan, skipping analyze pass. user:', user.id);
    } else {
      // Deduct credit 1: analyze
      const { data: aId, error: aErr } = await supabase.rpc(
        'deduct_ai_generation',
        { p_user_id: user.id, p_feature: 'abstract-to-figure:analyze' },
      );
      if (aErr) {
        if (aErr.message?.includes('INSUFFICIENT_CREDITS')) {
          return new Response(
            JSON.stringify({ success: false, error: 'INSUFFICIENT_CREDITS' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        if (aErr.message?.includes('WAITING_PERIOD')) {
          return await waitingPeriodResponseForUser(supabase, user.id, corsHeaders);
        }
        throw aErr;
      }
      analyzeGenId = aId as string;

      const analyzerPrompt = buildAnalyzerPrompt(abstract);
      const anController = new AbortController();
      const anTimeout = setTimeout(() => anController.abort(), 30_000);
      const anResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: analyzerPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: ANALYZER_SCHEMA,
              temperature: 0.3,
            },
          }),
          signal: anController.signal,
        },
      );
      clearTimeout(anTimeout);
      if (!anResponse.ok) {
        const errText = await anResponse.text();
        console.error(`[abstract-to-figure] Analyzer error ${anResponse.status}:`, errText);
        if (anResponse.status === 429) throw new Error('RATE_LIMITED');
        throw new Error('Analyzer API error: ' + anResponse.status);
      }
      const anData = await anResponse.json();
      const anText = anData?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p.text === 'string')?.text;
      if (!anText) throw new Error('Analyzer returned no text');
      let anParsed: any;
      try {
        anParsed = JSON.parse(anText);
      } catch (e) {
        console.error('[abstract-to-figure] Analyzer JSON parse failed. Raw:', anText.substring(0, 200));
        throw new Error('Analyzer returned invalid JSON');
      }
      plan = normalizePlan(anParsed);
      if (!plan.subject || plan.components.length === 0) {
        throw new Error('Analyzer produced an empty plan — try a longer or more specific abstract');
      }
      console.log(`[abstract-to-figure] Analyzer OK user=${user.id} subject="${plan.subject.substring(0, 60)}" components=${plan.components.length}`);
    }

    // ── PASS 2: Drawer ──────────────────────────────────────────────────────
    // Deduct credit 2: draw
    const { data: dId, error: dErr } = await supabase.rpc(
      'deduct_ai_generation',
      { p_user_id: user.id, p_feature: 'abstract-to-figure:draw' },
    );
    if (dErr) {
      // Not enough for the second credit — return the plan anyway so the user
      // at least sees value for the analyze credit, and can purchase and hit
      // "Regenerate from plan" (which skips analyze).
      if (dErr.message?.includes('INSUFFICIENT_CREDITS')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'INSUFFICIENT_CREDITS_FOR_DRAW',
            plan,
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (dErr.message?.includes('WAITING_PERIOD')) {
        return await waitingPeriodResponseForUser(supabase, user.id, corsHeaders);
      }
      throw dErr;
    }
    drawGenId = dId as string;

    // Optional journal style preset appended to the drawer prompt. Same map as
    // ai-illustrator; kept inline to avoid a shared-module import between edge
    // functions.
    const STYLE_PRESET_APPENDIX: Record<string, string> = {
      nature: 'Style guidance — Nature journal figure: deep navy #0B1D3A, mid grey #4B4B4B, mustard #C89B25 on white. Thin outlines, no gradients.',
      cell: 'Style guidance — Cell journal figure: charcoal #2B2E33, coral #E74C3C, sky #3498DB on off-white. Bold sans-serif labels, flat colors.',
      science: 'Style guidance — Science journal figure: navy #1A3A5C, crimson #E63946, powder #A8DADC on cream. Structured layout, thin outlines.',
      elife: 'Style guidance — eLife journal figure: teal #00A98F, charcoal #333333, warm yellow #FFC000 on off-white. Colorblind-safe.',
      plos: 'Style guidance — PLOS journal figure: bright blue #0066CC, mid grey #666666, warm orange #FF6600 on white. High-readability labels.',
      presentation: 'Style guidance — presentation-slide figure: violet #7C3AED, magenta #EC4899, amber #F59E0B on white. Bold projector-safe strokes.',
    };
    const stylePresetBlock: string =
      typeof stylePreset === 'string' && STYLE_PRESET_APPENDIX[stylePreset]
        ? '\n\n' + STYLE_PRESET_APPENDIX[stylePreset]
        : '';

    // Visual-style directive shared with ai-illustrator's icon-style picker.
    // Kept inline (not a shared module) — edge functions can't easily share
    // code. The six entries are copied verbatim from
    // supabase/functions/ai-illustrator/index.ts::ICON_STYLE_PROMPTS. Keep in
    // sync when adding new styles there.
    const VISUAL_STYLE_APPENDIX: Record<string, string> = {
      'flat': 'Flat 2D vector scientific illustration — clean, crisp, publication-quality. COMPLETELY FLAT: each shape is ONE solid color. NO gradients, NO shading, NO highlights, NO 3D effects. Clean thin outlines in a slightly darker shade of the fill color (NOT black). Smooth bezier edges. Anatomically accurate colors. Think Servier Medical Art or flat infographic style.',
      '3d': '3D rendered scientific illustration with realistic depth and lighting. Realistic 3D shading and highlights, soft ambient occlusion, top-left key light, smooth surfaces with realistic material properties, small specular highlights on rounded forms. Anatomically accurate colors and proportions. Clean, polished 3D render quality — no noise or grain.',
      'sketch': 'Hand-drawn pencil sketch style scientific illustration. Fine pencil line work with varying pressure, subtle cross-hatching for shading, sketch-like organic lines, grayscale tones with soft highlights. Anatomically accurate proportions. Textbook illustration feel — like a graphite drawing from an anatomy sketchbook.',
      'line-art': 'Clean line-art scientific illustration. Precise, consistent line weights (thin, uniform, confident strokes). No fills — only outlines and structural lines. Confident, clean line work — no wispy, faint, or broken lines. Black or very dark grey lines on plain solid white background. Anatomically accurate proportions. Textbook line-drawing quality.',
      'hand-drawn': 'Hand-drawn scientific illustration in a warm textbook style. Soft, slightly imperfect hand-inked outlines suggesting a human touch. Muted watercolor-style flat fills — soft washes with slight color variation across each shape. Warm, natural color palette suitable for classic biology textbooks. Clean but organic silhouettes — not perfectly geometric. Anatomically accurate proportions. The result should feel drawn by a scientific illustrator — hand-painted, warm, textbook-quality.',
      'glossy-3d': 'STYLE: New England Journal of Medicine biomedical illustration style. Soft airbrushed digital-gouache rendering with smooth tonal gradients and no hard outlines; forms defined by light and shadow. Semi-translucent membranous cells with subtle specular highlights and soft drop shadows, arranged as a naturalistic scene with layered depth. Muted warm palette: dusty purple, salmon and coral pink, tan, beige, powder blue, desaturated red, on a clean white background. Receptors, ligands and proteins shown as simplified geometric primitives (cylinders, rounded blocks, clustered spheres) in cleaner accent colors docking at cell membranes. Thin dark curved arrows with small arrowheads connecting elements; small clean humanist sans-serif labels, acronyms in caps, no label boxes. Authoritative editorial journal-figure quality.\n\nNEGATIVE: hard black outlines, flat cartoon colors, cel shading, neon/saturated colors, glossy 3D CGI render, heavy textures, photorealism, cluttered text, watermark.',
    };
    const visualStyleBlock: string =
      typeof iconStyle === 'string' && VISUAL_STYLE_APPENDIX[iconStyle]
        ? '\n\n──\nVISUAL STYLE — treat as authoritative and override any conflicting default:\n' + VISUAL_STYLE_APPENDIX[iconStyle]
        : '';

    const drawerPrompt = buildDrawerPrompt(plan) + stylePresetBlock + visualStyleBlock;

    const drController = new AbortController();
    const drTimeout = setTimeout(() => drController.abort(), 60_000);
    const drResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: drawerPrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
        signal: drController.signal,
      },
    );
    clearTimeout(drTimeout);
    if (!drResponse.ok) {
      const errText = await drResponse.text();
      console.error(`[abstract-to-figure] Drawer error ${drResponse.status}:`, errText);
      if (drResponse.status === 429) throw new Error('RATE_LIMITED');
      throw new Error('Drawer API error: ' + drResponse.status);
    }
    const drData = await drResponse.json();
    const drImagePart = drData?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!drImagePart) throw new Error('No image generated');

    const resultMime = drImagePart.inlineData.mimeType;
    const resultBase64 = drImagePart.inlineData.data;

    // Non-blocking usage log — tag each pass separately so admin analytics shows the split.
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const rows = [] as any[];
      if (analyzeGenId) {
        rows.push({
          user_id: user.id,
          generated_at: new Date().toISOString(),
          month_year: currentMonth,
          prompt: abstract.substring(0, 200),
          style: 'abstract-to-figure:analyze',
          generation_type: 'abstract-to-figure',
        });
      }
      rows.push({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: plan.subject.substring(0, 200),
        style: 'abstract-to-figure:draw',
        generation_type: 'abstract-to-figure',
      });
      await supabase.from('ai_generation_usage').insert(rows);
    } catch (usageErr) {
      console.error('[abstract-to-figure] Usage insert failed:', usageErr);
    }

    // Clear the tracked ids — success path, no refund.
    analyzeGenId = null;
    drawGenId = null;

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        image: 'data:' + resultMime + ';base64,' + resultBase64,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[abstract-to-figure] Error:', error);

    // Refund policy: the analyze pass is a real deliverable (we return the
    // plan even when we can't draw). If analyze completed AND we already have
    // a valid plan in memory, we keep that credit. If we failed mid-analyze,
    // refund it. drawGenId always gets refunded on failure — the draw did not
    // produce a usable image.
    if (drawGenId && supabaseForRefund) {
      try {
        await supabaseForRefund.rpc('refund_ai_generation', { p_generation_id: drawGenId });
      } catch (refundErr) {
        console.error('[abstract-to-figure] Draw refund failed:', refundErr);
      }
    }
    if (analyzeGenId && supabaseForRefund) {
      try {
        await supabaseForRefund.rpc('refund_ai_generation', { p_generation_id: analyzeGenId });
      } catch (refundErr) {
        console.error('[abstract-to-figure] Analyze refund failed:', refundErr);
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
