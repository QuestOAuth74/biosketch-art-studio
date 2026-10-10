import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { generateStructuredDiagram, type StructuredMode } from "./structuredRenderer.ts";
import { waitingPeriodResponseForUser } from "../_shared/aiCredits.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STYLE_RULES = [
  'COMPLETELY FLAT. Each shape is ONE solid color. NO gradients, NO shading, NO highlights, NO shadows, NO 3D effects.',
  'Clean thin outlines in a slightly darker shade of the fill color (NOT black). Consistent outline weight.',
  'Smooth, perfectly curved bezier edges. Organic shapes simplified into clean, idealized geometric forms.',
  'NO texture, NO noise, NO grain, NO brush strokes, NO blurriness, NO 3D rendering.',
  'Use ANATOMICALLY ACCURATE colors. Scientific accuracy in proportions and key structural features.',
  'The result should look like a premium flat vector icon — crisp, modern, publication-quality.',
].join('\n- ');

// Icon-generator style presets — ports the admin Icon Factory (`admin-generate-icon`)
// stylePrompts so the public /ai-illustrator page can offer the same set of looks.
// Keyed by client-side ids: 'flat' | '3d' | 'sketch' | 'line-art' | 'hand-drawn'.
// Unknown keys fall back to 'flat'.
const ICON_STYLE_PROMPTS: Record<string, string> = {
  'flat': 'Flat 2D vector scientific illustration — clean, crisp, publication-quality.\n\n' +
    'QUALITY RULES:\n' +
    '- Render at the HIGHEST resolution and detail possible. Every edge must be crisp, smooth, and perfectly anti-aliased.\n' +
    '- Use ANATOMICALLY ACCURATE colors — red blood cells are red, arteries red, veins blue, liver dark reddish-brown, bone off-white/cream, muscle deep red, lungs pinkish, brain pinkish-grey, kidneys dark red-brown.\n' +
    '- Colors should be clean, vivid, and professional — NOT neon, NOT washed-out.\n\n' +
    'STYLE RULES — THIS IS CRITICAL:\n' +
    '- COMPLETELY FLAT. Each shape is ONE solid color. NO gradients, NO shading, NO highlights, NO shadows, NO 3D effects of any kind.\n' +
    '- Clean thin outlines in a slightly darker shade of the fill color (NOT black). Consistent outline weight throughout.\n' +
    '- Smooth, perfectly curved bezier edges — organic shapes simplified into clean, idealized geometric forms.\n' +
    '- Shapes are defined by solid flat fills and clean edges. NO specular highlights, NO lighting effects, NO depth.\n' +
    '- Internal structure suggested with minimal thin separator lines or contrasting flat color regions, NOT shading.\n' +
    '- The icon must be instantly recognizable and diagrammatically clear.\n' +
    '- NO texture, NO noise, NO grain, NO brush strokes, NO blurriness, NO 3D rendering.\n\n' +
    'The result should look like a premium flat vector icon — crisp, modern, completely flat solid colors, clean outlines, professional, publication-quality. Think Servier Medical Art or flat infographic style.\n\n' +
    'DO NOT: use gradients, 3D shading, highlights, shadows, specular reflections, depth effects, neon colors, drop shadows, or make it look like clip art.',

  '3d': '3D rendered scientific illustration with realistic depth and lighting.\n\n' +
    'Create with:\n' +
    '- Realistic 3D shading and highlights\n' +
    '- Soft ambient occlusion for depth\n' +
    '- Professional lighting setup (top-left key light)\n' +
    '- Smooth surfaces with realistic material properties\n' +
    '- Small specular highlights on rounded forms\n' +
    '- Anatomically accurate colors and proportions\n' +
    '- Scientific accuracy in structural features\n' +
    '- Clean, polished 3D render quality — no noise or grain\n' +
    '- The result should look like a premium 3D scientific icon rendered in a modeling program.',

  'sketch': 'Hand-drawn pencil sketch style scientific illustration.\n\n' +
    'Create with:\n' +
    '- Fine pencil line work with varying pressure\n' +
    '- Subtle cross-hatching for shading\n' +
    '- Sketch-like organic lines\n' +
    '- Grayscale tones with soft highlights\n' +
    '- Anatomically accurate proportions\n' +
    '- Textbook illustration feel — like a graphite drawing from an anatomy sketchbook.',

  'line-art': 'Clean line-art scientific illustration.\n\n' +
    'Create with:\n' +
    '- Precise, consistent line weights (thin, uniform, confident strokes)\n' +
    '- No fills. Only outlines and structural lines.\n' +
    '- Scientific diagram style with clear detail\n' +
    '- Confident, clean line work — no wispy, faint, or broken lines\n' +
    '- Black or very dark grey lines on plain solid white background\n' +
    '- Anatomically accurate proportions\n' +
    '- The result should look like a clean textbook line drawing.',

  'hand-drawn': 'Hand-drawn scientific illustration in a warm textbook style.\n\n' +
    'Create with:\n' +
    '- Soft, slightly imperfect hand-inked outlines suggesting a human touch\n' +
    '- Muted watercolor-style flat fills — soft washes with slight color variation across each shape\n' +
    '- Warm, natural color palette suitable for classic biology textbooks\n' +
    '- Clean but organic silhouettes — not perfectly geometric\n' +
    '- Anatomically accurate proportions\n' +
    '- The result should feel drawn by a scientific illustrator — hand-painted, warm, textbook-quality — not computer-generated.',

  'glossy-3d': 'STYLE: New England Journal of Medicine biomedical illustration style. Soft airbrushed digital-gouache rendering with smooth tonal gradients and no hard outlines; forms defined by light and shadow. Semi-translucent membranous cells with subtle specular highlights and soft drop shadows, arranged as a naturalistic scene with layered depth. Muted warm palette: dusty purple, salmon and coral pink, tan, beige, powder blue, desaturated red, on a clean white background. Receptors, ligands and proteins shown as simplified geometric primitives (cylinders, rounded blocks, clustered spheres) in cleaner accent colors docking at cell membranes. Thin dark curved arrows with small arrowheads connecting elements; small clean humanist sans-serif labels, acronyms in caps, no label boxes. Authoritative editorial journal-figure quality.\n\n' +
    'NEGATIVE: hard black outlines, flat cartoon colors, cel shading, neon/saturated colors, glossy 3D CGI render, heavy textures, photorealism, cluttered text, watermark.',
};

// ── Phase C — best-of-N reranking ──────────────────────────────────────────
// Modes that request `candidateCount: 2` and rerank server-side. Kept tight to
// the highest-value fresh-generation flows; refine-chat and other modes still
// use single-candidate to protect latency and cost.
const PHASE_C_MODES = new Set(['icon-generator', 'text-to-figure']);

// Rubric for the gemini-2.5-flash judge. Priority order matters — text
// detection is the killer rule because garbled text is Gemini's most common
// failure mode on scientific icons.
const PHASE_C_JUDGE_RUBRIC =
  'You are a critical scientific illustration reviewer. Pick the better of two candidate images (A or B) using this rubric in priority order:\n' +
  '1. TEXT: Reject candidates containing any visible text, letters, numbers, labels, callouts, or annotations. Text-free always wins over text-containing. If both have text, choose the one with less.\n' +
  '2. STANDALONE: Prefer a clean standalone illustration with no leader lines, arrows, dashed lines, or pointers.\n' +
  '3. COMPOSITION: Prefer well-framed, centered subjects with purposeful whitespace.\n' +
  '4. ANATOMY: Prefer accurate anatomical proportions and scientifically correct structural details.\n' +
  '5. STYLE FIDELITY: Prefer clean vector lines, consistent outline weight, publication-quality clarity.\n' +
  '6. ARTIFACTS: Reject candidates with rendering artifacts, blurriness, or noise.\n\n' +
  'Reply with a single character: "A" or "B". No other text.';

/**
 * Extracts every image candidate from a Gemini `generateContent` response.
 * Returns one image per candidate (first inline image part encountered).
 */
function extractImageCandidates(geminiData: any): Array<{ mimeType: string; data: string }> {
  const cands = geminiData?.candidates || [];
  const out: Array<{ mimeType: string; data: string }> = [];
  for (const c of cands) {
    const parts = c?.content?.parts || [];
    for (const p of parts) {
      if (p?.inlineData?.mimeType?.startsWith('image/')) {
        out.push({ mimeType: p.inlineData.mimeType, data: p.inlineData.data });
        break;
      }
    }
  }
  return out;
}

/**
 * LLM-judge over N image candidates. Returns the winning index. Falls back to
 * 0 (first candidate) on any failure — a slow or broken judge must never
 * block the request. Currently only ranks pairs; N>2 would need round-robin.
 */
async function rankCandidatesWithJudge(
  candidates: Array<{ mimeType: string; data: string }>,
  apiKey: string,
): Promise<number> {
  if (candidates.length <= 1) return 0;
  const [a, b] = candidates;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PHASE_C_JUDGE_RUBRIC + '\n\nCandidate A:' },
              { inlineData: a },
              { text: 'Candidate B:' },
              { inlineData: b },
              { text: 'Which is better? Reply A or B — one character, nothing else.' },
            ],
          }],
          generationConfig: { maxOutputTokens: 4, temperature: 0 },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn('[phase-c judge] non-2xx:', res.status);
      return 0;
    }
    const data = await res.json();
    const verdict = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase();
    return verdict.startsWith('B') ? 1 : 0;
  } catch (err) {
    console.warn('[phase-c judge] failed, defaulting to candidate 0:', err);
    return 0;
  }
}

