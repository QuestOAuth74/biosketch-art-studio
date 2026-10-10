import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

// ── verify-image-clean ────────────────────────────────────────────────────────
// Verification agent for the "Make Text Editable" wand. After the client has
// done its first erasure pass, it sends the processed image back here and we
// re-OCR (with Gemini 2.5 Flash for speed) to find any text that survived.
// The client uses the returned bboxes to do another erasure round, and may
// call this function 1-2 more times until the image is verified clean.
//
// This is intentionally a small, fast call — no inpainting, no schema overhead.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeminiDetection {
  box_2d?: number[]; // [ymin, xmin, ymax, xmax] normalized 0–1000
  text?: string;
}

interface ResidualRegion {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
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
    const userToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) throw new Error('Unauthorized');

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) throw new Error('imageDataUrl is required');

    const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) throw new Error('imageDataUrl must be a base64 data URL');
    const inputMime = 'image/' + base64Match[1];
    const inputB64 = base64Match[2];

    const imageBytes = Uint8Array.from(atob(inputB64), (c) => c.charCodeAt(0));
    const dims = readImageDimensions(imageBytes, inputMime);
    if (!dims) throw new Error('Could not read image dimensions');
    const { width: W, height: H } = dims;

    const verifyPrompt =
      'You are a verification agent. Look very carefully at this image and find any visible text — letters, numbers, words, labels, captions, watermarks, signatures, or any written characters at all.\n\n' +
      'This image was supposed to have ALL text erased. Your job is to catch any text that survived erasure, including:\n' +
      '- Small or faint text\n' +
      '- Text inside shapes or on colored backgrounds\n' +
      '- Partial glyphs or text fragments (anything recognizable as part of a letter/number)\n' +
      '- Text along edges or in corners\n\n' +
      'For each piece of remaining text, return:\n' +
      '- text: the exact transcribed string (or "?" if illegible)\n' +
      '- box_2d: [ymin, xmin, ymax, xmax] normalized integers 0–1000, where 0 is top/left and 1000 is bottom/right\n\n' +
      'If there is NO visible text in the image, return an empty array. Do not invent text that is not there.';

    const verifySchema = {
      type: 'OBJECT',
      properties: {
        detections: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              text: { type: 'STRING' },
              box_2d: { type: 'ARRAY', items: { type: 'INTEGER' }, minItems: 4, maxItems: 4 },
            },
            required: ['text', 'box_2d'],
          },
        },
      },
      required: ['detections'],
    };

    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: verifyPrompt },
              { inlineData: { mimeType: inputMime, data: inputB64 } },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: verifySchema,
            temperature: 0,
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    if (!resp.ok) {
      const t = await resp.text();
      console.error('[verify-image-clean] Gemini error', resp.status, t.substring(0, 200));
      if (resp.status === 429) throw new Error('RATE_LIMITED');
      throw new Error('Verify API error: ' + resp.status);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let detections: GeminiDetection[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      detections = Array.isArray(parsed?.detections) ? parsed.detections : [];
    } catch {
      console.error('[verify-image-clean] JSON parse failed:', cleaned.substring(0, 200));
    }

    const residuals: ResidualRegion[] = detections
      .map((d) => detectionToRegion(d, W, H))
      .filter((r): r is ResidualRegion => !!r);

    console.log('[verify-image-clean] User:', user.id, 'Image:', W + 'x' + H, 'residuals:', residuals.length);

    return new Response(
      JSON.stringify({
        success: true,
        residuals,
        sourceWidth: W,
        sourceHeight: H,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    const msg = (error as { message?: string })?.message || 'Unknown error';
    console.error('[verify-image-clean] error:', msg);
    let statusCode = 500;
    if (msg === 'Unauthorized') statusCode = 401;
    if (msg === 'RATE_LIMITED') statusCode = 429;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function detectionToRegion(d: GeminiDetection, W: number, H: number): ResidualRegion | null {
  if (!Array.isArray(d.box_2d) || d.box_2d.length < 4) return null;
  const [ymin, xmin, ymax, xmax] = d.box_2d;
  const x = Math.max(0, Math.round((xmin / 1000) * W));
  const y = Math.max(0, Math.round((ymin / 1000) * H));
  const x2 = Math.min(W, Math.round((xmax / 1000) * W));
  const y2 = Math.min(H, Math.round((ymax / 1000) * H));
  const w = x2 - x;
  const h = y2 - y;
  if (w <= 1 || h <= 1) return null;
  return { text: d.text || '?', x, y, w, h };
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
  return null;
}
