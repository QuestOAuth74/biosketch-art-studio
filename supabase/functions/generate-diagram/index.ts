import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  deductGeneration,
  deductGenerationsBatch,
  refundGeneration,
  refundGenerations,
  insufficientCreditsResponse,
  waitingPeriodResponse,
} from '../_shared/aiCredits.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLOWCHART_PROMPT = `You are a scientific diagram expert that generates publication-quality flowcharts. Before generating, mentally plan the key entities, relationships, and logical groupings. Then produce valid JSON.

RULES:
- Return ONLY valid JSON. No markdown fences, no backticks, no extra text.
- Keep labels SHORT: 2-4 words per node label (e.g. "RAF Kinase" not "RAF Kinase Enzyme That Phosphorylates MEK").
- Keep edge labels to 1-2 words (e.g. "activates" not "activates through phosphorylation").
- Use 8-20 nodes. More is better for complex topics.
- Every node ID must be unique and simple (letters/numbers only).
- CRITICAL VALIDATION: Every "from" and "to" in edges MUST exactly match a node "id". Every subgraph nodeId MUST match a node "id". Double-check this before returning.
- Use subgraphs to group related nodes into logical compartments.

OUTPUT FORMAT:
{
  "title": "Diagram Title",
  "direction": "TB",
  "nodes": [
    { "id": "A", "label": "Short Label", "shape": "rect" }
  ],
  "edges": [
    { "from": "A", "to": "B", "label": "connects" }
  ],
  "subgraphs": [
    { "title": "Group Name", "nodeIds": ["A"] }
  ]
}

NODE SHAPES (use variety — not all rect):
- "rect" — processes, proteins, enzymes, steps
- "rounded" — start/end points, signals, triggers
- "diamond" — decisions, checkpoints, quality control
- "circle" — events, molecules, ions
- "stadium" — inputs, outputs, results
- "hexagon" — special structures, organelles

LABELING RULES:
- Node labels: max 20 characters. Use abbreviations for long names (e.g. "RTK" not "Receptor Tyrosine Kinase").
- Edge labels: max 15 characters. Use verbs (e.g. "phosphorylates", "activates", "inhibits", "binds").
- Title: descriptive but under 40 characters.
- Use proper scientific nomenclature.

EXAMPLE 1 - "cell signaling pathway":
{
  "title": "EGFR-MAPK Signaling",
  "direction": "TB",
  "nodes": [
    { "id": "EGF", "label": "EGF Ligand", "shape": "rounded" },
    { "id": "EGFR", "label": "EGFR", "shape": "rect" },
    { "id": "GRB2", "label": "GRB2", "shape": "rect" },
    { "id": "SOS", "label": "SOS", "shape": "rect" },
    { "id": "RAS", "label": "RAS-GTP", "shape": "rect" },
    { "id": "RAF", "label": "RAF", "shape": "rect" },
    { "id": "MEK", "label": "MEK1/2", "shape": "rect" },
    { "id": "ERK", "label": "ERK1/2", "shape": "rect" },
    { "id": "TF", "label": "Transcription", "shape": "rounded" },
    { "id": "GENE", "label": "Gene Expression", "shape": "stadium" }
  ],
  "edges": [
    { "from": "EGF", "to": "EGFR", "label": "binds" },
    { "from": "EGFR", "to": "GRB2", "label": "recruits" },
    { "from": "GRB2", "to": "SOS" },
    { "from": "SOS", "to": "RAS", "label": "activates" },
    { "from": "RAS", "to": "RAF" },
    { "from": "RAF", "to": "MEK", "label": "phosphorylates" },
    { "from": "MEK", "to": "ERK", "label": "phosphorylates" },
    { "from": "ERK", "to": "TF", "label": "translocates" },
    { "from": "TF", "to": "GENE", "label": "activates" }
  ],
  "subgraphs": [
    { "title": "Extracellular", "nodeIds": ["EGF"] },
    { "title": "Membrane", "nodeIds": ["EGFR"] },
    { "title": "Cytoplasm", "nodeIds": ["GRB2", "SOS", "RAS", "RAF", "MEK", "ERK"] },
    { "title": "Nucleus", "nodeIds": ["TF", "GENE"] }
  ]
}

