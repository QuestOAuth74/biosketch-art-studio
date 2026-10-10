import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_TOOLS = new Set([
  'pedigree', 'codons', 'gantt', 'smiles',
  'molecular-weight', 'buffer-calculator', 'latex', 'heatmap',
  'dilution-calculator', 'punnett-square', 'phylo-tree', 'gel-electrophoresis',
  'unit-converter', 'dna-tools', 'plasmid-viewer', 'volcano-plot', 'dose-response',
  'kaplan-meier', 'enzyme-kinetics', 'scatter-plot', 'chromosome-ideogram',
  'protein-domains',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tool_id } = await req.json();

    if (!tool_id || !VALID_TOOLS.has(tool_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid tool_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.rpc('increment_tool_visit', { p_tool_id: tool_id });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
