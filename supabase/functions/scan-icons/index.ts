import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScanRequest {
  category?: string;
  page?: number;
  batch_size?: number;
  scan_type: 'defective' | 'duplicates' | 'all';
}

interface IconIssue {
  id: string;
  name: string;
  category: string;
  svg_content: string;
  thumbnail: string | null;
  issues: string[];
  duplicate_of?: string;
  thumbnail_size?: number;
  created_at?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: hasAdminRole } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!hasAdminRole) {
      throw new Error('Admin role required');
    }

    const body: ScanRequest = await req.json();
    const {
      category = 'all',
      page = 1,
      batch_size = 20,
      scan_type = 'all',
    } = body;

    // Limit batch size to prevent abuse
    const safeBatchSize = Math.min(Math.max(batch_size, 1), 50);
    const offset = (page - 1) * safeBatchSize;

    const problematicIcons: IconIssue[] = [];

    // Build base query
    let query = supabase.from('icons').select('*', { count: 'exact' });
    
    if (category !== 'all') {
      query = query.eq('category', category);
    }

    // Get all icons for this category (we'll filter by issue type)
    const { data: icons, error: fetchError, count: totalCount } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!icons) {
      return new Response(
        JSON.stringify({
          icons: [],
          metadata: {
            total_issues: 0,
            current_page: page,
            total_pages: 0,
            batch_size: safeBatchSize,
            category,
            scan_type,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get reviewed icons to exclude them
    const { data: reviewedIcons } = await supabase
      .from('icon_review_status')
      .select('icon_id');
    
    const reviewedIconIds = new Set(reviewedIcons?.map(r => r.icon_id) || []);

    // Scan for defective icons
    if (scan_type === 'defective' || scan_type === 'all') {
      for (const icon of icons) {
        if (reviewedIconIds.has(icon.id)) continue;

        const issues: string[] = [];

        // Check for missing thumbnail
        if (!icon.thumbnail || icon.thumbnail.trim() === '') {
          issues.push('Missing thumbnail');
        }

        // Check thumbnail size (if exists)
        if (icon.thumbnail) {
          const thumbnailSize = new Blob([icon.thumbnail]).size;
          if (thumbnailSize > 100000) {
            issues.push(`Oversized thumbnail (${(thumbnailSize / 1024).toFixed(2)}KB)`);
          }
        }

        // Check for invalid SVG content
        if (!icon.svg_content || icon.svg_content.trim() === '') {
          issues.push('Empty SVG content');
        } else {
          if (!icon.svg_content.includes('<svg')) {
            issues.push('Missing <svg> tag');
          }
          if (!icon.svg_content.includes('viewBox')) {
            issues.push('Missing viewBox attribute');
          }
        }

        // Check for malformed names
        if (icon.name.includes('%')) {
          issues.push('URL-encoded characters in name');
        }
        if (icon.name.length > 100) {
          issues.push('Name too long (>100 characters)');
        }

        if (issues.length > 0) {
          problematicIcons.push({
            id: icon.id,
            name: icon.name,
            category: icon.category,
            svg_content: icon.svg_content,
            thumbnail: icon.thumbnail,
            issues,
            thumbnail_size: icon.thumbnail ? new Blob([icon.thumbnail]).size : 0,
            created_at: icon.created_at,
          });
        }
      }
    }

    // Scan for duplicates
    if (scan_type === 'duplicates' || scan_type === 'all') {
      // Find exact name duplicates
      const nameMap = new Map<string, string[]>();
      for (const icon of icons) {
        if (reviewedIconIds.has(icon.id)) continue;
        const key = `${icon.name}_${icon.category}`;
        if (!nameMap.has(key)) {
          nameMap.set(key, []);
        }
        nameMap.get(key)!.push(icon.id);
      }

      for (const [key, iconIds] of nameMap.entries()) {
        if (iconIds.length > 1) {
          const [firstId, ...duplicateIds] = iconIds;
          for (const dupId of duplicateIds) {
            const icon = icons.find(i => i.id === dupId)!;
            problematicIcons.push({
              id: icon.id,
              name: icon.name,
              category: icon.category,
              svg_content: icon.svg_content,
              thumbnail: icon.thumbnail,
              issues: ['Duplicate name in same category'],
              duplicate_of: firstId,
              created_at: icon.created_at,
            });
          }
        }
      }

      // Find SVG content duplicates
      const svgMap = new Map<string, string[]>();
      for (const icon of icons) {
        if (reviewedIconIds.has(icon.id)) continue;
        const normalizedSvg = icon.svg_content.replace(/\s+/g, ' ').trim();
        if (!svgMap.has(normalizedSvg)) {
          svgMap.set(normalizedSvg, []);
        }
        svgMap.get(normalizedSvg)!.push(icon.id);
      }

      for (const [svg, iconIds] of svgMap.entries()) {
        if (iconIds.length > 1) {
          const [firstId, ...duplicateIds] = iconIds;
          for (const dupId of duplicateIds) {
            const icon = icons.find(i => i.id === dupId)!;
            const existingIssue = problematicIcons.find(i => i.id === icon.id);
            if (existingIssue) {
              existingIssue.issues.push('Duplicate SVG content');
              existingIssue.duplicate_of = firstId;
            } else {
              problematicIcons.push({
                id: icon.id,
                name: icon.name,
                category: icon.category,
                svg_content: icon.svg_content,
                thumbnail: icon.thumbnail,
                issues: ['Duplicate SVG content'],
                duplicate_of: firstId,
                created_at: icon.created_at,
              });
            }
          }
        }
      }
    }

    // Sort by created_at (oldest first)
    problematicIcons.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });

    // Paginate results
    const totalIssues = problematicIcons.length;
    const totalPages = Math.ceil(totalIssues / safeBatchSize);
    const paginatedIcons = problematicIcons.slice(offset, offset + safeBatchSize);

    console.log(`Found ${totalIssues} issues, returning page ${page} of ${totalPages}`);

    return new Response(
      JSON.stringify({
        icons: paginatedIcons,
        metadata: {
          total_issues: totalIssues,
          current_page: page,
          total_pages: totalPages,
          batch_size: safeBatchSize,
          category,
          scan_type,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scan-icons:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});