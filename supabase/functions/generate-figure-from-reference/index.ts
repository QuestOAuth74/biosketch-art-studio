import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import {
  deductGeneration,
  deductGenerationsBatch,
  refundGeneration,
  refundGenerations,
  insufficientCreditsResponse,
  waitingPeriodResponse,
} from '../_shared/aiCredits.ts';

// Helper function to call Lovable AI with timeout protection
async function callLovableAIWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 45000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - AI analysis taking too long');
    }
    throw error;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize relationship types to canonical forms
function normalizeRelationship(relType: string | undefined): string {
  if (!relType || typeof relType !== 'string') {
    console.log('⚠️ Invalid relationship type:', relType, '- defaulting to "source"');
    return 'source'; // Safe default
  }
  
  const normalized = relType.toLowerCase().trim();
  
  // Synonym mapping
  const synonyms: Record<string, string> = {
    'activate': 'activates',
    'activated': 'activates',
    'activation': 'activates',
    'inhibit': 'inhibits',
    'inhibited': 'inhibits',
    'inhibition': 'inhibits',
    'produce': 'produces',
    'produced': 'produces',
    'production': 'produces',
    'convert': 'converts',
    'converted': 'converts',
    'conversion': 'converts',
    'bind': 'binds_to',
    'binds': 'binds_to',
    'binding': 'binds_to',
    'bound': 'binds_to',
    'flow': 'flows_to',
    'flows': 'flows_to',
    'signal': 'signals',
    'signaling': 'signals',
    'signalling': 'signals',
  };
  
  return synonyms[normalized] || normalized;
}

// Categorize relationship for pathway-aware styling
function categorizeRelationship(relType: string | undefined): string {
  const normalized = normalizeRelationship(relType);
  
  // Category mapping
  if (['produces', 'converts'].includes(normalized)) return 'main_pathway';
  if (['source'].includes(normalized)) return 'source';
  if (['binds_to'].includes(normalized)) return 'receptor_binding';
  if (['activates', 'inhibits', 'signals'].includes(normalized)) return 'effect';
  
  return 'main_pathway'; // Default
}

// Get connector style based on relationship type and category
function getConnectorStyle(relType: string | undefined, visualDetails?: any): any {
  const normalized = normalizeRelationship(relType);
  const category = categorizeRelationship(relType);
  
  // Base style map with pathway-aware styling
  const styleMap: Record<string, any> = {
    'activates': { style: 'solid', color: '#00AA00', endMarker: 'arrow', strokeWidth: 2, category: 'effect' },
    'inhibits': { style: 'dashed', color: '#FF0000', endMarker: 'tee', strokeWidth: 2, category: 'effect' },
    'produces': { style: 'solid', color: '#333333', endMarker: 'arrow', strokeWidth: 2, category: 'main_pathway' },
    'converts': { style: 'solid', color: '#333333', endMarker: 'arrow', strokeWidth: 2, category: 'main_pathway' },
    'binds_to': { style: 'solid', color: '#666666', endMarker: 'diamond', strokeWidth: 2, category: 'receptor_binding' },
    'flows_to': { style: 'solid', color: '#000000', endMarker: 'arrow', strokeWidth: 2, category: 'main_pathway' },
    'signals': { style: 'solid', color: '#FF6600', endMarker: 'arrow', strokeWidth: 1.5, category: 'effect' },
    'source': { style: 'dashed', color: '#666666', endMarker: 'arrow', strokeWidth: 1, category: 'source' },
  };
  
  const baseStyle = styleMap[normalized] || { style: 'solid', color: '#000000', endMarker: 'arrow', strokeWidth: 2, category: 'main_pathway' };
  
  // Use straight routing for biological pathways (cleaner, more accurate)
  let routingType = 'straight';
  
  return {
    type: routingType,
    ...baseStyle,
    relationship_category: category
  };
}

