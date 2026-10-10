/**
 * reviewer.ts — Agent 3: the REVIEWER (QA critic).
 *
 * Given the source intent and the designed JSON, judges whether the diagram is
 * a scientifically faithful, complete representation. Returns a compact verdict
 * { ok, issues[] }; the orchestrator feeds any issues back to the Designer.
 * A reviewer failure is treated as a pass — it must never block a valid diagram.
 */
import { Category } from "./schema.ts";
import { geminiJson } from "./llm.ts";

const PROMPT = [
  "You are the QA REVIEW agent for a scientific-diagram pipeline.",
  "You are given the source text (or an edit instruction) and a proposed diagram",
  "as JSON. Judge whether the diagram faithfully and completely represents the",
  "science.",
  "Flag SUBSTANTIVE problems only:",
  "- missing key entities, steps, atoms or forces the text clearly requires",
  "- wrong relationships, or wrong direction of signal/flow",
  "- wrong subcellular compartment, or forces inconsistent with the scenario",
  "  (e.g. a normal force when the object is in free fall)",
  "- spurious elements not supported by the text",
  "Do NOT comment on styling, colours, coordinates or layout.",
  'Respond with a single JSON object: {"ok": boolean, "issues": string[]}.',
  "Set ok=true and issues=[] when the diagram is sound. Otherwise each issue must",
  "be one short, actionable correction the designer can apply.",
].join("\n");

export interface Review { ok: boolean; issues: string[]; }

export async function runReviewer(
  category: Category, intent: string, raw: unknown, model: string, apiKey: string,
): Promise<Review> {
  try {
    const r = await geminiJson(
      model, apiKey, PROMPT,
      `Source intent:\n${intent}\n\nProposed ${category} diagram JSON:\n` +
        JSON.stringify(raw).slice(0, 12000),
      { temperature: 0.2, maxOutputTokens: 3072 },
    ) as { ok?: unknown; issues?: unknown };
    return {
      ok: r?.ok === true,
      issues: Array.isArray(r?.issues) ? r.issues.slice(0, 8).map(String) : [],
    };
  } catch (e) {
    console.error("Reviewer failed — treated as pass:", e);
    return { ok: true, issues: [] };
  }
}
