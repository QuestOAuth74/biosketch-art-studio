// ============================================================================
// refine-image edge function — post-generation edits for AI Illustrator
// ============================================================================
// Runs mode-dispatched Gemini image-edit passes on an already-generated figure.
// Charges 1 AI credit per successful refine; auto-refunds on failure.
//
// Modes shipping in Tier 1:
//   * 'recolor' — apply a palette to an existing figure while preserving
//                 structure, labels, and composition.
//
// Modes planned:
//   * 'aspect'  — extend the figure into a new aspect ratio (outpaint)
//   * 'region'  — inpaint a user-selected mask region with a new prompt
//
// Design mirrors ai-illustrator/index.ts so the credit + refund + error
// contract is identical from the frontend's point of view.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { waitingPeriodResponseForUser } from '../_shared/aiCredits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Build the Gemini prompt for a recolor pass. We're explicit that ONLY colors
 * change — Gemini 3 Pro Image will otherwise drift on shapes/labels if the
 * instruction isn't tight.
 */
function buildRecolorPrompt(palette: string[]): string {
  const paletteList = palette
    .filter((c) => typeof c === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(c))
    .slice(0, 8) // Reasonable ceiling; more than 8 dilutes the constraint.
    .join(', ');

  return [
    'Recolor the provided scientific figure using ONLY the following palette:',
    paletteList + '.',
    '',
    'Requirements — non-negotiable:',
    '- Preserve the exact composition, subject, and structure. No added, removed, or repositioned elements.',
    '- Preserve every label, text annotation, and line marker exactly as it appears.',
    '- Preserve the outline weights and line widths.',
    '- Replace each existing fill color with the nearest hue from the provided palette.',
    '- Backgrounds stay clean (white or a very light tint from the palette).',
    '- Output must be a single publication-quality raster figure at the same aspect ratio.',
  ].join('\n');
}

const ALLOWED_ASPECTS = new Set(['1:1', '3:4', '4:3', '16:9', '2:3', '9:16']);
const ALLOWED_DIRECTIONS = new Set(['all', 'left', 'right', 'top', 'bottom']);

/**
 * Build the Gemini prompt for an aspect-ratio change (outpaint). The model
 * respects `generationConfig.imageConfig.aspectRatio` for the OUTPUT shape,
 * but we still need to be explicit about the intent — otherwise it'll crop
 * the input instead of extending it.
 */
/**
 * Build the Gemini prompt for a region-select redraw (inpaint). The mask is
 * passed as a SEPARATE image (white = editable, black = preserve). Gemini 3
 * Pro Image doesn't have a first-class mask parameter — it just receives
 * both images and follows the instruction that references them.
 *
 * The client-side composite guard is our safety net: we swap pixels outside
 * the user's mask box back to the original, so even if Gemini drifts we get
 * pixel-exact preservation everywhere except the requested area.
 */
function buildRegionPrompt(userPrompt: string): string {
  return [
    'You will be given TWO images:',
    '  1. The original scientific figure.',
    '  2. A mask image — same dimensions — where WHITE pixels mark the region to redraw and BLACK pixels mark the region that must stay unchanged.',
    '',
    'Redraw ONLY the WHITE region of the mask according to this instruction:',
    `"${userPrompt.trim()}"`,
    '',
    'Requirements — non-negotiable:',
    '- Everything covered by BLACK in the mask MUST remain pixel-identical to the original.',
    '- The redrawn region must blend seamlessly with the surrounding content — matching palette, line weight, and style.',
    '- Do NOT resize, reflow, or reposition the rest of the figure.',
    '- Return a single publication-quality raster image at the same dimensions as the original.',
  ].join('\n');
}

/**
 * Text-edit inpaint prompt. Same mask contract as region mode (WHITE = edit,
 * BLACK = preserve), but the instruction is specialized for text replacement:
 * we tell Gemini exactly what to swap in, and demand the SAME visual style
 * (font family, weight, color, size, orientation) so the label reads as if
 * it were part of the original generation.
 *
 * The client-side compositeWithMask still runs after this — pixels outside
 * the mask stay pixel-exact regardless of Gemini's response.
 */