// Robust JSON extraction with multiple fallback strategies
function extractJSON(text: string): any {
  // Strategy 1: Try parsing raw text
  try {
    return JSON.parse(text);
  } catch {}
  
  // Strategy 2: Look for markdown code blocks
  const markdownMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (markdownMatch) {
    try {
      return JSON.parse(markdownMatch[1]);
    } catch {}
  }
  
  // Strategy 3: Find JSON object boundaries more carefully
  const jsonMatch = text.match(/\{(?:[^{}]|(\{(?:[^{}]|(\{[^{}]*\}))*\}))*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }
  
  // Strategy 4: Remove common prefixes and try again
  const cleaned = text
    .replace(/^[^{]*/, '') // Remove everything before first {
    .replace(/[^}]*$/, ''); // Remove everything after last }
  
  if (cleaned) {
    try {
      return JSON.parse(cleaned);
    } catch {}
  }
  
  return null;
}

// Attempt to repair truncated JSON by balancing brackets/braces and removing trailing commas
function tryRepairJsonString(input: string): any | null {
  // Quick bailouts
  if (!input || typeof input !== 'string') return null;

  const removeTrailingCommas = (s: string) => s.replace(/,\s*(?=[}\]])/g, '');

  try {
    return JSON.parse(input);
  } catch {}

  // Enhanced repair logic for connector-specific truncation patterns
  let repaired = input.trim();
  
  // Remove incomplete property at the end (common truncation pattern)
  // Example: {"connectors":[{...},{...},{"from_element":5,"to_el
  repaired = repaired.replace(/,?\s*"[^"]*$/, ''); // Remove incomplete string key
  repaired = repaired.replace(/,?\s*[^,\}\]]*$/, ''); // Remove incomplete value
  
  // Balance brackets/braces using a simple stack
  const stack: string[] = [];
  const openers = new Set(['{', '[']);
  const pairs: Record<string, string> = { '{': '}', '[': ']' };

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (openers.has(ch)) {
      stack.push(ch);
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0) stack.pop();
    }
  }

  // Remove trailing dangling characters
  repaired = removeTrailingCommas(repaired);
  repaired = repaired.replace(/[,\s]*$/, '');

  // Append missing closers in reverse order
  while (stack.length > 0) {
    const opener = stack.pop()!;
    repaired += pairs[opener];
  }

  // Final cleanup and parse attempt
  repaired = removeTrailingCommas(repaired);
  try {
    const parsed = JSON.parse(repaired);
    // Validate that we have a connectors array
    if (parsed && parsed.connectors && Array.isArray(parsed.connectors)) {
      console.log(`✓ Successfully repaired JSON with ${parsed.connectors.length} connectors`);
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tracked outside the try so the top-level catch can refund.
  let creditIds: string[] = [];
  let supabaseForRefund: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { image, description, canvasWidth, canvasHeight, strict = false } = await req.json();

    // Atomically reserve a generation credit before AI processing
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: reserveData, error: reserveError } = await supabaseAdmin
      .rpc('reserve_generation', {
        _user_id: user.id,
        _prompt: description || 'AI Figure Generation',
        _style: 'figure_generation',
        _generation_type: 'figure',
      });

    if (reserveError) {
      console.error('Error reserving generation:', reserveError);
      return new Response(
        JSON.stringify({ error: 'Failed to check generation quota' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reserveData.reserved) {
      const errorType = reserveData.error;
      if (errorType === 'PREMIUM_REQUIRED') {
        const remaining = reserveData.needsApproved || 3;
        return new Response(
          JSON.stringify({
            error: 'PREMIUM_REQUIRED',
            message: `Share ${remaining} more approved project${remaining !== 1 ? 's' : ''} to unlock AI Figure Generator`,
            remaining,
            approvedCount: reserveData.approvedCount || 0
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (errorType === 'RATE_LIMIT_EXCEEDED') {
        return new Response(
          JSON.stringify({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Monthly generation limit reached. Resets on the 1st of each month.',
            used: reserveData.used,
            limit: reserveData.limit,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Generation not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reservationId: string = reserveData.reservationId;
    let figureGenerationSucceeded = false;

    if (!image) {
      // Release reservation for bad input
      await supabaseAdmin.rpc('release_generation_reservation', { _reservation_id: reservationId }).catch(() => {});
      return new Response(JSON.stringify({ error: 'Image is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AI credit deduction (see supabase/functions/_shared/aiCredits.ts)
    supabaseForRefund = supabaseAdmin;
    try {
      const dr = await deductGeneration(supabaseAdmin, user.id, 'generate-figure-from-reference');
      if (dr.status === 'insufficient') return insufficientCreditsResponse(corsHeaders);
      if (dr.status === 'waiting') return waitingPeriodResponse(dr.unlockAt, corsHeaders);
      const gid = dr.id;
      creditIds = [gid];
    } catch (err) {
      console.error('Credit deduction failed:', err);
      throw err;
    }

    try {

    console.log('Starting AI analysis...');

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      if (creditIds.length > 0) {
        await refundGenerations(supabaseAdmin, creditIds);
      }
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 0: PASS 0 - High-Level Diagram Description
    console.log('[PROGRESS] diagram_description | 0% | Analyzing overall diagram structure...');
    console.log(`[TIMING] Pass 0 started: ${new Date().toISOString()}`);
    const pass0Start = Date.now();
    
    const descriptionSystemPrompt = `You are a scientific diagram analysis expert. PASS 0: Generate a comprehensive textual description of this diagram.

Analyze the diagram and provide a structured description covering:

1. DIAGRAM TYPE: Identify the structural pattern
   - Linear pathway (A→B→C)
   - Hub-and-spoke (central node with multiple branches)
   - Cyclic/feedback loop
   - Hierarchical tree
   - Matrix/grid layout
   - Multi-column comparison
   - Other (describe)

2. MAIN CONCEPT: What biological/scientific process is being illustrated?

3. ELEMENT COUNT: Approximate number of:
   - Text boxes/shapes with labels
   - Icons/symbols
   - Arrows/connectors

4. STRUCTURAL PATTERNS:
   - Flow direction (top-down, left-right, radial, etc.)
   - Grouping (columns, rows, clusters)
   - Visual hierarchy (which elements are primary/secondary)

5. CONNECTOR PATTERNS:
   - Main pathway description
   - Branch/side-effect patterns
   - Convergence/divergence points
   - Any feedback loops

6. KEY ELEMENTS (in order of importance):
   - List the 5-10 most important labeled elements
   - Note their approximate positions (top-left, center, bottom-right, etc.)

7. SPECIAL FEATURES:
   - Any unusual visual elements
   - Color coding patterns
   - Label placement conventions

Return a clear, detailed description that will help subsequent analysis passes understand the diagram's intent and structure.`;

    const descriptionUserPrompt = description 
      ? `PASS 0 - Describe this scientific diagram in detail. User context: "${description}"`
      : `PASS 0 - Describe this scientific diagram in detail, focusing on structure and key elements.`;

    let diagramDescription = '';
    
    try {
      const descriptionResponse = await callLovableAIWithTimeout(
        'https://ai.gateway.lovable.dev/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: descriptionSystemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: descriptionUserPrompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.3,
          }),
        },
        45000
      );

      if (!descriptionResponse.ok) {
        const errorText = await descriptionResponse.text();
        console.error('❌ Pass 0 Lovable AI error:', descriptionResponse.status, errorText);
        console.log('⚠️ Proceeding without diagram description');
      } else {
        const descriptionData = await descriptionResponse.json();
        diagramDescription = descriptionData.choices?.[0]?.message?.content || '';
        const pass0Duration = Date.now() - pass0Start;
        console.log(`[TIMING] Pass 0 completed: ${new Date().toISOString()} (duration: ${pass0Duration}ms)`);
        console.log('[PROGRESS] diagram_description | 100% | Description complete');
        console.log('📝 Diagram Description:\n', diagramDescription);
      }
    } catch (error) {
      console.error('❌ Pass 0 failed:', error);
      console.log('⚠️ Proceeding without diagram description');
    }

    // STEP 1A: PASS 1 - Element Detection & Precise Positioning
    console.log('[PROGRESS] element_detection | 0% | Starting element analysis...');
    console.log('Pass 1: Analyzing elements and positions...');
    console.log(`[TIMING] Pass 1 started: ${new Date().toISOString()}`);
    const pass1Start = Date.now();
    
    // Phase 5: Use image size heuristic instead of AI pre-check (saves 500 tokens)
    let useChunkedMode = false; // Removed chunking mode for simplicity
    let elementCount = 0; // No longer doing pre-count
    
    console.log('[PROGRESS] element_detection | 10% | Starting detailed analysis...');
    
    const elementSystemPrompt = `You are a scientific illustration analysis expert. PASS 1: Analyze elements MINIMAL OUTPUT.

CONTEXT FROM PREVIOUS ANALYSIS:
${diagramDescription ? `\n${diagramDescription}\n` : 'No prior context available.'}

ULTRA-COMPACT JSON REQUIRED. Use SHORT property names:

{
  "e": [
    {
      "n": "name",
      "t": "shape|icon",
      "s": "rect|circle|oval",
      "x": 45.5,
      "y": 30.2,
      "txt": "text visible inside shape (shapes only)",
      "st": ["search", "terms"]
    }
  ]
}

RULES:
- "n" (name): Element name or label text
- "t" (type): "shape" for geometric shapes with text, "icon" for biological/scientific elements
- "s" (shape): ONLY if t="shape". Values: "rect", "circle", "oval"
- "x" (position_x): Horizontal position 0-100%
- "y" (position_y): Vertical position 0-100%
- "txt" (text): ONLY for shapes - actual visible text content
- "st" (search_terms): ONLY for icons - ["specific", "broader", "category"]

CRITICAL LIMITS:
- MAX ${useChunkedMode ? '20' : '40'} elements ${useChunkedMode ? 'in this batch' : 'total'}
- OMIT all optional fields
- NO descriptions, colors, bounding boxes, or extra metadata
- Position accuracy ±2% is critical
- Search terms: most specific first, max 4 terms per icon`;

    const elementUserPrompt = description 
      ? `PASS 1 - Analyze elements and positions in this diagram. User description: "${description}"${useChunkedMode ? ' Return first 20 elements (top-left to center region).' : ''}`
      : `PASS 1 - Analyze all elements and their precise positions.${useChunkedMode ? ' Return first 20 elements (top-left to center region).' : ''}`;

    console.log('[PROGRESS] element_detection | 20% | Analyzing batch 1...');

    const elementResponse = await callLovableAIWithTimeout(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: elementSystemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: elementUserPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                  }
                }
              ]
            }
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'return_element_analysis',
                description: 'Return ultra-compact element analysis',
                parameters: {
                  type: 'object',
                  properties: {
                    e: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          n: { type: 'string' },
                          t: { type: 'string', enum: ['shape', 'icon'] },
                          s: { type: 'string', enum: ['rect', 'circle', 'oval'] },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          txt: { type: 'string' },
                          st: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['n', 't', 'x', 'y']
                      }
                    }
                  },
                  required: ['e']
                }
              }
            }
          ],
          tool_choice: { type: 'function', function: { name: 'return_element_analysis' } },
          max_tokens: 8000,
        }),
      },
      45000
    );

    if (!elementResponse.ok) {
      const errorText = await elementResponse.text();
      console.error('Pass 1 Lovable AI error:', elementResponse.status, errorText);
      
      let errorMsg = 'Element analysis failed';
      if (elementResponse.status === 429) {
        errorMsg = 'Rate limit exceeded. Please try again later or add credits to your Lovable AI workspace.';
      } else if (elementResponse.status === 402) {
        errorMsg = 'AI credits depleted. Please add credits in Settings → Workspace → Usage.';
      } else if (elementResponse.status === 401) {
        errorMsg = 'Lovable API key is invalid or missing';
      }
      
      if (creditIds.length > 0) {
        await refundGenerations(supabaseAdmin, creditIds);
      }
      return new Response(JSON.stringify({
        error: errorMsg,
        details: `Lovable AI returned ${elementResponse.status}`,
        hint: 'Check edge function logs for details'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const elementData = await elementResponse.json();
    console.log('Pass 1 complete');
    
    // Extract JSON from function call arguments (priority), then content (fallback)
    let elementAnalysis = null;
    let parseFailedDueToTruncation = false;
    
    // Strategy 1: Extract from tool_calls (primary for function calling)
    if (elementData.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        const args = elementData.choices[0].message.tool_calls[0].function.arguments;
        const parsed = typeof args === 'string' ? JSON.parse(args) : args;
        // Normalize ultra-compact format to standard format
        elementAnalysis = {
          identified_elements: (parsed.e || []).map((el: any) => ({
            name: el.n,
            element_type: el.t,
            shape_type: el.s,
            position_x: el.x,
            position_y: el.y,
            text_content: el.txt,
            search_terms: el.st
          })),
          spatial_analysis: {},
          overall_layout: {}
        };
        console.log('✓ Extracted from tool_calls (ultra-compact)');
      } catch (e) {
        console.log('Failed to parse tool_calls arguments:', e);
        // Attempt repair of truncated JSON from tool_calls
        const argStr = elementData.choices[0]?.message?.tool_calls?.[0]?.function?.arguments;
        const repaired = typeof argStr === 'string' ? tryRepairJsonString(argStr) : null;
        if (repaired && repaired.e) {
          elementAnalysis = {
            identified_elements: (repaired.e || []).map((el: any) => ({
              name: el.n,
              element_type: el.t,
              shape_type: el.s,
              position_x: el.x,
              position_y: el.y,
              text_content: el.txt,
              search_terms: el.st
            })),
            spatial_analysis: {},
            overall_layout: {}
          };
          parseFailedDueToTruncation = false;
          console.log('✓ Repaired truncated JSON from tool_calls');
        } else {
          parseFailedDueToTruncation = true; // Likely truncated JSON
        }
      }
    }
    
    // Strategy 2: Extract from legacy function_call (secondary)
    if (!elementAnalysis && elementData.choices[0]?.message?.function_call?.arguments) {
      try {
        const args = elementData.choices[0].message.function_call.arguments;
        const parsed = typeof args === 'string' ? JSON.parse(args) : args;
        elementAnalysis = {
          identified_elements: (parsed.e || []).map((el: any) => ({
            name: el.n,
            element_type: el.t,
            shape_type: el.s,
            position_x: el.x,
            position_y: el.y,
            text_content: el.txt,
            search_terms: el.st
          })),
          spatial_analysis: {},
          overall_layout: {}
        };
        console.log('✓ Extracted from function_call (ultra-compact)');
      } catch (e) {
        console.log('Failed to parse function_call arguments:', e);
        const argStr = elementData.choices[0]?.message?.function_call?.arguments;
        const repaired = typeof argStr === 'string' ? tryRepairJsonString(argStr) : null;
        if (repaired && repaired.e) {
          elementAnalysis = {
            identified_elements: (repaired.e || []).map((el: any) => ({
              name: el.n,
              element_type: el.t,
              shape_type: el.s,
              position_x: el.x,
              position_y: el.y,
              text_content: el.txt,
              search_terms: el.st
            })),
            spatial_analysis: {},
            overall_layout: {}
          };
          parseFailedDueToTruncation = false;
          console.log('✓ Repaired truncated JSON from function_call');
        } else {
          parseFailedDueToTruncation = true;
        }
      }
    }
    
    // Strategy 3: Extract from content (fallback)
    if (!elementAnalysis && elementData.choices[0]?.message?.content) {
      elementAnalysis = extractJSON(elementData.choices[0].message.content);
      if (elementAnalysis) {
        console.log('✓ Extracted from content');
      }
    }
    
    const pass1Duration = Date.now() - pass1Start;
    console.log(`[TIMING] Pass 1 completed: ${new Date().toISOString()} (duration: ${pass1Duration}ms)`);
    console.log('[PROGRESS] element_detection | 100% | Element analysis complete');
    
    // Phase 1: Removed chunked mode to simplify (single-pass only)

    // Retry logic for PASS 1 if we failed to extract valid JSON
    if (!elementAnalysis || !elementAnalysis.identified_elements) {
      const finishReason = elementData.choices?.[0]?.finish_reason;
      
      if (finishReason === 'length' || parseFailedDueToTruncation) {
        console.log('⚠ Pass 1 hit length limit or truncated JSON. Retrying with higher token limit...');
        console.log(`📊 Current state: Finish reason=${finishReason}, Parse failed=${parseFailedDueToTruncation}`);
        console.log(`📊 Detected element count: ${elementCount}, Using chunked mode: ${useChunkedMode}`);
        
        const retryResponse = await callLovableAIWithTimeout(
          'https://ai.gateway.lovable.dev/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { 
                  role: 'system', 
                  content: 'Return function call ONLY. No prose. Strictly minimal JSON. Analyze elements and positions precisely.' 
                },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: elementUserPrompt },
                    {
                      type: 'image_url',
                      image_url: {
                        url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                      }
                    }
                  ]
                }
              ],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'return_element_analysis',
                    description: 'Return ultra-compact element analysis',
                    parameters: {
                      type: 'object',
                      properties: {
                        e: { type: 'array' }
                      },
                      required: ['e']
                    }
                  }
                }
              ],
              tool_choice: { type: 'function', function: { name: 'return_element_analysis' } },
              max_tokens: 8000,
            }),
          },
          45000
        );
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            try {
              const args = retryData.choices[0].message.tool_calls[0].function.arguments;
              const parsed = typeof args === 'string' ? JSON.parse(args) : args;
              elementAnalysis = {
                identified_elements: (parsed.e || []).map((el: any) => ({
                  name: el.n,
                  element_type: el.t,
                  shape_type: el.s,
                  position_x: el.x,
                  position_y: el.y,
                  text_content: el.txt,
                  search_terms: el.st
                })),
                spatial_analysis: {},
                overall_layout: {}
              };
              console.log('✓ Retry successful - extracted from tool_calls (ultra-compact)');
            } catch (e) {
              console.log('Retry failed to parse tool_calls');
            }
          }
        }
      }
      
      // If still no analysis after retry
      if (!elementAnalysis || !elementAnalysis.identified_elements) {
        console.error('❌ Failed to extract element analysis after retry.');
        console.error('📊 Finish reason:', finishReason);
        console.error('📊 Element count estimate:', elementCount);
        console.error('📊 Chunked mode was:', useChunkedMode);
        console.error('📊 Response preview:', JSON.stringify(elementData).slice(0, 500));
        
        // Provide helpful user guidance based on detected issues
        let userHint = 'Try enabling strict mode, using a smaller/clearer image, or simplifying the reference.';
        let additionalInfo = '';
        
        if (elementCount > 40) {
          userHint = `Your diagram contains approximately ${elementCount} elements, which is very complex. Consider:`;
          additionalInfo = '\n• Breaking it into multiple smaller diagrams (recommended)\n• Simplifying by removing less important elements\n• Using a clearer source image with higher resolution';
        } else if (elementCount > 25) {
          userHint = `Your diagram contains approximately ${elementCount} elements. Try:`;
          additionalInfo = '\n• Using a higher quality source image\n• Ensuring elements are clearly visible and well-separated\n• Enabling strict mode for more thorough processing';
        } else if (finishReason === 'length') {
          userHint = 'The AI response was truncated. Try:';
          additionalInfo = '\n• Using a clearer, higher-contrast image\n• Ensuring the diagram is well-lit and focused\n• Reducing image complexity if possible';
        }
        
        if (creditIds.length > 0) {
          await refundGenerations(supabaseAdmin, creditIds);
        }
        return new Response(JSON.stringify({
          error: 'Element analysis incomplete',
          stage: 'element_detection',
          finish_reason: finishReason,
          detected_elements: elementCount > 0 ? elementCount : 'unknown',
          hint: userHint,
          details: additionalInfo.trim(),
          suggestion: 'Please try again with a simpler or clearer diagram.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Log successful element detection with stats
    const detectedCount = elementAnalysis.identified_elements?.length || 0;
    console.log(`✅ Element detection complete: ${detectedCount} elements identified`);
    console.log(`📊 Shapes: ${elementAnalysis.identified_elements.filter((e: any) => e.element_type === 'shape').length}`);
    console.log(`📊 Icons: ${elementAnalysis.identified_elements.filter((e: any) => e.element_type === 'icon').length}`);
    
    // Warn if detected count differs significantly from initial estimate
    if (elementCount > 0 && Math.abs(detectedCount - elementCount) > 10) {
      console.log(`⚠️ Note: Initial estimate was ${elementCount} elements, but detected ${detectedCount}. This is expected for complex diagrams.`);
    }

    // STEP 1B: PASS 2 - Deep Connector Analysis
    console.log('[PROGRESS] connector_analysis | 0% | Starting connector analysis...');
    console.log(`📊 Shapes: ${elementAnalysis.identified_elements.filter((e: any) => e.element_type === 'shape').length}`);
    console.log(`📊 Icons: ${elementAnalysis.identified_elements.filter((e: any) => e.element_type === 'icon').length}`);
    console.log(`📊 Spatial relationships: ${elementAnalysis.spatial_relationships?.length || 0}`);
    console.log('Pass 2: Analyzing connectors in detail...');
    console.log(`[TIMING] Pass 2 started: ${new Date().toISOString()}`);
    const pass2Start = Date.now();
    
    const connectorSystemPrompt = `You are a connector analysis expert. PASS 2: Analyze ONLY the connectors/arrows/lines between elements.

DIAGRAM CONTEXT:
${diagramDescription ? `\n${diagramDescription}\n` : 'No prior context available.'}

Elements identified (for reference):
${elementAnalysis.identified_elements.map((e: any, i: number) => `${i}: ${e.name} at (${e.position_x}, ${e.position_y})`).join('\n')}

Return valid JSON ONLY:
{
  "connectors": [
    {
      "from_element": 0,
      "to_element": 1,
      "relationship_type": "activates|inhibits|produces|converts|binds_to|flows_to|signals|source",
      "visual_style": {
        "line_type": "straight|curved|orthogonal|bezier",
        "line_style": "solid|dashed|dotted|double",
        "thickness": "thin|medium|thick",
        "color": "#000000"
      },
      "markers": {
        "start": "none|arrow|circle|diamond|tee",
        "end": "none|arrow|circle|diamond|tee"
      },
      "routing": {
        "path_description": "direct|curves_around|multiple_waypoints",
        "approximate_waypoints": [[x1,y1], [x2,y2]]
      },
      "label": "text on or near connector",
      "label_position": "midpoint|offset",
      "directionality": "unidirectional|bidirectional",
      "justification": "why this connection exists"
    }
  ]
}

CONNECTOR ANALYSIS REQUIREMENTS:
- Identify ALL connectors: arrows, lines, paths between elements
- Line type: CRITICAL - accurately identify if straight, curved, orthogonal (90° turns), or complex bezier
  * Straight lines are most common in hierarchical/flow diagrams
  * Only mark as curved if there is visible curvature
  * Default to straight when uncertain
- Line style: solid (━), dashed (┄), dotted (···), double (═)
- Thickness: thin (1-2px), medium (2-3px), thick (4+px)
- Markers: arrow (→), tee (⊣ for inhibition), circle (○), diamond (◊), none
- Path: does it go directly or curve around other elements?
- Labels: any text written on or near the connector
- Relationship type: use ONLY activates|inhibits|produces|converts|binds_to|flows_to|signals|source
- Color: if not black, specify hex color
- IMPORTANT: Be precise about line_type - this determines visual routing in the final diagram

WAYPOINT DETECTION (CRITICAL FOR SPATIAL ACCURACY):
For EACH connector, carefully analyze its PATH trajectory:
- Does it curve or bend? If yes, identify approximate intermediate coordinates (waypoints)
- For curved paths: detect 2-4 waypoints along the curve to preserve the shape
- For orthogonal paths with 90° bends: identify the bend points as waypoints
- For complex multi-segment arrows: capture all major turning points
- Provide waypoints as percentage coordinates [x, y] where 0-100 represents position on canvas
- Example: A connector curving around an obstacle might have waypoints [[30, 20], [45, 25], [60, 30]]
- If the path is perfectly straight with no curves/bends, set approximate_waypoints to empty array []
- SPATIAL PRECISION: Waypoints are CRITICAL for matching the reference diagram's arrow trajectories`;

    const connectorUserPrompt = "PASS 2 - Analyze ALL connectors, arrows, and lines in detail.";

    const connectorResponse = await callLovableAIWithTimeout(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          temperature: 0.1,
        messages: [
          { role: 'system', content: connectorSystemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: connectorUserPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_connector_analysis',
              description: 'Return the connector analysis with all connectors and their properties',
              parameters: {
                type: 'object',
                properties: {
                  connectors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        from_element: { type: 'number' },
                        to_element: { type: 'number' },
                        relationship_type: { type: 'string' },
                        visual_style: {
                          type: 'object',
                          properties: {
                            line_type: { type: 'string' },
                            line_style: { type: 'string' },
                            thickness: { type: 'string' },
                            color: { type: 'string' }
                          }
                        },
                        markers: {
                          type: 'object',
                          properties: {
                            start: { type: 'string' },
                            end: { type: 'string' }
                          }
                        },
                        routing: {
                          type: 'object',
                          properties: {
                            path_description: { type: 'string' },
                            approximate_waypoints: {
                              type: 'array',
                              items: {
                                type: 'array',
                                items: { type: 'number' },
                                minItems: 2,
                                maxItems: 2
                              }
                            }
                          }
                        },
                        label: { type: 'string' },
                        label_position: { type: 'string' },
                        directionality: { type: 'string' },
                        justification: { type: 'string' }
                      },
                      required: ['from_element', 'to_element', 'relationship_type']
                    }
                  }
                },
                required: ['connectors']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_connector_analysis' } },
        max_tokens: 4000,
      }),
      },
      45000
    );

    if (!connectorResponse.ok) {
      const errorText = await connectorResponse.text();
      console.error('❌ Pass 2 Lovable AI error:', connectorResponse.status, errorText);
      console.error('📊 Elements being analyzed:', elementAnalysis.identified_elements?.length || 0);
      
      let errorMsg = 'Connector analysis failed';
      if (connectorResponse.status === 429) {
        errorMsg = 'Rate limit exceeded. Please try again later or add credits to your Lovable AI workspace.';
      } else if (connectorResponse.status === 402) {
        errorMsg = 'AI credits depleted. Please add credits in Settings → Workspace → Usage.';
      } else if (connectorResponse.status === 401) {
        errorMsg = 'Lovable API key is invalid or missing';
      }
      
      if (creditIds.length > 0) {
        await refundGenerations(supabaseAdmin, creditIds);
      }
      return new Response(JSON.stringify({
        error: errorMsg,
        stage: 'connector_analysis',
        details: `Lovable AI returned ${connectorResponse.status}`,
        hint: 'Check edge function logs for details. Element detection was successful.',
        elements_detected: elementAnalysis.identified_elements?.length || 0
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const connectorData = await connectorResponse.json();
    console.log('✅ Pass 2 complete');
    const pass2Duration = Date.now() - pass2Start;
    console.log(`[TIMING] Pass 2 completed: ${new Date().toISOString()} (duration: ${pass2Duration}ms)`);
    console.log('[PROGRESS] connector_analysis | 100% | Connector analysis complete');
    
    // Debug: Log full response structure
    console.log('🔍 Full connector response structure:', JSON.stringify({
      has_choices: !!connectorData.choices,
      choices_length: connectorData.choices?.length,
      has_message: !!connectorData.choices?.[0]?.message,
      has_tool_calls: !!connectorData.choices?.[0]?.message?.tool_calls,
      tool_calls_length: connectorData.choices?.[0]?.message?.tool_calls?.length,
      tool_calls_preview: connectorData.choices?.[0]?.message?.tool_calls?.[0] ? {
        type: connectorData.choices[0].message.tool_calls[0].type,
        function_name: connectorData.choices[0].message.tool_calls[0].function?.name,
        has_arguments: !!connectorData.choices[0].message.tool_calls[0].function?.arguments,
        arguments_length: typeof connectorData.choices[0].message.tool_calls[0].function?.arguments === 'string' 
          ? connectorData.choices[0].message.tool_calls[0].function.arguments.length 
          : 'not-string'
      } : null,
      has_content: !!connectorData.choices?.[0]?.message?.content,
      content_length: connectorData.choices?.[0]?.message?.content?.length,
      content_preview: connectorData.choices?.[0]?.message?.content?.substring(0, 200),
      finish_reason: connectorData.choices?.[0]?.finish_reason
    }, null, 2));
    
    // Log finish_reason to detect truncation
    const finishReason = connectorData.choices?.[0]?.finish_reason;
    console.log(`🔍 Finish reason: ${finishReason}`);
    
    if (!finishReason || finishReason === null) {
      console.log('⚠️ Incomplete response detected (finish_reason is null/missing)');
      console.log('Response snippet:', JSON.stringify(connectorData).substring(0, 500));
      throw new Error('Incomplete AI response for connector analysis');
    }
    
    if (finishReason === 'length') {
      console.log('⚠️ WARNING: Response was truncated due to token limit. Attempting to salvage partial data...');
    }
    
    // Phase 4: Enhanced connector extraction with multiple strategies
    let connectorAnalysis = null;
    
    console.log('🔍 Attempting connector extraction with multiple strategies...');
    
    // Strategy 1: Tool calls (standard format)
    if (connectorData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        const args = connectorData.choices[0].message.tool_calls[0].function.arguments;
        console.log('📦 Strategy 1: Attempting tool_calls extraction...');
        console.log('   - Argument type:', typeof args);
        console.log('   - Argument length:', typeof args === 'string' ? args.length : 'N/A');
        
        connectorAnalysis = typeof args === 'string' ? JSON.parse(args) : args;
        console.log('✓ Extracted from tool_calls (standard format)');
        console.log('   - Connectors found:', connectorAnalysis?.connectors?.length || 0);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log('❌ Failed to parse tool_calls:', errorMsg);
        
        // Log preview of truncated JSON for debugging
        const argStr = connectorData.choices[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (typeof argStr === 'string') {
          console.log(`📝 JSON preview (first 200 chars): ${argStr.substring(0, 200)}`);
          console.log(`📝 JSON preview (last 200 chars): ...${argStr.slice(-200)}`);
        }
        
        // Try repair with enhanced logic
        console.log('🔧 Attempting JSON repair...');
        const repaired = typeof argStr === 'string' ? tryRepairJsonString(argStr) : null;
        if (repaired && repaired.connectors) {
          connectorAnalysis = repaired;
          console.log(`✓ Repaired truncated JSON from tool_calls - salvaged ${repaired.connectors.length} connectors`);
        } else {
          console.log('❌ JSON repair failed');
        }
      }
    } else {
      console.log('⚠️ Strategy 1 skipped: No tool_calls found in response');
    }
    
    // Strategy 2: Direct message content with JSON
    if (!connectorAnalysis && connectorData.choices?.[0]?.message?.content) {
      const content = connectorData.choices[0].message.content;
      console.log('📦 Strategy 2: Attempting content extraction...');
      console.log('   - Content length:', content.length);
      console.log('   - Content preview:', content.substring(0, 200));
      
      try {
        // Try direct JSON parse
        connectorAnalysis = JSON.parse(content);
        console.log('✓ Extracted from content (direct JSON parse)');
        console.log('   - Connectors found:', connectorAnalysis?.connectors?.length || 0);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log('❌ Direct JSON parse failed:', errorMsg);
        
        // Try extractJSON helper
        console.log('🔧 Attempting extractJSON helper...');
        connectorAnalysis = extractJSON(content);
        if (connectorAnalysis) {
          console.log('✓ Extracted from content (extractJSON helper)');
          console.log('   - Connectors found:', connectorAnalysis?.connectors?.length || 0);
        } else {
          console.log('❌ extractJSON helper failed');
        }
      }
    } else if (!connectorAnalysis) {
      console.log('⚠️ Strategy 2 skipped: No content found in response');
    }
    
    // Strategy 3: Check for alternative response structures
    if (!connectorAnalysis) {
      console.log('📦 Strategy 3: Checking for alternative response structures...');
      console.log('   - Response keys:', Object.keys(connectorData));
      console.log('   - Message keys:', Object.keys(connectorData.choices?.[0]?.message || {}));
      
      // Check if data is at root level
      if (connectorData.connectors) {
        console.log('✓ Found connectors at root level');
        connectorAnalysis = connectorData;
      }
    }
    
    // Final validation and fallback
    if (!connectorAnalysis || !connectorAnalysis.connectors || connectorAnalysis.connectors.length === 0) {
      console.log('❌ All extraction strategies failed or 0 connectors found');
      
      // Last resort: create basic connectors from spatial_relationships (if Pass 1 detected them)
      if (elementAnalysis.spatial_relationships && elementAnalysis.spatial_relationships.length > 0) {
        console.log(`📦 Creating ${elementAnalysis.spatial_relationships.length} fallback connectors from spatial_relationships`);
        connectorAnalysis = {
          connectors: elementAnalysis.spatial_relationships.map((rel: any) => ({
            from_element: rel.from_element,
            to_element: rel.to_element,
            relationship_type: rel.relationship_type || 'arrow',
            visual_style: { line_style: 'solid', line_type: 'straight' },
            markers: { start: 'none', end: 'arrow' },
            routing: { approximate_waypoints: [] }
          }))
        };
        console.log(`✅ Created ${connectorAnalysis.connectors.length} fallback connectors`);
      } else {
        console.log('⚠️ Attempting fallback with google/gemini-2.5-flash...');
        
        // Fallback: Retry Pass 2 with flash model (known to work with tool calling)
        try {
        const fallbackResponse = await callLovableAIWithTimeout(
          'https://ai.gateway.lovable.dev/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: connectorSystemPrompt },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: connectorUserPrompt },
                    {
                      type: 'image_url',
                      image_url: {
                        url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                      }
                    }
                  ]
                }
              ],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'return_connector_analysis',
                    description: 'Return the connector analysis with all connectors and their properties',
                    parameters: {
                      type: 'object',
                      properties: {
                        connectors: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              from_element: { type: 'number' },
                              to_element: { type: 'number' },
                              relationship_type: { type: 'string' },
                              visual_style: {
                                type: 'object',
                                properties: {
                                  line_type: { type: 'string' },
                                  line_style: { type: 'string' },
                                  thickness: { type: 'string' },
                                  color: { type: 'string' }
                                }
                              },
                              markers: {
                                type: 'object',
                                properties: {
                                  start: { type: 'string' },
                                  end: { type: 'string' }
                                }
                              },
                              routing: {
                                type: 'object',
                                properties: {
                                  path_description: { type: 'string' },
                                  approximate_waypoints: {
                                    type: 'array',
                                    items: {
                                      type: 'array',
                                      items: { type: 'number' },
                                      minItems: 2,
                                      maxItems: 2
                                    }
                                  }
                                }
                              },
                              label: { type: 'string' },
                              label_position: { type: 'string' },
                              directionality: { type: 'string' },
                              justification: { type: 'string' }
                            },
                            required: ['from_element', 'to_element', 'relationship_type']
                          }
                        }
                      },
                      required: ['connectors']
                    }
                  }
                }
              ],
              tool_choice: { type: 'function', function: { name: 'return_connector_analysis' } },
              max_tokens: 4000,
            }),
          },
          45000
        );
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('📦 Fallback response received, attempting extraction...');
          
          // Try tool_calls extraction
          if (fallbackData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            const args = fallbackData.choices[0].message.tool_calls[0].function.arguments;
            const parsed = typeof args === 'string' ? JSON.parse(args) : args;
            if (parsed?.connectors?.length > 0) {
              connectorAnalysis = parsed;
              console.log(`✅ Fallback success: ${parsed.connectors.length} connectors extracted with flash model`);
            }
          }
        } else {
          console.log('❌ Fallback request failed:', fallbackResponse.status);
        }
      } catch (fallbackErr) {
        console.log('❌ Fallback error:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
      }
      
        // Final check after fallback
        if (!connectorAnalysis || !connectorAnalysis.connectors || connectorAnalysis.connectors.length === 0) {
          console.log('⚠️ Proceeding with empty connectors array');
          connectorAnalysis = { connectors: [] };
        }
      }
    } else {
      console.log(`✅ Successfully extracted ${connectorAnalysis.connectors.length} connectors`);
      // Log first connector for validation
      if (connectorAnalysis.connectors.length > 0) {
        console.log('📋 First connector sample:', JSON.stringify(connectorAnalysis.connectors[0], null, 2));
      }
    }
    
    // Log successful connector detection
    if (connectorAnalysis && connectorAnalysis.connectors) {
      const connectorCount = connectorAnalysis.connectors?.length || 0;
      console.log(`✅ Connector analysis complete: ${connectorCount} connectors identified`);
    }

    // Merge analyses into final structure
    const analysis = {
      identified_elements: elementAnalysis.identified_elements,
      spatial_relationships: connectorAnalysis.connectors.map((c: any) => ({
        from_element: c.from_element,
        to_element: c.to_element,
        relationship_type: c.relationship_type || 'source', // Default to 'source' if undefined
        connector_style: c.visual_style?.line_style || 'solid',
        directionality: c.directionality || 'unidirectional',
        label: c.label || '',
        justification: c.justification || '',
        visual_details: c.visual_style || {},
        markers: c.markers || { start: 'none', end: 'arrow' },
        routing: c.routing || { path_description: 'direct' }
      })),
      spatial_analysis: elementAnalysis.spatial_analysis,
      overall_layout: elementAnalysis.overall_layout
    };

    console.log(`✅ Analysis complete: ${analysis.identified_elements.length} elements, ${analysis.spatial_relationships.length} connectors`);
    console.log(`📊 Total detected: ${detectedCount} elements (${elementAnalysis.identified_elements.filter((e: any) => e.element_type === 'shape').length} shapes, ${elementAnalysis.identified_elements.filter((e: any) => e.element_type === 'icon').length} icons)`);

    // STEP 2A: Phase 2 - Deterministic Search Term Generation (NO AI - saves 2,250 tokens)
    console.log('[PROGRESS] search_term_generation | 0% | Generating search terms...');
    console.log('Generating search terms deterministically...');
    
    function generateSearchTerms(name: string | undefined, category: string | undefined = ''): string[] {
      const terms: string[] = [];
      
      // Safety check: handle undefined or null values
      if (!name || typeof name !== 'string') {
        console.log('⚠️ Invalid name for search term generation:', name);
        return category && typeof category === 'string' ? [category.toLowerCase()] : ['unknown'];
      }
      
      const nameLower = name.toLowerCase();
      
      // Add the original name
      terms.push(nameLower);
      
      // Extract keywords from name
      const words = nameLower.split(/[\s\-_()]+/).filter(w => w.length > 2);
      terms.push(...words);
      
      // Add biological synonyms based on keywords
      const synonymMap: Record<string, string[]> = {
        'receptor': ['protein', 'membrane', 'gpcr', 'channel'],
        'enzyme': ['protein', 'catalytic', 'kinase'],
        'cell': ['cellular', 'organelle'],
        'protein': ['molecule', 'factor'],
        'gene': ['dna', 'sequence'],
        'rna': ['mrna', 'transcript'],
        'antibody': ['immunoglobulin', 'immune'],
        'virus': ['viral', 'pathogen'],
        'bacteria': ['bacterial', 'microbe']
      };
      
      for (const [key, synonyms] of Object.entries(synonymMap)) {
        if (nameLower.includes(key)) {
          terms.push(...synonyms);
        }
      }
      
      // Add category if provided
      if (category && typeof category === 'string') {
        terms.push(category.toLowerCase());
      }
      
      // Deduplicate and return top 5
      return [...new Set(terms)].slice(0, 5);
    }
    
    const elementsWithAISearchTerms = analysis.identified_elements.map((element: any, idx: number) => {
      // Skip search term generation for shape elements
      if (element.element_type === 'shape') {
        console.log(`[${idx}] Skipping search for shape: ${element.name}`);
        return { ...element, element_type: 'shape', ai_search_terms: [], search_confidence: 'n/a' };
      }
      
      const searchTerms = element.search_terms?.length > 0 
        ? element.search_terms 
        : generateSearchTerms(element.name, element.category);
      
      return { ...element, ai_search_terms: searchTerms, search_confidence: 'deterministic' };
    });

    // STEP 2B: Enhanced Icon Matching with Receptor Priority (skip shapes)
    console.log('Searching for matching icons...');
    const iconMatches = await Promise.all(
      elementsWithAISearchTerms.map(async (element: any, idx: number) => {
        // Skip icon matching for shape elements
        if (element.element_type === 'shape') {
          return {
            element_index: idx,
            element,
            matches: [] // No icon matches for shapes
          };
        }
        const searchTerms = element.ai_search_terms || element.search_terms || [element.name || ''];
        const safeName = (element.name || '').toString().toLowerCase();
        const safeCategory = (element.category || '').toString().toLowerCase();
        const isReceptor = safeName.includes('receptor') || 
                          safeCategory.includes('receptor') ||
                          searchTerms.some((term: string) => {
                            const t = (term || '').toString().toLowerCase();
                            return t.includes('receptor') || t.includes('gpcr') || t.includes('membrane') || t.includes('channel');
                          });
        
        console.log(`[${idx}] Searching: ${element.name} (${isReceptor ? 'RECEPTOR' : 'standard'})`);
        console.log(`  AI-generated search terms: ${searchTerms.join(', ')}`);
        
        let matches: any[] = [];
        
        // Receptor enforcement: filter to receptor icons FIRST
        if (isReceptor) {
          const { data: receptorMatches } = await supabase
            .from('icons')
            .select('id, name, category, svg_content, thumbnail')
            .or('name.ilike.%receptor%,category.ilike.%receptor%,name.ilike.%channel%,name.ilike.%membrane%,name.ilike.%gpcr%')
            .limit(8);
          
          if (receptorMatches && receptorMatches.length > 0) {
            matches = receptorMatches;
            console.log(`  ✓ Receptor priority: Found ${matches.length} matches`);
          }
        }
        
        // Stage 1: Exact name match
        if (matches.length === 0) {
          const { data: exactMatch } = await supabase
            .from('icons')
            .select('id, name, category, svg_content, thumbnail')
            .ilike('name', element.name)
            .limit(5);
          
          if (exactMatch && exactMatch.length > 0) {
            matches = exactMatch;
            console.log(`  Stage 1 (exact): Found ${matches.length} matches`);
          }
        }
        
        // Stage 2: AI-generated search terms match
        if (matches.length < 5) {
          for (const term of searchTerms.slice(0, 5)) {
            const { data: termMatches } = await supabase
              .from('icons')
              .select('id, name, category, svg_content, thumbnail')
              .or(`name.ilike.%${term}%,category.ilike.%${term}%`)
              .limit(8);
            
            if (termMatches && termMatches.length > 0) {
              termMatches.forEach(m => {
                if (!matches.find(existing => existing.id === m.id)) {
                  matches.push(m);
                }
              });
              console.log(`  Stage 2 (AI term "${term}"): Found ${termMatches.length} matches`);
              if (matches.length >= 8) break;
            }
          }
        }
        
        // Stage 3: Category fallback
        if (matches.length === 0) {
          const { data: categoryMatches } = await supabase
            .from('icons')
            .select('id, name, category, svg_content, thumbnail')
            .ilike('category', element.category)
            .limit(5);
          
          if (categoryMatches && categoryMatches.length > 0) {
            matches = categoryMatches;
            console.log(`  Stage 3 (category): Found ${matches.length} matches`);
          }
        }
        
        console.log(`  Total candidate matches: ${matches.length}`);

        return {
          element,
          element_index: idx,
          matches: matches.slice(0, 8) // Keep top 8 for verification
        };
      })
    );

    // STEP 2C: Phase 3 - Score-Based Icon Verification (saves ~1,950 tokens)
    console.log('[PROGRESS] icon_verification | 0% | Verifying icon matches...');
    console.log('Verifying icon matches with score-based ranking...');
    
    function calculateMatchScore(iconName: string | undefined, iconCategory: string | undefined, elementName: string | undefined, searchTerms: string[] | undefined): number {
      // Safety checks for undefined values
      if (!iconName || typeof iconName !== 'string') return 0;
      if (!iconCategory || typeof iconCategory !== 'string') iconCategory = '';
      if (!elementName || typeof elementName !== 'string') return 0;
      if (!searchTerms || !Array.isArray(searchTerms)) searchTerms = [];
      
      const iconNameLower = iconName.toLowerCase();
      const iconCategoryLower = iconCategory.toLowerCase();
      const elementNameLower = elementName.toLowerCase();
      
      let score = 0;
      
      // Exact name match
      if (iconNameLower === elementNameLower) {
        score += 100;
      } else if (iconNameLower.includes(elementNameLower) || elementNameLower.includes(iconNameLower)) {
        score += 80;
      }
      
      // Search term matches
      let termMatches = 0;
      for (const term of searchTerms) {
        if (!term || typeof term !== 'string') continue; // Skip invalid terms
        const termLower = term.toLowerCase();
        if (iconNameLower.includes(termLower)) {
          termMatches++;
          score += 15;
        }
        if (iconCategoryLower.includes(termLower)) {
          termMatches++;
          score += 10;
        }
      }
      
      // Bonus for matching all terms
      if (searchTerms.length > 0 && termMatches >= searchTerms.length) {
        score += 20;
      }
      
      // Category match bonus
      if (iconCategoryLower && iconCategoryLower === elementNameLower) {
        score += 30;
      }
      
      return score;
    }
    
    const verifiedMatches = iconMatches.map((match) => {
      if (match.matches.length === 0) {
        return match;
      }

      if (match.matches.length === 1) {
        console.log(`  [${match.element_index}] Only 1 match, using it directly`);
        return match;
      }

      // Score all matches
      const scoredMatches = match.matches.map((icon: any) => ({
        ...icon,
        score: calculateMatchScore(icon.name, icon.category, match.element.name, match.element.ai_search_terms || [])
      }));
      
      // Sort by score (highest first)
      scoredMatches.sort((a: any, b: any) => b.score - a.score);
      
      console.log(`  [${match.element_index}] Top match: "${scoredMatches[0].name}" (score: ${scoredMatches[0].score})`);
      
      // Phase 3: Only use AI verification if top 2 scores are within 10 points (rare case)
      const topTwo = scoredMatches.slice(0, 2);
      if (topTwo.length === 2 && Math.abs(topTwo[0].score - topTwo[1].score) <= 10) {
        console.log(`    Scores are close (${topTwo[0].score} vs ${topTwo[1].score}), may need AI verification in future`);
        // For now, just use the top score
      }
      
      return {
        ...match,
        matches: scoredMatches.slice(0, 5),
        verification: {
          confidence: scoredMatches[0].score >= 80 ? 'high' : scoredMatches[0].score >= 50 ? 'medium' : 'low',
          reasoning: `Score-based ranking: ${scoredMatches[0].score} points`
        }
      };
    });

    const iconMatchesVerified = verifiedMatches;
    console.log(`Icon matching complete: ${iconMatchesVerified.filter(m => m.matches.length > 0).length} elements matched`);
    console.log('[PROGRESS] icon_verification | 100% | Icon verification complete');

    // Separate shapes and icons
    const shapeElements = iconMatchesVerified.filter(m => m.element.element_type === 'shape');
    const iconElements = iconMatchesVerified.filter(m => m.matches.length > 0);
    
    console.log(`Elements breakdown: ${shapeElements.length} shapes, ${iconElements.length} icons`);
    
    if (shapeElements.length === 0 && iconElements.length === 0) {
      if (creditIds.length > 0) {
        await refundGenerations(supabaseAdmin, creditIds);
      }
      return new Response(JSON.stringify({
        error: 'No elements could be processed from the reference image',
        suggestion: 'Try uploading a clearer reference image'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 3: Generate Layout with DAG-based layering
    console.log('[PROGRESS] layout_generation | 0% | Generating layout...');
    console.log('Generating DAG-based layout for clean hierarchical positioning...');
    
    const allElements = [...shapeElements, ...iconElements];
    const relationships = analysis.spatial_relationships || [];
    
    // Helper: snap to grid
    const snapToGrid = (value: number, gridSize: number = 2.5): number => {
      return Math.round(value / gridSize) * gridSize;
    };
    
    // ===== DAG CONSTRUCTION =====
    // Build adjacency list from relationships
    const graph = new Map<number, Set<number>>();
    const inDegree = new Map<number, number>();
    const backEdges: Array<[number, number]> = [];
    
    // Initialize all nodes
    allElements.forEach((_, idx) => {
      graph.set(idx, new Set());
      inDegree.set(idx, 0);
    });
    
    // Build graph edges
    relationships.forEach((rel: any) => {
      const fromElem = allElements.find((m: any) => m.element_index === rel.from_element);
      const toElem = allElements.find((m: any) => m.element_index === rel.to_element);
      if (!fromElem || !toElem) return;
      
      const fromIdx = allElements.indexOf(fromElem);
      const toIdx = allElements.indexOf(toElem);
      
      graph.get(fromIdx)?.add(toIdx);
      inDegree.set(toIdx, (inDegree.get(toIdx) || 0) + 1);
    });
    
    // ===== KAHN'S ALGORITHM FOR LAYERING =====
    const layers: number[][] = [];
    const nodeLayer = new Map<number, number>();
    const queue: number[] = [];
    
    // Start with nodes that have no incoming edges
    inDegree.forEach((degree, node) => {
      if (degree === 0) queue.push(node);
    });
    
    // If no roots, pick nodes with minimal incoming edges
    if (queue.length === 0) {
      const minDegree = Math.min(...Array.from(inDegree.values()));
      inDegree.forEach((degree, node) => {
        if (degree === minDegree) queue.push(node);
      });
    }
    
    const tempInDegree = new Map(inDegree);
    let currentLayer = 0;
    
    while (queue.length > 0) {
      const layerNodes: number[] = [];
      const nextQueue: number[] = [];
      
      queue.forEach(node => {
        layerNodes.push(node);
        nodeLayer.set(node, currentLayer);
        
        graph.get(node)?.forEach(neighbor => {
          const newDegree = (tempInDegree.get(neighbor) || 0) - 1;
          tempInDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            nextQueue.push(neighbor);
          }
        });
      });
      
      layers.push(layerNodes);
      queue.length = 0;
      queue.push(...nextQueue);
      currentLayer++;
    }
    
    // Handle any remaining nodes (disconnected or cycles)
    allElements.forEach((_, idx) => {
      if (!nodeLayer.has(idx)) {
        nodeLayer.set(idx, layers.length);
        layers.push([idx]);
      }
    });
    
    console.log(`📊 DAG layering complete: ${layers.length} layers`);
    
    // ===== PATTERN DETECTION =====
    // Detect whether diagram is linear pathway or hub-and-spoke
    const detectLayoutPattern = (): 'linear' | 'hub-spoke' => {
      // Check if description mentions hub-and-spoke or multi-column patterns
      const descLower = diagramDescription.toLowerCase();
      if (descLower.includes('hub-and-spoke') || 
          descLower.includes('central node') ||
          descLower.includes('multiple branches') ||
          descLower.includes('multi-column') ||
          descLower.includes('three columns')) {
        console.log('🎯 Description indicates hub-and-spoke pattern');
        return 'hub-spoke';
      }
      
      const outDegrees = new Map<number, number>();
      
      relationships.forEach((rel: any) => {
        const fromIdx = allElements.findIndex((m: any) => m.element_index === rel.from_element);
        if (fromIdx !== -1) {
          outDegrees.set(fromIdx, (outDegrees.get(fromIdx) || 0) + 1);
        }
      });
      
      const maxOutDegree = Math.max(0, ...Array.from(outDegrees.values()));
      
      // If one node fans out to 3+ direct children, it's hub-and-spoke
      if (maxOutDegree >= 3) {
        console.log('🎯 Topology indicates hub-and-spoke pattern (max out-degree:', maxOutDegree, ')');
        return 'hub-spoke';
      }
      
      return 'linear';
    };
    
    const layoutPattern = detectLayoutPattern();
    console.log(`🎯 Detected layout pattern: ${layoutPattern}`);
    
    // ===== LAYOUT HELPERS =====
    // Helper: Find longest path (main pathway)
    const findLongestPath = (): number[] => {
      const allPaths: number[][] = [];
      const visited = new Set<number>();
      
      const dfs = (node: number, path: number[]) => {
        path.push(node);
        visited.add(node);
        
        const neighbors = graph.get(node) || new Set();
        if (neighbors.size === 0) {
          allPaths.push([...path]);
        } else {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              dfs(neighbor, path);
            }
          }
        }
        
        path.pop();
        visited.delete(node);
      };
      
      // Start from nodes with no incoming edges (sources)
      allElements.forEach((_, idx) => {
        const hasIncoming = relationships.some((rel: any) => {
          const toIdx = allElements.findIndex(m => m.element_index === rel.to_element);
          return toIdx === idx;
        });
        if (!hasIncoming) {
          dfs(idx, []);
        }
      });
      
      return allPaths.reduce((longest, current) => 
        current.length > longest.length ? current : longest, []
      );
    };
    
    // Helper: Find branches from a node (excluding main pathway)
    const findBranches = (nodeIdx: number, mainPathway: Set<number>): number[] => {
      const neighbors = graph.get(nodeIdx) || new Set();
      return Array.from(neighbors).filter(n => !mainPathway.has(n));
    };
    
    // Helper: Find icon connected to a shape
    const findIconConnectedTo = (shapeIdx: number): number | undefined => {
      const shapeElementIndex = allElements[shapeIdx].element_index;
      
      for (let iconIdx = 0; iconIdx < allElements.length; iconIdx++) {
        if (allElements[iconIdx].element.element_type === 'icon') {
          const iconElementIndex = allElements[iconIdx].element_index;
          const hasConnection = relationships.some((rel: any) =>
            rel.from_element === iconElementIndex && rel.to_element === shapeElementIndex
          );
          if (hasConnection) return iconIdx;
        }
      }
      return undefined;
    };
    
    // Helper: Find vertical chain below a node
    const findVerticalChain = (startIdx: number): number[] => {
      const chain: number[] = [];
      let currentIdx = startIdx;
      const visited = new Set<number>();
      
      while (true) {
        const children = Array.from(graph.get(currentIdx) || [])
          .filter(child => !visited.has(child));
        
        if (children.length === 0) break;
        
        // Follow the first child (main chain)
        currentIdx = children[0];
        chain.push(currentIdx);
        visited.add(currentIdx);
      }
      
      return chain;
    };
    
    // Helper: Find convergence node (receives edges from multiple sources)
    const findConvergenceNode = (sourceNodes: number[]): number | undefined => {
      const inDegrees = new Map<number, Set<number>>();
      
      relationships.forEach((rel: any) => {
        const fromIdx = allElements.findIndex((m: any) => m.element_index === rel.from_element);
        const toIdx = allElements.findIndex((m: any) => m.element_index === rel.to_element);
        
        if (fromIdx !== -1 && toIdx !== -1) {
          if (!inDegrees.has(toIdx)) {
            inDegrees.set(toIdx, new Set());
          }
          inDegrees.get(toIdx)!.add(fromIdx);
        }
      });
      
      // Find node receiving from 2+ sources
      for (const [nodeIdx, sources] of inDegrees.entries()) {
        if (sources.size >= 2) {
          return nodeIdx;
        }
      }
      
      return undefined;
    };
    
    // ===== COMPUTE POSITIONS BASED ON DETECTED PATTERN =====
    const ICON_COLUMN_X = 10;
    const PATHWAY_COLUMN_X = 35;
    const BRANCH_START_X = 60;
    const BRANCH_END_X = 85;
    
    // Separate icons
    const iconIndices = new Set<number>();
    const iconToConnectedShape = new Map<number, number>();
    
    allElements.forEach((m, idx) => {
      if (m.element.element_type === 'icon') {
        iconIndices.add(idx);
        relationships.forEach((rel: any) => {
          if (rel.from_element === m.element_index) {
            const targetIdx = allElements.findIndex(el => el.element_index === rel.to_element);
            if (targetIdx !== -1 && !iconToConnectedShape.has(idx)) {
              iconToConnectedShape.set(idx, targetIdx);
            }
          }
        });
      }
    });
    
    let positionMap: Map<number, { x: number; y: number; column?: number }>;
    
    if (layoutPattern === 'hub-spoke') {
      // ===== HUB-AND-SPOKE LAYOUT =====
      console.log('Applying hub-and-spoke multi-column layout...');
      
      positionMap = new Map();
      
      // Step 1: Find the hub (node with highest out-degree)
      const outDegrees = new Map<number, number>();
      relationships.forEach((rel: any) => {
        const fromIdx = allElements.findIndex((m: any) => m.element_index === rel.from_element);
        if (fromIdx !== -1) {
          outDegrees.set(fromIdx, (outDegrees.get(fromIdx) || 0) + 1);
        }
      });
      
      const hubIdx = Array.from(outDegrees.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      
      if (hubIdx !== undefined) {
        // Position hub at top center
        positionMap.set(hubIdx, { x: 50, y: 10 });
        
        // Step 2: Find direct children of hub (spokes)
        const spokes: number[] = [];
        relationships.forEach((rel: any) => {
          const fromIdx = allElements.findIndex((m: any) => m.element_index === rel.from_element);
          if (fromIdx === hubIdx) {
            const spokeIdx = allElements.findIndex((m: any) => m.element_index === rel.to_element);
            if (spokeIdx !== -1 && !iconIndices.has(spokeIdx)) {
              spokes.push(spokeIdx);
            }
          }
        });
        
        // Step 3: Position spokes horizontally in columns
        const numColumns = spokes.length;
        const columnWidth = numColumns > 0 ? 80 / (numColumns + 1) : 20;
        
        spokes.forEach((spokeIdx, colIdx) => {
          const columnX = 10 + ((colIdx + 1) * columnWidth);
          positionMap.set(spokeIdx, { x: columnX, y: 25, column: colIdx });
          
          // Step 4: Find icon connected to this spoke
          const connectedIconIdx = findIconConnectedTo(spokeIdx);
          if (connectedIconIdx !== undefined) {
            positionMap.set(connectedIconIdx, { x: columnX, y: 17, column: colIdx });
          }
          
          // Step 5: Find vertical chain below this spoke
          const chain = findVerticalChain(spokeIdx);
          chain.forEach((chainIdx, depth) => {
            positionMap.set(chainIdx, {
              x: columnX,
              y: 35 + (depth * 10),
              column: colIdx
            });
          });
        });
        
        // Step 6: Find convergence node at bottom
        const convergenceIdx = findConvergenceNode(spokes);
        if (convergenceIdx !== undefined) {
          positionMap.set(convergenceIdx, { x: 50, y: 85 });
        }
      }
      
      // Handle any unpositioned nodes
      allElements.forEach((m, idx) => {
        if (!positionMap.has(idx)) {
          positionMap.set(idx, { x: 50, y: 50 + (idx * 5) });
        }
      });
      
      console.log('✅ Hub-and-spoke layout complete:', {
        hub: hubIdx !== undefined ? 1 : 0,
        spokes: Array.from(positionMap.values()).filter(p => p.column !== undefined).length,
        icons: iconIndices.size
      });
      
    } else {
      // ===== LINEAR PATHWAY LAYOUT (existing three-zone system) =====
      console.log('Applying linear pathway layout...');
      
      positionMap = new Map();
      
      // ZONE 1: Identify main pathway (longest chain)
      const mainPathwayIndices = findLongestPath();
      const mainPathwaySet = new Set(mainPathwayIndices);
      
      // ZONE 2: Position main pathway vertically at X=35%
      const startY = 10;
      const verticalSpacing = 15;
      
      mainPathwayIndices.forEach((nodeIdx, i) => {
        positionMap.set(nodeIdx, {
          x: PATHWAY_COLUMN_X,
          y: startY + (i * verticalSpacing)
        });
      });
      
      // ZONE 3: Position branches and effects
      const processedBranches = new Set<number>();
      
      mainPathwayIndices.forEach(nodeIdx => {
        const branches = findBranches(nodeIdx, mainPathwaySet);
        
        if (branches.length > 0) {
          const parentPos = positionMap.get(nodeIdx)!;
          const spacing = branches.length > 1 ? (BRANCH_END_X - BRANCH_START_X) / (branches.length - 1) : 0;
          
          branches.forEach((branchIdx, idx) => {
            if (processedBranches.has(branchIdx)) return;
            
            const branchX = branches.length === 1 
              ? (BRANCH_START_X + BRANCH_END_X) / 2 
              : BRANCH_START_X + (idx * spacing);
            
            positionMap.set(branchIdx, {
              x: branchX,
              y: parentPos.y
            });
            processedBranches.add(branchIdx);
            
            // Position effects below branch
            const effects = findBranches(branchIdx, mainPathwaySet);
            effects.forEach((effectIdx, effIdx) => {
              positionMap.set(effectIdx, {
                x: branchX,
                y: parentPos.y + 10 + (effIdx * 12)
              });
              processedBranches.add(effectIdx);
            });
          });
        }
      });
      
      // Handle remaining unpositioned nodes
      allElements.forEach((m, idx) => {
        if (!iconIndices.has(idx) && !positionMap.has(idx)) {
          positionMap.set(idx, {
            x: 70,
            y: 50 + (idx * 10)
          });
        }
      });
      
      // Position icons aligned with their connected elements
      iconIndices.forEach(iconIdx => {
        const connectedShapeIdx = iconToConnectedShape.get(iconIdx);
        let y = 50; // Default if no connection
        
        if (connectedShapeIdx !== undefined) {
          const connectedPos = positionMap.get(connectedShapeIdx);
          if (connectedPos) {
            y = connectedPos.y; // Align Y with connected element
          }
        }
        
        positionMap.set(iconIdx, { x: ICON_COLUMN_X, y });
      });
      
      console.log('✅ Linear pathway layout complete:', {
        mainPathway: mainPathwayIndices.length,
        branches: processedBranches.size,
        icons: iconIndices.size
      });
    }
    
    // Build composed objects with column-based positions
    let composedObjects = allElements.map((m, idx) => {
      const pos = positionMap.get(idx) || { x: 50, y: 50 };
      const clampedX = Math.max(5, Math.min(95, pos.x));
      const clampedY = Math.max(5, Math.min(90, pos.y));
      
      // Create object based on type
      if (m.element.element_type === 'shape') {
        let width = 100, height = 60;
        if (m.element.bounding_box) {
          width = m.element.bounding_box.width || 100;
          height = m.element.bounding_box.height || 60;
        }
        
        // Detect multi-line text and adjust height
        const textContent = m.element.text_content || m.element.name || '';
        const lineCount = (textContent.match(/\n/g) || []).length + 1;
        if (lineCount > 1) {
          height = Math.max(height, 40 + (lineCount - 1) * 20);
        }
        
        // Hub-and-spoke specific: smaller boxes for process labels
        const nameLower = (m.element.name || '').toLowerCase();
        const isSmallLabel = layoutPattern === 'hub-spoke' && 
                            textContent.length < 40 && 
                            !nameLower.match(/metformin|hyperglycaemia|hypoglycemia/);
        
        if (isSmallLabel) {
          width = Math.max(100, Math.min(150, textContent.length * 6));
          height = lineCount > 1 ? 30 + (lineCount - 1) * 18 : 35;
        }
        
        // Detect shape styling from name/category (pathway-aware colors)
        const categoryLower = (m.element.category || '').toLowerCase();
        
        let fillColor = '#F5F5F5'; // Default white/light
        let strokeColor = '#333333';
        
        // Orange/amber for enzymes/converters
        if (nameLower.match(/enzyme|kinase|ace|renin|convert/i)) {
          fillColor = '#FFE5CC';
          strokeColor = '#FF8C00';
        }
        // Green/teal for receptors
        else if (nameLower.match(/receptor|at1r|at2r|mas/i) || categoryLower.includes('receptor')) {
          fillColor = '#C8E6C9';
          strokeColor = '#2E7D32';
        }
        // Blue/cyan for effects/outcomes
        else if (nameLower.match(/vasoconstrict|cell growth|proliferat|effect/i)) {
          fillColor = '#BBDEFB';
          strokeColor = '#1565C0';
        }
        
        return {
          type: 'shape',
          element_index: m.element_index,
          shape_type: m.element.shape_type || 'rectangle',
          shape_subtype: m.element.shape_subtype,
          x: clampedX,
          y: clampedY,
          width,
          height,
          rotation: m.element.rotation || 0,
          label: m.element.name,
          text_content: m.element.text_content,
          text_properties: m.element.text_properties,
          rounded_corners: m.element.rounded_corners || (m.element.shape_type === 'rectangle'),
          fill_color: m.element.fill_color || fillColor,
          stroke_color: m.element.stroke_color || strokeColor,
          stroke_width: 2,
          suggestedStyle: { fill: fillColor, stroke: strokeColor, shape: m.element.shape_type || 'rectangle' },
          estimatedHeight: height
        };
      }
      
      // For icons
      const chosenIcon = m.matches[0];
      let scale = 0.5;
      if (m.element.bounding_box?.width) {
        scale = Math.max(0.4, Math.min(1.2, m.element.bounding_box.width / 200));
      } else {
        const sizeMap: Record<string, number> = { large: 0.8, medium: 0.5, small: 0.35 };
        scale = sizeMap[m.element.estimated_size] || 0.5;
      }
      
      return {
        type: 'icon',
        element_index: m.element_index,
        icon_id: chosenIcon.id,
        icon_name: chosenIcon.name,
        x: clampedX,
        y: clampedY,
        scale,
        rotation: m.element.rotation || 0,
        label: m.element.name,
        labelPosition: 'bottom'
      };
    });
    
    console.log(`✅ Layout positioning complete: ${layers.length} layers, ${composedObjects.length} nodes`);
    
    // ===== BUILD CONNECTORS WITH PORT HINTS =====
    const composedConnectors = relationships.map((rel: any) => {
      const fromElem = allElements.find((m: any) => m.element_index === rel.from_element);
      const toElem = allElements.find((m: any) => m.element_index === rel.to_element);
      
      if (!fromElem || !toElem) return null;
      
      const fromIdx = allElements.indexOf(fromElem);
      const toIdx = allElements.indexOf(toElem);
      
      const fromLayer = nodeLayer.get(fromIdx) || 0;
      const toLayer = nodeLayer.get(toIdx) || 0;
      const fromIsIcon = fromElem.element.element_type === 'icon';
      const toIsIcon = toElem.element.element_type === 'icon';
      
      const style = getConnectorStyle(rel.relationship_type, rel.visual_details);
      const category = style.relationship_category || 'main_pathway';
      
      // Get actual positions for smart port selection
      const fromObj = composedObjects.find((o: any) => o.element_index === rel.from_element);
      const toObj = composedObjects.find((o: any) => o.element_index === rel.to_element);
      
      // Determine preferred ports and routing based on layout zones
      let preferredPorts = { from: '', to: '' };
      let routingStyle: 'straight' | 'curved' | 'orthogonal' = 'straight';
      
      if (fromObj && toObj) {
        const dx = toObj.x - fromObj.x;
        const dy = toObj.y - fromObj.y;
        
        if (layoutPattern === 'hub-spoke') {
          // HUB-AND-SPOKE PORT SELECTION
          const fromPos = positionMap.get(fromIdx);
          const toPos = positionMap.get(toIdx);
          
          // Hub to spoke: bottom → top
          if (fromPos && toPos && fromPos.y < toPos.y && Math.abs(dx) < 20) {
            preferredPorts = { from: 'bottom', to: 'top' };
            routingStyle = 'straight';
          }
          // Same column (spoke to process): bottom → top
          else if (fromPos && toPos && fromPos.column !== undefined && fromPos.column === toPos.column) {
            preferredPorts = { from: 'bottom', to: 'top' };
            routingStyle = 'straight';
          }
          // Spoke to convergence (different columns): bottom → top, curved
          else if (Math.abs(dx) > 10 && dy > 5) {
            preferredPorts = { from: 'bottom', to: 'top' };
            routingStyle = 'curved';
          }
          // Icon to spoke: bottom → left
          else if (fromIsIcon) {
            preferredPorts = { from: 'bottom', to: 'left' };
            routingStyle = 'straight';
          }
          else {
            preferredPorts = { from: 'bottom', to: 'top' };
            routingStyle = 'straight';
          }
        } else {
          // LINEAR PATHWAY PORT SELECTION (existing logic)
          
          // Icon to pathway: right → left, straight
          if (fromIsIcon) {
            preferredPorts = { from: 'right', to: 'left' };
            routingStyle = 'straight';
          }
          // Main pathway vertical flow (small horizontal movement): bottom → top, straight
          else if (Math.abs(dx) < 10 && dy > 5) {
            preferredPorts = { from: 'bottom', to: 'top' };
            routingStyle = 'straight';
          }
          // Branch to right (significant horizontal movement): right → left, curved
          else if (dx > 15) {
            preferredPorts = { from: 'right', to: 'left' };
            routingStyle = 'curved';
          }
          // Downward flow (effects below receptors): bottom → top, straight
          else if (dy > 5 && Math.abs(dx) < 5) {
            preferredPorts = { from: 'bottom', to: 'top' };
            routingStyle = 'straight';
          }
          // Default: calculate from positions
          else {
            if (Math.abs(dy) > Math.abs(dx)) {
              preferredPorts = dy > 0 
                ? { from: 'bottom', to: 'top' }
                : { from: 'top', to: 'bottom' };
              routingStyle = 'straight';
            } else {
              preferredPorts = dx > 0
                ? { from: 'right', to: 'left' }
                : { from: 'left', to: 'right' };
              routingStyle = category === 'main_pathway' ? 'straight' : 'curved';
            }
          }
        }
      }
      
      return {
        from: fromIdx,
        to: toIdx,
        type: routingStyle,
        style: style.style,
        strokeWidth: style.strokeWidth,
        color: style.color,
        endMarker: style.endMarker,
        startMarker: 'none',
        label: rel.label || '',
        preferredPorts,
        relationship_category: category
      };
    }).filter(Boolean);
    
    const proposedLayout = {
      objects: composedObjects,
      connectors: composedConnectors
    };
    
    console.log(`Layout composed: ${proposedLayout.objects.length} objects, ${proposedLayout.connectors.length} connectors`);
    console.log(`  Layers: ${layers.length}, Nodes per layer: ${layers.map(l => l.length).join(', ')}`);
    console.log('[PROGRESS] layout_generation | 100% | Layout generation complete');


    // STEP 3.5: Optional Self-Critique (only in strict mode, resilient to refusals)
    let critiqueResult: any = null;
    
    // Phase 6: Skip critique for simple diagrams (<10 elements)
    if (strict && allElements.length >= 10) {
      console.log('[PROGRESS] self_critique | 0% | Starting self-critique...');
      console.log('AI self-critique: reviewing layout against reference (strict mode)...');
      console.log(`[TIMING] Self-Critique started: ${new Date().toISOString()}`);
      const critiqueStart = Date.now();
      
      try {
        // Phase 6: Enhanced critique prompt with connector path validation
        const critiquePrompt = `Compare the proposed layout to the reference image. Check position accuracy, connector count, AND connector paths.

ELEMENTS (expected positions):
${analysis.identified_elements.map((e: any, i: number) => `${i}: ${e.name} at (${e.position_x}, ${e.position_y})`).join('\n')}

PROPOSED POSITIONS:
${proposedLayout.objects?.map((o: any, i: number) => `${i}: at (${o.x}, ${o.y})`).join('\n')}

CONNECTORS: Expected ${analysis.spatial_relationships.length}, proposed ${proposedLayout.connectors?.length || 0}

For EACH connector, verify:
- Does the arrow follow the correct path from the reference?
- Are curves/bends preserved?
- Should it be straight, curved, or orthogonal?
- Are there missing waypoints for complex paths?
- Does the trajectory match the visual path in the reference image?

Return JSON:
{
  "overall_accuracy": "excellent|good|fair|poor",
  "issues": [
    {
      "type": "position|connector|connector_path",
      "severity": "critical|moderate|minor",
      "element_or_connector": "name or connector index",
      "problem": "brief description"
    }
  ],
  "recommended_fixes": [
    {
      "fix_type": "move_object|adjust_connector_path|adjust_scale|adjust_rotation",
      "target": 0,
      "new_x": 45,
      "new_y": 30,
      "waypoints": [[x1,y1], [x2,y2]],
      "routing_type": "straight|curved|orthogonal",
      "reason": "brief explanation"
    }
  ],
  "confidence": "high|medium|low"
}`;

        const critiqueResponse = await callLovableAIWithTimeout(
          'https://ai.gateway.lovable.dev/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-pro',
              messages: [
                { role: 'system', content: 'You are a scientific diagram layout critic. Compare layouts to reference images and identify all discrepancies. Always return valid JSON.' },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: critiquePrompt },
                    {
                      type: 'image_url',
                      image_url: {
                        url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                      }
                    }
                  ]
                }
              ],
              response_format: { type: 'json_object' },
              max_tokens: 2000,
            }),
          },
          45000
        );

        if (critiqueResponse.ok) {
          const critiqueData = await critiqueResponse.json();
          const critiqueTextRaw = critiqueData.choices?.[0]?.message?.content ?? '';
          const critiqueText = typeof critiqueTextRaw === 'string' ? critiqueTextRaw : '';
          
          const critiqueDuration = Date.now() - critiqueStart;
          console.log(`[TIMING] Self-Critique completed: ${new Date().toISOString()} (duration: ${critiqueDuration}ms)`);
          
          // Check for refusal (safely)
          const lower = critiqueText.toLowerCase();
          if (lower.includes("i'm sorry") || lower.includes("i can't") || lower.includes('cannot assist')) {
            console.log('Critique refused by AI, skipping critique step');
          } else {
            const critiqueJsonMatch = critiqueText.match(/\{[\s\S]*\}/);
            
            if (critiqueJsonMatch) {
              critiqueResult = JSON.parse(critiqueJsonMatch[0]);
              console.log(`Self-critique complete: ${critiqueResult.overall_accuracy} accuracy`);
              console.log(`  Issues found: ${critiqueResult.issues?.length || 0}`);
              console.log(`  Fixes recommended: ${critiqueResult.recommended_fixes?.length || 0}`);
              
              // Apply automatic fixes to proposedLayout
              if (critiqueResult.recommended_fixes && critiqueResult.recommended_fixes.length > 0) {
                let fixesApplied = 0;
                
                for (const fix of critiqueResult.recommended_fixes) {
                  try {
                    if (fix.fix_type === 'move_object' && fix.target !== undefined) {
                      const objIdx = proposedLayout.objects?.findIndex((o: any) => o.element_index === fix.target);
                      if (objIdx >= 0 && proposedLayout.objects[objIdx]) {
                        if (fix.new_x !== undefined) proposedLayout.objects[objIdx].x = fix.new_x;
                        if (fix.new_y !== undefined) proposedLayout.objects[objIdx].y = fix.new_y;
                        fixesApplied++;
                        console.log(`    Applied fix: moved element ${fix.target} to (${fix.new_x}, ${fix.new_y})`);
                      }
                    } else if (fix.fix_type === 'adjust_connector_path' && fix.target !== undefined) {
                      const connIdx = proposedLayout.connectors?.findIndex((c: any, i: number) => i === fix.target);
                      if (connIdx >= 0 && proposedLayout.connectors[connIdx]) {
                        if (fix.waypoints && Array.isArray(fix.waypoints)) {
                          proposedLayout.connectors[connIdx].waypoints = fix.waypoints.map((wp: number[]) => ({
                            x: wp[0],
                            y: wp[1]
                          }));
                          fixesApplied++;
                          console.log(`    Applied fix: adjusted connector ${fix.target} path with ${fix.waypoints.length} waypoints`);
                        }
                        if (fix.routing_type) {
                          proposedLayout.connectors[connIdx].type = fix.routing_type;
                          console.log(`    Applied fix: changed connector ${fix.target} routing to ${fix.routing_type}`);
                        }
                      }
                    } else if (fix.fix_type === 'adjust_scale' && fix.target !== undefined) {
                      const objIdx = proposedLayout.objects?.findIndex((o: any) => o.element_index === fix.target);
                      if (objIdx >= 0 && proposedLayout.objects[objIdx] && fix.new_scale !== undefined) {
                        proposedLayout.objects[objIdx].scale = fix.new_scale;
                        fixesApplied++;
                        console.log(`    Applied fix: adjusted scale of element ${fix.target} to ${fix.new_scale}`);
                      }
                    } else if (fix.fix_type === 'adjust_rotation' && fix.target !== undefined) {
                      const objIdx = proposedLayout.objects?.findIndex((o: any) => o.element_index === fix.target);
                      if (objIdx >= 0 && proposedLayout.objects[objIdx] && fix.new_rotation !== undefined) {
                        proposedLayout.objects[objIdx].rotation = fix.new_rotation;
                        fixesApplied++;
                        console.log(`    Applied fix: adjusted rotation of element ${fix.target}`);
                      }
                    }
                  } catch (fixError) {
                    console.log(`    Failed to apply fix: ${fix.fix_type}`);
                  }
                }
                
                console.log(`  Total fixes applied: ${fixesApplied}`);
              }
            }
          }
        }
      } catch (critiqueError) {
        console.log('Self-critique failed, proceeding without critique:', critiqueError);
      }
      
      console.log('[PROGRESS] self_critique | 100% | Self-critique complete');
    } else if (strict && allElements.length < 10) {
      console.log('Skipping self-critique (diagram too simple - less than 10 elements)');
    } else {
      console.log('Skipping self-critique (not in strict mode)');
    }

    // STEP 4: Build Deterministic Final Layout
    console.log('[PROGRESS] final_processing | 0% | Building final layout...');
    console.log('Building deterministic final layout...');
    
    // Build objects with strict positioning from analysis (shapes + icons)
    const finalObjects = allElements.map((m) => {
      const x = Math.max(0, Math.min(100, m.element.position_x));
      const y = Math.max(0, Math.min(100, m.element.position_y));
      
      // For shapes
      if (m.element.element_type === 'shape') {
        const proposedObj = proposedLayout.objects?.find((o: any) => o.element_index === m.element_index);
        let width = proposedObj?.width || m.element.bounding_box?.width || 100;
        let height = proposedObj?.height || m.element.bounding_box?.height || 60;
        
        return {
          type: 'shape',
          element_index: m.element_index,
          shape_type: m.element.shape_type || 'rectangle',
          shape_subtype: proposedObj?.shape_subtype || m.element.shape_subtype,
          x,
          y,
          width,
          height,
          rotation: m.element.rotation || 0,
          label: m.element.name,
          text_content: m.element.text_content,
          text_properties: m.element.text_properties,
          fill_color: m.element.fill_color || '#E8F5E9',
          stroke_color: m.element.stroke_color || '#2E7D32',
          stroke_width: 2
        };
      }
      
      // For icons
      const proposedObj = proposedLayout.objects?.find((o: any) => o.element_index === m.element_index);
      const chosenIcon = proposedObj?.icon_id && m.matches.find((i: any) => i.id === proposedObj.icon_id)
        ? m.matches.find((i: any) => i.id === proposedObj.icon_id)
        : m.matches[0];

      let scale = 0.5;
      if (proposedObj?.scale) {
        scale = proposedObj.scale;
      } else {
        const sizeMap: Record<string, number> = { large: 0.8, medium: 0.5, small: 0.35 };
        scale = sizeMap[m.element.estimated_size] || 0.5;
      }

      return {
        type: "icon",
        element_index: m.element_index,
        icon_id: chosenIcon.id,
        icon_name: chosenIcon.name,
        x,
        y,
        scale,
        rotation: m.element.rotation || 0,
        label: m.element.name,
        labelPosition: "bottom" as const
      };
    });

    // Build connectors from analysis.spatial_relationships with strict styling
    const finalConnectors: any[] = [];
    const checks: any[] = [];

    for (const rel of analysis.spatial_relationships || []) {
      const fromObj = finalObjects.find(o => o.element_index === rel.from_element);
      const toObj = finalObjects.find(o => o.element_index === rel.to_element);

      if (!fromObj || !toObj) {
        checks.push({
          relationship: `${rel.from_element} → ${rel.to_element}`,
          status: 'missing',
          issue: 'One or both elements not matched to icons'
        });
        continue;
      }

      const fromIdx = finalObjects.indexOf(fromObj);
      const toIdx = finalObjects.indexOf(toObj);

      const relType = normalizeRelationship(rel.relationship_type);
      const strictStyle = getConnectorStyle(relType, rel.visual_details);

      // Extract waypoints from routing data
      const waypoints = rel.routing?.approximate_waypoints?.map((wp: number[]) => ({
        x: wp[0],
        y: wp[1]
      })) || undefined;

      const proposedConn = proposedLayout.connectors?.find((c: any) => 
        c.from === fromIdx && c.to === toIdx
      );

      // Compute preferredPorts and routing type based on layout pattern
      let preferredPorts: { from: string; to: string };
      let routingType = strictStyle.type;
      
      const fromX = fromObj.x;
      const fromY = fromObj.y;
      const toX = toObj.x;
      const toY = toObj.y;
      const dx = toX - fromX;
      const dy = toY - fromY;
      
      // Use proposed ports if available, otherwise compute
      if (proposedConn?.preferredPorts) {
        preferredPorts = proposedConn.preferredPorts;
        routingType = proposedConn.type || routingType;
      } else {
        // Compute ports based on relative positions
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical flow
          if (dy > 0) {
            preferredPorts = { from: 'bottom', to: 'top' };
            routingType = Math.abs(dx) > 10 ? 'orthogonal' : 'straight';
          } else {
            preferredPorts = { from: 'top', to: 'bottom' };
            routingType = Math.abs(dx) > 10 ? 'orthogonal' : 'straight';
          }
        } else {
          // Horizontal flow
          if (dx > 0) {
            preferredPorts = { from: 'right', to: 'left' };
            routingType = Math.abs(dy) > 10 ? 'orthogonal' : (relType === 'effect' ? 'curved' : 'straight');
          } else {
            preferredPorts = { from: 'left', to: 'right' };
            routingType = Math.abs(dy) > 10 ? 'orthogonal' : (relType === 'effect' ? 'curved' : 'straight');
          }
        }
      }
      
      console.log(`🔗 Connector ${finalConnectors.length}: ${fromObj.label}→${toObj.label}, ports {${preferredPorts.from}→${preferredPorts.to}}, type ${routingType}`);

      // Check if AI got it right
      let styleIssues: string[] = [];
      if (proposedConn) {
        if (proposedConn.endMarker !== strictStyle.endMarker) {
          styleIssues.push(`endMarker: expected ${strictStyle.endMarker}, got ${proposedConn.endMarker}`);
        }
        if (proposedConn.style !== strictStyle.style) {
          styleIssues.push(`style: expected ${strictStyle.style}, got ${proposedConn.style}`);
        }
        if (proposedConn.color !== strictStyle.color) {
          styleIssues.push(`color: expected ${strictStyle.color}, got ${proposedConn.color}`);
        }
      }

      checks.push({
        relationship: `${fromObj.label} → ${toObj.label}`,
        relationship_type: relType,
        status: styleIssues.length === 0 ? 'pass' : 'corrected',
        issues: styleIssues,
        corrected_style: strictStyle
      });

      finalConnectors.push({
        from: fromIdx,
        to: toIdx,
        type: routingType,
        style: strictStyle.style,
        strokeWidth: strictStyle.strokeWidth,
        color: strictStyle.color,
        endMarker: strictStyle.endMarker,
        startMarker: 'none',
        label: rel.label || '',
        waypoints,
        preferredPorts
      });
    }

    const finalLayout = {
      objects: finalObjects,
      connectors: finalConnectors
    };

    // Compute position deviation
    let totalDeviation = 0;
    let deviationCount = 0;
    proposedLayout.objects?.forEach((pObj: any) => {
      const fObj = finalObjects.find(o => o.element_index === pObj.element_index);
      if (fObj && pObj.x !== undefined && pObj.y !== undefined) {
        const dx = Math.abs(pObj.x - fObj.x);
        const dy = Math.abs(pObj.y - fObj.y);
        totalDeviation += dx + dy;
        deviationCount += 2;
      }
    });
    const avgDeviation = deviationCount > 0 ? (totalDeviation / deviationCount).toFixed(2) : '0';

    const connectorStyleBreakdown = finalConnectors.reduce((acc: any, conn: any) => {
      const key = `${conn.type}-${conn.style}-${conn.endMarker}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const metadata = {
      elements_identified: analysis.identified_elements.length,
      icons_matched: iconElements.length,
      shapes_identified: shapeElements.length,
      total_objects: finalObjects.length,
      total_connectors: finalConnectors.length,
      avg_position_deviation_percent: avgDeviation,
      connector_styles: connectorStyleBreakdown,
      checks_passed: checks.filter(c => c.status === 'pass').length,
      checks_corrected: checks.filter(c => c.status === 'corrected').length,
      checks_missing: checks.filter(c => c.status === 'missing').length,
      layout_source: 'deterministic',
      layout_pattern: layoutPattern,
      description: diagramDescription,
      self_critique: critiqueResult ? {
        overall_accuracy: critiqueResult.overall_accuracy,
        issues_found: critiqueResult.issues?.length || 0,
        fixes_recommended: critiqueResult.recommended_fixes?.length || 0,
        confidence: critiqueResult.confidence,
        critical_issues: critiqueResult.issues?.filter((i: any) => i.severity === 'critical').length || 0,
        moderate_issues: critiqueResult.issues?.filter((i: any) => i.severity === 'moderate').length || 0,
        minor_issues: critiqueResult.issues?.filter((i: any) => i.severity === 'minor').length || 0
      } : null
    };

    console.log('Final layout complete:', metadata);
    console.log('[PROGRESS] final_processing | 100% | Final layout complete');

    // Credit was already reserved
    console.log('✅ Usage tracked via reservation for user:', user.id);
    figureGenerationSucceeded = true;

    return new Response(
      JSON.stringify({
        diagramDescription,
        analysis,
        proposed_layout: proposedLayout,
        layout: finalLayout,
        checks,
        metadata,
        critique: critiqueResult || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

    } finally {
      if (!figureGenerationSucceeded && reservationId) {
        console.log('🔄 Releasing reservation due to generation failure:', reservationId);
        await supabaseAdmin.rpc('release_generation_reservation', { _reservation_id: reservationId }).catch(() => {});
      }
    }

  } catch (error: any) {
    console.error('Function error:', error);
    if (creditIds.length > 0 && supabaseForRefund) {
      await refundGenerations(supabaseForRefund, creditIds);
    }
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
