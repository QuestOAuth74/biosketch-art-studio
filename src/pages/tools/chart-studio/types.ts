// Chart Studio — all shared type definitions

export type CellValue = string | number | null;

export type ChartType =
  | "xy" | "correlation" | "column" | "grouped" | "stacked-bar"
  | "box" | "violin" | "histogram" | "dot-strip" | "before-after"
  | "waterfall" | "qq-plot" | "area" | "survival" | "dose-response"
  | "roc" | "volcano" | "forest" | "bland-altman" | "heatmap"
  | "bubble" | "radar" | "ecdf" | "spaghetti" | "lollipop"
  | "ridgeline" | "funnel" | "parts-of-whole";

export type ViewTab = "data" | "graph" | "results";

export interface GraphSettings {
  chartType: ChartType;
  title: string;
  xLabel: string;
  yLabel: string;
  showGrid: boolean;
  showErrorBars: boolean;
  errorBarType: "sd" | "sem" | "ci95";
  showDataPoints: boolean;
  showRegression: boolean;
  barColor: string;
  pointSize: number;
  whiskerStyle: "minmax" | "tukey" | "percentile";
  // Axis range
  xAutoRange: boolean;
  xMin: number | null;
  xMax: number | null;
  yAutoRange: boolean;
  yMin: number | null;
  yMax: number | null;
  // Log scale
  xLogScale: boolean;
  yLogScale: boolean;
  // Colors per trace
  traceColors: string[];
  traceOpacities: number[];
  colorPalette: string;
  // P-value brackets
  pBrackets: { colA: number; colB: number; pValue: string; y: number }[];
  /** Horizontal (y=value) or vertical (x=value) reference lines with labels. (Tier 3) */
  referenceLines?: { id: string; axis: "x" | "y"; value: number; label: string; color: string; dashed: boolean }[];
  /** Render error as a shaded ribbon instead of per-point ticks. (Tier 3) */
  errorBand?: boolean;
  /** Color-by: index of a numeric column used to colour each point via a continuous palette. (Tier 3, XY scatter) */
  colorByColumn?: number | null;
  colorByPalette?: "viridis" | "plasma" | "magma" | "cool" | "warm";
  // Typography
  fontFamily: string;
  titleSize: number;
  axisLabelSize: number;
  tickLabelSize: number;
  titleBold: boolean;
  axisLabelBold: boolean;
  // Legend
  legendPosition: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "none" | "custom";
  legendBorder: boolean;
  legendX: number | null;
  legendY: number | null;
  // Point & line style
  pointShape: "circle" | "square" | "triangle" | "diamond" | "plus" | "cross";
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  // Chart dimensions
  chartWidth: number;
  chartHeight: number;
  // Publication preset
  pubPreset: string;
  // Annotations — simple text labels and arrows (legacy, still supported).
  annotations: { x: number; y: number; text: string; type: "text" | "arrow"; arrowToX?: number; arrowToY?: number }[];
  // Export
  exportDPI: 150 | 300 | 600;
  // Margins
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  // Chart theme
  chartTheme: string;
  // Line weights
  axisLineWeight: number;
  errorBarWeight: number;
  // Dual Y-axis & display options
  showDualYAxis: boolean;
  rightYAxisTraces: number[];
  showMeanValues: boolean;
  /** Show a one-line reproducibility provenance under the chart (Tier 1). */
  showProvenance?: boolean;
  showErrorValues: boolean;
  // Axis break
  yAxisBreak: boolean;
  yBreakLow: number | null;
  yBreakHigh: number | null;
  // Tick label rotation
  xTickAngle: 0 | 45 | 90 | "auto";
  // Heatmap options
  heatmapShowValues: boolean;
  // Per-element style overrides (editor). Keys are serialized ElementKey strings.
  // See chart-studio/editor/elementKey.ts
  elementStyles?: Record<string, {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    fontStyle?: "normal" | "italic";
    color?: string;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    visible?: boolean;
    strokeWidth?: number;
    strokeDash?: string;
    fillColor?: string;
    fillOpacity?: number;
  }>;
}

export type PointShape = GraphSettings["pointShape"];

// ── Chart theme ──
export interface ChartTheme {
  id: string;
  name: string;
  bgColor: string;
  bgCornerRadius: number;
  axisColor: string;
  axisWidth: number;
  axisLinecap: string;
  showTopAxis: boolean;
  showRightAxis: boolean;
  gridColor: string;
  gridWidth: number;
  gridDash: string;
  gridOpacity: number;
  gridHorizontalOnly: boolean;
  pointFillMode: "solid" | "hollow" | "white-fill";
  pointStrokeWidth: number;
  pointShadow: boolean;
  barCornerRadius: number;
  barOpacity: number;
  barGradient: boolean;
  barGap: number;
  lineLinecap: string;
  lineLinejoin: string;
  lineOpacity: number;
  errorBarColor: string;
  errorBarWidth: number;
  errorBarCapWidth: number;
  legendBgColor: string;
  legendBgOpacity: number;
  legendShadow: boolean;
  legendCornerRadius: number;
  titleColor: string;
  axisLabelColor: string;
  tickLabelColor: string;
  useShadowFilter: boolean;
  tickLength: number;
}

