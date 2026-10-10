import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CLONE_COUNT_FOR_INFLATION = 100;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { percentage, variationMode, tierFilter } = await req.json();

    // Validate percentage
    if (percentage < 5 || percentage > 30) {
      return new Response(
        JSON.stringify({ error: 'Percentage must be between 5 and 30' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting inflation: ${percentage}% in ${variationMode} mode for ${tierFilter || 'all'}`);

    // Fetch projects based on tier filter
    let query = supabase
      .from('canvas_projects')
      .select('id, title, view_count, like_count, cloned_count')
      .eq('is_public', true)
      .eq('approval_status', 'approved');

    // Apply tier filtering (based on current engagement levels)
    if (tierFilter === 'tier1') {
      // Top 5 projects (highest views)
      query = query.order('view_count', { ascending: false }).limit(5);
    } else if (tierFilter === 'tier2') {
      // Next 8 projects (moderate views)
      query = query.order('view_count', { ascending: false }).range(5, 12);
    } else if (tierFilter === 'tier3') {
      // Remaining projects (growing views)
      query = query.order('view_count', { ascending: false }).range(13, 30);
    }

    const { data: projects, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching projects:', fetchError);
      throw fetchError;
    }

    if (!projects || projects.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No projects found to inflate' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${projects.length} projects to inflate`);

    // Filter out projects with very high clone counts to keep metrics realistic
    const projectsToInflate = projects.filter(p => (p.cloned_count || 0) <= MAX_CLONE_COUNT_FOR_INFLATION);
    const skippedProjects = projects.filter(p => (p.cloned_count || 0) > MAX_CLONE_COUNT_FOR_INFLATION);
    
    if (skippedProjects.length > 0) {
      console.log(`Skipped ${skippedProjects.length} projects with clone count > ${MAX_CLONE_COUNT_FOR_INFLATION}:`, 
        skippedProjects.map(p => ({ title: p.title, clones: p.cloned_count })));
    }

    if (projectsToInflate.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: `All ${projects.length} projects have clone counts exceeding ${MAX_CLONE_COUNT_FOR_INFLATION} and were skipped`,
          skippedCount: skippedProjects.length 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Inflating ${projectsToInflate.length} projects (${skippedProjects.length} skipped due to high clone counts)`);

    // Calculate totals before
    const totalViewsBefore = projectsToInflate.reduce((sum, p) => sum + (p.view_count || 0), 0);
    const totalLikesBefore = projectsToInflate.reduce((sum, p) => sum + (p.like_count || 0), 0);
    const totalClonesBefore = projectsToInflate.reduce((sum, p) => sum + (p.cloned_count || 0), 0);

    // Calculate new values and update projects
    const updates = projectsToInflate.map(project => {
      let inflationPercent = percentage;
      
      // For varied mode, randomize percentage within range
      if (variationMode === 'varied') {
        const minPercent = Math.max(5, percentage - 5);
        const maxPercent = Math.min(30, percentage + 5);
        inflationPercent = Math.random() * (maxPercent - minPercent) + minPercent;
      }

      const newViewCount = Math.max(0, Math.round((project.view_count || 0) * (1 + inflationPercent / 100)));
      const newLikeCount = Math.max(0, Math.round((project.like_count || 0) * (1 + inflationPercent / 100)));
      
      // Ensure clone count shows visible growth for small values
      const baseClonedCount = project.cloned_count || 0;
      const calculatedClonedCount = Math.round(baseClonedCount * (1 + inflationPercent / 100));
      // Guarantee at least +1 for non-zero clone counts to show growth
      const newClonedCount = baseClonedCount > 0 
        ? Math.max(baseClonedCount + 1, calculatedClonedCount)
        : 0;

      return {
        id: project.id,
        view_count: newViewCount,
        like_count: newLikeCount,
        cloned_count: newClonedCount,
      };
    });

    // Execute batch updates
    const updatePromises = updates.map(update =>
      supabase
        .from('canvas_projects')
        .update({
          view_count: update.view_count,
          like_count: update.like_count,
          cloned_count: update.cloned_count,
        })
        .eq('id', update.id)
    );

    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter(r => r.error);

    if (updateErrors.length > 0) {
      console.error('Errors during update:', updateErrors);
      throw new Error(`Failed to update ${updateErrors.length} projects`);
    }

    console.log(`Successfully updated ${updates.length} projects`);

    // Calculate totals after
    const totalViewsAfter = updates.reduce((sum, u) => sum + u.view_count, 0);
    const totalLikesAfter = updates.reduce((sum, u) => sum + u.like_count, 0);
    const totalClonesAfter = updates.reduce((sum, u) => sum + u.cloned_count, 0);

    // Create log entry
    const { error: logError } = await supabase
      .from('metrics_inflation_log')
      .insert({
        inflated_by: user.id,
        percentage,
        variation_mode: variationMode,
        tier_filter: tierFilter || 'all',
        projects_affected: projectsToInflate.length,
        total_views_before: totalViewsBefore,
        total_views_after: totalViewsAfter,
        total_likes_before: totalLikesBefore,
        total_likes_after: totalLikesAfter,
        total_clones_before: totalClonesBefore,
        total_clones_after: totalClonesAfter,
      });

    if (logError) {
      console.error('Error creating log entry:', logError);
      // Don't fail the request if logging fails
    }

    const summary = {
      success: true,
      projectsAffected: projectsToInflate.length,
      projectsSkipped: skippedProjects.length,
      skippedReason: skippedProjects.length > 0 ? `Clone count > ${MAX_CLONE_COUNT_FOR_INFLATION}` : null,
      before: {
        views: totalViewsBefore,
        likes: totalLikesBefore,
        clones: totalClonesBefore,
      },
      after: {
        views: totalViewsAfter,
        likes: totalLikesAfter,
        clones: totalClonesAfter,
      },
      changes: {
        views: totalViewsAfter - totalViewsBefore,
        likes: totalLikesAfter - totalLikesBefore,
        clones: totalClonesAfter - totalClonesBefore,
      },
    };

    console.log('Inflation complete:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in inflate-community-metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