EXAMPLE 2 - "PCR workflow":
{
  "title": "PCR Protocol",
  "direction": "TB",
  "nodes": [
    { "id": "DNA", "label": "Template DNA", "shape": "rounded" },
    { "id": "DEN", "label": "Denature 95C", "shape": "rect" },
    { "id": "ANN", "label": "Anneal 55C", "shape": "rect" },
    { "id": "EXT", "label": "Extend 72C", "shape": "rect" },
    { "id": "CYC", "label": "30 Cycles?", "shape": "diamond" },
    { "id": "GEL", "label": "Gel Analysis", "shape": "rect" },
    { "id": "RES", "label": "Result", "shape": "stadium" }
  ],
  "edges": [
    { "from": "DNA", "to": "DEN", "label": "heat" },
    { "from": "DEN", "to": "ANN", "label": "cool" },
    { "from": "ANN", "to": "EXT", "label": "polymerase" },
    { "from": "EXT", "to": "CYC" },
    { "from": "CYC", "to": "DEN", "label": "repeat" },
    { "from": "CYC", "to": "GEL", "label": "done" },
    { "from": "GEL", "to": "RES" }
  ],
  "subgraphs": [
    { "title": "Thermocycler", "nodeIds": ["DEN", "ANN", "EXT", "CYC"] }
  ]
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Please sign in to use AI generation' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Get user from JWT (same pattern as working generate-icon-from-reference)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await anonClient.auth.getUser(jwt);

    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Authentication failed. Please sign in again.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, mode } = await req.json();
    if (!prompt || typeof prompt !== 'string' || prompt.length > 500) {
      return new Response(JSON.stringify({ error: 'Invalid prompt (max 500 characters)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isIllustrationMode = mode === 'illustration';

    // Service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if admin (bypass limits)
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    const isAdmin = !!adminRole;

    if (!isAdmin) {
      // Check premium status (3+ approved public projects)
      const { data: projects } = await supabase
        .from('canvas_projects')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_public', true)
        .eq('approval_status', 'approved');

      const isPremium = (projects?.length || 0) >= 3;

      // Non-premium users cannot use the AI Diagram Generator
      if (!isPremium) {
        return new Response(JSON.stringify({
          error: 'AI Diagram Generator is a premium feature. Share and get 3 projects approved to unlock it.',
          premium_required: true,
        }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Premium users: 3 per week (resets Monday)
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
      monday.setUTCHours(0, 0, 0, 0);
      const periodStart = monday.toISOString();

      const { count } = await supabase
        .from('diagram_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', periodStart);

      const limit = 3;
      const used = count || 0;

      if (used >= limit) {
        return new Response(JSON.stringify({
          error: `Generation limit reached (${limit} per week). Resets next Monday.`,
          limit_reached: true,
        }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Call Gemini API with timeout
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in secrets');
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    supabaseForRefund = supabase;
    try {
      const dr = await deductGeneration(supabase, user.id, 'generate-diagram');
      if (dr.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (dr.status === 'waiting') return waitingPeriodResponse(dr.unlockAt, corsHeaders);
      const gid = dr.id;
      creditIds = [gid];
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    // For illustration mode, fetch available icon names from database
    let illustrationPrompt = '';
    if (isIllustrationMode) {
      const { data: icons } = await supabase
        .from('icons')
        .select('name')
        .eq('category', 'ai-icons')
        .order('name');

      const iconNames = icons?.map((i: any) => i.name).join(', ') || '';

      illustrationPrompt = `You are a scientific illustration composer. You arrange pre-made icons to create clean, textbook-quality biological figures. Focus on SPATIAL ARRANGEMENT — let the icons tell the story through their position, not through excessive arrows.

AVAILABLE ICONS (use EXACT names from this list):
${iconNames}

RULES:
- Return ONLY valid JSON. No markdown, no backticks, no explanation.
- Use 5-12 icons. Pick ONLY the most relevant ones — quality over quantity.
- Do NOT add icons that are not directly relevant to the topic.
- Arrange icons spatially to show the biological context (e.g., organelles inside a cell, layers of a membrane).
- Use VERY FEW arrows — only 2-4 arrows for the MAIN process flow. NOT every relationship needs an arrow.
- Let proximity and position show relationships (adjacent icons are related).
- Labels should be SHORT (1-3 words).
- Choose the CLOSEST matching icon name. Use EXACT names from the list.

OUTPUT FORMAT:
{
  "title": "Figure Title",
  "icons": [
    { "name": "EXACT NAME", "row": 0, "col": 1, "label": "Short Label", "scale": 0.4 }
  ],
  "arrows": [
    { "fromIndex": 0, "toIndex": 1, "label": "verb" }
  ],
  "labels": [
    { "text": "Section Title", "row": 0, "col": 0, "fontSize": 18, "bold": true }
  ]
}

LAYOUT PRINCIPLES:
- Grid: 4 columns, up to 5 rows. row 0 = top, col 0 = left.
- scale: 0.35-0.45 for most icons.
- Group related icons in the same row or adjacent cells.
- Use spatial logic: top = extracellular, middle = membrane, bottom = intracellular.
- Only use arrows for the MAIN directional flow (max 2-4 arrows total).
- Use labels to section the figure, not arrows.

EXAMPLE for "immune response":
{
  "title": "Innate Immune Response",
  "icons": [
    { "name": "Icons Influenza Virus", "row": 0, "col": 2, "label": "Pathogen", "scale": 0.4 },
    { "name": "Icons Dendritic Cell Squeezing Editable", "row": 1, "col": 1, "label": "Dendritic Cell", "scale": 0.4 },
    { "name": "Icons Phagocytosing Macrophage", "row": 1, "col": 3, "label": "Macrophage", "scale": 0.4 },
    { "name": "T Cell", "row": 2, "col": 1, "label": "T Cell", "scale": 0.4 },
    { "name": "B Cell", "row": 2, "col": 3, "label": "B Cell", "scale": 0.4 },
    { "name": "Immunoglobulin", "row": 3, "col": 2, "label": "Antibodies", "scale": 0.35 }
  ],
  "arrows": [
    { "fromIndex": 0, "toIndex": 1, "label": "detected by" },
    { "fromIndex": 1, "toIndex": 3, "label": "activates" },
    { "fromIndex": 3, "toIndex": 4, "label": "signals" }
  ],
  "labels": [
    { "text": "Innate Immune Response", "row": 0, "col": 0, "fontSize": 18, "bold": true }
  ]
}`;
    }

    const activePrompt = isIllustrationMode
      ? `${illustrationPrompt}\n\nCreate an illustration for: ${prompt}`
      : `${FLOWCHART_PROMPT}\n\nCreate a flowchart diagram for: ${prompt}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s for illustration mode

    let geminiResponse;
    try {
      geminiResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: activePrompt }],
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
            },
          }),
          signal: controller.signal,
        }
      );
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (creditIds.length > 0) {
        await refundGenerations(supabase, creditIds);
      }
      if (fetchErr.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'AI generation timed out. Please try a simpler prompt.' }), {
          status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('Gemini fetch error:', fetchErr.message);
      return new Response(JSON.stringify({ error: 'Failed to reach AI service. Please try again.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    clearTimeout(timeout);

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errText);
      if (creditIds.length > 0) {
        await refundGenerations(supabase, creditIds);
      }
      return new Response(JSON.stringify({ error: `AI generation failed (${geminiResponse.status}). Please try again.` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error('Empty Gemini response:', JSON.stringify(geminiData).slice(0, 500));
      if (creditIds.length > 0) {
        await refundGenerations(supabase, creditIds);
      }
      return new Response(JSON.stringify({ error: 'Empty response from AI. Please try again.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isIllustrationMode) {
      // Parse JSON illustration layout
      let layout;
      try {
        let jsonText = responseText.trim();
        const jsonFence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonFence) jsonText = jsonFence[1].trim();
        layout = JSON.parse(jsonText);
      } catch {
        console.error('Failed to parse illustration JSON:', responseText.slice(0, 500));
        if (creditIds.length > 0) {
          await refundGenerations(supabase, creditIds);
        }
        return new Response(JSON.stringify({ error: 'AI returned invalid format. Please try again.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!layout?.icons || !Array.isArray(layout.icons) || layout.icons.length === 0) {
        if (creditIds.length > 0) {
          await refundGenerations(supabase, creditIds);
        }
        return new Response(JSON.stringify({ error: 'AI returned no icons. Please try again.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch SVG content for each requested icon
      const iconNames = layout.icons.map((i: any) => i.name);
      const { data: iconRows } = await supabase
        .from('icons')
        .select('id, name, svg_content')
        .in('name', iconNames);

      const iconMap: Record<string, any> = {};
      (iconRows || []).forEach((row: any) => { iconMap[row.name] = row; });

      // Attach SVG content to each layout icon
      layout.icons = layout.icons.map((i: any) => ({
        ...i,
        iconId: iconMap[i.name]?.id || null,
        svgContent: iconMap[i.name]?.svg_content || null,
        found: !!iconMap[i.name],
      }));

      try {
        await supabase.from('diagram_generations').insert({
          user_id: user.id, prompt,
          object_count: layout.icons.length,
        });
      } catch {}

      return new Response(JSON.stringify({ illustration: layout }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Flowchart mode — extract and parse JSON graph
    let graph;
    try {
      let jsonText = responseText.trim();
      // Try markdown fence first
      const jsonFence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonFence) jsonText = jsonFence[1].trim();
      // Try to find JSON object if there's text before/after
      if (!jsonText.startsWith('{')) {
        const braceStart = jsonText.indexOf('{');
        const braceEnd = jsonText.lastIndexOf('}');
        if (braceStart >= 0 && braceEnd > braceStart) {
          jsonText = jsonText.slice(braceStart, braceEnd + 1);
        }
      }
      graph = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('Failed to parse flowchart JSON:', responseText.slice(0, 800));
      if (creditIds.length > 0) {
        await refundGenerations(supabase, creditIds);
      }
      return new Response(JSON.stringify({ error: 'AI returned invalid format. Please try again.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!graph?.nodes || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      if (creditIds.length > 0) {
        await refundGenerations(supabase, creditIds);
      }
      return new Response(JSON.stringify({ error: 'AI returned empty diagram. Please try again.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      await supabase.from('diagram_generations').insert({
        user_id: user.id, prompt,
        object_count: graph.nodes.length,
      });
    } catch {}

    return new Response(JSON.stringify({ graph }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('generate-diagram unhandled error:', err.message, err.stack);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }
    return new Response(JSON.stringify({ error: `Generation failed: ${err.message || 'Unknown error'}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
