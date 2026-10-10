// ============================================================================
// detect-text edge function — locate text regions in a generated figure
// ============================================================================
// Two modes:
//
//   Free / basic (refined=false, default):
//     gemini-2.5-flash. Returns [{text, bbox}]. Absorbed cost — powers the
//     Edit Text overlay and the free "PPT (editable)" figure export.
//
//   Refined (refined=true, 1 credit):
//     gemini-2.5-pro. Returns [{text, bbox, fontFamily, fontSize, color,
//     bold, italic, rotation, backgroundColor}] — the same set the client
//     needs to build a high-fidelity editable PowerPoint (font/color/style
//     match the original label, bg color used for smarter whitening).
//     Charged as `detect-text:refined` and auto-refunded on failure.
//
// Coordinates: bbox is [x0, y0, x1, y1] normalized 0..1, top-left origin.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';
import { waitingPeriodResponseForUser } from '../_shared/aiCredits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TextItem {
  text: string;
  bbox: [number, number, number, number];
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  rotation?: number;
  backgroundColor?: string;
}

/**
 * Cheap hex sanity — accept "#RRGGBB", "#RGB", "RRGGBB", etc, else drop.
 */
function normHex(v: any): string | undefined {
  if (typeof v !== 'string') return undefined;
  const cleaned = v.trim().replace('#', '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(cleaned)) {
    return cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (/^[0-9A-F]{6}$/.test(cleaned)) return cleaned;
  if (/^[0-9A-F]{8}$/.test(cleaned)) return cleaned.substring(0, 6); // strip alpha
  return undefined;
}

function normalizeItems(raw: any, refined: boolean): TextItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TextItem[] = [];
  for (const it of raw) {
    if (!it || typeof it.text !== 'string') continue;
    const text = it.text.trim();
    if (text.length === 0) continue;
    const bb = it.bbox;
    if (!Array.isArray(bb) || bb.length !== 4) continue;
    const nums = bb.map((v: any) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(1, n));
    });
    if (nums.some((n: any) => n === null)) continue;
    const [x0, y0, x1, y1] = nums as [number, number, number, number];
    if (x1 <= x0 || y1 <= y0) continue;

    const item: TextItem = {
      text: text.substring(0, 200),
      bbox: [x0, y0, x1, y1],
    };

    if (refined) {
      if (typeof it.fontFamily === 'string' && it.fontFamily.trim()) {
        item.fontFamily = it.fontFamily.trim().substring(0, 40);
      }
      if (Number.isFinite(Number(it.fontSize))) {
        const n = Math.round(Number(it.fontSize));
        if (n >= 4 && n <= 200) item.fontSize = n;
      }
      const color = normHex(it.color);
      if (color) item.color = color;
      const bg = normHex(it.backgroundColor);
      if (bg) item.backgroundColor = bg;
      if (it.bold === true) item.bold = true;
      if (it.italic === true) item.italic = true;
      if (Number.isFinite(Number(it.rotation))) {
        const r = Number(it.rotation);
        // Rotation in degrees; wrap into (-360, 360).
        if (Math.abs(r) < 360) item.rotation = Math.round(r);
      }
    }

    out.push(item);
  }
  return out.slice(0, 60);
}

