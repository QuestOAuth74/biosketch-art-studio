import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

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

    const { mode, minDaysOld, userIds } = await req.json();

    // Mode: "preview" returns matching users, "delete" actually removes them
    if (mode === 'preview') {
      // Find users with 0 projects who signed up at least minDaysOld days ago
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - minDaysOld);

      const { data: allUsers, error: fetchError } = await supabase
        .rpc('get_user_analytics', { limit_count: 100000, offset_count: 0 });

      if (fetchError) throw fetchError;

      const inactive = (allUsers || [])
        .filter((u: any) => {
          const projectCount = Number(u.project_count);
          const createdAt = new Date(u.created_at);
          return projectCount === 0 && createdAt <= cutoffDate;
        })
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          country: u.country,
          field_of_study: u.field_of_study,
          created_at: u.created_at,
          last_login_at: u.last_login_at,
        }));

      return new Response(
        JSON.stringify({ users: inactive, count: inactive.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'delete') {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No user IDs provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Safety limit
      if (userIds.length > 200) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete more than 200 users at once' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Don't allow deleting the admin themselves
      if (userIds.includes(user.id)) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Admin ${user.email} deleting ${userIds.length} inactive users`);

      let deleted = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const uid of userIds) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(uid);
        if (deleteError) {
          failed++;
          errors.push(`${uid}: ${deleteError.message}`);
          console.error(`Failed to delete user ${uid}:`, deleteError.message);
        } else {
          deleted++;
        }
      }

      console.log(`Cleanup complete: ${deleted} deleted, ${failed} failed`);

      return new Response(
        JSON.stringify({ deleted, failed, errors: errors.slice(0, 10) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid mode. Use "preview" or "delete".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-inactive-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
