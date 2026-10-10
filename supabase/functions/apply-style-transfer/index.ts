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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
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

    const { styleImage, contentImage } = await req.json();

    if (!styleImage || !contentImage) {
      throw new Error('Missing required fields: styleImage and contentImage');
    }

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    supabaseForRefund = supabaseAdmin;
    try {
      const dr = await deductGeneration(supabaseAdmin, user.id, 'apply-style-transfer');
      if (dr.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (dr.status === 'waiting') return waitingPeriodResponse(dr.unlockAt, corsHeaders);
      const gid = dr.id;
      creditIds = [gid];
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    console.log('🎨 Starting style transfer');

    // Validate image formats
    if (!styleImage.startsWith('data:image/') || !contentImage.startsWith('data:image/')) {
      throw new Error('Invalid image format. Must be data URLs.');
    }

    // Build style transfer prompt
    const styleTransferPrompt = `You are an expert at visual style transfer for scientific and medical icons.

TASK: Apply the exact visual style from the FIRST image (style reference) to the content of the SECOND image.

STYLE ELEMENTS TO TRANSFER:
- Color palette and color scheme
- Line weight and stroke thickness
- Shading technique (flat, gradient, textured)
- Level of detail (minimalist vs detailed)
- Artistic rendering style (geometric, organic, technical, illustrative)
- Background treatment (if any)
- Overall aesthetic (modern, classic, playful, professional)

CONTENT TO PRESERVE:
- The subject matter and recognizable features of the SECOND image
- The general composition and layout of the SECOND image
- The scientific/medical accuracy of the content

OUTPUT REQUIREMENTS:
- PNG format with transparent background
- Same subject as the second image, styled like the first image
- Maintain scientific accuracy while applying the visual style
- High quality, suitable for use as an icon

The result should look like "what if the content from image 2 was drawn/designed in the style of image 1?"`;

    // Call Lovable AI Gateway for style transfer
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('🤖 Calling Lovable AI (Gemini image model)...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: styleTransferPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: styleImage
                }
              },
              {
                type: 'image_url',
                image_url: {
                  url: contentImage
                }
              }
            ]
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      if (aiResponse.status === 402) {
        throw new Error('CREDITS_DEPLETED');
      }
      
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const resultImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!resultImageUrl) {
      console.error('❌ No image in AI response:', JSON.stringify(aiData));
      throw new Error('No image generated by AI');
    }

    console.log('✅ Style transfer complete');

    // Track usage so this generation counts toward the user's quota & admin analytics.
    try {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      const currentMonth = new Date().toISOString().substring(0, 7);
      await adminClient.from('ai_generation_usage').insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: 'style transfer',
        style: 'style-transfer',
        generation_type: 'icon-customize',
      });
    } catch (usageErr) {
      console.error('[apply-style-transfer] Usage insert failed:', usageErr);
    }

    return new Response(JSON.stringify({
      success: true,
      resultImage: resultImageUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in apply-style-transfer:', error);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }

    let statusCode = 500;
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'RATE_LIMITED') {
      statusCode = 429;
      errorMessage = 'Rate limits exceeded. Please try again later.';
    } else if (errorMessage === 'CREDITS_DEPLETED') {
      statusCode = 402;
      errorMessage = 'AI credits depleted. Please add credits in Settings → Workspace → Usage.';
    } else if (errorMessage.includes('Authentication failed') || errorMessage === 'No authorization header') {
      statusCode = 401;
      errorMessage = 'Authentication required. Please sign in again.';
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
