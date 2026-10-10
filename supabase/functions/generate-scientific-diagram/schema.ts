/**
 * generate-scientific-diagram — Step 2: Scientific JSON Extraction Layer
 * ----------------------------------------------------------------------
 * The LLM's job is SEMANTICS, not geometry. It converts scientific prose into
 * a "raw" structured graph. The edge function then NORMALISES that raw graph
 * into the renderer's `SciDiagram` shape (Step 1) — adding any coordinates the
 * renderer needs (chemical atom positions are synthesised in index.ts).
 *
 * "Structured Outputs" = Gemini `responseSchema`: each category has a strict
 * schema passed in `generationConfig.responseSchema` with
 * `responseMimeType: "application/json"`. Gemini MUST return a JSON object
 * conforming to it — no prose, no markdown fences, no parsing guesswork.
 * (Schemas are authored as JSON Schema here; index.ts down-converts them to
 * Gemini's OpenAPI dialect — uppercased types, no `additionalProperties`.)
 */

export type Category = "cellular" | "chemical" | "physics" | "lab";

/* ──────────────── TypeScript schema — the LLM's raw output ──────────────── */

export interface RawCellular {
  title: string;
  /** 'compartments' = banded subcellular view; 'network' = plain graph */
  layout: "compartments" | "network";
  nodes: {
    id: string;
    label: string;
    /** present only in 'compartments' layout */
    layer?: "extracellular" | "membrane" | "cytoplasm" | "nucleus";
    type: "ligand" | "receptor" | "protein" | "complex" | "gene";
  }[];
  edges: {
    from: string;
    to: string;
    effect: "activate" | "inhibit";
    label?: string;
  }[];
}

export interface RawChemical {
  title: string;
  /** Atoms carry NO coordinates — index.ts runs a force-directed layout. */
  atoms: { id: string; element: string }[];
  bonds: {
    from: string;
    to: string;
    order: "single" | "double" | "triple" | "ionic";
  }[];
}

export interface RawPhysics {
  title: string;
  massLabel: string;
  massValue?: string;
  forces: {
    id: string;
    label: string;
    type: "gravity" | "normal" | "tension" | "friction" | "applied" | "drag";
    /** newtons */
    magnitude: number;
    /** standard maths convention: 0 = right, 90 = up, 180 = left, 270 = down */
    angleDeg: number;
  }[];
}

export interface RawLab {
  title: string;
  steps: { id: string; label: string; apparatus: string }[];
  edges: { from: string; to: string; label?: string }[];
}

export type RawDiagram = RawCellular | RawChemical | RawPhysics | RawLab;

/* ────────────────────── JSON Schemas (tool input) ─────────────────────── */

const str = { type: "string" } as const;
const enumOf = (...v: string[]) => ({ type: "string", enum: v });

const CELLULAR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "layout", "nodes", "edges"],
  properties: {
    title: { ...str, description: "Concise diagram name, < 48 chars" },
    layout: {
      ...enumOf("compartments", "network"),
      description:
        "'compartments' ONLY when the diagram genuinely depicts entities in " +
        "distinct subcellular compartments with signalling between them " +
        "(extracellular ligand to membrane receptor to cytoplasm to nucleus). " +
        "Otherwise 'network' — a plain relationship graph with NO compartments.",
    },
    nodes: {
      type: "array",
      minItems: 3,
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "type"],
        properties: {
          id: { ...str, description: "Unique short id, letters/numbers only" },
          label: { ...str, description: "Entity name, 1-3 words" },
          layer: {
            ...enumOf("extracellular", "membrane", "cytoplasm", "nucleus"),
            description:
              "Subcellular compartment. REQUIRED when layout is 'compartments'; " +
              "OMIT entirely when layout is 'network'.",
          },
          type: enumOf("ligand", "receptor", "protein", "complex", "gene"),
        },
      },
    },
    edges: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "effect"],
        properties: {
          from: { ...str, description: "Source node id" },
          to: { ...str, description: "Target node id" },
          effect: enumOf("activate", "inhibit"),
          label: { ...str, description: "Optional verb, 1-2 words" },
        },
      },
    },
  },
} as const;

const CHEMICAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "atoms", "bonds"],
  properties: {
    title: { ...str, description: "Compound name + formula, e.g. 'Ethanol (C₂H₆O)'" },
    atoms: {
      type: "array",
      minItems: 2,
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "element"],
        properties: {
          id: { ...str, description: "Unique id, e.g. C1, O1, H3" },
          element: { ...str, description: "Element symbol: C, H, O, N, …" },
        },
      },
    },
    bonds: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "order"],
        properties: {
          from: { ...str, description: "Atom id" },
          to: { ...str, description: "Atom id" },
          order: enumOf("single", "double", "triple", "ionic"),
        },
      },
    },
  },
} as const;

