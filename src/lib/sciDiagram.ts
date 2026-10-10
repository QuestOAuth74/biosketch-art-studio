/**
 * sciDiagram — shared model, constants and layout-result types for the
 * Scientific Illustrator. Imported by both the page renderers and the
 * useScientificLayout hook (kept here so the two never import each other).
 */

/* ════════════════════════════ DIAGRAM MODEL ════════════════════════════ */

export type DiagramKind = "cellular" | "chemical" | "physics" | "lab";

/* ---- Cellular pathway ---- */
export type CellLayer = "extracellular" | "membrane" | "cytoplasm" | "nucleus";
export type CellNodeType = "ligand" | "receptor" | "protein" | "complex" | "gene";
export interface CellularNode {
  id: string;
  label: string;
  /** subcellular compartment — only present in the "compartments" layout */
  layer?: CellLayer;
  type: CellNodeType;
}
export interface CellularEdge {
  from: string;
  to: string;
  effect: "activate" | "inhibit";
  label?: string;
}
export interface CellularDiagram {
  kind: "cellular";
  title: string;
  /** "compartments" = banded subcellular view; "network" = plain relationship graph */
  layout: "compartments" | "network";
  nodes: CellularNode[];
  edges: CellularEdge[];
}

/* ---- Chemical structure ---- */
export type BondOrder = "single" | "double" | "triple" | "ionic";
export interface ChemAtom {
  id: string;
  element: string;
  /** normalised 0..1 coordinates within a square layout box */
  rx: number;
  ry: number;
}
export interface ChemBond {
  from: string;
  to: string;
  order: BondOrder;
}
export interface ChemicalDiagram {
  kind: "chemical";
  title: string;
  atoms: ChemAtom[];
  bonds: ChemBond[];
}

/* ---- Physics force vectors ---- */
export type ForceType =
  | "gravity" | "normal" | "tension" | "friction" | "applied" | "drag";
export interface ForceVector {
  id: string;
  label: string;
  type: ForceType;
  magnitude: number;
  /** standard maths convention: 0 = right, 90 = up */
  angleDeg: number;
}
export interface PhysicsDiagram {
  kind: "physics";
  title: string;
  massLabel: string;
  massValue?: string;
  forces: ForceVector[];
}

/* ---- Lab equipment flow ---- */
export interface LabStep {
  id: string;
  label: string;
  apparatus: string;
}
export interface LabEdge {
  from: string;
  to: string;
  label?: string;
}
export interface LabDiagram {
  kind: "lab";
  title: string;
  steps: LabStep[];
  edges: LabEdge[];
}

export type SciDiagram =
  | CellularDiagram | ChemicalDiagram | PhysicsDiagram | LabDiagram;

/* ════════════════════════════ CANVAS CONSTANTS ═════════════════════════ */

export const CANVAS_W = 920;
export const PAD = 36;

export const CELL_LAYER_META: {
  id: CellLayer; label: string; fill: string; minH: number; thin?: boolean;
}[] = [
  { id: "extracellular", label: "Extracellular Space", fill: "#eef2ff", minH: 104 },
  { id: "membrane", label: "Plasma Membrane", fill: "#fef3c7", minH: 76, thin: true },
  { id: "cytoplasm", label: "Cytoplasm", fill: "#ecfdf5", minH: 124 },
  { id: "nucleus", label: "Nucleus", fill: "#fce7f3", minH: 120 },
];

export const NODE_FILL: Record<CellNodeType, string> = {
  ligand: "#fbcfe8",
  receptor: "#fde68a",
  protein: "#a7f3d0",
  complex: "#bae6fd",
  gene: "#f5d0fe",
};

export const FORCE_COLOR: Record<ForceType, string> = {
  gravity: "#6366f1",
  normal: "#0ea5e9",
  tension: "#f59e0b",
  friction: "#ef4444",
  applied: "#10b981",
  drag: "#8b5cf6",
};

export const ELEMENT_STYLE: Record<string, { fill: string; text: string }> = {
  C: { fill: "#334155", text: "#f8fafc" },
  H: { fill: "#f1f5f9", text: "#334155" },
  O: { fill: "#ef4444", text: "#fff" },
  N: { fill: "#3b82f6", text: "#fff" },
  S: { fill: "#eab308", text: "#fff" },
  P: { fill: "#f97316", text: "#fff" },
};
export const elStyle = (el: string) =>
  ELEMENT_STYLE[el] ?? { fill: "#94a3b8", text: "#fff" };

/* ════════════════════════ ELASTIC SIZING HELPERS ═══════════════════════ */
/* A node's footprint grows with its label — the heart of "elastic design".
 * Layout consumes these so geometry adapts when text changes. */

export const nodeWidth = (label: string) =>
  Math.max(104, label.length * 7.4 + 30);

/** Atom radius expands for multi-character element symbols. */
export const atomRadius = (element: string) =>
  element === "H" ? 13 : 17 + (Math.max(element.length, 1) - 1) * 5;

/* ════════════════════════════ LAYOUT RESULTS ═══════════════════════════ */

export interface Box { x: number; y: number; w: number; h: number; }

export interface CellularLayout {
  kind: "cellular";
  width: number;
  height: number;
  layers: { id: CellLayer; label: string; y: number; h: number; fill: string; thin?: boolean }[];
  nodes: Record<string, Box>;
}

export interface ChemAtomGeom { x: number; y: number; r: number; element: string; }
export interface ChemBondGeom {
  from: string; to: string; order: BondOrder;
  x1: number; y1: number; x2: number; y2: number;
}
export interface ChemicalLayout {
  kind: "chemical";
  width: number;
  height: number;
  /** square layout box — used to invert pointer coords back to rx/ry on drag */
  box: number; ox: number; oy: number;
  atoms: Record<string, ChemAtomGeom>;
  bonds: ChemBondGeom[];
}

export interface ForceGeom {
  id: string; label: string; type: ForceType; magnitude: number; angleDeg: number;
  dx: number; dy: number;
  tipX: number; tipY: number;
  labelX: number; labelY: number;
}
export interface PhysicsLayout {
  kind: "physics";
  width: number;
  height: number;
  center: { x: number; y: number };
  forces: ForceGeom[];
}

export interface LabLayout {
  kind: "lab";
  width: number;
  height: number;
  steps: Record<string, Box>;
}

export type SciLayout = CellularLayout | ChemicalLayout | PhysicsLayout | LabLayout;

export const centerOf = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Point on box `b`'s perimeter along the ray from its centre toward (fx,fy). */
export function boundaryPoint(b: Box, fx: number, fy: number) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = fx - cx, dy = fy - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? (b.w / 2) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (b.h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}
