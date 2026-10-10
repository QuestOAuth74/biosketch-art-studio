import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callGeminiForIconJson, renderIconSvg, validateIconSpec } from "./iconSvgRenderer.ts";
import {
  deductGeneration,
  deductGenerationsBatch,
  refundGeneration,
  refundGenerations,
  insufficientCreditsResponse,
  waitingPeriodResponse,
} from "../_shared/aiCredits.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stylePrompts = {
  pencil: `Hand-drawn pencil sketch style scientific illustration.
Create with:
- Fine pencil line work with varying pressure
- Subtle cross-hatching for shading and depth
- Sketch-like imperfect lines that feel organic
- Grayscale tones with occasional soft highlights
- Scientific accuracy with artistic hand-drawn quality
- Clean white or transparent background
- Textbook illustration feel like vintage anatomy drawings
- NO text labels, annotations, or written content of any kind`,

  biomedical: `Clean FLAT 2D vector style scientific illustration.
Create with:
- Each shape filled with ONE solid color — NO gradients, NO shading transitions, NO highlights, NO shadows, NO 3D effects
- Smooth, clean vector shapes with crisp edges
- Soft pastel color palette (muted pinks, blues, greens, purples)
- Consistent thin outlines in a slightly darker shade of the fill color
- Minimal design focusing on essential shapes
- Professional scientific accuracy
- Modern, approachable scientific illustration style
- Transparent or clean white background
- ABSOLUTELY NO gradients of any kind — every fill is one flat solid color
- NO texture, NO noise, NO grain, NO brush strokes
- NO text labels, annotations, or written content of any kind`,
};

const creativityPrompts = {
  faithful: `IMPORTANT: Recreate this image with high fidelity. 
Maintain exact proportions, colors, structural details, and overall composition. 
Make only minimal adjustments for clarity. Stay very close to the original.`,
  
  balanced: `Transform this image while maintaining scientific accuracy. 
Keep key visual elements and proportions but allow stylistic improvements. 
Balance originality with recognizability.`,
  
  creative: `Use this image as creative inspiration. 
Feel free to reimagine the design artistically while preserving the core scientific concept. 
Explore creative interpretations with varied colors, styles, and artistic elements.`
};

const noTextDirective = `CRITICAL: Do NOT include any text, labels, annotations, captions, titles, letters, numbers, words, arrows with text, line labels, measurement indicators, or any written content in the image. The illustration must be purely visual with NO text of any kind.`;