const PHYSICS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "massLabel", "forces"],
  properties: {
    title: { ...str, description: "Diagram name, e.g. 'Free-Body Diagram — Crate'" },
    massLabel: { ...str, description: "Name of the central object" },
    massValue: { ...str, description: "Optional mass with unit, e.g. '5 kg'" },
    forces: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "type", "magnitude", "angleDeg"],
        properties: {
          id: str,
          label: { ...str, description: "Force name, e.g. 'Gravity'" },
          type: enumOf("gravity", "normal", "tension", "friction", "applied", "drag"),
          magnitude: { type: "number", description: "Magnitude in newtons (N)" },
          angleDeg: {
            type: "number",
            description: "Direction in degrees. 0=right, 90=up, 180=left, 270=down.",
          },
        },
      },
    },
  },
} as const;

const LAB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "steps", "edges"],
  properties: {
    title: { ...str, description: "Setup name, e.g. 'Simple Distillation Setup'" },
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "apparatus"],
        properties: {
          id: str,
          label: { ...str, description: "Stage name, 1-3 words" },
          apparatus: { ...str, description: "Equipment used at this stage" },
        },
      },
    },
    edges: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: {
          from: str,
          to: str,
          label: { ...str, description: "Optional flow label, 1-2 words" },
        },
      },
    },
  },
} as const;

export const SCHEMAS: Record<Category, Record<string, unknown>> = {
  cellular: CELLULAR_SCHEMA,
  chemical: CHEMICAL_SCHEMA,
  physics: PHYSICS_SCHEMA,
  lab: LAB_SCHEMA,
};

/* ─────────────────────────── System prompts ────────────────────────────── */

const BASE = [
  "You are a scientific illustration engine. You convert scientific prose into",
  "a single JSON object that strictly conforms to the response schema.",
  "Rules:",
  "- Output JSON only — no prose, no markdown, no code fences.",
  "- Use correct scientific nomenclature; keep labels short (1-3 words).",
  "- Every edge `from`/`to` MUST reference an existing node/atom/step `id`.",
  "- Ids must be unique and contain only letters and digits.",
  "- If the prose is sparse, infer the standard textbook version of the system.",
].join("\n");

/** Appended to the category prompt when editing an existing diagram. */
export const REFINE_NOTE = [
  "EDIT MODE: You are modifying an existing diagram supplied as JSON.",
  "- Apply ONLY the change the instruction asks for.",
  "- Keep every other node/atom/force/step — and its `id` — exactly as given.",
  "- Return the COMPLETE updated diagram (the whole structure, never a diff).",
  "- New elements get fresh unique ids; do not renumber existing ones.",
].join("\n");

export const SYSTEM_PROMPTS: Record<Category, string> = {
  cellular: [
    BASE,
    "",
    "CELLULAR DIAGRAM rules:",
    "- FIRST choose `layout`:",
    "  • 'compartments' — ONLY when the science genuinely spans distinct",
    "    subcellular compartments with signalling between them (extracellular",
    "    ligand → membrane receptor → cytoplasm → nucleus). Then give EVERY",
    "    node its `layer`.",
    "  • 'network' — for everything else: protein-interaction networks, enzyme",
    "    mechanisms, regulatory or metabolic relationships. OMIT `layer` on all",
    "    nodes. Never invent compartments the topic does not call for.",
    "- Use `activate` for stimulatory steps and `inhibit` for suppressive ones.",
    "- Order edges to follow the natural direction of the process.",
  ].join("\n"),
  chemical: [
    BASE,
    "",
    "CHEMICAL STRUCTURE rules:",
    "- Output the connectivity graph only: atoms (element symbol) and bonds.",
    "- Represent aromatic rings with alternating single/double bonds.",
    "- Include hydrogen atoms when the prose implies a full structural formula;",
    "  omit them for skeletal/condensed descriptions.",
    "- Bond order: covalent → single/double/triple; salt-like → ionic.",
  ].join("\n"),
  physics: [
    BASE,
    "",
    "FORCE VECTOR rules:",
    "- Direction in degrees, maths convention: 0=right, 90=up, 180=left, 270=down.",
    "- Gravity/weight points down (270). A normal force on a flat floor points",
    "  up (90). Tension points along the rope away from the mass.",
    "- If a magnitude is not stated, estimate it from the prose (e.g. weight =",
    "  mass × 9.8) and keep the diagram physically consistent.",
  ].join("\n"),
  lab: [
    BASE,
    "",
    "LAB SETUP rules:",
    "- Order `steps` in the physical/temporal sequence of the procedure.",
    "- `apparatus` names the concrete equipment for each stage.",
    "- Edges connect consecutive stages and may carry a short flow label.",
  ].join("\n"),
};

/* ───────────────────── Gemini schema down-conversion ───────────────────── */
/* Convert an authored JSON Schema to Gemini's OpenAPI dialect: uppercase
 * `type`, and drop keys Gemini's constrained decoder rejects or that blow up
 * its state machine — `additionalProperties`, plus array-length and numeric
 * bounds (these cause "too many states for serving"). */
const GEMINI_STRIP = new Set([
  "additionalProperties", "minItems", "maxItems",
  "minimum", "maximum", "minLength", "maxLength",
]);

export function toGeminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (s && typeof s === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) {
      if (GEMINI_STRIP.has(k)) continue;
      if (k === "type" && typeof v === "string") { out.type = v.toUpperCase(); continue; }
      out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return s;
}
