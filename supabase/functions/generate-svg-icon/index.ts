import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import {
  deductGeneration,
  deductGenerationsBatch,
  refundGeneration,
  refundGenerations,
  insufficientCreditsResponse,
  waitingPeriodResponse,
} from '../_shared/aiCredits.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateSVGRequest {
  prompt: string;
  style: string;
  scientificCategory?: string;
}

// Enhanced scientific style presets with detailed prompts and color palettes
const scientificStylePresets: Record<string, { prompt: string; colors: string[] }> = {
  'cell-organelle': {
    prompt: 'Detailed cellular organelle with membrane structures and subcellular compartments. Show internal complexity with clear boundaries.',
    colors: ['#4A90D9', '#7CB342', '#FF7043', '#9575CD']
  },
  'cell-membrane': {
    prompt: 'Phospholipid bilayer style with lipid rafts and membrane proteins. Show double layer structure with embedded proteins.',
    colors: ['#FFB74D', '#64B5F6', '#81C784']
  },
  'dna-helix': {
    prompt: 'Double helix structure with nucleotide base pairs and backbone phosphates. Show the twisted ladder structure clearly.',
    colors: ['#E57373', '#64B5F6', '#FFD54F', '#81C784']
  },
  'protein-structure': {
    prompt: 'Protein folding with alpha helices and beta sheets showing tertiary structure. Include ribbon diagram style elements.',
    colors: ['#7986CB', '#4FC3F7', '#AED581', '#FFB74D']
  },
  'molecular-structure': {
    prompt: 'Chemical bonds and molecular geometry with Lewis structures. Show atoms as circles connected by bond lines.',
    colors: ['#424242', '#EF5350', '#42A5F5', '#66BB6A']
  },
  'organ-system': {
    prompt: 'Anatomically accurate organ structure with tissue layers. Show realistic proportions and internal structures.',
    colors: ['#EF5350', '#AB47BC', '#42A5F5', '#FFCA28']
  },
  'lab-equipment': {
    prompt: 'Scientific glassware and precision instruments in clean technical style. Show professional laboratory equipment.',
    colors: ['#78909C', '#4DD0E1', '#AED581', '#FFCC80']
  },
  'pathway-diagram': {
    prompt: 'Signaling pathway with directional arrows and pathway nodes. Show molecular flow with clear connections.',
    colors: ['#7E57C2', '#26A69A', '#FF7043', '#5C6BC0']
  },
  'microscopy': {
    prompt: 'Microscope view style with histological staining appearance. Show cellular detail as seen under microscope.',
    colors: ['#7B1FA2', '#1976D2', '#388E3C', '#FFA000']
  },
  'medical': {
    prompt: 'Medical illustration with anatomical accuracy and professional styling. Show clear medical/anatomical detail.',
    colors: ['#E57373', '#64B5F6', '#81C784', '#FFD54F']
  },
  'biochemical': {
    prompt: 'Molecular structures and biochemical pathways. Show chemical interactions and molecular relationships.',
    colors: ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC']
  },
  'cellular': {
    prompt: 'Cellular biology and microscopic details. Show cell structures and organelles clearly.',
    colors: ['#4A90D9', '#7CB342', '#FF7043', '#9575CD']
  },
  'simple': {
    prompt: 'Minimal, clear silhouette with clean lines. Keep design simple and easily recognizable.',
    colors: ['#424242', '#757575', '#BDBDBD']
  },
  'detailed': {
    prompt: 'High detail scientific illustration with complex structures. Show intricate details and fine features.',
    colors: ['#1976D2', '#388E3C', '#D32F2F', '#F57C00']
  }
};

function getStylePrompt(style: string): string {
  const preset = scientificStylePresets[style];
  return preset ? preset.prompt : scientificStylePresets['simple'].prompt;
}