function buildDetectPrompt(refined: boolean): string {
  const basePrompt = [
    'You are a text-detection engine for scientific figures.',
    'Return EVERY text region visible in the image — labels, captions, axis titles, arrow annotations, gene/protein names, numbers, units.',
    'For each region give:',
    '  - text: the exact string as rendered (preserve case, symbols, Greek letters where possible).',
    '  - bbox: [x0, y0, x1, y1] axis-aligned bounding box in NORMALIZED coordinates (0..1), top-left origin.',
    '    x0 = left edge, y0 = top edge, x1 = right edge, y1 = bottom edge.',
    '    The box must TIGHTLY contain the text glyphs. Do NOT include leading whitespace, arrow tails, leader lines, connecting rules, or decorative marks. Only the glyphs themselves.',
    '',
    'Rules:',
    '- One entry per SINGLE-LINE text block. Multi-word labels on the same line stay together (e.g. "Endoplasmic reticulum" is ONE entry).',
    '- SPLIT stacked / multi-line labels into ONE ENTRY PER LINE. A two-line callout ("Golgi\\napparatus") returns as TWO entries with two separate tight bboxes — never merge stacked lines into a single tall bbox, because the downstream rebuild depends on per-line coordinates.',
    '- Preserve subscripts and superscripts using Unicode when possible: H₂O, Ca²⁺, CO₂, α, β, μ, ‰, →, ↑, ↓. If the exact Unicode is uncertain, use the closest visual match (e.g. "H2O" is acceptable as a fallback but "H₂O" is preferred).',
    '- Preserve Greek letters and math symbols: α β γ δ ε λ μ π σ τ φ χ ψ ω Δ Σ Ω ± × ÷ ≈ ≠ ≤ ≥ ° · ′ ″.',
    '- Skip decorative marks that are not text (arrows without labels, dots, geometric shapes, grid ticks without values).',
    '- If two labels are visually adjacent but say different things (e.g. "MEK1" and "MEK2"), return them as two entries.',
    '- Include units and axis values as separate entries when they sit apart from their axis title.',
    '- If the figure has no text at all, return an empty items array.',
  ];
  if (!refined) {
    basePrompt.push('', 'Respond ONLY with JSON matching this schema — no prose.');
    return basePrompt.join('\n');
  }
  return [
    ...basePrompt,
    '',
    'REFINED MODE — additionally provide the STYLE of each label so we can rebuild it as an editable text box in PowerPoint. For each region also give:',
    '  - fontFamily: the font family that best matches. Prefer specific matches over "Calibri". Recognize: "Calibri", "Arial", "Helvetica", "Times New Roman", "Georgia", "Courier New", "Palatino", "Verdana", "Tahoma", "Garamond", "Cambria". If the label reads as a serif figure caption, prefer "Times New Roman" or "Georgia" — NOT Calibri. If the label reads as a slab or fixed-width numeric axis, prefer "Courier New". Guess conservatively only when no strong match exists.',
    '  - fontSize: approximate point size given the image is 1000 pixels tall. Integer between 6 and 96. Look at the actual glyph height, not the bbox height.',
    '  - color: text color as "#RRGGBB" hex. Sample from the darkest pixels inside the glyphs.',
    '  - bold: true if the strokes are visually thicker than typical body text on that font.',
    '  - italic: true if the glyphs are visibly slanted.',
    '  - rotation: degrees CLOCKWISE from upright reading direction. 0 = normal horizontal. 90 = reading top-to-bottom (right side of a plot). 270 (equivalently -90) = reading bottom-to-top (standard Y-axis title on the left). 180 = upside-down. Integer, default 0.',
    '  - backgroundColor: dominant color IMMEDIATELY behind the text glyphs — sample a 3-5 px ring around the letter shapes, NOT far away. This is what a whitening rectangle will be painted with to erase the text seamlessly, so accuracy matters. "#RRGGBB" hex. Default "#FFFFFF" only if the surroundings really are white.',
    '',
    'Prioritize ACCURACY over speed — this call costs the user a credit. When in doubt about a font, prefer a specific match to "Calibri". When in doubt about rotation, look at the baseline direction of the glyphs. When in doubt about a multi-line label, split it.',
    'Respond ONLY with JSON matching this schema — no prose.',
  ].join('\n');
}

function buildResponseSchema(refined: boolean): any {
  const props: any = {
    text: { type: 'string' },
    bbox: {
      type: 'array',
      items: { type: 'number' },
      minItems: 4,
      maxItems: 4,
    },
  };
  const required = ['text', 'bbox'];
  if (refined) {
    props.fontFamily = { type: 'string' };
    props.fontSize = { type: 'number' };
    props.color = { type: 'string' };
    props.bold = { type: 'boolean' };
    props.italic = { type: 'boolean' };
    props.rotation = { type: 'number' };
    props.backgroundColor = { type: 'string' };
  }
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: props,
          required,
        },
      },
    },
    required: ['items'],
  };
}

/**
 * Structured error surfaced to the client. `code` is machine-readable so
 * the UI can map to friendly copy; `message` is a human-readable one-liner
 * used as the default fallback if the client has nothing better.
 */
