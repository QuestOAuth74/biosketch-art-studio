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

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    console.log('✅ User authenticated:', user.id);

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Missing or empty prompt');
    }

    // Atomically reserve a generation credit before calling Gemini
    console.log('🔍 Reserving generation credit...');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: reserveData, error: reserveError } = await supabaseAdmin
      .rpc('reserve_generation', {
        _user_id: user.id,
        _prompt: prompt.trim(),
        _style: 'reference-image',
        _generation_type: 'reference-image',
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

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    supabaseForRefund = supabaseAdmin;
    try {
      const dr = await deductGeneration(supabaseAdmin, user.id, 'generate-reference-image');
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

    // Wrap prompt with scientific illustration context
    const fullPrompt = `Generate a clean, professional scientific illustration reference image of: ${prompt.trim()}.
Style: scientific figure suitable for academic publications, clear and well-labeled, white or light background, vector-like clean lines, accurate proportions.
This will be used as a visual reference guide for creating a scientific illustration.
After generating the image, provide 1-2 brief source references (textbook, journal, or authoritative resource) that someone could consult for accurate details about this subject. Format each source on its own line starting with "Source: ".`;

    console.log('🎨 Generating reference image with Gemini...');

    // Call Gemini API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('❌ Gemini API error:', geminiResponse.status, errorText);

      if (geminiResponse.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        throw new Error('INVALID_API_KEY');
      }

      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

    const data = await geminiResponse.json();

    // Extract image from response parts
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!parts || !Array.isArray(parts)) {
      console.error('❌ Unexpected response structure:', JSON.stringify(data));
      throw new Error('No content in Gemini response');
    }

    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart) {
      console.error('❌ No image part in response:', JSON.stringify(parts.map((p: any) => Object.keys(p))));
      throw new Error('No image generated by Gemini');
    }

    const { mimeType, data: base64Data } = imagePart.inlineData;
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    // Extract text parts for sources
    const textParts = parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('\n');

    // Parse source lines from the text
    const sources = textParts
      .split('\n')
      .filter((line: string) => line.trim().toLowerCase().startsWith('source:'))
      .map((line: string) => line.replace(/^source:\s*/i, '').trim())
      .filter((s: string) => s.length > 0)
      .slice(0, 2);

    // Credit was already reserved — compute remaining
    const remaining = isAdmin ? null : (reserveData.remaining ?? 0);

    console.log('✅ Reference image generated successfully, sources:', sources.length);
    generationSucceeded = true;

    return new Response(JSON.stringify({
      success: true,
      image: dataUrl,
      sources,
      remaining,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    } finally {
      // Release reservation if generation failed
      if (!generationSucceeded && reservationId) {
        console.log('🔄 Releasing reservation due to generation failure:', reservationId);
        await supabaseAdmin.rpc('release_generation_reservation', { _reservation_id: reservationId }).catch(() => {});
      }
    }

  } catch (error: any) {
    console.error('❌ Error in generate-reference-image:', error);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }

    let statusCode = 500;
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (error.name === 'AbortError') {
      statusCode = 504;
      errorMessage = 'Request timed out. The AI took too long to generate the image.';
    } else if (errorMessage === 'PREMIUM_REQUIRED') {
      statusCode = 403;
      errorMessage = 'Premium access required. Complete more projects to unlock AI generation.';
    } else if (errorMessage === 'RATE_LIMIT_EXCEEDED') {
      statusCode = 429;
      errorMessage = 'Monthly generation limit reached. Please try again next month.';
    } else if (errorMessage === 'RATE_LIMITED') {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (errorMessage === 'INVALID_API_KEY') {
      statusCode = 401;
      errorMessage = 'Invalid Gemini API key. Please check your configuration.';
    } else if (errorMessage.includes('Authentication failed') || errorMessage === 'No authorization header') {
      statusCode = 401;
      errorMessage = 'Authentication required. Please sign in again.';
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
