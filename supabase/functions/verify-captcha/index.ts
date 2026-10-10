import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyCaptchaRequest {
  token: string;
  sitekey?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, sitekey }: VerifyCaptchaRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const hcaptchaSecret = Deno.env.get('HCAPTCHA_SECRET_KEY');
    if (!hcaptchaSecret) {
      console.error('HCAPTCHA_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Verify the captcha token with HCaptcha
    const verifyResponse = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${encodeURIComponent(hcaptchaSecret)}&response=${encodeURIComponent(token)}${sitekey ? `&sitekey=${encodeURIComponent(sitekey)}` : ''}`,
    });

    const verifyResult = await verifyResponse.json();

    console.log('HCaptcha verification result:', {
      success: verifyResult.success,
      errorCodes: verifyResult['error-codes'] || [],
      timestamp: new Date().toISOString(),
    });

    // Log the full response for debugging
    if (!verifyResult.success) {
      console.error('HCaptcha verification failed:', JSON.stringify(verifyResult));
    }

    return new Response(
      JSON.stringify({
        success: verifyResult.success,
        error: verifyResult.success ? null : 'Captcha verification failed',
        errorCodes: verifyResult['error-codes'] || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error verifying captcha:', error);
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