function buildTextEditPrompt(
  oldText: string,
  newText: string,
  fontMeta?: { family?: string; size?: number; bold?: boolean; color?: string },
): string {
  // Optional font hints layered onto the style-match line as an advisory
  // suffix — kept as hint-not-spec so the primary "draw NEW text here"
  // directive stays dominant.
  const hints: string[] = [];
  if (fontMeta?.family && typeof fontMeta.family === 'string') hints.push(`font family close to "${fontMeta.family}"`);
  if (Number.isFinite(fontMeta?.size)) hints.push(`~${Math.round(fontMeta!.size!)}pt at 1000-px image height`);
  if (fontMeta?.bold === true) hints.push('bold stroke weight');
  else if (fontMeta?.bold === false) hints.push('regular (non-bold) stroke weight');
  if (fontMeta?.color && typeof fontMeta.color === 'string') hints.push(`glyph fill color ${fontMeta.color}`);
  const fontHint = hints.length > 0
    ? ` For reference, an expert font analyst identified: ${hints.join(', ')}.`
    : '';

  return [
    'You will be given TWO images:',
    '  1. A scientific figure. The WHITE region of the mask (see below) has ALREADY been pre-cleared to a solid background color — there is NO existing text inside the white region; the label that used to be there has been erased. Your job is to draw the new text into that cleared space.',
    '  2. A mask image — same dimensions — where WHITE pixels mark the region to fill with new text, and BLACK pixels mark the region that must stay pixel-identical to the input image.',
    '',
    `Task: within the WHITE region of the mask, render the following text: "${newText.trim()}".`,
    `(For style reference only: the label that previously occupied this region read "${oldText.trim()}". Do NOT preserve or draw that old text — draw the new text instead. Just match the visual style — same font family, weight, size, color — as that reference and as other labels elsewhere in the figure.)`,
    '',
    'Requirements — non-negotiable:',
    `- Render "${newText.trim()}" inside the white mask region. Match visual style to surrounding labels in the figure: font family, weight, italic/upright, color, size, letter spacing, and rotation.${fontHint}`,
    '- Center the new text horizontally and vertically within the white mask region.',
    '- Everything covered by BLACK in the mask MUST remain pixel-identical to the input image.',
    '- Do NOT resize, reflow, or reposition the rest of the figure.',
    '- Do NOT re-draw the OLD text anywhere in the output.',
    '- Return a single publication-quality raster image at the same dimensions as the input.',
  ].join('\n');
}

