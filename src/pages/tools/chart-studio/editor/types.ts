// Chart Studio — editor types (selection, element keys, per-element style overrides)

/** Stable identifier for any editable element on the chart. */
export type ElementKey =
  | { kind: "title" }
  | { kind: "xlabel" }
  | { kind: "ylabel" }
  | { kind: "legend" }
  | { kind: "tick"; axis: "x" | "y"; index: number }
  | { kind: "series"; traceIndex: number }
  | { kind: "point"; traceIndex: number; pointIndex: number }
  | { kind: "bar"; traceIndex: number; barIndex: number }
  | { kind: "annotation"; id: string }
  | { kind: "bracket"; index: number };

/** Per-element style override. Fields are optional — unset fields inherit from global settings. */
export interface ElementStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  color?: string;
  /** X offset in SVG px from the element's default position. */
  offsetX?: number;
  /** Y offset in SVG px from the element's default position. */
  offsetY?: number;
  /** Rotation in degrees. */
  rotation?: number;
  visible?: boolean;
  // Shape-only
  strokeWidth?: number;
  strokeDash?: string;
  fillColor?: string;
  fillOpacity?: number;
}

/** Map of serialized ElementKey → override. Stored on GraphSettings. */
export type ElementStyles = Record<string, ElementStyle>;

/** Live editor mode. */
export type EditorMode =
  | "idle"
  | "dragging"
  | "resizing"
  | "editingText"
  | "placingShape";

export interface EditorState {
  selected: ElementKey | null;
  hovering: ElementKey | null;
  mode: EditorMode;
}
