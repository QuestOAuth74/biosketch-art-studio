// Chart Studio — shared constants (palettes, themes, font options, chart type options)

import {
  BarChart3, BoxSelect, Columns, Grid3X3, LineChart, PieChart, Rows,
  ScatterChart, TrendingUp, Target, Activity, Zap,
} from "lucide-react";

import type { ChartType, ChartTheme, GraphSettings } from "./types";

// ── Default chart palette ──
// Editorial 8-hue palette — softer chroma so multi-series charts stop clashing.
// Warm/cool alternation keeps adjacent traces distinguishable at a glance.
export const COLORS = ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7"];

// ── Chart themes (6 built-in) ──
export const CHART_THEMES: Record<string, ChartTheme> = {
  modern: {
    id: "modern", name: "Modern",
    bgColor: "#fafafa", bgCornerRadius: 6,
    axisColor: "#94a3b8", axisWidth: 1, axisLinecap: "round", showTopAxis: false, showRightAxis: false,
    gridColor: "#cbd5e1", gridWidth: 0.75, gridDash: "3 4", gridOpacity: 0.7, gridHorizontalOnly: true,
    pointFillMode: "white-fill", pointStrokeWidth: 2, pointShadow: true,
    barCornerRadius: 4, barOpacity: 0.88, barGradient: false, barGap: 2,
    lineLinecap: "round", lineLinejoin: "round", lineOpacity: 0.85,
    errorBarColor: "#6b7280", errorBarWidth: 1.5, errorBarCapWidth: 6,
    legendBgColor: "#ffffff", legendBgOpacity: 0.92, legendShadow: true, legendCornerRadius: 8,
    titleColor: "#1f2937", axisLabelColor: "#4b5563", tickLabelColor: "#6b7280",
    useShadowFilter: true, tickLength: 4,
  },
  classic: {
    id: "classic", name: "Classic",
    bgColor: "#ffffff", bgCornerRadius: 0,
    axisColor: "#1a1a1a", axisWidth: 1.5, axisLinecap: "square", showTopAxis: false, showRightAxis: false,
    gridColor: "#9ca3af", gridWidth: 0.75, gridDash: "", gridOpacity: 0.5, gridHorizontalOnly: false,
    pointFillMode: "solid", pointStrokeWidth: 0, pointShadow: false,
    barCornerRadius: 0, barOpacity: 0.9, barGradient: false, barGap: 1,
    lineLinecap: "butt", lineLinejoin: "miter", lineOpacity: 1,
    errorBarColor: "#1a1a1a", errorBarWidth: 1, errorBarCapWidth: 8,
    legendBgColor: "#ffffff", legendBgOpacity: 1, legendShadow: false, legendCornerRadius: 0,
    titleColor: "#000000", axisLabelColor: "#1a1a1a", tickLabelColor: "#4a4a4a",
    useShadowFilter: false, tickLength: 5,
  },
  nature: {
    id: "nature", name: "Nature",
    bgColor: "#ffffff", bgCornerRadius: 0,
    axisColor: "#4b5563", axisWidth: 1, axisLinecap: "round", showTopAxis: false, showRightAxis: false,
    gridColor: "#d1d5db", gridWidth: 0.75, gridDash: "", gridOpacity: 0.6, gridHorizontalOnly: true,
    pointFillMode: "hollow", pointStrokeWidth: 1.5, pointShadow: false,
    barCornerRadius: 1, barOpacity: 0.85, barGradient: false, barGap: 1,
    lineLinecap: "round", lineLinejoin: "round", lineOpacity: 1,
    errorBarColor: "#6b7280", errorBarWidth: 1, errorBarCapWidth: 6,
    legendBgColor: "#ffffff", legendBgOpacity: 0.85, legendShadow: false, legendCornerRadius: 4,
    titleColor: "#1f2937", axisLabelColor: "#4b5563", tickLabelColor: "#6b7280",
    useShadowFilter: false, tickLength: 4,
  },
  presentation: {
    id: "presentation", name: "Presentation",
    bgColor: "#ffffff", bgCornerRadius: 8,
    axisColor: "#64748b", axisWidth: 1.5, axisLinecap: "round", showTopAxis: false, showRightAxis: false,
    gridColor: "#cbd5e1", gridWidth: 0.75, gridDash: "4 4", gridOpacity: 0.6, gridHorizontalOnly: true,
    pointFillMode: "solid", pointStrokeWidth: 2.5, pointShadow: true,
    barCornerRadius: 5, barOpacity: 0.92, barGradient: false, barGap: 3,
    lineLinecap: "round", lineLinejoin: "round", lineOpacity: 0.9,
    errorBarColor: "#475569", errorBarWidth: 2, errorBarCapWidth: 8,
    legendBgColor: "#ffffff", legendBgOpacity: 0.95, legendShadow: true, legendCornerRadius: 10,
    titleColor: "#0f172a", axisLabelColor: "#334155", tickLabelColor: "#64748b",
    useShadowFilter: true, tickLength: 5,
  },
  dark: {
    id: "dark", name: "Dark",
    bgColor: "#1e1e2e", bgCornerRadius: 6,
    axisColor: "#4a4a6a", axisWidth: 1, axisLinecap: "round", showTopAxis: false, showRightAxis: false,
    gridColor: "#4a4a6a", gridWidth: 0.75, gridDash: "3 4", gridOpacity: 0.7, gridHorizontalOnly: true,
    pointFillMode: "solid", pointStrokeWidth: 0, pointShadow: true,
    barCornerRadius: 4, barOpacity: 0.9, barGradient: false, barGap: 2,
    lineLinecap: "round", lineLinejoin: "round", lineOpacity: 0.9,
    errorBarColor: "#8888aa", errorBarWidth: 1.5, errorBarCapWidth: 6,
    legendBgColor: "#2a2a4a", legendBgOpacity: 0.85, legendShadow: true, legendCornerRadius: 8,
    titleColor: "#e2e8f0", axisLabelColor: "#a0a0c0", tickLabelColor: "#7070a0",
    useShadowFilter: true, tickLength: 4,
  },
  minimal: {
    id: "minimal", name: "Minimal",
    bgColor: "#ffffff", bgCornerRadius: 0,
    axisColor: "#d1d5db", axisWidth: 0.5, axisLinecap: "round", showTopAxis: false, showRightAxis: false,
    gridColor: "#cbd5e1", gridWidth: 0.5, gridDash: "", gridOpacity: 0.5, gridHorizontalOnly: true,
    pointFillMode: "solid", pointStrokeWidth: 1.5, pointShadow: false,
    barCornerRadius: 2, barOpacity: 0.8, barGradient: false, barGap: 2,
    lineLinecap: "round", lineLinejoin: "round", lineOpacity: 0.7,
    errorBarColor: "#9ca3af", errorBarWidth: 1, errorBarCapWidth: 5,
    legendBgColor: "#ffffff", legendBgOpacity: 0, legendShadow: false, legendCornerRadius: 0,
    titleColor: "#374151", axisLabelColor: "#6b7280", tickLabelColor: "#9ca3af",
    useShadowFilter: false, tickLength: 3,
  },
  // ── Clinical — editorial minimalism for publication figures ──
  // Thin outer ticks, subtle horizontal-only grid, no shadows, tight
  // sans-serif look. Reads as a Nature/JAMA figure. Pairs well with the
  // `clinical` palette below (muted editorial saturation).
  clinical: {
    id: "clinical", name: "Clinical",
    bgColor: "#ffffff", bgCornerRadius: 0,
    axisColor: "#374151", axisWidth: 0.75, axisLinecap: "square", showTopAxis: false, showRightAxis: false,
    gridColor: "#e5e7eb", gridWidth: 0.5, gridDash: "", gridOpacity: 0.55, gridHorizontalOnly: true,
    pointFillMode: "solid", pointStrokeWidth: 0, pointShadow: false,
    barCornerRadius: 2, barOpacity: 0.95, barGradient: false, barGap: 1,
    lineLinecap: "round", lineLinejoin: "round", lineOpacity: 1,
    errorBarColor: "#374151", errorBarWidth: 1, errorBarCapWidth: 6,
    legendBgColor: "#ffffff", legendBgOpacity: 1, legendShadow: false, legendCornerRadius: 2,
    titleColor: "#111827", axisLabelColor: "#1f2937", tickLabelColor: "#4b5563",
    useShadowFilter: false, tickLength: 5,
  },
  // ── Infographic — pastel-adjacent, softer, presentation-friendly ──
  // Rounded bars, white-fill points with a colored ring, generous card-like
  // legend, subtle shadows. Pairs well with the `infographic` palette below.
  // Note: `barGradient: true` is aspirational — the renderer paints flat
  // fills today; will pick up gradient support in a future polish phase
  // without any change to this theme.
  infographic: {
    id: "infographic", name: "Infographic",
    bgColor: "#fefefe", bgCornerRadius: 12,
    axisColor: "#94a3b8", axisWidth: 1.25, axisLinecap: "round", showTopAxis: false, showRightAxis: false,
    gridColor: "#f1f5f9", gridWidth: 1, gridDash: "", gridOpacity: 0.6, gridHorizontalOnly: true,
    pointFillMode: "white-fill", pointStrokeWidth: 2.5, pointShadow: true,
    barCornerRadius: 8, barOpacity: 0.92, barGradient: true, barGap: 4,
    lineLinecap: "round", lineLinejoin: "round", lineOpacity: 0.95,
    errorBarColor: "#64748b", errorBarWidth: 1.5, errorBarCapWidth: 7,
    legendBgColor: "#ffffff", legendBgOpacity: 0.95, legendShadow: true, legendCornerRadius: 12,
    titleColor: "#1e293b", axisLabelColor: "#334155", tickLabelColor: "#64748b",
    useShadowFilter: true, tickLength: 4,
  },
};