function buildAspectPrompt(targetAspect: string, direction: string): string {
  const directionPhrase =
    direction === 'all'    ? 'evenly on all sides'
  : direction === 'left'   ? 'to the left of the figure'
  : direction === 'right'  ? 'to the right of the figure'
  : direction === 'top'    ? 'above the figure'
  : direction === 'bottom' ? 'below the figure'
  : 'evenly on all sides';

  return [
    `Extend the provided scientific figure to fit a ${targetAspect} aspect ratio.`,
    `Add new content ${directionPhrase} to fill the additional space.`,
    '',
    'Requirements — non-negotiable:',
    '- The existing figure content must remain unchanged and correctly positioned.',
    '- Do NOT crop, resize, or reflow the existing figure — only ADD space around it.',
    '- New content in the extended area must match the existing style, palette, and subject matter.',
    '- Preserve outline weights, colors, and typographic style.',
    '- Keep backgrounds consistent (same color as the original background).',
    '- Output a single publication-quality raster figure at the requested aspect ratio.',
  ].join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside try so both the success + error branches can refund.
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
      mode,             // 'recolor' | 'aspect' | 'region'
      originalImage,    // data URL of the current figure
      palette,          // for recolor mode: array of hex strings
      targetAspect,     // for aspect mode: '1:1' | '3:4' | '4:3' | '16:9' | '2:3' | '9:16'
      direction,        // for aspect mode: 'all' | 'left' | 'right' | 'top' | 'bottom'
      maskImage,        // for region/text-edit mode: data URL of a same-size mask (white = editable, black = preserve)
      regionPrompt,     // for region mode: what to redraw in the marked area
      oldText,          // for text-edit mode: the current text inside the mask
      newText,          // for text-edit mode: what to replace it with
      fontMeta,         // for text-edit mode: { family?, size?, bold?, color? } from refined detect-text — passed into the prompt as explicit constraints
    } = body;

    if (!mode) throw new Error('Missing mode');
    if (!originalImage) throw new Error('Missing originalImage');
    if (typeof originalImage !== 'string' || !originalImage.startsWith('data:image/')) {
      throw new Error('originalImage must be a data URL (data:image/...)');
    }

    // Mode-specific validation + prompt construction.
    let prompt: string;
    let outputAspect: string | undefined;
    let extraImage: { mime: string; data: string } | undefined; // For region mode: the mask
    switch (mode) {
      case 'recolor': {
        if (!Array.isArray(palette) || palette.length === 0) {
          throw new Error('Recolor requires a non-empty palette');
        }
        prompt = buildRecolorPrompt(palette);
        break;
      }
      case 'aspect': {
        if (!targetAspect || !ALLOWED_ASPECTS.has(targetAspect)) {
          throw new Error(`Aspect requires targetAspect in ${[...ALLOWED_ASPECTS].join(', ')}`);
        }
        const dir = typeof direction === 'string' && ALLOWED_DIRECTIONS.has(direction)
          ? direction
          : 'all';
        prompt = buildAspectPrompt(targetAspect, dir);
        outputAspect = targetAspect;
        break;
      }
      case 'region': {
        if (typeof regionPrompt !== 'string' || regionPrompt.trim().length === 0) {
          throw new Error('Region requires regionPrompt (what to redraw)');
        }
        if (typeof maskImage !== 'string' || !maskImage.startsWith('data:image/')) {
          throw new Error('Region requires maskImage as a data URL (white=edit, black=keep)');
        }
        const maskMatch = maskImage.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
        if (!maskMatch) throw new Error('maskImage data URL malformed');
        extraImage = { mime: maskMatch[1], data: maskMatch[2] };
        prompt = buildRegionPrompt(regionPrompt);
        break;
      }
      case 'text-edit': {
        if (typeof oldText !== 'string') throw new Error('text-edit requires oldText');
        if (typeof newText !== 'string' || newText.trim().length === 0) {
          throw new Error('text-edit requires non-empty newText');
        }
        if (typeof maskImage !== 'string' || !maskImage.startsWith('data:image/')) {
          throw new Error('text-edit requires maskImage as a data URL (white=edit, black=keep)');
        }
        const maskMatch = maskImage.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
        if (!maskMatch) throw new Error('maskImage data URL malformed');
        extraImage = { mime: maskMatch[1], data: maskMatch[2] };
        // fontMeta is optional — if present, buildTextEditPrompt injects
        // explicit constraints (family, size, bold, color); if absent, it
        // falls back to the generic "match the style" wording.
        prompt = buildTextEditPrompt(oldText, newText, fontMeta);
        break;
      }
      default:
        throw new Error(`Unsupported refine mode: ${mode}`);
    }

    // ── Credit deduction ─────────────────────────────────────────────────────
    // 1 credit per refine. INSUFFICIENT_CREDITS → 402 so the frontend can open
    // the buy/share dialog (same contract as ai-illustrator).
    const { data: deductedId, error: deductError } = await supabase.rpc(
      'deduct_ai_generation',
      { p_user_id: user.id, p_feature: `refine-image:${mode}` },
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

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    // ── Extract base64 payload from the incoming data URL ────────────────────
    const dataUrlMatch = originalImage.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
    if (!dataUrlMatch) throw new Error('originalImage data URL malformed');
    const [, originalMime, originalBase64] = dataUrlMatch;

    // ── Gemini 3 Pro Image call ──────────────────────────────────────────────
    // Same endpoint/pattern as ai-illustrator's referenceImage path.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    console.log(`[refine-image] mode=${mode} user=${user.id} palette=${palette?.length ?? 'n/a'} aspect=${outputAspect ?? 'n/a'} hasMask=${extraImage ? 'yes' : 'no'}`);

    // Assemble Gemini parts. For region mode we send BOTH the original AND
    // the mask, in that order — the prompt references them positionally.
    const geminiParts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: originalMime, data: originalBase64 } },
    ];
    if (extraImage) {
      geminiParts.push({ inlineData: { mimeType: extraImage.mime, data: extraImage.data } });
    }

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: geminiParts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            // Only set imageConfig.aspectRatio for the aspect mode — omitting
            // it lets Gemini preserve the input dimensions for recolor/region.
            ...(outputAspect ? { imageConfig: { aspectRatio: outputAspect } } : {}),
          },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`[refine-image] Gemini error ${geminiResponse.status}:`, errorText);
      if (geminiResponse.status === 429) throw new Error('RATE_LIMITED');
      throw new Error('AI API error: ' + geminiResponse.status);
    }

    const geminiData = await geminiResponse.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart) throw new Error('No image returned from AI');

    const resultMime = imagePart.inlineData.mimeType;
    const resultBase64 = imagePart.inlineData.data;

    // Non-blocking usage log — matches ai-illustrator (legacy table for admin analytics).
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      await supabase.from('ai_generation_usage').insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: prompt.substring(0, 200),
        style: mode,
        generation_type: 'ai-illustrator-refine',
      });
    } catch (usageErr) {
      console.error('[refine-image] usage insert failed:', usageErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        image: 'data:' + resultMime + ';base64,' + resultBase64,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[refine-image] Error:', error);

    // Refund on any failure past the deduction point.
    if (generationId && supabaseForRefund) {
      try {
        await supabaseForRefund.rpc('refund_ai_generation', { p_generation_id: generationId });
      } catch (refundErr) {
        console.error('[refine-image] Refund failed:', refundErr);
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
