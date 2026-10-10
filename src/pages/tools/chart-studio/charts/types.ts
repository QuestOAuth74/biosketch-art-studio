import type { ReactNode } from "react";
import type { CellValue, GraphSettings, ChartTheme, PointShape } from "../types";

/**
 * Shape of the props object passed to every extracted chart renderer.
 * Built once per ChartCanvas render and passed unchanged to the active renderer.
 *
 * The renderers read — but never own — this data. All state-mutating callbacks
 * (setTooltip, onSettingChange, etc.) are routed through here so renderers can
 * remain pure functions.
 */
export interface ChartRendererProps {
  // ── Raw inputs ──
  columns: string[];
  rows: CellValue[][];
  settings: GraphSettings;
  theme: ChartTheme;

  // ── Derived data ──
  colData: number[][];
  colStats: { mean: number; sd: number; sem: number; n: number }[];
  isXY: boolean;
  xVals: number[];
  yTraces: number[][];
  allY: number[];

  // ── Dimensions & layout ──
  W: number;
  H: number;
  PAD: { top: number; right: number; bottom: number; left: number };
  pw: number;
  ph: number;

  // ── Convenience settings (destructured from settings for readability) ──
  chartType: string;
  title: string;
  xLabel: string;
  yLabel: string;
  showGrid: boolean;
  showErrorBars: boolean;
  errorBarType: "sd" | "sem";
  showDataPoints: boolean;
  showRegression: boolean;
  xAutoRange: boolean;
  xMinManual: number | null;
  xMaxManual: number | null;
  yAutoRange: boolean;
  yMinManual: number | null;
  yMaxManual: number | null;
  xLogScale: boolean;
  yLogScale: boolean;
  pBrackets: GraphSettings["pBrackets"];
  fontFamily: string;
  titleSize: number;
  axisLabelSize: number;
  tickLabelSize: number;
  titleBold: boolean;
  axisLabelBold: boolean;
  legendPosition: string;
  legendBorder: boolean;
  pointShape: PointShape;
  lw: number;
  dashArray: string;
  axisLineWeight: number;
  errorBarWeight: number;
  ff: string;

  // ── Color & opacity helpers ──
  tc: (i: number) => string;
  to: (i: number) => number;

  // ── Shared SVG primitives ──
  svgDefs: ReactNode;
  svgStyle: React.CSSProperties;

  // ── Shared helpers (closure-bound in ChartCanvas) ──
  resolveTickAngle: (labels: string[], availableWidth: number) => 0 | 45 | 90;
  renderXTickLabel: (
    x: number,
    baseY: number,
    label: string,
    angle: 0 | 45 | 90,
    key: string | number,
    opts?: { fontSize?: number; fontWeight?: number; fill?: string }
  ) => ReactNode;
  renderThemedPoint: (cx: number, cy: number, r: number, color: string, key: string | number) => ReactNode;
  renderPoint: (cx: number, cy: number, r: number, color: string, key: string | number, opacity?: number) => ReactNode;
  barFill: (color: string, idx: number) => string;
  renderAxes: () => ReactNode;
  renderGrid: (
    xTicks: number[],
    yTicks: number[],
    sxFn: (v: number) => number,
    syFn: (v: number) => number
  ) => ReactNode;
  renderThemedLegend: (items: { color: string; label: string }[]) => ReactNode;
  renderTooltip: () => ReactNode;
  renderAnnotations: () => ReactNode;
  /** Reference lines overlay (horizontal y=value or vertical x=value). Tier 3. */
  renderReferenceLines: (sxFn: (v: number) => number, syFn: (v: number) => number) => ReactNode;
  /** Sample a continuous palette (viridis/plasma/magma/cool/warm) at t∈[0,1]. Tier 3. */
  sampleContinuousPalette: (name: string | undefined, t: number) => string;
  seriesOpacity: (seriesIndex: number) => number;
  plotClipDef: () => ReactNode;

  // ── State getters/setters ──
  hoveredSeries: number | null;
  setHoveredSeries: (v: number | null) => void;
  tooltip: { x: number; y: number; label: string } | null;
  setTooltip: (v: { x: number; y: number; label: string } | null) => void;
  editingTitle: DOMRect | null;
  setEditingTitle: (v: DOMRect | null) => void;
  editingXLabel: DOMRect | null;
  setEditingXLabel: (v: DOMRect | null) => void;
  editingYLabel: DOMRect | null;
  setEditingYLabel: (v: DOMRect | null) => void;

  // ── Editor (Phase E1) ──
  /** Per-element style overrides, keyed by serialized ElementKey. May be undefined for older projects. */
  elementStyles?: GraphSettings["elementStyles"];

  // ── Callbacks passed down from parent ──
  onSettingChange?: (field: keyof GraphSettings, value: any) => void;
  onColumnRename?: (col: number, name: string) => void;
  onPrompt?: (
    title: string,
    label: string,
    defaultValue: string,
    onConfirm: (value: string) => void
  ) => void;
  activeTextInputRef?: React.MutableRefObject<HTMLInputElement | null>;
}
