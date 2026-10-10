/**
 * designer.ts — Agent 2: the DESIGNER.
 *
 * Turns the approved plan (and prose) into the strict raw SciDiagram JSON via
 * Gemini's schema-constrained output. Also runs the repair passes: when the
 * Gatekeeper or Reviewer reports problems, the orchestrator re-invokes the
 * Designer with those problems as REPAIR NOTES.
 */
import { Category, SCHEMAS, SYSTEM_PROMPTS, REFINE_NOTE, toGeminiSchema } from "./schema.ts";
import { geminiStructured } from "./llm.ts";

const DESIGNER_NOTE = [
  "You are the DESIGN agent of a multi-agent pipeline.",
  "- If an APPROVED PLAN is supplied, follow it faithfully: include exactly the",
  "  entities and relationships it lists, in the compartments/scenario it gives.",
  "- If REPAIR NOTES are supplied, your previous attempt failed validation —",
  "  fix every listed problem.",
].join("\n");

export interface DesignContext {
  category: Category;
  prose: string;
  plan: unknown | null;
  instruction: string | null; // refine mode
  current: unknown | null;     // refine mode
}

export async function runDesigner(
  ctx: DesignContext, repairNotes: string[], model: string, apiKey: string,
): Promise<unknown> {
  const { category, prose, plan, instruction, current } = ctx;

  let system = `${SYSTEM_PROMPTS[category]}\n\n${DESIGNER_NOTE}`;
  if (instruction) system += `\n\n${REFINE_NOTE}`;

  let user = instruction && current
    ? `Current ${category} diagram as JSON:\n${JSON.stringify(current).slice(0, 12000)}\n\n` +
      `Apply this instruction and return the COMPLETE updated diagram:\n${instruction}`
    : `Build a ${category} diagram for this text:\n\n${prose}`;

  if (plan) {
    user += `\n\nAPPROVED PLAN — follow it exactly:\n${JSON.stringify(plan).slice(0, 6000)}`;
  }
  if (repairNotes.length) {
    user += `\n\nREPAIR NOTES — the previous attempt had these problems, fix them all:\n- ` +
      repairNotes.join("\n- ");
  }

  return await geminiStructured(
    model, apiKey, system, user, toGeminiSchema(SCHEMAS[category]),
    { temperature: 0.2, maxOutputTokens: 4096 },
  );
}
