import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrcidAuthRequest {
  code: string;
  redirectUri: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirectUri }: OrcidAuthRequest = await req.json();

    if (!code || !redirectUri) {
      return new Response(
        JSON.stringify({ success: false, error: 'Code and redirectUri are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const orcidClientId = Deno.env.get('ORCID_CLIENT_ID');
    const orcidClientSecret = Deno.env.get('ORCID_CLIENT_SECRET');

    if (!orcidClientId || !orcidClientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: `Missing secrets: clientId=${!!orcidClientId}, clientSecret=${!!orcidClientSecret}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Exchange authorization code for tokens with ORCID
    const tokenRes = await fetch('https://orcid.org/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: orcidClientId,
        client_secret: orcidClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `ORCID token exchange failed (${tokenRes.status}): ${errText}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const tokenData = await tokenRes.json();
    const orcidId: string = tokenData.orcid;
    const orcidName: string = tokenData.name || '';

    if (!orcidId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No ORCID iD returned', tokenData }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const placeholderEmail = `${orcidId}@orcid.user`;

    // Create user if they don't exist
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: placeholderEmail,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: {
        full_name: orcidName,
        orcid_id: orcidId,
      },
    });

    // If user already exists, that's fine

    // Generate a magic link via GoTrue Admin REST API
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: placeholderEmail,
      }),
    });

    if (!linkRes.ok) {
      const linkErr = await linkRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `Failed to generate link: ${linkErr}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const linkData = await linkRes.json();

    // The response contains hashed_token directly in the JSON body
    const tokenHash = linkData.hashed_token;

    if (!tokenHash) {
      return new Response(
        JSON.stringify({ success: false, error: 'No hashed_token in response', keys: Object.keys(linkData) }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Verify the token to get a real session
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        token_hash: tokenHash,
      }),
    });

    if (!verifyRes.ok) {
      const verifyErr = await verifyRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `Failed to verify token: ${verifyErr}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const session = await verifyRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: `Unexpected error: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
