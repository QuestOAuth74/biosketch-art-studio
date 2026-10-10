import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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

const stylePrompts: Record<string, string> = {
  pencil: `Hand-drawn pencil sketch style scientific illustration.
Fine pencil line work with varying pressure, subtle cross-hatching for shading.
Sketch-like imperfect lines, grayscale tones, textbook illustration feel.
NO text, labels, or annotations.`,

  biomedical: `Clean flat vector style scientific illustration.
Smooth vector shapes, soft pastel color palette, subtle gradients for depth.
Consistent line weights, minimal design, professional scientific accuracy.
NO text, labels, or annotations.`,

  oil: `Oil painting style artistic scientific illustration.
Rich textured brush strokes, deep saturated colors, dramatic lighting.
Blended edges, canvas-like texture, Renaissance medical illustration influence.
NO text, labels, or annotations.`,
};

function buildPrompt(userPrompt: string, style: string): string {
  const styleDirective = stylePrompts[style] || stylePrompts.biomedical;

  return `Modify this scientific icon based on the following instruction: ${userPrompt}

${styleDirective}

CRITICAL RULES:
- Keep it as a clean, standalone icon suitable for scientific diagrams
- The background MUST be pure solid white (#FFFFFF). No patterns, no gradients, no checkerboard, no gray
- Do NOT add any shadows, borders, glow, or backdrop
- Do NOT include any text, labels, annotations, letters, numbers, or words
- Maintain clean edges and good contrast at small sizes
- Preserve the general shape/silhouette unless the user asks to change it`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) throw new Error('Authentication failed');

    console.log('✅ User authenticated:', user.id);

    const { image, prompt, style = 'biomedical' } = await req.json();

    // Atomically reserve a generation credit
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
        _generation_type: 'customize-icon',
      });

    if (reserveError) throw new Error('Failed to check generation permissions');

    if (!reserveData.reserved) {
      const errorType = reserveData.error;
      if (errorType === 'PREMIUM_REQUIRED') throw new Error('PREMIUM_REQUIRED');
      if (errorType === 'RATE_LIMIT_EXCEEDED') throw new Error('RATE_LIMIT_EXCEEDED');
      throw new Error('Generation not allowed');
    }

    const reservationId: string = reserveData.reservationId;

    if (!image || !prompt) {
      throw new Error('Missing required fields: image and prompt');
    }

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    supabaseForRefund = supabaseAdminClient;
    try {
      const dr = await deductGeneration(supabaseAdminClient, user.id, 'customize-icon');
      if (dr.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (dr.status === 'waiting') return waitingPeriodResponse(dr.unlockAt, corsHeaders);
      const gid = dr.id;
      creditIds = [gid];
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    // From here on, if anything fails we must release the reservation
    let generationSucceeded = false;
    try {

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Extract base64 data from data URL
    const base64Match = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image format. Must be a base64 data URL.');
    }
    const mimeType = `image/${base64Match[1]}`;
    const base64Data = base64Match[2];

    const enhancedPrompt = buildPrompt(prompt, style);
    console.log('🎨 Customizing icon for user:', user.id);
    console.log('📝 Prompt:', prompt);
    console.log('🎭 Style:', style);

    // Call Gemini API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: enhancedPrompt },
              { inlineData: { mimeType, data: base64Data } }
            ]
          }],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('❌ Gemini API error:', geminiResponse.status, errorText);

      if (geminiResponse.status === 429) throw new Error('RATE_LIMITED');
      if (geminiResponse.status === 401 || geminiResponse.status === 403) throw new Error('INVALID_API_KEY');
      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

    const data = await geminiResponse.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!parts || !Array.isArray(parts)) {
      throw new Error('No content in Gemini response');
    }

    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart) {
      throw new Error('No image generated by Gemini');
    }

    const resultMime = imagePart.inlineData.mimeType;
    const resultBase64 = imagePart.inlineData.data;
    const resultDataUrl = `data:${resultMime};base64,${resultBase64}`;

    console.log('✅ Icon customized successfully');

    // Credit was already reserved
    console.log('✅ Usage tracked via reservation');
    generationSucceeded = true;

    return new Response(JSON.stringify({
      success: true,
      image: resultDataUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    } finally {
      if (!generationSucceeded && reservationId) {
        console.log('🔄 Releasing reservation due to generation failure:', reservationId);
        await supabaseAdminClient.rpc('release_generation_reservation', { _reservation_id: reservationId }).catch(() => {});
      }
    }

  } catch (error: any) {
    console.error('❌ Error in customize-icon:', error);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }

    let statusCode = 500;
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let errorContext = '';

    if (error.name === 'AbortError') {
      statusCode = 504;
      errorMessage = 'Request timed out. Please try again.';
    } else if (errorMessage === 'PREMIUM_REQUIRED') {
      statusCode = 403;
      errorMessage = 'Premium access required';
      errorContext = 'AI icon customization requires 3+ approved public projects.';
    } else if (errorMessage === 'RATE_LIMIT_EXCEEDED') {
      statusCode = 429;
      errorMessage = 'Monthly generation limit reached';
      errorContext = 'You have used your 3 free AI generations for this month.';
    } else if (errorMessage === 'RATE_LIMITED') {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please wait and try again.';
    } else if (errorMessage === 'INVALID_API_KEY') {
      statusCode = 401;
      errorMessage = 'Invalid API key configuration.';
    } else if (errorMessage.includes('Authentication failed') || errorMessage === 'No authorization header') {
      statusCode = 401;
      errorMessage = 'Authentication required. Please sign in again.';
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      context: errorContext,
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
