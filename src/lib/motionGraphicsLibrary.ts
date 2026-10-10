// ─── Motion Graphics Library ──────────────────────────────────────────────────
// Prebuilt multi-object animated compositions for scientific illustration.
// Each definition describes the objects to create and keyframes to apply.
// Pure TypeScript — no React or Fabric.js imports.

import type { EasingType, Keyframe, AnimatableProps } from "./animationEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MotionGraphicCategory =
  | "arrows-flow"
  | "callouts-labels"
  | "highlights"
  | "molecular"
  | "cellular"
  | "data-graphs"
  | "transitions"
  | "particles";

export interface MotionGraphicObject {
  /** Local ref within this graphic (e.g. "shaft", "head") */
  localId: string;
  /** Fabric object type */
  type: "rect" | "circle" | "triangle" | "textbox" | "line" | "path" | "polygon";
  /** Display name in objects panel */
  name: string;
  /** Fabric constructor props (width, height, fill, radius, text, etc.) */
  fabricProps: Record<string, any>;
  /** Position relative to insertion point center */
  relativeLeft: number;
  relativeTop: number;
}

export interface MotionGraphicKeyframes {
  /** References MotionGraphicObject.localId */
  objectRef: string;
  /** Keyframes with frame offsets relative to start (0-based) */
  keyframes: {
    frameOffset: number;
    properties: Partial<AnimatableProps>;
    easing: EasingType;
  }[];
}

export interface MotionGraphicDef {
  id: string;
  name: string;
  category: MotionGraphicCategory;
  description: string;
  /** Duration at 30fps baseline */
  durationFrames: number;
  /** Objects to create */
  objects: MotionGraphicObject[];
  /** Animation tracks for each object */
  tracks: MotionGraphicKeyframes[];
  /** Group name in the objects panel */
  groupName: string;
}

// ─── Category metadata ────────────────────────────────────────────────────────

export const MOTION_GRAPHIC_CATEGORIES: {
  id: MotionGraphicCategory;
  label: string;
  icon: string;
}[] = [
  { id: "arrows-flow", label: "Arrows & Flow", icon: "MoveRight" },
  { id: "callouts-labels", label: "Callouts & Labels", icon: "MessageSquare" },
  { id: "highlights", label: "Highlights", icon: "Crosshair" },
  { id: "molecular", label: "Molecular", icon: "Atom" },
  { id: "cellular", label: "Cellular", icon: "Dna" },
  { id: "data-graphs", label: "Data & Graphs", icon: "BarChart3" },
  { id: "transitions", label: "Transitions", icon: "Layers" },
  { id: "particles", label: "Particles", icon: "Sparkles" },
];

// ─── Helper to build absolute keyframes from definition ───────────────────────

export function buildKeyframes(
  track: MotionGraphicKeyframes,
  startFrame: number,
  fpsScale: number,
): Keyframe[] {
  return track.keyframes.map((kf) => ({
    frame: startFrame + Math.round(kf.frameOffset * fpsScale),
    properties: { ...kf.properties },
    easing: kf.easing,
  }));
}

// ─── Built-in Motion Graphics ─────────────────────────────────────────────────

