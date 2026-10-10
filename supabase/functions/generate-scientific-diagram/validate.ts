/**
 * validate.ts — the GATEKEEPER: deterministic, non-LLM validation.
 *
 * The hard guarantee of the pipeline. Checks structural integrity — unique
 * ids, every edge/bond references a real element, enums valid, minimum counts.
 * Failures are returned as human-readable strings that become REPAIR NOTES for
 * the Designer. JSON that can't render never reaches the renderer.
 */
import { Category } from "./schema.ts";

const LAYERS = ["extracellular", "membrane", "cytoplasm", "nucleus"];
const CELL_TYPES = ["ligand", "receptor", "protein", "complex", "gene"];
const FORCE_TYPES = ["gravity", "normal", "tension", "friction", "applied", "drag"];
const BOND_ORDERS = ["single", "double", "triple", "ionic"];

export interface GateResult { ok: boolean; errors: string[]; }

// deno-lint-ignore no-explicit-any
export function validateRaw(category: Category, raw: any): GateResult {
  const errors: string[] = [];
  const push = (m: string) => { if (errors.length < 12) errors.push(m); };

  if (!raw || typeof raw !== "object") return { ok: false, errors: ["model produced no object"] };
  if (!raw.title || typeof raw.title !== "string") push("the diagram is missing a title");

  if (category === "cellular") {
    const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
    if (nodes.length === 0) push("the pathway has no nodes");
    const ids = new Set<string>();
    for (const n of nodes) {
      if (!n?.id) { push("a node is missing its id"); continue; }
      if (ids.has(n.id)) push(`duplicate node id "${n.id}"`);
      ids.add(n.id);
      if (!n.label) push(`node "${n.id}" has no label`);
      if (n.layer !== undefined && !LAYERS.includes(n.layer))
        push(`node "${n.id}" has invalid layer "${n.layer}"`);
      if (!CELL_TYPES.includes(n.type)) push(`node "${n.id}" has invalid type "${n.type}"`);
    }
    for (const e of Array.isArray(raw.edges) ? raw.edges : []) {
      if (!ids.has(e?.from)) push(`an edge starts from missing node "${e?.from}"`);
      if (!ids.has(e?.to)) push(`an edge points to missing node "${e?.to}"`);
      if (e?.effect !== "activate" && e?.effect !== "inhibit")
        push(`edge ${e?.from}→${e?.to} has invalid effect "${e?.effect}"`);
    }
  } else if (category === "chemical") {
    const atoms = Array.isArray(raw.atoms) ? raw.atoms : [];
    if (atoms.length < 2) push("the molecule has fewer than 2 atoms");
    const ids = new Set<string>();
    for (const a of atoms) {
      if (!a?.id) { push("an atom is missing its id"); continue; }
      if (ids.has(a.id)) push(`duplicate atom id "${a.id}"`);
      ids.add(a.id);
      if (!a.element) push(`atom "${a.id}" has no element symbol`);
    }
    for (const b of Array.isArray(raw.bonds) ? raw.bonds : []) {
      if (!ids.has(b?.from)) push(`a bond references missing atom "${b?.from}"`);
      if (!ids.has(b?.to)) push(`a bond references missing atom "${b?.to}"`);
      if (!BOND_ORDERS.includes(b?.order)) push(`a bond has invalid order "${b?.order}"`);
    }
  } else if (category === "physics") {
    if (!raw.massLabel) push("the central object (massLabel) is missing");
    const forces = Array.isArray(raw.forces) ? raw.forces : [];
    if (forces.length === 0) push("no forces act on the object");
    const ids = new Set<string>();
    for (const f of forces) {
      if (!f?.id) { push("a force is missing its id"); continue; }
      if (ids.has(f.id)) push(`duplicate force id "${f.id}"`);
      ids.add(f.id);
      if (!f.label) push(`force "${f.id}" has no label`);
      if (!FORCE_TYPES.includes(f.type)) push(`force "${f.id}" has invalid type "${f.type}"`);
      if (typeof f.magnitude !== "number") push(`force "${f.id}" has a non-numeric magnitude`);
      if (typeof f.angleDeg !== "number") push(`force "${f.id}" has a non-numeric angle`);
    }
  } else {
    const steps = Array.isArray(raw.steps) ? raw.steps : [];
    if (steps.length < 2) push("the setup has fewer than 2 stages");
    const ids = new Set<string>();
    for (const s of steps) {
      if (!s?.id) { push("a stage is missing its id"); continue; }
      if (ids.has(s.id)) push(`duplicate stage id "${s.id}"`);
      ids.add(s.id);
      if (!s.label) push(`stage "${s.id}" has no label`);
    }
    for (const e of Array.isArray(raw.edges) ? raw.edges : []) {
      if (!ids.has(e?.from)) push(`a flow edge starts from missing stage "${e?.from}"`);
      if (!ids.has(e?.to)) push(`a flow edge points to missing stage "${e?.to}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}