interface DetectError {
  code:
    | 'RATE_LIMITED'
    | 'TIMEOUT'
    | 'IMAGE_TOO_LARGE'
    | 'IMAGE_MALFORMED'
    | 'SAFETY_BLOCK'
    | 'MODEL_ERROR'
    | 'PARSE_ERROR'
    | 'UNAUTHORIZED'
    | 'INSUFFICIENT_CREDITS'
    | 'MISCONFIGURED'
    | 'UNKNOWN_ERROR';
  message: string;
  status: number;
  retryable: boolean;
}

function classifyGeminiError(httpStatus: number, bodyText: string): DetectError {
  // Safety filter blocks show up as either 400 with a specific message or as
  // 200 with candidates[].finishReason === 'SAFETY'. Bucket the 400 case here.
  const lowered = bodyText.toLowerCase();
  if (httpStatus === 429) {
    return {
      code: 'RATE_LIMITED',
      message: 'The text detector is temporarily busy — please try again in a few seconds.',
      status: 429,
      retryable: true,
    };
  }
  if (httpStatus === 400 && (lowered.includes('safety') || lowered.includes('blocked'))) {
    return {
      code: 'SAFETY_BLOCK',
      message: 'The AI model declined to analyze this image. Try a different figure.',
      status: 400,
      retryable: false,
    };
  }
  if (httpStatus === 400 && (lowered.includes('too large') || lowered.includes('payload'))) {
    return {
      code: 'IMAGE_TOO_LARGE',
      message: 'This image is too large or dense for text detection. Try downloading it and re-uploading a smaller copy.',
      status: 413,
      retryable: false,
    };
  }
  if (httpStatus >= 500 && httpStatus <= 599) {
    return {
      code: 'MODEL_ERROR',
      message: 'The AI text detector had a transient error. Please try again.',
      status: 502,
      retryable: true,
    };
  }
  return {
    code: 'MODEL_ERROR',
    message: `The text detector returned an error (${httpStatus}). Try again or use the free PPT export instead.`,
    status: 502,
    retryable: httpStatus >= 500,
  };
}

