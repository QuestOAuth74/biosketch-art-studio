/**
 * llm.ts — shared Gemini access for the multi-agent diagram pipeline.
 *   geminiJson       — free-form JSON output (Planner, Reviewer)
 *   geminiStructured — schema-constrained JSON output (Designer)
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GenOpts {
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

// deno-lint-ignore no-explicit-any
function extractText(result: any): string {
  const t = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof t === "string" && t.length) return t;
  const reason = result?.candidates?.[0]?.finishReason
    ?? result?.promptFeedback?.blockReason ?? "unknown";
  throw new Error(`model returned no content (reason: ${reason})`);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/); // tolerate stray prose / code fences
    if (m) return JSON.parse(m[0]);
    throw new Error("model did not return valid JSON");
  }
}

async function call(
  model: string, apiKey: string, body: Record<string, unknown>, timeoutMs: number,
): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Gemini ${model} ${res.status}: ${t.slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Free-form JSON output — used by the Planner and Reviewer agents. */
export async function geminiJson(
  model: string, apiKey: string, system: string, user: string, opts: GenOpts = {},
): Promise<unknown> {
  const result = await call(model, apiKey, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
  }, opts.timeoutMs ?? 80_000);
  return parseJson(extractText(result));
}

/** Schema-constrained JSON output — used by the Designer agent. */
export async function geminiStructured(
  model: string, apiKey: string, system: string, user: string,
  schema: unknown, opts: GenOpts = {},
): Promise<unknown> {
  const result = await call(model, apiKey, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
  }, opts.timeoutMs ?? 80_000);
  return parseJson(extractText(result));
}
