import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoginRequest {
  email: string;
  password: string;
}

const MAX_ATTEMPTS = 5;
const TIME_WINDOW_MINUTES = 15;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password }: LoginRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and password are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Get client IP from headers
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Create Supabase client with service role key for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Login attempt for email: ${email} from IP: ${clientIP}`);

    // Clean up old attempts first
    const timeThreshold = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
    await supabaseClient
      .from('login_attempts')
      .delete()
      .lt('attempt_time', timeThreshold);

    // Check recent failed attempts by email
    const { data: recentAttempts, error: attemptsError } = await supabaseClient
      .from('login_attempts')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('success', false)
      .gte('attempt_time', timeThreshold)
      .order('attempt_time', { ascending: false });

    if (attemptsError) {
      console.error('Error checking attempts:', attemptsError);
      throw attemptsError;
    }

    const failedAttempts = recentAttempts?.length || 0;

    console.log(`Failed attempts in last ${TIME_WINDOW_MINUTES} minutes: ${failedAttempts}`);

    // Check if rate limit exceeded
    if (failedAttempts >= MAX_ATTEMPTS) {
      const oldestAttempt = recentAttempts[recentAttempts.length - 1];
      const timeUntilReset = new Date(oldestAttempt.attempt_time).getTime() + 
                            (TIME_WINDOW_MINUTES * 60 * 1000) - Date.now();
      const minutesRemaining = Math.ceil(timeUntilReset / 60000);

      console.log(`Rate limit exceeded for ${email}. ${minutesRemaining} minutes remaining.`);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Too many failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
          rateLimited: true,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Create a client with anon key for authentication
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey);

    // Attempt to sign in
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    const loginSuccess = !authError && authData.user;

    // Record the attempt
    await supabaseClient
      .from('login_attempts')
      .insert({
        email: email.toLowerCase(),
        ip_address: clientIP,
        success: loginSuccess,
        attempt_time: new Date().toISOString(),
      });

    if (authError || !authData.user) {
      console.log(`Login failed for ${email}: ${authError?.message}`);

      return new Response(
        JSON.stringify({
          success: false,
          error: authError?.message || 'Invalid login credentials',
          remainingAttempts: Math.max(0, MAX_ATTEMPTS - failedAttempts - 1),
        }),
        {
          status: 200,  // Return 200 so client can check data.success instead of getting functionError
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Clear failed attempts on successful login
    if (loginSuccess) {
      await supabaseClient
        .from('login_attempts')
        .delete()
        .eq('email', email.toLowerCase())
        .eq('success', false);

      console.log(`Successful login for ${email}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: authData.session,
        user: authData.user,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in rate-limited-login:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