// ── Phase E — imagescript post-processing ─────────────────────────────────
// After the Gemini image comes back, we snap near-white pixels to pure white
// (kills grey halos that keep icons from compositing cleanly), auto-crop to
// the tightest bounding box of non-white content plus uniform 20px padding
// (fixes size drift across an icon set), and — when the user opts in via the
// "Transparent background" toggle — flip remaining pure-white pixels to
// alpha=0 so the icon can composite onto any color. All three ops run on
// icon-generator output only; other modes produce free-form scenes where
// cropping could clip content.
const PHASE_E_WHITE_THRESHOLD = 240;   // >= this in every channel = "near white"
const PHASE_E_CROP_PADDING = 20;       // px around the bounding box

async function postProcessIconImage(
  base64Data: string,
  wantTransparent: boolean,
): Promise<{ data: string; mime: string }> {
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const img = await Image.decode(bytes);

  const w = img.width;
  const h = img.height;
  const bitmap = img.bitmap; // Uint8ClampedArray of RGBA bytes, row-major

  // Single pass: whiten near-white pixels + track bounding box of non-white.
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const rowBase = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = rowBase + x * 4;
      const r = bitmap[i], g = bitmap[i + 1], b = bitmap[i + 2];
      const nearWhite =
        r >= PHASE_E_WHITE_THRESHOLD &&
        g >= PHASE_E_WHITE_THRESHOLD &&
        b >= PHASE_E_WHITE_THRESHOLD;
      if (nearWhite) {
        bitmap[i] = 255;
        bitmap[i + 1] = 255;
        bitmap[i + 2] = 255;
        // preserve alpha for now — alpha extraction happens after crop
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Auto-crop to bounding box + padding. Guards:
  //  - if the entire image is white (no bounds found), skip crop
  //  - if the bounding box already fills the frame, skip crop
  let cropped = img;
  if (maxX >= 0 && maxY >= 0) {
    const cropX = Math.max(0, minX - PHASE_E_CROP_PADDING);
    const cropY = Math.max(0, minY - PHASE_E_CROP_PADDING);
    const cropW = Math.min(w - cropX, maxX - cropX + PHASE_E_CROP_PADDING + 1);
    const cropH = Math.min(h - cropY, maxY - cropY + PHASE_E_CROP_PADDING + 1);
    if (cropW < w || cropH < h) {
      cropped = img.crop(cropX, cropY, cropW, cropH);
    }
  }

  // Optional alpha extract: pure-white pixels (only pure, not near-white —
  // the whitening pass already snapped near-white to pure) become fully
  // transparent. Non-white pixels keep their alpha unchanged.
  if (wantTransparent) {
    const cbm = cropped.bitmap;
    for (let i = 0; i < cbm.length; i += 4) {
      if (cbm[i] === 255 && cbm[i + 1] === 255 && cbm[i + 2] === 255) {
        cbm[i + 3] = 0;
      }
    }
  }

  const outputBytes = await cropped.encode();
  let binary = '';
  for (let i = 0; i < outputBytes.length; i++) binary += String.fromCharCode(outputBytes[i]);
  return { data: btoa(binary), mime: 'image/png' };
}

/**
 * Hidden prompt refinement. Takes the user's short prompt and expands it via
 * gemini-2.5-flash into a rich, subject-aware description that Gemini 3 Pro
 * Image can execute at publication quality — the difference between "meh"
 * and "wow" for terse prompts like "mitochondrion" or "insulin signaling".
 *
 * Runs invisibly on the server. No credit charged (cost is a tiny fraction
 * of the image call). Falls back to null (caller keeps the raw prompt) on
 * any failure so a slow / broken flash call never blocks generation.
 *
 * Skipped in the caller for:
 *   - refine-chat (user text is a targeted edit, not a subject expansion)
 *   - flowchart / protocol / timeline (own structured pipeline)
 *   - very short prompts (< 3 chars — nothing meaningful to expand)
 */
async function refineImagePrompt(
  rawPrompt: string,
  mode: string,
  stylePresetBlock: string,
  apiKey: string,
): Promise<string | null> {
  // Prompt engineered from studying five example prompts known to produce
  // editorial-quality scientific illustrations (see git history for the
  // reference set). The eight traits below are what those prompts share:
  // style anchor, precise subject, component inventory, colors-per-component,
  // explicit composition, rendering directives, named background, and
  // anti-style directives at the close. Flash is instructed to hit all
  // eight in one flowing paragraph.
  const systemPrompt = [
    'You are a scientific illustration prompt engineer. Rewrite the user\'s short request as a rich, publication-quality prompt in the style of prompts that reliably produce editorial-grade scientific figures.',
    '',
    `USER REQUEST: "${rawPrompt.trim()}"`,
    `MODE: ${mode}`,
    stylePresetBlock ? '\nACTIVE JOURNAL / STYLE PRESET:\n' + stylePresetBlock : '',
    '',
    'Your refined prompt must include ALL EIGHT traits below, woven into ONE flowing paragraph (no bullets, no headings, no numbering):',
    '',
    '1. STYLE ANCHOR — open with a specific publication or aesthetic reference matched to the mode and subject. Pick from (or invent similar to): "editorial botanical infographic", "flat 2D vector infographic", "Cell journal figure style", "Nature journal figure style", "JAMA Patient Page / NEJM clinical review illustration", "publication-ready medical illustration", "textbook diagram style", "STEM education 3D isometric model", "scientific workflow infographic".',
    '',
    '2. SUBJECT IN PRECISE TERMS — use correct scientific / anatomical / molecular / taxonomic terminology. Include Latin binomials where they clarify (e.g. "Zea mays" for corn, "Escherichia coli" for E. coli).',
    '',
    '3. COMPONENT INVENTORY — list 4-8 concrete named structures the figure must contain, using their real scientific names. Examples: "outer membrane, inner membrane with folded cristae, matrix, mtDNA, ribosomes, ATP synthase complexes"; or "microglia, astrocytes, neurons, T cells, cytokines, blood-brain barrier".',
    '',
    '4. COLORS PER COMPONENT — assign a specific color to each key element. Prefer real color names or hex codes, tied to individual components rather than as a generic palette. Examples: "pink stomach", "pale blue saline", "silver metallic pulley", "red metal block", "muted teal cell body", "deep maroon cristae folds".',
    '',
    '5. EXPLICIT COMPOSITION — describe the layout. Examples: "centered isolated specimen", "cross-sectional view", "radial infographic layout", "main anatomical view on the left with a rectangular inset in the lower-right corner", "8-step numbered horizontal workflow", "exploded view", "side-by-side comparison", "signaling cascade top-to-bottom".',
    '',
    '6. RENDERING DIRECTIVES — specify the technique precisely. Examples: "clean flat 2D vector illustration", "smooth semi-flat vector rendering with soft gradients", "thin outline strokes in a darker shade of each fill", "3D isometric with realistic textures", "photorealistic 8k rendering", "no gradients, no shadows, no 3D effects" (for flat modes).',
    '',
    '7. BACKGROUND NAMED — state the background color explicitly. Examples: "pure white background", "clean soft-grey background", "off-white background", "cream background", "light gray background".',
    '',
    '8. ANTI-STYLE DIRECTIVES — close the paragraph with prohibitions that keep the output editorial. Examples: "without clutter", "without overly bright or artificial AI appearance", "no dramatic lighting", "no distorted proportions", "minimal labels only where necessary", "no watermarks", "no cartoonish exaggeration".',
    '',
    'LENGTH GUIDANCE:',
    '- Simple subjects (single organelle, single icon): 80-150 words.',
    '- Standard pathways or mechanisms: 150-250 words.',
    '- Complex multi-panel clinical or research figures: 250-400 words.',
    '',
    'HARD RULES:',
    '- Preserve the user\'s intent — do NOT add subjects, organisms, or objects they did not request.',
    '- If the ACTIVE JOURNAL / STYLE PRESET is provided, weave its palette and typography into the refined prompt naturally (don\'t just append it).',
    '- Do NOT ask for text labels, numbers, or letters on the illustration unless the user explicitly requested labels.',
    '- Do NOT include markdown, headings, bullet points, or the word "prompt".',
    '- Output ONE flowing paragraph. No preamble, no meta-commentary, no closing sentence about what you did.',
    '',
    'Return only the refined prompt paragraph.',
  ].filter(Boolean).join('\n');

  const controller = new AbortController();
  // Short timeout — if flash is slow we'd rather ship the raw prompt than
  // add a 30 s stall to every generation.
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            // Slight bump from 0.3 — the trait list is prescriptive enough
            // that a little more creative freedom helps flash choose fitting
            // color words and composition language without going off-brief.
            temperature: 0.4,
            // Bumped from 512 to 900 so the complex-figure path (250-400 words
            // ≈ ~600-900 tokens) doesn\'t get truncated mid-paragraph.
            maxOutputTokens: 900,
          },
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.warn('[refineImagePrompt] non-2xx:', response.status);
      return null;
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.find(
      (p: any) => typeof p.text === 'string',
    )?.text;
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    // Sanity: refined prompt should be meaningfully longer than the raw one
    // and have real content. If flash echoed the input, or produced fewer
    // than 80 chars, discard and fall back to raw.
    if (trimmed.length < Math.max(80, rawPrompt.length + 40)) return null;
    return trimmed.substring(0, 3000);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[refineImagePrompt] failed:', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so both nested and top-level catches can refund.
  // Array because Phase C higher-quality mode deducts 2 credits per generation;
  // on failure we must refund every deducted id.
  const generationIds: string[] = [];
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

    const {
      prompt: userPrompt,
      mode,
      referenceImage,
      excludeText,
      size,
      stylePreset,
      iconStyle,             // 'flat' | '3d' | 'sketch' | 'line-art' | 'hand-drawn' — icon-generator only
      higherQuality,         // boolean — opt-in to Phase C best-of-2 reranking (costs 2 credits)
      transparentBackground, // boolean — Phase E alpha extraction (icon-generator only)
      refineChat,        // boolean — if true, treat as a conversational refinement
      chatHistory,       // Array<{role: 'user'|'assistant', text: string}> — recent turns
      previousImage,     // data URL of the previous assistant image to edit
      preserveContext,   // string — from the planner: what must stay unchanged (global scope)
    } = await req.json();
    if (!userPrompt) throw new Error('Prompt is required');
    // Effective prompt used for image generation. Starts as the raw user
    // text and may be reassigned by the hidden refinement step below. The
    // raw `userPrompt` is preserved for usage logs so admin analytics see
    // what users actually typed, not what flash rewrote it into.
    let prompt: string = userPrompt;

    // ── Style preset ─────────────────────────────────────────────────────────
    // Maps a preset id (from the client's aiIllustratorPresets.ts) to a small
    // prompt block appended to the Gemini instruction. Unknown ids are
    // silently ignored so a client-side drift can't break generation.
    const STYLE_PRESET_APPENDIX: Record<string, string> = {
      nature: [
        'Style guidance — Nature journal figure:',
        '- Palette: deep navy #0B1D3A, mid grey #4B4B4B, mustard #C89B25, white #FFFFFF. Use these as the dominant hues.',
        '- Clean sans-serif labels only (Helvetica / Arial family). Minimal decorative elements.',
        '- Thin, consistent outlines (1-1.5 px equivalent). No gradients, no shadows, no 3D effects.',
        '- White or very light background. Publication-density detail.',
      ].join('\n'),
      cell: [
        'Style guidance — Cell journal figure:',
        '- Palette: charcoal #2B2E33, coral #E74C3C, sky #3498DB, off-white #F4F4F4. Use vivid accents on a light background.',
        '- Bold sans-serif labels for structures. Clear callouts.',
        '- Consistent line weights, flat solid colors. No gradients or shading.',
        '- Off-white background, publication-ready proportions.',
      ].join('\n'),
      science: [
        'Style guidance — Science journal figure:',
        '- Palette: navy #1A3A5C, crimson #E63946, powder #A8DADC, cream #F1FAEE. High contrast between structure and accent.',
        '- Clear, structured layout — one central subject with clean labels.',
        '- Sans-serif labels. Thin outlines. No gradients, no shadows.',
        '- Cream background. Precise anatomical proportions.',
      ].join('\n'),
      elife: [
        'Style guidance — eLife journal figure:',
        '- Palette: teal #00A98F, charcoal #333333, warm yellow #FFC000, off-white #F9F9F9.',
        '- Modern, accessible design. Prioritize colorblind-safe combinations.',
        '- Sans-serif labels. Clean solid fills, flat shapes.',
        '- Warm off-white background. Open, uncluttered layout.',
      ].join('\n'),
      plos: [
        'Style guidance — PLOS journal figure:',
        '- Palette: bright blue #0066CC, mid grey #666666, warm orange #FF6600, white #FFFFFF.',
        '- Maximum readability — large clear labels, high contrast.',
        '- Sans-serif labels only. Solid fills, no gradients or effects.',
        '- White background. Suitable for online + print at any zoom.',
      ].join('\n'),
      presentation: [
        'Style guidance — Presentation-slide figure:',
        '- Palette: violet #7C3AED, magenta #EC4899, amber #F59E0B, white #FFFFFF. Vivid, projector-safe.',
        '- Bold, large sans-serif labels that read from the back of a room.',
        '- Chunky outlines (2-3 px equivalent). Solid fills, high contrast.',
        '- White background. Simplified detail — no publication-density fine strokes.',
      ].join('\n'),
    };
    const stylePresetBlock: string =
      typeof stylePreset === 'string' && STYLE_PRESET_APPENDIX[stylePreset]
        ? STYLE_PRESET_APPENDIX[stylePreset]
        : '';

    // ── AI credit deduction ──
    // Uses grant first, then purchased balance. Raises INSUFFICIENT_CREDITS when
    // the user is out — caught below and returned as 402 so the frontend can
    // show the buy/share dialog.
    const { data: deductedId, error: deductError } = await supabase.rpc(
      'deduct_ai_generation',
      { p_user_id: user.id, p_feature: 'ai-illustrator' },
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
    generationIds.push(deductedId as string);

    // ── Phase C higher-quality: charge a second credit ──
    // Gate: user opted in via `higherQuality: true` in the request, mode is
    // eligible for best-of-2 reranking, and the server-side kill switch is
    // off. If the second deduction fails (user has 1 credit left, not 2),
    // refund the first credit and surface INSUFFICIENT_CREDITS so the client
    // shows the same buy/share dialog as the single-credit path.
    const phaseCEnabled =
      higherQuality === true &&
      PHASE_C_MODES.has(mode) &&
      !refineChat &&                                    // best-of-2 only fires on the fresh-generate path
      Deno.env.get('PHASE_C_DISABLED') !== 'true';

    if (phaseCEnabled) {
      const { data: secondId, error: secondDeductError } = await supabase.rpc(
        'deduct_ai_generation',
        { p_user_id: user.id, p_feature: 'ai-illustrator' },
      );
      if (secondDeductError) {
        // Refund the first credit — the user shouldn't be charged 1 for a
        // request that couldn't proceed at the price they opted into.
        try {
          await supabase.rpc('refund_ai_generation', { p_generation_id: generationIds[0] });
        } catch (refundErr) {
          console.error('[ai-illustrator] Phase C first-credit refund failed:', refundErr);
        }
        generationIds.length = 0;
        if (secondDeductError.message?.includes('INSUFFICIENT_CREDITS')) {
          return new Response(
            JSON.stringify({ success: false, error: 'INSUFFICIENT_CREDITS' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        if (secondDeductError.message?.includes('WAITING_PERIOD')) {
          return await waitingPeriodResponseForUser(supabase, user.id, corsHeaders);
        }
        throw secondDeductError;
      }
      generationIds.push(secondId as string);
    }

    // Aspect ratio for Gemini 3 Pro Image — restrict to the 4 sizes the UI exposes.
    // Omit imageConfig entirely when no size is provided (e.g. illustration-enhancer,
    // which must preserve the input image's dimensions).
    const ALLOWED_ASPECT = new Set(['1:1', '16:9', '4:3', '9:16']);
    const aspectRatio: string | null =
      typeof size === 'string' && ALLOWED_ASPECT.has(size) ? size : null;
    const imageConfig = aspectRatio ? { aspectRatio } : undefined;

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    // Legacy quota check retained only for admin flag detection. The actual
    // gate is now `deduct_ai_generation` below, which knows about both the
    // rolling grant window AND purchased credits — the old RPC only knows the
    // legacy trial system, so it would falsely block users who've purchased.
    const { data: usageCheck } = await supabase.rpc('can_user_generate', { _user_id: user.id });
    // Intentionally NOT throwing QUOTA_EXCEEDED here — leave that to deduct.

    // ── Hidden prompt refinement ────────────────────────────────────────────
    // For fresh top-level generations we quietly expand the user's short
    // prompt into a rich, subject-aware description via gemini-2.5-flash.
    // This is the single biggest lever for output quality on terse prompts
    // (e.g. "mitochondrion" → an anatomy-aware paragraph). No credit charge,
    // no UI, no user-facing indication. Falls back to the raw prompt on any
    // failure so a slow / broken flash call never blocks generation.
    const SKIP_REFINEMENT_MODES = new Set(['flowchart', 'protocol', 'timeline', 'icon-generator']);
    const shouldRefine =
      !(refineChat && previousImage) &&
      !SKIP_REFINEMENT_MODES.has(mode) &&
      typeof userPrompt === 'string' &&
      userPrompt.trim().length >= 3;
    if (shouldRefine) {
      try {
        const refined = await refineImagePrompt(userPrompt, mode, stylePresetBlock, GEMINI_API_KEY);
        if (refined) {
          prompt = refined;
          console.log(`[ai-illustrator] Prompt refined for user=${user.id} (${userPrompt.length} → ${refined.length} chars)`);
        }
      } catch (e) {
        console.warn('[ai-illustrator] Prompt refinement threw; falling back to raw prompt:', e);
      }
    }

    // ── Refine-chat (multi-turn conversational refinement) ──────────────────
    // The user has an existing image and is iterating on it via chat. We send
    // Gemini: [system + preset + recent history text] + [previous image] + [new prompt].
    // This bypasses all mode-specific system prompts because the CONTEXT is
    // what drives the edit, not the mode. Cost: 1 credit, same as fresh generate.
    if (refineChat && previousImage) {
      const prevMatch = typeof previousImage === 'string'
        ? previousImage.match(/^data:image\/(\w+);base64,(.+)$/)
        : null;
      if (!prevMatch) throw new Error('previousImage must be a data URL');

      const [, prevExt, prevBase64] = prevMatch;

      // Format the history as short bullet points so Gemini has context without
      // choking on a huge prompt. Cap at the last 8 turns to bound token use.
      const historyText = Array.isArray(chatHistory) && chatHistory.length > 0
        ? '\n\nRecent conversation so far (oldest first):\n' +
          chatHistory.slice(-8).map((t: any) => {
            const role = t?.role === 'assistant' ? 'AI' : 'User';
            const text = typeof t?.text === 'string' ? t.text.substring(0, 400) : '';
            return `- ${role}: ${text}`;
          }).join('\n')
        : '';

      // Planner-supplied preservation directive. When present, the client's
      // refine-plan pass already classified this as a GLOBAL edit and told us
      // exactly what to keep untouched. We surface that as a hard constraint at
      // the top of the prompt so it out-weighs any drift-inducing rewrites.
      const preserveBlock = typeof preserveContext === 'string' && preserveContext.trim().length > 0
        ? '\n\nMUST PRESERVE (non-negotiable — reproduce identically):\n' + preserveContext.trim()
        : '';

      const systemPrompt =
        'You are refining a scientific figure through conversation. The user has an existing figure ' +
        '(provided as the reference image below) and wants to iterate on it.\n\n' +
        'RULES:\n' +
        '- Preserve the overall composition and subject unless the user explicitly asks otherwise.\n' +
        '- Apply the new request as a targeted edit to the existing figure.\n' +
        '- Keep the same visual style, palette, and quality level as the original.\n' +
        '- Return the edited image as a full-resolution PNG.' +
        preserveBlock +
        historyText +
        '\n\nNEW USER REQUEST:\n' + prompt +
        (stylePresetBlock ? '\n\n' + stylePresetBlock : '') +
        (excludeText !== false
          ? '\n\nDo not add text or labels inside the image.'
          : '');

      const refineParts: any[] = [
        { text: systemPrompt },
        { inlineData: { mimeType: 'image/' + prevExt, data: prevBase64 } },
      ];

      console.log('[ai-illustrator] Refine-chat path, user:', user.id, 'history turns:', Array.isArray(chatHistory) ? chatHistory.length : 0);

      const rfController = new AbortController();
      const rfTimeout = setTimeout(() => rfController.abort(), 60000);

      const rfResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: refineParts }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              thinkingConfig: { thinkingBudget: -1 },
              // Refine preserves the previous image's aspect — do not force a size.
            },
          }),
          signal: rfController.signal,
        }
      );

      clearTimeout(rfTimeout);

      if (!rfResponse.ok) {
        const errorText = await rfResponse.text();
        console.error('[ai-illustrator] Gemini refine error:', rfResponse.status, errorText);
        if (rfResponse.status === 429) throw new Error('RATE_LIMITED');
        throw new Error('AI API error: ' + rfResponse.status);
      }

      const rfData = await rfResponse.json();
      const rfParts = rfData?.candidates?.[0]?.content?.parts;
      const rfImagePart = rfParts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
      if (!rfImagePart) throw new Error('No image generated');

      const rfMime = rfImagePart.inlineData.mimeType;
      const rfB64 = rfImagePart.inlineData.data;

      try {
        const currentMonth = new Date().toISOString().substring(0, 7);
        await supabase.from('ai_generation_usage').insert({
          user_id: user.id,
          generated_at: new Date().toISOString(),
          month_year: currentMonth,
          prompt: userPrompt.substring(0, 200),
          style: 'refine-chat',
          generation_type: 'ai-illustrator-refine-chat',
        });
      } catch (usageErr) {
        console.error('[ai-illustrator] Usage insert failed:', usageErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          image: 'data:' + rfMime + ';base64,' + rfB64,
          mode: 'refine-chat',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Structured diagram path (Flowchart / Protocol / Timeline) ──
    // For these modes we bypass the image-generation pipeline entirely:
    //   text-LLM → strict JSON → deterministic SVG renderer.
    // Output is genuinely editable in-canvas (semantic <g> per node/edge/label)
    // rather than a raster trace.
    if (mode === 'flowchart' || mode === 'protocol' || mode === 'timeline') {
      console.log('[ai-illustrator] Structured diagram path: ' + mode);
      try {
        const { svg, json } = await generateStructuredDiagram({
          apiKey: GEMINI_API_KEY,
          mode: mode as StructuredMode,
          prompt,
        });

        // Record usage for quota tracking
        try {
          const currentMonth = new Date().toISOString().substring(0, 7);
          await supabase.from('ai_generation_usage').insert({
            user_id: user.id,
            generated_at: new Date().toISOString(),
            month_year: currentMonth,
            prompt: userPrompt.substring(0, 200),
            style: mode,
            generation_type: 'ai-illustrator',
          });
        } catch (usageErr) {
          console.error('[ai-illustrator] Usage insert failed:', usageErr);
        }

        return new Response(
          JSON.stringify({ success: true, svg, json, mode }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        // No silent fall-through: surface the real error to the client so we
        // can see exactly why the structured pipeline broke. The raster
        // pipeline isn't a sensible fallback here — it returns a flat PNG
        // that defeats the whole "editable diagram" purpose.
        console.error('[ai-illustrator] Structured diagram FAILED — surfacing error:', e?.message || e);
        // Refund every credit we deducted — the user shouldn't pay for our failure.
        if (supabaseForRefund) {
          for (const gid of generationIds) {
            try {
              await supabaseForRefund.rpc('refund_ai_generation', { p_generation_id: gid });
            } catch (refundErr) {
              console.error('[ai-illustrator] Refund failed for ' + gid + ':', refundErr);
            }
          }
          generationIds.length = 0;
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Structured diagram failed',
            context: e?.message || String(e),
            mode,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const isEdit = !!referenceImage;
    const noTextRule = excludeText !== false
      ? '\n\nCRITICAL TEXT RULE: Do NOT render ANY text, letters, numbers, labels, annotations, or written characters in the output image. Leave ALL label areas BLANK. If the reference has text, OMIT it entirely — render empty space or a clean shape where text would be. The user will add text manually afterward. This is the #1 priority rule — garbled or incorrect text is worse than no text at all.\n'
      : '';

    // When text IS allowed in an illustration-style mode (icon / figure / photo /
    // sketch / ref-to-figure), force labels into the page margins and connect
    // them with leader lines — never on top of shapes. This makes the canvas
    // "Make text editable" wand far cleaner: every text bbox sits on uniform
    // white background, so the client's flood-fill erasure produces a clean
    // result without color sampling artifacts inside illustrated elements.
    // Excluded modes (flowchart / protocol / timeline) go through the
    // structured-renderer path above and don't reach this code anyway.
    const labelPlacementRule = excludeText === false
      ? '\n\nLABEL PLACEMENT — REQUIRED FOR EDITABILITY:\n' +
        '- If ANY text labels are needed, place them ONLY in clear whitespace OUTSIDE every shape and illustration element, in the margins or empty areas of the canvas.\n' +
        '- Connect each label to its target with a thin, simple black leader line (a short straight or L-shaped line) — the line is part of the illustration, but the text glyphs must sit on plain background only.\n' +
        '- NEVER draw text ON TOP OF or INSIDE an illustrated element. No labels inside organelles, cells, badges, shapes, colored regions, or gradients.\n' +
        '- Text glyph pixels must sit on the plain white/light background ONLY — they must NEVER overlap with colored fills, gradients, outlines, or illustrated pixels.\n' +
        '- If a typical layout would place a label inside a shape (e.g. "ATP" inside a molecule circle, "1" inside a step bubble), draw the leader line and place the label in adjacent whitespace instead.\n'
      : '';

    // ── Reference-Guide-clone path ──
    // For these modes we mirror the canvas page's AI Reference Guide function
    // (`generate-reference-image`): a single-pass Gemini call with one short
    // prompt — no editAction divergence, no multi-pass analyzer, no aggressive
    // noTextRule. This produces the same publication-quality output as the
    // canvas reference guide.
    const referenceGuideStyleMode =
      mode === 'icon-generator' ||
      mode === 'text-to-figure' ||
      mode === 'sketch-to-illustration' ||
      mode === 'image-to-figure';

    if (referenceGuideStyleMode) {
      const subjectClause =
        mode === 'sketch-to-illustration'
          ? 'Transform the provided hand-drawn sketch into a clean, professional scientific illustration of: ' + prompt
          : mode === 'image-to-figure'
          ? 'Convert the provided source image into a clean, professional scientific publication figure of: ' + prompt
          : mode === 'icon-generator'
          ? 'Generate a single standalone BioRender-style biomedical 2D icon of: ' + prompt
          : 'Generate a clean, professional scientific illustration of: ' + prompt;

      // Icon-generator ALWAYS uses ICON RULES regardless of style. An earlier
      // pass special-cased glossy-3d here with "FIGURE RULES" that allowed
      // arrows and labels — that was a bug: the mode itself is
      // icon-generator, so labels and scenes should never appear in the
      // output even if the chosen style's prompt implies them. The
      // "OVERRIDE" line below reasserts icon-mode over any label-implying
      // language in the style prompt above (e.g., "Servier infographic",
      // "textbook-quality", "anatomy sketchbook", or glossy-3d's own
      // "small humanist labels" clause).
      const iconRulesBlock = 'ICON RULES (apply regardless of style — these OVERRIDE any label/arrow/scene language in the style block above):\n' +
        '- A STANDALONE illustration — a single, centered subject on a clean solid WHITE background, self-contained.\n' +
        '- NO leader lines. NO callouts. NO arrows. NO dashed lines. NO pointers of any kind to any part of the subject.\n' +
        '- ABSOLUTELY NO text, NO labels, NO annotations, NO captions, NO letters, NO numbers, NO written content of any kind anywhere in the image.\n' +
        '- If the style block above mentions labels, arrows, callouts, or a "scene" composition, IGNORE those specific instructions. This output is a single standalone icon — not a labeled figure and not a scene. Follow only the VISUAL treatment (colors, shading, outline style) from the style block; discard any component or composition instructions.\n' +
        '- Fill the frame purposefully — no wasted whitespace or empty margins beyond a small breathing gap.\n' +
        '- NO decorative background elements, scenery, or props beyond the icon subject itself.\n';

      const requirementsBlock = 'Requirements:\n' +
        '- Output MUST be a PNG on a plain solid WHITE (#FFFFFF) background.\n' +
        '- The background must be pure white with NO gradients, NO shadows, NO vignettes, NO patterns.\n' +
        '- Every edge must be perfectly smooth and anti-aliased.\n' +
        '- Render at the highest resolution and detail possible with crisp sharp edges.\n' +
        '- Pure visual illustration only — the subject centered on a clean white background.\n' +
        '- Scientific accuracy in proportions and key structural features is mandatory.\n';

      const fullPrompt = mode === 'icon-generator'
        ? 'You are an expert scientific illustrator creating icons for a scientific illustration tool.\n\n' +
          (ICON_STYLE_PROMPTS[iconStyle as string] || ICON_STYLE_PROMPTS['flat']) + '\n\n' +
          iconRulesBlock + '\n' +
          requirementsBlock + '\n' +
          'Create: ' + prompt
        : subjectClause + '.\n' +
          // Text-to-figure (and the other reference-guide-style modes) can
          // now take a visual-style directive via `iconStyle` — same set as
          // the icon generator. When the caller sends one, we inject the
          // full ICON_STYLE_PROMPTS entry as the primary style contract and
          // drop the generic "vector-like clean lines" line (which would
          // conflict with 3D/sketch/hand-drawn/glossy-3d styles). When no
          // iconStyle is sent, keep the original neutral wording.
          (mode === 'text-to-figure' && typeof iconStyle === 'string' && ICON_STYLE_PROMPTS[iconStyle]
            ? ICON_STYLE_PROMPTS[iconStyle] + '\n\nThis is a scientific FIGURE — arrows, labels, and layered composition are welcome as needed to communicate the subject clearly.\n'
            : 'Style: scientific figure suitable for academic publications, clear and well-labeled, white or light background, vector-like clean lines, accurate proportions.\nThis will be used as a visual reference for creating a scientific illustration.\n') +
          (excludeText !== false
            ? 'Do not include text or labels inside the image — leave label areas blank for the user to annotate.\n'
            : '') +
          labelPlacementRule;

      const rgParts: any[] = [{ text: fullPrompt }];
      if (stylePresetBlock) {
        rgParts.push({ text: '\n\n' + stylePresetBlock });
      }
      if (referenceImage) {
        const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/);
        if (base64Match) {
          rgParts.push({ inlineData: { mimeType: 'image/' + base64Match[1], data: base64Match[2] } });
          if (mode === 'icon-generator') {
            rgParts.push({
              text: 'Use this reference image as your primary guide. Match the EXACT proportions, outline style, outline weight, shape construction, and level of detail from this reference as closely as possible. The output should look like it belongs in the same icon set as this reference. Do NOT add any text, labels, annotations, or written content.',
            });
          }
        }
      }

      // Phase C — best-of-N reranking on the two highest-value fresh-gen
      // modes. We can't use `candidateCount: 2` because the image-preview
      // model rejects N>1, so we fire two independent generateContent calls
      // in parallel and pick the winner via LLM judge. Same net effect.
      // Decision was made up front (top-level `phaseCEnabled`) so credit
      // deduction and Gemini fan-out stay in sync.
      console.log('[ai-illustrator] Reference-Guide-clone path: ' + mode + ', User: ' + user.id + (phaseCEnabled ? ' [phase-c]' : ''));

      const rgFetchOnce = async (): Promise<Response> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        const res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': GEMINI_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: rgParts }],
              generationConfig: {
                responseModalities: mode === 'icon-generator' ? ['IMAGE'] : ['TEXT', 'IMAGE'],
                thinkingConfig: { thinkingBudget: -1 },
                ...(imageConfig ? { imageConfig } : {}),
              },
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);
        return res;
      };

      let rgMime: string;
      let rgB64: string;

      if (phaseCEnabled) {
        // Two parallel single-candidate calls. Any 429 short-circuits to
        // RATE_LIMITED. If one call fails but the other succeeds, use the
        // survivor rather than erroring — better UX than dropping the whole
        // request over one flaky candidate.
        const [rA, rB] = await Promise.all([rgFetchOnce(), rgFetchOnce()]);
        for (const r of [rA, rB]) {
          if (r.status === 429) throw new Error('RATE_LIMITED');
        }
        const cands: Array<{ mimeType: string; data: string }> = [];
        for (const r of [rA, rB]) {
          if (!r.ok) {
            const errorText = await r.text();
            console.warn('[ai-illustrator] Phase C parallel call non-2xx (' + r.status + '):', errorText.slice(0, 200));
            continue;
          }
          const j = await r.json();
          const parts = j?.candidates?.[0]?.content?.parts;
          const imagePart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
          if (imagePart) cands.push({ mimeType: imagePart.inlineData.mimeType, data: imagePart.inlineData.data });
        }
        if (cands.length === 0) throw new Error('No image generated');
        const winner = await rankCandidatesWithJudge(cands, GEMINI_API_KEY);
        console.log('[ai-illustrator] Phase C: ' + cands.length + ' candidates, winner=' + winner);
        rgMime = cands[winner].mimeType;
        rgB64 = cands[winner].data;
      } else {
        const rgResponse = await rgFetchOnce();
        if (!rgResponse.ok) {
          const errorText = await rgResponse.text();
          console.error('[ai-illustrator] Gemini error: ' + rgResponse.status, errorText);
          if (rgResponse.status === 429) throw new Error('RATE_LIMITED');
          throw new Error('AI API error: ' + rgResponse.status);
        }
        const rgData = await rgResponse.json();
        const rgPartsOut = rgData?.candidates?.[0]?.content?.parts;
        const rgImagePart = rgPartsOut?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
        if (!rgImagePart) throw new Error('No image generated');
        rgMime = rgImagePart.inlineData.mimeType;
        rgB64 = rgImagePart.inlineData.data;
      }

      // ── Phase E — imagescript post-processing (icon-generator only) ──
      // Whiten near-white halos, auto-crop to the tightest bounding box, and
      // optionally alpha-extract for a transparent PNG. Any failure falls
      // back to the raw output so post-processing can't corrupt a request.
      const phaseEEnabled =
        mode === 'icon-generator' &&
        Deno.env.get('PHASE_E_DISABLED') !== 'true';
      if (phaseEEnabled) {
        try {
          const t0 = Date.now();
          const processed = await postProcessIconImage(rgB64, transparentBackground === true);
          rgB64 = processed.data;
          rgMime = processed.mime;
          console.log('[ai-illustrator] Phase E: post-processed in ' + (Date.now() - t0) + 'ms' + (transparentBackground === true ? ' [alpha]' : ''));
        } catch (err) {
          console.warn('[ai-illustrator] Phase E post-process failed, returning raw output:', err);
        }
      }

      try {
        const currentMonth = new Date().toISOString().substring(0, 7);
        await supabase.from('ai_generation_usage').insert({
          user_id: user.id,
          generated_at: new Date().toISOString(),
          month_year: currentMonth,
          prompt: userPrompt.substring(0, 200),
          style: mode,
          generation_type: 'ai-illustrator',
        });
      } catch (usageErr) {
        console.error('[ai-illustrator] Usage insert failed:', usageErr);
      }

      return new Response(
        JSON.stringify({ success: true, image: 'data:' + rgMime + ';base64,' + rgB64, mode }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let systemPrompt = '';

    if (mode === 'ref-to-figure') {
      // Reference to Figure: convert reference images into 2D vector-style figures
      const editAction = isEdit && !prompt.includes('Convert') && !prompt.includes('Recreate')
        ? 'EDIT the provided figure according to these instructions. Keep the flat 2D vector style. Only change what is requested: ' + prompt
        : 'Convert the provided reference image into a flat 2D vector-style scientific figure.';

      systemPrompt = 'You are an expert scientific illustrator specializing in recreating reference images as clean, flat 2D vector-style scientific figures.\n\n' +
        'Style rules:\n- ' + STYLE_RULES + '\n\n' +
        'REFERENCE TO FIGURE CONVERSION RULES:\n' +
        '- Study the provided reference image carefully — understand what it depicts\n' +
        '- Recreate the SAME subject as a flat 2D vector-style scientific illustration\n' +
        '- Convert all 3D shading, photorealistic details, and complex textures into clean flat shapes with solid colors\n' +
        '- Maintain the SAME composition, layout, and spatial arrangement as the reference\n' +
        '- Preserve ALL key structures and their relationships from the reference\n' +
        '- Do NOT add elements that are not in the reference image\n' +
        '- Do NOT remove structures that ARE in the reference image\n' +
        '- Simplify complex surfaces into clean geometric shapes with flat fills\n' +
        '- Use thin outlines in a slightly darker shade of the fill color (NOT black outlines)\n' +
        '- Use anatomically and scientifically accurate colors appropriate for the subject\n' +
        '- The result should look like the reference was redrawn as a clean flat 2D vector scientific illustration\n' +
        '- Output MUST be a PNG on a plain solid WHITE background\n' +
        '- NO text, labels, annotations, letters, or numbers unless the user specifically requests them\n\n' +
        editAction + (prompt ? '\n\nAdditional instructions: ' + prompt : '') + noTextRule + labelPlacementRule;
    } else if (mode === 'illustration-enhancer') {
      // Illustration Enhancer: sharpen, clean, and refine illustrations to HD quality
      const editAction = isEdit
        ? 'ENHANCE and REFINE the provided illustration according to these instructions: ' + prompt
        : 'ENHANCE and REFINE the provided illustration to the highest quality possible.';

      systemPrompt = 'You are an expert image enhancement specialist for scientific illustrations.\n\n' +
        'ENHANCEMENT RULES — follow these EXACTLY:\n' +
        '- Take the uploaded illustration and produce a HIGH DEFINITION, REFINED version of the SAME image\n' +
        '- Do NOT change the subject, composition, layout, colors, or style — only IMPROVE quality\n' +
        '- Sharpen all edges to be crisp and perfectly defined — no blurry or fuzzy boundaries\n' +
        '- Clean up any rough, jagged, or pixelated edges into smooth, clean lines\n' +
        '- Remove any visual noise, artifacts, compression distortion, or banding\n' +
        '- Ensure all colors are clean, solid, and vibrant — no muddy or washed-out areas\n' +
        '- Make outlines consistent in weight and perfectly smooth throughout\n' +
        '- Improve anti-aliasing on all curved edges for smooth rendering at any size\n' +
        '- If shapes have uneven fills, make them perfectly uniform solid colors\n' +
        '- If lines are inconsistent in thickness, normalize them to uniform weight\n' +
        '- The output should look like the SAME illustration but redrawn at 4K quality by a professional\n' +
        '- Output MUST be a PNG at the highest resolution and quality possible\n' +
        '- Maintain the EXACT same white background\n' +
        '- Do NOT add, remove, or modify any elements — only enhance what exists\n\n' +
        'CRITICAL: The enhanced image must be RECOGNIZABLY THE SAME illustration, just sharper and cleaner.\n\n' +
        editAction + (prompt ? '\n\nSpecific enhancement requests: ' + prompt : '') + noTextRule + labelPlacementRule;
    } else if (mode === 'image-to-figure') {
      // Image to Figure — recreate a source image as a clean flat 2D vector
      // scientific publication figure. Phase A: STYLE_RULES injected so the
      // "no gradients / anatomical colors / flat solid fills" baseline holds
      // instead of leaving the model to guess a style from the loose
      // "publication figure" hint the previous version used.
      const editAction = isEdit && !prompt.includes('Convert')
        ? 'EDIT the provided figure according to the instructions while preserving the clean publication style. Instructions: ' + prompt
        : (prompt
            ? 'Convert the provided image into a clean, professional scientific publication figure of: ' + prompt
            : 'Convert the provided image into a clean, professional scientific publication figure.');

      systemPrompt = 'You are an expert scientific illustrator generating a publication figure based on the provided source image.\n\n' +
        'Style rules:\n- ' + STYLE_RULES + '\n\n' +
        'IMAGE → FIGURE RULES:\n' +
        '- Recreate the content of the source image faithfully as a clean flat 2D vector scientific figure\n' +
        '- Do NOT invent structures that are not present in the source\n' +
        '- Do NOT remove structures that ARE present in the source\n' +
        '- Maintain the SAME composition and spatial arrangement as the source\n' +
        '- Convert any 3D shading, gradients, or photographic detail into flat solid colors with thin outlines in a darker shade of each fill\n' +
        '- Anatomically and scientifically accurate colors matched to the subject\n' +
        '- Pure WHITE or very light background\n' +
        '- Output MUST be a PNG on a plain solid WHITE background\n\n' +
        editAction + noTextRule + labelPlacementRule;
    } else if (mode === 'text-to-figure') {
      // Text to Figure — describe a scientific figure in prose, get back a
      // publication-grade flat 2D vector figure. Phase A: STYLE_RULES injected
      // + explicit Cell/Nature-journal composition language so the model
      // stops falling back to generic "clean illustration" output.
      const editAction = isEdit
        ? 'EDIT the provided figure according to the instructions while preserving the clean publication style. Instructions: ' + prompt
        : 'Generate a clean, professional scientific figure of: ' + prompt;

      systemPrompt = 'You are an expert scientific illustrator generating a publication-quality figure.\n\n' +
        'Style rules:\n- ' + STYLE_RULES + '\n\n' +
        'FIGURE RULES:\n' +
        '- Interpret the described subject as a clean flat 2D vector-style scientific figure\n' +
        '- Composition should read as a Cell/Nature-journal figure — deliberate layout, no clutter, purposeful spacing\n' +
        '- Use arrows, flow direction, and clearly grouped components as needed for the subject (signaling pathway, cellular process, anatomical diagram, metabolic pathway, mechanism, etc.)\n' +
        '- Every component gets a distinct fill color chosen for anatomical accuracy; use thin outlines in a slightly darker shade of the fill (NOT black)\n' +
        '- Pure WHITE or very light background\n' +
        '- Output MUST be a PNG on a plain solid WHITE background\n\n' +
        editAction + '.\n' + noTextRule + labelPlacementRule;
    } else if (mode === 'sketch-to-illustration') {
      // Sketch to Illustration — transform a hand-drawn sketch into a clean
      // publication illustration. Phase A: STYLE_RULES injected so the model
      // produces true flat 2D vector output instead of a stylised sketch
      // pass-through, while preserving the "reproduce only what's there"
      // fidelity rule the previous version already had.
      const editAction = isEdit && !prompt.includes('Convert') && !prompt.includes('Transform')
        ? 'EDIT the provided illustration according to the instructions while preserving the clean publication style. Instructions: ' + prompt
        : 'Transform the provided hand-drawn sketch into a clean, professional scientific illustration.' + (prompt ? ' ' + prompt : '');

      systemPrompt = 'You are an expert scientific illustrator transforming hand-drawn sketches into publication-quality flat 2D figures.\n\n' +
        'Style rules:\n- ' + STYLE_RULES + '\n\n' +
        'SKETCH → ILLUSTRATION RULES:\n' +
        '- Reproduce ONLY the elements present in the sketch — preserve the same count, layout, and spatial arrangement\n' +
        '- Do NOT add extra structures the sketch does not contain\n' +
        '- Clean up rough linework into smooth bezier edges with consistent thin outlines\n' +
        '- Interpret the sketch\'s intent — if a shape reads as an organelle, draw it as a proper organelle\n' +
        '- Anatomically and scientifically accurate colors matched to the subject\n' +
        '- Pure WHITE or very light background\n' +
        '- Output MUST be a PNG on a plain solid WHITE background\n\n' +
        editAction + '\n' + noTextRule + labelPlacementRule;
    } else if (mode === 'photo-to-2d') {
      // Photo to 2D: convert uploaded photo into flat 2D illustration
      const editAction = isEdit && !prompt.includes('Convert')
        ? 'EDIT the provided 2D illustration according to these instructions. Keep the flat 2D vector style. Only change what is requested: ' + prompt
        : 'Convert the provided photograph into a flat 2D vector-style scientific illustration.';

      systemPrompt = 'You are an expert scientific illustrator specializing in converting photographs into clean, flat 2D illustrations.\n\n' +
        'Style rules:\n- ' + STYLE_RULES + '\n\n' +
        'CONVERSION RULES:\n' +
        '- Take the uploaded photograph and recreate it as a FLAT 2D vector-style illustration\n' +
        '- Simplify complex 3D details into clean flat shapes with solid colors\n' +
        '- Maintain the subject, proportions, and key structural features from the photo\n' +
        '- Remove photographic noise, shadows, reflections, and 3D depth\n' +
        '- Use anatomically accurate colors based on the real subject\n' +
        '- The result should look like a clean flat 2D vector scientific illustration\n' +
        '- Output MUST be a PNG on a plain solid WHITE background\n' +
        '- NO text, labels, annotations, letters, or numbers\n\n' +
        editAction + (prompt ? '\n\nAdditional instructions: ' + prompt : '') + noTextRule + labelPlacementRule;
    } else if (mode === 'flowchart') {
      // Flowchart: clean, editable flowcharts with slim PURE BLACK lines and arrows
      systemPrompt = 'You are an expert scientific diagram designer specializing in clean, minimalist flowcharts.\n\n' +
        'CREATE A FLOWCHART based on this description: ' + prompt + '\n\n' +
        '#1 PRIORITY VISUAL RULE — APPLIES TO EVERY LINE, EVERY ARROW, EVERY SHAPE BORDER:\n' +
        '- ALL lines, arrows, arrowheads, and shape borders MUST BE PURE BLACK (#000000) — NOT grey, NOT navy, NOT dark-blue, NOT brown, NOT any other color\n' +
        '- ALL lines and arrows MUST BE SLIM — uniform thin stroke weight, approximately 1–2px, consistent throughout\n' +
        '- NO thick lines, NO heavy outlines, NO double-stroke lines, NO sketchy/wobbly lines\n' +
        '- Arrowheads: small, solid, simple BLACK triangles — NO open arrowheads, NO decorative arrowheads, NO curved/feathered arrowheads\n\n' +
        'OTHER STYLE RULES:\n' +
        '- Pure WHITE background\n' +
        '- All shapes have WHITE fills (NO colored fills, NO grey fills, NO tinted fills)\n' +
        '- Use rounded rectangles for process steps\n' +
        '- Use diamonds (rotated squares) for decision points (Yes/No branches)\n' +
        '- Use rounded oblongs (stadium shape) for start and end nodes\n' +
        '- Labels INSIDE each shape: short, sans-serif, BLACK text, single line preferred\n' +
        '- Yes/No or branch labels placed on or beside the connector lines (small, BLACK text)\n' +
        '- Logical top-down OR left-right flow — pick whichever is clearer for the subject\n' +
        '- Adequate whitespace between nodes; arrows do NOT cross each other where avoidable\n' +
        '- NO drop shadows, NO gradients, NO 3D effects, NO icons inside boxes, NO decorative elements\n' +
        '- Clean publication-quality typography — readable label sizes\n' +
        '- Output MUST be a PNG on a plain solid WHITE background\n\n' +
        'FINAL CHECK: every stroke in your output is slim and pure black on a pure white background. No exceptions.';
    } else if (mode === 'protocol') {
      // Protocol: numbered step diagram with slim PURE BLACK lines and arrows
      systemPrompt = 'You are an expert scientific diagram designer specializing in clean protocol/method diagrams.\n\n' +
        'CREATE A PROTOCOL DIAGRAM based on this method description: ' + prompt + '\n\n' +
        '#1 PRIORITY VISUAL RULE — APPLIES TO EVERY LINE, EVERY ARROW, EVERY CARD BORDER, EVERY ICON STROKE:\n' +
        '- ALL lines, arrows, arrowheads, card borders, and icon strokes MUST BE PURE BLACK (#000000) — NOT grey, NOT navy, NOT dark-blue, NOT brown, NOT any other color\n' +
        '- ALL lines and arrows MUST BE SLIM — uniform thin stroke weight, approximately 1–2px, consistent throughout\n' +
        '- NO thick lines, NO heavy outlines, NO double-stroke lines, NO sketchy/wobbly lines\n' +
        '- Arrowheads: small, solid, simple BLACK triangles — NO open arrowheads, NO decorative arrowheads\n\n' +
        'OTHER STYLE RULES:\n' +
        '- Pure WHITE background\n' +
        '- Linear horizontal flow of numbered step cards (left to right). If too long for one row, wrap to a second row with a clear connector.\n' +
        '- Each step card: rounded rectangle, WHITE fill, slim PURE BLACK border\n' +
        '- Each step has a small numbered badge (1, 2, 3, …) in the top-left corner of its card — solid BLACK filled circle with WHITE number inside\n' +
        '- Inside each card: a short step title (sans-serif, BLACK, bold), and optionally a 1-line description below it\n' +
        '- Optionally include a SIMPLE flat-line monochrome icon centered above the title (single PURE BLACK slim line drawing, no fills) representing the step (e.g. tube, pipette, gel, microscope) — keep it minimal\n' +
        '- Steps connected by slim PURE BLACK horizontal arrows (uniform stroke weight, solid simple BLACK arrowhead)\n' +
        '- Equal spacing and equal card sizes throughout\n' +
        '- NO color fills, NO gradients, NO shadows, NO 3D, NO decorative elements\n' +
        '- Readable, consistent typography — textbook-quality\n' +
        '- Output MUST be a PNG on a plain solid WHITE background\n\n' +
        'FINAL CHECK: every stroke in your output is slim and pure black on a pure white background. No exceptions.';
    } else if (mode === 'timeline') {
      // Timeline: horizontal experimental timeline with slim PURE BLACK lines and arrows
      systemPrompt = 'You are an expert scientific diagram designer specializing in clean experimental timelines.\n\n' +
        'CREATE A TIMELINE DIAGRAM based on this study description: ' + prompt + '\n\n' +
        '#1 PRIORITY VISUAL RULE — APPLIES TO EVERY LINE, EVERY ARROW, EVERY BOX BORDER, EVERY ICON STROKE:\n' +
        '- ALL lines (axis, ticks, leader lines), arrows, arrowheads, box borders, and icon strokes MUST BE PURE BLACK (#000000) — NOT grey, NOT navy, NOT dark-blue, NOT brown, NOT any other color\n' +
        '- ALL lines and arrows MUST BE SLIM — uniform thin stroke weight, approximately 1–2px, consistent throughout\n' +
        '- NO thick lines, NO heavy outlines, NO double-stroke lines, NO sketchy/wobbly lines\n' +
        '- Arrowheads: small, solid, simple BLACK triangles — NO open arrowheads, NO decorative arrowheads\n\n' +
        'OTHER STYLE RULES:\n' +
        '- Pure WHITE background\n' +
        '- One HORIZONTAL main axis line: slim PURE BLACK, spanning most of the width\n' +
        '- Tick marks along the axis at each key time point — short vertical slim PURE BLACK lines\n' +
        '- Time-point labels BELOW each tick: e.g. "Day 1", "Day 10", "Week 4", "Month 6" — short sans-serif, BLACK text\n' +
        '- Event boxes ABOVE the axis: rounded rectangles with WHITE fill and slim PURE BLACK border, connected to their tick mark via a short slim PURE BLACK vertical leader line\n' +
        '- Inside each event box: short event title (sans-serif, BLACK, bold), and optionally a 1-line description\n' +
        '- Optionally a SIMPLE monochrome line-icon inside or above each box (single PURE BLACK slim line drawing, no fills) — petri dish, mouse, syringe, tube, blot — keep minimal\n' +
        '- Stagger boxes vertically if needed to prevent overlap, but keep alignment clean\n' +
        '- Arrows on the time axis at start and/or end if showing direction (simple solid BLACK arrowhead)\n' +
        '- NO color fills, NO gradients, NO shadows, NO 3D, NO decorative elements\n' +
        '- Equal visual weight and consistent typography across all events\n' +
        '- Output MUST be a PNG on a plain solid WHITE background\n\n' +
        'FINAL CHECK: every stroke in your output is slim and pure black on a pure white background. No exceptions.';
    } else {
      // Icon generator (default) — single, centered, publication-ready icon.
      // Phase A: STYLE_RULES injected + "single subject centered" clause so
      // the model stops producing busy scenes when the user just wants one
      // icon. This is one of the highest-traffic modes and previously had
      // no anti-style anchoring at all.
      const action = isEdit
        ? 'EDIT the provided image according to the instructions while preserving the clean illustration style. Instructions: ' + prompt
        : 'Generate a clean, professional scientific illustration of: ' + prompt;

      systemPrompt = 'You are an expert biomedical illustrator generating a single publication-ready 2D icon in the BioRender flat-vector style.\n\n' +
        'Style rules:\n- ' + STYLE_RULES + '\n\n' +
        'ICON RULES:\n' +
        '- A STANDALONE illustration — a single, centered subject on a clean solid WHITE background, self-contained.\n' +
        '- BioRender-style biomedical illustration: clean flat 2D vector, simplified geometric shapes, publication-quality clarity.\n' +
        '- NO leader lines. NO callouts. NO arrows. NO dashed lines. NO pointers of any kind to any part of the subject.\n' +
        '- NO anatomic labels, NO annotations, NO markings that identify parts. The illustration itself communicates the subject — no labeling is used, ever.\n' +
        '- Fill the frame purposefully — no wasted whitespace or empty margins beyond a small breathing gap.\n' +
        '- Crisp bezier edges, uniform outline weight, no jitter.\n' +
        '- Anatomically and scientifically accurate proportions and colors.\n' +
        '- NO decorative background elements, scenery, or props beyond the icon subject itself.\n' +
        '- Output MUST be a PNG on a plain solid WHITE background.\n\n' +
        action + '.\n' + noTextRule;
    }

    console.log('[ai-illustrator] User: ' + user.id + ', Mode: ' + mode + ', Edit: ' + isEdit);

    // ── Multi-agent pipeline for reference-based modes ──
    // Pass 1 (Analysis): text-only — describe the reference in detail
    // Pass 2 (Generation): image output using analysis + reference
    const useMultiPass = isEdit && ['ref-to-figure', 'sketch-to-illustration', 'image-to-figure', 'photo-to-2d'].includes(mode);
    let imageInlineData: any = null;

    if (referenceImage) {
      const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        imageInlineData = { mimeType: 'image/' + base64Match[1], data: base64Match[2] };
      }
    }

    let analysisText = '';

    // ── Phase D — reference-style extraction ──────────────────────────────
    // Appended to the content-analysis prompt so Pass 1 also emits a
    // structured STYLE PROFILE describing palette, outline, fill, abstraction
    // level, background, shape language, detail density, and a one-line tag.
    // Injected into Pass 2 so the image-generator has an explicit style
    // contract to satisfy — not just the reference image itself, which the
    // model is inconsistent at reading. Kill switch: PHASE_D_DISABLED=true.
    const phaseDEnabled = Deno.env.get('PHASE_D_DISABLED') !== 'true';
    const styleProfileSuffix = phaseDEnabled
      ? '\n\n────\n' +
        'At the very end of your response, add a section titled "## STYLE PROFILE" describing the reference\'s VISUAL STYLE (not its content) using this exact schema:\n' +
        '- **Palette**: 3–5 primary colors as hex codes when identifiable (e.g., #E97451, #4A90E2), or descriptive names.\n' +
        '- **Outline treatment**: color, weight, style (crisp / hand-drawn / none).\n' +
        '- **Fill treatment**: flat solid / soft gradient / textured / hatched.\n' +
        '- **Abstraction level**: photorealistic / semi-realistic / cartoon / iconic / diagrammatic.\n' +
        '- **Background**: pure white / textured / colored / illustrated.\n' +
        '- **Shape language**: geometric / organic / mixed.\n' +
        '- **Detail density**: minimalist / moderate / dense.\n' +
        '- **One-line style tag**: a single sentence, e.g. "clean flat vector infographic, muted teal/coral, no gradients."\n\n' +
        'Be specific and concrete — this profile will be handed verbatim to an illustrator to reproduce the reference\'s style.'
      : '';

    if (useMultiPass && imageInlineData) {
      // ── PASS 1: Analysis Agent ──
      const analysisPrompt = mode === 'sketch-to-illustration'
        ? 'You are a scientific image analyst. Study this hand-drawn sketch carefully and produce a DETAILED inventory.\n\n' +
          'List EVERY element you see:\n' +
          '1. Count the exact number of distinct shapes, objects, arrows, and lines\n' +
          '2. For EACH element describe: what it appears to be, its approximate position (top-left, center, bottom-right, etc.), its relative size, and its color if visible\n' +
          '3. Describe how elements connect to each other (arrows, lines, proximity)\n' +
          '4. Note the overall layout direction (left-to-right, top-to-bottom, radial, etc.)\n' +
          '5. Identify any text or labels and what they say\n' +
          '6. Note any ambiguous elements and your best interpretation\n\n' +
          'Be exhaustive — every shape matters. This inventory will be used to recreate the sketch as a clean illustration.' +
          styleProfileSuffix
        : mode === 'ref-to-figure'
        ? 'You are a scientific image analyst. Study this reference image carefully and produce a DETAILED structural description.\n\n' +
          'Describe:\n' +
          '1. What is the subject? (cell, organ, pathway, apparatus, organism, etc.)\n' +
          '2. List EVERY distinct structure/component visible and its spatial position\n' +
          '3. For each structure: describe its shape, color, size relative to others, and what it represents\n' +
          '4. Describe spatial relationships between structures (inside, adjacent, overlapping, connected by...)\n' +
          '5. Note the overall composition and layout\n' +
          '6. Identify any labels, arrows, or annotations and what they indicate\n' +
          '7. Note the color palette used\n\n' +
          'Be thorough and precise — this description will guide an illustrator to recreate this as a flat 2D scientific figure.' +
          styleProfileSuffix
        : mode === 'image-to-figure'
        ? 'You are a scientific image analyst. Study this image (photo, micrograph, or diagram) and produce a DETAILED description for conversion to a publication figure.\n\n' +
          'Describe:\n' +
          '1. What type of image is this? (microscopy, photograph, gel, diagram, etc.)\n' +
          '2. List ALL structures/features visible with their positions and relative sizes\n' +
          '3. For each structure: shape, color, what it represents scientifically\n' +
          '4. Describe the spatial organization and any visible scale\n' +
          '5. Note which structures would need labels in a publication figure\n' +
          '6. Describe the overall composition\n\n' +
          'This description will guide the creation of a clean, labeled publication figure.' +
          styleProfileSuffix
        : 'You are a scientific image analyst. Study this photograph and produce a DETAILED description for conversion to a flat 2D illustration.\n\n' +
          'Describe:\n' +
          '1. What is depicted in the photo?\n' +
          '2. List ALL distinct objects/structures with positions and relative sizes\n' +
          '3. For each: describe its 3D shape, color, texture, and how to simplify it into flat 2D\n' +
          '4. Describe lighting, shadows, and depth that should be removed in 2D conversion\n' +
          '5. Note the background and what should be omitted\n' +
          '6. Describe the overall composition\n\n' +
          'This description will guide the creation of a clean flat 2D illustration.' +
          styleProfileSuffix;

      console.log('[ai-illustrator] Pass 1: Analyzing reference image...' + (phaseDEnabled ? ' [phase-d]' : ''));

      const analysisController = new AbortController();
      const analysisTimeout = setTimeout(() => analysisController.abort(), 30000);

      try {
        const analysisResponse = await fetch(
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
                  { text: analysisPrompt },
                  { inlineData: imageInlineData },
                ],
              }],
              // Phase D added the STYLE PROFILE tail (~200–400 tokens), so
              // 2048 was tight. 3072 gives the analyzer room without wasting
              // budget.
              generationConfig: { maxOutputTokens: 3072 },
            }),
            signal: analysisController.signal,
          }
        );

        clearTimeout(analysisTimeout);

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          const textPart = analysisData?.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
          if (textPart?.text) {
            analysisText = textPart.text;
            console.log('[ai-illustrator] Pass 1 complete: ' + analysisText.length + ' chars analysis');
          }
        } else {
          console.warn('[ai-illustrator] Pass 1 failed (status ' + analysisResponse.status + '), falling back to single-pass');
        }
      } catch (e) {
        clearTimeout(analysisTimeout);
        console.warn('[ai-illustrator] Pass 1 failed:', e);
      }
    }

    // ── PASS 2 (or single pass): Generate image ──
    const parts: any[] = [{ text: systemPrompt }];
    if (stylePresetBlock) {
      parts.push({ text: '\n\n' + stylePresetBlock });
    }

    // If multi-pass analysis succeeded, prepend it. On ref-to-figure the user
    // explicitly wants their new figure to look like the reference — the
    // STYLE PROFILE section (Phase D) becomes a hard style contract there.
    // Other modes have prescribed target styles (flat vector for photo-to-2d,
    // clean illustration for sketch-to-illustration, publication figure for
    // image-to-figure), so we don't force strict style matching for them —
    // the STYLE PROFILE still rides in as context (palette hints, etc.) but
    // doesn't override the mode's own rules.
    if (analysisText) {
      const styleClause = mode === 'ref-to-figure' && phaseDEnabled
        ? '\n\nAdditionally, the analysis includes a "## STYLE PROFILE" section. Match that profile EXACTLY — palette, outline treatment, fill treatment, abstraction level, background, shape language, and detail density must replicate the reference\'s style. This is critical for icon-set consistency.'
        : '';
      parts.push({
        text: '\n\n── DETAILED ANALYSIS OF THE REFERENCE ──\n' +
          'An expert analyst has examined the reference image and produced this inventory. ' +
          'Use this as your PRIMARY guide — reproduce every element listed here faithfully:\n\n' +
          analysisText + '\n\n── END ANALYSIS ──\n\n' +
          'Now generate the illustration based on the analysis above and the reference image below. ' +
          'Every element in the analysis MUST appear in your output. Do not add elements not listed.' +
          styleClause,
      });
    }

    if (imageInlineData) {
      parts.push({ inlineData: imageInlineData });
      parts.push({
        text: analysisText
          ? 'This is the reference image described in the analysis above. Recreate it faithfully as instructed.'
          : 'Use this image as the starting point. Modify it according to the instructions. Output the modified image.',
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    console.log('[ai-illustrator] Pass ' + (analysisText ? '2' : '1') + ': Generating image...');

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            thinkingConfig: { thinkingBudget: -1 },
            ...(imageConfig ? { imageConfig } : {}),
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[ai-illustrator] Gemini error: ' + geminiResponse.status, errorText);
      if (geminiResponse.status === 429) throw new Error('RATE_LIMITED');
      throw new Error('AI API error: ' + geminiResponse.status);
    }

    const geminiData = await geminiResponse.json();
    const geminiParts = geminiData?.candidates?.[0]?.content?.parts;
    const imagePart = geminiParts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart) {
      throw new Error('No image generated');
    }

    const resultMime = imagePart.inlineData.mimeType;
    const resultBase64 = imagePart.inlineData.data;

    // Record usage for quota tracking
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const { error: usageInsertError } = await supabase.from('ai_generation_usage').insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: userPrompt.substring(0, 200),
        style: mode,
        generation_type: 'ai-illustrator',
      });
      if (usageInsertError) {
        console.error('[ai-illustrator] Usage insert failed:', JSON.stringify(usageInsertError));
      } else {
        console.log('[ai-illustrator] Usage recorded for user:', user.id);
      }
    } catch (usageErr) {
      console.error('[ai-illustrator] Failed to record usage:', usageErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        image: 'data:' + resultMime + ';base64,' + resultBase64,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ai-illustrator] Error:', error);
    // Refund every credit we deducted — the user shouldn't be charged for a failed generation.
    if (supabaseForRefund) {
      for (const gid of generationIds) {
        try {
          await supabaseForRefund.rpc('refund_ai_generation', { p_generation_id: gid });
        } catch (refundErr) {
          console.error('[ai-illustrator] Refund failed for ' + gid + ':', refundErr);
        }
      }
    }

    let statusCode = 500;
    if (error.message === 'RATE_LIMITED') statusCode = 429;
    if (error.message === 'Unauthorized') statusCode = 401;
    if (error.message === 'QUOTA_EXCEEDED') statusCode = 403;

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
