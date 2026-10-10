// Chart Studio — workbook (multi-dataset) helpers and legacy migration.

import type {
  CellValue, ChartType, GraphSettings, LayoutState, PanelState,
  Dataset, GraphTab, AnalysisTab, Workbook, WorkbookProjectV2,
  TestResult, TestType, AnalysisState, ProjectState,
} from "./types";
import { COLORS, uid } from "./constants";

/** Default graph settings for a freshly-created graph tab. */
export function defaultGraphSettings(chartType: ChartType = "column"): GraphSettings {
  return {
    chartType,
    title: "",
    xLabel: "",
    yLabel: "",
    showGrid: true,
    showErrorBars: true,
    errorBarType: "sem",
    showDataPoints: true,
    showRegression: false,
    barColor: COLORS[0],
    pointSize: 5,
    whiskerStyle: "tukey",
    xAutoRange: true, xMin: null, xMax: null,
    yAutoRange: true, yMin: null, yMax: null,
    xLogScale: false, yLogScale: false,
    traceColors: [...COLORS],
    traceOpacities: [],
    colorPalette: "default",
    pBrackets: [],
    fontFamily: "Inter, sans-serif",
    titleSize: 15, axisLabelSize: 12, tickLabelSize: 10,
    titleBold: true, axisLabelBold: true,
    legendPosition: "top-right",
    legendBorder: false, legendX: null, legendY: null,
    pointShape: "circle",
    lineWidth: 2, lineStyle: "solid",
    chartWidth: 740, chartHeight: 520,
    pubPreset: "default",
    annotations: [],
    exportDPI: 300,
    marginTop: 48, marginRight: 36, marginBottom: 56, marginLeft: 62,
    axisLineWeight: 1, errorBarWeight: 1.5,
    showDualYAxis: false, rightYAxisTraces: [],
    showMeanValues: false, showErrorValues: false,
    chartTheme: "modern",
    yAxisBreak: false, yBreakLow: null, yBreakHigh: null,
    xTickAngle: "auto",
    heatmapShowValues: true,
    elementStyles: {},
  };
}

/** Default layout state (single-panel mode). */
export function defaultLayoutState(): LayoutState {
  return {
    mode: "single",
    orientation: "landscape",
    activePanelId: "main",
    pageLabel: "",
    showPanelLabels: true,
    panelLabelStyle: "uppercase",
  };
}

/** Create an empty dataset. Caller provides a name. */
export function createDataset(name: string, opts?: Partial<Dataset>): Dataset {
  return {
    id: uid(),
    name,
    columns: opts?.columns ?? ["Col 1", "Col 2", "Col 3"],
    rows: opts?.rows ?? Array.from({ length: 8 }, () => [null, null, null]),
    graphs: opts?.graphs ?? [],
    analyses: opts?.analyses ?? [],
    activeGraphId: opts?.activeGraphId ?? null,
    activeAnalysisId: opts?.activeAnalysisId ?? null,
    layoutState: opts?.layoutState ?? defaultLayoutState(),
    panels: opts?.panels,
  };
}

/** Create a graph tab with a specific chart type and optional settings/name. */
export function createGraphTab(chartType: ChartType, name?: string, settings?: Partial<GraphSettings>): GraphTab {
  const base = defaultGraphSettings(chartType);
  return {
    id: uid(),
    name: name ?? humanizeChartType(chartType),
    chartType,
    settings: { ...base, ...settings, chartType },
  };
}

/** Create an analysis tab from a completed test result. */
export function createAnalysisTab(
  testType: TestType,
  result: TestResult,
  opts?: { name?: string; colA?: number; colB?: number },
): AnalysisTab {
  return {
    id: uid(),
    name: opts?.name ?? result.testName,
    testType,
    colA: opts?.colA,
    colB: opts?.colB,
    result,
    stale: false,
  };
}

/** Create an empty workbook with no datasets. UI should prompt for import. */
export function createEmptyWorkbook(): Workbook {
  return { activeDatasetId: null, datasets: [] };
}

/** Add a dataset and make it active. Returns the new workbook. */
export function addDataset(wb: Workbook, ds: Dataset): Workbook {
  return { activeDatasetId: ds.id, datasets: [...wb.datasets, ds] };
}

/** Get the active dataset, or null if none. */
export function getActiveDataset(wb: Workbook): Dataset | null {
  if (!wb.activeDatasetId) return null;
  return wb.datasets.find((d) => d.id === wb.activeDatasetId) ?? null;
}

