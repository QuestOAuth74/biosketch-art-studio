import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import {
  deductGeneration,
  deductGenerationsBatch,
  refundGeneration,
  refundGenerations,
  insufficientCreditsResponse,
  waitingPeriodResponse,
} from "../_shared/aiCredits.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    // Check AI credits
    const { data: usageData } = await supabase.rpc('can_user_generate', { _user_id: user.id });
    if (!usageData?.canGenerate && !usageData?.isAdmin) {
      // Return 200 so the supabase-js client doesn't collapse the body
      // into the generic "non-2xx" wrapper; the frontend reads data.error.
      return new Response(JSON.stringify({ error: 'No AI credits remaining. Earn more by contributing icons or completing your profile.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { mode, testResults, chartType, columns, descriptiveStats, tone } = await req.json();
    if (!mode || !testResults) throw new Error('Missing required fields');

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    supabaseForRefund = supabase;
    try {
      const dr = await deductGeneration(supabase, user.id, 'chart-studio-ai');
      if (dr.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (dr.status === 'waiting') return waitingPeriodResponse(dr.unlockAt, corsHeaders);
      const gid = dr.id;
      creditIds = [gid];
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "explain") {
      systemPrompt = "You are an expert biostatistician helping researchers interpret statistical results for publication. Write thorough, accurate, publication-ready interpretations. Be detailed and comprehensive. Include effect sizes, confidence intervals, and practical significance. Explain what the test shows AND does not show. Write at least 3-4 substantial paragraphs.";
      userPrompt = `Interpret these statistical test results in detail for a scientific publication:\n\nChart type: ${chartType}\nColumns/Groups: ${columns?.join(", ")}\n\nTest Results:\n${JSON.stringify(testResults, null, 2)}\n\n${descriptiveStats ? `Descriptive Statistics:\n${JSON.stringify(descriptiveStats, null, 2)}` : ""}\n\nTone: ${tone || "detailed"}\n\nProvide a comprehensive, publication-ready interpretation. Structure your response as follows:\n\n1. OVERVIEW: What was compared, the research question addressed, and the experimental design implied by the data\n2. STATISTICAL ANALYSIS: The test used, why it was appropriate for this data structure, key statistics (test statistic, degrees of freedom, p-value, confidence intervals)\n3. EFFECT SIZE & PRACTICAL SIGNIFICANCE: Cohen's d or equivalent, whether the effect is small/medium/large, and what this means practically\n4. INTERPRETATION: Plain-English conclusion of what the results mean biologically/scientifically. What can and cannot be concluded.\n5. LIMITATIONS & CAVEATS: Sample size considerations, assumption violations, potential confounders, and suggestions for follow-up\n\nBe thorough — researchers will use this directly in their manuscripts.`;
    } else if (mode === "legend") {
      systemPrompt = "You are a scientific writing specialist. Generate detailed, publication-ready figure legends following top-tier journal standards (Nature, Science, Cell). Be comprehensive — include all statistical details, sample sizes, error bar definitions, and significance markers. Write 2-3 paragraphs.";
      userPrompt = `Generate a detailed, publication-ready figure legend for this chart:\n\nChart type: ${chartType}\nColumns/Groups: ${columns?.join(", ")}\n\nTest Results:\n${JSON.stringify(testResults, null, 2)}\n\n${descriptiveStats ? `Descriptive Statistics:\n${JSON.stringify(descriptiveStats, null, 2)}` : ""}\n\nTone: ${tone || "detailed"}\n\nGenerate a comprehensive figure legend with:\n1. Figure title (descriptive, not just "Figure X")\n2. Detailed description of what the figure shows, including axes, groups, and data representation\n3. How data are presented (mean ± SEM, mean ± SD, individual data points, etc.) with exact n per group\n4. Statistical test used, with full results (test statistic, df, p-value)\n5. Definition of significance markers: *p < 0.05, **p < 0.01, ***p < 0.001, ns = not significant\n6. Any additional notes about data processing or exclusion criteria if implied by the data\n\nWrite at least 2 detailed paragraphs.`;
    } else {
      throw new Error('Invalid mode. Use "explain" or "legend".');
    }

    let generatedText = "";

    // Try Anthropic first, fall back to Gemini
    if (ANTHROPIC_API_KEY) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      const result = await response.json();
      // Surface the actual API error instead of silently falling through to
      // "AI returned empty response". Anthropic errors arrive as
      // { type: "error", error: { type, message } } on non-2xx responses.
      if (!response.ok || result.error) {
        const apiMessage = result.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
        console.error('Anthropic API error:', result);
        throw new Error(`Anthropic API error: ${apiMessage}`);
      }
      generatedText = result.content?.[0]?.text || "";
    } else if (GEMINI_API_KEY) {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: "POST",
          headers: {
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
          }),
        }
      );
      const result = await response.json();
      if (result.error) throw new Error(result.error.message || "Gemini API error");
      generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      throw new Error("No AI API key configured");
    }

    if (!generatedText) throw new Error("AI returned empty response");

    // Record usage
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      await supabase.from('ai_generation_usage').insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        month_year: currentMonth,
        prompt: `Chart Studio ${mode}: ${chartType}`,
        style: mode,
        generation_type: 'figure',
      });
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({ text: generatedText, mode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Return 200 with { error } so supabase-js doesn't collapse the body
    // into "Edge Function returned a non-2xx status code". The frontend
    // already branches on data?.error and toasts the real message.
    console.error('chart-studio-ai handler error:', error);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
