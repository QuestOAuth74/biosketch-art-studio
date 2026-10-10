/**
 * sciPalettes — Step 4: global styling palettes + per-node style variants.
 *
 * A `SciTheme` is the full colour contract every renderer consumes. Three
 * palettes ship: 'Textbook Modern' (vibrant), 'Academic Publication'
 * (grayscale / high contrast) and 'Presentation Dark'.
 *
 * `variantStyle()` resolves a single node's appearance — filled / outline /
 * x-ray schematic — on top of whichever palette is active.
 */
import {
  NODE_FILL, FORCE_COLOR, ELEMENT_STYLE,
  type CellLayer, type CellNodeType, type ForceType,
} from "./sciDiagram";

export type PaletteId = "textbook" | "academic" | "dark";
export type NodeVariant = "filled" | "outline" | "xray";

export interface SciTheme {
  id: PaletteId;
  name: string;
  /* canvas */
  canvasBg: string;
  gridStroke: string;
  title: string;
  muted: string;
  halo: string;            // text-outline colour (matches the background)
  stroke: string;          // default shape outline
  /* cellular */
  layerFill: Record<CellLayer, string>;
  nodeFill: Record<CellNodeType, string>;
  nodeText: string;
  membraneHead: string;
  membraneTail: string;
  activate: string;
  inhibit: string;
  /* chemical */
  element: Record<string, { fill: string; text: string }>;
  elementDefault: { fill: string; text: string };
  bond: string;
  /* physics */
  force: Record<ForceType, string>;
  massFill: string;
  massText: string;
  massSub: string;
  ground: string;
  /* lab */
  labFill: string;
  labStroke: string;
  labText: string;
  labSub: string;
}

/* ─────────────────────────── Textbook Modern ───────────────────────────── */
const TEXTBOOK: SciTheme = {
  id: "textbook",
  name: "Textbook Modern",
  canvasBg: "#fbfaf8",
  gridStroke: "#efede7",
  title: "#0f172a",
  muted: "#64748b",
  halo: "#ffffff",
  stroke: "#1e293b",
  layerFill: {
    extracellular: "#eef2ff",
    membrane: "#fef3c7",
    cytoplasm: "#ecfdf5",
    nucleus: "#fce7f3",
  },
  nodeFill: NODE_FILL,
  nodeText: "#0f172a",
  membraneHead: "#f59e0b",
  membraneTail: "#fcd34d",
  activate: "#16a34a",
  inhibit: "#dc2626",
  element: ELEMENT_STYLE,
  elementDefault: { fill: "#94a3b8", text: "#fff" },
  bond: "#1e293b",
  force: FORCE_COLOR,
  massFill: "#1e293b",
  massText: "#ffffff",
  massSub: "#94a3b8",
  ground: "#cbd5e1",
  labFill: "#fff7ed",
  labStroke: "#9a3412",
  labText: "#7c2d12",
  labSub: "#9a3412",
};

/* ───────────────────────── Academic Publication ────────────────────────── */
const ACADEMIC: SciTheme = {
  id: "academic",
  name: "Academic Publication",
  canvasBg: "#ffffff",
  gridStroke: "#f1f1f1",
  title: "#000000",
  muted: "#555555",
  halo: "#ffffff",
  stroke: "#111111",
  layerFill: {
    extracellular: "#f4f4f5",
    membrane: "#e4e4e7",
    cytoplasm: "#fafafa",
    nucleus: "#ececee",
  },
  nodeFill: {
    ligand: "#e5e5e5",
    receptor: "#d4d4d4",
    protein: "#ededed",
    complex: "#dcdcdc",
    gene: "#e0e0e0",
  },
  nodeText: "#000000",
  membraneHead: "#71717a",
  membraneTail: "#a1a1aa",
  activate: "#111111",
  inhibit: "#111111",
  element: {
    C: { fill: "#1f2937", text: "#ffffff" },
    H: { fill: "#ffffff", text: "#111111" },
    O: { fill: "#6b7280", text: "#ffffff" },
    N: { fill: "#9ca3af", text: "#111111" },
    S: { fill: "#4b5563", text: "#ffffff" },
    P: { fill: "#374151", text: "#ffffff" },
  },
  elementDefault: { fill: "#d1d5db", text: "#111111" },
  bond: "#111111",
  force: {
    gravity: "#111111",
    normal: "#454545",
    tension: "#6b6b6b",
    friction: "#222222",
    applied: "#565656",
    drag: "#7c7c7c",
  },
  massFill: "#111111",
  massText: "#ffffff",
  massSub: "#aaaaaa",
  ground: "#999999",
  labFill: "#f4f4f5",
  labStroke: "#111111",
  labText: "#000000",
  labSub: "#555555",
};

