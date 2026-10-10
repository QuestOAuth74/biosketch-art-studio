// Creates a Stripe Checkout session for an AI credit purchase.
// Called by the frontend when a user picks a tier ($5 / $10 / $20).
//
// Requires the Supabase user JWT in the Authorization header — we identify the
// buyer server-side so a malicious client can't credit another user's account.
//
// Implementation note: this hits Stripe's REST API directly with fetch rather
// than using the Stripe SDK, because the SDK's Deno-compat build has flaky
// coverage of newer features and its createFetchHttpClient() call breaks in
// some releases. Direct fetch is stable, small, and easy to debug.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIERS = {
  5:  { priceEnv: "STRIPE_PRICE_5",  generations: 50  },
  10: { priceEnv: "STRIPE_PRICE_10", generations: 120 },
  20: { priceEnv: "STRIPE_PRICE_20", generations: 280 },
} as const;
type Tier = keyof typeof TIERS;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization header" });

    // Resolve caller identity using the service role key + the user's JWT,
    // matching the auth pattern used by ai-illustrator (known to work).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth failed:", authError?.message, "token len:", token.length);
      return json(401, { error: "Not authenticated" });
    }

    const { tier, origin } = await req.json();
    const tierKey = Number(tier) as Tier;
    if (!TIERS[tierKey]) return json(400, { error: "Invalid tier" });
    const { priceEnv, generations } = TIERS[tierKey];
    const priceId = Deno.env.get(priceEnv);
    if (!priceId) return json(500, { error: `Missing env var ${priceEnv}` });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json(500, { error: "Missing STRIPE_SECRET_KEY" });

    // Normalize the origin: strip `www.` from biosketch.art so we always
    // redirect back to the apex domain, which is the one covered by our SSL
    // cert. Without this, users who visited https://www.biosketch.art get an
    // SSL warning on the Stripe → app return trip.
    const rawOrigin = origin || req.headers.get("origin") || "https://biosketch.art";
    const baseOrigin = rawOrigin.replace(/^https:\/\/www\.biosketch\.art/i, "https://biosketch.art");

    // Stripe accepts x-www-form-urlencoded body. Use `URLSearchParams`.
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("payment_method_types[]", "card");
    body.set("line_items[0][price]", priceId);
    body.set("line_items[0][quantity]", "1");
    body.set("success_url", `${baseOrigin}/profile?checkout=success`);
    body.set("cancel_url", `${baseOrigin}/profile?checkout=cancel`);
    body.set("client_reference_id", user.id);
    if (user.email) body.set("customer_email", user.email);
    body.set("metadata[user_id]", user.id);
    body.set("metadata[tier]", String(tierKey));
    body.set("metadata[generations]", String(generations));

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const stripeData = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error("Stripe error:", stripeData);
      return json(stripeRes.status, {
        error: stripeData?.error?.message || "Stripe checkout creation failed",
      });
    }

    return json(200, { url: stripeData.url });
  } catch (err) {
    console.error("create-credit-checkout-session error:", err);
    return json(500, { error: (err as Error).message });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