async function callGeminiOnce({
  apiKey,
  modelName,
  detectPrompt,
  imgMime,
  imgBase64,
  isRefined,
  timeoutMs,
}: {
  apiKey: string;
  modelName: string;
  detectPrompt: string;
  imgMime: string;
  imgBase64: string;
  isRefined: boolean;
  timeoutMs: number;
}): Promise<{ ok: true; parsed: any } | { ok: false; error: DetectError }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: detectPrompt },
              { inlineData: { mimeType: imgMime, data: imgBase64 } },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: buildResponseSchema(isRefined),
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[detect-text] Gemini error ${response.status}:`, errorText.substring(0, 400));
      return { ok: false, error: classifyGeminiError(response.status, errorText) };
    }

    const data = await response.json();
    // Safety finish reasons can arrive with an OK http status.
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
      return {
        ok: false,
        error: {
          code: 'SAFETY_BLOCK',
          message: 'The AI model declined to analyze this image. Try a different figure.',
          status: 400,
          retryable: false,
        },
      };
    }
    const textPart = data?.candidates?.[0]?.content?.parts?.find(
      (p: any) => typeof p.text === 'string',
    );
    if (!textPart) {
      return {
        ok: false,
        error: {
          code: 'MODEL_ERROR',
          message: 'The detector returned no result. Please try again.',
          status: 502,
          retryable: true,
        },
      };
    }
    let parsed: any;
    try {
      parsed = JSON.parse(textPart.text);
    } catch {
      console.warn('[detect-text] JSON parse failed. Raw:', textPart.text.substring(0, 400));
      return {
        ok: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'The detector returned an unexpected format. Please try again.',
          status: 502,
          retryable: true,
        },
      };
    }
    return { ok: true, parsed };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        error: {
          code: 'TIMEOUT',
          message: 'The detector took too long — the image may be too complex. Try a simpler figure or the free PPT export.',
          status: 504,
          retryable: true,
        },
      };
    }
    console.error('[detect-text] network / runtime error:', err);
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Something went wrong reaching the detector. Please try again.',
        status: 500,
        retryable: true,
      },
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let generationId: string | null = null;
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  /** Emit a structured JSON error response the client can map to friendly copy. */
  const respondError = async (err: DetectError) => {
    if (generationId && supabaseForRefund) {
      try {
        await supabaseForRefund.rpc('refund_ai_generation', { p_generation_id: generationId });
      } catch (refundErr) {
        console.error('[detect-text] Refund failed:', refundErr);
      }
      generationId = null;
    }
    return new Response(
      JSON.stringify({ success: false, error: err.code, message: err.message }),
      { status: err.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    supabaseForRefund = supabase;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return respondError({
        code: 'UNAUTHORIZED',
        message: 'You need to be signed in to run text detection.',
        status: 401,
        retryable: false,
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return respondError({
        code: 'UNAUTHORIZED',
        message: 'Your session has expired. Sign in again to run text detection.',
        status: 401,
        retryable: false,
      });
    }

    const body = await req.json().catch(() => ({}));
    // `bypassCredit` lets composite flows (e.g. AI Illustrator text-edit)
    // request refined detection without a second deduction — the text-edit
    // itself already costs 1 credit via refine-image; charging another one
    // for the detection would double the cost of the feature. Absorbed
    // server-side, tiny (~$0.001 per Pro call). The abuse ceiling is low:
    // a client would need to know the flag AND scientific-figure OCR is a
    // niche use, so we don't gate further.
    const { image, refined, bypassCredit } = body ?? {};
    const isRefined = refined === true;
    const shouldCharge = isRefined && bypassCredit !== true;
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return respondError({
        code: 'IMAGE_MALFORMED',
        message: 'Could not read the image data. Try re-generating the figure and running the export again.',
        status: 400,
        retryable: false,
      });
    }

    const match = image.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
    if (!match) {
      return respondError({
        code: 'IMAGE_MALFORMED',
        message: 'Could not read the image data. Try re-generating the figure and running the export again.',
        status: 400,
        retryable: false,
      });
    }
    let [, imgMime, imgBase64] = match;
    // Gemini caps inline image payloads around 20 MB. Base64 inflates by ~1.33×
    // so gate raw base64 length at 18 MB before we forward.
    if (imgBase64.length > 18 * 1024 * 1024) {
      return respondError({
        code: 'IMAGE_TOO_LARGE',
        message: 'This image is too large for text detection. Try downloading the PNG at a smaller size and re-uploading.',
        status: 413,
        retryable: false,
      });
    }

    // ── Upscale small figures before OCR ────────────────────────────────────
    // Small text below ~14 px on the source image lands beneath Gemini's
    // vision-encoder patch size and gets silently rounded away. Doubling the
    // resolution before we send it gives the encoder more spatial capacity to
    // actually resolve those glyphs. Empirically: 2× on a 900×600 illustration
    // takes a scientific figure from "misses subscripts and gene names" to
    // "reads them cleanly", with no downside beyond a slightly larger payload.
    //
    // Skip when the longest side is already ≥ 1600 px — those figures don't
    // benefit and doubling would risk the 18 MB gate on very busy scenes.
    try {
      const upscaleStart = Date.now();
      const bin = Uint8Array.from(atob(imgBase64), (c) => c.charCodeAt(0));
      const img = await Image.decode(bin);
      const longestSide = Math.max(img.width, img.height);
      if (longestSide > 0 && longestSide < 1600) {
        const scale = 2;
        const newW = img.width * scale;
        const newH = img.height * scale;
        // Nearest neighbour preserves crisp glyph edges. Bilinear/bicubic
        // would soften the very edges the OCR is trying to read.
        img.resize(newW, newH, Image.RESIZE_NEAREST_NEIGHBOR);
        const encoded = await img.encode();
        // encode() returns PNG bytes even if the input was JPEG — safer for
        // downstream OCR (no re-compression of glyph edges).
        let bin2 = '';
        // Manual base64 in chunks to avoid the "Maximum call stack" bug on
        // very large String.fromCharCode.apply calls in V8.
        const CHUNK = 0x8000;
        for (let i = 0; i < encoded.length; i += CHUNK) {
          bin2 += String.fromCharCode.apply(null, Array.from(encoded.subarray(i, i + CHUNK)));
        }
        const newBase64 = btoa(bin2);
        // Guard against blowing past the Gemini payload cap post-upscale.
        if (newBase64.length <= 18 * 1024 * 1024) {
          imgBase64 = newBase64;
          imgMime = 'image/png';
          console.log(`[detect-text] upscaled ${img.width / scale}×${img.height / scale} → ${newW}×${newH} in ${Date.now() - upscaleStart}ms`);
        } else {
          console.warn('[detect-text] upscaled payload exceeds 18 MB — reverting to original.');
        }
      }
    } catch (upscaleErr) {
      // Non-fatal — if the upscale path fails for any reason, fall back to the
      // original image and let OCR proceed. Worst case: same behaviour as before.
      console.warn('[detect-text] upscale skipped:', upscaleErr);
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return respondError({
        code: 'MISCONFIGURED',
        message: 'Text detection is not configured on the server. Contact support.',
        status: 500,
        retryable: false,
      });
    }

    // Refined mode: charge 1 credit up front. Refunded via respondError below.
    // Skipped when bypassCredit is set (e.g. text-edit flow — see above).
    if (shouldCharge) {
      const { data: deductedId, error: deductError } = await supabase.rpc(
        'deduct_ai_generation',
        { p_user_id: user.id, p_feature: 'detect-text:refined' },
      );
      if (deductError) {
        if (deductError.message?.includes('INSUFFICIENT_CREDITS')) {
          return respondError({
            code: 'INSUFFICIENT_CREDITS',
            message: 'You are out of AI credits — purchase more or share projects to earn them.',
            status: 402,
            retryable: false,
          });
        }
        if (deductError.message?.includes('WAITING_PERIOD')) {
          return await waitingPeriodResponseForUser(supabase, user.id, corsHeaders);
        }
        throw deductError;
      }
      generationId = deductedId as string;
    }

    const detectPrompt = buildDetectPrompt(isRefined);
    // Composite flows (bypassCredit=true, currently just AI-Illustrator
    // text-edit) route through Flash even when refined output is requested:
    // Pro's latency was hitting the 45s timeout on complex figures, and the
    // downstream refine-image call fuzzes the exact font on redraw anyway,
    // so Flash's slightly-less-precise font attributes are more than enough
    // to constrain the redraw. Full Pro is still used for the PPT-export
    // path (bypassCredit=false, isRefined=true) where users are paying for
    // maximum-fidelity extraction.
    const useProModel = isRefined && bypassCredit !== true;
    const modelName = useProModel ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const timeoutMs = useProModel ? 45_000 : 25_000;

    // Retry policy: free (flash) path retries once on retryable failures with
    // a short backoff. Refined (pro) path does NOT retry — it's credit-metered
    // and one shot keeps the user's expectations aligned with what they paid for.
    const maxAttempts = isRefined ? 1 : 2;
    let lastError: DetectError | null = null;
    let parsed: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await callGeminiOnce({
        apiKey: GEMINI_API_KEY,
        modelName,
        detectPrompt,
        imgMime,
        imgBase64,
        isRefined,
        timeoutMs,
      });
      if (result.ok) {
        parsed = result.parsed;
        lastError = null;
        break;
      }
      lastError = result.error;
      if (!result.error.retryable || attempt === maxAttempts) break;
      console.log(`[detect-text] Retrying after ${result.error.code} (attempt ${attempt + 1}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, 750));
    }

    if (!parsed || lastError) {
      return respondError(lastError ?? {
        code: 'UNKNOWN_ERROR',
        message: 'Text detection failed. Please try again.',
        status: 500,
        retryable: true,
      });
    }

    const items = normalizeItems(parsed?.items, isRefined);
    console.log(`[detect-text] user=${user.id} refined=${isRefined} model=${modelName} detected=${items.length}`);

    if (isRefined) {
      try {
        const currentMonth = new Date().toISOString().substring(0, 7);
        await supabase.from('ai_generation_usage').insert({
          user_id: user.id,
          generated_at: new Date().toISOString(),
          month_year: currentMonth,
          prompt: `detected ${items.length} labels`,
          style: 'detect-text:refined',
          generation_type: 'ppt-export',
        });
      } catch (usageErr) {
        console.error('[detect-text] usage insert failed:', usageErr);
      }
    }

    generationId = null;

    return new Response(
      JSON.stringify({ success: true, items, refined: isRefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[detect-text] Unhandled error:', error);
    return respondError({
      code: 'UNKNOWN_ERROR',
      message: error?.message?.substring(0, 200) || 'Text detection failed. Please try again.',
      status: 500,
      retryable: true,
    });
  }
});