// ── Publication presets (Nature, Science, Cell, APA, Minimal, Slide Deck) ──
// Each preset is a Partial<GraphSettings> merged into the current chart on
// pick. Journal presets now also select the "Clinical" theme so users get
// editorial defaults (thin axes, subtle grid, no shadows) in one click
// instead of ticking through 8 sliders. Slide Deck picks up the new
// "Infographic" theme + pastel palette for presentation-friendly output.
export const PUB_PRESETS: Record<string, { name: string; settings: Partial<GraphSettings> }> = {
  default: { name: "Default", settings: {} },
  nature: { name: "Nature", settings: { fontFamily: "Arial, Helvetica, sans-serif", titleSize: 14, axisLabelSize: 11, tickLabelSize: 9, titleBold: true, axisLabelBold: false, colorPalette: "nature", lineWidth: 1.5, pointSize: 4, chartWidth: 600, chartHeight: 450, pointShape: "circle", chartTheme: "clinical" } },
  science: { name: "Science", settings: { fontFamily: "Helvetica, Arial, sans-serif", titleSize: 13, axisLabelSize: 10, tickLabelSize: 9, titleBold: true, axisLabelBold: false, colorPalette: "clinical", lineWidth: 1.5, pointSize: 4, chartWidth: 600, chartHeight: 400, chartTheme: "clinical" } },
  cell: { name: "Cell", settings: { fontFamily: "Arial, Helvetica, sans-serif", titleSize: 14, axisLabelSize: 11, tickLabelSize: 9, titleBold: true, axisLabelBold: true, colorPalette: "clinical", lineWidth: 2, pointSize: 5, chartWidth: 650, chartHeight: 450, chartTheme: "clinical" } },
  apa: { name: "APA 7th", settings: { fontFamily: "'Times New Roman', Times, serif", titleSize: 14, axisLabelSize: 12, tickLabelSize: 10, titleBold: true, axisLabelBold: false, colorPalette: "grayscale", lineWidth: 1.5, pointSize: 5, chartWidth: 700, chartHeight: 500, chartTheme: "clinical" } },
  minimal: { name: "Minimal", settings: { fontFamily: "Inter, sans-serif", titleSize: 14, axisLabelSize: 11, tickLabelSize: 9, titleBold: false, axisLabelBold: false, showGrid: false, lineWidth: 2, pointSize: 6, chartWidth: 700, chartHeight: 480, chartTheme: "minimal" } },
  slideDeck: { name: "Slide Deck", settings: { fontFamily: "Inter, sans-serif", titleSize: 20, axisLabelSize: 15, tickLabelSize: 12, titleBold: true, axisLabelBold: false, colorPalette: "infographic", lineWidth: 2.5, pointSize: 6, chartWidth: 900, chartHeight: 600, chartTheme: "infographic" } },
};