/** Update the active dataset via an updater function. No-op if none active. */
export function updateActiveDataset(wb: Workbook, updater: (d: Dataset) => Dataset): Workbook {
  if (!wb.activeDatasetId) return wb;
  return {
    ...wb,
    datasets: wb.datasets.map((d) => (d.id === wb.activeDatasetId ? updater(d) : d)),
  };
}

/** Mark all analyses in a dataset as stale (call after data edits). */
export function markAnalysesStale(ds: Dataset): Dataset {
  if (ds.analyses.length === 0) return ds;
  return {
    ...ds,
    analyses: ds.analyses.map((a) => ({ ...a, stale: true })),
  };
}

/** Generate a friendly name for a chart type (for default graph tab labels). */
export function humanizeChartType(chartType: ChartType): string {
  const map: Record<ChartType, string> = {
    "xy": "Scatter",
    "correlation": "Correlation",
    "column": "Column",
    "grouped": "Grouped Bar",
    "stacked-bar": "Stacked Bar",
    "box": "Box Plot",
    "violin": "Violin",
    "histogram": "Histogram",
    "dot-strip": "Dot Strip",
    "before-after": "Before/After",
    "waterfall": "Waterfall",
    "qq-plot": "Q-Q Plot",
    "area": "Area",
    "survival": "Survival",
    "dose-response": "Dose-Response",
    "roc": "ROC",
    "volcano": "Volcano",
    "forest": "Forest",
    "bland-altman": "Bland-Altman",
    "heatmap": "Heatmap",
    "bubble": "Bubble",
    "radar": "Radar",
    "ecdf": "ECDF",
    "spaghetti": "Spaghetti",
    "lollipop": "Lollipop",
    "ridgeline": "Ridgeline",
    "funnel": "Funnel",
    "parts-of-whole": "Pie/Donut",
  };
  return map[chartType] ?? chartType;
}

/** Suggest a unique dataset name (e.g. "Dataset 3" if 1 and 2 exist). */
export function suggestDatasetName(wb: Workbook, base = "Dataset"): string {
  const existing = new Set(wb.datasets.map((d) => d.name));
  let i = wb.datasets.length + 1;
  while (existing.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

// ── Legacy migration (v1 flat project → v2 workbook) ──

/** Detect whether a saved state is legacy v1 or already v2. */
export function isWorkbookProjectV2(obj: any): obj is WorkbookProjectV2 {
  return !!obj && obj.version === 2 && obj.workbook && Array.isArray(obj.workbook.datasets);
}

/**
 * Wrap a legacy ProjectState (single flat dataset with one graph) into a
 * single-dataset Workbook so old saves continue to load.
 */
export function legacyToWorkbook(legacy: ProjectState, name = "Dataset 1"): Workbook {
  const graphTab: GraphTab = {
    id: uid(),
    name: humanizeChartType(legacy.graphSettings.chartType),
    chartType: legacy.graphSettings.chartType,
    settings: legacy.graphSettings,
  };
  const analyses: AnalysisTab[] = (legacy.analysis?.tests ?? []).map((r) =>
    createAnalysisTab(r.testType, r),
  );
  const ds: Dataset = {
    id: uid(),
    name,
    columns: legacy.columns,
    rows: legacy.rows,
    graphs: [graphTab],
    analyses,
    activeGraphId: graphTab.id,
    activeAnalysisId: analyses[0]?.id ?? null,
    layoutState: legacy.layout ?? defaultLayoutState(),
    panels: legacy.panels,
  };
  return { activeDatasetId: ds.id, datasets: [ds] };
}

/** Serialize a workbook into a v2 project blob for storage. */
export function serializeWorkbook(wb: Workbook): WorkbookProjectV2 {
  return { version: 2, workbook: wb };
}

/** Load either a v2 or v1 saved state into a workbook. */
export function loadProjectState(state: unknown): Workbook {
  if (isWorkbookProjectV2(state)) return state.workbook;
  // Assume v1 ProjectState
  return legacyToWorkbook(state as ProjectState);
}

/** Build a legacy-shaped AnalysisState from a dataset's analyses (for back-compat export paths). */
export function datasetAnalysesToLegacy(ds: Dataset): AnalysisState | null {
  if (ds.analyses.length === 0) return null;
  return {
    descriptive: [],
    tests: ds.analyses.map((a) => a.result),
    activeTest: ds.analyses[0].testType,
  };
}
