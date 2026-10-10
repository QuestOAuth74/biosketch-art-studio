import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ terms: [query || ""] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ terms: [query] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = "You are a scientific terminology expert. Given the search query below, return a JSON array of 15-20 related scientific terms that a user might be looking for when searching a scientific illustration platform. Be VERY thorough with connections:\n\n- Direct synonyms (nerve → neuron, axon)\n- Parent/child terms (neurology → neuron, synapse, brain)\n- Related structures (cell membrane → phospholipid, lipid bilayer)\n- Functional associations (photosynthesis → chloroplast, light reactions)\n- Common abbreviations and full forms (DNA → deoxyribonucleic acid)\n- Singular AND plural forms (neuron, neurons)\n- Related research fields and techniques\n- What a researcher would title their figure about this topic\n\nCast a WIDE net — it's better to include loosely related terms than to miss relevant results. Only return the JSON array, nothing else. Query: " + query;

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      }
    );

    if (!res.ok) {
      return new Response(
        JSON.stringify({ terms: [query] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const terms = JSON.parse(match[0]) as string[];
      // Always include original query first
      const unique = [query, ...terms.filter((t: string) => t.toLowerCase() !== query.toLowerCase())];
      return new Response(
        JSON.stringify({ terms: unique }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ terms: [query] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ terms: [], error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