function buildEnhancedPrompt(
  userPrompt: string,
  style: string,
  backgroundType: 'transparent' | 'white' = 'transparent',
  creativityLevel: 'faithful' | 'balanced' | 'creative' = 'balanced',
  textOnly: boolean = false,
  palette: string[] = [],
  aspect: 'square' | 'portrait' | 'landscape' = 'square',
  isSketch: boolean = false,
): string {
  // Default to biomedical (flat 2D vector) for any unknown / removed style values.
  const styleKey: keyof typeof stylePrompts = (style in stylePrompts ? style : 'biomedical') as keyof typeof stylePrompts;
  const basePrompt = stylePrompts[styleKey];
  const creativityInstruction = textOnly
    ? `Generate a scientific icon from scratch based on the description. Use accurate proportions and standard scientific conventions for the subject.`
    : creativityPrompts[creativityLevel];

  const backgroundInstruction = backgroundType === 'transparent'
    ? `Output MUST be a PNG with a fully transparent background (RGBA, alpha channel).
Do not include any white or colored background, shadows, borders, glow, or backdrop layers of any kind.`
    : `Output MUST be a PNG with a clean, solid white background (#FFFFFF).
Ensure the subject has clear edges against the white background.`;

  const sketchRules = isSketch
    ? `\n\nSKETCH MODE — the reference is a HAND-DRAWN SKETCH. Apply these rules strictly:\n` +
      `- Treat the sketch as a layout guide, not a finished drawing.\n` +
      `- Reproduce the EXACT same elements that appear in the sketch — same count, same arrangement, same connections. Do NOT invent extra structures.\n` +
      `- Straighten wobbly lines and smooth rough curves into clean shapes.\n` +
      `- If a sketched shape is ambiguous, render it as the simplest interpretation — do NOT embellish.\n` +
      `- Preserve arrow directions and connection points exactly as drawn.\n` +
      `- Ignore stray pencil marks, smudges, eraser shadows, and notebook lines.\n` +
      `- Accuracy to the sketch is MORE IMPORTANT than visual richness.\n`
    : '';

  const action = textOnly
    ? `${basePrompt}. Create a scientific icon depicting: ${userPrompt}.`
    : `${basePrompt}. Transform this reference image to create: ${userPrompt}.${sketchRules}`;

  const aspectInstruction = aspect === 'portrait'
    ? 'Output as a PORTRAIT-oriented composition (taller than wide, ~3:4).'
    : aspect === 'landscape'
    ? 'Output as a LANDSCAPE-oriented composition (wider than tall, ~4:3).'
    : 'Output as a SQUARE-oriented composition (1:1).';

  const paletteInstruction = palette.length
    ? `Restrict the color palette to ONLY these hex colors: ${palette.join(', ')}. Use them as the primary fills (variations of these are acceptable for outlines and shading).`
    : '';

  return `${creativityInstruction}

${noTextDirective}

${action}
Ensure scientific accuracy, clean edges, and high contrast at small sizes.
${aspectInstruction}
${paletteInstruction}
${backgroundInstruction}
Optimize for use as a small scientific icon.
Remember: NO TEXT, NO LABELS, NO ANNOTATIONS - pure visual illustration only.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    
    // Detailed logging
    console.log('🔐 Request received');
    console.log('🔐 Auth header present:', !!authHeader);
    console.log('🔐 Auth header format:', authHeader ? authHeader.substring(0, 20) + '...' : 'none');
    
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      throw new Error('No authorization header');
    }

    // Extract JWT token from header
    const jwt = authHeader.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    console.log('🔑 Attempting to validate user with JWT...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    
    if (userError) {
      console.error('❌ Auth validation failed:', userError.message);
      throw new Error(`Authentication failed: ${userError.message}`);
    }
    
    if (!user) {
      console.error('❌ No user found in valid token');
      throw new Error('User not found');
    }

    console.log('✅ User authenticated successfully:', user.id);

    const {
      image,
      prompt,
      style = 'simple',
      size = '512x512',
      backgroundType = 'transparent',
      creativityLevel = 'balanced',
      variants: rawVariantCount = 1,
      palette,
      aspectRatio = 'square',
      outputFormat = 'raster',
      referenceType = 'photo',
    } = await req.json();
    const isSketch = referenceType === 'sketch';
    const variantCount = Math.max(1, Math.min(3, Number(rawVariantCount) || 1));
    const allowedAspects = ['square', 'portrait', 'landscape'];
    const aspect = allowedAspects.includes(aspectRatio) ? aspectRatio : 'square';
    const cleanPalette: string[] = Array.isArray(palette)
      ? palette.filter((c: unknown) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c))
      : [];

    // Atomically reserve a generation credit before calling Gemini
    console.log('🔍 Reserving generation credit...');
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: reserveData, error: reserveError } = await supabaseAdminClient
      .rpc('reserve_generation', {
        _user_id: user.id,
        _prompt: prompt || '',
        _style: style,
        _generation_type: 'icon',
      });

    if (reserveError) {
      console.error('❌ Error reserving generation:', reserveError);
      throw new Error('Failed to check generation permissions');
    }

    console.log('📊 Reservation result:', reserveData);

    if (!reserveData.reserved) {
      const errorType = reserveData.error;
      if (errorType === 'PREMIUM_REQUIRED') throw new Error('PREMIUM_REQUIRED');
      if (errorType === 'RATE_LIMIT_EXCEEDED') throw new Error('RATE_LIMIT_EXCEEDED');
      throw new Error('Generation not allowed');
    }

    const reservationId: string = reserveData.reservationId;
    const isAdmin: boolean = reserveData.isAdmin;

    // Reference image is now OPTIONAL — text-only generation is supported.
    if (!prompt) {
      throw new Error('Missing required field: prompt');
    }

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    // Variants: bill one generation per variant per product policy.
    supabaseForRefund = supabaseAdminClient;
    try {
      const batch = await deductGenerationsBatch(
        supabaseAdminClient,
        user.id,
        'generate-icon-from-reference',
        variantCount,
      );
      if (batch.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (batch.status === 'waiting') return waitingPeriodResponse(batch.unlockAt, corsHeaders);
      creditIds = batch.ids;
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    // From here on, if anything fails we must release the reservation
    let generationSucceeded = false;
    try {

    // Log request details
    console.log('📊 Request details:');
    console.log('  - Image size:', image ? Math.round(image.length / 1024) + ' KB' : '(none, text-only)');
    console.log('  - Prompt length:', prompt.length, 'chars');
    console.log('  - Style:', style);
    console.log('  - Aspect:', aspect);
    console.log('  - Output:', outputFormat);
    console.log('  - Palette:', cleanPalette.length ? cleanPalette.join(', ') : '(none)');
    console.log('  - Target size:', size);
    console.log('  - Variant count:', variantCount);

    console.log('🎨 Starting icon generation for user:', user.id);
    console.log('📝 Prompt:', prompt);
    console.log('🎭 Style:', style);
    console.log('🖼️ Background type:', backgroundType);
    console.log('🎨 Creativity level:', creativityLevel);

    // ── Vector-mode short-circuit ──
    // Text-LLM emits a JSON spec of SVG primitives → deterministic SVG render.
    // Output is genuinely editable on canvas (semantic <g> per element).
    if (outputFormat === 'vector') {
      console.log('🧬 Vector-mode pipeline');
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
      try {
        const spec = await callGeminiForIconJson({
          apiKey: GEMINI_API_KEY,
          prompt,
          style,
          palette: cleanPalette.length ? cleanPalette : undefined,
          aspect,
        });
        validateIconSpec(spec);
        const svg = renderIconSvg(spec, { aspect });
        console.log('✅ Vector icon ready, ' + svg.length + ' chars, ' + spec.elements.length + ' elements');
        generationSucceeded = true;
        return new Response(JSON.stringify({
          success: true,
          svg,
          json: spec,
          outputFormat: 'vector',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: any) {
        console.error('❌ Vector-mode failed:', e?.message || e);
        // Surface the error to the client (don't silently fall back to raster —
        // user explicitly asked for editable vector output).
        if (creditIds.length > 0) {
          await refundGenerations(supabaseAdminClient, creditIds);
        }
        return new Response(JSON.stringify({
          success: false,
          error: 'Vector generation failed',
          context: e?.message || String(e),
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Validate optional reference image
    let imageInlineData: { mimeType: string; data: string } | null = null;
    if (image) {
      if (!image.startsWith('data:image/')) {
        throw new Error('Invalid image format. Must be a data URL.');
      }
      const base64Match = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid image format. Must be a base64 data URL.');
      }
      imageInlineData = { mimeType: `image/${base64Match[1]}`, data: base64Match[2] };
    }

    // Build enhanced prompt
    const enhancedPrompt = buildEnhancedPrompt(
      prompt,
      style,
      backgroundType as 'transparent' | 'white',
      creativityLevel as 'faithful' | 'balanced' | 'creative',
      !imageInlineData,
      cleanPalette,
      aspect,
      isSketch && !!imageInlineData,
    );
    console.log('✨ Enhanced prompt:', enhancedPrompt);

    // Call Gemini API for image generation
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log(`🤖 Calling Gemini (gemini-3-pro-image-preview) — ${variantCount} variant(s) in parallel...`);

    // Diversity comes from per-variant prompt nudges (the image-preview model
    // doesn't reliably honor a temperature parameter). The first variant uses
    // the base prompt; later variants get a small composition/color hint.
    const diversityNudges = [
      '',
      '\n\nVariation: explore an alternative composition or angle while keeping the subject identical.',
      '\n\nVariation: use slightly different but still scientifically appropriate colors and a simpler arrangement.',
    ];

    type VariantResult =
      | { ok: true; url: string }
      | { ok: false; reason: string; status?: number };

    const callGemini = async (variantPromptSuffix: string, idx: number): Promise<VariantResult> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        const parts: any[] = [{ text: enhancedPrompt + variantPromptSuffix }];
        if (imageInlineData) parts.push({ inlineData: imageInlineData });

        const resp = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': GEMINI_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                responseModalities: ["IMAGE"],
              },
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text();
          console.error(`❌ Variant #${idx + 1} Gemini ${resp.status}:`, errorText.slice(0, 500));
          return { ok: false, reason: errorText.slice(0, 500) || `HTTP ${resp.status}`, status: resp.status };
        }
        const data = await resp.json();
        const respParts = data?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(respParts)) {
          const dump = JSON.stringify(data).slice(0, 500);
          console.error(`❌ Variant #${idx + 1} unexpected response:`, dump);
          return { ok: false, reason: `unexpected response shape: ${dump}` };
        }
        const imagePart = respParts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
        if (!imagePart) {
          const finishReason = data?.candidates?.[0]?.finishReason;
          console.error(`❌ Variant #${idx + 1} no image part, finishReason=${finishReason}`);
          return { ok: false, reason: `no image returned (finishReason=${finishReason || 'unknown'})` };
        }
        return { ok: true, url: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` };
      } catch (e: any) {
        clearTimeout(timeoutId);
        const msg = e?.message || String(e);
        console.error(`❌ Variant #${idx + 1} threw:`, msg);
        return { ok: false, reason: msg };
      }
    };

    const nudges = diversityNudges.slice(0, variantCount);
    // Use plain Promise.all on a function that ALWAYS resolves — no need for allSettled.
    const settled = await Promise.all(nudges.map((suffix, i) => callGemini(suffix, i)));
    const generatedImages = settled.filter((r): r is { ok: true; url: string } => r.ok).map((r) => r.url);
    const failures = settled.filter((r): r is { ok: false; reason: string; status?: number } => !r.ok);

    if (generatedImages.length === 0) {
      const firstStatus = failures.find((f) => f.status)?.status;
      const reasons = failures.map((f) => f.reason).join(' | ');
      console.error('❌ All variants failed:', reasons);
      if (firstStatus === 429) throw new Error('RATE_LIMITED');
      if (firstStatus === 401 || firstStatus === 403) throw new Error('INVALID_API_KEY');
      // Surface the actual Gemini error to the user instead of a generic "Generation failed".
      throw new Error(`Gemini failed: ${reasons.slice(0, 400)}`);
    }

    console.log(`✅ Generated ${generatedImages.length}/${variantCount} variant(s) successfully`);
    if (failures.length) console.warn(`⚠️  ${failures.length} variant(s) failed but ${generatedImages.length} succeeded`);
    generationSucceeded = true;

    return new Response(JSON.stringify({
      success: true,
      generatedImage: generatedImages[0],     // backwards-compat: first variant
      generatedImages,                         // full list for new clients
      variantCount: generatedImages.length,
      prompt: enhancedPrompt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    } finally {
      // Release reservation if generation failed
      if (!generationSucceeded && reservationId) {
        console.log('🔄 Releasing reservation due to generation failure:', reservationId);
        await supabaseAdminClient.rpc('release_generation_reservation', { _reservation_id: reservationId }).catch(() => {});
      }
    }

  } catch (error: any) {
    console.error('❌ Error in generate-icon-from-reference:', error);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }

    let statusCode = 500;
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let errorContext = '';
    
    if (error.name === 'AbortError') {
      statusCode = 504;
      errorMessage = 'Request timed out. The AI took too long to generate the image.';
    } else if (errorMessage === 'RATE_LIMITED') {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (errorMessage === 'INVALID_API_KEY') {
      statusCode = 401;
      errorMessage = 'Invalid Gemini API key. Please check your configuration.';
    } else if (errorMessage === 'PREMIUM_REQUIRED') {
      statusCode = 403;
      errorMessage = 'Premium access required';
      errorContext = 'AI icon generation requires 3+ approved public projects. Share your projects to the community to unlock this feature.';
    } else if (errorMessage === 'RATE_LIMIT_EXCEEDED') {
      statusCode = 429;
      errorMessage = 'Monthly generation limit reached';
      errorContext = 'You have used your 3 free AI icon generations for this month. Limit resets on the 1st of next month.';
    } else if (errorMessage === 'Unauthorized' || errorMessage === 'No authorization header') {
      statusCode = 401;
      errorMessage = 'Authentication required';
      errorContext = 'Please sign in again. Your session may have expired.';
    } else if (errorMessage.includes('Authentication failed')) {
      statusCode = 401;
      errorContext = 'Token validation failed. Please refresh the page and try again.';
    } else if (errorMessage === 'User not found') {
      statusCode = 401;
      errorContext = 'User session invalid. Please sign in again.';
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      context: errorContext,
      timestamp: new Date().toISOString()
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
