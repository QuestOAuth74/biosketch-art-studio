import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IconRecord {
  id: string;
  name: string;
  svg_content: string;
  thumbnail: string | null;
}

// Ultra-aggressive optimization for large SVGs (fallback)
function generateUltraCompressedThumbnail(svgContent: string): string | null {
  try {
    let optimized = svgContent
      // Remove all XML/metadata
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
      .replace(/<title>[\s\S]*?<\/title>/gi, '')
      .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
      .replace(/<defs>[\s\S]*?<\/defs>/gi, '')
      
      // Remove ALL styling and attributes except essential structure
      .replace(/\s+id=["'][^"']*["']/g, '')
      .replace(/\s+class=["'][^"']*["']/g, '')
      .replace(/\s+style=["'][^"']*["']/g, '')
      .replace(/\s+fill=["'][^"']*["']/g, '')
      .replace(/\s+stroke=["'][^"']*["']/g, '')
      .replace(/\s+stroke-width=["'][^"']*["']/g, '')
      .replace(/\s+opacity=["'][^"']*["']/g, '')
      .replace(/\s+data-[^=]*=["'][^"']*["']/g, '')
      .replace(/\s+xmlns:[^=]*=["'][^"']*["']/g, '')
      
      // Convert all numbers to integers (lose precision for thumbnails)
      .replace(/(\d+\.\d+)/g, (match) => Math.round(parseFloat(match)).toString())
      
      // Extreme whitespace minification
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();

    // Ensure viewBox exists
    if (!optimized.includes('viewBox')) {
      const widthMatch = optimized.match(/width=["']([^"']*)["']/);
      const heightMatch = optimized.match(/height=["']([^"']*)["']/);
      if (widthMatch && heightMatch) {
        const width = Math.round(parseFloat(widthMatch[1]));
        const height = Math.round(parseFloat(heightMatch[1]));
        optimized = optimized.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
      }
    }

    return optimized;
  } catch (error) {
    console.error('Ultra compression failed:', error);
    return null;
  }
}

// Generate optimized thumbnail from full SVG (target max 50KB)
function generateThumbnail(svgContent: string): string | null {
  try {
    // Step 1: Remove XML declarations, comments, metadata (aggressive cleanup)
    let optimized = svgContent
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
      .replace(/<title>[\s\S]*?<\/title>/gi, '')
      .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
      .replace(/<defs>[\s\S]*?<\/defs>/gi, '')
      .trim();

    // Step 2: Ensure viewBox exists for proper scaling
    const viewBoxMatch = optimized.match(/viewBox=["']([^"']*)["']/);
    const widthMatch = optimized.match(/width=["']([^"']*)["']/);
    const heightMatch = optimized.match(/height=["']([^"']*)["']/);

    if (!viewBoxMatch && widthMatch && heightMatch) {
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);
      if (!isNaN(width) && !isNaN(height)) {
        optimized = optimized.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
      }
    }

    // Step 3: Remove unnecessary attributes (aggressive)
    optimized = optimized
      .replace(/\s+id=["'][^"']*["']/g, '')
      .replace(/\s+class=["'][^"']*["']/g, '')
      .replace(/\s+style=["'][^"']*["']/g, '')
      .replace(/\s+data-[^=]*=["'][^"']*["']/g, '')
      .replace(/\s+xmlns:[^=]*=["'][^"']*["']/g, '');

    // Step 4: Reduce decimal precision (1 decimal place for thumbnails)
    optimized = optimized.replace(/(\d+\.\d{2,})/g, (match) => parseFloat(match).toFixed(1));

    // Step 5: Minify whitespace aggressively
    optimized = optimized
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();

    // Step 6: Additional optimization for large SVGs (target max 50KB)
    if (optimized.length > 50000) {
      // Remove fill/stroke colors (will inherit)
      optimized = optimized
        .replace(/\s+fill=["'][^"']*["']/g, '')
        .replace(/\s+stroke=["'][^"']*["']/g, '');
      
      // Further reduce precision to integers
      optimized = optimized.replace(/(\d+\.\d+)/g, (match) => Math.round(parseFloat(match)).toString());
    }

    // Step 7: Validate result
    if (!/\<svg[\s\S]*\<\/svg\>/i.test(optimized)) {
      console.warn('Optimization produced invalid SVG, using original');
      return null;
    }

    // Step 8: Final size check with ultra-compression fallback
    if (optimized.length > 100000) {
      console.warn(`Thumbnail still too large (${optimized.length} bytes), trying ultra compression...`);
      const ultraCompressed = generateUltraCompressedThumbnail(svgContent);
      
      if (!ultraCompressed || ultraCompressed.length > 100000) {
        console.error('Even ultra compression failed, thumbnail too complex');
        return null;
      }
      
      optimized = ultraCompressed;
      console.log(`Ultra compression successful: ${optimized.length} bytes`);
    }

    const originalSize = svgContent.length;
    const newSize = optimized.length;
    const reduction = (((originalSize - newSize) / originalSize) * 100).toFixed(1);
    console.log(`Thumbnail optimized: ${originalSize} → ${newSize} bytes (${reduction}% reduction)`);

    return optimized;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check authentication (admin only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting thumbnail generation...');

    // Fetch icons without thumbnails (NULL or empty), including recently uploaded ones
    const { data: icons, error: fetchError } = await supabase
      .from('icons')
      .select('id, name, svg_content')
      .or('thumbnail.is.null,thumbnail.eq.')
      .order('created_at', { ascending: false })
      .limit(50); // Process max 50 at a time

    if (fetchError) {
      console.error('Error fetching icons:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch icons', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!icons || icons.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No icons need thumbnail generation', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${icons.length} icons...`);

    let processed = 0;
    let failed = 0;

    // Process icons one at a time to minimize memory usage
    for (const icon of icons as IconRecord[]) {
      try {
        console.log(`Processing icon: ${icon.name} (${icon.id})`);
        
        // Validate SVG content before processing (case-insensitive)
        const lower = (icon.svg_content || '').toLowerCase();
        if (!lower.includes('<svg')) {
          console.error(`Invalid SVG content for ${icon.name}`);
          failed++;
          continue;
        }
        
        const thumbnail = generateThumbnail(icon.svg_content);
        
        if (!thumbnail) {
          console.error(`Generated thumbnail invalid or too large for ${icon.name}`);
          failed++;
          continue;
        }
        
        // Validate generated thumbnail size
        const thumbnailSize = new TextEncoder().encode(thumbnail).length;
        if (thumbnailSize > 100000) {
          console.error(`Generated thumbnail too large for ${icon.name}: ${thumbnailSize} bytes`);
          failed++;
          continue;
        }
        
        // Free memory immediately after processing
        icon.svg_content = '';
        
        const { error: updateError } = await supabase
          .from('icons')
          .update({ thumbnail })
          .eq('id', icon.id);

        if (updateError) {
          console.error(`Failed to update ${icon.name}:`, updateError);
          failed++;
        } else {
          console.log(`✓ Generated thumbnail for ${icon.name} (${thumbnailSize} bytes)`);
          processed++;
          if (processed % 10 === 0) {
            console.log(`Progress: ${processed}/${icons.length} icons processed`);
          }
        }
      } catch (error) {
        console.error(`Error processing ${icon.name}:`, error);
        failed++;
      }
    }

    console.log(`Thumbnail generation complete. Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        message: 'Thumbnail generation complete',
        processed,
        failed,
        total: icons.length,
        remaining: failed // Indicates if there are more to process
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