// ── Font family picker options ──
export const FONT_OPTIONS = [
  // Sans-serif
  { value: "Inter, sans-serif", label: "Inter", group: "Sans-serif" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial", group: "Sans-serif" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica", group: "Sans-serif" },
  { value: "'Segoe UI', system-ui, sans-serif", label: "Segoe UI", group: "Sans-serif" },
  { value: "'Roboto', sans-serif", label: "Roboto", group: "Sans-serif" },
  { value: "'Open Sans', sans-serif", label: "Open Sans", group: "Sans-serif" },
  { value: "'Lato', sans-serif", label: "Lato", group: "Sans-serif" },
  { value: "'Source Sans Pro', sans-serif", label: "Source Sans Pro", group: "Sans-serif" },
  { value: "'IBM Plex Sans', sans-serif", label: "IBM Plex Sans", group: "Sans-serif" },
  { value: "'Nunito Sans', sans-serif", label: "Nunito Sans", group: "Sans-serif" },
  // Serif
  { value: "'Times New Roman', Times, serif", label: "Times New Roman", group: "Serif" },
  { value: "Georgia, serif", label: "Georgia", group: "Serif" },
  { value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif", label: "Palatino", group: "Serif" },
  { value: "'Cambria', serif", label: "Cambria", group: "Serif" },
  { value: "'Source Serif Pro', serif", label: "Source Serif Pro", group: "Serif" },
  // Monospace
  { value: "'Courier New', monospace", label: "Courier New", group: "Monospace" },
  { value: "'JetBrains Mono', monospace", label: "JetBrains Mono", group: "Monospace" },
  { value: "'Fira Code', monospace", label: "Fira Code", group: "Monospace" },
];

// ── Built-in color palettes ──
export const COLOR_PALETTES: Record<string, { name: string; colors: string[] }> = {
  default: { name: "Default", colors: ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"] },
  nature: { name: "Nature", colors: ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#F0E442", "#56B4E9", "#E69F00", "#000000"] },
  colorblind: { name: "Colorblind-safe", colors: ["#332288", "#88CCEE", "#44AA99", "#117733", "#999933", "#DDCC77", "#CC6677", "#882255"] },
  pastel: { name: "Pastel", colors: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5"] },
  bold: { name: "Bold", colors: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#a65628", "#f781bf", "#999999"] },
  grayscale: { name: "Grayscale", colors: ["#1a1a1a", "#4d4d4d", "#808080", "#b3b3b3", "#cccccc", "#666666", "#999999", "#333333"] },
  // Editorial saturation — deep navy · brick · forest · aubergine ·
  // terra · slate · magenta · teal. Vibrant but not neon. Reads as a
  // Nature Medicine multi-series figure. Pairs with the "Clinical" theme.
  clinical: { name: "Clinical", colors: ["#1F3A5F", "#C0392B", "#2E7D32", "#6A1B9A", "#EF6C00", "#37474F", "#AD1457", "#00695C"] },
  // Warm/cool pastel alternation — soft coral · sky · lilac · sage ·
  // butter · dusty rose · mint · apricot. Deliberate ordering so adjacent
  // series don't clash. Pairs with the "Infographic" theme.
  infographic: { name: "Infographic", colors: ["#EF6F6C", "#56B4E9", "#B39DDB", "#81C784", "#FFE082", "#F48FB1", "#A5D6A7", "#FFAB91"] },
};

// ── Chart type picker (Welcome dialog grid) ──
export const GRAPH_TYPE_OPTIONS = [
  { id: "xy" as ChartType, label: "XY (Scatter)", icon: ScatterChart, desc: "Plot Y vs X. Perfect for dose-response, time series, or any relationship between two variables." },
  { id: "correlation" as ChartType, label: "Correlation Plot", icon: TrendingUp, desc: "Scatter with line of best fit, R², equation, and 95% confidence band. Ideal for showing variable relationships." },
  { id: "column" as ChartType, label: "Column", icon: BarChart3, desc: "Compare means across groups. Ideal for experimental treatments vs. control." },
  { id: "grouped" as ChartType, label: "Grouped", icon: Columns, desc: "Compare multiple datasets across categories. Great for multi-factor experiments." },
  { id: "box" as ChartType, label: "Box & Whisker", icon: BoxSelect, desc: "Show data distribution with quartiles, median, and outliers. Ideal for comparing group spread." },
  { id: "violin" as ChartType, label: "Violin Plot", icon: LineChart, desc: "Show full data distribution shape. Combines density curve with box plot. Best for comparing distributions." },
  { id: "histogram" as ChartType, label: "Histogram", icon: BarChart3, desc: "Show frequency distribution of a single variable. Bin data into intervals and count occurrences." },
  { id: "survival" as ChartType, label: "Survival (Kaplan-Meier)", icon: TrendingUp, desc: "Plot event-free probability over time. Standard for clinical trial outcomes and time-to-event data." },
  { id: "dose-response" as ChartType, label: "Dose-Response", icon: Activity, desc: "Sigmoidal curve fitting for IC50/EC50 determination. Standard for pharmacology and toxicology." },
  { id: "roc" as ChartType, label: "ROC Curve", icon: Target, desc: "Receiver Operating Characteristic curve. Evaluate diagnostic test performance with AUC." },
  { id: "volcano" as ChartType, label: "Volcano Plot", icon: Zap, desc: "Fold change vs significance. Visualize differential expression from omics experiments." },
  { id: "forest" as ChartType, label: "Forest Plot", icon: Rows, desc: "Effect sizes with confidence intervals. Standard for meta-analyses and systematic reviews." },
  { id: "bland-altman" as ChartType, label: "Bland-Altman", icon: Target, desc: "Method comparison plot. Difference vs mean to assess agreement between two measurement methods." },
  { id: "heatmap" as ChartType, label: "Heatmap", icon: Grid3X3, desc: "Color-coded matrix. Visualize gene expression, correlation matrices, or any grid data." },
  { id: "bubble" as ChartType, label: "Bubble Plot", icon: ScatterChart, desc: "Scatter plot with size-coded third variable. Show three dimensions of data at once." },
  { id: "stacked-bar" as ChartType, label: "Stacked Bar", icon: BarChart3, desc: "Show composition within groups. Each bar segment represents a sub-category." },
  { id: "dot-strip" as ChartType, label: "Dot/Strip Plot", icon: ScatterChart, desc: "Individual data points per group without bars. Increasingly preferred for small n." },
  { id: "before-after" as ChartType, label: "Before-After", icon: LineChart, desc: "Connected paired observations showing change. Pre/post treatment, matched samples." },
  { id: "waterfall" as ChartType, label: "Waterfall", icon: BarChart3, desc: "Change from baseline per subject. Standard in oncology tumor response." },
  { id: "qq-plot" as ChartType, label: "QQ Plot", icon: ScatterChart, desc: "Quantile-quantile plot for normality assessment. Points on diagonal = normal." },
  { id: "area" as ChartType, label: "Area Chart", icon: LineChart, desc: "Filled line chart showing cumulative values or trends over time." },
  { id: "radar" as ChartType, label: "Radar/Spider", icon: Target, desc: "Multi-variable comparison on radial axes. Compare profiles across conditions." },
  { id: "ecdf" as ChartType, label: "ECDF", icon: TrendingUp, desc: "Empirical cumulative distribution. Compare distributions without binning." },
  { id: "spaghetti" as ChartType, label: "Spaghetti Plot", icon: LineChart, desc: "Individual trajectories over time. Each line is one subject." },
  { id: "lollipop" as ChartType, label: "Lollipop Chart", icon: BarChart3, desc: "Modern bar chart alternative. Stem + dot for cleaner look." },
  { id: "ridgeline" as ChartType, label: "Ridgeline Plot", icon: LineChart, desc: "Multiple overlapping density curves. Beautiful for comparing distributions." },
  { id: "funnel" as ChartType, label: "Funnel Plot", icon: Target, desc: "Publication bias assessment. Effect size vs precision in meta-analysis." },
  { id: "parts-of-whole" as ChartType, label: "Parts of Whole", icon: PieChart, desc: "Show proportions. Use for population distributions or composition data." },
];

// ── Data entry format picker (Welcome dialog Step 1) ──
export const DATA_ENTRY_OPTIONS: Record<ChartType, { id: string; label: string; desc: string }[]> = {
  xy: [
    { id: "single-y", label: "Enter single Y for each X", desc: "One Y value per X point" },
    { id: "replicate-y", label: "Enter replicate Y values", desc: "Multiple Y values per X, for error bars" },
  ],
  correlation: [
    { id: "xy-pair", label: "X and Y columns", desc: "Two columns: X values and Y values for correlation analysis" },
  ],
  column: [
    { id: "replicates", label: "Enter replicate values, stacked into columns", desc: "Each column is a group with replicate measurements" },
    { id: "mean-sem", label: "Enter mean ± SEM (or SD)", desc: "Pre-calculated summary statistics" },
  ],
  grouped: [
    { id: "replicates", label: "Enter replicate values", desc: "Raw data in each subcolumn" },
    { id: "means", label: "Enter calculated means", desc: "Pre-computed group means" },
  ],
  box: [{ id: "replicates", label: "Enter raw values per group", desc: "Each column is a group — quartiles computed automatically" }],
  violin: [{ id: "replicates", label: "Enter raw values per group", desc: "Each column is a group — density curves computed automatically" }],
  histogram: [{ id: "raw", label: "Enter raw values", desc: "Each column is a dataset — bins computed automatically" }],
  survival: [{ id: "time-event", label: "Time and event columns per group", desc: "Pairs of columns: Time, Event (1=event, 0=censored)" }],
  "dose-response": [{ id: "conc-response", label: "Concentration and response columns", desc: "First column = concentration (log or linear), rest = response values" }],
  roc: [{ id: "truth-score", label: "True label and prediction score", desc: "First column = actual (0/1), second = predicted score (0–1)" }],
  volcano: [{ id: "fc-pval", label: "Log2 fold change and p-value", desc: "First column = log2(FC), second = p-value" }],
  forest: [{ id: "effect-ci", label: "Effect size, CI lower, CI upper", desc: "Three columns per study: estimate, lower bound, upper bound" }],
  "bland-altman": [{ id: "method-pair", label: "Method A and Method B values", desc: "Paired measurements — difference vs mean computed automatically" }],
  heatmap: [{ id: "matrix", label: "Matrix of values", desc: "Rows and columns form the grid — values become colors" }],
  bubble: [{ id: "xyz", label: "X, Y, and Size columns", desc: "Three columns: X position, Y position, bubble size" }],
  "parts-of-whole": [{ id: "values", label: "Enter raw values", desc: "Each value becomes a slice" }],
  "stacked-bar": [{ id: "replicates", label: "Each column is a sub-category", desc: "Rows are groups, columns are stacked segments" }],
  "dot-strip": [{ id: "replicates", label: "Enter raw values per group", desc: "Each column is a group" }],
  "before-after": [{ id: "paired", label: "Before and After columns", desc: "Paired data — each row is one subject" }],
  waterfall: [{ id: "values", label: "Change values per subject", desc: "First column = labels, second = change from baseline" }],
  "qq-plot": [{ id: "raw", label: "Enter raw values", desc: "Each column tested against normal distribution" }],
  area: [{ id: "xy", label: "X and Y columns", desc: "First column = X, rest = Y traces" }],
  radar: [{ id: "categories", label: "Categories and values", desc: "First column = axis labels, rest = data series" }],
  ecdf: [{ id: "raw", label: "Enter raw values per group", desc: "Each column is a group" }],
  spaghetti: [{ id: "timepoints", label: "Time and subject data", desc: "First column = time, rest = individual subjects" }],
  lollipop: [{ id: "replicates", label: "Enter values per group", desc: "Each column is a category" }],
  ridgeline: [{ id: "replicates", label: "Enter raw values per group", desc: "Each column = a distribution" }],
  funnel: [{ id: "effect-se", label: "Effect size and SE", desc: "First column = effect, second = standard error" }],
};

// ── Small utility ──
export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
