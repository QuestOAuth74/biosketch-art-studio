import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import {
  deductGeneration,
  deductGenerationsBatch,
  refundGeneration,
  refundGenerations,
  insufficientCreditsResponse,
  waitingPeriodResponse,
} from "../_shared/aiCredits.ts";

// ── extract-image-text ────────────────────────────────────────────────────────
// OCR + text-removal pipeline for AI-generated raster images on the canvas.
// Uses Gemini end-to-end (same API key the ai-illustrator function already uses):
//   1. gemini-2.5-flash → JSON: detected text strings + bounding boxes + colors
//   2. gemini-3-pro-image-preview → identical image with all text removed
//   3. Return cleaned image + regions to the client; the client drops Fabric
//      Textboxes at the matching positions.
//
// Required env vars: GEMINI_API_KEY (already set for ai-illustrator)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OCRRegion {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  color: string;       // text glyph color
  background: string;  // surrounding background color used to mask the original
  confidence: number;
}

interface GeminiDetection {
  text?: string;
  box_2d?: number[]; // [ymin, xmin, ymax, xmax] normalized 0–1000
  color_hex?: string;
  background_hex?: string;
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
      const dr = await deductGeneration(supabase, user.id, 'extract-image-text');
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

    // We need image dimensions to convert Gemini's normalized box_2d coords to
    // pixel coords. Decoding a PNG/JPEG header in Deno without a library is
    // ugly — read the first few bytes and pull width/height directly.
    const imageBytes = Uint8Array.from(atob(inputB64), (c) => c.charCodeAt(0));
    const dims = readImageDimensions(imageBytes, inputMime);
    if (!dims) throw new Error('Could not read image dimensions');
    const { width: W, height: H } = dims;
    console.log('[extract-image-text] User:', user.id, 'Image:', W + 'x' + H);

    // ── Steps 1 + 2 in parallel: OCR + Gemini inpaint ─────────────────────────
    // The inpaint doesn't need OCR results — Gemini can detect text itself —
    // so we fire both calls simultaneously and use whichever finishes. Total
    // wall-clock becomes max(OCR, inpaint) ≈ 15-25 s instead of the sum.
    // OCR is typically the faster call; inpaint we cap at 22 s so even if
    // Gemini hangs we stay under Supabase's free-tier wall-clock limit.

