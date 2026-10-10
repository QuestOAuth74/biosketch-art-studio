import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const iconId = url.searchParams.get('id');

    if (!iconId) {
      return new Response('Missing icon id', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: icon, error } = await supabase
      .from('icons')
      .select('thumbnail, svg_content, name')
      .eq('id', iconId)
      .single();

    if (error || !icon) {
      return new Response('Icon not found', { status: 404, headers: corsHeaders });
    }

    // Serve thumbnail as PNG if available
    if (icon.thumbnail) {
      const base64Data = icon.thumbnail.startsWith('data:')
        ? icon.thumbnail.split(',')[1]
        : icon.thumbnail;

      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      return new Response(bytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Content-Disposition': `inline; filename="${(icon.name || 'icon').replace(/[^a-zA-Z0-9-_]/g, '-')}.png"`,
        },
      });
    }

    // Fall back to SVG content
    if (icon.svg_content) {
      return new Response(icon.svg_content, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Content-Disposition': `inline; filename="${(icon.name || 'icon').replace(/[^a-zA-Z0-9-_]/g, '-')}.svg"`,
        },
      });
    }

    return new Response('No image data available', { status: 404, headers: corsHeaders });
  } catch (error) {
    console.error('Icon image error:', error);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});