// ── Statistics ──
export interface DescriptiveStats {
  column: string;
  n: number;
  mean: number;
  sd: number;
  sem: number;
  median: number;
  min: number;
  max: number;
  ci95Lower: number;
  ci95Upper: number;
}

export type TestType =
  | "descriptive" | "unpaired-t" | "paired-t" | "mann-whitney"
  | "one-way-anova" | "tukey-posthoc" | "pearson-corr" | "spearman-corr"
  | "chi-square" | "fisher-exact" | "linear-reg" | "normality"
  | "wilcoxon-signed" | "kruskal-wallis" | "two-way-anova" | "one-sample-t"
  | "log-rank" | "power-analysis" | "pca" | "kmeans"
  | "hierarchical-cluster" | "multiple-linear-reg" | "multiple-logistic-reg"
  | "poisson-reg" | "cox-reg" | "dose-response-analysis";

export interface TestResult {
  testType: TestType;
  testName: string;
  groupA?: string;
  groupB?: string;
  statistic: number;
  pValue: number;
  df?: number;
  ci95?: [number, number];
  meanDiff?: number;
  effectSize?: number;
  summary: string;
  significant: boolean;
  // Regression extras
  slope?: number;
  intercept?: number;
  rSquared?: number;
  // Post-hoc extras
  subResults?: { groupA: string; groupB: string; pValue: number; significant: boolean; meanDiff: number }[];
}

export interface AnalysisState {
  descriptive: DescriptiveStats[];
  tests: TestResult[];
  activeTest: TestType;
}

export interface AssumptionCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface TestSuggestion {
  recommended: TestType;
  testName: string;
  reason: string;
  assumptions: AssumptionCheck[];
  warnings: string[];
  alternatives: { test: TestType; name: string; when: string }[];
}

// ── Multi-graph layout ──
export type LayoutMode = "single" | "inset" | "2-up" | "2-up-vertical" | "3-up" | "4-up";
export type PageOrientation = "landscape" | "portrait";

export interface PanelState {
  id: string;
  label: string;
  columns: string[];
  rows: CellValue[][];
  graphSettings: GraphSettings;
  analysis: AnalysisState | null;
  insetBounds?: { x: number; y: number; width: number; height: number };
}

export interface LayoutState {
  mode: LayoutMode;
  orientation: PageOrientation;
  activePanelId: string;
  pageLabel: string;
  showPanelLabels: boolean;
  panelLabelStyle: "uppercase" | "lowercase" | "number";
}

// ── Saved assets (cloud/localStorage) ──
export interface SavedDataset {
  id: string;
  user_id: string;
  name: string;
  columns: string[];
  rows: CellValue[][];
  row_count: number;
  col_count: number;
  created_at: string;
}

export interface SavedGraphPreset {
  id: string;
  user_id: string;
  name: string;
  chart_type: string;
  settings: Partial<GraphSettings>;
  created_at: string;
}

// ── Top-level project ──
export interface ProjectState {
  columns: string[];
  rows: CellValue[][];
  graphSettings: GraphSettings;
  analysis: AnalysisState | null;
  // Multi-graph layout (optional — absent = single mode)
  layout?: LayoutState;
  panels?: PanelState[];
}

// ── Multi-dataset workbook (new) ──

/** A single graph tab within a dataset. */
export interface GraphTab {
  id: string;
  name: string;
  chartType: ChartType;
  settings: GraphSettings;
}

/** A single analysis tab within a dataset — cached test run. */
export interface AnalysisTab {
  id: string;
  name: string;
  testType: TestType;
  colA?: number;
  colB?: number;
  result: TestResult;
  /** True if source data has changed since this analysis was run. */
  stale?: boolean;
}

/** A dataset is a self-contained workbook tab: data + its graphs + its analyses. */
export interface Dataset {
  id: string;
  name: string;
  columns: string[];
  rows: CellValue[][];
  graphs: GraphTab[];
  analyses: AnalysisTab[];
  activeGraphId: string | null;
  activeAnalysisId: string | null;
  layoutState: LayoutState;
  panels?: PanelState[];
}

/** A workbook holds all open dataset tabs for a single project. */
export interface Workbook {
  activeDatasetId: string | null;
  datasets: Dataset[];
}

/** Serialized project shape (v2 workbook). v1 legacy shape is ProjectState above. */
export interface WorkbookProjectV2 {
  version: 2;
  workbook: Workbook;
}
