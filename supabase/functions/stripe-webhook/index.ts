// Stripe webhook receiver — grants purchased credits on payment success.
//
// This function MUST be publicly reachable (no JWT check) because Stripe calls
// it directly. Security comes from verifying the Stripe signature header.
//
// Idempotency is enforced at the DB layer: `grant_purchased_credits` returns
// false if the same `stripe_session_id` is inserted twice — safe for Stripe's
// retry semantics.
//
// Implementation note: verifies the Stripe signature manually with the Web
// Crypto API (HMAC-SHA256) instead of the Stripe SDK — avoids Deno-compat
// issues and lets us treat the whole flow as boring fetch code.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Verify a Stripe webhook signature (spec: https://stripe.com/docs/webhooks/signatures).
// Tolerance defaults to 5 minutes as recommended.
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  // Header format: "t=<timestamp>,v1=<sig>[,v1=<sig>...]"
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k, rest.join("=")];
    }),
  );
  const timestamp = Number(parts["t"]);
  const signatures = header.split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare against any of the provided v1 signatures.
  return signatures.some((s) => {
    if (s.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ s.charCodeAt(i);
    return diff === 0;
  });
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const body = await req.text();
  const verified = await verifyStripeSignature(body, signature, webhookSecret);
  if (!verified) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true, ignored: event.type }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = event.data.object;
  const userId = session.metadata?.user_id || session.client_reference_id;
  const generations = Number(session.metadata?.generations);
  const amountUsd = (session.amount_total ?? 0) / 100;

  if (!userId || !generations) {
    console.error("Missing metadata on Stripe session:", session.id);
    return new Response("Missing metadata", { status: 400 });
  }

  const { data, error } = await supabase.rpc("grant_purchased_credits", {
    p_user_id: userId,
    p_stripe_session_id: session.id,
    p_amount_usd: amountUsd,
    p_generations: generations,
  });

  if (error) {
    console.error("grant_purchased_credits failed:", error);
    return new Response("DB error", { status: 500 });
  }

  console.log(
    `[stripe-webhook] session=${session.id} user=${userId} tier=$${amountUsd} generations=${generations} granted=${data}`,
  );

  return new Response(JSON.stringify({ received: true, granted: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