/* ───────────────────────────── Presentation Dark ───────────────────────── */
const DARK: SciTheme = {
  id: "dark",
  name: "Presentation Dark",
  canvasBg: "#0f172a",
  gridStroke: "#1e293b",
  title: "#f1f5f9",
  muted: "#94a3b8",
  halo: "#0f172a",
  stroke: "#cbd5e1",
  layerFill: {
    extracellular: "#1e2a4a",
    membrane: "#3a2e0a",
    cytoplasm: "#0f2e22",
    nucleus: "#3a1030",
  },
  nodeFill: {
    ligand: "#db2777",
    receptor: "#d97706",
    protein: "#059669",
    complex: "#0284c7",
    gene: "#9333ea",
  },
  nodeText: "#ffffff",
  membraneHead: "#f59e0b",
  membraneTail: "#b45309",
  activate: "#4ade80",
  inhibit: "#f87171",
  element: {
    C: { fill: "#cbd5e1", text: "#0f172a" },
    H: { fill: "#475569", text: "#f1f5f9" },
    O: { fill: "#f87171", text: "#0f172a" },
    N: { fill: "#60a5fa", text: "#0f172a" },
    S: { fill: "#facc15", text: "#0f172a" },
    P: { fill: "#fb923c", text: "#0f172a" },
  },
  elementDefault: { fill: "#64748b", text: "#ffffff" },
  bond: "#cbd5e1",
  force: {
    gravity: "#818cf8",
    normal: "#38bdf8",
    tension: "#fbbf24",
    friction: "#f87171",
    applied: "#34d399",
    drag: "#a78bfa",
  },
  massFill: "#f1f5f9",
  massText: "#0f172a",
  massSub: "#475569",
  ground: "#334155",
  labFill: "#2a1a05",
  labStroke: "#fdba74",
  labText: "#fed7aa",
  labSub: "#fdba74",
};

export const PALETTES: Record<PaletteId, SciTheme> = {
  textbook: TEXTBOOK,
  academic: ACADEMIC,
  dark: DARK,
};

export const PALETTE_LIST: SciTheme[] = [TEXTBOOK, ACADEMIC, DARK];

/* ───────────────────────── per-node style variants ─────────────────────── */

export interface ShapeStyle {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  dash?: string;
}

/** Resolve one node's look given its base fill, the palette and a variant. */
export function variantStyle(
  baseFill: string,
  theme: SciTheme,
  variant: NodeVariant = "filled",
): ShapeStyle {
  switch (variant) {
    case "outline":
      return { fill: theme.canvasBg, fillOpacity: 1, stroke: theme.stroke, strokeWidth: 2.4 };
    case "xray":
      return { fill: baseFill, fillOpacity: 0.22, stroke: theme.stroke, strokeWidth: 1.6, dash: "6 4" };
    case "filled":
    default:
      return { fill: baseFill, fillOpacity: 1, stroke: theme.stroke, strokeWidth: 1.4 };
  }
}

export const VARIANT_LABELS: { id: NodeVariant; label: string; hint: string }[] = [
  { id: "filled", label: "Filled", hint: "Solid colour block" },
  { id: "outline", label: "Outline", hint: "Hollow with bold stroke" },
  { id: "xray", label: "X-Ray", hint: "Translucent schematic view" },
];
