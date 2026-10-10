/**
 * planner.ts — Agent 1: the PLANNER.
 *
 * Reads the prose and reasons about what the diagram must contain BEFORE any
 * rigid schema is involved. Emits a loose JSON "plan" the Designer follows.
 * Runs on a stronger model (gemini-2.5-pro) for better scientific reasoning.
 * If it fails, the pipeline degrades gracefully (Designer works without a plan).
 */
import { Category } from "./schema.ts";
import { geminiJson } from "./llm.ts";

const BASE = [
  "You are the PLANNING agent in a scientific-diagram pipeline.",
  "You do NOT draw the diagram — you produce a concise JSON PLAN that a",
  "downstream designer will turn into structure. Reason rigorously about the",
  "science first. Output a single JSON object, no prose, no code fences.",
].join("\n");

const PROMPTS: Record<Category, string> = {
  cellular: [
    BASE, "",
    "For a CELLULAR diagram, FIRST decide the layout — this is the most",
    "important decision:",
    '- "layout": "compartments" ONLY when the science genuinely spans distinct',
    "  subcellular compartments with signalling between them (e.g. an",
    "  extracellular ligand → membrane receptor → cytoplasmic kinases →",
    "  nuclear transcription). Use \"network\" for everything else —",
    "  protein-interaction networks, enzyme mechanisms, metabolic or regulatory",
    "  graphs. Do NOT default to compartments; most topics are networks.",
    "The plan JSON must contain:",
    '- "summary": one sentence.',
    '- "layout": "compartments" | "network".',
    '- "compartments": for "compartments" layout, the subset of',
    "  extracellular/membrane/cytoplasm/nucleus actually used; [] for network.",
    '- "entities": [{ "name", "compartment" (null in network layout), "role" }].',
    '- "relations": [{ "from", "to", "effect" }] in process-flow order.',
  ].join("\n"),
  chemical: [
    BASE, "",
    "For a CHEMICAL structure, the plan JSON must contain:",
    '- "summary", "formula".',
    '- "skeleton": describe rings (size, aromatic?) and chains.',
    '- "atoms": [{ "label", "element" }] — every atom; include hydrogens when the',
    "  description implies a full structural formula, omit them when skeletal.",
    '- "bonds": [{ "a", "b", "order" }] — order single|double|triple|ionic.',
  ].join("\n"),
  physics: [
    BASE, "",
    "For a FORCE (free-body) diagram, the plan JSON must contain:",
    '- "summary", "object" (the central mass), "massValue" if stated.',
    '- "scenario": short phrase — e.g. "resting on a horizontal surface",',
    '  "in free fall", "projectile in flight", "in orbit", "suspended by a rope".',
    '- "onSurface": boolean — true ONLY if the object contacts a surface.',
    '- "forces": [{ "label", "type", "magnitude", "angleDeg" }]. Use the maths',
    "  convention 0=right, 90=up, 180=left, 270=down. Include ONLY forces that",
    "  actually act in this scenario — no normal force without a surface.",
  ].join("\n"),
  lab: [
    BASE, "",
    "For a LAB apparatus setup, the plan JSON must contain:",
    '- "summary".',
    '- "stages": [{ "label", "apparatus" }] in physical/temporal order.',
    '- "flow": [{ "from", "to", "label" }] linking consecutive stages.',
  ].join("\n"),
};

export async function runPlanner(
  category: Category, prose: string, model: string, apiKey: string,
): Promise<unknown | null> {
  try {
    return await geminiJson(
      model, apiKey, PROMPTS[category],
      `Plan a ${category} diagram for this text:\n\n${prose}`,
      { temperature: 0.4, maxOutputTokens: 8192 },
    );
  } catch (e) {
    console.error("Planner failed — continuing without a plan:", e);
    return null;
  }
}