    const ocrPromise = (async (): Promise<OCRRegion[]> => {
      const ocrPrompt =
        'You are an OCR system. Look carefully at the image and locate EVERY piece of text — including:\n' +
        '- labels, captions, callouts, annotations\n' +
        '- numbers, axis values, time labels, percentages\n' +
        '- titles, subtitles, headers\n' +
        '- abbreviations and acronyms\n' +
        '- text inside shapes, bubbles, boxes, badges\n\n' +
        'For each piece of text, return:\n' +
        '- text: the exact transcribed string\n' +
        '- box_2d: a 2D bounding box that TIGHTLY encloses the glyphs\n' +
        '- color_hex: the dominant color of the text glyphs (NOT the background)\n' +
        '- background_hex: the dominant color of the area DIRECTLY BEHIND the text (the canvas/fill the text sits on, ignoring the glyphs themselves). If the text sits on a card/box, use that card color, not the page background.\n\n' +
        'Coordinate convention (CRITICAL): box_2d is [ymin, xmin, ymax, xmax] normalized to integers 0–1000, where 0 is top/left and 1000 is bottom/right.\n\n' +
        'Be exhaustive. If the image clearly contains text, you MUST return at least one detection — never return an empty list when text is visible.';

      const ocrSchema = {
        type: 'OBJECT',
        properties: {
          detections: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING' },
                box_2d: { type: 'ARRAY', items: { type: 'INTEGER' }, minItems: 4, maxItems: 4 },
                color_hex: { type: 'STRING' },
                background_hex: { type: 'STRING' },
              },
              required: ['text', 'box_2d'],
            },
          },
        },
        required: ['detections'],
      };

      const resp = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
        {
          method: 'POST',
          headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: ocrPrompt },
                { inlineData: { mimeType: inputMime, data: inputB64 } },
              ],
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: ocrSchema,
              temperature: 0,
              maxOutputTokens: 8192,
            },
          }),
        },
      );
      if (!resp.ok) {
        const t = await resp.text();
        console.error('[extract-image-text] OCR error:', resp.status, t);
        if (resp.status === 429) throw new Error('RATE_LIMITED');
        throw new Error('OCR API error: ' + resp.status);
      }
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? '';
      console.log('[extract-image-text] OCR finishReason:', data?.candidates?.[0]?.finishReason, 'len:', text.length);

      let detections: GeminiDetection[] = [];
      const cleanedJson = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      try {
        const parsed = JSON.parse(cleanedJson);
        detections = Array.isArray(parsed?.detections) ? parsed.detections : [];
      } catch {
        console.error('[extract-image-text] OCR JSON parse failed:', cleanedJson.substring(0, 300));
      }
      console.log('[extract-image-text] Detections parsed:', detections.length);

      return detections.map((d) => boxToRegion(d, W, H)).filter((r): r is OCRRegion => !!r);
    })();

    const inpaintPromise = (async (): Promise<string | null> => {
      const inpaintPrompt =
        'TASK: Erase ALL text from this image and seamlessly fill the gaps. The output must contain ZERO visible text — every letter, number, label, watermark, and written character must be gone.\n\n' +
        'FOR EACH ERASED REGION: replace the glyph pixels with whatever was BEHIND them — continue the surrounding shape, color, or gradient as if the text had never been drawn.\n\n' +
        'PRESERVE EXACTLY:\n' +
        '- Every non-text element (shapes, lines, colors, illustrations, outlines, proportions) — pixel-identical to the input.\n' +
        '- Composition, framing, and aspect ratio.\n' +
        '- Image dimensions (same width × height as input: ' + W + '×' + H + ').\n\n' +
        'DO NOT:\n' +
        '- Add any new text, labels, decorations, watermarks, or signatures.\n' +
        '- Recolor non-text pixels.\n' +
        '- Restylize or "improve" the image.\n' +
        '- Return the input unchanged. The text MUST be removed.\n\n' +
        'OUTPUT: a PNG identical to the input minus the text, as if the text were never there.';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 22000);

        const resp = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
          {
            method: 'POST',
            headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: inpaintPrompt },
                  { inlineData: { mimeType: inputMime, data: inputB64 } },
                ],
              }],
              generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (!resp.ok) {
          const t = await resp.text();
          console.warn('[extract-image-text] Inpaint HTTP', resp.status, t.substring(0, 200));
          return null;
        }
        const data = await resp.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        const ip = parts?.find((p: { inlineData?: { mimeType?: string } }) => p.inlineData?.mimeType?.startsWith('image/'));
        if (ip?.inlineData?.data) {
          console.log('[extract-image-text] Inpaint succeeded.');
          return 'data:' + ip.inlineData.mimeType + ';base64,' + ip.inlineData.data;
        }
        console.warn('[extract-image-text] Inpaint returned no image.');
        return null;
      } catch (err) {
        console.warn('[extract-image-text] Inpaint failed/timed out:', err);
        return null;
      }
    })();

    const [ocrSettled, inpaintSettled] = await Promise.allSettled([ocrPromise, inpaintPromise]);

    if (ocrSettled.status === 'rejected') {
      // OCR is the load-bearing call — if it failed we can't usefully proceed.
      throw ocrSettled.reason;
    }
    const regions: OCRRegion[] = ocrSettled.value;
    const inpaintedDataUrl: string | null =
      inpaintSettled.status === 'fulfilled' ? inpaintSettled.value : null;
    const cleanedDataUrl = inpaintedDataUrl ?? imageDataUrl;
    const inpainted = !!inpaintedDataUrl;

    if (regions.length === 0) {
      return jsonResponse({ success: true, cleanedImageDataUrl: imageDataUrl, cleaned: false, regions: [] });
    }

    // ── Step 3: Pixel-sampled background colors ──────────────────────────────
    // Sampled from the ORIGINAL image so we always have a per-region color the
    // client can use to fill any residue the Gemini inpaint missed.
    try {
      const decoded = await Image.decode(imageBytes);
      for (const r of regions) {
        const sampled = sampleRingMedian(decoded, r.x, r.y, r.w, r.h);
        if (sampled) r.background = sampled;
      }
    } catch (sampleErr) {
      console.warn('[extract-image-text] background sampling failed:', sampleErr);
    }

    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      await supabase.from('ai_generation_usage').insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: '[extract-image-text]',
        style: 'extract-image-text',
        generation_type: 'extract-image-text',
      });
    } catch (usageErr) {
      console.error('[extract-image-text] usage insert failed:', usageErr);
    }

    return jsonResponse({
      success: true,
      cleanedImageDataUrl: cleanedDataUrl,
      cleaned: inpainted,
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
    console.error('[extract-image-text] error:', msg);
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

function boxToRegion(d: GeminiDetection, W: number, H: number): OCRRegion | null {
  if (!d?.text || !Array.isArray(d.box_2d) || d.box_2d.length < 4) return null;
  const [ymin, xmin, ymax, xmax] = d.box_2d;
  const x = Math.max(0, Math.round((xmin / 1000) * W));
  const y = Math.max(0, Math.round((ymin / 1000) * H));
  const x2 = Math.min(W, Math.round((xmax / 1000) * W));
  const y2 = Math.min(H, Math.round((ymax / 1000) * H));
  const w = x2 - x;
  const h = y2 - y;
  if (w <= 1 || h <= 1) return null;
  const color = isHex(d.color_hex) ? (d.color_hex as string) : '#000000';
  const background = isHex(d.background_hex) ? (d.background_hex as string) : '#ffffff';
  return {
    text: d.text,
    x,
    y,
    w,
    h,
    fontSize: Math.max(8, Math.round(h * 0.7)),
    color,
    background,
    confidence: 1,
  };
}

function isHex(s: unknown): boolean {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

// Sample pixels in a thin ring just outside the detection box (top edge, bottom
// edge, left side, right side), pick the per-channel median across all samples.
// The median is robust to a few stray text pixels that bleed past the OCR box.
function sampleRingMedian(image: Image, x: number, y: number, w: number, h: number): string | null {
  const W = image.width;
  const H = image.height;
  // Sample 1 row above the box, 1 row below, 1 col left, 1 col right, with a
  // 10-pixel offset to clear glyph anti-aliasing halos.
  const offset = 10;
  const yTop = Math.max(1, y - offset);
  const yBot = Math.min(H, y + h + offset);
  const xLeft = Math.max(1, x - offset);
  const xRight = Math.min(W, x + w + offset);

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];

  const sample = (px: number, py: number) => {
    if (px < 1 || py < 1 || px > W || py > H) return;
    const rgba = image.getPixelAt(px, py);
    rs.push((rgba >>> 24) & 0xff);
    gs.push((rgba >>> 16) & 0xff);
    bs.push((rgba >>> 8) & 0xff);
  };

  // Top + bottom edges
  const stepX = Math.max(1, Math.floor(w / 8));
  for (let px = xLeft; px <= xRight; px += stepX) {
    sample(px, yTop);
    sample(px, yBot);
  }
  // Left + right sides
  const stepY = Math.max(1, Math.floor(h / 4));
  for (let py = yTop; py <= yBot; py += stepY) {
    sample(xLeft, py);
    sample(xRight, py);
  }

  if (rs.length === 0) return null;
  const med = (arr: number[]) => {
    arr.sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)];
  };
  const r = med(rs), g = med(gs), b = med(bs);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Read PNG/JPEG dimensions from header bytes — avoids pulling in an image lib.
function readImageDimensions(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  if (mime === 'image/png' && bytes.length >= 24) {
    // PNG: width = bytes 16..20 (big-endian uint32), height = 20..24
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    // JPEG: scan markers for SOFn (0xFFC0..0xFFCF except 0xFFC4/0xFFC8/0xFFCC).
    let i = 2; // skip SOI 0xFFD8
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
    // VP8L: width/height in bits 1..28 of bytes 21..24
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