function getStyleColors(style: string): string[] {
  const preset = scientificStylePresets[style];
  return preset ? preset.colors : scientificStylePresets['simple'].colors;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Verify user authentication
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('✅ User authenticated:', user.id);

    const { prompt, style, scientificCategory }: GenerateSVGRequest = await req.json();

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    supabaseForRefund = supabase;
    try {
      const dr = await deductGeneration(supabase, user.id, 'generate-svg-icon');
      if (dr.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (dr.status === 'waiting') return waitingPeriodResponse(dr.unlockAt, corsHeaders);
      const gid = dr.id;
      creditIds = [gid];
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    console.log('🎨 Generating SVG icon...');
    console.log('📝 Prompt:', prompt);
    console.log('🎭 Style:', style);
    console.log('🔬 Scientific Category:', scientificCategory);

    const stylePrompt = getStylePrompt(style);
    const colors = getStyleColors(style);
    const colorPalette = colors.join(', ');

    const systemPrompt = `You are an expert scientific illustrator specializing in creating crisp, high-fidelity SVG icons for medical and scientific use.

Style Guidelines: ${stylePrompt}
Recommended Colors: ${colorPalette}

Requirements:
1. Output ONLY valid SVG code - no markdown, no explanations, no extra text
2. Use viewBox="0 0 512 512" for consistent scaling
3. Use enough path control points to produce smooth, precise curves - do NOT over-simplify
4. Use scientifically accurate proportions and representations
5. Ensure the icon scales perfectly from 32x32 to 2048x2048 without any jagged edges
6. NO embedded raster images - pure vector paths and shapes only
7. NO complex filters (drop-shadow, blur) - simple linear/radial gradients are OK
8. Use semantic groupings (<g>) for logical parts of the illustration
9. Use consistent stroke widths (1-3px range) with stroke-linecap="round" and stroke-linejoin="round" for smooth joins
10. Ensure good contrast and visibility against both light and dark backgrounds
11. Add shape-rendering="geometricPrecision" to the root <svg> element for maximum curve fidelity
12. Use full decimal precision in path data - do NOT round coordinates

Output Format:
- Start directly with <svg> tag
- Include xmlns="http://www.w3.org/2000/svg"
- Include shape-rendering="geometricPrecision" on the <svg> element
- Use the provided color palette where appropriate
- Keep the design clean, detailed, and professional`;

    const userPrompt = `Create an SVG icon for: ${prompt}

${scientificCategory ? `This is a ${scientificCategory} illustration.` : ''}

Remember: Output ONLY the SVG code, nothing else.`;

    console.log('🤖 Calling AI model...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 8000,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('RATE_LIMITED: AI service rate limit exceeded. Please try again in a moment.');
      } else if (response.status === 402) {
        throw new Error('CREDITS_DEPLETED: AI credits depleted. Add credits in Settings → Workspace → Usage.');
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    let svgCode = data.choices[0].message.content;

    console.log('📦 Received AI response, processing SVG...');

    // Extract SVG from potential markdown wrapper
    const svgMatch = svgCode.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      svgCode = svgMatch[0];
    } else {
      console.error('❌ No SVG found in response');
      throw new Error('AI did not return valid SVG code');
    }

    // Basic validation
    if (!svgCode.includes('<svg') || !svgCode.includes('</svg>')) {
      console.error('❌ Invalid SVG structure');
      throw new Error('Invalid SVG structure returned by AI');
    }

    // Ensure xmlns is present
    if (!svgCode.includes('xmlns=')) {
      svgCode = svgCode.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Ensure viewBox is present
    if (!svgCode.includes('viewBox')) {
      svgCode = svgCode.replace('<svg', '<svg viewBox="0 0 512 512"');
    }

    // Ensure width and height
    if (!svgCode.includes('width=')) {
      svgCode = svgCode.replace('<svg', '<svg width="512" height="512"');
    }

    // Ensure shape-rendering for crisp curves
    if (!svgCode.includes('shape-rendering')) {
      svgCode = svgCode.replace('<svg', '<svg shape-rendering="geometricPrecision"');
    }

    // Check for embedded images (not true vector)
    if (svgCode.includes('<image')) {
      console.warn('⚠️ SVG contains embedded image, not pure vector');
    }

    console.log('✅ SVG generated successfully');
    console.log('📊 SVG size:', svgCode.length, 'characters');

    // Track usage so this generation counts toward the user's quota & admin analytics.
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      await supabase.from('ai_generation_usage').insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: (prompt || '').substring(0, 200),
        style: style || '',
        generation_type: 'icon',
      });
    } catch (usageErr) {
      console.error('[generate-svg-icon] Usage insert failed:', usageErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        svgContent: svgCode,
        isPureVector: !svgCode.includes('<image'),
        size: svgCode.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error in generate-svg-icon function:', error);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