export const MOTION_GRAPHICS: MotionGraphicDef[] = [
  // ════════════════════════════════════════════════════════════════════════════
  // ARROWS & FLOW
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "mg-growing-arrow",
    name: "Growing Arrow",
    category: "arrows-flow",
    description: "Arrow shaft extends then arrowhead pops in",
    durationFrames: 25,
    groupName: "Growing Arrow",
    objects: [
      {
        localId: "shaft",
        type: "rect",
        name: "Arrow Shaft",
        fabricProps: { width: 120, height: 8, fill: "#6366f1", rx: 2, ry: 2, originX: "left", originY: "center" },
        relativeLeft: -60,
        relativeTop: 0,
      },
      {
        localId: "head",
        type: "triangle",
        name: "Arrowhead",
        fabricProps: { width: 20, height: 24, fill: "#6366f1", angle: 90, originX: "center", originY: "center" },
        relativeLeft: 70,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "shaft",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 3, properties: { opacity: 1 }, easing: "easeOut" },
          { frameOffset: 18, properties: { scaleX: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "head",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 14, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 22, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
    ],
  },
  {
    id: "mg-sequential-flow",
    name: "Sequential Flow",
    category: "arrows-flow",
    description: "Three nodes connected by lines, appearing in sequence",
    durationFrames: 45,
    groupName: "Sequential Flow",
    objects: [
      {
        localId: "node1",
        type: "circle",
        name: "Node 1",
        fabricProps: { radius: 18, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2 },
        relativeLeft: -100,
        relativeTop: 0,
      },
      {
        localId: "line1",
        type: "rect",
        name: "Connector 1",
        fabricProps: { width: 50, height: 3, fill: "#94a3b8", originX: "left" },
        relativeLeft: -63,
        relativeTop: 0,
      },
      {
        localId: "node2",
        type: "circle",
        name: "Node 2",
        fabricProps: { radius: 18, fill: "#8b5cf6", stroke: "#6d28d9", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "line2",
        type: "rect",
        name: "Connector 2",
        fabricProps: { width: 50, height: 3, fill: "#94a3b8", originX: "left" },
        relativeLeft: 37,
        relativeTop: 0,
      },
      {
        localId: "node3",
        type: "circle",
        name: "Node 3",
        fabricProps: { radius: 18, fill: "#10b981", stroke: "#059669", strokeWidth: 2 },
        relativeLeft: 100,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "node1",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 8, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "line1",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 8, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 16, properties: { scaleX: 1, opacity: 1 }, easing: "easeOut" },
        ],
      },
      {
        objectRef: "node2",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 16, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 24, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "line2",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 24, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 32, properties: { scaleX: 1, opacity: 1 }, easing: "easeOut" },
        ],
      },
      {
        objectRef: "node3",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 32, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 40, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
    ],
  },
  {
    id: "mg-bidirectional-exchange",
    name: "Bidirectional Exchange",
    category: "arrows-flow",
    description: "Two arrows moving in opposite directions — transport/exchange",
    durationFrames: 30,
    groupName: "Bidirectional Exchange",
    objects: [
      {
        localId: "arrow-right",
        type: "triangle",
        name: "Arrow Right",
        fabricProps: { width: 16, height: 20, fill: "#3b82f6", angle: 90 },
        relativeLeft: -40,
        relativeTop: -12,
      },
      {
        localId: "arrow-left",
        type: "triangle",
        name: "Arrow Left",
        fabricProps: { width: 16, height: 20, fill: "#ef4444", angle: -90 },
        relativeLeft: 40,
        relativeTop: 12,
      },
      {
        localId: "bar",
        type: "rect",
        name: "Exchange Bar",
        fabricProps: { width: 100, height: 2, fill: "#94a3b8" },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "arrow-right",
        keyframes: [
          { frameOffset: 0, properties: { left: -40, opacity: 0 }, easing: "linear" },
          { frameOffset: 5, properties: { opacity: 1 }, easing: "easeOut" },
          { frameOffset: 25, properties: { left: 40 }, easing: "easeInOut" },
          { frameOffset: 30, properties: { opacity: 0 }, easing: "easeIn" },
        ],
      },
      {
        objectRef: "arrow-left",
        keyframes: [
          { frameOffset: 0, properties: { left: 40, opacity: 0 }, easing: "linear" },
          { frameOffset: 5, properties: { opacity: 1 }, easing: "easeOut" },
          { frameOffset: 25, properties: { left: -40 }, easing: "easeInOut" },
          { frameOffset: 30, properties: { opacity: 0 }, easing: "easeIn" },
        ],
      },
      {
        objectRef: "bar",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 8, properties: { scaleX: 1, opacity: 0.6 }, easing: "easeOut" },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CALLOUTS & LABELS
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "mg-animated-label",
    name: "Animated Label",
    category: "callouts-labels",
    description: "Leader line draws in, then text label fades up",
    durationFrames: 30,
    groupName: "Animated Label",
    objects: [
      {
        localId: "leader",
        type: "rect",
        name: "Leader Line",
        fabricProps: { width: 60, height: 2, fill: "#94a3b8", originX: "left" },
        relativeLeft: -30,
        relativeTop: 0,
      },
      {
        localId: "dot",
        type: "circle",
        name: "Anchor Dot",
        fabricProps: { radius: 4, fill: "#6366f1" },
        relativeLeft: -34,
        relativeTop: 0,
      },
      {
        localId: "label",
        type: "textbox",
        name: "Label Text",
        fabricProps: { text: "Label", fontSize: 14, fill: "#e2e8f0", fontFamily: "Inter, sans-serif", width: 80 },
        relativeLeft: 40,
        relativeTop: -10,
      },
    ],
    tracks: [
      {
        objectRef: "dot",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 8, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "leader",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 6, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 18, properties: { scaleX: 1, opacity: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "label",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 16, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 26, properties: { opacity: 1 }, easing: "easeOut" },
        ],
      },
    ],
  },
  {
    id: "mg-numbered-steps",
    name: "Numbered Steps",
    category: "callouts-labels",
    description: "Steps 1-2-3 appear with staggered entrance",
    durationFrames: 40,
    groupName: "Numbered Steps",
    objects: [
      {
        localId: "step1-bg",
        type: "circle",
        name: "Step 1 Circle",
        fabricProps: { radius: 16, fill: "#3b82f6" },
        relativeLeft: -70,
        relativeTop: 0,
      },
      {
        localId: "step1-text",
        type: "textbox",
        name: "Step 1",
        fabricProps: { text: "1", fontSize: 16, fill: "#ffffff", fontFamily: "Inter, sans-serif", width: 20, textAlign: "center", fontWeight: "bold" },
        relativeLeft: -80,
        relativeTop: -10,
      },
      {
        localId: "step2-bg",
        type: "circle",
        name: "Step 2 Circle",
        fabricProps: { radius: 16, fill: "#8b5cf6" },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "step2-text",
        type: "textbox",
        name: "Step 2",
        fabricProps: { text: "2", fontSize: 16, fill: "#ffffff", fontFamily: "Inter, sans-serif", width: 20, textAlign: "center", fontWeight: "bold" },
        relativeLeft: -10,
        relativeTop: -10,
      },
      {
        localId: "step3-bg",
        type: "circle",
        name: "Step 3 Circle",
        fabricProps: { radius: 16, fill: "#10b981" },
        relativeLeft: 70,
        relativeTop: 0,
      },
      {
        localId: "step3-text",
        type: "textbox",
        name: "Step 3",
        fabricProps: { text: "3", fontSize: 16, fill: "#ffffff", fontFamily: "Inter, sans-serif", width: 20, textAlign: "center", fontWeight: "bold" },
        relativeLeft: 60,
        relativeTop: -10,
      },
    ],
    tracks: [
      {
        objectRef: "step1-bg",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 10, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "step1-text",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 8, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 14, properties: { opacity: 1 }, easing: "easeOut" },
        ],
      },
      {
        objectRef: "step2-bg",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 12, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 22, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "step2-text",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 20, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 26, properties: { opacity: 1 }, easing: "easeOut" },
        ],
      },
      {
        objectRef: "step3-bg",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 24, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 34, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "step3-text",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 32, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 38, properties: { opacity: 1 }, easing: "easeOut" },
        ],
      },
    ],
  },
  {
    id: "mg-bracket-annotation",
    name: "Bracket Annotation",
    category: "callouts-labels",
    description: "Curly bracket appears with annotation text",
    durationFrames: 25,
    groupName: "Bracket Annotation",
    objects: [
      {
        localId: "bracket-top",
        type: "rect",
        name: "Bracket Top",
        fabricProps: { width: 2, height: 40, fill: "#f59e0b", originX: "center", originY: "bottom" },
        relativeLeft: -30,
        relativeTop: -5,
      },
      {
        localId: "bracket-bottom",
        type: "rect",
        name: "Bracket Bottom",
        fabricProps: { width: 2, height: 40, fill: "#f59e0b", originX: "center", originY: "top" },
        relativeLeft: -30,
        relativeTop: 5,
      },
      {
        localId: "bracket-bar",
        type: "rect",
        name: "Bracket Bar",
        fabricProps: { width: 12, height: 2, fill: "#f59e0b" },
        relativeLeft: -24,
        relativeTop: 0,
      },
      {
        localId: "annotation",
        type: "textbox",
        name: "Annotation",
        fabricProps: { text: "Region", fontSize: 13, fill: "#fbbf24", fontFamily: "Inter, sans-serif", width: 80, fontStyle: "italic" },
        relativeLeft: 10,
        relativeTop: -8,
      },
    ],
    tracks: [
      {
        objectRef: "bracket-top",
        keyframes: [
          { frameOffset: 0, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 12, properties: { scaleY: 1, opacity: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "bracket-bottom",
        keyframes: [
          { frameOffset: 0, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 12, properties: { scaleY: 1, opacity: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "bracket-bar",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 10, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 16, properties: { scaleX: 1, opacity: 1 }, easing: "easeOut" },
        ],
      },
      {
        objectRef: "annotation",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 14, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 22, properties: { opacity: 1 }, easing: "easeOut" },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // HIGHLIGHTS
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "mg-pulsing-indicator",
    name: "Pulsing Indicator",
    category: "highlights",
    description: "Circle that pulses to draw attention to a region",
    durationFrames: 30,
    groupName: "Pulsing Indicator",
    objects: [
      {
        localId: "ring-outer",
        type: "circle",
        name: "Outer Ring",
        fabricProps: { radius: 24, fill: "transparent", stroke: "#ef4444", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "ring-inner",
        type: "circle",
        name: "Inner Dot",
        fabricProps: { radius: 6, fill: "#ef4444" },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "ring-outer",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0.5, scaleY: 0.5, opacity: 1 }, easing: "easeInOut" },
          { frameOffset: 15, properties: { scaleX: 1.3, scaleY: 1.3, opacity: 0.3 }, easing: "easeInOut" },
          { frameOffset: 30, properties: { scaleX: 0.5, scaleY: 0.5, opacity: 1 }, easing: "easeInOut" },
        ],
      },
      {
        objectRef: "ring-inner",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeInOut" },
          { frameOffset: 15, properties: { scaleX: 0.7, scaleY: 0.7, opacity: 0.6 }, easing: "easeInOut" },
          { frameOffset: 30, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeInOut" },
        ],
      },
    ],
  },
  {
    id: "mg-spotlight-reveal",
    name: "Spotlight Reveal",
    category: "highlights",
    description: "Glowing circle expands to highlight a region",
    durationFrames: 25,
    groupName: "Spotlight Reveal",
    objects: [
      {
        localId: "glow",
        type: "circle",
        name: "Spotlight Glow",
        fabricProps: { radius: 40, fill: "rgba(251,191,36,0.15)", stroke: "#fbbf24", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "crosshair-h",
        type: "rect",
        name: "Crosshair H",
        fabricProps: { width: 24, height: 1.5, fill: "#fbbf24" },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "crosshair-v",
        type: "rect",
        name: "Crosshair V",
        fabricProps: { width: 1.5, height: 24, fill: "#fbbf24" },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "glow",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 18, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "crosshair-h",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 12, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 22, properties: { scaleX: 1, opacity: 0.8 }, easing: "easeOut" },
        ],
      },
      {
        objectRef: "crosshair-v",
        keyframes: [
          { frameOffset: 0, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 12, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 22, properties: { scaleY: 1, opacity: 0.8 }, easing: "easeOut" },
        ],
      },
    ],
  },
  {
    id: "mg-region-zoom",
    name: "Region Zoom",
    category: "highlights",
    description: "Rectangle zooms into a region with a pulsing border",
    durationFrames: 30,
    groupName: "Region Zoom",
    objects: [
      {
        localId: "frame",
        type: "rect",
        name: "Zoom Frame",
        fabricProps: { width: 80, height: 60, fill: "transparent", stroke: "#22d3ee", strokeWidth: 2.5, rx: 4, ry: 4 },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "frame",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 2.5, scaleY: 2.5, opacity: 0 }, easing: "linear" },
          { frameOffset: 15, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutCubic" },
          { frameOffset: 22, properties: { scaleX: 1.05, scaleY: 1.05 }, easing: "easeInOut" },
          { frameOffset: 30, properties: { scaleX: 1, scaleY: 1 }, easing: "easeInOut" },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // MOLECULAR
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "mg-binding-event",
    name: "Binding Event",
    category: "molecular",
    description: "Two molecules approach and bind together",
    durationFrames: 35,
    groupName: "Binding Event",
    objects: [
      {
        localId: "mol-a",
        type: "circle",
        name: "Molecule A",
        fabricProps: { radius: 20, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2 },
        relativeLeft: -60,
        relativeTop: 0,
      },
      {
        localId: "mol-b",
        type: "circle",
        name: "Molecule B",
        fabricProps: { radius: 15, fill: "#ef4444", stroke: "#b91c1c", strokeWidth: 2 },
        relativeLeft: 60,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "mol-a",
        keyframes: [
          { frameOffset: 0, properties: { left: -60, opacity: 1 }, easing: "linear" },
          { frameOffset: 25, properties: { left: -8 }, easing: "easeInOutCubic" },
          { frameOffset: 30, properties: { left: -12 }, easing: "easeOut" },
          { frameOffset: 35, properties: { left: -8 }, easing: "easeInOut" },
        ],
      },
      {
        objectRef: "mol-b",
        keyframes: [
          { frameOffset: 0, properties: { left: 60, opacity: 1 }, easing: "linear" },
          { frameOffset: 25, properties: { left: 12 }, easing: "easeInOutCubic" },
          { frameOffset: 30, properties: { left: 16 }, easing: "easeOut" },
          { frameOffset: 35, properties: { left: 12 }, easing: "easeInOut" },
        ],
      },
    ],
  },
  {
    id: "mg-dissociation",
    name: "Dissociation",
    category: "molecular",
    description: "Complex splits into two separate molecules",
    durationFrames: 30,
    groupName: "Dissociation",
    objects: [
      {
        localId: "complex",
        type: "circle",
        name: "Complex",
        fabricProps: { radius: 22, fill: "#8b5cf6", stroke: "#6d28d9", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "frag-a",
        type: "circle",
        name: "Fragment A",
        fabricProps: { radius: 14, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "frag-b",
        type: "circle",
        name: "Fragment B",
        fabricProps: { radius: 12, fill: "#10b981", stroke: "#059669", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "complex",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 1, scaleX: 1, scaleY: 1 }, easing: "linear" },
          { frameOffset: 10, properties: { scaleX: 1.15, scaleY: 0.9 }, easing: "easeInOut" },
          { frameOffset: 15, properties: { opacity: 0, scaleX: 1.3, scaleY: 0.7 }, easing: "easeIn" },
        ],
      },
      {
        objectRef: "frag-a",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0, left: 0 }, easing: "linear" },
          { frameOffset: 14, properties: { opacity: 0, left: 0 }, easing: "linear" },
          { frameOffset: 16, properties: { opacity: 1 }, easing: "easeOut" },
          { frameOffset: 28, properties: { left: -50 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "frag-b",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0, left: 0 }, easing: "linear" },
          { frameOffset: 14, properties: { opacity: 0, left: 0 }, easing: "linear" },
          { frameOffset: 16, properties: { opacity: 1 }, easing: "easeOut" },
          { frameOffset: 28, properties: { left: 50 }, easing: "easeOutCubic" },
        ],
      },
    ],
  },
  {
    id: "mg-conformational-shift",
    name: "Conformational Shift",
    category: "molecular",
    description: "Molecule changes shape — simulates conformational change",
    durationFrames: 40,
    groupName: "Conformational Shift",
    objects: [
      {
        localId: "molecule",
        type: "circle",
        name: "Molecule",
        fabricProps: { radius: 24, fill: "#f59e0b", stroke: "#d97706", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "molecule",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 1, scaleY: 1 }, easing: "easeInOut" },
          { frameOffset: 12, properties: { scaleX: 1.4, scaleY: 0.7 }, easing: "easeInOut" },
          { frameOffset: 24, properties: { scaleX: 0.8, scaleY: 1.3 }, easing: "easeInOut" },
          { frameOffset: 36, properties: { scaleX: 1, scaleY: 1 }, easing: "easeInOut" },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CELLULAR
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "mg-cell-division",
    name: "Cell Division",
    category: "cellular",
    description: "Cell elongates and splits into two daughter cells",
    durationFrames: 45,
    groupName: "Cell Division",
    objects: [
      {
        localId: "parent",
        type: "circle",
        name: "Parent Cell",
        fabricProps: { radius: 28, fill: "#10b981", stroke: "#059669", strokeWidth: 2.5 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "daughter-a",
        type: "circle",
        name: "Daughter Cell A",
        fabricProps: { radius: 20, fill: "#34d399", stroke: "#059669", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "daughter-b",
        type: "circle",
        name: "Daughter Cell B",
        fabricProps: { radius: 20, fill: "#34d399", stroke: "#059669", strokeWidth: 2 },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "parent",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 1, scaleX: 1, scaleY: 1 }, easing: "easeInOut" },
          { frameOffset: 15, properties: { scaleX: 1.5, scaleY: 0.75 }, easing: "easeInOut" },
          { frameOffset: 25, properties: { scaleX: 1.8, scaleY: 0.6, opacity: 0.5 }, easing: "easeIn" },
          { frameOffset: 30, properties: { opacity: 0 }, easing: "easeIn" },
        ],
      },
      {
        objectRef: "daughter-a",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0, left: 0 }, easing: "linear" },
          { frameOffset: 28, properties: { opacity: 0, left: -10 }, easing: "linear" },
          { frameOffset: 32, properties: { opacity: 1, scaleX: 0.8, scaleY: 0.8 }, easing: "easeOut" },
          { frameOffset: 42, properties: { left: -40, scaleX: 1, scaleY: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "daughter-b",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0, left: 0 }, easing: "linear" },
          { frameOffset: 28, properties: { opacity: 0, left: 10 }, easing: "linear" },
          { frameOffset: 32, properties: { opacity: 1, scaleX: 0.8, scaleY: 0.8 }, easing: "easeOut" },
          { frameOffset: 42, properties: { left: 40, scaleX: 1, scaleY: 1 }, easing: "easeOutCubic" },
        ],
      },
    ],
  },
  {
    id: "mg-membrane-transport",
    name: "Membrane Transport",
    category: "cellular",
    description: "Particle passes through a membrane barrier",
    durationFrames: 35,
    groupName: "Membrane Transport",
    objects: [
      {
        localId: "membrane-top",
        type: "rect",
        name: "Membrane Top",
        fabricProps: { width: 80, height: 4, fill: "#6366f1", rx: 2, ry: 2 },
        relativeLeft: 0,
        relativeTop: -14,
      },
      {
        localId: "membrane-bottom",
        type: "rect",
        name: "Membrane Bottom",
        fabricProps: { width: 80, height: 4, fill: "#6366f1", rx: 2, ry: 2 },
        relativeLeft: 0,
        relativeTop: 14,
      },
      {
        localId: "particle",
        type: "circle",
        name: "Particle",
        fabricProps: { radius: 8, fill: "#f59e0b", stroke: "#d97706", strokeWidth: 1.5 },
        relativeLeft: 0,
        relativeTop: -50,
      },
    ],
    tracks: [
      {
        objectRef: "membrane-top",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 1 }, easing: "linear" },
        ],
      },
      {
        objectRef: "membrane-bottom",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 1 }, easing: "linear" },
        ],
      },
      {
        objectRef: "particle",
        keyframes: [
          { frameOffset: 0, properties: { top: -50, opacity: 1, scaleX: 1, scaleY: 1 }, easing: "linear" },
          { frameOffset: 12, properties: { top: -14, scaleX: 0.7, scaleY: 1.2 }, easing: "easeInCubic" },
          { frameOffset: 20, properties: { top: 0, scaleX: 0.5, scaleY: 1.4 }, easing: "easeInOut" },
          { frameOffset: 28, properties: { top: 14, scaleX: 0.7, scaleY: 1.2 }, easing: "easeInOut" },
          { frameOffset: 35, properties: { top: 50, scaleX: 1, scaleY: 1 }, easing: "easeOutCubic" },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // DATA & GRAPHS
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "mg-bar-chart-grow",
    name: "Bar Chart Grow-In",
    category: "data-graphs",
    description: "Four bars grow upward with staggered timing",
    durationFrames: 35,
    groupName: "Bar Chart Grow-In",
    objects: [
      {
        localId: "bar1",
        type: "rect",
        name: "Bar 1",
        fabricProps: { width: 20, height: 60, fill: "#3b82f6", rx: 3, ry: 3, originX: "center", originY: "bottom" },
        relativeLeft: -45,
        relativeTop: 30,
      },
      {
        localId: "bar2",
        type: "rect",
        name: "Bar 2",
        fabricProps: { width: 20, height: 90, fill: "#8b5cf6", rx: 3, ry: 3, originX: "center", originY: "bottom" },
        relativeLeft: -15,
        relativeTop: 30,
      },
      {
        localId: "bar3",
        type: "rect",
        name: "Bar 3",
        fabricProps: { width: 20, height: 45, fill: "#10b981", rx: 3, ry: 3, originX: "center", originY: "bottom" },
        relativeLeft: 15,
        relativeTop: 30,
      },
      {
        localId: "bar4",
        type: "rect",
        name: "Bar 4",
        fabricProps: { width: 20, height: 75, fill: "#f59e0b", rx: 3, ry: 3, originX: "center", originY: "bottom" },
        relativeLeft: 45,
        relativeTop: 30,
      },
      {
        localId: "baseline",
        type: "rect",
        name: "Baseline",
        fabricProps: { width: 130, height: 2, fill: "#475569" },
        relativeLeft: 0,
        relativeTop: 31,
      },
    ],
    tracks: [
      {
        objectRef: "baseline",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 8, properties: { scaleX: 1, opacity: 1 }, easing: "easeOut" },
        ],
      },
      {
        objectRef: "bar1",
        keyframes: [
          { frameOffset: 0, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 5, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 18, properties: { scaleY: 1, opacity: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "bar2",
        keyframes: [
          { frameOffset: 0, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 9, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 22, properties: { scaleY: 1, opacity: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "bar3",
        keyframes: [
          { frameOffset: 0, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 13, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 26, properties: { scaleY: 1, opacity: 1 }, easing: "easeOutCubic" },
        ],
      },
      {
        objectRef: "bar4",
        keyframes: [
          { frameOffset: 0, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 17, properties: { scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 30, properties: { scaleY: 1, opacity: 1 }, easing: "easeOutCubic" },
        ],
      },
    ],
  },
  {
    id: "mg-pie-sweep",
    name: "Pie Chart Sweep",
    category: "data-graphs",
    description: "Pie segments appear one at a time with rotation",
    durationFrames: 40,
    groupName: "Pie Chart Sweep",
    objects: [
      {
        localId: "seg1",
        type: "circle",
        name: "Segment 1",
        fabricProps: { radius: 30, fill: "#3b82f6", stroke: "#1e3a5f", strokeWidth: 1 },
        relativeLeft: -5,
        relativeTop: -5,
      },
      {
        localId: "seg2",
        type: "circle",
        name: "Segment 2",
        fabricProps: { radius: 30, fill: "#8b5cf6", stroke: "#3b1f72", strokeWidth: 1 },
        relativeLeft: 5,
        relativeTop: -5,
      },
      {
        localId: "seg3",
        type: "circle",
        name: "Segment 3",
        fabricProps: { radius: 30, fill: "#10b981", stroke: "#064e3b", strokeWidth: 1 },
        relativeLeft: 0,
        relativeTop: 5,
      },
    ],
    tracks: [
      {
        objectRef: "seg1",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0, angle: -90 }, easing: "linear" },
          { frameOffset: 12, properties: { scaleX: 1, scaleY: 1, opacity: 1, angle: 0 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "seg2",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0, angle: -90 }, easing: "linear" },
          { frameOffset: 12, properties: { scaleX: 0, scaleY: 0, opacity: 0, angle: -90 }, easing: "linear" },
          { frameOffset: 24, properties: { scaleX: 1, scaleY: 1, opacity: 1, angle: 0 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "seg3",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0, angle: -90 }, easing: "linear" },
          { frameOffset: 24, properties: { scaleX: 0, scaleY: 0, opacity: 0, angle: -90 }, easing: "linear" },
          { frameOffset: 36, properties: { scaleX: 1, scaleY: 1, opacity: 1, angle: 0 }, easing: "easeOutBack" },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // TRANSITIONS
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "mg-fade-stages",
    name: "Fade Between Stages",
    category: "transitions",
    description: "One element fades out while another fades in",
    durationFrames: 30,
    groupName: "Fade Stages",
    objects: [
      {
        localId: "stage-a",
        type: "rect",
        name: "Stage A",
        fabricProps: { width: 60, height: 40, fill: "#3b82f6", rx: 6, ry: 6 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "stage-b",
        type: "rect",
        name: "Stage B",
        fabricProps: { width: 60, height: 40, fill: "#10b981", rx: 6, ry: 6 },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "stage-a",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 1 }, easing: "linear" },
          { frameOffset: 12, properties: { opacity: 1 }, easing: "linear" },
          { frameOffset: 22, properties: { opacity: 0 }, easing: "easeInOut" },
        ],
      },
      {
        objectRef: "stage-b",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 14, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 26, properties: { opacity: 1 }, easing: "easeInOut" },
        ],
      },
    ],
  },
  {
    id: "mg-wipe-reveal",
    name: "Wipe Reveal",
    category: "transitions",
    description: "Curtain slides away to reveal content beneath",
    durationFrames: 25,
    groupName: "Wipe Reveal",
    objects: [
      {
        localId: "curtain",
        type: "rect",
        name: "Curtain",
        fabricProps: { width: 120, height: 80, fill: "#1e293b", rx: 4, ry: 4 },
        relativeLeft: 0,
        relativeTop: 0,
      },
      {
        localId: "content",
        type: "rect",
        name: "Revealed Content",
        fabricProps: { width: 100, height: 60, fill: "#6366f1", rx: 6, ry: 6 },
        relativeLeft: 0,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "content",
        keyframes: [
          { frameOffset: 0, properties: { opacity: 0, scaleX: 0.9, scaleY: 0.9 }, easing: "linear" },
          { frameOffset: 10, properties: { opacity: 0 }, easing: "linear" },
          { frameOffset: 22, properties: { opacity: 1, scaleX: 1, scaleY: 1 }, easing: "easeOut" },
        ],
      },
      {
        objectRef: "curtain",
        keyframes: [
          { frameOffset: 0, properties: { left: 0, opacity: 1 }, easing: "linear" },
          { frameOffset: 20, properties: { left: 150, opacity: 0.8 }, easing: "easeInCubic" },
          { frameOffset: 25, properties: { opacity: 0 }, easing: "easeIn" },
        ],
      },
    ],
  },
  {
    id: "mg-sequential-appear",
    name: "Sequential Appear",
    category: "transitions",
    description: "Elements appear one after another in a row",
    durationFrames: 35,
    groupName: "Sequential Appear",
    objects: [
      {
        localId: "item1",
        type: "rect",
        name: "Item 1",
        fabricProps: { width: 30, height: 30, fill: "#3b82f6", rx: 6, ry: 6 },
        relativeLeft: -55,
        relativeTop: 0,
      },
      {
        localId: "item2",
        type: "rect",
        name: "Item 2",
        fabricProps: { width: 30, height: 30, fill: "#8b5cf6", rx: 6, ry: 6 },
        relativeLeft: -18,
        relativeTop: 0,
      },
      {
        localId: "item3",
        type: "rect",
        name: "Item 3",
        fabricProps: { width: 30, height: 30, fill: "#10b981", rx: 6, ry: 6 },
        relativeLeft: 18,
        relativeTop: 0,
      },
      {
        localId: "item4",
        type: "rect",
        name: "Item 4",
        fabricProps: { width: 30, height: 30, fill: "#f59e0b", rx: 6, ry: 6 },
        relativeLeft: 55,
        relativeTop: 0,
      },
    ],
    tracks: [
      {
        objectRef: "item1",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 8, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "item2",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 7, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 15, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "item3",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 14, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 22, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
      {
        objectRef: "item4",
        keyframes: [
          { frameOffset: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 21, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" },
          { frameOffset: 29, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeOutBack" },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // PARTICLES
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "mg-diffusion-scatter",
    name: "Diffusion Scatter",
    category: "particles",
    description: "Clustered particles scatter outward — diffusion simulation",
    durationFrames: 40,
    groupName: "Diffusion Scatter",
    objects: Array.from({ length: 8 }, (_, i) => ({
      localId: `p${i}`,
      type: "circle" as const,
      name: `Particle ${i + 1}`,
      fabricProps: { radius: 5 + Math.random() * 3, fill: `hsl(${200 + i * 20}, 70%, 60%)` },
      relativeLeft: (Math.random() - 0.5) * 10,
      relativeTop: (Math.random() - 0.5) * 10,
    })),
    tracks: Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 40 + Math.random() * 40;
      return {
        objectRef: `p${i}`,
        keyframes: [
          { frameOffset: 0, properties: { opacity: 1 } as Partial<AnimatableProps>, easing: "linear" as EasingType },
          {
            frameOffset: 35,
            properties: {
              left: Math.cos(angle) * dist,
              top: Math.sin(angle) * dist,
            } as Partial<AnimatableProps>,
            easing: "easeOutCubic" as EasingType,
          },
        ],
      };
    }),
  },
  {
    id: "mg-directed-flow",
    name: "Directed Flow",
    category: "particles",
    description: "Particles stream from left to right — flow visualization",
    durationFrames: 40,
    groupName: "Directed Flow",
    objects: Array.from({ length: 5 }, (_, i) => ({
      localId: `fp${i}`,
      type: "circle" as const,
      name: `Flow Particle ${i + 1}`,
      fabricProps: { radius: 4, fill: "#60a5fa" },
      relativeLeft: -80,
      relativeTop: -20 + i * 10,
    })),
    tracks: Array.from({ length: 5 }, (_, i) => ({
      objectRef: `fp${i}`,
      keyframes: [
        {
          frameOffset: i * 4,
          properties: { left: -80, opacity: 0 } as Partial<AnimatableProps>,
          easing: "linear" as EasingType,
        },
        {
          frameOffset: i * 4 + 3,
          properties: { opacity: 1 } as Partial<AnimatableProps>,
          easing: "easeOut" as EasingType,
        },
        {
          frameOffset: i * 4 + 28,
          properties: { left: 80, opacity: 1 } as Partial<AnimatableProps>,
          easing: "easeInOut" as EasingType,
        },
        {
          frameOffset: i * 4 + 35,
          properties: { opacity: 0 } as Partial<AnimatableProps>,
          easing: "easeIn" as EasingType,
        },
      ],
    })),
  },
  {
    id: "mg-gradient-formation",
    name: "Gradient Formation",
    category: "particles",
    description: "Row of dots forms a color gradient — concentration visualization",
    durationFrames: 35,
    groupName: "Gradient Formation",
    objects: Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      const r = Math.round(59 + t * (245 - 59));
      const g = Math.round(130 + t * (158 - 130));
      const b = Math.round(246 + t * (11 - 246));
      return {
        localId: `gd${i}`,
        type: "circle" as const,
        name: `Gradient Dot ${i + 1}`,
        fabricProps: { radius: 8, fill: `rgb(${r},${g},${b})` },
        relativeLeft: -54 + i * 18,
        relativeTop: 0,
      };
    }),
    tracks: Array.from({ length: 7 }, (_, i) => ({
      objectRef: `gd${i}`,
      keyframes: [
        {
          frameOffset: 0,
          properties: { scaleX: 0, scaleY: 0, opacity: 0 } as Partial<AnimatableProps>,
          easing: "linear" as EasingType,
        },
        {
          frameOffset: i * 3 + 2,
          properties: { scaleX: 0, scaleY: 0, opacity: 0 } as Partial<AnimatableProps>,
          easing: "linear" as EasingType,
        },
        {
          frameOffset: i * 3 + 10,
          properties: { scaleX: 1, scaleY: 1, opacity: 1 } as Partial<AnimatableProps>,
          easing: "easeOutBack" as EasingType,
        },
      ],
    })),
  },
];
