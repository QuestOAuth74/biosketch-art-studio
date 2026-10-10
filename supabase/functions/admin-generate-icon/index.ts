import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stylePrompts: Record<string, string> = {
  '2d-flat': `Flat 2D vector scientific illustration — clean, crisp, publication-quality.

QUALITY RULES:
- Render at the HIGHEST resolution and detail possible. Every edge must be crisp, smooth, and perfectly anti-aliased.
- Use ANATOMICALLY ACCURATE colors — red blood cells are red, arteries red, veins blue, liver dark reddish-brown, bone off-white/cream, muscle deep red, lungs pinkish, brain pinkish-grey, kidneys dark red-brown.
- Colors should be clean, vivid, and professional — NOT neon, NOT washed-out.

STYLE RULES — THIS IS CRITICAL:
- COMPLETELY FLAT. Each shape is ONE solid color. NO gradients, NO shading, NO highlights, NO shadows, NO 3D effects of any kind.
- Clean thin outlines in a slightly darker shade of the fill color (NOT black). Consistent outline weight throughout.
- Smooth, perfectly curved bezier edges — organic shapes simplified into clean, idealized geometric forms.
- Shapes are defined by solid flat fills and clean edges. NO specular highlights, NO lighting effects, NO depth.
- Internal structure suggested with minimal thin separator lines or contrasting flat color regions, NOT shading.
- The icon must be instantly recognizable and diagrammatically clear.
- NO texture, NO noise, NO grain, NO brush strokes, NO blurriness, NO 3D rendering.
- Scientific accuracy in proportions and key structural features.

The result should look like a premium flat vector icon — crisp, modern, completely flat solid colors, clean outlines, professional, publication-quality. Think Servier Medical Art or flat infographic style.

DO NOT: use gradients, 3D shading, highlights, shadows, specular reflections, depth effects, neon colors, drop shadows, or make it look like clip art.`,

  '3d-rendered': `3D rendered scientific illustration with realistic depth and lighting.
Create with:
- Realistic 3D shading and highlights
- Soft ambient occlusion for depth
- Professional lighting setup (top-left key light)
- Smooth surfaces with realistic material properties
- Small specular highlights on rounded forms
- Scientific accuracy in proportions and structure
- Clean, polished 3D render quality — no noise or grain`,

  'line-art': `Clean line art scientific illustration.
Create with:
- Precise, consistent line weights (2-3px)
- No fills, only outlines and structural lines
- Scientific diagram style with clear detail
- Confident, clean line work — no wispy or faint lines
- Black or dark grey lines on transparent background`,

  'biomedical': `Premium semi-flat vector scientific illustration in the BioRender style.
Create with:
- Semi-flat filled shapes with subtle soft gradients (2-3 tones per shape) suggesting gentle 3D form
- NO outlines. NO black strokes. Edges defined by color contrast between adjacent shapes only.
- Muted professional color palette — soft blues, teals, corals, warm oranges, muted purples
- Consistent top-left lighting with subtle highlights and shadows
- Small specular highlights on rounded forms (vesicles, proteins)
- Smooth, clean vector shapes with perfectly anti-aliased edges
- Simplified but anatomically recognizable — idealized geometric forms
- NO texture, NO noise, NO drop shadows, NO heavy outlines`,

  'pencil': `Hand-drawn pencil sketch style scientific illustration.
Create with:
- Fine pencil line work with varying pressure
- Subtle cross-hatching for shading
- Sketch-like organic lines
- Grayscale tones with soft highlights
- Textbook illustration feel`,

  'hd-realistic': `High-definition photorealistic scientific illustration.

MANDATORY RULES — follow these exactly:
- Create a PHOTOREALISTIC, high-detail rendering of the subject
- Use AUTHENTIC, true-to-life colors — exactly as the subject appears in reality
- Include realistic lighting with soft shadows, specular highlights, and ambient occlusion
- Render realistic material properties: glossy surfaces, translucent membranes, wet tissue, metallic instruments
- Add subtle depth of field for a professional photography look
- Include fine surface textures and micro-details visible at high resolution
- Scientific accuracy is critical — proportions, structures, and morphology must be correct
- Render at the highest quality possible with sharp details and smooth anti-aliasing
- The result should look like a professional scientific photograph or high-end 3D render
- Colors must be natural and authentic — NOT stylized, NOT pastel, NOT muted

DO NOT: flatten, simplify, or stylize the image. This must look real, not like a diagram or illustration.`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, style, colorPalette, referenceImage, count = 1 } = await req.json();

    if (!prompt) throw new Error('Prompt is required');

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    const styleInstruction = stylePrompts[style] || stylePrompts['2d-flat'];

    const colorInstruction = colorPalette
      ? `Use this specific color palette: ${colorPalette}. These colors should dominate the illustration.`
      : '';

    const isHD = style === 'hd-realistic' || style === '2d-flat';

    const sizeRequirement = isHD
      ? '- Render at the highest resolution and detail possible with crisp sharp edges'
      : '- Clean edges that work well at small sizes (32x32 to 512x512)';

    const systemPrompt = `You are an expert scientific illustrator creating icons for a scientific illustration tool.

${styleInstruction}

${colorInstruction}

Requirements:
- Output MUST be a PNG on a plain solid WHITE (#FFFFFF) background
- The background must be pure white with NO gradients, NO shadows, NO vignettes, NO patterns
- ABSOLUTELY NO text, NO labels, NO annotations, NO captions, NO letters, NO numbers, NO written content of any kind anywhere in the image
- Scientific accuracy in proportions and structure
- Every edge must be perfectly smooth and anti-aliased — crisp vector quality
- If a reference image is provided, maintain consistent style, proportions, and shape construction
${sizeRequirement}
- Pure visual illustration only — the subject centered on a clean white background

Create: ${prompt}`;

    const results: Array<{ image: string; index: number }> = [];
    const generateCount = Math.min(count, 4);

    for (let i = 0; i < generateCount; i++) {
      console.log(`Generating variant ${i + 1}/${generateCount}...`);

      const parts: any[] = [{ text: systemPrompt }];

      // Add reference image if provided
      if (referenceImage) {
        const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/);
        if (base64Match) {
          parts.push({
            inlineData: {
              mimeType: `image/${base64Match[1]}`,
              data: base64Match[2],
            },
          });
          parts.push({
            text: 'Use this reference image as your primary guide. Match the EXACT proportions, outline style, outline weight, shape construction, and level of detail from this reference as closely as possible. The output should look like it belongs in the same icon set as this reference. Do NOT add any text, labels, annotations, or written content.',
          });
        }
      }

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
            contents: [{ parts }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error(`Variant ${i + 1} failed:`, geminiResponse.status, errorText);
        if (geminiResponse.status === 429) throw new Error('RATE_LIMITED');
        continue; // Skip failed variant, try next
      }

      const geminiData = await geminiResponse.json();
      const geminiParts = geminiData?.candidates?.[0]?.content?.parts;
      const imagePart = geminiParts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

      if (imagePart) {
        const resultMime = imagePart.inlineData.mimeType;
        const resultBase64 = imagePart.inlineData.data;
        results.push({
          image: `data:${resultMime};base64,${resultBase64}`,
          index: i,
        });
      }
    }

    if (results.length === 0) {
      throw new Error('Failed to generate any icon variants');
    }

    console.log(`Generated ${results.length}/${generateCount} variants`);

    return new Response(
      JSON.stringify({ success: true, variants: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-generate-icon:', error);
    let statusCode = 500;
    if (error.message === 'RATE_LIMITED') statusCode = 429;
    if (error.message === 'Unauthorized' || error.message === 'No authorization header') statusCode = 401;

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
