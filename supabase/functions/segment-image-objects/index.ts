import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import {
  deductGeneration,
  deductGenerationsBatch,
  refundGeneration,
  refundGenerations,
  insufficientCreditsResponse,
  waitingPeriodResponse,
} from "../_shared/aiCredits.ts";

// ── segment-image-objects ─────────────────────────────────────────────────────
// Per-object segmentation pipeline for raster images on the canvas.
// Uses Gemini's native segmentation capability (gemini-2.5-pro) to produce one
// mask per distinct visible object. The client crops the source PNG by each
// bbox, applies the mask as alpha, and drops the result as a named Fabric
// image layer — making every element independently selectable / draggable.
//
// Required env: GEMINI_API_KEY (already configured for ai-illustrator)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeminiSegment {
  box_2d?: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  mask?: string;     // base64 PNG of the mask, sized to the bbox
  label?: string;
}

interface SegmentRegion {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  mask: string; // raw base64 PNG (no data: prefix)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const userToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) throw new Error('Unauthorized');

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) throw new Error('imageDataUrl is required');

    // Legacy quota RPC kept for admin flag detection only. Authoritative gate
    // is `deduct_ai_generation` below (knows about grant + purchased credits).
    await supabase.rpc('can_user_generate', { _user_id: user.id });

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    supabaseForRefund = supabase;
    try {
      const dr = await deductGeneration(supabase, user.id, 'segment-image-objects');
      if (dr.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (dr.status === 'waiting') return waitingPeriodResponse(dr.unlockAt, corsHeaders);
      const gid = dr.id;
      creditIds = [gid];
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) throw new Error('imageDataUrl must be a base64 data URL');
    const inputMime = 'image/' + base64Match[1];
    const inputB64 = base64Match[2];

    const imageBytes = Uint8Array.from(atob(inputB64), (c) => c.charCodeAt(0));
    const dims = readImageDimensions(imageBytes, inputMime);
    if (!dims) throw new Error('Could not read image dimensions');
    const { width: W, height: H } = dims;
    console.log('[segment-image-objects] User:', user.id, 'Image:', W + 'x' + H);

    // Gemini 2.5 supports native segmentation: ask for box_2d + mask + label per
    // detected object. Mask is returned as a base64 PNG sized to the bounding
    // box. We deliberately ask for distinct, user-meaningful objects — not
    // every tiny detail — so the canvas doesn't get drowned in micro-layers.
    const segPrompt =
      'Identify every visually distinct, meaningful object or structure in this scientific illustration that a user would want to grab and move independently.\n\n' +
      'INCLUDE:\n' +
      '- Anatomical structures (organelles, cells, tissues, organs)\n' +
      '- Molecules, proteins, DNA / RNA strands\n' +
      '- Equipment, lab apparatus, instruments\n' +
      '- Each separate arrow, connector, and bracket\n' +
      '- Labels and text blocks (one segmentation per block)\n' +
      '- Individual icons or symbols\n\n' +
      'EXCLUDE:\n' +
      '- The plain background (white / light fill)\n' +
      '- Decorative gradients and tiny dots / specks\n' +
      '- Sub-parts of an object that are clearly one piece (e.g. do NOT segment each crista inside a mitochondrion — return the mitochondrion as one segment).\n\n' +
      'For each object, output STRICT JSON with this shape:\n' +
      '{\n' +
      '  "box_2d": [ymin, xmin, ymax, xmax],   // integers 0–1000, normalized\n' +
      '  "mask": "<base64 PNG, mask sized to the bounding box; non-zero pixels = object>",\n' +
      '  "label": "<short kebab-case noun, 1-3 words, e.g. mitochondrion, cell-membrane, arrow-1, label-glucose>"\n' +
      '}\n\n' +
      'Return ONLY a JSON array of these objects. Be exhaustive but precise — return at LEAST one segmentation if anything is visible.';

    const segResp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: segPrompt },
              { inlineData: { mimeType: inputMime, data: inputB64 } },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 32768,
            // gemini-2.5-pro requires thinking (rejects budget=0 with HTTP 400).
            // Leaving thinkingConfig unset = dynamic budget (-1), which is what
            // we want for segmentation accuracy.
          },
        }),
      }
    );

    if (!segResp.ok) {
      const t = await segResp.text();
      console.error('[segment-image-objects] Gemini error:', segResp.status, t);
      if (segResp.status === 429) throw new Error('RATE_LIMITED');
      throw new Error('Segmentation API error: ' + segResp.status + ' — ' + t.substring(0, 240));
    }

    const segData = await segResp.json();
    const segText = segData?.candidates?.[0]?.content?.parts
      ?.find((p: { text?: string }) => p.text)?.text ?? '';
    const finishReason = segData?.candidates?.[0]?.finishReason;
    console.log('[segment-image-objects] finishReason:', finishReason, 'text len:', segText.length);

    // The model wraps the array in a code fence sometimes; strip it. We don't
    // use responseSchema here because the mask field is large base64 and
    // structured-output mode adds substantial overhead.
    const cleaned = segText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let segmentations: GeminiSegment[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      segmentations = Array.isArray(parsed) ? parsed : (parsed?.segmentations || parsed?.objects || []);
    } catch (e) {
      console.error('[segment-image-objects] JSON parse failed. First 400:', cleaned.substring(0, 400));
      throw new Error('Failed to parse segmentation JSON');
    }
    console.log('[segment-image-objects] Parsed segments:', segmentations.length);

    const regions: SegmentRegion[] = segmentations
      .map((s, idx) => segmentToRegion(s, W, H, idx))
      .filter((r): r is SegmentRegion => !!r);

    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      await supabase.from('ai_generation_usage').insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: '[segment-image-objects]',
        style: 'segment-image-objects',
        generation_type: 'segment-image-objects',
      });
    } catch (usageErr) {
      console.error('[segment-image-objects] usage insert failed:', usageErr);
    }

    return jsonResponse({
      success: true,
      regions,
      sourceWidth: W,
      sourceHeight: H,
    });

    function jsonResponse(body: unknown, status = 200) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: unknown) {
    const msg = (error as { message?: string })?.message || 'Unknown error';
    console.error('[segment-image-objects] error:', msg);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }
    let statusCode = 500;
    if (msg === 'Unauthorized') statusCode = 401;
    if (msg === 'QUOTA_EXCEEDED') statusCode = 403;
    if (msg === 'RATE_LIMITED') statusCode = 429;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function segmentToRegion(s: GeminiSegment, W: number, H: number, idx: number): SegmentRegion | null {
  if (!Array.isArray(s.box_2d) || s.box_2d.length < 4 || !s.mask) return null;
  const [ymin, xmin, ymax, xmax] = s.box_2d;
  const x = Math.max(0, Math.round((xmin / 1000) * W));
  const y = Math.max(0, Math.round((ymin / 1000) * H));
  const x2 = Math.min(W, Math.round((xmax / 1000) * W));
  const y2 = Math.min(H, Math.round((ymax / 1000) * H));
  const w = x2 - x;
  const h = y2 - y;
  if (w <= 1 || h <= 1) return null;

  // Strip data: prefix if present — keep raw base64.
  const rawMask = s.mask.replace(/^data:image\/[^;]+;base64,/, '');
  const label = (typeof s.label === 'string' && s.label.trim()) || ('object-' + (idx + 1));

  return { label: label.toLowerCase().replace(/\s+/g, '-'), x, y, w, h, mask: rawMask };
}

function readImageDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  if (mime === 'image/png' && bytes.length >= 24) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width, height };
      }
      i += 2 + segLen;
    }
  }
  if (mime === 'image/webp' && bytes.length >= 30) {
    const tag = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (tag === 'VP8L') {
      const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
  }
  return null;
}
