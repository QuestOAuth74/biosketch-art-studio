import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Undo2, Redo2, Upload, Download, Plus, Trash2, X, Table,
  FileSpreadsheet, BarChart3, FlaskConical, ImageIcon, ArrowLeft,
  ScatterChart, LineChart, BoxSelect, PieChart, Columns, Rows,
  Palette, Ruler, Grid3X3, TrendingUp, ChevronRight, ChevronDown, Target, Activity, Zap,
  LayoutDashboard, Database, PanelLeftClose, PanelRightClose,
} from "lucide-react";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACTED MODULE IMPORTS (types, constants, statistics)
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  CellValue, ChartType, ViewTab, GraphSettings, PointShape, ChartTheme,
  DescriptiveStats, TestType, TestResult, AnalysisState, AssumptionCheck,
  TestSuggestion, LayoutMode, PageOrientation, PanelState, LayoutState,
  SavedDataset, SavedGraphPreset, ProjectState,
  Workbook, Dataset, GraphTab, AnalysisTab,
} from "./chart-studio/types";
import {
  createDataset, createGraphTab, createAnalysisTab, createEmptyWorkbook,
  getActiveDataset, updateActiveDataset, defaultGraphSettings, defaultLayoutState,
  humanizeChartType, suggestDatasetName, datasetAnalysesToLegacy,
} from "./chart-studio/workbook";

// ── Editor (Phase E1) ──
import type { ElementKey, EditorApi } from "./chart-studio/editor/types";
import { useEditor } from "./chart-studio/editor/useEditor";
import { keyToString, stringToKey } from "./chart-studio/editor/elementKey";
import { clientToSvgPoint, beginDrag, findElementKeyTarget } from "./chart-studio/editor/dragUtils";
import { SelectionOverlay } from "./chart-studio/editor/SelectionOverlay";
import { InlineTextEditor } from "./chart-studio/editor/InlineTextEditor";
import { FabricEditor } from "./chart-studio/editor/FabricEditor";
import { PropDrawer } from "./chart-studio/editor/PropDrawer";
import {
  COLORS, CHART_THEMES, PUB_PRESETS, FONT_OPTIONS, COLOR_PALETTES,
  GRAPH_TYPE_OPTIONS, DATA_ENTRY_OPTIONS, uid,
} from "./chart-studio/constants";
import {
  normalCDF, tCDF, tTestPValue, computeDescriptive, normalityTest,
  unpairedTTest, pairedTTest, oneSampleTTest, oneWayAnova, tukeyPostHoc,
  twoWayAnova, linearRegressionTest, mannWhitneyU, wilcoxonSignedRank,
  kruskalWallis, pearsonCorrelation, spearmanCorrelation, chiSquareTest,
  fisherExact, logRankTest, powerAnalysis, pcaAnalysis, kmeansAnalysis,
  hierarchicalCluster, multipleLinearReg, multipleLogisticReg, poissonReg,
  coxRegression, doseResponseAnalysis, suggestStatisticalTest,
} from "./chart-studio/statistics";

// Chart renderers
import { renderCorrelation } from "./chart-studio/charts/correlation";
import { renderColumnGrouped } from "./chart-studio/charts/columnGrouped";
import { renderBox } from "./chart-studio/charts/box";
import { renderViolin } from "./chart-studio/charts/violin";
import { renderSurvival } from "./chart-studio/charts/survival";
import { renderDoseResponse } from "./chart-studio/charts/doseResponse";
import { renderRoc } from "./chart-studio/charts/roc";
import { renderVolcano } from "./chart-studio/charts/volcano";
import { renderForest } from "./chart-studio/charts/forest";
import { renderBlandAltman } from "./chart-studio/charts/blandAltman";
import { renderHeatmap } from "./chart-studio/charts/heatmap";
import { renderBubble } from "./chart-studio/charts/bubble";
import { renderHistogram } from "./chart-studio/charts/histogram";
import { renderXy } from "./chart-studio/charts/xy";
import { renderStackedBar } from "./chart-studio/charts/stackedBar";
import { renderDotStrip } from "./chart-studio/charts/dotStrip";
import { renderBeforeAfter } from "./chart-studio/charts/beforeAfter";
import { renderWaterfall } from "./chart-studio/charts/waterfall";
import { renderQqPlot } from "./chart-studio/charts/qqPlot";
import { renderArea } from "./chart-studio/charts/area";
import { renderEcdf } from "./chart-studio/charts/ecdf";
import { renderLollipop } from "./chart-studio/charts/lollipop";
import { renderRidgeline } from "./chart-studio/charts/ridgeline";
import { renderFunnel } from "./chart-studio/charts/funnel";
import { renderRadar } from "./chart-studio/charts/radar";
import { renderSpaghetti } from "./chart-studio/charts/spaghetti";
import { renderPartsOfWhole } from "./chart-studio/charts/partsOfWhole";

// ═══════════════════════════════════════════════════════════════════════════════
// WELCOME DIALOG
// ═══════════════════════════════════════════════════════════════════════════════


// ── Continuous palette helper (Tier 3) ────────────────────────────────
// Very simple approximations of common scientific palettes — good enough for
// within-chart color mapping without a full d3 dependency.
const _CONTINUOUS_PALETTE_STOPS: Record<string, [number, number, number][]> = {
  viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
  plasma:  [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]],
  magma:   [[0, 0, 4], [80, 18, 123], [182, 54, 121], [251, 136, 97], [252, 253, 191]],
  cool:    [[13, 8, 135], [0, 180, 216], [144, 224, 239]],
  warm:    [[87, 37, 37], [224, 102, 56], [252, 191, 98], [252, 241, 166]],
};
function sampleContinuousPalette(name: string | undefined, t: number): string {
  const stops = _CONTINUOUS_PALETTE_STOPS[name || "viridis"] || _CONTINUOUS_PALETTE_STOPS.viridis;
  const clamped = Math.max(0, Math.min(1, t));
  const segs = stops.length - 1;
  const idx = clamped * segs;
  const i = Math.min(segs - 1, Math.floor(idx));
  const frac = idx - i;
  const a = stops[i], b = stops[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * frac);
  const g = Math.round(a[1] + (b[1] - a[1]) * frac);
  const bl = Math.round(a[2] + (b[2] - a[2]) * frac);
  return `rgb(${r},${g},${bl})`;
}

// ── Reproducibility badge helper (Tier 1) ─────────────────────────────
// Builds a one-line provenance string for the figure — example:
//   "n=8/group · column · Welch's t-test · α=0.05 · 2026-04-15 · Chart Studio v1"
const CHART_STUDIO_VERSION = "v1";
function buildProvenanceLine(
  columns: string[],
  rows: CellValue[][],
  settings: GraphSettings,
  tests: TestResult[] | undefined,
): string {
  const perCol = columns.map((_, ci) => rows.reduce((n, r) => n + (typeof r[ci] === "number" ? 1 : 0), 0));
  const nonZero = perCol.filter((n) => n > 0);
  if (nonZero.length === 0) return `Chart Studio ${CHART_STUDIO_VERSION} · ${new Date().toISOString().slice(0, 10)}`;
  const maxN = Math.max(...nonZero);
  const minN = Math.min(...nonZero);
  const nPart = minN === maxN ? `n=${maxN}/group` : `n=${minN}–${maxN}`;
  const chart = humanizeChartType(settings.chartType) || settings.chartType;
  const last = tests && tests.length > 0 ? tests[tests.length - 1] : null;
  const testPart = last ? last.testName : null;
  const date = new Date().toISOString().slice(0, 10);
  return [nPart, chart, testPart, "α=0.05", date, `Chart Studio ${CHART_STUDIO_VERSION}`]
    .filter(Boolean)
    .join(" · ");
}

// ── Data validation strip (Tier 1) ────────────────────────────────────
// Scans the current wide-format dataset and surfaces common issues in a
// dismissible inline panel above the spreadsheet.
function DataValidationStrip({ columns, rows }: { columns: string[]; rows: CellValue[][] }) {
  const [dismissed, setDismissed] = React.useState(false);
  const issues = React.useMemo(() => {
    const out: { kind: "warning" | "info"; text: string }[] = [];
    if (columns.length === 0 || rows.length === 0) return out;

    const numericByCol: number[][] = columns.map((_, ci) =>
      rows.map((r) => r[ci]).filter((v): v is number => typeof v === "number"),
    );
    const counts = numericByCol.map((c) => c.length);
    const nonEmptyCounts = counts.filter((n) => n > 0);

    // Missing values (per column)
    const totalCells = columns.length * rows.length;
    const filled = counts.reduce((s, n) => s + n, 0);
    const missing = totalCells - filled;
    if (missing > 0 && filled > 0) {
      const pct = Math.round((missing / totalCells) * 100);
      out.push({ kind: "info", text: `${missing} missing cell${missing !== 1 ? "s" : ""} (${pct}%) — check for blanks or non-numeric entries.` });
    }

    // Non-numeric entries
    let nonNumeric = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      for (let ci = 0; ci < columns.length; ci++) {
        const v = rows[ri][ci];
        if (typeof v === "string" && v.trim() !== "") nonNumeric++;
      }
    }
    if (nonNumeric > 0) out.push({ kind: "warning", text: `${nonNumeric} cell${nonNumeric !== 1 ? "s" : ""} contain non-numeric text.` });

    // Unequal group sizes
    if (nonEmptyCounts.length >= 2) {
      const maxN = Math.max(...nonEmptyCounts);
      const minN = Math.min(...nonEmptyCounts);
      if (maxN / minN > 2) {
        out.push({ kind: "warning", text: `Unbalanced groups: ${minN}–${maxN} per column (ratio ${(maxN / minN).toFixed(1)}:1) — may affect test assumptions.` });
      }
    }

    // Small samples
    if (nonEmptyCounts.length > 0 && Math.min(...nonEmptyCounts) < 5) {
      out.push({ kind: "warning", text: `Small sample size (n=${Math.min(...nonEmptyCounts)}) — statistical power is limited; consider nonparametric tests.` });
    }

    // IQR outliers
    let outlierCount = 0;
    numericByCol.forEach((vals) => {
      if (vals.length < 5) return;
      const sorted = [...vals].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      outlierCount += vals.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
    });
    if (outlierCount > 0) out.push({ kind: "info", text: `${outlierCount} outlier${outlierCount !== 1 ? "s" : ""} (IQR method) — verify before running tests.` });

    return out;
  }, [columns, rows]);

  if (dismissed || issues.length === 0) return null;
  const hasWarning = issues.some((i) => i.kind === "warning");

  return (
    <div
      style={{
        margin: "8px 10px 0",
        padding: "6px 10px",
        background: hasWarning ? "rgba(254, 243, 199, 0.6)" : "rgba(219, 234, 254, 0.5)",
        border: `1px solid ${hasWarning ? "#fde68a" : "#bfdbfe"}`,
        borderRadius: 6,
        fontSize: 11,
        display: "flex", alignItems: "flex-start", gap: 8,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <span style={{ fontSize: 13, lineHeight: "16px" }}>{hasWarning ? "⚠" : "ℹ"}</span>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {issues.map((iss, i) => (
          <div key={i} style={{ color: iss.kind === "warning" ? "#92400e" : "#1e40af" }}>{iss.text}</div>
        ))}
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", color: "#64748b", cursor: "default", padding: 0, fontSize: 13, lineHeight: "14px" }}
        title="Dismiss"
      >×</button>
    </div>
  );
}

function WelcomeDialog({ open, onCreate, onClose }: { open: boolean; onCreate: (type: ChartType, overrides?: Partial<GraphSettings>, importedData?: { columns: string[]; rows: CellValue[][] }) => void; onClose?: () => void }) {
  const [selectedType, setSelectedType] = useState<ChartType>("column");
  const [selectedEntry, setSelectedEntry] = useState("replicates");
  const [step, setStep] = useState<1 | 2>(1);

  // Uploaded dataset
  const [uploadedCols, setUploadedCols] = useState<string[] | null>(null);
  const [uploadedRows, setUploadedRows] = useState<CellValue[][] | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Parse CSV/TSV text into columns + rows
  const parseData = (text: string, fileName?: string) => {
    const lines = text.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 2) { toast.error("Need at least a header row and one data row"); return; }
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const rows = lines.slice(1).map((line) =>
      line.split(sep).map((v) => {
        const t = v.trim().replace(/^["']|["']$/g, "");
        if (t === "") return null;
        const num = Number(t);
        return isNaN(num) ? t : num;
      })
    );
    // Pad rows to header length
    const maxCols = headers.length;
    const padded = rows.map((r) => [...r, ...Array(Math.max(0, maxCols - r.length)).fill(null)]);
    setUploadedCols(headers);
    setUploadedRows(padded);
    setUploadedFileName(fileName || `${padded.length} rows × ${headers.length} cols`);
    toast.success(`Loaded ${padded.length} rows × ${headers.length} columns`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) parseData(text, file.name);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteArea = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (text.trim()) { e.preventDefault(); parseData(text, "Pasted data"); }
  };

  const clearUpload = () => { setUploadedCols(null); setUploadedRows(null); setUploadedFileName(null); };

  // Step 2 customization state
  const [cfgTitle, setCfgTitle] = useState("");
  const [cfgXLabel, setCfgXLabel] = useState("");
  const [cfgYLabel, setCfgYLabel] = useState("");
  const [cfgTheme, setCfgTheme] = useState("modern");
  const [cfgPalette, setCfgPalette] = useState("default");
  const [cfgPreset, setCfgPreset] = useState("default");
  const [cfgFont, setCfgFont] = useState("Inter, sans-serif");
  const [cfgWidth, setCfgWidth] = useState(740);
  const [cfgHeight, setCfgHeight] = useState(520);
  const [cfgGrid, setCfgGrid] = useState(true);
  const [cfgErrorBars, setCfgErrorBars] = useState(true);
  const [cfgErrorType, setCfgErrorType] = useState<"sd" | "sem" | "ci95">("sem");
  const [cfgDataPoints, setCfgDataPoints] = useState(true);
  const [cfgPointShape, setCfgPointShape] = useState<PointShape>("circle");
  const [cfgLineStyle, setCfgLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [cfgLegendPos, setCfgLegendPos] = useState<GraphSettings["legendPosition"]>("top-right");

  const entryOptions = DATA_ENTRY_OPTIONS[selectedType];

  useEffect(() => {
    setSelectedEntry(entryOptions[0].id);
  }, [selectedType]);

  // Reset step 2 defaults when chart type changes
  useEffect(() => {
    const needsErrorBars = ["column", "grouped", "box", "violin", "dot-strip"].includes(selectedType);
    const needsDataPoints = !["heatmap", "parts-of-whole", "funnel", "forest", "waterfall", "stacked-bar", "area", "ridgeline"].includes(selectedType);
    setCfgErrorBars(needsErrorBars);
    setCfgDataPoints(needsDataPoints);
    setCfgTitle("");
    setCfgXLabel("");
    setCfgYLabel("");
  }, [selectedType]);

  // Apply preset when changed
  useEffect(() => {
    if (cfgPreset !== "default") {
      const ps = PUB_PRESETS[cfgPreset]?.settings;
      if (ps) {
        if (ps.fontFamily) setCfgFont(ps.fontFamily);
        if (ps.chartWidth) setCfgWidth(ps.chartWidth);
        if (ps.chartHeight) setCfgHeight(ps.chartHeight);
        if (ps.colorPalette) setCfgPalette(ps.colorPalette);
      }
    }
  }, [cfgPreset]);

  const selectedOption = GRAPH_TYPE_OPTIONS.find((o) => o.id === selectedType);

  const handleFinish = () => {
    const overrides: Partial<GraphSettings> = {
      title: cfgTitle || undefined,
      xLabel: cfgXLabel || undefined,
      yLabel: cfgYLabel || undefined,
      chartTheme: cfgTheme,
      colorPalette: cfgPalette,
      traceColors: COLOR_PALETTES[cfgPalette]?.colors || [...COLORS],
      fontFamily: cfgFont,
      chartWidth: cfgWidth,
      chartHeight: cfgHeight,
      showGrid: cfgGrid,
      showErrorBars: cfgErrorBars,
      errorBarType: cfgErrorType,
      showDataPoints: cfgDataPoints,
      pointShape: cfgPointShape,
      lineStyle: cfgLineStyle,
      legendPosition: cfgLegendPos,
    };
    // Also fold in any pub preset typography settings
    if (cfgPreset !== "default") {
      const ps = PUB_PRESETS[cfgPreset]?.settings;
      if (ps) Object.assign(overrides, ps);
    }
    const importedData = uploadedCols && uploadedRows ? { columns: uploadedCols, rows: uploadedRows } : undefined;
    onCreate(selectedType, overrides, importedData);
    setStep(1); // reset for next time
    clearUpload();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 28, padding: "0 8px", fontSize: 11, fontWeight: 500,
    border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#1e293b",
    fontFamily: "'Segoe UI', Inter, sans-serif", outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" };
  const sectionStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 10, marginBottom: 6, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 };
  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px", fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: "default",
    background: active ? "#1e293b" : "#f1f5f9", color: active ? "#fff" : "#475569",
    border: `1px solid ${active ? "#1e293b" : "#d1d5db"}`, transition: "all 0.1s",
    fontFamily: "'Segoe UI', Inter, sans-serif",
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && onClose) onClose(); }}>
      <DialogContent className="p-0 gap-0 border-slate-300 shadow-2xl overflow-hidden [&>button:last-child]:hidden" style={{ borderRadius: 6, maxWidth: step === 1 ? 560 : 640, maxHeight: "90vh" }} onPointerDownOutside={(e) => e.preventDefault()}>
        {/* Header */}
        <div style={{ background: "#f1f5f9", borderBottom: "1px solid #d1d5db", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 className="h-4 w-4 text-slate-500" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: "'Segoe UI', Inter, sans-serif" }}>
            {step === 1 ? "New Chart Project" : `Configure — ${selectedOption?.label || selectedType}`}
          </span>
          {step === 2 && <span style={{ fontSize: 10, color: "#64748b", marginLeft: "auto", marginRight: 8 }}>Step 2 of 2</span>}
          <div style={{ flex: 1 }} />
          {onClose && (
            <button onClick={onClose} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", borderRadius: 4, color: "#64748b" }} title="Skip — go to editor">
              <X style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>

        {step === 1 && (
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Select Graph Type</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {GRAPH_TYPE_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSelectedType(id)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "8px 4px", fontSize: 9, fontWeight: 600, color: selectedType === id ? "white" : "#475569",
                    background: selectedType === id ? "#1e293b" : "#f8fafc",
                    border: `1px solid ${selectedType === id ? "#1e293b" : "#e2e8f0"}`,
                    borderRadius: 4, cursor: "default", transition: "all 0.1s",
                    fontFamily: "'Segoe UI', Inter, sans-serif",
                  }}
                >
                  <Icon style={{ width: 16, height: 16 }} />
                  <span style={{ lineHeight: 1.1, textAlign: "center" }}>{label.split("(")[0].trim()}</span>
                </button>
              ))}
            </div>

            {selectedOption && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, color: "#475569", lineHeight: 1.4 }}>
                <strong style={{ color: "#1e293b" }}>{selectedOption.label}:</strong> {selectedOption.desc}
              </div>
            )}

            {entryOptions.length > 1 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 12, marginBottom: 6 }}>Data Entry Format</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {entryOptions.map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setSelectedEntry(id)}
                      style={{
                        flex: 1, padding: "6px 8px", fontSize: 10, fontWeight: 600, textAlign: "left",
                        color: selectedEntry === id ? "#1e40af" : "#475569",
                        background: selectedEntry === id ? "#dbeafe" : "#f8fafc",
                        border: `1px solid ${selectedEntry === id ? "#93c5fd" : "#e2e8f0"}`,
                        borderRadius: 4, cursor: "default",
                        fontFamily: "'Segoe UI', Inter, sans-serif",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Dataset upload */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 12, marginBottom: 6 }}>Import Dataset <span style={{ textTransform: "none", fontWeight: 500, color: "#94a3b8" }}>(optional)</span></div>
            {!uploadedFileName ? (
              <div
                onPaste={handlePasteArea}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.background = "#eff6ff"; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.background = "#fafafa"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.background = "#fafafa";
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => { const t = ev.target?.result as string; if (t) parseData(t, file.name); };
                    reader.readAsText(file);
                  }
                }}
                tabIndex={0}
                style={{
                  border: "2px dashed #d1d5db", borderRadius: 6, padding: "14px 12px",
                  background: "#fafafa", textAlign: "center", cursor: "default",
                  transition: "all 0.15s", outline: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                  <Upload style={{ width: 14, height: 14, color: "#64748b" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#334155" }}>Drop CSV/TSV file here or paste data</span>
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>First row = headers. Supports comma & tab separated.</div>
                <label style={{
                  display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px",
                  fontSize: 10, fontWeight: 600, color: "#1e40af", background: "#dbeafe",
                  border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer",
                }}>
                  <FileSpreadsheet style={{ width: 12, height: 12 }} />
                  Browse File
                  <input type="file" accept=".csv,.tsv,.txt,.tab" onChange={handleFileUpload} style={{ display: "none" }} />
                </label>
              </div>
            ) : (
              <div style={{
                border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px",
                background: "#f0fdf4", display: "flex", alignItems: "center", gap: 8,
              }}>
                <FileSpreadsheet style={{ width: 14, height: 14, color: "#16a34a", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#166534", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{uploadedFileName}</div>
                  <div style={{ fontSize: 10, color: "#4ade80" }}>{uploadedCols?.length} columns, {uploadedRows?.length} rows</div>
                </div>
                <button onClick={clearUpload} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  <X style={{ width: 14, height: 14, color: "#6b7280" }} />
                </button>
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  height: 30, padding: "0 20px", fontSize: 11, fontWeight: 700,
                  background: "#1e40af", color: "white", border: "1px solid #1e3a8a",
                  borderRadius: 3, cursor: "default", display: "flex", alignItems: "center", gap: 6,
                  fontFamily: "'Segoe UI', Inter, sans-serif",
                }}
              >
                Next: Customize <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: 16, overflowY: "auto", maxHeight: "calc(90vh - 48px)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>

              {/* ── LEFT COLUMN ── */}
              <div>
                {/* Titles & Labels */}
                <div style={sectionStyle}>Titles &amp; Labels</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>
                    <div style={labelStyle}>Chart Title</div>
                    <input style={inputStyle} placeholder={`e.g. Effect of Treatment on ${selectedType === "survival" ? "Survival" : "Response"}`} value={cfgTitle} onChange={(e) => setCfgTitle(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>X-Axis Label</div>
                      <input style={inputStyle} placeholder="e.g. Treatment Group" value={cfgXLabel} onChange={(e) => setCfgXLabel(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Y-Axis Label</div>
                      <input style={inputStyle} placeholder="e.g. Response (units)" value={cfgYLabel} onChange={(e) => setCfgYLabel(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Theme */}
                <div style={sectionStyle}>Chart Theme</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(CHART_THEMES).map(([id, t]) => (
                    <button key={id} onClick={() => setCfgTheme(id)} style={{ ...chipStyle(cfgTheme === id), display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: t.bgColor, border: "1px solid #94a3b8", display: "inline-block" }} />
                      {t.name}
                    </button>
                  ))}
                </div>

                {/* Color Palette */}
                <div style={sectionStyle}>Color Palette</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
                    <button key={key} onClick={() => setCfgPalette(key)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 4, cursor: "default",
                      background: cfgPalette === key ? "#dbeafe" : "#fafafa",
                      border: `1px solid ${cfgPalette === key ? "#3b82f6" : "#e2e8f0"}`,
                    }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {pal.colors.slice(0, 8).map((c, i) => (
                          <span key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, display: "inline-block", border: "1px solid rgba(0,0,0,0.08)" }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: cfgPalette === key ? "#1e40af" : "#475569" }}>{pal.name}</span>
                    </button>
                  ))}
                </div>

                {/* Publication Preset */}
                <div style={sectionStyle}>Publication Preset</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(PUB_PRESETS).map(([key, p]) => (
                    <button key={key} onClick={() => setCfgPreset(key)} style={chipStyle(cfgPreset === key)}>{p.name}</button>
                  ))}
                </div>
              </div>

              {/* ── RIGHT COLUMN ── */}
              <div>
                {/* Display Options */}
                <div style={sectionStyle}>Display Options</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#334155", fontWeight: 500, cursor: "default" }}>
                    <input type="checkbox" checked={cfgGrid} onChange={(e) => setCfgGrid(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#1e40af" }} />
                    Show Grid Lines
                  </label>
                  {["column", "grouped", "box", "violin", "dot-strip", "xy", "dose-response"].includes(selectedType) && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#334155", fontWeight: 500, cursor: "default" }}>
                      <input type="checkbox" checked={cfgDataPoints} onChange={(e) => setCfgDataPoints(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#1e40af" }} />
                      Show Data Points
                    </label>
                  )}
                  {["column", "grouped", "box", "violin", "dot-strip"].includes(selectedType) && (
                    <>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#334155", fontWeight: 500, cursor: "default" }}>
                        <input type="checkbox" checked={cfgErrorBars} onChange={(e) => setCfgErrorBars(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#1e40af" }} />
                        Show Error Bars
                      </label>
                      {cfgErrorBars && (
                        <div style={{ marginLeft: 22, display: "flex", gap: 4 }}>
                          {(["sem", "sd", "ci95"] as const).map((t) => (
                            <button key={t} onClick={() => setCfgErrorType(t)} style={chipStyle(cfgErrorType === t)}>
                              {t === "sem" ? "SEM" : t === "sd" ? "SD" : "95% CI"}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Point & Line Style */}
                {["xy", "scatter", "dose-response", "box", "violin", "dot-strip", "before-after", "qq-plot", "bubble", "spaghetti"].includes(selectedType) && (
                  <>
                    <div style={sectionStyle}>Point &amp; Line Style</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div>
                        <div style={labelStyle}>Point Shape</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                          {(["circle", "square", "triangle", "diamond", "plus", "cross"] as PointShape[]).map((s) => (
                            <button key={s} onClick={() => setCfgPointShape(s)} style={{
                              ...chipStyle(cfgPointShape === s), padding: "4px 8px", fontSize: 10,
                            }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={labelStyle}>Line Style</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                          {(["solid", "dashed", "dotted"] as const).map((s) => (
                            <button key={s} onClick={() => setCfgLineStyle(s)} style={chipStyle(cfgLineStyle === s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Typography */}
                <div style={sectionStyle}>Typography</div>
                <div>
                  <div style={labelStyle}>Font Family</div>
                  <select value={cfgFont} onChange={(e) => setCfgFont(e.target.value)} style={{ ...inputStyle, cursor: "default" }}>
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label} ({f.group})</option>
                    ))}
                  </select>
                </div>

                {/* Dimensions */}
                <div style={sectionStyle}>Dimensions</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Width (px)</div>
                    <input type="number" style={inputStyle} min={300} max={1200} step={10} value={cfgWidth} onChange={(e) => setCfgWidth(Number(e.target.value))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Height (px)</div>
                    <input type="number" style={inputStyle} min={200} max={900} step={10} value={cfgHeight} onChange={(e) => setCfgHeight(Number(e.target.value))} />
                  </div>
                </div>

                {/* Legend */}
                <div style={sectionStyle}>Legend</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(["top-right", "top-left", "bottom-right", "bottom-left", "none"] as const).map((p) => (
                    <button key={p} onClick={() => setCfgLegendPos(p)} style={chipStyle(cfgLegendPos === p)}>
                      {p === "none" ? "Hidden" : p.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  height: 30, padding: "0 16px", fontSize: 11, fontWeight: 600,
                  background: "#f1f5f9", color: "#475569", border: "1px solid #d1d5db",
                  borderRadius: 3, cursor: "default", display: "flex", alignItems: "center", gap: 4,
                  fontFamily: "'Segoe UI', Inter, sans-serif",
                }}
              >
                <ArrowLeft style={{ width: 13, height: 13 }} /> Back
              </button>
              <button
                onClick={handleFinish}
                style={{
                  height: 30, padding: "0 24px", fontSize: 11, fontWeight: 700,
                  background: "#1e40af", color: "white", border: "1px solid #1e3a8a",
                  borderRadius: 3, cursor: "default", display: "flex", alignItems: "center", gap: 6,
                  fontFamily: "'Segoe UI', Inter, sans-serif",
                }}
              >
                Create Chart <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART SWITCH SETUP DIALOG (step 2 only — for switching chart type from toolbar)
// ═══════════════════════════════════════════════════════════════════════════════

function ChartSwitchSetupDialog({ open, chartType, currentSettings, onApply, onCancel }: {
  open: boolean; chartType: ChartType; currentSettings: GraphSettings;
  onApply: (overrides: Partial<GraphSettings>) => void; onCancel: () => void;
}) {
  const [cfgTitle, setCfgTitle] = useState(currentSettings.title || "");
  const [cfgXLabel, setCfgXLabel] = useState(currentSettings.xLabel || "");
  const [cfgYLabel, setCfgYLabel] = useState(currentSettings.yLabel || "");
  const [cfgTheme, setCfgTheme] = useState(currentSettings.chartTheme || "modern");
  const [cfgPalette, setCfgPalette] = useState(currentSettings.colorPalette || "default");
  const [cfgFont, setCfgFont] = useState(currentSettings.fontFamily || "Inter, sans-serif");
  const [cfgWidth, setCfgWidth] = useState(currentSettings.chartWidth || 740);
  const [cfgHeight, setCfgHeight] = useState(currentSettings.chartHeight || 520);
  const [cfgGrid, setCfgGrid] = useState(currentSettings.showGrid);
  const [cfgErrorBars, setCfgErrorBars] = useState(currentSettings.showErrorBars);
  const [cfgErrorType, setCfgErrorType] = useState(currentSettings.errorBarType || "sem");
  const [cfgDataPoints, setCfgDataPoints] = useState(currentSettings.showDataPoints);
  const [cfgPointShape, setCfgPointShape] = useState(currentSettings.pointShape || "circle");
  const [cfgLineStyle, setCfgLineStyle] = useState(currentSettings.lineStyle || "solid");
  const [cfgLegendPos, setCfgLegendPos] = useState(currentSettings.legendPosition || "top-right");

  // Reset relevant defaults when opened
  useEffect(() => {
    if (open) {
      setCfgTitle(currentSettings.title || "");
      setCfgXLabel(currentSettings.xLabel || "");
      setCfgYLabel(currentSettings.yLabel || "");
      setCfgTheme(currentSettings.chartTheme || "modern");
      setCfgPalette(currentSettings.colorPalette || "default");
      setCfgFont(currentSettings.fontFamily || "Inter, sans-serif");
      setCfgWidth(currentSettings.chartWidth || 740);
      setCfgHeight(currentSettings.chartHeight || 520);
      setCfgGrid(currentSettings.showGrid);
      setCfgErrorBars(currentSettings.showErrorBars);
      setCfgErrorType(currentSettings.errorBarType || "sem");
      setCfgDataPoints(currentSettings.showDataPoints);
      setCfgPointShape(currentSettings.pointShape || "circle");
      setCfgLineStyle(currentSettings.lineStyle || "solid");
      setCfgLegendPos(currentSettings.legendPosition || "top-right");
    }
  }, [open, currentSettings]);

  const label = GRAPH_TYPE_OPTIONS.find((o) => o.id === chartType)?.label || chartType;

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 28, padding: "0 8px", fontSize: 11, fontWeight: 500,
    border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#1e293b",
    fontFamily: "'Segoe UI', Inter, sans-serif", outline: "none",
  };
  const labelSt: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" };
  const sectionSt: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 10, marginBottom: 6, borderBottom: "1px solid #e2e8f0", paddingBottom: 3 };
  const chip = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px", fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: "default",
    background: active ? "#1e293b" : "#f1f5f9", color: active ? "#fff" : "#475569",
    border: `1px solid ${active ? "#1e293b" : "#d1d5db"}`, transition: "all 0.1s",
    fontFamily: "'Segoe UI', Inter, sans-serif",
  });

  const handleApply = () => {
    onApply({
      chartType,
      title: cfgTitle || undefined,
      xLabel: cfgXLabel || undefined,
      yLabel: cfgYLabel || undefined,
      chartTheme: cfgTheme,
      colorPalette: cfgPalette,
      traceColors: COLOR_PALETTES[cfgPalette]?.colors || [...COLORS],
      fontFamily: cfgFont,
      chartWidth: cfgWidth,
      chartHeight: cfgHeight,
      showGrid: cfgGrid,
      showErrorBars: cfgErrorBars,
      errorBarType: cfgErrorType,
      showDataPoints: cfgDataPoints,
      pointShape: cfgPointShape,
      lineStyle: cfgLineStyle,
      legendPosition: cfgLegendPos,
    });
  };

  return (
    <Dialog open={open}>
      <DialogContent className="p-0 gap-0 border-slate-300 shadow-2xl overflow-hidden" style={{ borderRadius: 6, maxWidth: 640, maxHeight: "90vh" }} onPointerDownOutside={() => onCancel()}>
        <div style={{ background: "#f1f5f9", borderBottom: "1px solid #d1d5db", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 className="h-4 w-4 text-slate-500" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: "'Segoe UI', Inter, sans-serif" }}>
            Configure — {label}
          </span>
        </div>
        <div style={{ padding: 16, overflowY: "auto", maxHeight: "calc(90vh - 48px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            {/* LEFT */}
            <div>
              <div style={sectionSt}>Titles &amp; Labels</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><div style={labelSt}>Chart Title</div><input style={inputStyle} placeholder="Chart title" value={cfgTitle} onChange={(e) => setCfgTitle(e.target.value)} /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}><div style={labelSt}>X-Axis</div><input style={inputStyle} placeholder="X label" value={cfgXLabel} onChange={(e) => setCfgXLabel(e.target.value)} /></div>
                  <div style={{ flex: 1 }}><div style={labelSt}>Y-Axis</div><input style={inputStyle} placeholder="Y label" value={cfgYLabel} onChange={(e) => setCfgYLabel(e.target.value)} /></div>
                </div>
              </div>
              <div style={sectionSt}>Chart Theme</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Object.entries(CHART_THEMES).map(([id, t]) => (
                  <button key={id} onClick={() => setCfgTheme(id)} style={{ ...chip(cfgTheme === id), display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: t.bgColor, border: "1px solid #94a3b8", display: "inline-block" }} />{t.name}
                  </button>
                ))}
              </div>
              <div style={sectionSt}>Color Palette</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
                  <button key={key} onClick={() => setCfgPalette(key)} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 4, cursor: "default",
                    background: cfgPalette === key ? "#dbeafe" : "#fafafa", border: `1px solid ${cfgPalette === key ? "#3b82f6" : "#e2e8f0"}`,
                  }}>
                    <div style={{ display: "flex", gap: 2 }}>{pal.colors.slice(0, 8).map((c, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, display: "inline-block", border: "1px solid rgba(0,0,0,0.08)" }} />)}</div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: cfgPalette === key ? "#1e40af" : "#475569" }}>{pal.name}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* RIGHT */}
            <div>
              <div style={sectionSt}>Display Options</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#334155", fontWeight: 500, cursor: "default" }}>
                  <input type="checkbox" checked={cfgGrid} onChange={(e) => setCfgGrid(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#1e40af" }} />Show Grid Lines
                </label>
                {["column", "grouped", "box", "violin", "dot-strip", "xy", "dose-response"].includes(chartType) && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#334155", fontWeight: 500, cursor: "default" }}>
                    <input type="checkbox" checked={cfgDataPoints} onChange={(e) => setCfgDataPoints(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#1e40af" }} />Show Data Points
                  </label>
                )}
                {["column", "grouped", "box", "violin", "dot-strip"].includes(chartType) && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#334155", fontWeight: 500, cursor: "default" }}>
                      <input type="checkbox" checked={cfgErrorBars} onChange={(e) => setCfgErrorBars(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#1e40af" }} />Show Error Bars
                    </label>
                    {cfgErrorBars && (
                      <div style={{ marginLeft: 22, display: "flex", gap: 4 }}>
                        {(["sem", "sd", "ci95"] as const).map((t) => <button key={t} onClick={() => setCfgErrorType(t)} style={chip(cfgErrorType === t)}>{t === "sem" ? "SEM" : t === "sd" ? "SD" : "95% CI"}</button>)}
                      </div>
                    )}
                  </>
                )}
              </div>
              {["xy", "dose-response", "box", "violin", "dot-strip", "before-after", "qq-plot", "bubble", "spaghetti"].includes(chartType) && (
                <>
                  <div style={sectionSt}>Point &amp; Line Style</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div><div style={labelSt}>Point Shape</div><div style={{ display: "flex", gap: 4, marginTop: 3 }}>{(["circle", "square", "triangle", "diamond", "plus", "cross"] as PointShape[]).map((s) => <button key={s} onClick={() => setCfgPointShape(s)} style={{ ...chip(cfgPointShape === s), padding: "4px 8px" }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>)}</div></div>
                    <div><div style={labelSt}>Line Style</div><div style={{ display: "flex", gap: 4, marginTop: 3 }}>{(["solid", "dashed", "dotted"] as const).map((s) => <button key={s} onClick={() => setCfgLineStyle(s)} style={chip(cfgLineStyle === s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>)}</div></div>
                  </div>
                </>
              )}
              <div style={sectionSt}>Typography</div>
              <div><div style={labelSt}>Font Family</div><select value={cfgFont} onChange={(e) => setCfgFont(e.target.value)} style={{ ...inputStyle, cursor: "default" }}>{FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label} ({f.group})</option>)}</select></div>
              <div style={sectionSt}>Dimensions</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}><div style={labelSt}>Width</div><input type="number" style={inputStyle} min={300} max={1200} step={10} value={cfgWidth} onChange={(e) => setCfgWidth(Number(e.target.value))} /></div>
                <div style={{ flex: 1 }}><div style={labelSt}>Height</div><input type="number" style={inputStyle} min={200} max={900} step={10} value={cfgHeight} onChange={(e) => setCfgHeight(Number(e.target.value))} /></div>
              </div>
              <div style={sectionSt}>Legend</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(["top-right", "top-left", "bottom-right", "bottom-left", "none"] as const).map((p) => <button key={p} onClick={() => setCfgLegendPos(p)} style={chip(cfgLegendPos === p)}>{p === "none" ? "Hidden" : p.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</button>)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
            <button onClick={onCancel} style={{ height: 30, padding: "0 16px", fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "1px solid #d1d5db", borderRadius: 3, cursor: "default", fontFamily: "'Segoe UI', Inter, sans-serif" }}>Cancel</button>
            <button onClick={handleApply} style={{ height: 30, padding: "0 24px", fontSize: 11, fontWeight: 700, background: "#1e40af", color: "white", border: "1px solid #1e3a8a", borderRadius: 3, cursor: "default", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Segoe UI', Inter, sans-serif" }}>
              Apply <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPREADSHEET
// ═══════════════════════════════════════════════════════════════════════════════

function Spreadsheet({
  columns, rows, onCellChange, onColumnRename, onAddColumn, onRemoveColumn, onAddRow, onRemoveRow, onPasteData, onSortColumn,
}: {
  columns: string[]; rows: CellValue[][];
  onCellChange: (r: number, c: number, v: CellValue) => void;
  onColumnRename: (c: number, name: string) => void;
  onAddColumn: () => void; onRemoveColumn: (c: number) => void;
  onAddRow: () => void; onRemoveRow: (r: number) => void;
  onPasteData: (startRow: number, startCol: number, data: CellValue[][]) => void;
  onSortColumn: (col: number, ascending: boolean) => void;
}) {
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);

  // Handle paste from clipboard (Excel/Sheets/TSV)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const startR = selectedCell?.r ?? 0;
    const startC = selectedCell?.c ?? 0;
    const pastedRows = text.split("\n").filter((line) => line.trim() !== "").map((line) =>
      line.split("\t").map((cell) => {
        const trimmed = cell.trim();
        if (trimmed === "") return null;
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      })
    );
    if (pastedRows.length > 0) {
      e.preventDefault();
      onPasteData(startR, startC, pastedRows);
      toast.success(`Pasted ${pastedRows.length} rows × ${pastedRows[0].length} columns`);
    }
  }, [selectedCell, onPasteData]);

  return (
    <div className="flex-1 overflow-auto bg-white" onPaste={handlePaste}>
      <table className="border-collapse w-full" style={{ minWidth: columns.length * 130 + 50 }}>
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="w-[44px] min-w-[44px] text-center text-[10px] font-bold text-slate-400 bg-slate-50 border-b-2 border-r border-slate-300 sticky left-0 z-20">#</th>
            {columns.map((col, ci) => (
              <th key={ci} className="bg-slate-50 border-b-2 border-r border-slate-300 min-w-[130px] relative group">
                {editingHeader === ci ? (
                  <input
                    autoFocus
                    defaultValue={col}
                    className="w-full h-full bg-white text-xs font-bold text-center outline-none border-2 border-blue-500 px-2 py-2 text-slate-800"
                    style={{ background: "#eff6ff" }}
                    onBlur={(e) => { onColumnRename(ci, e.target.value || col); setEditingHeader(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingHeader(null); }}
                  />
                ) : (
                  <div
                    className="py-2 px-3 text-xs font-bold text-slate-600 cursor-text select-none truncate hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    onClick={() => setEditingHeader(ci)}
                    title="Click to rename column"
                  >
                    {col}
                  </div>
                )}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-all">
                  <button onClick={() => onSortColumn(ci, true)} title="Sort ascending" className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-blue-600" style={{ fontSize: 8 }}>▲</button>
                  <button onClick={() => onSortColumn(ci, false)} title="Sort descending" className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-blue-600" style={{ fontSize: 8 }}>▼</button>
                  {columns.length > 1 && <button onClick={() => onRemoveColumn(ci)} title="Remove column" className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-red-500"><X className="h-2.5 w-2.5" /></button>}
                </div>
              </th>
            ))}
            <th className="w-9 bg-slate-50 border-b-2 border-slate-300">
              <button onClick={onAddColumn} className="w-full flex items-center justify-center text-slate-300 hover:text-blue-500 py-2 transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group/row hover:bg-blue-50/20">
              <td className="text-center text-[10px] font-medium text-slate-400 bg-slate-50/50 border-r border-b border-slate-300 sticky left-0 z-10 relative">
                {ri + 1}
                <button onClick={() => onRemoveRow(ri)} className="absolute inset-0 opacity-0 group-hover/row:opacity-100 flex items-center justify-center bg-red-50 text-red-400 hover:text-red-600 transition-all">
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </td>
              {row.map((cell, ci) => {
                const isNonNumeric = cell !== null && typeof cell === "string" && cell !== "" && isNaN(Number(cell));
                return (
                <td key={ci} className="p-0 border-r border-b border-slate-300 relative">
                  <input
                    className={cn("cs-cell-input", isNonNumeric && "cs-cell-warn")}
                    value={cell === null ? "" : String(cell)}
                    title={isNonNumeric ? "Non-numeric value — will be excluded from charts and analysis" : undefined}
                    onFocus={() => setSelectedCell({ r: ri, c: ci })}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = Number(v);
                      onCellChange(ri, ci, v === "" ? null : isNaN(num) ? v : num);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        const nextR = e.key === "Enter" ? ri + 1 : ri;
                        const nextC = e.key === "Tab" ? (e.shiftKey ? ci - 1 : ci + 1) : ci;
                        const row = e.key === "Enter" ? (e.currentTarget.closest("tr")?.nextElementSibling) : e.currentTarget.closest("tr");
                        const cell = row?.querySelector(`td:nth-child(${Math.max(2, nextC + 2)}) input`) as HTMLInputElement;
                        if (cell) cell.focus();
                      }
                    }}
                  />
                  {isNonNumeric && <div style={{ position: "absolute", top: 1, right: 2, width: 0, height: 0, borderLeft: "5px solid transparent", borderTop: "5px solid #ef4444" }} />}
                </td>
                );
              })}
              <td className="border-b border-slate-300" />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 bg-white border-t border-slate-300">
        <button onClick={onAddRow} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all uppercase tracking-wider">
          <Plus className="h-3 w-3" /> Add Row
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_PAD = { top: 48, right: 36, bottom: 56, left: 62 };

// ── Resizable Panel Handle ──
function ResizeHandle({ side, onResize }: { side: "right" | "left"; onResize: (width: number) => void }) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const panel = (e.target as HTMLElement).parentElement;
    if (!panel) return;
    const startX = e.clientX;
    const startWidth = panel.offsetWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = side === "right" ? ev.clientX - startX : startX - ev.clientX;
      onResize(startWidth + delta);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [side, onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="cs-resize-handle"
      style={{ [side === "right" ? "right" : "left"]: -3 }}
    />
  );
}

function ChartCanvas({ columns, rows, settings, onAnnotationMove, onSettingChange, onSettingChangeTransient, onPushUndoSnapshot, onColumnRename, onPrompt, activeTextInputRef, editor }: { columns: string[]; rows: CellValue[][]; settings: GraphSettings; onAnnotationMove?: (index: number, x: number, y: number, arrowToX?: number, arrowToY?: number) => void; onSettingChange?: (field: keyof GraphSettings, value: any) => void; onSettingChangeTransient?: (field: keyof GraphSettings, value: any) => void; onPushUndoSnapshot?: () => void; onColumnRename?: (col: number, name: string) => void; onPrompt?: (title: string, label: string, defaultValue: string, onConfirm: (value: string) => void) => void; activeTextInputRef?: React.MutableRefObject<HTMLInputElement | null>; editor?: EditorApi }) {
  const [hoveredSeries, setHoveredSeries] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  // Holds the target's DOMRect captured at the moment of double-click, OR null when
  // not editing. Rect is viewport coords; the InlineTextEditor anchors directly to it.
  const [editingTitle, setEditingTitle] = useState<DOMRect | null>(null);
  const [editingXLabel, setEditingXLabel] = useState<DOMRect | null>(null);
  const [editingYLabel, setEditingYLabel] = useState<DOMRect | null>(null);
  // Editor-related hooks declared UP HERE (before any conditional return) to keep
  // the hook count stable across renders. React forbids changing hook counts.
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [fabricEditMode, setFabricEditMode] = useState(false);
  const { chartType, title, xLabel, yLabel, showGrid, showErrorBars, errorBarType, showDataPoints, showRegression, xAutoRange, xMin: xMinManual, xMax: xMaxManual, yAutoRange, yMin: yMinManual, yMax: yMaxManual, xLogScale, yLogScale, traceColors, pBrackets, fontFamily, titleSize, axisLabelSize, tickLabelSize, titleBold, axisLabelBold, legendPosition, legendBorder, pointShape, lineWidth: lw, lineStyle, chartWidth: cW, chartHeight: cH, chartTheme: themeId, axisLineWeight, errorBarWeight, xTickAngle: xTickAngleSetting } = settings;
  const tc = (i: number) => (traceColors || COLORS)[i % (traceColors || COLORS).length] || COLORS[i % COLORS.length];
  const to = (i: number) => (settings.traceOpacities && settings.traceOpacities[i] !== undefined) ? settings.traceOpacities[i] : 1;
  const ff = fontFamily || "Inter, sans-serif";
  const W = cW || 740, H = cH || 520;
  const dashArray = lineStyle === "dashed" ? "8 4" : lineStyle === "dotted" ? "2 3" : "";
  const theme = CHART_THEMES[themeId || "modern"] || CHART_THEMES.modern;

  // ── X-axis tick label rotation ──
  // Resolves "auto" to 0, 45, or 90 based on label count and available width
  function resolveTickAngle(labels: string[], availableWidth: number): 0 | 45 | 90 {
    const angle = xTickAngleSetting ?? "auto";
    if (angle !== "auto") return (angle || 0) as 0 | 45 | 90;
    if (labels.length === 0) return 0;
    const acw = tickLabelSize * 0.55;
    const maxW = Math.max(...labels.map((l) => l.length * acw));
    const spacePer = availableWidth / labels.length;
    if (maxW < spacePer * 0.9) return 0;
    if (maxW < spacePer * 2) return 45;
    return 90;
  }

  // Render an x-axis tick label with rotation
  function renderXTickLabel(x: number, baseY: number, label: string, angle: 0 | 45 | 90, key: string | number, opts?: { fontSize?: number; fontWeight?: number; fill?: string }) {
    const fs = opts?.fontSize ?? tickLabelSize;
    const fw = opts?.fontWeight ?? 500;
    const fill = opts?.fill ?? theme.tickLabelColor;
    if (angle === 0) {
      return <text key={key} x={x} y={baseY} textAnchor="middle" fontSize={fs} fontWeight={fw} fill={fill}>{label}</text>;
    }
    if (angle === 45) {
      return <text key={key} x={x} y={baseY} textAnchor="end" fontSize={fs} fontWeight={fw} fill={fill} transform={`rotate(-45,${x},${baseY})`}>{label}</text>;
    }
    // 90°
    return <text key={key} x={x} y={baseY} textAnchor="end" fontSize={fs} fontWeight={fw} fill={fill} transform={`rotate(-90,${x},${baseY})`} dominantBaseline="central">{label}</text>;
  }

  // Hex helpers for bar-gradient stops. Lighten mixes toward white by
  // `amount`; darken multiplies by (1 - amount). Only touched when
  // theme.barGradient === true — plain flat fills are unaffected.
  function _lightenHex(hex: string, amount: number): string {
    const h = hex.replace("#", "");
    if (h.length < 6) return hex;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount));
    return `#${mix(r).toString(16).padStart(2, "0")}${mix(g).toString(16).padStart(2, "0")}${mix(b).toString(16).padStart(2, "0")}`;
  }
  function _darkenHex(hex: string, amount: number): string {
    const h = hex.replace("#", "");
    if (h.length < 6) return hex;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const f = 1 - amount;
    return `#${Math.round(r * f).toString(16).padStart(2, "0")}${Math.round(g * f).toString(16).padStart(2, "0")}${Math.round(b * f).toString(16).padStart(2, "0")}`;
  }

  // Pre-compute one linear gradient per trace-color when the theme opts in.
  // Bars painted with `url(#cs-bar-grad-{idx})` get a subtle top-to-bottom
  // gradient — lighter at the top of the bar, saturated at the base —
  // giving depth without competing with data. Uses objectBoundingBox so a
  // single def works for bars of any height.
  const barGradientColors = theme.barGradient
    ? (traceColors && traceColors.length > 0 ? traceColors : COLORS).slice(0, 32)
    : [];

  // SVG filters and CSS for premium rendering
  const svgDefs = (
    <defs>
      <filter id="cs-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
      </filter>
      <filter id="cs-legend-shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.06" />
      </filter>
      <filter id="cs-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      {barGradientColors.map((c, i) => (
        <linearGradient key={`cs-bar-grad-${i}`} id={`cs-bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={_lightenHex(c, 0.14)} />
          <stop offset="100%" stopColor={_darkenHex(c, 0.04)} />
        </linearGradient>
      ))}
    </defs>
  );

  const svgStyle: React.CSSProperties = {
    background: theme.bgColor, fontFamily: ff,
    shapeRendering: "geometricPrecision" as any,
    transition: "background 0.3s ease",
  };

  // Theme-aware point renderer
  function renderThemedPoint(cx: number, cy: number, r: number, color: string, key: string | number) {
    const shadow = theme.pointShadow ? "url(#cs-shadow)" : undefined;
    const sw = theme.pointStrokeWidth;
    const fillColor = theme.pointFillMode === "hollow" ? "none" : theme.pointFillMode === "white-fill" ? (theme.id === "dark" ? theme.bgColor : "white") : color;
    const strokeColor = theme.pointFillMode === "solid" ? (theme.id === "dark" ? "none" : "white") : color;

    const s = r;
    switch (pointShape) {
      case "square": return <rect key={key} x={cx - s} y={cy - s} width={s * 2} height={s * 2} fill={fillColor} stroke={strokeColor} strokeWidth={sw} filter={shadow} />;
      case "triangle": return <polygon key={key} points={`${cx},${cy - s * 1.2} ${cx - s},${cy + s * 0.7} ${cx + s},${cy + s * 0.7}`} fill={fillColor} stroke={strokeColor} strokeWidth={sw} filter={shadow} />;
      case "diamond": return <polygon key={key} points={`${cx},${cy - s * 1.3} ${cx + s},${cy} ${cx},${cy + s * 1.3} ${cx - s},${cy}`} fill={fillColor} stroke={strokeColor} strokeWidth={sw} filter={shadow} />;
      case "plus": return <g key={key} filter={shadow}><line x1={cx - s} y1={cy} x2={cx + s} y2={cy} stroke={color} strokeWidth={sw + 1} strokeLinecap="round" /><line x1={cx} y1={cy - s} x2={cx} y2={cy + s} stroke={color} strokeWidth={sw + 1} strokeLinecap="round" /></g>;
      case "cross": return <g key={key} filter={shadow}><line x1={cx - s * 0.8} y1={cy - s * 0.8} x2={cx + s * 0.8} y2={cy + s * 0.8} stroke={color} strokeWidth={sw + 1} strokeLinecap="round" /><line x1={cx + s * 0.8} y1={cy - s * 0.8} x2={cx - s * 0.8} y2={cy + s * 0.8} stroke={color} strokeWidth={sw + 1} strokeLinecap="round" /></g>;
      default: return <circle key={key} cx={cx} cy={cy} r={r} fill={fillColor} stroke={strokeColor} strokeWidth={sw} filter={shadow} />;
    }
  }

  // Bar fill. When the active theme sets `barGradient: true`, returns a
  // reference to a pre-computed linear gradient (see svgDefs above) keyed
  // by the series index. Falls back to the flat color for any theme that
  // opts out (default) — preserving the historical look for every existing
  // chart on a non-gradient theme.
  function barFill(color: string, idx: number) {
    if (theme.barGradient && idx < barGradientColors.length) {
      return `url(#cs-bar-grad-${idx})`;
    }
    return color;
  }

  // Theme-aware axes
  function renderAxes() {
    const aw = axisLineWeight || theme.axisWidth;
    const showRight = theme.showRightAxis || settings.showDualYAxis;
    return <g>
      <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={aw} strokeLinecap={theme.axisLinecap as any} />
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={aw} strokeLinecap={theme.axisLinecap as any} />
      {theme.showTopAxis && <line x1={PAD.left} y1={PAD.top} x2={PAD.left + pw} y2={PAD.top} stroke={theme.axisColor} strokeWidth={aw * 0.5} strokeLinecap={theme.axisLinecap as any} />}
      {showRight && <line x1={PAD.left + pw} y1={PAD.top} x2={PAD.left + pw} y2={PAD.top + ph} stroke={theme.axisColor} strokeWidth={aw} strokeLinecap={theme.axisLinecap as any} />}
    </g>;
  }

  // Reference lines (Tier 3) — drawn above the plot area after grid/axes.
  // Callers pass their x/y scale functions so values map to screen coords.
  function renderReferenceLines(sxFn: (v: number) => number, syFn: (v: number) => number) {
    const lines = settings.referenceLines;
    if (!lines || lines.length === 0) return null;
    return <g>
      {lines.map((ln) => {
        const dash = ln.dashed ? "6 4" : "";
        if (ln.axis === "y") {
          const y = syFn(ln.value);
          if (!isFinite(y)) return null;
          return <g key={ln.id}>
            <line x1={PAD.left} y1={y} x2={PAD.left + pw} y2={y} stroke={ln.color} strokeWidth={1.2} strokeDasharray={dash} opacity={0.8} />
            {ln.label && <text x={PAD.left + pw - 4} y={y - 3} textAnchor="end" fontSize={10} fill={ln.color} fontFamily={ff} fontWeight={500}>{ln.label}</text>}
          </g>;
        }
        const x = sxFn(ln.value);
        if (!isFinite(x)) return null;
        return <g key={ln.id}>
          <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + ph} stroke={ln.color} strokeWidth={1.2} strokeDasharray={dash} opacity={0.8} />
          {ln.label && <text x={x + 3} y={PAD.top + 10} fontSize={10} fill={ln.color} fontFamily={ff} fontWeight={500}>{ln.label}</text>}
        </g>;
      })}
    </g>;
  }

  // Theme-aware grid
  function renderGrid(xTicks: number[], yTicks: number[], sxFn: (v: number) => number, syFn: (v: number) => number) {
    if (!showGrid) return null;
    return <g>
      {!theme.gridHorizontalOnly && xTicks.map((v, i) => <line key={`xg${i}`} x1={sxFn(v)} y1={PAD.top} x2={sxFn(v)} y2={PAD.top + ph} stroke={theme.gridColor} strokeWidth={theme.gridWidth} strokeDasharray={theme.gridDash} opacity={theme.gridOpacity} />)}
      {yTicks.map((v, i) => <line key={`yg${i}`} x1={PAD.left} y1={syFn(v)} x2={PAD.left + pw} y2={syFn(v)} stroke={theme.gridColor} strokeWidth={theme.gridWidth} strokeDasharray={theme.gridDash} opacity={theme.gridOpacity} />)}
    </g>;
  }

  // Theme-aware legend
  // Drag handler receives the current legend origin so the grabbed point
  // stays under the cursor while dragging (no more leap-to-cursor on first
  // move). Switches position to "custom" on mousedown before the first move
  // so intermediate renders don't fall back to the preset branch.
  function handleLegendDrag(e: React.MouseEvent, originX: number, originY: number) {
    if (!onSettingChange) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = (e.target as SVGElement).closest("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;

    // Where inside the legend the user grabbed, in chart coords.
    const startMouseX = (e.clientX - rect.left) * scaleX;
    const startMouseY = (e.clientY - rect.top) * scaleY;
    const grabOffsetX = startMouseX - originX;
    const grabOffsetY = startMouseY - originY;

    // Seed custom mode + current pixel position so the very first mousemove
    // doesn't briefly fall back to the preset branch (which was making the
    // legend look "unresponsive" on drag).
    onSettingChange("legendPosition", "custom");
    onSettingChange("legendX", originX);
    onSettingChange("legendY", originY);

    const onMove = (ev: MouseEvent) => {
      const mx = (ev.clientX - rect.left) * scaleX - grabOffsetX;
      const my = (ev.clientY - rect.top) * scaleY - grabOffsetY;
      onSettingChange("legendX", mx);
      onSettingChange("legendY", my);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "grabbing";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function renderThemedLegend(items: { color: string; label: string }[]) {
    if (items.length <= 1 || legendPosition === "none") return null;
    const fontSize = tickLabelSize + 1;
    const rowH = Math.max(20, fontSize * 1.8);
    const maxLabelLen = Math.max(...items.map((item) => item.label.length));
    const legendW = Math.max(80, 28 + maxLabelLen * fontSize * 0.6);
    const legendH = items.length * rowH + 8;

    // Compute legend origin (lx, ly). Preset positions place the legend at
    // the chart edge, using the reserved margin space that Phase 3 sized
    // for it — so the legend sits OUTSIDE the plot area when applicable
    // (right, bottom-*) and INSIDE when it's a top-corner variant.
    let lx: number, ly: number;
    if (legendPosition === "custom" && settings.legendX !== null && settings.legendY !== null) {
      lx = settings.legendX;
      ly = settings.legendY;
    } else {
      // X: right-side pins to the chart's right edge (8 px margin) so the
      // legend fills the reserved right padding. Left-side sits just inside
      // the plot area.
      lx = legendPosition.includes("right")
        ? W - legendW - 8
        : PAD.left + 10;
      // Y: bottom-side pins beneath the plot area + tick labels so the
      // legend never occludes data. Top-side sits at the top of the plot.
      ly = legendPosition.includes("bottom")
        ? Math.min(H - legendH - 4, PAD.top + ph + rotationExtraPad + axisLabelSize + 20) + 14
        : PAD.top + 14;
    }

    return <g style={{ cursor: "grab" }} onMouseDown={(e) => handleLegendDrag(e, lx, ly)}>
      <rect x={lx - 10} y={ly - 14} width={legendW} height={legendH} fill={theme.legendBgColor} opacity={theme.legendBgOpacity} rx={theme.legendCornerRadius} stroke={legendBorder ? theme.axisColor : "none"} strokeWidth={0.5} filter={theme.legendShadow ? "url(#cs-legend-shadow)" : undefined} />
      {items.map((item, i) => (
        <g key={i} transform={`translate(${lx}, ${ly + i * rowH})`}
          style={{ cursor: "grab" }}
          onMouseEnter={() => setHoveredSeries(i)}
          onMouseLeave={() => setHoveredSeries(null)}
          opacity={hoveredSeries !== null && hoveredSeries !== i ? 0.4 : 1}
        >
          <circle cx={6} cy={0} r={4} fill={item.color} stroke={theme.pointFillMode === "hollow" ? item.color : "white"} strokeWidth={1} />
          <text x={18} y={4} fontSize={tickLabelSize + 1} fill={theme.tickLabelColor} fontWeight={hoveredSeries === i ? 700 : 500}>{item.label}</text>
        </g>
      ))}
    </g>;
  }

  // Tooltip renderer
  function renderTooltip() {
    if (!tooltip) return null;
    const tw = Math.max(60, tooltip.label.length * 6 + 16);
    const tx = Math.min(tooltip.x, W - tw - 5);
    const ty = tooltip.y - 28;
    return <g style={{ pointerEvents: "none" }}>
      <rect x={tx - 4} y={ty - 2} width={tw} height={20} rx={4} fill={theme.id === "dark" ? "#2a2a4a" : "#1e293b"} opacity={0.9} filter={theme.useShadowFilter ? "url(#cs-shadow)" : undefined} />
      <text x={tx + tw / 2 - 4} y={ty + 13} textAnchor="middle" fontSize={10} fontWeight={600} fill="white" fontFamily={ff}>{tooltip.label}</text>
    </g>;
  }

  // Series opacity based on legend hover
  function seriesOpacity(seriesIndex: number) {
    if (hoveredSeries === null) return 1;
    return hoveredSeries === seriesIndex ? 1 : 0.15;
  }

  // ── Adaptive layout math ──
  // Kills three common overlap complaints without touching individual chart
  // renderers: (a) left margin adapts to expected Y-tick label width, (b)
  // right/bottom margins expand when the legend would occlude data, (c)
  // extra bottom pad grows with rotated X-tick labels (existing behavior).
  const avgCharW = tickLabelSize * 0.55;

  // (a) Adaptive left margin — estimate the widest Y-tick label. If the user
  // has fixed the Y range manually we can compute exactly; otherwise we
  // assume a conservative 5-char worst case (e.g. "12.34", "1500", "1e-3").
  // Buffer covers the tick mark itself + a small gap.
  const yLabelChars = (() => {
    const chars = (v: number | null | undefined) => {
      if (v === null || v === undefined || !isFinite(v)) return 5;
      const abs = Math.abs(v);
      if (abs >= 1e6 || (abs > 0 && abs < 1e-2)) return 6; // scientific
      const s = Math.round(v * 100) / 100;
      return String(s).length;
    };
    const fromSettings = Math.max(chars(yMinManual), chars(yMaxManual));
    return Math.max(fromSettings, 5);
  })();
  const yLabelPx = yLabelChars * avgCharW;
  const yAxisLabelPx = yLabel ? axisLabelSize * 1.4 : 0; // rotated axis title band
  const adaptivePadLeft = Math.ceil(yLabelPx + yAxisLabelPx + 16);
  const basePadLeft = Math.max(settings.marginLeft || DEFAULT_PAD.left, adaptivePadLeft);

  // (b) Adaptive right margin — if the legend sits on the right, reserve
  // enough width for it so it never crashes into the data marks. Estimated
  // from the column count + longest column-name length (worst case for the
  // typical trace legend).
  const legendItemCount = Math.max(1, columns.length);
  const legendMaxLabelLen = Math.max(...columns.map((c) => c.length), 6);
  const legendWidthEst = Math.ceil(28 + legendMaxLabelLen * (tickLabelSize + 1) * 0.6);
  const isRightLegend = legendPosition && legendPosition.includes("right") && legendPosition !== "custom";
  const isBottomLegend = legendPosition && legendPosition.includes("bottom") && legendPosition !== "custom";
  const rightLegendPadding = isRightLegend && legendItemCount >= 2
    ? Math.max(0, legendWidthEst + 12 - DEFAULT_PAD.right)
    : 0;
  const basePadRight = Math.max(settings.marginRight || DEFAULT_PAD.right, DEFAULT_PAD.right + rightLegendPadding);

  const prePadPw = W - basePadLeft - basePadRight;
  const longestLabel = Math.max(...columns.map((c) => c.length), 4);
  const maxLabelPx = longestLabel * avgCharW;

  // Resolve the effective angle using pre-pad width
  const effectiveAngle: 0 | 45 | 90 = (() => {
    const angle = xTickAngleSetting ?? "auto";
    if (angle !== "auto") return (angle || 0) as 0 | 45 | 90;
    const spacePer = prePadPw / Math.max(columns.length, 1);
    if (maxLabelPx < spacePer * 0.9) return 0;
    // Prefer 45° a bit more aggressively than 90° — reads more legibly at
    // normal densities. Only slam to 90° when labels are >3× the tick space.
    if (maxLabelPx < spacePer * 3) return 45;
    return 90;
  })();

  const rotationExtraPad = (() => {
    if (effectiveAngle === 45) return Math.min(maxLabelPx * 0.65, 60);
    if (effectiveAngle === 90) return Math.min(maxLabelPx * 0.9, 100);
    return 0;
  })();

  // (c) Extra pad for rotated X labels + bottom legend space if applicable.
  // Cap total extra pad so plot area never shrinks below 40% of chart height.
  const basePadBottom = settings.marginBottom || DEFAULT_PAD.bottom;
  const basePadTop = settings.marginTop || DEFAULT_PAD.top;
  const legendRowH = Math.max(20, (tickLabelSize + 1) * 1.8);
  const bottomLegendPad = isBottomLegend && legendItemCount >= 2
    ? Math.ceil(legendItemCount * legendRowH + 12)
    : 0;
  const totalExtraBottom = rotationExtraPad + bottomLegendPad;
  const maxExtraPad = Math.max(0, H * 0.35 - basePadBottom);
  const clampedExtraPad = Math.min(totalExtraBottom, maxExtraPad);

  const PAD = { top: basePadTop, right: basePadRight, bottom: basePadBottom + clampedExtraPad, left: basePadLeft };
  const pw = W - PAD.left - PAD.right, ph = H - PAD.top - PAD.bottom;

  // Clip path to prevent data from overflowing axes
  function plotClipDef() {
    return <clipPath id="cs-clip"><rect x={PAD.left} y={PAD.top} width={Math.max(0, pw)} height={Math.max(0, ph)} /></clipPath>;
  }

  const colData = useMemo(() => columns.map((_, ci) => rows.map((r) => r[ci]).filter((v): v is number => typeof v === "number")), [columns, rows]);

  // Compute stats per column for error bars
  const colStats = useMemo(() => colData.map((vals) => {
    if (vals.length === 0) return { mean: 0, sd: 0, sem: 0, n: 0 };
    const n = vals.length, mean = vals.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1 || 1));
    return { mean, sd, sem: sd / Math.sqrt(n), n };
  }), [colData]);

  // Point shape renderer
  // Alias old renderPoint to themed version
  function renderPoint(cx: number, cy: number, r: number, color: string, key: string | number, _opacity = 0.9) {
    return renderThemedPoint(cx, cy, r, color, key);
  }

  // Render annotations overlay
  function handleAnnotationDrag(e: React.MouseEvent, index: number, dragTarget: "start" | "end") {
    if (!onAnnotationMove) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = (e.target as SVGElement).closest("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const ann = settings.annotations[index];

    const onMove = (ev: MouseEvent) => {
      const mx = (ev.clientX - rect.left) * scaleX;
      const my = (ev.clientY - rect.top) * scaleY;
      if (dragTarget === "start") {
        onAnnotationMove(index, mx, my, ann.arrowToX, ann.arrowToY);
      } else {
        onAnnotationMove(index, ann.x, ann.y, mx, my);
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "grabbing";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function renderAnnotations() {
    if (!settings.annotations || settings.annotations.length === 0) return null;
    const annColor = theme.id === "dark" ? "#e2e8f0" : "#1a1a1a";
    return <g>
      {settings.annotations.map((ann, i) => {
        if (ann.type === "arrow" && ann.arrowToX !== undefined && ann.arrowToY !== undefined) {
          return (
            <g key={`ann${i}`}>
              <defs><marker id={`arrowhead-${i}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill={annColor} /></marker></defs>
              <line x1={ann.x} y1={ann.y} x2={ann.arrowToX} y2={ann.arrowToY} stroke={annColor} strokeWidth={1.5} markerEnd={`url(#arrowhead-${i})`} />
              <circle cx={ann.x} cy={ann.y} r={6} fill="transparent" stroke="transparent" style={{ cursor: "grab" }} onMouseDown={(e) => handleAnnotationDrag(e, i, "start")} />
              <circle cx={ann.arrowToX} cy={ann.arrowToY} r={6} fill="transparent" stroke="transparent" style={{ cursor: "grab" }} onMouseDown={(e) => handleAnnotationDrag(e, i, "end")} />
              {ann.text && <text x={ann.x} y={ann.y - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill={annColor} fontFamily={ff} style={{ cursor: "grab" }} onMouseDown={(e) => handleAnnotationDrag(e, i, "start")}>{ann.text}</text>}
            </g>
          );
        }
        return (
          <g key={`ann${i}`} style={{ cursor: "grab" }} onMouseDown={(e) => handleAnnotationDrag(e, i, "start")}>
            <rect x={ann.x - 30} y={ann.y - 14} width={60} height={18} fill="transparent" />
            <text x={ann.x} y={ann.y} textAnchor="middle" fontSize={11} fontWeight={600} fill={annColor} fontFamily={ff}>
              {ann.text}
            </text>
          </g>
        );
      })}
    </g>;
  }

  // For XY: first col = X, rest = Y
  // For Column: each col = a group
  const isXY = chartType === "xy";
  const xVals = isXY ? colData[0] || [] : [];
  const yTraces = isXY ? colData.slice(1) : [];
  const allY = isXY ? yTraces.flat() : colData.flat();

  if (allY.length === 0) {
    return (
      <svg width={W} height={H} className="rounded-2xl" style={{ background: "white", fontFamily: "Inter, sans-serif" }}>
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        <text x={W / 2} y={H / 2 - 10} textAnchor="middle" fill="#94a3b8" fontSize={15} fontWeight={500}>Add numeric data to see your chart</text>
        <text x={W / 2} y={H / 2 + 12} textAnchor="middle" fill="#cbd5e1" fontSize={12}>Switch to the Data Table tab to enter values</text>
      </svg>
    );
  }

  // ── Data Compatibility Check ──
  function dataIncompatibleMessage(): string | null {
    const nCols = columns.length;
    const numericCols = colData.filter((d) => d.length > 0).length;
    const totalNumeric = colData.flat().length;

    // XY types need at least 2 columns with first as X
    if (["xy", "area", "spaghetti"].includes(chartType)) {
      if (nCols < 2) return "This chart type needs at least 2 columns (X and Y values).";
      if (colData[0].length === 0) return "First column (X values) has no numeric data.";
      if (colData.slice(1).every((d) => d.length === 0)) return "Y columns have no numeric data.";
    }

    // Correlation needs X and Y with at least 3 points
    if (chartType === "correlation") {
      if (numericCols < 2) return "Correlation plot needs X and Y columns with numeric data.";
      if (Math.min(colData[0].length, colData[1].length) < 3) return "Need at least 3 paired data points for correlation.";
    }

    // Paired types need exactly 2 numeric columns
    if (chartType === "before-after" || chartType === "bland-altman") {
      if (numericCols < 2) return "This chart type needs at least 2 columns of paired numeric data.";
    }

    // Survival needs pairs of Time/Event columns
    if (chartType === "survival") {
      if (nCols < 2 || nCols % 2 !== 0) return "Survival analysis needs paired columns: Time, Event (1=event, 0=censored).";
    }

    // Dose-response needs X + Y
    if (chartType === "dose-response") {
      if (numericCols < 2) return "Dose-response needs Concentration (X) and Response (Y) columns.";
    }

    // ROC needs actual (0/1) and predicted score
    if (chartType === "roc") {
      if (numericCols < 2) return "ROC curve needs Actual (0/1) and Predicted Score columns.";
    }

    // Volcano needs log2FC and p-value
    if (chartType === "volcano") {
      if (numericCols < 2) return "Volcano plot needs log₂(Fold Change) and p-value columns.";
    }

    // Forest needs Study, Effect, CI Lower, CI Upper
    if (chartType === "forest") {
      if (nCols < 4) return "Forest plot needs Study name, Effect size, CI Lower, and CI Upper columns.";
    }

    // Bubble needs X, Y, Size
    if (chartType === "bubble") {
      if (numericCols < 3) return "Bubble plot needs X, Y, and Size columns (3 numeric columns).";
    }

    // Funnel needs effect + SE
    if (chartType === "funnel") {
      if (numericCols < 2) return "Funnel plot needs Effect Size and Standard Error columns.";
    }

    // Radar needs labels + at least 1 series with 3+ axes
    if (chartType === "radar") {
      const axisLabels = rows.filter((r) => typeof r[0] === "string").length;
      if (axisLabels < 3) return "Radar chart needs at least 3 rows with axis labels in the first column.";
      if (nCols < 2) return "Radar chart needs at least 1 data series column.";
    }

    // Waterfall/Lollipop need labels + values
    if (chartType === "waterfall" || chartType === "lollipop") {
      if (nCols < 2) return "This chart type needs a Label column and a Value column.";
    }

    // QQ plot needs at least some data
    if (chartType === "qq-plot") {
      if (totalNumeric < 3) return "QQ plot needs at least 3 numeric values.";
    }

    // General: need some numeric data
    if (totalNumeric === 0) return "No numeric data found. Enter values in the Data Table.";

    return null;
  }

  const incompatibleMsg = dataIncompatibleMessage();
  if (incompatibleMsg) {
    return (
      <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">
        {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
        <text x={W / 2} y={H / 2 - 20} textAnchor="middle" fontSize={14} fontWeight={600} fill={theme.titleColor}>⚠ Data Not Compatible</text>
        <text x={W / 2} y={H / 2 + 8} textAnchor="middle" fontSize={12} fill={theme.tickLabelColor}>{incompatibleMsg}</text>
        <text x={W / 2} y={H / 2 + 30} textAnchor="middle" fontSize={11} fill={theme.tickLabelColor} opacity={0.6}>Switch to a compatible chart type or adjust your data.</text>
      </svg>
    );
  }

  // ── Build renderer props bundle (passed to extracted chart renderers) ──
  const rendererProps: import("./chart-studio/charts/types").ChartRendererProps = {
    columns, rows, settings, theme,
    colData, colStats,
    isXY, xVals, yTraces, allY,
    W, H, PAD, pw, ph,
    chartType: chartType || "",
    title: title || "", xLabel: xLabel || "", yLabel: yLabel || "",
    showGrid: !!showGrid, showErrorBars: !!showErrorBars, errorBarType: errorBarType || "sd",
    showDataPoints: !!showDataPoints, showRegression: !!showRegression,
    xAutoRange: xAutoRange !== false, xMinManual: xMinManual ?? null, xMaxManual: xMaxManual ?? null,
    yAutoRange: yAutoRange !== false, yMinManual: yMinManual ?? null, yMaxManual: yMaxManual ?? null,
    xLogScale: !!xLogScale, yLogScale: !!yLogScale,
    pBrackets: pBrackets || [],
    fontFamily: ff, titleSize, axisLabelSize, tickLabelSize,
    titleBold: !!titleBold, axisLabelBold: !!axisLabelBold,
    legendPosition: legendPosition || "top-right", legendBorder: !!legendBorder,
    pointShape: pointShape || "circle",
    lw, dashArray, axisLineWeight: axisLineWeight || 0, errorBarWeight: errorBarWeight || 0, ff,
    tc, to,
    svgDefs, svgStyle,
    resolveTickAngle, renderXTickLabel, renderThemedPoint, renderPoint, barFill,
    renderAxes, renderGrid, renderThemedLegend, renderTooltip, renderAnnotations, renderReferenceLines,
    sampleContinuousPalette,
    seriesOpacity, plotClipDef,
    hoveredSeries, setHoveredSeries, tooltip, setTooltip,
    editingTitle, setEditingTitle, editingXLabel, setEditingXLabel, editingYLabel, setEditingYLabel,
    elementStyles: settings.elementStyles,
    onSettingChange, onColumnRename, onPrompt, activeTextInputRef,
  };

  // ── Editor pointer dispatch (Phase E1) ──
  // (editorContainerRef declared at the top of the component.)
  const getChartSvgEl = (): SVGSVGElement | null =>
    (editorContainerRef.current?.querySelector("#chart-studio-svg") as SVGSVGElement | null) ?? null;

  const handleEditorDoubleClick = (e: React.MouseEvent) => {
    const target = findElementKeyTarget(e.target as Element);
    if (!target) return;
    const parsed = stringToKey(target.key);
    if (!parsed) return;
    // Capture the target element's rect at click time (element exists right now).
    const rect = (target.el as Element).getBoundingClientRect();
    if (parsed.kind === "title") { setEditingTitle(rect); e.stopPropagation(); }
    else if (parsed.kind === "xlabel") { setEditingXLabel(rect); e.stopPropagation(); }
    else if (parsed.kind === "ylabel") { setEditingYLabel(rect); e.stopPropagation(); }
  };

  const handleEditorPointerMove = (e: React.PointerEvent) => {
    if (!editor) return;
    if (editor.state.mode === "dragging") return; // don't thrash hover mid-drag
    const target = findElementKeyTarget(e.target as Element);
    if (!target) { editor.hover(null); return; }
    const parsed = stringToKey(target.key);
    editor.hover(parsed);
  };

  const handleEditorPointerLeave = () => {
    if (!editor) return;
    if (editor.state.mode === "dragging") return;
    editor.hover(null);
  };

  // ── Fabric edit mode (prototype) — state declared at top of the component. ──

  const handleEditorPointerDown = (e: React.PointerEvent) => {
    if (!editor) return;
    // Skip if the user is doing inline text editing (double-click title handlers).
    if (editingTitle || editingXLabel || editingYLabel) return;
    const target = findElementKeyTarget(e.target as Element);
    if (!target) { editor.deselect(); return; }
    const parsed = stringToKey(target.key);
    if (!parsed) return;
    editor.select(parsed);
    // Begin drag only for element kinds we know how to move.
    const draggable = parsed.kind === "title" || parsed.kind === "xlabel" || parsed.kind === "ylabel" || parsed.kind === "legend";
    if (!draggable) return;
    // Prefer the transient setter during drag (no undo flood) + snap one undo entry at start.
    const writeLive = onSettingChangeTransient || onSettingChange;
    if (!writeLive) return;
    const svg = getChartSvgEl();
    if (!svg) return;
    const keyStr = target.key;
    const prevOverride = settings.elementStyles?.[keyStr] ?? {};
    const baseDx = prevOverride.offsetX ?? 0;
    const baseDy = prevOverride.offsetY ?? 0;
    onPushUndoSnapshot?.();
    editor.setMode("dragging");
    beginDrag({
      svg,
      startEvent: { clientX: e.clientX, clientY: e.clientY },
      onMove: (dx, dy) => {
        const nextStyles = {
          ...(settings.elementStyles || {}),
          [keyStr]: { ...prevOverride, offsetX: baseDx + dx, offsetY: baseDy + dy },
        };
        writeLive("elementStyles", nextStyles);
      },
      onEnd: () => editor.setMode("idle"),
      onCancel: () => {
        const nextStyles = { ...(settings.elementStyles || {}), [keyStr]: prevOverride };
        writeLive("elementStyles", nextStyles);
        editor.setMode("idle");
      },
    });
  };

  // ── Dispatch to the right renderer, capture its SVG output ──
  let chartSvg: ReactNode = null;
  if (chartType === "correlation") chartSvg = renderCorrelation(rendererProps);
  else if (chartType === "column" || chartType === "grouped") chartSvg = renderColumnGrouped(rendererProps);
  else if (chartType === "box") chartSvg = renderBox(rendererProps);
  else if (chartType === "violin") chartSvg = renderViolin(rendererProps);
  else if (chartType === "survival") chartSvg = renderSurvival(rendererProps);
  else if (chartType === "dose-response") chartSvg = renderDoseResponse(rendererProps);
  else if (chartType === "roc") chartSvg = renderRoc(rendererProps);
  else if (chartType === "volcano") chartSvg = renderVolcano(rendererProps);
  else if (chartType === "forest") chartSvg = renderForest(rendererProps);
  else if (chartType === "bland-altman") chartSvg = renderBlandAltman(rendererProps);
  else if (chartType === "heatmap") chartSvg = renderHeatmap(rendererProps);
  else if (chartType === "bubble") chartSvg = renderBubble(rendererProps);
  else if (chartType === "histogram") chartSvg = renderHistogram(rendererProps);
  else if (isXY && xVals.length > 0) chartSvg = renderXy(rendererProps);
  else if (chartType === "stacked-bar") chartSvg = renderStackedBar(rendererProps);
  else if (chartType === "dot-strip") chartSvg = renderDotStrip(rendererProps);
  else if (chartType === "before-after") chartSvg = renderBeforeAfter(rendererProps);
  else if (chartType === "waterfall") chartSvg = renderWaterfall(rendererProps);
  else if (chartType === "qq-plot") chartSvg = renderQqPlot(rendererProps);
  else if (chartType === "area") chartSvg = renderArea(rendererProps);
  else if (chartType === "ecdf") chartSvg = renderEcdf(rendererProps);
  else if (chartType === "lollipop") chartSvg = renderLollipop(rendererProps);
  else if (chartType === "ridgeline") chartSvg = renderRidgeline(rendererProps);
  else if (chartType === "funnel") chartSvg = renderFunnel(rendererProps);
  else if (chartType === "radar") chartSvg = renderRadar(rendererProps);
  else if (chartType === "spaghetti") chartSvg = renderSpaghetti(rendererProps);
  else if (chartType === "parts-of-whole") chartSvg = renderPartsOfWhole(rendererProps);

  if (chartSvg) {
    const selectedKeyStr = editor?.state.selected ? keyToString(editor.state.selected) : null;
    const selectedStyle = selectedKeyStr ? settings.elementStyles?.[selectedKeyStr] : undefined;
    return (
      <div
        ref={editorContainerRef}
        style={{ position: "relative", display: "inline-block", lineHeight: 0 }}
        onPointerDown={handleEditorPointerDown}
        onPointerMove={handleEditorPointerMove}
        onPointerLeave={handleEditorPointerLeave}
        onDoubleClick={handleEditorDoubleClick}
      >
        {chartSvg}
        {editor && (
          <svg
            width={W} height={H}
            viewBox={`0 0 ${W} ${H}`}
            style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
          >
            <SelectionOverlay
              svg={getChartSvgEl()}
              selected={editor.state.selected}
              hovering={editor.state.hovering}
            />
          </svg>
        )}
        {fabricEditMode && onSettingChange && (
          <FabricEditor
            W={W}
            H={H}
            settings={settings}
            defaultColors={{ title: theme.titleColor, axisLabel: theme.axisLabelColor }}
            onCommit={(updates) => {
              if (updates.title !== undefined) onSettingChange("title", updates.title);
              if (updates.xLabel !== undefined) onSettingChange("xLabel", updates.xLabel);
              if (updates.yLabel !== undefined) onSettingChange("yLabel", updates.yLabel);
              if (updates.elementStyles !== undefined) onSettingChange("elementStyles", updates.elementStyles);
              setFabricEditMode(false);
            }}
            onCancel={() => setFabricEditMode(false)}
          />
        )}
        {/* Inline text editor — anchored to the rect captured at double-click time */}
        {onSettingChange && editingTitle && (
          <InlineTextEditor
            anchorRect={editingTitle}
            elementKey="title"
            value={title || ""}
            style={{
              fontFamily: ff,
              fontSize: titleSize,
              fontWeight: titleBold ? 700 : 400,
              color: theme.titleColor,
            }}
            onCommit={(v) => { onSettingChange("title", v); setEditingTitle(null); }}
            onCancel={() => setEditingTitle(null)}
          />
        )}
        {onSettingChange && editingXLabel && (
          <InlineTextEditor
            anchorRect={editingXLabel}
            elementKey="xlabel"
            value={xLabel || ""}
            style={{
              fontFamily: ff,
              fontSize: axisLabelSize,
              fontWeight: axisLabelBold ? 600 : 400,
              color: theme.axisLabelColor,
            }}
            onCommit={(v) => { onSettingChange("xLabel", v); setEditingXLabel(null); }}
            onCancel={() => setEditingXLabel(null)}
          />
        )}
        {onSettingChange && editingYLabel && (
          <InlineTextEditor
            anchorRect={editingYLabel}
            elementKey="ylabel"
            value={yLabel || ""}
            style={{
              fontFamily: ff,
              fontSize: axisLabelSize,
              fontWeight: axisLabelBold ? 600 : 400,
              color: theme.axisLabelColor,
            }}
            onCommit={(v) => { onSettingChange("yLabel", v); setEditingYLabel(null); }}
            onCancel={() => setEditingYLabel(null)}
          />
        )}
      </div>
    );
  }

  // Fallback
  return (
    <svg width={W} height={H} style={svgStyle} id="chart-studio-svg">
      {svgDefs}<defs>{plotClipDef()}</defs><rect width={W} height={H} fill={theme.bgColor} rx={theme.bgCornerRadius} />
      <text x={W / 2} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={14}>Chart type not yet supported</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function ResultsView({ columns, rows, tests, onRunTest, autoSelectTest, onAutoSelectHandled, chartType, user }: {
  columns: string[]; rows: CellValue[][];
  tests: TestResult[];
  onRunTest: (test: TestType, colA?: number, colB?: number) => void;
  autoSelectTest?: TestType | null;
  onAutoSelectHandled?: () => void;
  chartType?: string;
  user?: any;
}) {
  const [selectedTest, setSelectedTest] = useState<TestType>("descriptive");
  const [colA, setColA] = useState(0);
  const [colB, setColB] = useState(Math.min(1, columns.length - 1));

  // Auto-select test when triggered from Analysis menu
  useEffect(() => {
    if (autoSelectTest) {
      setSelectedTest(autoSelectTest);
      onAutoSelectHandled?.();
    }
  }, [autoSelectTest, onAutoSelectHandled]);

  const colData = useMemo(() => columns.map((_, ci) => rows.map((r) => r[ci]).filter((v): v is number => typeof v === "number")), [columns, rows]);
  const descriptive = useMemo(() => columns.map((name, ci) => computeDescriptive(name, colData[ci])), [columns, colData]);

  const f = (v: number) => isNaN(v) || v === 0 ? "—" : v.toFixed(3);
  const pFmt = (p: number) => p < 0.001 ? "<0.001" : p.toFixed(4);

  const TESTS: { id: TestType; label: string; needsPair: boolean; needsAll?: boolean; needsSingle?: boolean }[] = [
    { id: "descriptive", label: "Descriptive Statistics", needsPair: false },
    { id: "unpaired-t", label: "Unpaired t-test", needsPair: true },
    { id: "paired-t", label: "Paired t-test", needsPair: true },
    { id: "mann-whitney", label: "Mann-Whitney U", needsPair: true },
    { id: "one-way-anova", label: "One-Way ANOVA", needsPair: false, needsAll: true },
    { id: "tukey-posthoc", label: "Post-hoc (Bonferroni)", needsPair: false, needsAll: true },
    { id: "pearson-corr", label: "Pearson Correlation", needsPair: true },
    { id: "spearman-corr", label: "Spearman Correlation", needsPair: true },
    { id: "linear-reg", label: "Linear Regression", needsPair: true },
    { id: "chi-square", label: "Chi-Square Test", needsPair: false, needsAll: true },
    { id: "fisher-exact", label: "Fisher's Exact (2×2)", needsPair: false, needsAll: true },
    { id: "wilcoxon-signed", label: "Wilcoxon Signed-Rank", needsPair: true },
    { id: "kruskal-wallis", label: "Kruskal-Wallis", needsPair: false, needsAll: true },
    { id: "two-way-anova", label: "Two-Way ANOVA", needsPair: false, needsAll: true },
    { id: "one-sample-t", label: "One-Sample t-test", needsPair: false, needsSingle: true },
    { id: "log-rank", label: "Log-Rank Test", needsPair: false, needsAll: true },
    { id: "normality", label: "Normality Test", needsPair: false, needsSingle: true },
    { id: "power-analysis", label: "Power Analysis", needsPair: false, needsAll: true },
    { id: "pca", label: "PCA Analysis", needsPair: false, needsAll: true },
    { id: "kmeans", label: "K-Means Clustering", needsPair: false, needsAll: true },
    { id: "hierarchical-cluster", label: "Hierarchical Clustering", needsPair: false, needsAll: true },
    { id: "multiple-linear-reg", label: "Multiple Linear Regression", needsPair: false, needsAll: true },
    { id: "multiple-logistic-reg", label: "Logistic Regression", needsPair: false, needsAll: true },
    { id: "poisson-reg", label: "Poisson Regression", needsPair: false, needsAll: true },
    { id: "cox-reg", label: "Cox Regression", needsPair: false, needsAll: true },
    { id: "dose-response-analysis", label: "Dose-Response (4PL)", needsPair: false, needsAll: true },
  ];

  const activeTestInfo = TESTS.find((t) => t.id === selectedTest);

  return (
    <div className="flex-1 flex min-h-0">
      {/* Test selector (left) */}
      <div style={{ width: 220, minWidth: 220, background: "#f8fafc", borderRight: "1px solid #d1d5db" }} className="flex flex-col overflow-hidden">
        {/* Smart Suggestion */}
        {(() => {
          const suggestion = suggestStatisticalTest(columns, colData, chartType);
          if (!suggestion) return null;
          return (
            <div style={{ borderBottom: "1px solid #d1d5db" }}>
              <div className="cs-props-header" style={{ background: "#dbeafe", color: "#1e40af" }}>✨ Recommended</div>
              <div style={{ padding: "8px 10px" }}>
                <button onClick={() => { setSelectedTest(suggestion.recommended); onRunTest(suggestion.recommended, 0, Math.min(1, columns.length - 1)); }} style={{ width: "100%", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "white", background: "#1e40af", border: "1px solid #1e3a8a", borderRadius: 4, cursor: "default", textAlign: "left", marginBottom: 6 }}>
                  ▶ {suggestion.testName}
                </button>
                <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.4, marginBottom: 6 }}>{suggestion.reason}</div>
                {/* Assumption checks */}
                {suggestion.assumptions.map((a, i) => (
                  <div key={i} style={{ fontSize: 10, display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 2 }}>
                    <span style={{ color: a.passed ? "#16a34a" : "#dc2626", fontWeight: 700, flexShrink: 0 }}>{a.passed ? "✓" : "✗"}</span>
                    <span style={{ color: a.passed ? "#475569" : "#dc2626" }}><strong>{a.label}:</strong> {a.detail}</span>
                  </div>
                ))}
                {/* Warnings */}
                {suggestion.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#d97706", display: "flex", alignItems: "flex-start", gap: 4, marginTop: 3 }}>
                    <span style={{ flexShrink: 0 }}>⚠</span>
                    <span>{w}</span>
                  </div>
                ))}
                {/* Alternatives */}
                {suggestion.alternatives.length > 0 && (
                  <div style={{ marginTop: 6, borderTop: "1px solid #e2e8f0", paddingTop: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Alternatives</div>
                    {suggestion.alternatives.map((alt, i) => (
                      <button key={i} onClick={() => setSelectedTest(alt.test)} style={{ display: "block", width: "100%", fontSize: 10, color: "#2563eb", textAlign: "left", background: "none", border: "none", cursor: "default", padding: "1px 0" }}>
                        {alt.name} <span style={{ color: "#94a3b8" }}>— {alt.when}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        <div className="cs-props-header">All Tests</div>
        <div className="flex-1 overflow-y-auto py-1">
          {TESTS.map((t) => (
            <button key={t.id} onClick={() => setSelectedTest(t.id)} className={cn("cs-nav-item", selectedTest === t.id && "cs-nav-item-active")}>
              <FlaskConical className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results content */}
      <div className="flex-1 overflow-auto bg-white">
        {/* Column selector for paired tests */}
        {activeTestInfo?.needsPair && (
          <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
            <span className="font-semibold text-gray-600">Compare:</span>
            <select value={colA} onChange={(e) => setColA(Number(e.target.value))} className="cs-props-input" style={{ width: 140 }}>
              {columns.map((c, i) => <option key={i} value={i}>{c}</option>)}
            </select>
            <span className="text-gray-400">vs</span>
            <select value={colB} onChange={(e) => setColB(Number(e.target.value))} className="cs-props-input" style={{ width: 140 }}>
              {columns.map((c, i) => <option key={i} value={i}>{c}</option>)}
            </select>
            <button onClick={() => onRunTest(selectedTest, colA, colB)} className="cs-tool-btn" style={{ background: "#1e40af", color: "white", borderColor: "#1e3a8a", padding: "0 12px" }}>
              Run Test
            </button>
          </div>
        )}
        {activeTestInfo?.needsAll && (
          <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
            <span className="font-semibold text-gray-600">Using all {columns.length} columns</span>
            <button onClick={() => onRunTest(selectedTest)} className="cs-tool-btn" style={{ background: "#1e40af", color: "white", borderColor: "#1e3a8a", padding: "0 12px" }}>
              Run {TESTS.find((t) => t.id === selectedTest)?.label}
            </button>
          </div>
        )}
        {activeTestInfo?.needsSingle && (
          <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
            <span className="font-semibold text-gray-600">Test column:</span>
            <select value={colA} onChange={(e) => setColA(Number(e.target.value))} className="cs-props-input" style={{ width: 140 }}>
              {columns.map((c, i) => <option key={i} value={i}>{c}</option>)}
            </select>
            <button onClick={() => onRunTest(selectedTest, colA)} className="cs-tool-btn" style={{ background: "#1e40af", color: "white", borderColor: "#1e3a8a", padding: "0 12px" }}>
              Run Test
            </button>
          </div>
        )}

        {/* Descriptive Statistics Table */}
        {selectedTest === "descriptive" && (
          <div className="p-4">
            <div className="cs-props-header" style={{ marginBottom: 0 }}>Descriptive Statistics</div>
            <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["Column", "N", "Mean", "SD", "SEM", "Median", "Min", "Max", "95% CI"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #d1d5db" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {descriptive.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "5px 8px", fontWeight: 600, color: "#334155" }}>{s.column}</td>
                    <td style={{ padding: "5px 8px", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{s.n || "—"}</td>
                    {[s.mean, s.sd, s.sem, s.median, s.min, s.max].map((v, j) => (
                      <td key={j} style={{ padding: "5px 8px", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{f(v)}</td>
                    ))}
                    <td style={{ padding: "5px 8px", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>[{f(s.ci95Lower)}, {f(s.ci95Upper)}]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Test Results */}
        {selectedTest !== "descriptive" && tests.length > 0 && (
          <div className="p-4">
            {tests.filter((t) => t.testType === selectedTest).map((result, i) => (
              <div key={i} style={{ marginBottom: 16, border: "1px solid #e2e8f0", background: "#fafbfc" }}>
                <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: "#1e293b" }}>{result.testName}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px",
                    background: result.significant ? "#fef2f2" : "#f0fdf4",
                    color: result.significant ? "#dc2626" : "#16a34a",
                    border: `1px solid ${result.significant ? "#fecaca" : "#bbf7d0"}`,
                  }}>
                    {result.significant ? "Significant" : "Not Significant"} (α = 0.05)
                  </span>
                </div>
                <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
                  <tbody>
                    {result.groupA && <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b", width: 160 }}>Groups</td><td style={{ padding: "5px 12px", color: "#1e293b" }}>{result.groupA} vs {result.groupB}</td></tr>}
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>Test Statistic</td><td style={{ padding: "5px 12px", color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>{result.statistic.toFixed(4)}</td></tr>
                    {result.df !== undefined && <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>Degrees of Freedom</td><td style={{ padding: "5px 12px", color: "#1e293b" }}>{result.df}</td></tr>}
                    <tr style={{ borderBottom: "1px solid #f1f5f9", background: result.significant ? "#fef2f2" : "transparent" }}><td style={{ padding: "5px 12px", fontWeight: 700, color: "#1e293b" }}>P-value</td><td style={{ padding: "5px 12px", fontWeight: 700, color: result.significant ? "#dc2626" : "#1e293b", fontVariantNumeric: "tabular-nums" }}>{pFmt(result.pValue)}</td></tr>
                    {result.meanDiff !== undefined && <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>Mean Difference</td><td style={{ padding: "5px 12px", color: "#1e293b" }}>{result.meanDiff.toFixed(4)}</td></tr>}
                    {result.ci95 && <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>95% CI of Difference</td><td style={{ padding: "5px 12px", color: "#1e293b" }}>[{result.ci95[0].toFixed(4)}, {result.ci95[1].toFixed(4)}]</td></tr>}
                    {result.effectSize !== undefined && <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>Effect Size</td><td style={{ padding: "5px 12px", color: "#1e293b" }}>{result.effectSize.toFixed(4)}</td></tr>}
                    {result.slope !== undefined && <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>Slope</td><td style={{ padding: "5px 12px", color: "#1e293b" }}>{result.slope.toFixed(4)}{result.ci95 ? ` [${result.ci95[0].toFixed(4)}, ${result.ci95[1].toFixed(4)}]` : ""}</td></tr>}
                    {result.intercept !== undefined && <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>Intercept</td><td style={{ padding: "5px 12px", color: "#1e293b" }}>{result.intercept.toFixed(4)}</td></tr>}
                    {result.rSquared !== undefined && <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>R²</td><td style={{ padding: "5px 12px", color: "#1e293b" }}>{result.rSquared.toFixed(4)}</td></tr>}
                    <tr><td style={{ padding: "5px 12px", fontWeight: 600, color: "#64748b" }}>Summary</td><td style={{ padding: "5px 12px", color: "#1e293b", fontWeight: 500 }}>{result.summary}</td></tr>
                    {result.subResults && result.subResults.length > 0 && (
                      <tr><td colSpan={2} style={{ padding: 0 }}>
                        <table className="w-full" style={{ borderCollapse: "collapse", marginTop: 4 }}>
                          <thead><tr style={{ background: "#f8fafc" }}>
                            <th style={{ padding: "4px 12px", fontSize: 9, fontWeight: 700, color: "#64748b", textAlign: "left" }}>Group A</th>
                            <th style={{ padding: "4px 12px", fontSize: 9, fontWeight: 700, color: "#64748b", textAlign: "left" }}>Group B</th>
                            <th style={{ padding: "4px 12px", fontSize: 9, fontWeight: 700, color: "#64748b", textAlign: "left" }}>Mean Diff</th>
                            <th style={{ padding: "4px 12px", fontSize: 9, fontWeight: 700, color: "#64748b", textAlign: "left" }}>Adj. P</th>
                            <th style={{ padding: "4px 12px", fontSize: 9, fontWeight: 700, color: "#64748b", textAlign: "left" }}>Sig.</th>
                          </tr></thead>
                          <tbody>{result.subResults.map((sr, si) => (
                            <tr key={si} style={{ borderTop: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "3px 12px", fontSize: 11 }}>{sr.groupA}</td>
                              <td style={{ padding: "3px 12px", fontSize: 11 }}>{sr.groupB}</td>
                              <td style={{ padding: "3px 12px", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{sr.meanDiff.toFixed(4)}</td>
                              <td style={{ padding: "3px 12px", fontSize: 11, fontVariantNumeric: "tabular-nums", fontWeight: sr.significant ? 700 : 400, color: sr.significant ? "#dc2626" : "#475569" }}>{sr.pValue < 0.001 ? "<0.001" : sr.pValue.toFixed(4)}</td>
                              <td style={{ padding: "3px 12px", fontSize: 10, fontWeight: 700, color: sr.significant ? "#dc2626" : "#16a34a" }}>{sr.significant ? "Yes" : "No"}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
            {tests.filter((t) => t.testType === selectedTest).length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                Select columns above and click "Run Test" to see results.
              </div>
            )}

          {/* AI Section */}
          {tests.length > 0 && (
            <AIResultsPanel tests={tests} columns={columns} descriptive={descriptive} chartType={chartType} user={user} />
          )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI Results Panel ──
function AIResultsPanel({ tests, columns, descriptive, chartType, user }: { tests: TestResult[]; columns: string[]; descriptive: DescriptiveStats[]; chartType?: string; user?: any }) {
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<"explain" | "legend">("explain");
  const [aiTone, setAiTone] = useState<"concise" | "detailed" | "grant">("concise");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!user) { toast.error("Sign in to use AI features"); return; }
    setAiLoading(true);
    setAiText("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("chart-studio-ai", {
        body: { mode: aiMode, testResults: tests, chartType, columns, descriptiveStats: descriptive, tone: aiTone },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); setAiLoading(false); return; }
      setAiText(data?.text || "No response generated");
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    }
    setAiLoading(false);
  };

  const copyText = () => {
    navigator.clipboard.writeText(aiText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <div style={{ margin: 16, border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ background: "#f0f5ff", borderBottom: "1px solid #dbeafe", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>✨</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>AI Assistant</span>
          {!user && <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>(Sign in required)</span>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["concise", "detailed", "grant"] as const).map((t) => (
            <button key={t} onClick={() => setAiTone(t)} style={{ height: 22, padding: "0 8px", fontSize: 10, fontWeight: 600, background: aiTone === t ? "#1e293b" : "#f8fafc", color: aiTone === t ? "white" : "#64748b", border: `1px solid ${aiTone === t ? "#1e293b" : "#d1d5db"}`, borderRadius: 3, cursor: "default", textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => { setAiMode("explain"); generate(); }} disabled={aiLoading || !user} style={{ flex: 1, height: 32, fontSize: 11, fontWeight: 700, background: aiLoading ? "#94a3b8" : "#1e40af", color: "white", border: "none", borderRadius: 4, cursor: aiLoading || !user ? "default" : "pointer", opacity: !user ? 0.5 : 1 }}>
            {aiLoading && aiMode === "explain" ? "Generating..." : "📊 Explain My Results"}
          </button>
          <button onClick={() => { setAiMode("legend"); generate(); }} disabled={aiLoading || !user} style={{ flex: 1, height: 32, fontSize: 11, fontWeight: 700, background: aiLoading ? "#94a3b8" : "#16a34a", color: "white", border: "none", borderRadius: 4, cursor: aiLoading || !user ? "default" : "pointer", opacity: !user ? 0.5 : 1 }}>
            {aiLoading && aiMode === "legend" ? "Generating..." : "📝 Write Figure Legend"}
          </button>
        </div>

        {aiText && (() => {
          // Render markdown-formatted AI text as styled HTML
          const renderMd = (text: string) => {
            return text.split("\n").map((line, i) => {
              // Headings
              if (line.startsWith("### ")) return <h4 key={i} style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: "12px 0 4px", letterSpacing: "-0.01em" }}>{renderInline(line.slice(4))}</h4>;
              if (line.startsWith("## ")) return <h3 key={i} style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "14px 0 4px", letterSpacing: "-0.01em" }}>{renderInline(line.slice(3))}</h3>;
              if (line.startsWith("# ")) return <h2 key={i} style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: "16px 0 6px" }}>{renderInline(line.slice(2))}</h2>;
              // Bullet lists
              if (line.match(/^\s*[-*]\s/)) return <div key={i} style={{ display: "flex", gap: 6, margin: "2px 0", paddingLeft: 4 }}><span style={{ color: "#94a3b8", flexShrink: 0 }}>•</span><span>{renderInline(line.replace(/^\s*[-*]\s/, ""))}</span></div>;
              // Numbered lists
              if (line.match(/^\s*\d+\.\s/)) { const match = line.match(/^(\s*\d+\.)\s(.*)/); return <div key={i} style={{ display: "flex", gap: 6, margin: "2px 0", paddingLeft: 4 }}><span style={{ color: "#64748b", fontWeight: 600, flexShrink: 0, minWidth: 16 }}>{match?.[1]}</span><span>{renderInline(match?.[2] || "")}</span></div>; }
              // Empty lines
              if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
              // Normal paragraph
              return <p key={i} style={{ margin: "3px 0" }}>{renderInline(line)}</p>;
            });
          };
          // Inline formatting: bold, italic, code, bold-italic
          const renderInline = (text: string) => {
            const parts: (string | JSX.Element)[] = [];
            let remaining = text;
            let key = 0;
            while (remaining.length > 0) {
              // Bold-italic ***text***
              const bim = remaining.match(/\*\*\*(.*?)\*\*\*/);
              // Bold **text**
              const bm = remaining.match(/\*\*(.*?)\*\*/);
              // Italic *text*
              const im = remaining.match(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/);
              // Inline code `text`
              const cm = remaining.match(/`(.*?)`/);

              // Find the earliest match
              const matches = [
                bim ? { m: bim, type: "bi" } : null,
                bm ? { m: bm, type: "b" } : null,
                im ? { m: im, type: "i" } : null,
                cm ? { m: cm, type: "c" } : null,
              ].filter(Boolean).sort((a, b) => a!.m.index! - b!.m.index!);

              if (matches.length === 0) { parts.push(remaining); break; }
              const first = matches[0]!;
              const idx = first.m.index!;
              if (idx > 0) parts.push(remaining.slice(0, idx));
              if (first.type === "bi") parts.push(<strong key={key++} style={{ fontWeight: 700, fontStyle: "italic" }}>{first.m[1]}</strong>);
              else if (first.type === "b") parts.push(<strong key={key++} style={{ fontWeight: 700, color: "#0f172a" }}>{first.m[1]}</strong>);
              else if (first.type === "i") parts.push(<em key={key++} style={{ fontStyle: "italic", color: "#334155" }}>{first.m[1]}</em>);
              else if (first.type === "c") parts.push(<code key={key++} style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3, fontSize: 11, fontFamily: "monospace", color: "#1e40af" }}>{first.m[1]}</code>);
              remaining = remaining.slice(idx + first.m[0].length);
            }
            return <>{parts}</>;
          };
          return (
          <div>
            <div style={{ position: "relative" }}>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 18px", fontSize: 12, lineHeight: 1.7, color: "#334155" }}>
                {renderMd(aiText)}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
                <button onClick={copyText} style={{ height: 28, padding: "0 12px", fontSize: 10, fontWeight: 600, background: copied ? "#16a34a" : "#f1f5f9", color: copied ? "white" : "#475569", border: `1px solid ${copied ? "#16a34a" : "#d1d5db"}`, borderRadius: 6, cursor: "default" }}>
                  {copied ? "✓ Copied" : "Copy Text"}
                </button>
              </div>
            </div>
            <div style={{ marginTop: 4, fontSize: 9, color: "#94a3b8" }}>
              AI-generated • Always verify statistical interpretations before publishing
            </div>
          </div>
          );
        })()}

        {!aiText && !aiLoading && (
          <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>
            Run a statistical test, then use AI to generate a publication-ready interpretation or figure legend.
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const studioStyles = `
  .cs-app {
    /* Pale sky-blue page background — matches the SimpleCanvas palette
       so the two editors feel like part of the same product family. */
    background:
      radial-gradient(1200px 700px at 15% 10%, rgba(147,197,253,0.20), transparent 60%),
      radial-gradient(900px 600px at 85% 100%, rgba(125,211,252,0.16), transparent 55%),
      radial-gradient(800px 500px at 50% 50%, rgba(186,230,253,0.10), transparent 60%),
      linear-gradient(180deg, hsl(210 65% 97%) 0%, hsl(215 55% 94%) 100%);
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    font-size: 13px;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
    font-feature-settings: 'cv11', 'ss01', 'ss03';
    height: 100vh;
    height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    max-width: 100vw;
    overflow: hidden;
  }
  #chart-studio-svg { max-width: 100%; height: auto; }

  /* ── Glass surfaces ── */
  .cs-glass {
    background: linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(248,250,252,0.62) 100%);
    backdrop-filter: blur(28px) saturate(170%);
    -webkit-backdrop-filter: blur(28px) saturate(170%);
    border: 1px solid rgba(255,255,255,0.5);
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.9) inset,
      0 0 0 1px rgba(226,232,240,0.5),
      0 6px 18px -6px rgba(15,23,42,0.08),
      0 2px 6px -2px rgba(15,23,42,0.04);
  }
  .cs-glass-strong {
    background: linear-gradient(135deg, rgba(255,255,255,0.86) 0%, rgba(248,250,252,0.76) 100%);
    backdrop-filter: blur(32px) saturate(180%);
    -webkit-backdrop-filter: blur(32px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.6);
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.95) inset,
      0 0 0 1px rgba(226,232,240,0.6),
      0 10px 32px -10px rgba(15,23,42,0.1),
      0 4px 10px -2px rgba(15,23,42,0.05);
  }

  /* ── Ambient blobs ── */
  @keyframes cs-pulse { 0%,100% { opacity:0.4; transform:scale(1); } 50% { opacity:0.65; transform:scale(1.05); } }
  .cs-blob { animation: cs-pulse 16s ease-in-out infinite; }

  /* ── Top Bar ── */
  .cs-topbar {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 8px;
    z-index: 30;
    border-bottom: 1px solid rgba(255,255,255,0.18);
    /* Deep sky→blue gradient that overrides the cs-glass white frosted
       background it is composed with. Mirrors SimpleCanvas's topbar. */
    background: linear-gradient(135deg, hsl(213 88% 56%) 0%, hsl(220 84% 48%) 100%) !important;
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.18) inset,
      0 6px 20px -6px rgba(30,64,175,0.30) !important;
    color: #ffffff;
  }
  /* Force readable white on text/icons in the TOP-LEVEL topbar row only.
     Child-combinator selectors keep this from cascading into the menu
     flyouts (which are descendants of .cs-topbar via the menu wrappers
     but should retain their normal dark text on white). */
  .cs-topbar > span,
  .cs-topbar > svg,
  .cs-topbar > button,
  .cs-topbar > button svg,
  .cs-topbar > div > button,
  .cs-topbar > div > button svg {
    color: #ffffff !important;
  }
  /* Menu triggers (File / Edit / Data / …) sit one level deeper but
     should still read as white. The flyout below them is .absolute and
     is intentionally excluded. */
  .cs-topbar > div > button.cs-tool-btn:hover,
  .cs-topbar > button.cs-tool-btn:hover {
    background: rgba(255,255,255,0.16) !important;
    color: #ffffff !important;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.20) inset !important;
  }
  .cs-topbar > div > button.cs-tool-btn:active,
  .cs-topbar > button.cs-tool-btn:active {
    background: rgba(255,255,255,0.24) !important;
  }
  /* Vertical dividers in the topbar were tuned for a light bg —
     swap them to a translucent white so they read on the deep blue. */
  .cs-topbar > div[style*="background: rgba(148,163,184"] {
    background: rgba(255,255,255,0.25) !important;
  }

  /* ── Toolbar ── */
  .cs-toolbar {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    gap: 2px;
    z-index: 20;
    border-bottom: 1px solid rgba(226,232,240,0.4);
  }
  .cs-tool-btn {
    height: 32px;
    min-width: 32px;
    padding: 0 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    color: #475569;
    border: none;
    border-radius: 10px;
    background: transparent;
    transition: background 180ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms, box-shadow 180ms;
    cursor: default;
  }
  .cs-tool-btn:hover {
    background: rgba(59,130,246,0.08);
    color: #0f172a;
    box-shadow: 0 0 0 1px rgba(59,130,246,0.12) inset;
  }
  .cs-tool-btn:active { background: rgba(59,130,246,0.14); }
  .cs-tool-btn:disabled { opacity: 0.3; pointer-events: none; }
  .cs-tool-btn-active {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
    color: white !important;
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.25) inset,
      0 4px 14px -4px rgba(37,99,235,0.5),
      0 1px 3px -1px rgba(37,99,235,0.4) !important;
  }
  .cs-tool-sep {
    width: 1px; height: 20px;
    background: linear-gradient(180deg, transparent, rgba(148,163,184,0.35), transparent);
    margin: 0 7px; flex-shrink: 0;
  }

  /* ── Navigator ── */
  .cs-nav {
    border-right: none;
    background: transparent;
  }
  .cs-nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
    cursor: default;
    transition: background 180ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms, box-shadow 180ms;
    border-left: 2px solid transparent;
    border-radius: 0 10px 10px 0;
  }
  .cs-nav-item:hover {
    background: rgba(59,130,246,0.06);
    color: #1e293b;
  }
  .cs-nav-item-active {
    background: linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(37,99,235,0.08) 100%) !important;
    color: #1e40af !important;
    border-left-color: #3b82f6 !important;
    font-weight: 600;
    box-shadow: 0 1px 0 0 rgba(255,255,255,0.8) inset, 0 2px 6px -2px rgba(37,99,235,0.15);
  }

  /* ── Properties Panel ── */
  .cs-props {
    background: transparent;
    border-left: none;
  }
  .cs-props-header {
    background: linear-gradient(135deg, rgba(241,245,249,0.7) 0%, rgba(226,232,240,0.5) 100%);
    border-bottom: 1px solid rgba(226,232,240,0.5);
    padding: 7px 12px;
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .cs-props-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    font-size: 12px;
    border-bottom: 1px solid rgba(241,245,249,0.45);
  }
  .cs-props-label { color: #475569; font-weight: 500; }
  .cs-props-input {
    height: 28px;
    width: 100%;
    padding: 0 9px;
    border: 1px solid rgba(203,213,225,0.5);
    border-radius: 8px;
    background: rgba(255,255,255,0.55);
    font-size: 12px;
    color: #0f172a;
    outline: none;
    transition: background 150ms, border-color 150ms, box-shadow 150ms;
  }
  .cs-props-input:hover { background: rgba(255,255,255,0.72); border-color: rgba(148,163,184,0.55); }
  .cs-props-input:focus {
    border-color: #3b82f6;
    background: white;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.12), 0 1px 2px rgba(15,23,42,0.04);
  }

  /* ── Status Bar ── */
  .cs-statusbar {
    height: 28px;
    display: flex;
    align-items: center;
    padding: 0 18px;
    font-size: 11px;
    color: #94a3b8;
    gap: 16px;
    border-top: 1px solid rgba(226,232,240,0.4);
  }

  /* ── Spreadsheet ── */
  .cs-cell-input {
    width: 100%;
    height: 100%;
    padding: 3px 8px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-family: 'Inter', sans-serif;
    color: #0f172a;
    background: transparent;
    outline: none;
    border: 1px solid transparent;
    transition: background 120ms, border-color 120ms;
  }
  .cs-cell-input:focus {
    border-color: #3b82f6;
    background: rgba(239,246,255,0.85);
    border-radius: 5px;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.12);
  }
  .cs-cell-warn {
    background: rgba(254,242,242,0.85) !important;
    color: #991b1b !important;
  }
  .cs-cell-warn:focus {
    border-color: #ef4444 !important;
    background: rgba(254,242,242,0.95) !important;
    box-shadow: 0 0 0 2px rgba(239,68,68,0.18) !important;
  }

  /* ── Scrollbar ── */
  .cs-app ::-webkit-scrollbar { width: 8px; height: 8px; }
  .cs-app ::-webkit-scrollbar-track { background: transparent; }
  .cs-app ::-webkit-scrollbar-thumb {
    background: rgba(148,163,184,0.28);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  .cs-app ::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.4); background-clip: content-box; }
  .cs-app ::-webkit-scrollbar-corner { background: transparent; }

  /* Animated theme transitions on SVG elements */
  #chart-studio-svg rect, #chart-studio-svg line, #chart-studio-svg circle,
  #chart-studio-svg text, #chart-studio-svg polyline, #chart-studio-svg path, #chart-studio-svg polygon {
    transition: fill 0.3s ease, stroke 0.3s ease, opacity 0.3s ease, stroke-width 0.2s ease, r 0.2s ease, stroke-dasharray 0.2s ease;
  }

  /* ── Range Sliders ── */
  .cs-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 5px;
    background: linear-gradient(90deg, rgba(148,163,184,0.2), rgba(148,163,184,0.35));
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }
  .cs-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border: 2px solid white;
    box-shadow: 0 2px 5px rgba(37,99,235,0.28), 0 0 0 1px rgba(37,99,235,0.15);
    cursor: pointer;
    transition: transform 120ms;
  }
  .cs-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .cs-range::-moz-range-thumb {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border: 2px solid white;
    box-shadow: 0 2px 5px rgba(37,99,235,0.28);
    cursor: pointer;
  }

  /* ── Resize Handle ── */
  .cs-resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 5px;
    cursor: col-resize;
    z-index: 20;
    transition: background 150ms;
  }
  .cs-resize-handle:hover, .cs-resize-handle:active {
    background: linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent);
  }

  /* ── Selection / focus rings for interactive surfaces ── */
  .cs-app button:focus-visible,
  .cs-app input:focus-visible,
  .cs-app select:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.22);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function createDefaultProject(chartType: ChartType): ProjectState {
  const gs: GraphSettings = {
    chartType, title: "", xLabel: "", yLabel: "",
    showGrid: true, showErrorBars: true, errorBarType: "sem",
    showDataPoints: true, showRegression: false, barColor: COLORS[0], pointSize: 5, whiskerStyle: "tukey",
    xAutoRange: true, xMin: null, xMax: null, yAutoRange: true, yMin: null, yMax: null,
    xLogScale: false, yLogScale: false,
    traceColors: [...COLORS], traceOpacities: [], colorPalette: "default", pBrackets: [],
    fontFamily: "Inter, sans-serif", titleSize: 16, axisLabelSize: 12, tickLabelSize: 10,
    titleBold: true, axisLabelBold: true,
    legendPosition: "top-right", legendBorder: false, legendX: null, legendY: null,
    pointShape: "circle", lineWidth: 2, lineStyle: "solid",
    chartWidth: 800, chartHeight: 560, pubPreset: "default",
    annotations: [], exportDPI: 300,
    marginTop: 52, marginRight: 40, marginBottom: 60, marginLeft: 68,
    axisLineWeight: 1, errorBarWeight: 1.5, showDualYAxis: false, rightYAxisTraces: [], showMeanValues: false, showErrorValues: false,
    chartTheme: "modern", yAxisBreak: false, yBreakLow: null, yBreakHigh: null,
    xTickAngle: "auto" as const,
    heatmapShowValues: true,
    elementStyles: {},
  };

  if (chartType === "column") {
    return {
      columns: ["Control", "Treatment A", "Treatment B"],
      rows: Array.from({ length: 8 }, () => [null, null, null]),
      graphSettings: { ...gs, title: "Untitled", yLabel: "Response" },
      analysis: null,
    };
  }
  if (chartType === "box" || chartType === "violin") {
    return {
      columns: ["Control", "Treatment A", "Treatment B"],
      rows: Array.from({ length: 15 }, () => [null, null, null]),
      graphSettings: { ...gs, chartType, title: "Untitled", yLabel: "Measurement", showErrorBars: false },
      analysis: null,
    };
  }
  if (chartType === "survival") {
    return {
      columns: ["Time (Control)", "Event (Control)", "Time (Treatment)", "Event (Treatment)"],
      rows: Array.from({ length: 15 }, () => [null, null, null, null]),
      graphSettings: { ...gs, chartType, title: "Survival Analysis", xLabel: "Time", yLabel: "Survival Probability", showErrorBars: false, showDataPoints: false },
      analysis: null,
    };
  }
  if (chartType === "dose-response") {
    return {
      columns: ["Concentration", "Response"],
      rows: Array.from({ length: 10 }, () => [null, null]),
      graphSettings: { ...gs, chartType, title: "Dose-Response", xLabel: "Concentration", yLabel: "Response (%)", showErrorBars: false, showDataPoints: true },
      analysis: null,
    };
  }
  if (chartType === "roc") {
    return {
      columns: ["Actual (0/1)", "Predicted Score"],
      rows: Array.from({ length: 20 }, () => [null, null]),
      graphSettings: { ...gs, chartType, title: "ROC Curve", xLabel: "False Positive Rate", yLabel: "True Positive Rate", showErrorBars: false, showDataPoints: false },
      analysis: null,
    };
  }
  if (chartType === "volcano") {
    return {
      columns: ["log2(FC)", "p-value"],
      rows: Array.from({ length: 30 }, () => [null, null]),
      graphSettings: { ...gs, chartType, title: "Volcano Plot", xLabel: "log₂(Fold Change)", yLabel: "-log₁₀(p-value)", showErrorBars: false, showDataPoints: true },
      analysis: null,
    };
  }
  if (chartType === "forest") {
    return {
      columns: ["Study", "Effect", "CI Lower", "CI Upper"],
      rows: Array.from({ length: 8 }, () => [null, null, null, null]),
      graphSettings: { ...gs, chartType, title: "Forest Plot", xLabel: "Effect Size", yLabel: "", showErrorBars: false, showDataPoints: false },
      analysis: null,
    };
  }
  if (chartType === "bland-altman") {
    return {
      columns: ["Method A", "Method B"],
      rows: Array.from({ length: 15 }, () => [null, null]),
      graphSettings: { ...gs, chartType, title: "Bland-Altman Plot", xLabel: "Mean of Methods", yLabel: "Difference (A − B)", showErrorBars: false, showDataPoints: true },
      analysis: null,
    };
  }
  if (chartType === "heatmap") {
    return {
      columns: ["Col 1", "Col 2", "Col 3", "Col 4", "Col 5"],
      rows: Array.from({ length: 5 }, () => [null, null, null, null, null]),
      graphSettings: { ...gs, chartType, title: "Heatmap", xLabel: "", yLabel: "", showErrorBars: false, showDataPoints: false, showGrid: false },
      analysis: null,
    };
  }
  if (chartType === "bubble") {
    return {
      columns: ["X", "Y", "Size"],
      rows: Array.from({ length: 12 }, () => [null, null, null]),
      graphSettings: { ...gs, chartType, title: "Bubble Plot", xLabel: "X", yLabel: "Y", showErrorBars: false, showDataPoints: true },
      analysis: null,
    };
  }
  if (chartType === "histogram") {
    return {
      columns: ["Dataset A", "Dataset B"],
      rows: Array.from({ length: 30 }, () => [null, null]),
      graphSettings: { ...gs, chartType, title: "Untitled", xLabel: "Value", yLabel: "Frequency", showErrorBars: false, showDataPoints: false },
      analysis: null,
    };
  }
  if (chartType === "correlation") {
    return {
      columns: ["X", "Y"],
      rows: Array.from({ length: 15 }, () => [null, null]),
      graphSettings: { ...gs, chartType, title: "Correlation Plot", xLabel: "Variable X", yLabel: "Variable Y", showDataPoints: true, showRegression: true },
      analysis: null,
    };
  }
  if (chartType === "xy" || chartType === "area" || chartType === "spaghetti") {
    return {
      columns: chartType === "spaghetti" ? ["Time", "Subject 1", "Subject 2", "Subject 3"] : ["X", "Y₁", "Y₂"],
      rows: Array.from({ length: 10 }, () => Array(chartType === "spaghetti" ? 4 : 3).fill(null)),
      graphSettings: { ...gs, chartType, title: "Untitled", xLabel: "X", yLabel: "Y" },
      analysis: null,
    };
  }
  if (chartType === "stacked-bar") {
    return { columns: ["Category A", "Category B", "Category C"], rows: Array.from({ length: 4 }, () => [null, null, null]), graphSettings: { ...gs, chartType, title: "Untitled", yLabel: "Value" }, analysis: null };
  }
  if (chartType === "dot-strip" || chartType === "ridgeline") {
    return { columns: ["Control", "Treatment A", "Treatment B"], rows: Array.from({ length: 15 }, () => [null, null, null]), graphSettings: { ...gs, chartType, title: "Untitled", yLabel: "Value", showErrorBars: false }, analysis: null };
  }
  if (chartType === "before-after") {
    return { columns: ["Before", "After"], rows: Array.from({ length: 10 }, () => [null, null]), graphSettings: { ...gs, chartType, title: "Untitled", yLabel: "Value" }, analysis: null };
  }
  if (chartType === "waterfall") {
    return { columns: ["Subject", "Change (%)"], rows: Array.from({ length: 12 }, () => [null, null]), graphSettings: { ...gs, chartType, title: "Waterfall Plot", xLabel: "Subject", yLabel: "Change from Baseline (%)" }, analysis: null };
  }
  if (chartType === "qq-plot") {
    return { columns: ["Data"], rows: Array.from({ length: 20 }, () => [null]), graphSettings: { ...gs, chartType, title: "QQ Plot", xLabel: "Theoretical Quantiles", yLabel: "Sample Quantiles" }, analysis: null };
  }
  if (chartType === "ecdf") {
    return { columns: ["Group A", "Group B"], rows: Array.from({ length: 15 }, () => [null, null]), graphSettings: { ...gs, chartType, title: "ECDF", xLabel: "Value", yLabel: "Cumulative Probability" }, analysis: null };
  }
  if (chartType === "radar") {
    return { columns: ["Axis", "Series A", "Series B"], rows: Array.from({ length: 6 }, () => [null, null, null]), graphSettings: { ...gs, chartType, title: "Radar Chart" }, analysis: null };
  }
  if (chartType === "lollipop") {
    return { columns: ["Category", "Value"], rows: Array.from({ length: 8 }, () => [null, null]), graphSettings: { ...gs, chartType, title: "Untitled", yLabel: "Value" }, analysis: null };
  }
  if (chartType === "funnel") {
    return { columns: ["Effect Size", "Standard Error"], rows: Array.from({ length: 15 }, () => [null, null]), graphSettings: { ...gs, chartType, title: "Funnel Plot", xLabel: "Effect Size", yLabel: "Standard Error" }, analysis: null };
  }
  return {
    columns: ["Group A", "Group B", "Group C"],
    rows: Array.from({ length: 8 }, () => [null, null, null]),
    graphSettings: { ...gs, title: "Untitled" },
    analysis: null,
  };
}

// ── Workbook/legacy adapter helpers (local) ──
// Match the legacy convention: `project.layout` is undefined in single-panel mode.
function projectFromWorkbook(wb: Workbook): ProjectState | null {
  const ds = getActiveDataset(wb);
  if (!ds) return null;
  const g = ds.graphs.find((gg) => gg.id === ds.activeGraphId) ?? ds.graphs[0];
  if (!g) return null;
  const inMultiPanel = ds.layoutState && ds.layoutState.mode !== "single" && !!ds.panels;
  return {
    columns: ds.columns,
    rows: ds.rows,
    graphSettings: g.settings,
    analysis: datasetAnalysesToLegacy(ds),
    layout: inMultiPanel ? ds.layoutState : undefined,
    panels: inMultiPanel ? ds.panels : undefined,
  };
}

function singleDatasetWorkbook(proj: ProjectState, name = "Dataset 1"): Workbook {
  const g = createGraphTab(proj.graphSettings.chartType, undefined, proj.graphSettings);
  const ds = createDataset(name, {
    columns: proj.columns,
    rows: proj.rows,
    graphs: [g],
    activeGraphId: g.id,
    analyses: (proj.analysis?.tests ?? []).map((r) => createAnalysisTab(r.testType, r)),
    layoutState: proj.layout ?? defaultLayoutState(),
    panels: proj.panels,
  });
  return { activeDatasetId: ds.id, datasets: [ds] };
}

const ChartStudio = () => {
  useTrackToolVisit("chart-studio");
  const navigate = useNavigate();
  const { user } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || (user?.email ? `https://www.gravatar.com/avatar/${encodeURIComponent(user.email.trim().toLowerCase())}?d=identicon&s=80` : undefined);
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "";

  const [searchParams] = useSearchParams();
  const urlChartType = searchParams.get("type") as ChartType | null;
  const urlLoadId = searchParams.get("load");

  const [showWelcome, setShowWelcome] = useState(!urlChartType && !urlLoadId);

  // Inline rename for the project name shown in the top bar.
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Auto-reopen the welcome dialog when the workbook becomes empty
  // (e.g. user closed the only remaining dataset tab).
  // Without this, the canvas is blank with no obvious way to recover.

  // ── Workbook (multi-dataset) master state ──
  // The existing code reads `project`/`testResults` and writes via `setProject`/`setTestResults`.
  // Those are now adapter views over the workbook's active dataset.
  const [workbook, setWorkbook] = useState<Workbook>(() => {
    if (urlChartType) {
      try {
        const proj = createDefaultProject(urlChartType);
        const importedData = sessionStorage.getItem("chartStudio_importData");
        if (importedData) {
          sessionStorage.removeItem("chartStudio_importData");
          const lines = importedData.trim().split("\n").filter((l) => l.trim());
          if (lines.length >= 2) {
            const sep = lines[0].includes("\t") ? "\t" : ",";
            const headers = lines[0].split(sep).map((h) => h.trim());
            const rows = lines.slice(1).map((line) =>
              line.split(sep).map((v) => {
                const t = v.trim();
                if (t === "") return null;
                const num = Number(t);
                return isNaN(num) ? t : num;
              })
            );
            const maxCols = headers.length;
            const paddedRows = rows.map((r) => [...r, ...Array(Math.max(0, maxCols - r.length)).fill(null)]);
            proj.columns = headers;
            proj.rows = paddedRows;
            proj.graphSettings.title = urlChartType.charAt(0).toUpperCase() + urlChartType.slice(1).replace("-", " ");
          }
        }
        return singleDatasetWorkbook(proj);
      } catch { return createEmptyWorkbook(); }
    }
    return createEmptyWorkbook();
  });

  // Derived: `project` — the active dataset's active graph in legacy ProjectState shape.
  const project: ProjectState | null = useMemo(() => projectFromWorkbook(workbook), [workbook]);

  // If the user closes the last dataset, prompt them to start a new one.
  useEffect(() => {
    if (workbook.datasets.length === 0) setShowWelcome(true);
  }, [workbook.datasets.length]);

  // Shim: setProject(updater) writes to the active dataset's active graph.
  // - If workbook has no active dataset, a new one is created from the next project.
  // - setProject(null) clears the workbook.
  const setProject = useCallback((updater: React.SetStateAction<ProjectState | null>) => {
    setWorkbook((wb) => {
      const prevProj = projectFromWorkbook(wb);
      const nextProj = typeof updater === "function"
        ? (updater as (p: ProjectState | null) => ProjectState | null)(prevProj)
        : updater;
      // No-op: updater returned the exact same reference (e.g. commit early-returns when prev is null)
      if (nextProj === prevProj) return wb;
      // Only explicit `setProject(null)` (direct, not via a function returning null for a null prev) clears the workbook
      if (nextProj === null) {
        if (prevProj === null) return wb;
        return createEmptyWorkbook();
      }
      // No active dataset yet → create one from nextProj
      if (!getActiveDataset(wb)) {
        const g = createGraphTab(nextProj.graphSettings.chartType, undefined, nextProj.graphSettings);
        const ds = createDataset(suggestDatasetName(wb), {
          columns: nextProj.columns,
          rows: nextProj.rows,
          graphs: [g],
          activeGraphId: g.id,
          analyses: (nextProj.analysis?.tests ?? []).map((r) => createAnalysisTab(r.testType, r)),
          layoutState: nextProj.layout ?? defaultLayoutState(),
          panels: nextProj.panels,
        });
        return { activeDatasetId: ds.id, datasets: [...wb.datasets, ds] };
      }
      // Update existing active dataset + active graph in place.
      return updateActiveDataset(wb, (d) => {
        const gId = d.activeGraphId ?? d.graphs[0]?.id ?? null;
        let graphs = d.graphs;
        if (graphs.length === 0) {
          const g = createGraphTab(nextProj.graphSettings.chartType, undefined, nextProj.graphSettings);
          graphs = [g];
        } else {
          graphs = graphs.map((g) => g.id === gId
            ? { ...g, settings: nextProj.graphSettings, chartType: nextProj.graphSettings.chartType }
            : g);
        }
        return {
          ...d,
          columns: nextProj.columns,
          rows: nextProj.rows,
          graphs,
          activeGraphId: gId ?? graphs[0]?.id ?? null,
          layoutState: nextProj.layout ?? defaultLayoutState(),
          panels: nextProj.panels,
        };
      });
    });
  }, []);

  // Derived: testResults — flattened list of the active dataset's analyses.
  const testResults: TestResult[] = useMemo(() => {
    const ds = getActiveDataset(workbook);
    return ds?.analyses.map((a) => a.result) ?? [];
  }, [workbook]);

  // Shim: setTestResults — writes back as AnalysisTab[] on the active dataset.
  const setTestResults = useCallback((updater: React.SetStateAction<TestResult[]>) => {
    setWorkbook((wb) => {
      const ds = getActiveDataset(wb);
      if (!ds) return wb;
      const prev = ds.analyses.map((a) => a.result);
      const next = typeof updater === "function"
        ? (updater as (r: TestResult[]) => TestResult[])(prev)
        : updater;
      const newAnalyses: AnalysisTab[] = next.map((r, i) => {
        const existing = ds.analyses[i];
        if (existing && existing.result === r) return existing;
        return createAnalysisTab(r.testType, r);
      });
      return updateActiveDataset(wb, (d) => ({
        ...d,
        analyses: newAnalyses,
        activeAnalysisId: newAnalyses[newAnalyses.length - 1]?.id ?? d.activeAnalysisId,
      }));
    });
  }, []);

  const [activeTab, setActiveTab] = useState<ViewTab>("data");
  const [undoStack, setUndoStack] = useState<ProjectState[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectState[]>([]);
  const [formatOpen, setFormatOpen] = useState(false);
  const [navWidth, setNavWidth] = useState(240);
  const [transformDialog, setTransformDialog] = useState<{ open: boolean; type: string } | null>(null);
  const [transformCol, setTransformCol] = useState(0);
  const [transformValue, setTransformValue] = useState<number>(1);
  const [colOpDialog, setColOpDialog] = useState<{ open: boolean; op: string } | null>(null);
  const [colOpA, setColOpA] = useState(0);
  const [colOpB, setColOpB] = useState(1);
  const [analysisAutoTest, setAnalysisAutoTest] = useState<TestType | null>(null);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const prevTabRef = useRef(activeTab);
  const [graphZoom, setGraphZoom] = useState(100);
  const activeTextInputRef = useRef<HTMLInputElement | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);
  const [cloudProjects, setCloudProjects] = useState<{ id: string; name: string; chart_type: string; updated_at: string }[]>([]);
  const [loadingCloudProjects, setLoadingCloudProjects] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [cmdSearch, setCmdSearch] = useState("");
  const [cmdActiveIdx, setCmdActiveIdx] = useState(0);
  const [colorblindMode, setColorblindMode] = useState<"none" | "deuteranopia" | "protanopia" | "tritanopia">("none");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [promptDialog, setPromptDialog] = useState<{ title: string; label: string; defaultValue: string; onConfirm: (value: string) => void } | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [exportFormat, setExportFormat] = useState<"png" | "svg" | "pdf" | "json">("png");
  const [exportDPISel, setExportDPISel] = useState<150 | 300 | 600>(300);
  const [exportTransparent, setExportTransparent] = useState(false);
  const [selectedCells, setSelectedCells] = useState<{ r: number; c: number }[]>([]);
  const [savedStyles, setSavedStyles] = useState<{ name: string; settings: Partial<GraphSettings> }[]>(() => {
    try { return JSON.parse(localStorage.getItem("chartStudio_styles") || "[]"); } catch { return []; }
  });
  const graphAreaRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // ── Editor state (Phase E1) ──
  const editor = useEditor();

  // ── Side panel state (pill drawer + property drawers) ──
  const [activeLeftPill, setActiveLeftPill] = useState<"navigator" | "datasets" | "graphs" | null>(() => {
    try { return (localStorage.getItem("chartStudio_leftPill") as any) || "navigator"; } catch { return "navigator"; }
  });
  const toggleLeftPill = (id: "navigator" | "datasets" | "graphs") => {
    setActiveLeftPill((prev) => {
      const next = prev === id ? null : id;
      try { localStorage.setItem("chartStudio_leftPill", next || ""); } catch {}
      return next;
    });
  };
  const [propsCollapsed, setPropsCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("chartStudio_propsCollapsed") === "1"; } catch { return false; }
  });
  const togglePropsCollapsed = () => {
    setPropsCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("chartStudio_propsCollapsed", next ? "1" : ""); } catch {}
      return next;
    });
  };
  const [propsWidth, setPropsWidth] = useState(220);
  const [chartSwitchSetup, setChartSwitchSetup] = useState<ChartType | null>(null);
  const [projectContextMenu, setProjectContextMenu] = useState<{ x: number; y: number; projectId: string } | null>(null);
  const [datasetContextMenu, setDatasetContextMenu] = useState<{ x: number; y: number; datasetId: string } | null>(null);

  const handleNavResize = useCallback((width: number) => {
    setNavWidth(Math.max(100, Math.min(300, width)));
  }, []);
  const handlePropsResize = useCallback((width: number) => {
    setPropsWidth(Math.max(160, Math.min(400, width)));
  }, []);

  const commit = useCallback((updater: (prev: ProjectState) => ProjectState) => {
    setProject((prev) => {
      if (!prev) return prev;
      setUndoStack((u) => [...u.slice(-30), prev]);
      setRedoStack([]);
      return updater(prev);
    });
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !project) return;
    setRedoStack((r) => [...r, project]);
    setProject(undoStack[undoStack.length - 1]);
    setUndoStack((u) => u.slice(0, -1));
  }, [undoStack, project]);

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !project) return;
    setUndoStack((u) => [...u, project]);
    setProject(redoStack[redoStack.length - 1]);
    setRedoStack((r) => r.slice(0, -1));
  }, [redoStack, project]);

  // ── Dataset tab helpers (workbook-level) ──
  const activateDataset = useCallback((id: string) => {
    setWorkbook((wb) => (wb.activeDatasetId === id ? wb : { ...wb, activeDatasetId: id }));
    setUndoStack([]); setRedoStack([]);
  }, []);

  // True when user clicked "+" to add a new dataset tab — handleCreate should then create
  // a new dataset instead of updating the active one.
  const pendingNewDatasetRef = useRef(false);
  const addNewDatasetTab = useCallback(() => {
    // Don't create an empty dataset yet — just open the welcome dialog.
    // handleCreate (triggered by the dialog) will create a fully-populated dataset.
    pendingNewDatasetRef.current = true;
    setShowWelcome(true);
  }, []);

  const closeDatasetTab = useCallback((id: string) => {
    setWorkbook((wb) => {
      const remaining = wb.datasets.filter((d) => d.id !== id);
      if (remaining.length === 0) return createEmptyWorkbook();
      const nextActive = wb.activeDatasetId === id
        ? (remaining[Math.max(0, wb.datasets.findIndex((d) => d.id === id) - 1)]?.id ?? remaining[0].id)
        : wb.activeDatasetId;
      return { activeDatasetId: nextActive, datasets: remaining };
    });
    setUndoStack([]); setRedoStack([]);
  }, []);

  const renameDataset = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setWorkbook((wb) => ({
      ...wb,
      datasets: wb.datasets.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
    }));
  }, []);

  const duplicateDataset = useCallback((id: string) => {
    setWorkbook((wb) => {
      const src = wb.datasets.find((d) => d.id === id);
      if (!src) return wb;
      const copy = createDataset(`${src.name} (copy)`, {
        columns: [...src.columns],
        rows: src.rows.map((r) => [...r]),
        graphs: src.graphs.map((g) => ({ ...g, id: uid(), settings: { ...g.settings } })),
        analyses: src.analyses.map((a) => ({ ...a, id: uid() })),
        layoutState: { ...src.layoutState },
        panels: src.panels ? src.panels.map((p) => ({ ...p })) : undefined,
      });
      const first = copy.graphs[0];
      if (first) copy.activeGraphId = first.id;
      const firstA = copy.analyses[0];
      if (firstA) copy.activeAnalysisId = firstA.id;
      const srcIdx = wb.datasets.findIndex((d) => d.id === id);
      const next = [...wb.datasets];
      next.splice(srcIdx + 1, 0, copy);
      return { activeDatasetId: copy.id, datasets: next };
    });
    setUndoStack([]); setRedoStack([]);
  }, []);

  const exportDatasetCSV = useCallback((id: string) => {
    const ds = workbook.datasets.find((d) => d.id === id);
    if (!ds) return;
    const escape = (v: CellValue) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [ds.columns.map(escape).join(","), ...ds.rows.map((r) => r.map(escape).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${ds.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [workbook]);

  // ── Multi-panel helpers ──
  const activePanel: PanelState | null = useMemo(() => {
    if (!project?.layout || !project.panels) return null;
    return project.panels.find((p) => p.id === project.layout!.activePanelId) ?? null;
  }, [project?.layout, project?.panels]);

  const effectiveColumns = activePanel?.columns ?? project?.columns ?? [];
  const effectiveRows = activePanel?.rows ?? project?.rows ?? [];
  const effectiveSettings = activePanel?.graphSettings ?? project?.graphSettings;

  // Auto-run: when switching to Results tab without a pre-selected test, auto-suggest
  // and run the recommended test so something is visible immediately.
  useEffect(() => {
    if (activeTab === "results" && prevTabRef.current !== "results" && !analysisAutoTest && effectiveColumns.length >= 2 && effectiveRows.length > 0) {
      const colData = effectiveColumns.map((_, ci) => effectiveRows.map((r) => r[ci]).filter((v): v is number => typeof v === "number"));
      const suggestion = suggestStatisticalTest(effectiveColumns, colData, effectiveSettings?.chartType);
      if (suggestion) setAnalysisAutoTest(suggestion.recommended);
    }
    prevTabRef.current = activeTab;
  }, [activeTab, analysisAutoTest, effectiveColumns, effectiveRows, effectiveSettings?.chartType]);

  // Commit that routes to active panel or top-level
  const commitPanel = useCallback((updater: (pn: PanelState) => PanelState) => {
    commit((p) => {
      if (!p.layout || !p.panels) {
        // Single mode — treat top-level fields as a virtual panel
        const virtual: PanelState = { id: "root", label: "Main", columns: p.columns, rows: p.rows, graphSettings: p.graphSettings, analysis: p.analysis };
        const updated = updater(virtual);
        return { ...p, columns: updated.columns, rows: updated.rows, graphSettings: updated.graphSettings, analysis: updated.analysis };
      }
      return { ...p, panels: p.panels.map((pn) => pn.id === p.layout!.activePanelId ? updater(pn) : pn) };
    });
  }, [commit]);

  // ── Layout activation ──
  const activateLayout = useCallback((mode: LayoutMode) => {
    if (!project) return;
    if (mode === "single") {
      commit((p) => {
        const active = p.panels?.find((pn) => pn.id === p.layout?.activePanelId);
        return { ...p, columns: active?.columns ?? p.columns, rows: active?.rows ?? p.rows, graphSettings: active?.graphSettings ?? p.graphSettings, analysis: active?.analysis ?? p.analysis, layout: undefined, panels: undefined };
      });
      return;
    }
    const panelCount = mode === "inset" ? 2 : mode === "2-up" || mode === "2-up-vertical" ? 2 : mode === "3-up" ? 3 : 4;
    commit((p) => {
      const labels = ["A", "B", "C", "D"];
      const firstPanel: PanelState = { id: uid(), label: "Panel A", columns: [...p.columns], rows: p.rows.map((r) => [...r]), graphSettings: { ...p.graphSettings }, analysis: p.analysis ? { ...p.analysis } : null };
      const panels: PanelState[] = [firstPanel];
      for (let i = 1; i < panelCount; i++) {
        panels.push({
          id: uid(), label: `Panel ${labels[i]}`,
          columns: ["Col 1", "Col 2", "Col 3"],
          rows: Array.from({ length: 8 }, () => [null, null, null]),
          graphSettings: { ...createDefaultProject("column").graphSettings },
          analysis: null,
          ...(mode === "inset" && i === 1 ? { insetBounds: { x: 0.55, y: 0.05, width: 0.4, height: 0.4 } } : {}),
        });
      }
      return {
        ...p, layout: { mode, orientation: "landscape" as PageOrientation, activePanelId: firstPanel.id, pageLabel: "", showPanelLabels: true, panelLabelStyle: "uppercase" as const }, panels,
      };
    });
    setActiveTab("graph");
  }, [project, commit]);

  // ── Saved datasets & graph presets (cloud) ──
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);
  const [savedGraphPresets, setSavedGraphPresets] = useState<SavedGraphPreset[]>([]);

  // Load saved assets — try cloud first, fallback to localStorage
  const loadSavedAssets = useCallback(async () => {
    // Always load from localStorage (works without migration)
    try {
      const localDs = JSON.parse(localStorage.getItem("chartStudio_savedDatasets") || "[]");
      const localGp = JSON.parse(localStorage.getItem("chartStudio_savedGraphs") || "[]");
      if (localDs.length > 0) setSavedDatasets(localDs);
      if (localGp.length > 0) setSavedGraphPresets(localGp);
    } catch { /* ignore */ }
    // Try cloud if signed in
    if (!user) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const [ds, gp] = await Promise.all([
        supabase.from("chart_studio_saved_datasets").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50),
        supabase.from("chart_studio_saved_graphs").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50),
      ]);
      if (ds.data && ds.data.length > 0) setSavedDatasets(ds.data as SavedDataset[]);
      if (gp.data && gp.data.length > 0) setSavedGraphPresets(gp.data as SavedGraphPreset[]);
    } catch {
      // Cloud tables may not exist yet — localStorage is the fallback
    }
  }, [user]);

  useEffect(() => { loadSavedAssets(); }, [loadSavedAssets]);

  const saveDatasetToCloud = useCallback(async (name: string) => {
    if (!user) return;
    const newDs: SavedDataset = {
      id: uid(), user_id: user.id, name,
      columns: effectiveColumns, rows: effectiveRows,
      row_count: effectiveRows.length, col_count: effectiveColumns.length,
      created_at: new Date().toISOString(),
    };
    // Save to localStorage immediately
    const existing = JSON.parse(localStorage.getItem("chartStudio_savedDatasets") || "[]");
    const updated = [newDs, ...existing].slice(0, 50);
    localStorage.setItem("chartStudio_savedDatasets", JSON.stringify(updated));
    setSavedDatasets(updated);
    toast.success(`Dataset "${name}" saved`);
    // Also try cloud
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.from("chart_studio_saved_datasets").insert({ user_id: user.id, name, columns: effectiveColumns, rows: effectiveRows, row_count: effectiveRows.length, col_count: effectiveColumns.length });
    } catch { /* cloud save failed silently — localStorage has it */ }
  }, [user, effectiveColumns, effectiveRows]);

  const loadDatasetIntoPanel = useCallback((dataset: SavedDataset) => {
    commitPanel((pn) => ({ ...pn, columns: dataset.columns as string[], rows: dataset.rows as CellValue[][] }));
    toast.success(`Loaded "${dataset.name}"`);
  }, [commitPanel]);

  const saveGraphPreset = useCallback(async (name: string) => {
    if (!user || !effectiveSettings) return;
    const newGp: SavedGraphPreset = {
      id: uid(), user_id: user.id, name, chart_type: effectiveSettings.chartType,
      settings: { graphSettings: effectiveSettings, columns: effectiveColumns, rows: effectiveRows } as any,
      created_at: new Date().toISOString(),
    };
    // Save to localStorage immediately
    const existing = JSON.parse(localStorage.getItem("chartStudio_savedGraphs") || "[]");
    const updated = [newGp, ...existing].slice(0, 50);
    localStorage.setItem("chartStudio_savedGraphs", JSON.stringify(updated));
    setSavedGraphPresets(updated);
    toast.success(`Graph "${name}" saved`);
    // Also try cloud
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.from("chart_studio_saved_graphs").insert({
        user_id: user.id, name, chart_type: effectiveSettings.chartType,
        settings: { graphSettings: effectiveSettings, columns: effectiveColumns, rows: effectiveRows },
      });
    } catch { /* cloud save failed silently — localStorage has it */ }
  }, [user, effectiveSettings, effectiveColumns, effectiveRows]);

  const loadGraphPreset = useCallback((preset: SavedGraphPreset) => {
    const saved = preset.settings as any;
    commitPanel((pn) => ({
      ...pn,
      // Load settings (always present)
      graphSettings: { ...pn.graphSettings, ...(saved.graphSettings || saved) },
      // Load data if it was saved with the graph
      ...(saved.columns ? { columns: saved.columns } : {}),
      ...(saved.rows ? { rows: saved.rows } : {}),
    }));
    toast.success(`Loaded "${preset.name}" into ${activePanel?.label || "current panel"}`);
  }, [commitPanel, activePanel]);

  // Save a cloud project's data as a reusable dataset
  const saveProjectAsDataset = useCallback(async (projectId: string) => {
    if (!user) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("chart_studio_projects").select("name, project_data").eq("id", projectId).single();
      if (!data?.project_data) { toast.error("Project not found"); return; }
      const pd = data.project_data as any;
      const cols = pd.columns || []; const rows = pd.rows || [];
      const name = prompt("Dataset name:", data.name || "Untitled");
      if (!name) return;
      const newDs: SavedDataset = { id: uid(), user_id: user.id, name, columns: cols, rows, row_count: rows.length, col_count: cols.length, created_at: new Date().toISOString() };
      const existing = JSON.parse(localStorage.getItem("chartStudio_savedDatasets") || "[]");
      const updated = [newDs, ...existing].slice(0, 50);
      localStorage.setItem("chartStudio_savedDatasets", JSON.stringify(updated));
      setSavedDatasets(updated);
      toast.success(`Dataset "${name}" saved from project`);
      try { await supabase.from("chart_studio_saved_datasets").insert({ user_id: user.id, name, columns: cols, rows, row_count: rows.length, col_count: cols.length }); } catch { /* cloud optional */ }
    } catch { toast.error("Failed to save dataset"); }
  }, [user]);

  // Save a cloud project's full graph (data + settings) as a reusable preset
  const saveProjectAsPreset = useCallback(async (projectId: string) => {
    if (!user) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("chart_studio_projects").select("name, project_data").eq("id", projectId).single();
      if (!data?.project_data) { toast.error("Project not found"); return; }
      const pd = data.project_data as any;
      const name = prompt("Save graph as:", data.name || "Untitled");
      if (!name) return;
      const newGp: SavedGraphPreset = { id: uid(), user_id: user.id, name, chart_type: pd.graphSettings?.chartType || "column", settings: { graphSettings: pd.graphSettings, columns: pd.columns, rows: pd.rows } as any, created_at: new Date().toISOString() };
      const existing = JSON.parse(localStorage.getItem("chartStudio_savedGraphs") || "[]");
      const updated = [newGp, ...existing].slice(0, 50);
      localStorage.setItem("chartStudio_savedGraphs", JSON.stringify(updated));
      setSavedGraphPresets(updated);
      toast.success(`Graph "${name}" saved from project`);
      try { await supabase.from("chart_studio_saved_graphs").insert({ user_id: user.id, name, chart_type: pd.graphSettings?.chartType || "column", settings: { graphSettings: pd.graphSettings, columns: pd.columns, rows: pd.rows } }); } catch { /* cloud optional */ }
    } catch { toast.error("Failed to save graph"); }
  }, [user]);

  const deleteSavedAsset = useCallback(async (table: string, id: string) => {
    // Remove from localStorage
    if (table === "chart_studio_saved_datasets") {
      const existing = JSON.parse(localStorage.getItem("chartStudio_savedDatasets") || "[]");
      localStorage.setItem("chartStudio_savedDatasets", JSON.stringify(existing.filter((d: any) => d.id !== id)));
      setSavedDatasets((prev) => prev.filter((d) => d.id !== id));
    } else if (table === "chart_studio_saved_graphs") {
      const existing = JSON.parse(localStorage.getItem("chartStudio_savedGraphs") || "[]");
      localStorage.setItem("chartStudio_savedGraphs", JSON.stringify(existing.filter((d: any) => d.id !== id)));
      setSavedGraphPresets((prev) => prev.filter((d) => d.id !== id));
    }
    toast.success("Deleted");
    // Also try cloud
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.from(table).delete().eq("id", id);
    } catch { /* cloud delete failed — localStorage already updated */ }
  }, []);

  const handleCreate = (type: ChartType, overrides?: Partial<GraphSettings>, importedData?: { columns: string[]; rows: CellValue[][] }) => {
    const proj = createDefaultProject(type);
    if (overrides) {
      proj.graphSettings = { ...proj.graphSettings, ...overrides, chartType: type };
    }
    if (importedData) {
      proj.columns = importedData.columns;
      proj.rows = importedData.rows;
    }
    // If "+" was clicked (pending flag) AND there's already an active dataset, append a new dataset tab.
    // Otherwise fall through to the setProject shim — which creates the first dataset when empty,
    // or updates the active one when a user switches chart type from within an existing dataset.
    if (pendingNewDatasetRef.current && workbook.activeDatasetId) {
      pendingNewDatasetRef.current = false;
      const g = createGraphTab(proj.graphSettings.chartType, undefined, proj.graphSettings);
      setWorkbook((wb) => {
        const ds = createDataset(suggestDatasetName(wb), {
          columns: proj.columns, rows: proj.rows, graphs: [g], activeGraphId: g.id,
        });
        return { activeDatasetId: ds.id, datasets: [...wb.datasets, ds] };
      });
      setUndoStack([]); setRedoStack([]);
    } else {
      pendingNewDatasetRef.current = false;
      setProject(proj);
    }
    setShowWelcome(false);
    setActiveTab(importedData ? "graph" : "data");
  };

  // Data operations — all route through commitPanel for multi-graph support
  const onCellChange = useCallback((r: number, c: number, v: CellValue) => {
    commitPanel((pn) => ({ ...pn, rows: pn.rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? v : cell) : row) }));
  }, [commitPanel]);

  const onColumnRename = useCallback((c: number, name: string) => {
    commitPanel((pn) => ({ ...pn, columns: pn.columns.map((col, i) => i === c ? name : col) }));
  }, [commitPanel]);

  const onAddColumn = useCallback(() => {
    commitPanel((pn) => ({ ...pn, columns: [...pn.columns, `Col ${pn.columns.length + 1}`], rows: pn.rows.map((r) => [...r, null]) }));
  }, [commitPanel]);

  const onRemoveColumn = useCallback((c: number) => {
    commitPanel((pn) => ({ ...pn, columns: pn.columns.filter((_, i) => i !== c), rows: pn.rows.map((r) => r.filter((_, i) => i !== c)) }));
  }, [commitPanel]);

  const onAddRow = useCallback(() => {
    commitPanel((pn) => ({ ...pn, rows: [...pn.rows, Array(pn.columns.length).fill(null)] }));
  }, [commitPanel]);

  const onRemoveRow = useCallback((r: number) => {
    commitPanel((pn) => ({ ...pn, rows: pn.rows.filter((_, i) => i !== r) }));
  }, [commitPanel]);

  // Paste block of data from clipboard
  const onPasteData = useCallback((startRow: number, startCol: number, data: CellValue[][]) => {
    commitPanel((pn) => {
      let newCols = [...pn.columns];
      let newRows = pn.rows.map((r) => [...r]);
      const maxCol = startCol + (data[0]?.length || 0);
      while (newCols.length < maxCol) { newCols.push(`Col ${newCols.length + 1}`); newRows = newRows.map((r) => [...r, null]); }
      while (newRows.length < startRow + data.length) { newRows.push(Array(newCols.length).fill(null)); }
      for (let ri = 0; ri < data.length; ri++) {
        for (let ci = 0; ci < data[ri].length; ci++) { newRows[startRow + ri][startCol + ci] = data[ri][ci]; }
      }
      return { ...pn, columns: newCols, rows: newRows };
    });
  }, [commitPanel]);

  // Sort by column
  const onSortColumn = useCallback((col: number, ascending: boolean) => {
    commitPanel((pn) => {
      const sorted = [...pn.rows].sort((a, b) => {
        const va = a[col], vb = b[col];
        if (va === null && vb === null) return 0;
        if (va === null) return 1; if (vb === null) return -1;
        if (typeof va === "number" && typeof vb === "number") return ascending ? va - vb : vb - va;
        return ascending ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
      return { ...pn, rows: sorted };
    });
    toast.success(`Sorted ${ascending ? "↑" : "↓"}`);
  }, [commitPanel]);

  // Transpose rows ↔ columns
  const onTranspose = useCallback(() => {
    commitPanel((pn) => {
      const newCols = Array.from({ length: pn.rows.length }, (_, i) => `Row ${i + 1}`);
      const newRows = pn.columns.map((_, ci) => pn.rows.map((r) => r[ci]));
      return { ...pn, columns: newCols, rows: newRows };
    });
    toast.success("Data transposed");
  }, [commitPanel]);

  // Data transformations
  const onTransformColumn = useCallback((col: number, transform: string, constant?: number) => {
    commitPanel((pn) => {
      const vals = pn.rows.map((r) => r[col]).filter((v): v is number => typeof v === "number");
      if (vals.length === 0) return pn;
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1 || 1));
      const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1, baseline = vals[0];
      const k = constant ?? 1;
      // Robust stats for robust z-score
      const sortedVals = [...vals].sort((a, b) => a - b);
      const median = sortedVals.length % 2 === 0 ? (sortedVals[sortedVals.length / 2 - 1] + sortedVals[sortedVals.length / 2]) / 2 : sortedVals[Math.floor(sortedVals.length / 2)];
      const mad = (() => { const devs = vals.map((v) => Math.abs(v - median)).sort((a, b) => a - b); return devs.length % 2 === 0 ? (devs[devs.length / 2 - 1] + devs[devs.length / 2]) / 2 : devs[Math.floor(devs.length / 2)]; })();
      const total = vals.reduce((s, x) => s + x, 0);

      const fn: Record<string, (v: number) => number> = {
        // Log & Power
        log10: (v) => v > 0 ? Math.log10(v) : NaN,
        log2: (v) => v > 0 ? Math.log2(v) : NaN,
        ln: (v) => v > 0 ? Math.log(v) : NaN,
        sqrt: (v) => v >= 0 ? Math.sqrt(v) : NaN,
        antilog10: (v) => Math.pow(10, v),
        antilog2: (v) => Math.pow(2, v),
        antiloge: (v) => Math.exp(v),
        power: (v) => Math.pow(v, k),
        // Arithmetic
        multiply: (v) => v * k,
        divide: (v) => k !== 0 ? v / k : NaN,
        add: (v) => v + k,
        subtract: (v) => v - k,
        reciprocal: (v) => v !== 0 ? 1 / v : NaN,
        abs: (v) => Math.abs(v),
        round: (v) => parseFloat(v.toFixed(k)),
        negate: (v) => -v,
        // Statistical Scaling
        normalize: (v) => (v - min) / range,
        minmaxcustom: (v) => { const lo = k; const hi = constant ?? 100; return lo + ((v - min) / range) * (hi - lo); },
        zscore: (v) => sd > 0 ? (v - mean) / sd : 0,
        robustzscore: (v) => mad > 0 ? (v - median) / (mad * 1.4826) : 0,
        baseline: (v) => v - baseline,
        pctoftotal: (v) => (v / total) * 100,
        percentilerank: (_v) => NaN, // handled below
        rank: (_v) => NaN,
        cumsum: (_v) => NaN,
        runningavg: (_v) => NaN,
        delta: (_v) => NaN,
        pctchangefromfirst: (v) => baseline !== 0 ? ((v - baseline) / Math.abs(baseline)) * 100 : NaN,
        pctinhibition: (v) => { const ctrl = baseline; return ctrl !== 0 ? ((ctrl - v) / ctrl) * 100 : NaN; },
      };

      // Box-Cox: find optimal lambda by maximizing log-likelihood, then apply
      if (transform === "boxcox") {
        const allPositive = vals.every((v) => v > 0);
        if (!allPositive) { toast.error("Box-Cox requires all positive values"); return pn; }
        // Search lambda from -2 to 2 in steps of 0.1
        let bestLambda = 1, bestLL = -Infinity;
        for (let lam = -2; lam <= 2; lam += 0.1) {
          const transformed = vals.map((v) => lam === 0 ? Math.log(v) : (Math.pow(v, lam) - 1) / lam);
          const tmean = transformed.reduce((s, v) => s + v, 0) / transformed.length;
          const tvar = transformed.reduce((s, v) => s + (v - tmean) ** 2, 0) / transformed.length;
          if (tvar <= 0) continue;
          const ll = -0.5 * transformed.length * Math.log(tvar) + (lam - 1) * vals.reduce((s, v) => s + Math.log(v), 0);
          if (ll > bestLL) { bestLL = ll; bestLambda = lam; }
        }
        const lam = parseFloat(bestLambda.toFixed(1));
        const newRows = pn.rows.map((r) => {
          const row = [...r];
          if (typeof row[col] === "number" && (row[col] as number) > 0) {
            const v = row[col] as number;
            row[col] = parseFloat((lam === 0 ? Math.log(v) : (Math.pow(v, lam) - 1) / lam).toPrecision(8));
          }
          return row;
        });
        toast.success(`Box-Cox applied with λ=${lam}`);
        return { ...pn, rows: newRows };
      }

      // Quantile normalization (applies across ALL numeric columns, not just one)
      if (transform === "quantilenorm") {
        const numCols = pn.columns.map((_, ci) => pn.rows.map((r) => r[ci]).filter((v): v is number => typeof v === "number"));
        const maxLen = Math.max(...numCols.map((c) => c.length));
        if (maxLen < 2) return pn;
        // Sort each column, compute mean of ranks, reassign
        const sorted = numCols.map((c) => [...c].sort((a, b) => a - b));
        const meanRanks = Array.from({ length: maxLen }, (_, ri) => {
          const sum = sorted.reduce((s, c) => s + (c[ri] ?? 0), 0);
          return sum / sorted.filter((c) => ri < c.length).length;
        });
        const newRows = pn.rows.map((r) => [...r]);
        pn.columns.forEach((_, ci) => {
          const colVals = pn.rows.map((r, ri) => ({ ri, v: r[ci] })).filter((x) => typeof x.v === "number").sort((a, b) => (a.v as number) - (b.v as number));
          colVals.forEach((x, rank) => { if (rank < meanRanks.length) newRows[x.ri][ci] = parseFloat(meanRanks[rank].toPrecision(8)); });
        });
        return { ...pn, rows: newRows };
      }

      // Log-ratio to reference column (col B = reference, specified by constant)
      if (transform === "logratio") {
        const refCol = Math.round(k);
        if (refCol < 0 || refCol >= pn.columns.length) return pn;
        const newRows = pn.rows.map((r) => {
          const row = [...r];
          const v = typeof row[col] === "number" ? row[col] as number : null;
          const ref = typeof row[refCol] === "number" ? row[refCol] as number : null;
          if (v !== null && ref !== null && ref > 0 && v > 0) { row[col] = parseFloat(Math.log2(v / ref).toPrecision(8)); } else { row[col] = null; }
          return row;
        });
        return { ...pn, rows: newRows };
      }

      // ΔΔCt (qPCR): needs target gene col, reference gene col, and control sample mean
      if (transform === "ddct") {
        const refCol = Math.round(k);
        if (refCol < 0 || refCol >= pn.columns.length || refCol === col) return pn;
        const targetVals = pn.rows.map((r) => typeof r[col] === "number" ? r[col] as number : null);
        const refVals = pn.rows.map((r) => typeof r[refCol] === "number" ? r[refCol] as number : null);
        // ΔCt = target - reference
        const dCt = targetVals.map((t, i) => t !== null && refVals[i] !== null ? t - refVals[i]! : null);
        // ΔΔCt = ΔCt - mean(ΔCt of control, assumed to be first valid value)
        const controlDCt = dCt.find((v) => v !== null) ?? 0;
        const newRows = pn.rows.map((r, i) => {
          const row = [...r];
          row[col] = dCt[i] !== null ? parseFloat(Math.pow(2, -(dCt[i]! - controlDCt)).toPrecision(8)) : null;
          return row;
        });
        return { ...pn, rows: newRows };
      }

      // AUC per group (trapezoidal, assumes col is Y and rows are sequential X)
      if (transform === "auc") {
        let aucSum = 0;
        for (let i = 1; i < vals.length; i++) { aucSum += (vals[i] + vals[i - 1]) / 2; }
        // Replace all values with the AUC (single summary)
        const newRows = pn.rows.map((r) => {
          const row = [...r]; if (typeof row[col] === "number") row[col] = parseFloat(aucSum.toPrecision(8)); return row;
        });
        toast.success(`AUC = ${aucSum.toPrecision(6)}`);
        return { ...pn, rows: newRows };
      }

      // Survival censoring helper: converts event column to 0/1
      if (transform === "survivalcensor") {
        const newRows = pn.rows.map((r) => {
          const row = [...r];
          if (typeof row[col] === "number") { row[col] = (row[col] as number) > 0 ? 1 : 0; }
          else if (typeof row[col] === "string") {
            const s = (row[col] as string).toLowerCase().trim();
            row[col] = ["1", "yes", "true", "event", "dead", "died", "relapse", "failure"].includes(s) ? 1 : 0;
          }
          return row;
        });
        return { ...pn, rows: newRows };
      }

      // Special transforms that need row context
      if (transform === "rank") {
        const sorted = [...vals].sort((a, b) => a - b);
        const newRows = pn.rows.map((r) => {
          const row = [...r];
          if (typeof row[col] === "number") { row[col] = sorted.indexOf(row[col] as number) + 1; }
          return row;
        });
        return { ...pn, rows: newRows };
      }
      if (transform === "percentilerank") {
        const sorted = [...vals].sort((a, b) => a - b);
        const n = sorted.length;
        const newRows = pn.rows.map((r) => {
          const row = [...r];
          if (typeof row[col] === "number") { const rank = sorted.filter((v) => v <= (row[col] as number)).length; row[col] = parseFloat(((rank / n) * 100).toFixed(2)); }
          return row;
        });
        return { ...pn, rows: newRows };
      }
      if (transform === "cumsum") {
        let cum = 0;
        const newRows = pn.rows.map((r) => {
          const row = [...r];
          if (typeof row[col] === "number") { cum += row[col] as number; row[col] = parseFloat(cum.toPrecision(8)); }
          return row;
        });
        return { ...pn, rows: newRows };
      }
      if (transform === "runningavg") {
        const window = Math.max(2, Math.round(k));
        const buf: number[] = [];
        const newRows = pn.rows.map((r) => {
          const row = [...r];
          if (typeof row[col] === "number") { buf.push(row[col] as number); if (buf.length > window) buf.shift(); row[col] = parseFloat((buf.reduce((s, v) => s + v, 0) / buf.length).toPrecision(8)); }
          return row;
        });
        return { ...pn, rows: newRows };
      }
      if (transform === "delta") {
        let prev: number | null = null;
        const newRows = pn.rows.map((r) => {
          const row = [...r];
          if (typeof row[col] === "number") { const cur = row[col] as number; row[col] = prev !== null ? parseFloat((cur - prev).toPrecision(8)) : null; prev = cur; }
          return row;
        });
        return { ...pn, rows: newRows };
      }

      const transformer = fn[transform]; if (!transformer) return pn;
      const newRows = pn.rows.map((r) => {
        const row = [...r];
        if (typeof row[col] === "number") { const result = transformer(row[col] as number); row[col] = isNaN(result) ? null : parseFloat(result.toPrecision(8)); }
        return row;
      });
      return { ...pn, rows: newRows };
    });
    toast.success(`Applied ${transform}${constant !== undefined ? ` (${constant})` : ""} to column`);
  }, [commitPanel]);

  // Two-column operations (creates a new column with the result)
  const onColumnOperation = useCallback((colA: number, colB: number, op: string) => {
    commitPanel((pn) => {
      const label = `${pn.columns[colA]} ${op === "diff" ? "−" : op === "ratio" ? "/" : op === "foldchange" ? "FC" : op} ${pn.columns[colB]}`;
      const newCols = [...pn.columns, label];
      const newRows = pn.rows.map((r) => {
        const a = typeof r[colA] === "number" ? r[colA] as number : null;
        const b = typeof r[colB] === "number" ? r[colB] as number : null;
        let result: number | null = null;
        if (a !== null && b !== null) {
          if (op === "diff") result = a - b;
          else if (op === "ratio") result = b !== 0 ? a / b : null;
          else if (op === "foldchange") result = b !== 0 ? Math.log2(Math.abs(a / b)) : null;
        }
        return [...r, result !== null ? parseFloat(result.toPrecision(8)) : null];
      });
      return { ...pn, columns: newCols, rows: newRows };
    });
    toast.success(`Created ${op} column`);
  }, [commitPanel]);

  // Missing data operations
  const onMissingDataOp = useCallback((col: number, op: string) => {
    commitPanel((pn) => {
      const vals = pn.rows.map((r) => r[col]).filter((v): v is number => typeof v === "number");
      if (op === "fill-mean" || op === "fill-median" || op === "fill-zero") {
        const fillVal = op === "fill-zero" ? 0 : op === "fill-mean" ? (vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0) : (() => { const s = [...vals].sort((a, b) => a - b); return s.length % 2 === 0 ? (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : s[Math.floor(s.length / 2)]; })();
        const newRows = pn.rows.map((r) => { const row = [...r]; if (row[col] === null || row[col] === "") row[col] = parseFloat(fillVal.toPrecision(8)); return row; });
        return { ...pn, rows: newRows };
      }
      if (op === "interpolate") {
        const newRows = pn.rows.map((r) => [...r]);
        for (let i = 0; i < newRows.length; i++) {
          if (newRows[i][col] === null || newRows[i][col] === "") {
            let prevIdx = -1, nextIdx = -1;
            for (let j = i - 1; j >= 0; j--) { if (typeof newRows[j][col] === "number") { prevIdx = j; break; } }
            for (let j = i + 1; j < newRows.length; j++) { if (typeof newRows[j][col] === "number") { nextIdx = j; break; } }
            if (prevIdx >= 0 && nextIdx >= 0) {
              const prevVal = newRows[prevIdx][col] as number, nextVal = newRows[nextIdx][col] as number;
              newRows[i][col] = parseFloat((prevVal + (nextVal - prevVal) * ((i - prevIdx) / (nextIdx - prevIdx))).toPrecision(8));
            }
          }
        }
        return { ...pn, rows: newRows };
      }
      if (op === "remove-blank-rows") {
        const newRows = pn.rows.filter((r) => r[col] !== null && r[col] !== "");
        return { ...pn, rows: newRows };
      }
      if (op === "remove-outliers-2sd" || op === "remove-outliers-3sd" || op === "remove-outliers-iqr") {
        const mean = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1 || 1));
        const sorted = [...vals].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)], q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const isOutlier = (v: number) => {
          if (op === "remove-outliers-2sd") return Math.abs(v - mean) > 2 * sd;
          if (op === "remove-outliers-3sd") return Math.abs(v - mean) > 3 * sd;
          return v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr;
        };
        const newRows = pn.rows.filter((r) => typeof r[col] !== "number" || !isOutlier(r[col] as number));
        return { ...pn, rows: newRows };
      }
      return pn;
    });
    toast.success(`Applied ${op} to column`);
  }, [commitPanel]);

  const updateGraphSetting = useCallback((field: keyof GraphSettings, value: any) => {
    commitPanel((pn) => ({ ...pn, graphSettings: { ...pn.graphSettings, [field]: value } }));
  }, [commitPanel]);

  // Batch version — commits N fields as ONE undo entry.
  // Use this whenever a single user action touches multiple settings (presets,
  // style application, dimension presets, palette switches).
  const updateGraphSettings = useCallback((patch: Partial<GraphSettings>) => {
    commitPanel((pn) => ({ ...pn, graphSettings: { ...pn.graphSettings, ...patch } }));
  }, [commitPanel]);

  // Transient setter — writes to active dataset's active graph settings WITHOUT pushing an undo entry.
  // Used during continuous interactions (drag) where every pointermove would otherwise flood the history.
  // Callers should push a single undo snapshot at the start of the interaction via pushUndoSnapshot.
  const updateGraphSettingTransient = useCallback((field: keyof GraphSettings, value: any) => {
    setWorkbook((wb) => updateActiveDataset(wb, (d) => {
      if (!d.activeGraphId) return d;
      return {
        ...d,
        graphs: d.graphs.map((g) => g.id === d.activeGraphId
          ? { ...g, settings: { ...g.settings, [field]: value } }
          : g),
      };
    }));
  }, []);

  // Manually push the current project onto the undo stack. Used at the start of a drag
  // (so the whole drag becomes one undo entry instead of dozens from each pointermove).
  const pushUndoSnapshot = useCallback(() => {
    setWorkbook((wb) => {
      const proj = projectFromWorkbook(wb);
      if (proj) {
        setUndoStack((u) => [...u.slice(-30), proj]);
        setRedoStack([]);
      }
      return wb; // no-op on workbook itself
    });
  }, []);

  const onAnnotationMove = useCallback((index: number, x: number, y: number, arrowToX?: number, arrowToY?: number) => {
    commitPanel((pn) => {
      const newAnns = [...pn.graphSettings.annotations];
      newAnns[index] = { ...newAnns[index], x, y, ...(arrowToX !== undefined ? { arrowToX } : {}), ...(arrowToY !== undefined ? { arrowToY } : {}) };
      return { ...pn, graphSettings: { ...pn.graphSettings, annotations: newAnns } };
    });
  }, [commitPanel]);

  const handleRunTest = useCallback((testType: TestType, colAIdx?: number, colBIdx?: number) => {
    if (!project) return;
    const _cols = effectiveColumns;
    const _rows = effectiveRows;
    const colData = _cols.map((_, ci) => _rows.map((r) => r[ci]).filter((v): v is number => typeof v === "number"));

    // Warn about excluded non-numeric values
    const totalCells = _cols.map((_, ci) => _rows.filter((r) => r[ci] !== null).length);
    const numericCells = colData.map((d) => d.length);
    const excluded = totalCells.map((t, i) => t - numericCells[i]);
    const totalExcluded = excluded.reduce((s, v) => s + v, 0);
    if (totalExcluded > 0) {
      const details = effectiveColumns.map((name, i) => excluded[i] > 0 ? `${name}: ${excluded[i]}` : "").filter(Boolean).join(", ");
      toast.warning(`${totalExcluded} non-numeric value(s) excluded: ${details}`);
    }

    let result: TestResult | null = null;

    if (testType === "unpaired-t" && colAIdx !== undefined && colBIdx !== undefined) {
      const a = colData[colAIdx], b = colData[colBIdx];
      if (a.length < 2 || b.length < 2) { toast.error("Need at least 2 values per group"); return; }
      result = unpairedTTest(_cols[colAIdx], a, _cols[colBIdx], b);
    } else if (testType === "paired-t" && colAIdx !== undefined && colBIdx !== undefined) {
      const a = colData[colAIdx], b = colData[colBIdx];
      if (Math.min(a.length, b.length) < 3) { toast.error("Need at least 3 paired values"); return; }
      result = pairedTTest(_cols[colAIdx], a, _cols[colBIdx], b);
    } else if (testType === "mann-whitney" && colAIdx !== undefined && colBIdx !== undefined) {
      const a = colData[colAIdx], b = colData[colBIdx];
      if (a.length < 2 || b.length < 2) { toast.error("Need at least 2 values per group"); return; }
      result = mannWhitneyU(_cols[colAIdx], a, _cols[colBIdx], b);
    } else if (testType === "one-way-anova") {
      const validCols = colData.filter((d) => d.length >= 2);
      if (validCols.length < 2) { toast.error("Need at least 2 groups with 2+ values each"); return; }
      const validNames = _cols.filter((_, i) => colData[i].length >= 2);
      result = oneWayAnova(validNames, validCols);
    } else if (testType === "pearson-corr" && colAIdx !== undefined && colBIdx !== undefined) {
      const a = colData[colAIdx], b = colData[colBIdx];
      if (Math.min(a.length, b.length) < 3) { toast.error("Need at least 3 paired values"); return; }
      result = pearsonCorrelation(_cols[colAIdx], a, _cols[colBIdx], b);
    } else if (testType === "tukey-posthoc") {
      const validCols = colData.filter((d) => d.length >= 2);
      if (validCols.length < 2) { toast.error("Need at least 2 groups with 2+ values"); return; }
      const validNames = _cols.filter((_, i) => colData[i].length >= 2);
      result = tukeyPostHoc(validNames, validCols);
    } else if (testType === "chi-square") {
      const observed = _rows.map((r) => r.map((v) => (typeof v === "number" ? v : 0))).filter((r) => r.some((v) => v > 0));
      if (observed.length < 2 || (observed[0]?.length || 0) < 2) { toast.error("Need at least a 2×2 contingency table"); return; }
      result = chiSquareTest(observed);
    } else if (testType === "linear-reg" && colAIdx !== undefined && colBIdx !== undefined) {
      const a = colData[colAIdx], b = colData[colBIdx];
      if (Math.min(a.length, b.length) < 3) { toast.error("Need at least 3 paired values"); return; }
      result = linearRegressionTest(_cols[colAIdx], a, _cols[colBIdx], b);
    } else if (testType === "normality" && colAIdx !== undefined) {
      const vals = colData[colAIdx];
      if (vals.length < 8) { toast.error("Need at least 8 values for normality test"); return; }
      result = normalityTest(_cols[colAIdx], vals);
    } else if (testType === "spearman-corr" && colAIdx !== undefined && colBIdx !== undefined) {
      const a = colData[colAIdx], b2 = colData[colBIdx];
      if (Math.min(a.length, b2.length) < 3) { toast.error("Need at least 3 paired values"); return; }
      result = spearmanCorrelation(_cols[colAIdx], a, _cols[colBIdx], b2);
    } else if (testType === "wilcoxon-signed" && colAIdx !== undefined && colBIdx !== undefined) {
      const a = colData[colAIdx], b2 = colData[colBIdx];
      if (Math.min(a.length, b2.length) < 3) { toast.error("Need at least 3 paired values"); return; }
      result = wilcoxonSignedRank(_cols[colAIdx], a, _cols[colBIdx], b2);
    } else if (testType === "kruskal-wallis") {
      const validCols = colData.filter((d) => d.length >= 2);
      if (validCols.length < 2) { toast.error("Need at least 2 groups with 2+ values"); return; }
      const validNames = _cols.filter((_, i) => colData[i].length >= 2);
      result = kruskalWallis(validNames, validCols);
    } else if (testType === "fisher-exact") {
      const numericRows = _rows.map((r) => r.map((v) => (typeof v === "number" ? v : 0))).filter((r) => r.some((v) => v > 0));
      if (numericRows.length !== 2 || (numericRows[0]?.length || 0) !== 2) { toast.error("Fisher's exact needs a 2×2 table"); return; }
      result = fisherExact(numericRows);
    } else if (testType === "two-way-anova") {
      result = twoWayAnova(_cols, _rows);
    } else if (testType === "one-sample-t" && colAIdx !== undefined) {
      const vals = colData[colAIdx];
      if (vals.length < 3) { toast.error("Need at least 3 values"); return; }
      result = oneSampleTTest(_cols[colAIdx], vals, 0);
    } else if (testType === "log-rank") {
      if (colData.length < 4) { toast.error("Need time/event column pairs"); return; }
      result = logRankTest(colData);
    } else if (testType === "power-analysis") {
      if (colData.filter(d => d.length >= 2).length < 1) { toast.error("Need at least 1 group with data"); return; }
      result = powerAnalysis(colData);
    } else if (testType === "pca") {
      if (colData.filter(d => d.length >= 3).length < 2) { toast.error("Need ≥2 variables with ≥3 observations"); return; }
      result = pcaAnalysis(colData);
    } else if (testType === "kmeans") {
      if (colData.filter(d => d.length >= 3).length < 1) { toast.error("Need data for clustering"); return; }
      const k = Math.min(5, Math.max(2, Math.floor(Math.min(...colData.map(c => c.length)) / 3)));
      result = kmeansAnalysis(colData, k);
    } else if (testType === "hierarchical-cluster") {
      if (Math.min(...colData.map(c => c.length)) < 3) { toast.error("Need ≥3 observations"); return; }
      result = hierarchicalCluster(colData);
    } else if (testType === "multiple-linear-reg") {
      if (colData.length < 2) { toast.error("Need Y column + ≥1 predictor"); return; }
      result = multipleLinearReg(colData);
    } else if (testType === "multiple-logistic-reg") {
      if (colData.length < 2) { toast.error("Need binary outcome (0/1) + predictors"); return; }
      result = multipleLogisticReg(colData);
    } else if (testType === "poisson-reg") {
      if (colData.length < 2) { toast.error("Need count outcome + predictors"); return; }
      result = poissonReg(colData);
    } else if (testType === "cox-reg") {
      if (colData.length < 3) { toast.error("Need Time, Event(0/1), + covariates"); return; }
      result = coxRegression(colData);
    } else if (testType === "dose-response-analysis") {
      if (colData.length < 2) { toast.error("Need Concentration + Response columns"); return; }
      result = doseResponseAnalysis(colData);
    }

    if (result) {
      setTestResults((prev) => [...prev, result!]);
      const pMsg = result.pValue > 0 ? `: p = ${result.pValue < 0.001 ? "<0.001" : result.pValue.toFixed(4)}` : "";
      toast.success(`${result.testName}${pMsg}`);

      // Auto-annotate: add p-value bracket for pairwise tests on column/grouped charts
      if (effectiveSettings!.chartType === "column" || effectiveSettings!.chartType === "grouped") {
        if (["unpaired-t", "paired-t", "mann-whitney", "wilcoxon-signed"].includes(result.testType) && colAIdx !== undefined && colBIdx !== undefined) {
          const pStr = result.pValue < 0.001 ? "***" : result.pValue < 0.01 ? "**" : result.pValue < 0.05 ? "*" : "ns";
          const means = colData.map((vals) => vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0);
          const errs = colData.map((vals) => { if (vals.length < 2) return 0; const m = vals.reduce((s, v) => s + v, 0) / vals.length; return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1)) / Math.sqrt(vals.length); });
          const maxY = Math.max(means[colAIdx] + errs[colAIdx], means[colBIdx] + errs[colBIdx]);
          const bracketY = maxY * 1.12 + effectiveSettings!.pBrackets.length * (maxY * 0.08);
          const newBrackets = [...effectiveSettings!.pBrackets, { colA: colAIdx, colB: colBIdx, pValue: pStr, y: bracketY }];
          commitPanel((pn) => ({ ...pn, graphSettings: { ...pn.graphSettings, pBrackets: newBrackets } }));
          toast.success(`Added ${pStr} bracket to graph`);
        }
        // Post-hoc: add brackets for all significant pairs
        if (result.testType === "tukey-posthoc" && result.subResults) {
          const sigPairs = result.subResults.filter((sr) => sr.significant);
          if (sigPairs.length > 0) {
            const means = colData.map((vals) => vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0);
            const maxMean = Math.max(...means);
            const colNames = effectiveColumns;
            const newBrackets = [...effectiveSettings!.pBrackets];
            sigPairs.forEach((sr, idx) => {
              const ciA = colNames.indexOf(sr.groupA);
              const ciB = colNames.indexOf(sr.groupB);
              if (ciA >= 0 && ciB >= 0) {
                const pStr = sr.pValue < 0.001 ? "***" : sr.pValue < 0.01 ? "**" : sr.pValue < 0.05 ? "*" : "ns";
                newBrackets.push({ colA: ciA, colB: ciB, pValue: pStr, y: maxMean * 1.15 + (newBrackets.length - effectiveSettings!.pBrackets.length + idx) * (maxMean * 0.08) });
              }
            });
            commitPanel((pn) => ({ ...pn, graphSettings: { ...pn.graphSettings, pBrackets: newBrackets } }));
            toast.success(`Added ${sigPairs.length} significance bracket(s) to graph`);
          }
        }
      }
    }
  }, [project]);

  // CSV import
  const handleCSV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = (ev.target?.result as string).trim();
        const lines = text.split("\n");
        const sep = lines[0].includes("\t") ? "\t" : ",";
        const headers = lines[0].split(sep).map((h) => h.trim().replace(/^["']|["']$/g, ""));
        const rows = lines.slice(1).map((l) => l.split(sep).map((v) => { const t = v.trim().replace(/^["']|["']$/g, ""); const n = Number(t); return t === "" ? null : isNaN(n) ? t : n; }));
        // Create a new dataset tab for the imported CSV (never replace the active dataset).
        const datasetName = file.name.replace(/\.(csv|tsv|txt|tab)$/i, "") || "Imported";
        setWorkbook((wb) => {
          // Create with a default column chart so `project` is non-null immediately
          const g = createGraphTab("column", undefined, { title: datasetName });
          const ds = createDataset(datasetName, { columns: headers, rows, graphs: [g], activeGraphId: g.id });
          return { activeDatasetId: ds.id, datasets: [...wb.datasets, ds] };
        });
        setUndoStack([]); setRedoStack([]);
        toast.success(`Imported "${datasetName}" — ${rows.length} rows × ${headers.length} columns`);
      } catch { toast.error("Failed to parse CSV"); }
    };
    reader.readAsText(file); e.target.value = "";
  }, []);

  // ── Export helpers (layout-aware: composites all SVGs for multi-panel) ──

  // Get all chart SVGs — single mode returns 1, multi-panel returns all
  const getChartSvgs = useCallback((): SVGElement[] => {
    if (!graphAreaRef.current) return [];
    const svgs = graphAreaRef.current.querySelectorAll("#chart-studio-svg");
    return Array.from(svgs) as SVGElement[];
  }, []);

  // Render all panels into a single composite canvas
  const renderCompositeCanvas = useCallback((dpiScale: number): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const svgs = getChartSvgs();
      if (svgs.length === 0) { reject(new Error("No charts found")); return; }

      // Single chart — simple path
      if (svgs.length === 1 || !project?.layout || !project.panels) {
        const svg = svgs[0];
        const w = parseFloat(svg.getAttribute("width") || "740");
        const h = parseFloat(svg.getAttribute("height") || "520");
        const str = new XMLSerializer().serializeToString(svg);
        const c = document.createElement("canvas"); c.width = Math.round(w * dpiScale); c.height = Math.round(h * dpiScale);
        const ctx = c.getContext("2d")!;
        const img = new Image();
        img.onload = () => { ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); resolve(c); };
        img.onerror = () => reject(new Error("SVG render failed"));
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(str)));
        return;
      }

      // Multi-panel — find the layout container and compute bounding box
      const container = graphAreaRef.current!.querySelector("[data-layout-container]") as HTMLElement;
      if (!container) { reject(new Error("Layout container not found")); return; }

      const containerRect = container.getBoundingClientRect();
      const cW = Math.round(containerRect.width * dpiScale);
      const cH = Math.round(containerRect.height * dpiScale);
      const canvas = document.createElement("canvas"); canvas.width = cW; canvas.height = cH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, cW, cH);

      // Render each SVG at its position within the container
      let loaded = 0;
      const total = svgs.length;
      svgs.forEach((svg) => {
        const svgRect = svg.getBoundingClientRect();
        const offX = (svgRect.left - containerRect.left) * dpiScale;
        const offY = (svgRect.top - containerRect.top) * dpiScale;
        const svgW = svgRect.width * dpiScale;
        const svgH = svgRect.height * dpiScale;
        const str = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, offX, offY, svgW, svgH);
          loaded++;
          if (loaded === total) resolve(canvas);
        };
        img.onerror = () => { loaded++; if (loaded === total) resolve(canvas); };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(str)));
      });
    });
  }, [getChartSvgs, project]);

  const exportSVG = useCallback(() => {
    const svgs = getChartSvgs();
    if (svgs.length === 0) { toast.error("Switch to Graph tab"); return; }
    if (svgs.length === 1) {
      const blob = new Blob([new XMLSerializer().serializeToString(svgs[0])], { type: "image/svg+xml" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "biosketch-chart.svg"; a.click();
    } else {
      // Composite SVG: wrap all in a parent SVG
      const container = graphAreaRef.current!.querySelector("[data-layout-container]") as HTMLElement;
      if (!container) { toast.error("Layout not found"); return; }
      const cRect = container.getBoundingClientRect();
      let inner = "";
      svgs.forEach((svg) => {
        const r = svg.getBoundingClientRect();
        const x = r.left - cRect.left; const y = r.top - cRect.top;
        const content = new XMLSerializer().serializeToString(svg);
        inner += `<g transform="translate(${x},${y})">${content}</g>\n`;
      });
      const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cRect.width}" height="${cRect.height}" viewBox="0 0 ${cRect.width} ${cRect.height}"><rect width="${cRect.width}" height="${cRect.height}" fill="white"/>${inner}</svg>`;
      const blob = new Blob([compositeSvg], { type: "image/svg+xml" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "biosketch-layout.svg"; a.click();
    }
    toast.success("Exported SVG!");
  }, [getChartSvgs]);

  const exportPNG = useCallback(async () => {
    try {
      const dpi = effectiveSettings?.exportDPI || 300;
      const scale = dpi / 96;
      const canvas = await renderCompositeCanvas(scale);
      const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = "biosketch-chart.png"; a.click();
      toast.success("Exported PNG!");
    } catch { toast.error("Export failed — switch to Graph tab"); }
  }, [renderCompositeCanvas, effectiveSettings]);

  // Add to BioSketch Canvas
  const addToCanvas = useCallback(async () => {
    // Ship the chart to /canvas as an SVG string so Fabric can parse it into
    // individually selectable objects (each axis line, tick, mark, and label
    // becomes editable) — not a flat PNG. Data binding is lost from this
    // point; users can ungroup and treat the chart as an illustration.
    try {
      const svg = document.getElementById("chart-studio-svg");
      if (!svg) {
        toast.error("Switch to Graph tab first");
        return;
      }
      const svgStr = new XMLSerializer().serializeToString(svg);
      sessionStorage.setItem("chart_studio_svg_import", svgStr);
      toast.success("Opening in Canvas — every element will be editable");
      navigate("/canvas");
    } catch {
      toast.error("Failed to prepare chart for canvas — switch to Graph tab");
    }
  }, [navigate]);

  // Export as PDF (layout-aware)
  const exportPDF = useCallback(async () => {
    try {
      const dpi = effectiveSettings?.exportDPI || 300;
      const scale = dpi / 96;
      const c = await renderCompositeCanvas(scale);
      const pxW = c.width / scale; const pxH = c.height / scale;
      const imgData = c.toDataURL("image/jpeg", 0.95);
      try {
        const { default: jsPDF } = await import("jspdf");
        const orientation = pxW > pxH ? "landscape" : "portrait";
        const pdf = new jsPDF({ orientation, unit: "px", format: [pxW, pxH] });
        pdf.addImage(imgData, "JPEG", 0, 0, pxW, pxH);
        pdf.save(`${effectiveSettings?.title || "chart"}.pdf`);
        toast.success("Exported as PDF!");
      } catch {
        const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${effectiveSettings?.title || "chart"}.png`; a.click();
        toast.success(`Exported as high-DPI PNG (${dpi} DPI)`);
      }
    } catch { toast.error("Export failed — switch to Graph tab"); }
  }, [renderCompositeCanvas, effectiveSettings]);

  // Multi-panel export — tile 2 charts side by side
  const exportMultiPanel = useCallback(() => {
    if (!project) return;
    const svg1 = document.getElementById("chart-studio-svg");
    if (!svg1) { toast.error("Switch to Graph tab first"); return; }
    const str1 = new XMLSerializer().serializeToString(svg1);
    const w = effectiveSettings!.chartWidth || 740;
    const h = effectiveSettings!.chartHeight || 520;

    // Create a combined SVG with panel labels
    const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <style>text { font-family: ${effectiveSettings!.fontFamily || "Inter, sans-serif"}; }</style>
      ${str1.replace(/<\/?svg[^>]*>/g, "")}
    </svg>`;

    const blob = new Blob([combined], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "biosketch-figure.svg";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Exported figure panel!");
  }, [project]);

  // Journal export with validation
  const exportForJournal = useCallback((journal: string) => {
    if (!project) return;
    const specs: Record<string, { width: number; dpi: number; font: string; name: string }> = {
      nature: { width: 600, dpi: 300, font: "Arial, Helvetica, sans-serif", name: "Nature" },
      science: { width: 600, dpi: 300, font: "Helvetica, Arial, sans-serif", name: "Science" },
      cell: { width: 650, dpi: 300, font: "Arial, Helvetica, sans-serif", name: "Cell" },
      lancet: { width: 600, dpi: 300, font: "Arial, Helvetica, sans-serif", name: "The Lancet" },
      plos: { width: 650, dpi: 300, font: "Arial, Helvetica, sans-serif", name: "PLOS ONE" },
    };
    const spec = specs[journal];
    if (!spec) return;

    const warnings: string[] = [];
    const gs = effectiveSettings!;

    if (gs.chartWidth > spec.width * 1.2) warnings.push(`Width (${gs.chartWidth}px) exceeds ${spec.name} max (~${spec.width}px)`);
    if (gs.exportDPI < spec.dpi) warnings.push(`DPI (${gs.exportDPI}) below recommended ${spec.dpi}`);
    if (gs.fontFamily !== spec.font) warnings.push(`Font should be ${spec.font.split(",")[0]}`);
    if (gs.tickLabelSize < 8) warnings.push("Tick labels too small (min 8pt)");
    if (gs.titleSize > 16) warnings.push("Title may be too large for journal figure");

    // Auto-fix settings
    commit((p) => ({
      ...p, graphSettings: {
        ...p.graphSettings,
        chartWidth: Math.min(p.graphSettings.chartWidth, spec.width),
        exportDPI: Math.max(p.graphSettings.exportDPI, spec.dpi) as 150 | 300 | 600,
        fontFamily: spec.font,
      }
    }));

    if (warnings.length > 0) {
      toast.warning(`${spec.name} checks: ${warnings.join(". ")}. Auto-adjusted where possible.`);
    } else {
      toast.success(`${spec.name} format validated — ready to export!`);
    }

    // Trigger PNG export after settings update
    setTimeout(() => exportPNG(), 100);
  }, [project, commit, exportPNG]);

  // Save project to localStorage
  const saveProjectLocal = useCallback(async () => {
    if (!project) return;
    const name = effectiveSettings!.title || "Untitled";

    // Always save to localStorage as backup
    localStorage.setItem("chartStudio_current", JSON.stringify({ ...project, savedAt: new Date().toISOString(), name }));

    // If signed in, save to cloud
    if (user) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        if (cloudProjectId) {
          // Update existing
          await supabase.from("chart_studio_projects").update({
            name, chart_type: effectiveSettings!.chartType,
            project_data: project as any,
          }).eq("id", cloudProjectId);
        } else {
          // Create new
          const { data } = await supabase.from("chart_studio_projects").insert({
            user_id: user.id, name, chart_type: effectiveSettings!.chartType,
            project_data: project as any,
          }).select("id").single();
          if (data) setCloudProjectId(data.id);
        }
      } catch (err) {
        console.error("Cloud save failed:", err);
      }
    }

    setLastSaved(new Date());
  }, [project, user, cloudProjectId]);

  // Load project list from cloud
  const loadCloudProjects = useCallback(async () => {
    if (!user) return;
    setLoadingCloudProjects(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("chart_studio_projects")
        .select("id, name, chart_type, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      setCloudProjects(data || []);
    } catch { /* silent */ }
    setLoadingCloudProjects(false);
  }, [user]);

  // Load a specific cloud project
  const loadCloudProject = useCallback(async (projectId: string) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("chart_studio_projects")
        .select("id, project_data")
        .eq("id", projectId)
        .single();
      if (data?.project_data) {
        setProject(data.project_data as any);
        setCloudProjectId(data.id);
        setShowWelcome(false);
        setActiveTab("data");
        toast.success("Project loaded from cloud");
      }
    } catch { toast.error("Failed to load project"); }
  }, []);

  // Delete cloud project
  const deleteCloudProject = useCallback(async (projectId: string) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.from("chart_studio_projects").delete().eq("id", projectId);
      setCloudProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (cloudProjectId === projectId) setCloudProjectId(null);
      toast.success("Project deleted");
    } catch { toast.error("Failed to delete"); }
  }, [cloudProjectId]);

  // Load project from localStorage (fallback for non-signed-in)
  const loadProjectLocal = useCallback(() => {
    const json = localStorage.getItem("chartStudio_current");
    if (!json) { toast.error("No saved project found"); return; }
    try {
      const saved = JSON.parse(json);
      setProject(saved);
      setShowWelcome(false);
      toast.success(`Loaded: ${saved.graphSettings?.title || "Untitled"}`);
    } catch { toast.error("Failed to load saved project"); }
  }, []);

  // Load cloud projects on mount
  useEffect(() => { if (user) loadCloudProjects(); }, [user, loadCloudProjects]);

  // Auto-load project from ?load= URL param (e.g. from Projects page)
  useEffect(() => {
    if (urlLoadId && user) { loadCloudProject(urlLoadId); }
  }, [urlLoadId, user, loadCloudProject]);

  // Keyboard shortcuts (must be after saveProjectLocal is defined)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveProjectLocal(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "h") { e.preventDefault(); setFindReplaceOpen((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); e.stopPropagation(); setCmdPaletteOpen((v) => !v); setCmdSearch(""); }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !(e.target as HTMLElement).closest("input, textarea")) { e.preventDefault(); setCmdPaletteOpen(true); setCmdSearch(""); }
      if (e.key === "Escape") { setContextMenu(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, saveProjectLocal]);

  // ── Autosave + session recovery ──────────────────────────────────────────
  // Debounced localStorage snapshot 5s after every workbook change — captures
  // work-in-progress between manual saves. Separate key from chartStudio_current
  // so we can compare timestamps on next page load.
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(() => {
      try {
        const payload = { project, savedAt: new Date().toISOString(), name: effectiveSettings?.title || "Untitled" };
        localStorage.setItem("chartStudio_autosave", JSON.stringify(payload));
      } catch { /* quota exceeded — silently skip */ }
    }, 5000);
    return () => clearTimeout(t);
  }, [project, effectiveSettings?.title]);

  // On first mount only: if an autosave is newer than the last manual save,
  // surface a toast offering to restore it.
  const autosaveCheckedRef = useRef(false);
  useEffect(() => {
    if (autosaveCheckedRef.current) return;
    autosaveCheckedRef.current = true;
    if (urlLoadId || urlChartType) return; // user explicitly loaded something
    try {
      const autoRaw = localStorage.getItem("chartStudio_autosave");
      if (!autoRaw) return;
      const auto = JSON.parse(autoRaw);
      const curRaw = localStorage.getItem("chartStudio_current");
      const cur = curRaw ? JSON.parse(curRaw) : null;
      const autoTime = new Date(auto.savedAt || 0).getTime();
      const curTime = cur ? new Date(cur.savedAt || 0).getTime() : 0;
      if (autoTime <= curTime + 10_000) return; // not newer than a manual save
      const secs = Math.round((Date.now() - autoTime) / 1000);
      const ago = secs < 60 ? `${secs}s ago` : secs < 3600 ? `${Math.round(secs / 60)}m ago` : `${Math.round(secs / 3600)}h ago`;
      toast("Recover unsaved autosave?", {
        description: `"${auto.name || "Untitled"}" — autosaved ${ago}`,
        duration: 15000,
        action: {
          label: "Restore",
          onClick: () => {
            try {
              const proj = auto.project ?? auto; // tolerate old format
              setProject(proj);
              setShowWelcome(false);
              toast.success("Autosave restored");
            } catch { toast.error("Autosave is corrupted"); }
          },
        },
      });
    } catch { /* ignore parse errors */ }
  }, [urlLoadId, urlChartType, setProject]);

  // Export project as JSON file
  const exportProjectJSON = useCallback(() => {
    if (!project) return;
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${effectiveSettings!.title || "chart-studio"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Project exported as JSON");
  }, [project]);

  // Import project from JSON file
  const importProjectJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (json.columns && json.rows && json.graphSettings) {
          setProject(json);
          setShowWelcome(false);
          toast.success(`Loaded project: ${json.graphSettings?.title || "Untitled"}`);
        } else { toast.error("Invalid project file"); }
      } catch { toast.error("Failed to parse project file"); }
    };
    reader.readAsText(file); e.target.value = "";
  }, []);

  // Unified export from dialog
  const doExport = useCallback(() => {
    if (exportFormat === "json") { exportProjectJSON(); setExportDialogOpen(false); return; }
    if (exportFormat === "svg") { exportSVG(); setExportDialogOpen(false); return; }

    const svg = document.getElementById("chart-studio-svg");
    if (!svg) { toast.error("Switch to Graph tab first"); setExportDialogOpen(false); return; }
    let str = new XMLSerializer().serializeToString(svg);
    // For transparent export, remove the background rect
    if (exportTransparent) {
      // Remove the first <rect> that fills the entire SVG (the background)
      str = str.replace(/<rect[^>]*width="[^"]*"[^>]*height="[^"]*"[^>]*fill="[^"]*"[^>]*rx="[^"]*"[^>]*\/>/, "");
      // Also set SVG background to transparent
      str = str.replace(/background:\s*#[a-fA-F0-9]+/, "background: transparent");
      str = str.replace(/background:\s*rgb[^;]+/, "background: transparent");
    }
    const svgW = project?.graphSettings.chartWidth || 740;
    const svgH = project?.graphSettings.chartHeight || 520;
    const scale = exportDPISel / 96;
    const c = document.createElement("canvas");
    c.width = Math.round(svgW * scale); c.height = Math.round(svgH * scale);
    const ctx = c.getContext("2d")!;
    const img = new Image();
    img.onload = async () => {
      if (!exportTransparent) { ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      if (exportFormat === "pdf") {
        try {
          const { default: jsPDF } = await import("jspdf");
          const orientation = svgW > svgH ? "landscape" : "portrait";
          const pdf = new jsPDF({ orientation, unit: "px", format: [svgW, svgH] });
          const imgData = c.toDataURL(exportTransparent ? "image/png" : "image/jpeg", 0.95);
          pdf.addImage(imgData, exportTransparent ? "PNG" : "JPEG", 0, 0, svgW, svgH);
          pdf.save(`${project?.graphSettings.title || "chart"}.pdf`);
          toast.success("Exported PDF!");
        } catch {
          const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "chart.png"; a.click();
          toast.success("Exported as PNG (PDF fallback)");
        }
      } else {
        const a = document.createElement("a");
        a.href = c.toDataURL("image/png");
        a.download = `${project?.graphSettings.title || "chart"}.png`;
        a.click();
        toast.success(`Exported PNG at ${exportDPISel} DPI${exportTransparent ? " (transparent)" : ""} — ${c.width}×${c.height}px`);
      }
      setExportDialogOpen(false);
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(str)));
  }, [exportFormat, exportDPISel, exportTransparent, project, exportSVG, exportProjectJSON]);

  const activeGraphSheet = project?.graphSettings;
  const rowCount = project?.rows.length ?? 0;
  const colCount = project?.columns.length ?? 0;

  if (!project) {
    return (
      <TooltipProvider>
        <div className="cs-app h-screen flex flex-col overflow-hidden relative">
          <style>{studioStyles}</style>
          <SEOHead title="Chart Studio - Free Scientific Graphs | BioSketch" description="Create publication-quality scientific charts. Free GraphPad Prism alternative." canonical="https://biosketch.art/chart-studio" />
          {/* Ambient blobs */}
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="cs-blob absolute -top-32 -left-32 w-[500px] h-[500px] bg-slate-300/20 rounded-full blur-3xl" />
            <div className="cs-blob absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-blue-200/15 rounded-full blur-3xl" style={{ animationDelay: "5s" }} />
          </div>
          <div className="cs-topbar cs-glass">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", color: "#1e293b" }}>Chart Studio</span>
          </div>
          <WelcomeDialog open={showWelcome} onCreate={handleCreate} onClose={() => { setShowWelcome(false); if (!project) setProject(createDefaultProject("column")); }} />
        </div>
      </TooltipProvider>
    );
  }

  const chartTypeIcons: Record<string, any> = {
    xy: ScatterChart, correlation: TrendingUp, column: BarChart3, grouped: BarChart3, "stacked-bar": BarChart3,
    box: BoxSelect, violin: LineChart, histogram: BarChart3, "dot-strip": ScatterChart,
    "before-after": LineChart, waterfall: BarChart3, "qq-plot": ScatterChart,
    area: LineChart, survival: TrendingUp, "dose-response": Activity,
    roc: Target, volcano: Zap, forest: Rows, "bland-altman": Target,
    heatmap: Grid3X3, bubble: ScatterChart, radar: Target, ecdf: TrendingUp,
    spaghetti: LineChart, lollipop: BarChart3, ridgeline: LineChart,
    funnel: Target, "parts-of-whole": PieChart,
  };

  return (
    <TooltipProvider>
      <div className="cs-app h-screen flex flex-col overflow-hidden relative">
        <style>{studioStyles}</style>
        <SEOHead title="Chart Studio - Free Scientific Graphs | BioSketch" description="Create publication-quality scientific charts. Free GraphPad Prism alternative." canonical="https://biosketch.art/chart-studio" />
        <input id="csv-upload" type="file" accept=".csv,.tsv,.txt" onChange={handleCSV} className="hidden" />
        <input id="json-upload" type="file" accept=".json" onChange={importProjectJSON} className="hidden" />

        {/* Ambient blobs */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="cs-blob absolute -top-32 -left-32 w-[500px] h-[500px] bg-slate-300/20 rounded-full blur-3xl" />
          <div className="cs-blob absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-blue-200/15 rounded-full blur-3xl" style={{ animationDelay: "5s" }} />
        </div>

        {/* ═══ Top Bar (glass) ═══ */}
        <div className="cs-topbar cs-glass shrink-0">
          <Tooltip><TooltipTrigger asChild>
            <button onClick={() => navigate("/")} className="cs-tool-btn" style={{ borderRadius: 8 }}><ArrowLeft className="h-4 w-4" /></button>
          </TooltipTrigger><TooltipContent side="bottom">Back to Home</TooltipContent></Tooltip>
          <div style={{ width: 1, height: 20, background: "rgba(148,163,184,0.3)" }} />
          <BarChart3 className="h-4 w-4 text-slate-400" />
          {titleEditing ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => {
                const v = titleDraft.trim();
                if (v && v !== (effectiveSettings?.title || "")) updateGraphSetting("title", v);
                setTitleEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.currentTarget.blur(); }
                else if (e.key === "Escape") { setTitleDraft(effectiveSettings?.title || ""); setTitleEditing(false); }
              }}
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#1e293b",
                fontFamily: "inherit",
                background: "white",
                border: "1px solid #94a3b8",
                borderRadius: 4,
                padding: "1px 6px",
                outline: "none",
                minWidth: 140,
              }}
            />
          ) : (
            <button
              type="button"
              title="Click to rename"
              onClick={() => { setTitleDraft(effectiveSettings?.title || ""); setTitleEditing(true); }}
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#1e293b",
                cursor: "text",
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: 4,
                padding: "1px 6px",
                fontFamily: "inherit",
                transition: "background 120ms, border-color 120ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(148,163,184,0.18)"; e.currentTarget.style.borderColor = "rgba(148,163,184,0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
            >
              {effectiveSettings!.title || "Untitled"}
            </button>
          )}
          <div style={{ width: 1, height: 20, background: "rgba(148,163,184,0.2)", margin: "0 4px" }} />
          {/* ── Top-level menus (File, Edit, Data, Analysis, Format, View) ── */}
          {[
            { label: "File", items: [
              { label: "New Project…", icon: Plus, action: () => { setProject(null); setShowWelcome(true); }, extra: "" },
              { label: "Open Project…", icon: Upload, action: () => document.getElementById("json-upload")?.click(), extra: "" },
              { label: "Import CSV…", icon: Upload, action: () => document.getElementById("csv-upload")?.click(), extra: "" },
              { label: "─", icon: null, action: () => {}, extra: "" },
              { label: user ? "Save Project" : "Save Locally", icon: Download, action: saveProjectLocal, extra: "Ctrl+S" },
              { label: "Load Last Saved", icon: Upload, action: loadProjectLocal, extra: "" },
              { label: "─", icon: null, action: () => {}, extra: "" },
              { label: "Export as SVG", icon: ImageIcon, action: exportSVG, extra: "" },
              { label: "Export as PNG", icon: Download, action: exportPNG, extra: "" },
              { label: "Export as PDF", icon: Download, action: exportPDF, extra: "" },
              { label: "Export as JSON", icon: Download, action: exportProjectJSON, extra: "" },
              { label: "─", icon: null, action: () => {}, extra: "" },
              { label: "Export for Nature", icon: Download, action: () => exportForJournal("nature"), extra: "" },
              { label: "Export for Science", icon: Download, action: () => exportForJournal("science"), extra: "" },
              { label: "Export for Cell", icon: Download, action: () => exportForJournal("cell"), extra: "" },
              { label: "─", icon: null, action: () => {}, extra: "" },
              { label: "Open in Canvas (editable)", icon: ImageIcon, action: addToCanvas, extra: "" },
            ]},
            { label: "Edit", items: [
              { label: "Undo", icon: Undo2, action: undo, extra: "Ctrl+Z" },
              { label: "Redo", icon: Redo2, action: redo, extra: "Ctrl+Y" },
              { label: "─", icon: null, action: () => {}, extra: "" },
              { label: "Add Column", icon: Columns, action: onAddColumn, extra: "" },
              { label: "Add Row", icon: Rows, action: onAddRow, extra: "" },
              { label: "Transpose (Rows ↔ Columns)", icon: Rows, action: onTranspose, extra: "" },
            ]},
            { label: "Data", items: "cascading" as any },
            { label: "Analysis", items: [
              { label: "Descriptive Statistics", icon: FlaskConical, action: () => { setAnalysisAutoTest("descriptive"); setActiveTab("results"); }, extra: "" },
              { label: "─", icon: null, action: () => {}, extra: "" },
              { label: "Unpaired t-test…", icon: FlaskConical, action: () => { setAnalysisAutoTest("unpaired-t"); setActiveTab("results"); }, extra: "" },
              { label: "Paired t-test…", icon: FlaskConical, action: () => { setAnalysisAutoTest("paired-t"); setActiveTab("results"); }, extra: "" },
              { label: "Mann-Whitney U…", icon: FlaskConical, action: () => { setAnalysisAutoTest("mann-whitney"); setActiveTab("results"); }, extra: "" },
              { label: "One-Way ANOVA…", icon: FlaskConical, action: () => { setAnalysisAutoTest("one-way-anova"); setActiveTab("results"); }, extra: "" },
              { label: "Kruskal-Wallis…", icon: FlaskConical, action: () => { setAnalysisAutoTest("kruskal-wallis"); setActiveTab("results"); }, extra: "" },
              { label: "Pearson Correlation…", icon: FlaskConical, action: () => { setAnalysisAutoTest("pearson-corr"); setActiveTab("results"); }, extra: "" },
              { label: "Linear Regression…", icon: FlaskConical, action: () => { setAnalysisAutoTest("linear-reg"); setActiveTab("results"); }, extra: "" },
              { label: "Normality Test…", icon: FlaskConical, action: () => { setAnalysisAutoTest("normality"); setActiveTab("results"); }, extra: "" },
              { label: "── Regression ──", icon: null, action: () => {}, extra: "" },
              { label: "Multiple Linear Regression…", icon: FlaskConical, action: () => { setAnalysisAutoTest("multiple-linear-reg"); setActiveTab("results"); }, extra: "" },
              { label: "Logistic Regression…", icon: FlaskConical, action: () => { setAnalysisAutoTest("multiple-logistic-reg"); setActiveTab("results"); }, extra: "" },
              { label: "Poisson Regression…", icon: FlaskConical, action: () => { setAnalysisAutoTest("poisson-reg"); setActiveTab("results"); }, extra: "" },
              { label: "Cox Regression…", icon: FlaskConical, action: () => { setAnalysisAutoTest("cox-reg"); setActiveTab("results"); }, extra: "" },
              { label: "── Multivariate ──", icon: null, action: () => {}, extra: "" },
              { label: "PCA Analysis…", icon: FlaskConical, action: () => { setAnalysisAutoTest("pca"); setActiveTab("results"); }, extra: "" },
              { label: "K-Means Clustering…", icon: FlaskConical, action: () => { setAnalysisAutoTest("kmeans"); setActiveTab("results"); }, extra: "" },
              { label: "Hierarchical Clustering…", icon: FlaskConical, action: () => { setAnalysisAutoTest("hierarchical-cluster"); setActiveTab("results"); }, extra: "" },
              { label: "── Other ──", icon: null, action: () => {}, extra: "" },
              { label: "Power Analysis…", icon: FlaskConical, action: () => { setAnalysisAutoTest("power-analysis"); setActiveTab("results"); }, extra: "" },
              { label: "Dose-Response (4PL)…", icon: FlaskConical, action: () => { setAnalysisAutoTest("dose-response-analysis"); setActiveTab("results"); }, extra: "" },
            ]},
            { label: "Format", items: [
              { label: "Graph Properties…", icon: Palette, action: () => { setFormatOpen(true); setActiveTab("graph"); }, extra: "" },
            ]},
            { label: "View", items: [
              { label: "Data Table", icon: FileSpreadsheet, action: () => setActiveTab("data"), extra: "" },
              { label: "Graph", icon: BarChart3, action: () => setActiveTab("graph"), extra: "" },
              { label: "Results", icon: FlaskConical, action: () => setActiveTab("results"), extra: "" },
            ]},
          ].map((menu) => {
            // Data menu gets cascading submenus
            if (menu.items === ("cascading" as any)) {
              const dataSubmenus = [
                { label: "Arithmetic", items: [
                  { label: "Multiply by Constant…", action: () => { setTransformValue(1); setTransformDialog({ open: true, type: "multiply" }); } },
                  { label: "Divide by Constant…", action: () => { setTransformValue(1); setTransformDialog({ open: true, type: "divide" }); } },
                  { label: "Add Constant…", action: () => { setTransformValue(0); setTransformDialog({ open: true, type: "add" }); } },
                  { label: "Subtract Constant…", action: () => { setTransformValue(0); setTransformDialog({ open: true, type: "subtract" }); } },
                  { label: "Reciprocal (1/x)…", action: () => setTransformDialog({ open: true, type: "reciprocal" }) },
                  { label: "Absolute Value…", action: () => setTransformDialog({ open: true, type: "abs" }) },
                  { label: "Negate (×−1)…", action: () => setTransformDialog({ open: true, type: "negate" }) },
                  { label: "Round to N Decimals…", action: () => { setTransformValue(2); setTransformDialog({ open: true, type: "round" }); } },
                ]},
                { label: "Log & Power", items: [
                  { label: "Log₁₀…", action: () => setTransformDialog({ open: true, type: "log10" }) },
                  { label: "Log₂…", action: () => setTransformDialog({ open: true, type: "log2" }) },
                  { label: "Ln (natural log)…", action: () => setTransformDialog({ open: true, type: "ln" }) },
                  { label: "Square Root…", action: () => setTransformDialog({ open: true, type: "sqrt" }) },
                  { label: "Power (x^n)…", action: () => { setTransformValue(2); setTransformDialog({ open: true, type: "power" }); } },
                  { label: "Box-Cox (auto λ)…", action: () => setTransformDialog({ open: true, type: "boxcox" }) },
                  { label: "─" },
                  { label: "Antilog₁₀ (10^x)…", action: () => setTransformDialog({ open: true, type: "antilog10" }) },
                  { label: "Antilog₂ (2^x)…", action: () => setTransformDialog({ open: true, type: "antilog2" }) },
                  { label: "Antilog e (e^x)…", action: () => setTransformDialog({ open: true, type: "antiloge" }) },
                ]},
                { label: "Scaling", items: [
                  { label: "Normalize (0–1)…", action: () => setTransformDialog({ open: true, type: "normalize" }) },
                  { label: "Min-Max Custom Range…", action: () => { setTransformValue(100); setTransformDialog({ open: true, type: "minmaxcustom" }); } },
                  { label: "Z-Score…", action: () => setTransformDialog({ open: true, type: "zscore" }) },
                  { label: "Robust Z-Score (MAD)…", action: () => setTransformDialog({ open: true, type: "robustzscore" }) },
                  { label: "Quantile Normalization…", action: () => setTransformDialog({ open: true, type: "quantilenorm" }) },
                  { label: "Log-ratio to Reference…", action: () => { setTransformValue(0); setTransformDialog({ open: true, type: "logratio" }); } },
                  { label: "─" },
                  { label: "Subtract Baseline…", action: () => setTransformDialog({ open: true, type: "baseline" }) },
                  { label: "% of Column Total…", action: () => setTransformDialog({ open: true, type: "pctoftotal" }) },
                  { label: "Percentile Rank…", action: () => setTransformDialog({ open: true, type: "percentilerank" }) },
                  { label: "Rank Values…", action: () => setTransformDialog({ open: true, type: "rank" }) },
                  { label: "Cumulative Sum…", action: () => setTransformDialog({ open: true, type: "cumsum" }) },
                  { label: "Running Average…", action: () => { setTransformValue(3); setTransformDialog({ open: true, type: "runningavg" }); } },
                  { label: "Delta (Δ from prev)…", action: () => setTransformDialog({ open: true, type: "delta" }) },
                ]},
                { label: "Missing Data", items: [
                  { label: "Fill Blanks with Mean…", action: () => setTransformDialog({ open: true, type: "fill-mean" }) },
                  { label: "Fill Blanks with Median…", action: () => setTransformDialog({ open: true, type: "fill-median" }) },
                  { label: "Fill Blanks with Zero…", action: () => setTransformDialog({ open: true, type: "fill-zero" }) },
                  { label: "Interpolate Missing…", action: () => setTransformDialog({ open: true, type: "interpolate" }) },
                  { label: "─" },
                  { label: "Remove Rows with Blanks…", action: () => setTransformDialog({ open: true, type: "remove-blank-rows" }) },
                  { label: "Remove Outliers (2σ)…", action: () => setTransformDialog({ open: true, type: "remove-outliers-2sd" }) },
                  { label: "Remove Outliers (3σ)…", action: () => setTransformDialog({ open: true, type: "remove-outliers-3sd" }) },
                  { label: "Remove Outliers (IQR)…", action: () => setTransformDialog({ open: true, type: "remove-outliers-iqr" }) },
                ]},
                { label: "Column Operations", items: [
                  { label: "Difference (A − B)…", action: () => setColOpDialog({ open: true, op: "diff" }) },
                  { label: "Ratio (A / B)…", action: () => setColOpDialog({ open: true, op: "ratio" }) },
                  { label: "Fold Change (log₂)…", action: () => setColOpDialog({ open: true, op: "foldchange" }) },
                ]},
                { label: "Domain-Specific", items: [
                  { label: "ΔΔCt (qPCR)…", action: () => { setTransformValue(0); setTransformDialog({ open: true, type: "ddct" }); } },
                  { label: "% Inhibition from Control…", action: () => setTransformDialog({ open: true, type: "pctinhibition" }) },
                  { label: "% Change from First…", action: () => setTransformDialog({ open: true, type: "pctchangefromfirst" }) },
                  { label: "─" },
                  { label: "AUC (trapezoidal)…", action: () => setTransformDialog({ open: true, type: "auc" }) },
                  { label: "Survival Censoring (→ 0/1)…", action: () => setTransformDialog({ open: true, type: "survivalcensor" }) },
                ]},
              ];
              const flyoutStyle: React.CSSProperties = { background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(226,232,240,0.8)", borderRadius: 10, boxShadow: "0 8px 32px -8px rgba(15,23,42,0.12)", padding: "4px 0", width: 200 };
              const subItemStyle: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", fontSize: 11, fontWeight: 500, color: "#334155", textAlign: "left", background: "none", border: "none", cursor: "default", borderRadius: 6, transition: "all 0.1s" };
              return (
                <div key="Data" className="relative group/menu">
                  <button className="cs-tool-btn" style={{ fontSize: 12, fontWeight: 500, padding: "0 8px", height: 28 }}>Data</button>
                  <div className="absolute top-full left-0 py-1 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50" style={{ ...flyoutStyle, marginTop: 2, width: 190 }}>
                    {dataSubmenus.map((sub) => (
                      <div key={sub.label} className="relative group/sub">
                        <div style={{ ...subItemStyle, fontWeight: 600 }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(15,23,42,0.05)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
                          <FlaskConical style={{ width: 14, height: 14, color: "#94a3b8" }} />
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          <ChevronRight style={{ width: 12, height: 12, color: "#94a3b8" }} />
                        </div>
                        {/* Flyout submenu */}
                        <div className="absolute left-full top-0 ml-1 opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all z-50" style={flyoutStyle}>
                          {sub.items.map((item, j) =>
                            item.label === "─" ? (
                              <div key={j} style={{ height: 1, background: "rgba(226,232,240,0.6)", margin: "3px 8px" }} />
                            ) : (
                              <button key={item.label} onClick={item.action} style={subItemStyle}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(15,23,42,0.05)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}>
                                <span>{item.label}</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            // Standard menus
            return (
            <div key={menu.label} className="relative group/menu">
              <button className="cs-tool-btn" style={{ fontSize: 12, fontWeight: 500, padding: "0 8px", height: 28 }}>{menu.label}</button>
              <div className="absolute top-full left-0 py-1 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(226,232,240,0.8)", borderRadius: 12, boxShadow: "0 8px 32px -8px rgba(15,23,42,0.12)", marginTop: 2, width: 240 }}>
                {(menu.items as any[]).map((item: any, idx: number) =>
                  item.label === "─" ? (
                    <div key={idx} style={{ height: 1, background: "rgba(226,232,240,0.6)", margin: "3px 10px" }} />
                  ) : (
                    <button key={item.label} onClick={item.action} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", fontSize: 11, fontWeight: 500, color: "#334155", textAlign: "left", background: "none", border: "none", cursor: "default", borderRadius: 6, transition: "all 0.1s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,23,42,0.05)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                      {item.icon && <item.icon style={{ width: 14, height: 14, color: "#94a3b8" }} />}
                      {!item.icon && <span style={{ width: 14 }} />}
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.extra && <span style={{ fontSize: 10, color: "#94a3b8" }}>{item.extra}</span>}
                    </button>
                  )
                )}
              </div>
            </div>
            );
          })}
          <div className="flex-1" />
          {/* File actions */}
          <Tooltip><TooltipTrigger asChild><button onClick={() => { setProject(null); setShowWelcome(true); }} className="cs-tool-btn"><Plus className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent side="bottom">New Project</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><button onClick={saveProjectLocal} className="cs-tool-btn"><Download className="h-3.5 w-3.5" /><span>Save</span></button></TooltipTrigger><TooltipContent side="bottom">Save (Ctrl+S)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><button onClick={() => setExportDialogOpen(true)} className="cs-tool-btn"><ImageIcon className="h-3.5 w-3.5" /><span>Export</span></button></TooltipTrigger><TooltipContent side="bottom">Export chart</TooltipContent></Tooltip>
          {lastSaved && <span style={{ fontSize: 9, color: "#94a3b8" }}>Saved {lastSaved.toLocaleTimeString()}</span>}
          <div style={{ width: 1, height: 20, background: "rgba(148,163,184,0.3)" }} />
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {avatarUrl && <img src={avatarUrl} alt="" style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid rgba(226,232,240,0.8)" }} />}
              <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{displayName}</span>
            </div>
          ) : (
            <button onClick={() => navigate("/auth")} style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>Sign in</button>
          )}
        </div>

        {/* ═══ Toolbar (glass, centered) ═══ */}
        {/* ═══ Toolbar (glass, centered) ═══ */}
        <div className="cs-toolbar cs-glass shrink-0">
          <Tooltip><TooltipTrigger asChild><button onClick={undo} disabled={undoStack.length === 0} className="cs-tool-btn"><Undo2 className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><button onClick={redo} disabled={redoStack.length === 0} className="cs-tool-btn"><Redo2 className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent side="bottom">Redo (Ctrl+Y)</TooltipContent></Tooltip>
          <div className="cs-tool-sep" />
          <label className="cursor-pointer"><input type="file" accept=".csv,.tsv,.txt" onChange={handleCSV} className="hidden" /><span className="cs-tool-btn cursor-pointer"><Upload className="h-3.5 w-3.5" /><span>Import</span></span></label>
          {user && (
            <>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => { const name = prompt("Save dataset as:", effectiveSettings?.title || "Untitled"); if (name) saveDatasetToCloud(name); }} className="cs-tool-btn">
                  <Download className="h-3.5 w-3.5" /><span>Save Data</span>
                </button>
              </TooltipTrigger><TooltipContent side="bottom">Save current data as reusable dataset</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => { const name = prompt("Save graph preset as:", effectiveSettings?.title || "Untitled"); if (name) saveGraphPreset(name); }} className="cs-tool-btn">
                  <ImageIcon className="h-3.5 w-3.5" /><span>Save Graph</span>
                </button>
              </TooltipTrigger><TooltipContent side="bottom">Save current chart settings as reusable preset</TooltipContent></Tooltip>
            </>
          )}
          <div className="cs-tool-sep" />
          <Tooltip><TooltipTrigger asChild><button onClick={onAddColumn} className="cs-tool-btn"><Columns className="h-3.5 w-3.5" /><span>+Col</span></button></TooltipTrigger><TooltipContent side="bottom">Add Column</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><button onClick={onAddRow} className="cs-tool-btn"><Rows className="h-3.5 w-3.5" /><span>+Row</span></button></TooltipTrigger><TooltipContent side="bottom">Add Row</TooltipContent></Tooltip>
          <div className="cs-tool-sep" />

          {/* Chart type switcher — all 28 types via dropdown */}
          {activeGraphSheet && (
            <>
              <select
                value={effectiveSettings!.chartType}
                onChange={(e) => setChartSwitchSetup(e.target.value as ChartType)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 6px", borderRadius: 4,
                  border: "1px solid #cbd5e1", background: "#f8fafc", color: "#1e293b",
                  cursor: "pointer", fontFamily: "'Segoe UI', Inter, sans-serif", maxWidth: 160,
                }}
              >
                <optgroup label="Common">
                  <option value="xy">XY (Scatter)</option>
                  <option value="correlation">Correlation Plot</option>
                  <option value="column">Column</option>
                  <option value="grouped">Grouped</option>
                  <option value="stacked-bar">Stacked Bar</option>
                  <option value="box">Box &amp; Whisker</option>
                  <option value="violin">Violin Plot</option>
                  <option value="histogram">Histogram</option>
                </optgroup>
                <optgroup label="Individual / Paired">
                  <option value="dot-strip">Dot/Strip Plot</option>
                  <option value="before-after">Before-After</option>
                  <option value="spaghetti">Spaghetti Plot</option>
                </optgroup>
                <optgroup label="Distribution">
                  <option value="ridgeline">Ridgeline Plot</option>
                  <option value="ecdf">ECDF</option>
                  <option value="qq-plot">QQ Plot</option>
                </optgroup>
                <optgroup label="Lines / Area">
                  <option value="area">Area Chart</option>
                  <option value="lollipop">Lollipop Chart</option>
                  <option value="waterfall">Waterfall</option>
                </optgroup>
                <optgroup label="Matrix / Multi">
                  <option value="heatmap">Heatmap</option>
                  <option value="bubble">Bubble Plot</option>
                  <option value="radar">Radar/Spider</option>
                  <option value="parts-of-whole">Parts of Whole</option>
                </optgroup>
                <optgroup label="Clinical / Biostat">
                  <option value="survival">Survival (Kaplan-Meier)</option>
                  <option value="dose-response">Dose-Response</option>
                  <option value="roc">ROC Curve</option>
                  <option value="volcano">Volcano Plot</option>
                  <option value="forest">Forest Plot</option>
                  <option value="bland-altman">Bland-Altman</option>
                  <option value="funnel">Funnel Plot</option>
                </optgroup>
              </select>
              <div className="cs-tool-sep" />
              <button onClick={() => { setFormatOpen(true); setActiveTab("graph"); }} className={cn("cs-tool-btn", formatOpen && "cs-tool-btn-active")}>
                <Palette className="h-3.5 w-3.5" /><span>Format</span>
              </button>
              <button onClick={() => setActiveTab("results")} className="cs-tool-btn">
                <FlaskConical className="h-3.5 w-3.5" /><span>Analyze</span>
              </button>
              {/* Layout button — signed-in only */}
              {user && (
                <div className="relative group/layout" style={{ marginLeft: 2 }}>
                  <button className={cn("cs-tool-btn", project?.layout && "cs-tool-btn-active")}>
                    <Grid3X3 className="h-3.5 w-3.5" /><span>Layout</span>
                  </button>
                  <div className="absolute top-full left-0 mt-1 z-50 opacity-0 invisible group-hover/layout:opacity-100 group-hover/layout:visible transition-all"
                    style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", padding: 6, width: 220 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", padding: "2px 8px", letterSpacing: "0.06em" }}>Page Layout</div>
                    {([
                      { mode: "single" as LayoutMode, label: "Single Graph", desc: "Default" },
                      { mode: "inset" as LayoutMode, label: "Main + Inset", desc: "Small graph overlaid" },
                      { mode: "2-up" as LayoutMode, label: "2-Up Horizontal", desc: "Side by side" },
                      { mode: "2-up-vertical" as LayoutMode, label: "2-Up Vertical", desc: "Stacked" },
                      { mode: "3-up" as LayoutMode, label: "3-Up", desc: "1 wide + 2 below" },
                      { mode: "4-up" as LayoutMode, label: "4-Up Grid", desc: "2×2 grid" },
                    ] as const).map(({ mode, label, desc }) => (
                      <button key={mode} onClick={() => activateLayout(mode)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "5px 8px", fontSize: 11,
                          fontWeight: (project?.layout?.mode || "single") === mode ? 700 : 500, textAlign: "left", border: "none", borderRadius: 3, cursor: "default",
                          background: (project?.layout?.mode || "single") === mode ? "#dbeafe" : "transparent",
                          color: (project?.layout?.mode || "single") === mode ? "#1e40af" : "#334155",
                        }}>
                        {label} <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: "auto" }}>{desc}</span>
                      </button>
                    ))}
                    {project?.layout && (
                      <>
                        <div style={{ borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", padding: "2px 8px" }}>Labels</div>
                        <div style={{ padding: "2px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
                          <input placeholder="Page label (e.g. Figure 1)" value={project.layout.pageLabel} onChange={(e) => commit((p) => ({ ...p, layout: p.layout ? { ...p.layout, pageLabel: e.target.value } : undefined }))}
                            style={{ width: "100%", fontSize: 10, padding: "3px 6px", border: "1px solid #d1d5db", borderRadius: 3, outline: "none" }} />
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#475569", cursor: "default" }}>
                            <input type="checkbox" checked={project.layout.showPanelLabels} onChange={(e) => commit((p) => ({ ...p, layout: p.layout ? { ...p.layout, showPanelLabels: e.target.checked } : undefined }))} style={{ width: 12, height: 12 }} />
                            Show panel labels
                          </label>
                          <div style={{ display: "flex", gap: 3 }}>
                            {(["uppercase", "lowercase", "number"] as const).map((s) => (
                              <button key={s} onClick={() => commit((p) => ({ ...p, layout: p.layout ? { ...p.layout, panelLabelStyle: s } : undefined }))}
                                style={{ flex: 1, fontSize: 9, fontWeight: 600, padding: "2px 0", borderRadius: 3, border: `1px solid ${project.layout!.panelLabelStyle === s ? "#3b82f6" : "#d1d5db"}`, background: project.layout!.panelLabelStyle === s ? "#dbeafe" : "#fafafa", color: project.layout!.panelLabelStyle === s ? "#1e40af" : "#64748b", cursor: "default" }}>
                                {s === "uppercase" ? "A, B, C" : s === "lowercase" ? "a, b, c" : "1, 2, 3"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", padding: "2px 8px" }}>Orientation</div>
                        <div style={{ display: "flex", gap: 3, padding: "2px 8px" }}>
                          {(["landscape", "portrait"] as PageOrientation[]).map((o) => (
                            <button key={o} onClick={() => commit((p) => ({ ...p, layout: p.layout ? { ...p.layout, orientation: o } : undefined }))}
                              style={{ flex: 1, fontSize: 10, fontWeight: 600, padding: "3px 0", borderRadius: 3, textTransform: "capitalize", border: `1px solid ${project.layout!.orientation === o ? "#3b82f6" : "#d1d5db"}`, background: project.layout!.orientation === o ? "#dbeafe" : "#fafafa", color: project.layout!.orientation === o ? "#1e40af" : "#64748b", cursor: "default" }}>
                              {o}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {activeTab === "graph" && (
                <>
                  <div className="cs-tool-sep" />
                  <button onClick={() => setGraphZoom((z) => Math.max(25, z - 25))} className="cs-tool-btn" style={{ fontSize: 13, fontWeight: 700 }}>−</button>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", width: 36, textAlign: "center" }}>{graphZoom}%</span>
                  <button onClick={() => setGraphZoom((z) => Math.min(400, z + 25))} className="cs-tool-btn" style={{ fontSize: 13, fontWeight: 700 }}>+</button>
                </>
              )}
            </>
          )}

        </div>

        {/* ═══ Main Workspace ═══ */}
        <div className="flex-1 flex min-h-0 overflow-x-auto overflow-y-hidden">

          {/* ── Left side: pill rail + collapsible drawer ── */}
          <div className="flex shrink-0" style={{ margin: 8, zIndex: 10 }}>
            {/* Icon pill rail (always visible) */}
            <div className="cs-glass-strong flex flex-col items-center" style={{ width: 40, borderRadius: 16, padding: "8px 4px", gap: 4 }}>
              {[
                { id: "navigator" as const, Icon: LayoutDashboard, label: "Navigator" },
                { id: "datasets" as const, Icon: Database, label: "Datasets" },
                { id: "graphs" as const, Icon: BarChart3, label: "Graphs" },
              ].map(({ id, Icon, label }) => (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toggleLeftPill(id)}
                      className={cn(
                        "flex items-center justify-center",
                        activeLeftPill === id && "text-blue-700",
                      )}
                      style={{
                        width: 30, height: 30, padding: 0,
                        border: `1px solid ${activeLeftPill === id ? "#2563eb" : "transparent"}`,
                        background: activeLeftPill === id ? "#dbeafe" : "transparent",
                        color: activeLeftPill === id ? "#1e40af" : "#64748b",
                        borderRadius: 8, cursor: "default",
                      }}
                    ><Icon className="h-4 w-4" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Drawer for the active pill */}
            {activeLeftPill && (
              <div className="cs-glass-strong flex flex-col overflow-hidden" style={{ width: navWidth, minWidth: navWidth, marginLeft: 6, borderRadius: 16 }}>
                <div className="cs-props-header" style={{ borderRadius: "16px 16px 0 0", background: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{activeLeftPill === "navigator" ? "Navigator" : activeLeftPill === "datasets" ? "Datasets" : "Graphs"}</span>
                  <button onClick={() => toggleLeftPill(activeLeftPill)} title="Collapse panel" style={{ width: 20, height: 20, padding: 0, color: "#64748b", background: "none", border: "none", cursor: "default", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.08)"; e.currentTarget.style.color = "#1e40af"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#64748b"; }}><PanelLeftClose className="h-3.5 w-3.5" /></button>
                </div>

                {/* ── Navigator drawer ── */}
                {activeLeftPill === "navigator" && (
                  <div className="flex-1 overflow-y-auto py-1 flex flex-col">
                    <div>
                      <button onClick={() => setActiveTab("data")} className={cn("cs-nav-item", activeTab === "data" && "cs-nav-item-active")}>
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Data
                      </button>
                      <button onClick={() => { setActiveTab("graph"); setFormatOpen(true); }} className={cn("cs-nav-item", activeTab === "graph" && "cs-nav-item-active")}>
                        <BarChart3 className="h-3.5 w-3.5" /> Graph
                      </button>
                      <button onClick={() => setActiveTab("results")} className={cn("cs-nav-item", activeTab === "results" && "cs-nav-item-active")}>
                        <FlaskConical className="h-3.5 w-3.5" /> Analysis
                      </button>
                    </div>
                    {project?.layout && project.panels && (
                      <>
                        <div className="cs-props-header" style={{ marginTop: 4, fontSize: 9 }}>Panels</div>
                        {project.panels.map((pn, i) => (
                          <div key={pn.id} className="flex items-center gap-0.5">
                            <button
                              onClick={() => { commit((p) => ({ ...p, layout: p.layout ? { ...p.layout, activePanelId: pn.id } : undefined })); setActiveTab("data"); }}
                              className={cn("cs-nav-item flex-1", pn.id === project.layout!.activePanelId && "cs-nav-item-active")}
                              style={{ fontSize: 10, padding: "3px 8px" }}
                            >
                              <span style={{ fontWeight: 800, fontSize: 10, width: 14 }}>
                                {project.layout!.panelLabelStyle === "number" ? `${i + 1}` : project.layout!.panelLabelStyle === "lowercase" ? String.fromCharCode(97 + i) : String.fromCharCode(65 + i)}
                              </span>
                              <span className="truncate" style={{ fontSize: 9 }}>{pn.label}</span>
                              <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: "auto" }}>{pn.graphSettings.chartType}</span>
                            </button>
                            {/* Panel reorder — swap with neighbor; labels auto-renumber via index */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                              <button
                                disabled={i === 0}
                                onClick={(e) => { e.stopPropagation(); commit((p) => {
                                  if (!p.panels || i === 0) return p;
                                  const a = [...p.panels]; [a[i - 1], a[i]] = [a[i], a[i - 1]];
                                  return { ...p, panels: a };
                                }); }}
                                style={{ width: 14, height: 10, padding: 0, border: "none", background: "none", color: i === 0 ? "#e2e8f0" : "#94a3b8", cursor: i === 0 ? "default" : "pointer", fontSize: 7, lineHeight: "10px" }}
                                title="Move up"
                              >▲</button>
                              <button
                                disabled={i === project.panels!.length - 1}
                                onClick={(e) => { e.stopPropagation(); commit((p) => {
                                  if (!p.panels || i >= p.panels.length - 1) return p;
                                  const a = [...p.panels]; [a[i], a[i + 1]] = [a[i + 1], a[i]];
                                  return { ...p, panels: a };
                                }); }}
                                style={{ width: 14, height: 10, padding: 0, border: "none", background: "none", color: i === project.panels!.length - 1 ? "#e2e8f0" : "#94a3b8", cursor: i === project.panels!.length - 1 ? "default" : "pointer", fontSize: 7, lineHeight: "10px" }}
                                title="Move down"
                              >▼</button>
                            </div>
                          </div>
                        ))}
                        <div style={{ padding: "2px 8px" }}>
                          <input
                            value={activePanel?.label || ""}
                            onChange={(e) => { const val = e.target.value; commit((p) => ({ ...p, panels: p.panels?.map((pn) => pn.id === p.layout?.activePanelId ? { ...pn, label: val } : pn) })); }}
                            placeholder="Panel label"
                            style={{ width: "100%", fontSize: 9, padding: "2px 4px", border: "1px solid #e2e8f0", borderRadius: 3, outline: "none" }}
                          />
                        </div>
                      </>
                    )}
                    {user && cloudProjects.length > 0 && (
                      <>
                        <div className="cs-props-header" style={{ marginTop: 4 }}>Saved Projects</div>
                        <div style={{ maxHeight: 200, overflowY: "auto", padding: "2px 4px" }}>
                          {cloudProjects.map((cp) => (
                            <div key={cp.id} className="flex items-center gap-1"
                              onContextMenu={(e) => { e.preventDefault(); setProjectContextMenu({ x: e.clientX, y: e.clientY, projectId: cp.id }); }}>
                              <button onClick={() => loadCloudProject(cp.id)} className={cn("cs-nav-item flex-1", cloudProjectId === cp.id && "cs-nav-item-active")} style={{ fontSize: 10, padding: "3px 8px" }}>
                                <BarChart3 className="h-2.5 w-2.5" />
                                <span className="truncate">{cp.name}</span>
                              </button>
                              <button onClick={() => deleteCloudProject(cp.id)} style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 10, background: "none", border: "none", cursor: "default" }} title="Delete">×</button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {!user && (
                      <div style={{ padding: "6px 10px", fontSize: 10, color: "#94a3b8" }}>
                        <button onClick={() => navigate("/auth")} style={{ color: "#2563eb", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 10 }}>Sign in</button> to save projects to cloud
                      </div>
                    )}
                    {undoStack.length > 0 && (
                      <>
                        <div className="cs-props-header" style={{ marginTop: 4 }}>History ({undoStack.length})</div>
                        <div style={{ maxHeight: 140, overflowY: "auto", padding: "2px 4px" }}>
                          {undoStack.slice(-8).reverse().map((_, i) => (
                            <button key={i} onClick={() => {
                              const target = undoStack.length - 1 - i;
                              if (target >= 0 && target < undoStack.length) {
                                setRedoStack((r) => [...r, project!]);
                                setProject(undoStack[target]);
                                setUndoStack((u) => u.slice(0, target));
                              }
                            }} className="cs-nav-item" style={{ fontSize: 9, padding: "3px 8px", color: "#64748b" }}>
                              <Undo2 className="h-2.5 w-2.5" /> Step -{i + 1}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div style={{ flex: 1 }} />
                    <div style={{ borderTop: "1px solid rgba(226,232,240,0.5)", padding: 6 }}>
                      <button onClick={() => { setProject(null); setShowWelcome(true); }} className="cs-nav-item" style={{ color: "#2563eb", fontWeight: 600 }}>
                        <Plus className="h-3.5 w-3.5" /> New Project
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Datasets drawer ── */}
                {activeLeftPill === "datasets" && (
                  <div className="flex-1 overflow-y-auto py-1 flex flex-col">
                    {user ? (
                      <>
                        <div className="cs-props-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>Saved Datasets</span>
                          <button onClick={() => { const name = prompt("Save current data as:", effectiveSettings?.title || "Untitled"); if (name) saveDatasetToCloud(name); }}
                            style={{ fontSize: 9, color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>+ Save Current</button>
                        </div>
                        {project?.layout && <div style={{ fontSize: 9, color: "#16a34a", padding: "0 8px 4px", fontWeight: 600 }}>Click to load into {activePanel?.label || "active panel"}</div>}
                        <div style={{ overflowY: "auto", padding: "0 4px" }}>
                          {savedDatasets.length === 0 && <div style={{ fontSize: 10, color: "#94a3b8", padding: "8px 10px", lineHeight: 1.4 }}>No saved datasets yet. Import data then click "+ Save Current" to save for reuse.</div>}
                          {savedDatasets.map((ds) => (
                            <div key={ds.id} className="flex items-center gap-0.5" title={`${ds.col_count} columns, ${ds.row_count} rows — click to load`}>
                              <button onClick={() => loadDatasetIntoPanel(ds)} className="cs-nav-item flex-1" style={{ fontSize: 10, padding: "4px 8px" }}>
                                <Table className="h-3 w-3" style={{ flexShrink: 0 }} />
                                <span className="truncate">{ds.name}</span>
                                <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: "auto", flexShrink: 0 }}>{ds.row_count}×{ds.col_count}</span>
                              </button>
                              <button onClick={() => deleteSavedAsset("chart_studio_saved_datasets", ds.id)} style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 10, background: "none", border: "none", cursor: "default" }} title="Delete dataset">×</button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: "12px 10px", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                        <button onClick={() => navigate("/auth")} style={{ color: "#2563eb", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>Sign in</button> to save and reuse datasets across projects.
                      </div>
                    )}
                  </div>
                )}

                {/* ── Graphs drawer ── */}
                {activeLeftPill === "graphs" && (
                  <div className="flex-1 overflow-y-auto py-1 flex flex-col">
                    {user ? (
                      <>
                        <div className="cs-props-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>Saved Graphs</span>
                          <button onClick={() => { const name = prompt("Save current graph as:", effectiveSettings?.title || "Untitled"); if (name) saveGraphPreset(name); }}
                            style={{ fontSize: 9, color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>+ Save Current</button>
                        </div>
                        {project?.layout && <div style={{ fontSize: 9, color: "#16a34a", padding: "0 8px 4px", fontWeight: 600 }}>Click to load into {activePanel?.label || "active panel"}</div>}
                        <div style={{ overflowY: "auto", padding: "0 4px" }}>
                          {savedGraphPresets.length === 0 && <div style={{ fontSize: 10, color: "#94a3b8", padding: "8px 10px", lineHeight: 1.4 }}>No saved graphs yet. Create a chart then click "+ Save Current" to save for reuse.</div>}
                          {savedGraphPresets.map((gp) => (
                            <div key={gp.id} className="flex items-center gap-0.5" title={`${gp.chart_type} chart — click to load data + settings`}>
                              <button onClick={() => loadGraphPreset(gp)} className="cs-nav-item flex-1" style={{ fontSize: 10, padding: "4px 8px" }}>
                                <BarChart3 className="h-3 w-3" style={{ flexShrink: 0 }} />
                                <span className="truncate">{gp.name}</span>
                                <span style={{ fontSize: 8, color: "#94a3b8", marginLeft: "auto", flexShrink: 0 }}>{gp.chart_type}</span>
                              </button>
                              <button onClick={() => deleteSavedAsset("chart_studio_saved_graphs", gp.id)} style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 10, background: "none", border: "none", cursor: "default" }} title="Delete graph">×</button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: "12px 10px", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                        <button onClick={() => navigate("/auth")} style={{ color: "#2563eb", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: 11 }}>Sign in</button> to save and reuse graph presets.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Main content column ── */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ margin: "8px 0" }}>
                {/* Dataset tab bar (Excel-style workbook tabs) */}
                <div className="cs-dataset-tabs" style={{ display: "flex", alignItems: "flex-end", gap: 2, padding: "4px 8px 0", background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", overflowX: "auto", flexShrink: 0 }}>
                    {workbook.datasets.map((ds) => {
                      const active = ds.id === workbook.activeDatasetId;
                      return (
                        <div
                          key={ds.id}
                          onClick={() => activateDataset(ds.id)}
                          onDoubleClick={() => {
                            setPromptDialog({
                              title: "Rename Dataset",
                              label: "Dataset name",
                              defaultValue: ds.name,
                              onConfirm: (v) => renameDataset(ds.id, v),
                            });
                            setPromptValue(ds.name);
                          }}
                          onContextMenu={(e) => { e.preventDefault(); setDatasetContextMenu({ x: e.clientX, y: e.clientY, datasetId: ds.id }); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "4px 10px 5px",
                            fontSize: 11, fontWeight: active ? 700 : 500,
                            color: active ? "#1e293b" : "#64748b",
                            background: active ? "#ffffff" : "#e2e8f0",
                            border: "1px solid #cbd5e1",
                            borderBottom: active ? "1px solid #ffffff" : "1px solid #cbd5e1",
                            borderRadius: "4px 4px 0 0",
                            marginBottom: -1,
                            cursor: "default",
                            whiteSpace: "nowrap",
                            maxWidth: 180,
                            position: "relative",
                            top: active ? 1 : 0,
                          }}
                          title={ds.name}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ds.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (ds.rows.some((r) => r.some((v) => v !== null && v !== "")) || ds.graphs.length > 0 || ds.analyses.length > 0) {
                                if (!window.confirm(`Close "${ds.name}"? Unsaved data in this dataset will be lost.`)) return;
                              }
                              closeDatasetTab(ds.id);
                            }}
                            style={{ padding: 0, width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", borderRadius: 2, background: "transparent", border: "none" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#cbd5e1"; e.currentTarget.style.color = "#1e293b"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
                            title="Close"
                          ><X className="h-2.5 w-2.5" /></button>
                        </div>
                      );
                    })}
                    <button
                      onClick={addNewDatasetTab}
                      title="New dataset tab"
                      style={{ padding: "4px 10px 5px", fontSize: 12, fontWeight: 600, color: "#2563eb", background: "transparent", border: "1px dashed #cbd5e1", borderRadius: "4px 4px 0 0", marginBottom: -1, cursor: "default" }}
                    >+ {workbook.datasets.length === 0 ? "New dataset" : ""}</button>
                  </div>
                {/* ── Find & Replace bar (Ctrl+H) ── */}
                {findReplaceOpen && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(241,245,249,0.8)", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontFamily: "Inter, sans-serif" }}>
                    <span style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>Find</span>
                    <input
                      autoFocus
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      placeholder="Text to find…"
                      className="cs-props-input"
                      style={{ width: 140, height: 24, fontSize: 11 }}
                      onKeyDown={(e) => { if (e.key === "Escape") setFindReplaceOpen(false); }}
                    />
                    <span style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>Replace</span>
                    <input
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder="Replacement…"
                      className="cs-props-input"
                      style={{ width: 140, height: 24, fontSize: 11 }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setFindReplaceOpen(false);
                        if (e.key === "Enter" && findText) {
                          // Replace across title, xLabel, yLabel, column names — one undo entry
                          const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
                          const patch: Partial<GraphSettings> = {};
                          if (effectiveSettings!.title?.includes(findText)) patch.title = effectiveSettings!.title.replace(re, replaceText);
                          if (effectiveSettings!.xLabel?.includes(findText)) patch.xLabel = effectiveSettings!.xLabel.replace(re, replaceText);
                          if (effectiveSettings!.yLabel?.includes(findText)) patch.yLabel = effectiveSettings!.yLabel.replace(re, replaceText);
                          if (Object.keys(patch).length > 0) updateGraphSettings(patch);
                          // Column names
                          const newCols = effectiveColumns.map((c) => c.includes(findText) ? c.replace(re, replaceText) : c);
                          if (newCols.some((c, i) => c !== effectiveColumns[i])) {
                            commitPanel((pn) => ({ ...pn, columns: newCols }));
                          }
                          const count = [patch.title, patch.xLabel, patch.yLabel, ...newCols].filter((x) => x !== undefined && x !== null).length;
                          toast.success(`Replaced "${findText}" → "${replaceText}" in ${count} field(s)`);
                        }
                      }}
                    />
                    <button
                      onClick={() => setFindReplaceOpen(false)}
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "default", fontSize: 13, padding: "0 4px" }}
                      title="Close (Esc)"
                    >×</button>
                  </div>
                )}

                {activeTab === "data" && (
                  <>
                    <DataValidationStrip columns={effectiveColumns} rows={effectiveRows} />
                    <Spreadsheet columns={effectiveColumns} rows={effectiveRows} onCellChange={onCellChange} onColumnRename={onColumnRename} onAddColumn={onAddColumn} onRemoveColumn={onRemoveColumn} onAddRow={onAddRow} onRemoveRow={onRemoveRow} onPasteData={onPasteData} onSortColumn={onSortColumn} />
                  </>
                )}
                {activeTab === "graph" && !project && (
                  <div className="flex-1 flex items-center justify-center" style={{ color: "#64748b", fontSize: 13 }}>
                    No graph yet — pick a chart type from the welcome dialog or click <span style={{ fontWeight: 700, margin: "0 4px" }}>+</span> to start a new dataset.
                  </div>
                )}
                {activeTab === "graph" && project && (
                  <div
                    ref={graphAreaRef}
                    className="flex-1 overflow-auto relative"
                    onClick={() => setContextMenu(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY });
                    }}
                    onWheel={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        setGraphZoom((z) => Math.max(25, Math.min(400, z + (e.deltaY < 0 ? 10 : -10))));
                      }
                    }}
                  >
                    {/* Zoom controls (glass pill) */}
                    <div className="cs-glass-strong" style={{ position: "absolute", bottom: 12, right: 12, zIndex: 20, display: "flex", alignItems: "center", gap: 2, borderRadius: 12, padding: "3px 6px" }}>
                      <button onClick={() => setGraphZoom((z) => Math.max(25, z - 25))} className="cs-tool-btn" style={{ width: 22, height: 22, minWidth: 22, padding: 0, fontSize: 14, fontWeight: 700 }}>−</button>
                      <button onClick={() => setGraphZoom(100)} style={{ width: 44, height: 22, fontSize: 10, fontWeight: 700, color: "#475569", background: "none", border: "none", cursor: "default" }}>{graphZoom}%</button>
                      <button onClick={() => setGraphZoom((z) => Math.min(400, z + 25))} className="cs-tool-btn" style={{ width: 22, height: 22, minWidth: 22, padding: 0, fontSize: 14, fontWeight: 700 }}>+</button>
                      <div style={{ width: 1, height: 14, background: "#d1d5db", margin: "0 2px" }} />
                      <button onClick={() => {
                        // Fit to view
                        const area = graphAreaRef.current;
                        if (!area) return;
                        const cW = effectiveSettings!.chartWidth || 740;
                        const cH = effectiveSettings!.chartHeight || 520;
                        const aW = area.clientWidth - 48;
                        const aH = area.clientHeight - 48;
                        const fit = Math.min(aW / cW, aH / cH) * 100;
                        setGraphZoom(Math.round(Math.max(25, Math.min(400, fit))));
                      }} className="cs-tool-btn" style={{ height: 22, padding: "0 6px", fontSize: 9, fontWeight: 700 }}>Fit</button>
                    </div>

                    {/* Right-click context menu */}
                    {contextMenu && (
                      <div
                        style={{
                          position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 100,
                          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px) saturate(150%)",
                          border: "1px solid rgba(226,232,240,0.8)", borderRadius: 14,
                          boxShadow: "0 8px 32px -8px rgba(15,23,42,0.15)", padding: "6px 0", minWidth: 200,
                          fontFamily: "'Inter', sans-serif",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {[
                          { label: "Copy as PNG", action: async () => {
                            try {
                              const canvas = await renderCompositeCanvas(2);
                              canvas.toBlob((blob) => {
                                if (blob) { navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); toast.success("Copied to clipboard"); }
                              });
                            } catch { toast.error("Copy failed"); }
                          }},
                          { label: "Copy as SVG", action: () => {
                            const svgs = getChartSvgs();
                            if (svgs.length === 0) return;
                            if (svgs.length === 1) {
                              navigator.clipboard.writeText(new XMLSerializer().serializeToString(svgs[0]));
                            } else {
                              // Composite SVG for multi-panel
                              const container = graphAreaRef.current?.querySelector("[data-layout-container]") as HTMLElement;
                              if (!container) return;
                              const cRect = container.getBoundingClientRect();
                              let inner = "";
                              svgs.forEach((svg) => { const r = svg.getBoundingClientRect(); inner += `<g transform="translate(${r.left - cRect.left},${r.top - cRect.top})">${new XMLSerializer().serializeToString(svg)}</g>`; });
                              navigator.clipboard.writeText(`<svg xmlns="http://www.w3.org/2000/svg" width="${cRect.width}" height="${cRect.height}">${inner}</svg>`);
                            }
                            toast.success("SVG copied to clipboard");
                          }},
                          { label: "─" },
                          { label: "Export...", action: () => setExportDialogOpen(true) },
                          { label: "Add to Canvas", action: addToCanvas },
                          { label: "─" },
                          { label: "Add Text Annotation", action: () => {
                            const cx = (project?.graphSettings.chartWidth || 740) / 2;
                            const cy = (project?.graphSettings.chartHeight || 520) / 2;
                            updateGraphSetting("annotations", [...(project?.graphSettings.annotations || []), { x: cx, y: cy, text: "Label", type: "text" }]);
                            toast.success("Text annotation added — drag to reposition");
                          }},
                          { label: "Add Arrow Annotation", action: () => {
                            const cx = (project?.graphSettings.chartWidth || 740) / 2;
                            const cy = (project?.graphSettings.chartHeight || 520) / 2;
                            updateGraphSetting("annotations", [...(project?.graphSettings.annotations || []), { x: cx - 40, y: cy - 30, text: "Note", type: "arrow", arrowToX: cx + 30, arrowToY: cy + 20 }]);
                            toast.success("Arrow annotation added — drag endpoints to reposition");
                          }},
                          { label: "─" },
                          { label: "Zoom to 100%", action: () => setGraphZoom(100) },
                          { label: "Fit to View", action: () => {
                            const area = graphAreaRef.current;
                            if (!area || !project) return;
                            const cW = effectiveSettings!.chartWidth || 740;
                            const cH = effectiveSettings!.chartHeight || 520;
                            const fit = Math.min((area.clientWidth - 48) / cW, (area.clientHeight - 48) / cH) * 100;
                            setGraphZoom(Math.round(Math.max(25, Math.min(400, fit))));
                          }},
                          { label: "─" },
                          { label: "Edit Title", action: () => {
                            setPromptDialog({ title: "Edit Title", label: "Chart title", defaultValue: project?.graphSettings.title || "", onConfirm: (v) => updateGraphSetting("title", v) });
                            setPromptValue(project?.graphSettings.title || "");
                          }},
                          { label: "Edit X Label", action: () => {
                            setPromptDialog({ title: "Edit X Axis Label", label: "X axis label", defaultValue: project?.graphSettings.xLabel || "", onConfirm: (v) => updateGraphSetting("xLabel", v) });
                            setPromptValue(project?.graphSettings.xLabel || "");
                          }},
                          { label: "Edit Y Label", action: () => {
                            setPromptDialog({ title: "Edit Y Axis Label", label: "Y axis label", defaultValue: project?.graphSettings.yLabel || "", onConfirm: (v) => updateGraphSetting("yLabel", v) });
                            setPromptValue(project?.graphSettings.yLabel || "");
                          }},
                          { label: "─" },
                          { label: "Toggle Grid", action: () => updateGraphSetting("showGrid", !effectiveSettings?.showGrid) },
                          { label: "Toggle Error Bars", action: () => updateGraphSetting("showErrorBars", !effectiveSettings?.showErrorBars) },
                          { label: "Toggle Data Points", action: () => updateGraphSetting("showDataPoints", !effectiveSettings?.showDataPoints) },
                          { label: "Toggle Mean Values", action: () => updateGraphSetting("showMeanValues", !effectiveSettings?.showMeanValues) },
                          ...(user ? [
                            { label: "─" },
                            { label: "Save Data as Dataset", action: () => { const name = prompt("Dataset name:"); if (name) saveDatasetToCloud(name); } },
                            { label: "Save Graph as Preset", action: () => { const name = prompt("Preset name:"); if (name) saveGraphPreset(name); } },
                          ] : []),
                        ].map((item, i) =>
                          item.label === "─" ? (
                            <div key={i} style={{ height: 1, background: "#e2e8f0", margin: "3px 8px" }} />
                          ) : (
                            <button
                              key={item.label}
                              onClick={() => { (item as any).action?.(); setContextMenu(null); }}
                              style={{
                                display: "block", width: "100%", padding: "5px 14px", fontSize: 12,
                                fontWeight: 500, color: "#334155", textAlign: "left",
                                background: "none", border: "none", cursor: "default",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget).style.background = "#f1f5f9"; }}
                              onMouseLeave={(e) => { (e.currentTarget).style.background = "none"; }}
                            >
                              {item.label}
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {/* Chart at zoom level */}
                    <div style={{ minWidth: "100%", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                      <div style={{
                        transform: `scale(${graphZoom / 100})`, transformOrigin: "center center", transition: "transform 0.1s ease-out",
                        filter: colorblindMode === "deuteranopia" ? "url(#cb-deuteranopia)" : colorblindMode === "protanopia" ? "url(#cb-protanopia)" : colorblindMode === "tritanopia" ? "url(#cb-tritanopia)" : "none",
                      }}>
                        {/* Colorblind simulation filters */}
                        <svg width={0} height={0} style={{ position: "absolute" }}>
                          <defs>
                            <filter id="cb-deuteranopia"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" /></filter>
                            <filter id="cb-protanopia"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0" /></filter>
                            <filter id="cb-tritanopia"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" /></filter>
                          </defs>
                        </svg>
                        {/* Single or Multi-panel render */}
                        {(!project.layout || project.layout.mode === "single" || !project.panels) ? (
                          <div style={{ background: "white", border: "1px solid rgba(226,232,240,0.6)", borderRadius: 14, padding: 10, boxShadow: "0 8px 32px -8px rgba(15,23,42,0.1)" }}>
                            <ChartCanvas columns={effectiveColumns} rows={effectiveRows} settings={{...effectiveSettings!}} onAnnotationMove={onAnnotationMove} onSettingChange={updateGraphSetting} onSettingChangeTransient={updateGraphSettingTransient} onPushUndoSnapshot={pushUndoSnapshot} onColumnRename={onColumnRename} onPrompt={(t, l, d, cb) => { setPromptDialog({ title: t, label: l, defaultValue: d, onConfirm: cb }); setPromptValue(d); }} activeTextInputRef={activeTextInputRef} editor={editor} />
                            {effectiveSettings?.showProvenance && (
                              <div
                                data-provenance-badge
                                style={{
                                  marginTop: 6, padding: "4px 8px",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                  fontSize: 10, color: "#64748b",
                                  borderTop: "1px solid rgba(226,232,240,0.5)",
                                  letterSpacing: "0.02em",
                                }}
                                onClick={() => {
                                  const txt = (document.querySelector('[data-provenance-badge]') as HTMLElement)?.innerText;
                                  if (txt && navigator.clipboard) { navigator.clipboard.writeText(txt).then(() => toast.success("Provenance copied")); }
                                }}
                                title="Click to copy"
                              >
                                {buildProvenanceLine(effectiveColumns, effectiveRows, effectiveSettings!, testResults)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div data-layout-container style={{
                            background: "white", border: "1px solid rgba(226,232,240,0.6)", borderRadius: 14, padding: 16, boxShadow: "0 8px 32px -8px rgba(15,23,42,0.1)",
                            ...(project.layout.mode === "inset" ? { position: "relative" as const } : {
                              display: "grid", gap: 16,
                              gridTemplateColumns: project.layout.mode === "2-up-vertical" ? "1fr" : "1fr 1fr",
                              gridTemplateRows: project.layout.mode === "2-up" ? "1fr" : project.layout.mode === "4-up" ? "1fr 1fr" : "auto",
                            }),
                          }}>
                            {/* Page label */}
                            {project.layout.pageLabel && (
                              <div style={{ gridColumn: "1 / -1", fontSize: 13, fontWeight: 700, color: "#1e293b", textAlign: "center", marginBottom: -8 }}>{project.layout.pageLabel}</div>
                            )}
                            {project.panels.map((pn, i) => {
                              const isActive = pn.id === project.layout!.activePanelId;
                              const isInset = project.layout!.mode === "inset" && i === 1;
                              const insetBounds = pn.insetBounds ?? { x: 0.55, y: 0.05, width: 0.4, height: 0.4 };
                              const scaleFactor = project.layout!.mode === "4-up" ? 0.48 : project.layout!.mode === "3-up" ? (i === 0 ? 0.95 : 0.48) : project.layout!.mode === "2-up" || project.layout!.mode === "2-up-vertical" ? 0.65 : isInset ? 0.38 : 1;
                              const scaledSettings = { ...pn.graphSettings, chartWidth: Math.round(pn.graphSettings.chartWidth * scaleFactor), chartHeight: Math.round(pn.graphSettings.chartHeight * scaleFactor) };
                              const panelLabel = project.layout!.showPanelLabels !== false ? (
                                project.layout!.panelLabelStyle === "number" ? `${i + 1}` :
                                project.layout!.panelLabelStyle === "lowercase" ? String.fromCharCode(97 + i) :
                                String.fromCharCode(65 + i)
                              ) : null;

                              return (
                                <div
                                  key={pn.id}
                                  onClick={() => commit((p) => ({ ...p, layout: p.layout ? { ...p.layout, activePanelId: pn.id } : undefined }))}
                                  style={{
                                    position: isInset ? "absolute" : "relative",
                                    ...(isInset ? { left: `${insetBounds.x * 100}%`, top: `${insetBounds.y * 100}%`, width: `${insetBounds.width * 100}%`, zIndex: 10 } : {}),
                                    ...(project.layout!.mode === "3-up" && i === 0 ? { gridColumn: "1 / -1" } : {}),
                                    border: isActive ? "2px solid #3b82f6" : "1px solid transparent",
                                    borderRadius: 4, padding: 4, cursor: "default",
                                    boxShadow: isActive ? "0 0 0 3px rgba(59,130,246,0.12)" : undefined,
                                    transition: "border-color 0.15s, box-shadow 0.15s",
                                  }}
                                >
                                  {/* Panel label badge */}
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                                    {panelLabel && (
                                      <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? "#1e40af" : "#94a3b8", fontFamily: "Arial, sans-serif" }}>{panelLabel}</span>
                                    )}
                                    <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? "#3b82f6" : "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pn.label}</span>
                                  </div>
                                  <ChartCanvas
                                    columns={pn.columns} rows={pn.rows}
                                    settings={{...scaledSettings}}
                                    onAnnotationMove={isActive ? onAnnotationMove : undefined}
                                    onSettingChange={isActive ? updateGraphSetting : undefined}
                                    onSettingChangeTransient={isActive ? updateGraphSettingTransient : undefined}
                                    onPushUndoSnapshot={isActive ? pushUndoSnapshot : undefined}
                                    onColumnRename={isActive ? onColumnRename : undefined}
                                    onPrompt={isActive ? (t, l, d, cb) => { setPromptDialog({ title: t, label: l, defaultValue: d, onConfirm: cb }); setPromptValue(d); } : undefined}
                                    activeTextInputRef={isActive ? activeTextInputRef : undefined}
                                    editor={isActive ? editor : undefined}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "results" && <ResultsView columns={effectiveColumns} rows={effectiveRows} tests={testResults} onRunTest={handleRunTest} autoSelectTest={analysisAutoTest} onAutoSelectHandled={() => setAnalysisAutoTest(null)} chartType={effectiveSettings?.chartType || "column"} user={user} />}
            </div>

            {/* ── Properties Panel (right, floating glass) — pill rail when collapsed, full panel when open ── */}
              {(formatOpen || activeTab === "graph") && propsCollapsed && (
                <div className="cs-glass-strong flex flex-col items-center shrink-0" style={{ width: 40, margin: "8px 8px 8px 0", borderRadius: 16, padding: "8px 4px", zIndex: 10 }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={togglePropsCollapsed}
                        style={{
                          width: 30, height: 30, padding: 0,
                          border: "1px solid transparent",
                          background: "transparent",
                          color: "#64748b",
                          borderRadius: 8, cursor: "default",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.08)"; e.currentTarget.style.color = "#1e40af"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}
                      ><Palette className="h-4 w-4" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Properties</TooltipContent>
                  </Tooltip>
                </div>
              )}
              {(formatOpen || activeTab === "graph") && !propsCollapsed && (
                <div className="cs-props cs-glass-strong flex flex-col overflow-hidden relative" style={{ width: propsWidth, minWidth: propsWidth, margin: "8px 8px 8px 0", borderRadius: 16 }}>
                  <ResizeHandle side="left" onResize={handlePropsResize} />
                  <div className="cs-props-header" style={{ borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Properties</span>
                    <button onClick={togglePropsCollapsed} title="Collapse panel" style={{ width: 20, height: 20, padding: 0, color: "#64748b", background: "none", border: "none", cursor: "default", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.08)"; e.currentTarget.style.color = "#1e40af"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#64748b"; }}><PanelRightClose className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <PropDrawer title="Chart" name="chart" defaultOpen>
                    <div className="cs-props-row"><span className="cs-props-label">Title</span></div>
                    <div className="p-2 pt-0"><input className="cs-props-input" value={effectiveSettings!.title} onChange={(e) => updateGraphSetting("title", e.target.value)} /></div>

                    <div className="cs-props-row"><span className="cs-props-label">X Axis Label</span></div>
                    <div className="p-2 pt-0"><input className="cs-props-input" value={effectiveSettings!.xLabel} onChange={(e) => updateGraphSetting("xLabel", e.target.value)} /></div>

                    <div className="cs-props-row"><span className="cs-props-label">Y Axis Label</span></div>
                    <div className="p-2 pt-0"><input className="cs-props-input" value={effectiveSettings!.yLabel} onChange={(e) => updateGraphSetting("yLabel", e.target.value)} /></div>
                    </PropDrawer>

                    <PropDrawer title="Appearance" name="appearance" defaultOpen>

                    <div className="cs-props-row">
                      <span className="cs-props-label">Grid Lines</span>
                      <Switch checked={effectiveSettings!.showGrid} onCheckedChange={(v) => updateGraphSetting("showGrid", v)} />
                    </div>
                    <div className="cs-props-row">
                      <span className="cs-props-label">Error Bars</span>
                      <Switch checked={effectiveSettings!.showErrorBars} onCheckedChange={(v) => updateGraphSetting("showErrorBars", v)} />
                    </div>
                    {effectiveSettings!.showErrorBars && (
                      <div className="p-2 flex gap-1">
                        {(["sem", "sd"] as const).map((t) => (
                          <button key={t} onClick={() => updateGraphSetting("errorBarType", t)} className={cn("cs-tool-btn flex-1 text-[10px] uppercase", effectiveSettings!.errorBarType === t && "cs-tool-btn-active")}>{t}</button>
                        ))}
                      </div>
                    )}
                    {effectiveSettings!.showErrorBars && (effectiveSettings!.chartType === "xy") && (
                      <div className="cs-props-row">
                        <span className="cs-props-label" title="For XY charts with multiple Y traces: render mean ± error across traces as a shaded ribbon instead of tick marks">Error as Band</span>
                        <Switch checked={!!effectiveSettings!.errorBand} onCheckedChange={(v) => updateGraphSetting("errorBand", v)} />
                      </div>
                    )}
                    {effectiveSettings!.showErrorBars && (
                      <div className="p-2 pt-0">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Error Bar Weight</span>
                          <span style={{ fontSize: 10, color: "#1e40af", fontWeight: 700 }}>{effectiveSettings!.errorBarWeight}px</span>
                        </div>
                        <input type="range" className="cs-range" min={0.5} max={4} step={0.5} value={effectiveSettings!.errorBarWeight} onPointerDown={pushUndoSnapshot} onChange={(e) => updateGraphSettingTransient("errorBarWeight", Number(e.target.value))} />
                      </div>
                    )}
                    <div className="p-2 pt-0">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Axis Line Weight</span>
                        <span style={{ fontSize: 10, color: "#1e40af", fontWeight: 700 }}>{effectiveSettings!.axisLineWeight}px</span>
                      </div>
                      <input type="range" className="cs-range" min={0.5} max={3} step={0.5} value={effectiveSettings!.axisLineWeight} onPointerDown={pushUndoSnapshot} onChange={(e) => updateGraphSettingTransient("axisLineWeight", Number(e.target.value))} />
                    </div>
                    <div className="cs-props-row">
                      <span className="cs-props-label">Data Points</span>
                      <Switch checked={effectiveSettings!.showDataPoints} onCheckedChange={(v) => updateGraphSetting("showDataPoints", v)} />
                    </div>
                    <div className="cs-props-row">
                      <span className="cs-props-label">Show Mean Values</span>
                      <Switch checked={effectiveSettings!.showMeanValues} onCheckedChange={(v) => updateGraphSetting("showMeanValues", v)} />
                    </div>
                    <div className="cs-props-row">
                      <span className="cs-props-label" title="One-line provenance under the chart — n, date, test name, version">Reproducibility Badge</span>
                      <Switch checked={!!effectiveSettings!.showProvenance} onCheckedChange={(v) => updateGraphSetting("showProvenance", v)} />
                    </div>
                    {effectiveSettings!.showErrorBars && (
                      <div className="cs-props-row">
                        <span className="cs-props-label">Show Error Values</span>
                        <Switch checked={effectiveSettings!.showErrorValues} onCheckedChange={(v) => updateGraphSetting("showErrorValues", v)} />
                      </div>
                    )}
                    {effectiveSettings!.chartType === "xy" && (
                      <div className="cs-props-row">
                        <span className="cs-props-label">Regression</span>
                        <Switch checked={effectiveSettings!.showRegression} onCheckedChange={(v) => updateGraphSetting("showRegression", v)} />
                      </div>
                    )}
                    {effectiveSettings!.chartType === "heatmap" && (
                      <div className="cs-props-row">
                        <span className="cs-props-label">Show Cell Values</span>
                        <Switch checked={effectiveSettings!.heatmapShowValues !== false} onCheckedChange={(v) => updateGraphSetting("heatmapShowValues", v)} />
                      </div>
                    )}
                    <div className="cs-props-row">
                      <span className="cs-props-label">Dual Y-Axis</span>
                      <Switch checked={effectiveSettings!.showDualYAxis} onCheckedChange={(v) => updateGraphSetting("showDualYAxis", v)} />
                    </div>
                    {effectiveSettings!.showDualYAxis && (
                      <div className="p-2 pt-0">
                        <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4 }}>Assign to Right Y-Axis</div>
                        {effectiveColumns.map((col, ci) => (
                          <label key={ci} className="flex items-center gap-2 mb-1" style={{ fontSize: 10, color: "#475569", cursor: "pointer" }}>
                            <input type="checkbox" checked={effectiveSettings!.rightYAxisTraces.includes(ci)} onChange={(e) => {
                              const current = effectiveSettings!.rightYAxisTraces;
                              const newTraces = e.target.checked ? [...current, ci] : current.filter((i: number) => i !== ci);
                              updateGraphSetting("rightYAxisTraces", newTraces);
                            }} style={{ width: 13, height: 13 }} />
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: (effectiveSettings!.traceColors || COLORS)[ci % COLORS.length] }} />
                            {col}
                          </label>
                        ))}
                      </div>
                    )}
                    </PropDrawer>

                    {effectiveSettings!.chartType === "box" && (
                      <PropDrawer title="Whisker Style" name="whisker">
                        <div className="p-2 flex flex-col gap-1">
                          {([["tukey", "Tukey (1.5×IQR)"], ["minmax", "Min – Max"], ["percentile", "5th – 95th %"]] as const).map(([val, label]) => (
                            <button key={val} onClick={() => updateGraphSetting("whiskerStyle", val)} className={cn("cs-tool-btn w-full justify-start text-[10px]", effectiveSettings!.whiskerStyle === val && "cs-tool-btn-active")}>{label}</button>
                          ))}
                        </div>
                      </PropDrawer>
                    )}

                    {/* ── Axis Range ── */}
                    <PropDrawer title="Y Axis Range" name="y-axis-range">
                    <div className="cs-props-row">
                      <span className="cs-props-label">Auto</span>
                      <Switch checked={effectiveSettings!.yAutoRange} onCheckedChange={(v) => updateGraphSetting("yAutoRange", v)} />
                    </div>
                    {!effectiveSettings!.yAutoRange && (
                      <div className="p-2 pt-0 flex gap-2">
                        <div className="flex-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Min</div>
                          <input className="cs-props-input" type="number" value={effectiveSettings!.yMin ?? ""} onChange={(e) => updateGraphSetting("yMin", e.target.value === "" ? null : Number(e.target.value))} />
                        </div>
                        <div className="flex-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Max</div>
                          <input className="cs-props-input" type="number" value={effectiveSettings!.yMax ?? ""} onChange={(e) => updateGraphSetting("yMax", e.target.value === "" ? null : Number(e.target.value))} />
                        </div>
                      </div>
                    )}
                    </PropDrawer>
                    {(effectiveSettings!.chartType === "xy" || effectiveSettings!.chartType === "dose-response") && (
                      <PropDrawer title="X Axis Range" name="x-axis-range">
                        <div className="cs-props-row">
                          <span className="cs-props-label">Auto</span>
                          <Switch checked={effectiveSettings!.xAutoRange} onCheckedChange={(v) => updateGraphSetting("xAutoRange", v)} />
                        </div>
                        {!effectiveSettings!.xAutoRange && (
                          <div className="p-2 pt-0 flex gap-2">
                            <div className="flex-1">
                              <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Min</div>
                              <input className="cs-props-input" type="number" value={effectiveSettings!.xMin ?? ""} onChange={(e) => updateGraphSetting("xMin", e.target.value === "" ? null : Number(e.target.value))} />
                            </div>
                            <div className="flex-1">
                              <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Max</div>
                              <input className="cs-props-input" type="number" value={effectiveSettings!.xMax ?? ""} onChange={(e) => updateGraphSetting("xMax", e.target.value === "" ? null : Number(e.target.value))} />
                            </div>
                          </div>
                        )}
                      </PropDrawer>
                    )}

                    {/* ── Log Scale ── */}
                    <PropDrawer title="Scale" name="scale">
                    <div className="cs-props-row">
                      <span className="cs-props-label">Y Log₁₀</span>
                      <Switch checked={effectiveSettings!.yLogScale} onCheckedChange={(v) => updateGraphSetting("yLogScale", v)} />
                    </div>
                    {(effectiveSettings!.chartType === "xy" || effectiveSettings!.chartType === "dose-response") && (
                      <div className="cs-props-row">
                        <span className="cs-props-label">X Log₁₀</span>
                        <Switch checked={effectiveSettings!.xLogScale} onCheckedChange={(v) => updateGraphSetting("xLogScale", v)} />
                      </div>
                    )}
                    </PropDrawer>

                    {/* ── Axis Break ── */}
                    <PropDrawer title="Axis Break" name="axis-break">
                    <div className="cs-props-row">
                      <span className="cs-props-label">Y Axis Break</span>
                      <Switch checked={effectiveSettings!.yAxisBreak} onCheckedChange={(v) => updateGraphSetting("yAxisBreak", v)} />
                    </div>
                    {effectiveSettings!.yAxisBreak && (
                      <div className="p-2 pt-0 flex gap-2">
                        <div className="flex-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Break Low</div>
                          <input className="cs-props-input" type="number" value={effectiveSettings!.yBreakLow ?? ""} onChange={(e) => updateGraphSetting("yBreakLow", e.target.value === "" ? null : Number(e.target.value))} />
                        </div>
                        <div className="flex-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Break High</div>
                          <input className="cs-props-input" type="number" value={effectiveSettings!.yBreakHigh ?? ""} onChange={(e) => updateGraphSetting("yBreakHigh", e.target.value === "" ? null : Number(e.target.value))} />
                        </div>
                      </div>
                    )}
                    </PropDrawer>

                    {/* ── Typography ── */}
                    <PropDrawer title="Typography" name="typography">
                    <div className="cs-props-row"><span className="cs-props-label">Font</span></div>
                    <div className="p-2 pt-0">
                      <select className="cs-props-input" value={effectiveSettings!.fontFamily} onChange={(e) => updateGraphSetting("fontFamily", e.target.value)}>
                        {["Sans-serif", "Serif", "Monospace"].map((group) => (
                          <optgroup key={group} label={group}>
                            {FONT_OPTIONS.filter((f) => f.group === group).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="p-2 pt-0">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Title Size</span>
                        <span style={{ fontSize: 10, color: "#1e40af", fontWeight: 700 }}>{effectiveSettings!.titleSize}px</span>
                      </div>
                      <input type="range" className="cs-range" min={8} max={28} value={effectiveSettings!.titleSize} onPointerDown={pushUndoSnapshot} onChange={(e) => updateGraphSettingTransient("titleSize", Number(e.target.value))} />
                    </div>
                    <div className="p-2 pt-0">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Axis Label Size</span>
                        <span style={{ fontSize: 10, color: "#1e40af", fontWeight: 700 }}>{effectiveSettings!.axisLabelSize}px</span>
                      </div>
                      <input type="range" className="cs-range" min={6} max={18} value={effectiveSettings!.axisLabelSize} onPointerDown={pushUndoSnapshot} onChange={(e) => updateGraphSettingTransient("axisLabelSize", Number(e.target.value))} />
                    </div>
                    <div className="p-2 pt-0">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Tick Label Size</span>
                        <span style={{ fontSize: 10, color: "#1e40af", fontWeight: 700 }}>{effectiveSettings!.tickLabelSize}px</span>
                      </div>
                      <input type="range" className="cs-range" min={6} max={14} value={effectiveSettings!.tickLabelSize} onPointerDown={pushUndoSnapshot} onChange={(e) => updateGraphSettingTransient("tickLabelSize", Number(e.target.value))} />
                    </div>
                    <div className="p-2 pt-0 flex gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 11, color: "#475569" }}>
                        <input type="checkbox" checked={effectiveSettings!.titleBold} onChange={(e) => updateGraphSetting("titleBold", e.target.checked)} style={{ width: 13, height: 13 }} />
                        <strong>B</strong> Title
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 11, color: "#475569" }}>
                        <input type="checkbox" checked={effectiveSettings!.axisLabelBold} onChange={(e) => updateGraphSetting("axisLabelBold", e.target.checked)} style={{ width: 13, height: 13 }} />
                        <strong>B</strong> Axis
                      </label>
                    </div>
                    <div className="p-2 pt-0">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>X Tick Rotation</span>
                      </div>
                      <select
                        value={effectiveSettings!.xTickAngle ?? "auto"}
                        onChange={(e) => updateGraphSetting("xTickAngle", e.target.value === "auto" ? "auto" : Number(e.target.value))}
                        className="cs-props-input"
                        style={{ width: "100%" }}
                      >
                        <option value="auto">Auto (fit to space)</option>
                        <option value="0">Horizontal (0°)</option>
                        <option value="45">Diagonal (45°)</option>
                        <option value="90">Vertical (90°)</option>
                      </select>
                    </div>

                    </PropDrawer>

                    {/* ── Color Palette ── */}
                    <PropDrawer title="Colors" name="colors" defaultOpen>
                    <div className="p-2 pt-1">
                      <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4 }}>Palette</div>
                      <div className="flex flex-col gap-1">
                        {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
                          <button
                            key={key}
                            onClick={() => updateGraphSettings({ colorPalette: key, traceColors: pal.colors })}
                            className={cn("cs-tool-btn w-full justify-start gap-2 text-[10px]", effectiveSettings!.colorPalette === key && "cs-tool-btn-active")}
                          >
                            <div className="flex gap-0.5">
                              {pal.colors.slice(0, 6).map((c, i) => <div key={i} style={{ width: 8, height: 8, background: c, borderRadius: 1 }} />)}
                            </div>
                            {pal.name}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 8, marginBottom: 4 }}>Per-Column Colors & Opacity</div>
                      <div className="flex flex-col gap-2">
                        {effectiveColumns.map((col, ci) => {
                          const opacity = (effectiveSettings!.traceOpacities && effectiveSettings!.traceOpacities[ci] !== undefined) ? effectiveSettings!.traceOpacities[ci] : 1;
                          return (
                            <div key={ci}>
                              <div className="flex items-center gap-2" style={{ fontSize: 10, marginBottom: 2 }}>
                                <input
                                  type="color"
                                  value={effectiveSettings!.traceColors[ci] || COLORS[ci % COLORS.length]}
                                  onChange={(e) => {
                                    const newColors = [...effectiveSettings!.traceColors];
                                    while (newColors.length <= ci) newColors.push(COLORS[newColors.length % COLORS.length]);
                                    newColors[ci] = e.target.value;
                                    updateGraphSetting("traceColors", newColors);
                                  }}
                                  style={{ width: 18, height: 18, border: "1px solid #d1d5db", padding: 0, cursor: "pointer" }}
                                />
                                <span style={{ color: "#475569", fontWeight: 500, flex: 1 }}>{col}</span>
                                <span style={{ fontSize: 9, color: "#1e40af", fontWeight: 700, width: 30, textAlign: "right" }}>{Math.round(opacity * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                className="cs-range"
                                min={0.1}
                                max={1}
                                step={0.05}
                                value={opacity}
                                onPointerDown={pushUndoSnapshot}
                                onChange={(e) => {
                                  const newOpacities = [...(effectiveSettings!.traceOpacities || [])];
                                  while (newOpacities.length <= ci) newOpacities.push(1);
                                  newOpacities[ci] = Number(e.target.value);
                                  updateGraphSettingTransient("traceOpacities", newOpacities);
                                }}
                                style={{ width: "100%" }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    </PropDrawer>

                    {/* ── P-value Brackets ── */}
                    {(effectiveSettings!.chartType === "column" || effectiveSettings!.chartType === "grouped") && (
                      <PropDrawer title="P-value Brackets" name="brackets">
                        <div className="p-2 pt-1">
                          {effectiveSettings!.pBrackets.map((b, bi) => (
                            <div key={bi} className="flex items-center gap-1 mb-1" style={{ fontSize: 10 }}>
                              <span style={{ color: "#64748b" }}>{effectiveColumns[b.colA]}</span>
                              <span style={{ color: "#94a3b8" }}>vs</span>
                              <span style={{ color: "#64748b" }}>{effectiveColumns[b.colB]}</span>
                              <span style={{ color: "#1a1a1a", fontWeight: 700 }}>{b.pValue}</span>
                              <button onClick={() => {
                                const newB = effectiveSettings!.pBrackets.filter((_, i) => i !== bi);
                                updateGraphSetting("pBrackets", newB);
                              }} className="cs-tool-btn" style={{ width: 16, height: 16, minWidth: 16, padding: 0 }}>
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              if (effectiveColumns.length < 2) return;
                              const means = effectiveColumns.map((_, ci) =>
                                effectiveRows.map((r) => r[ci]).filter((v): v is number => typeof v === "number")
                              ).map((vals) => vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0);
                              const maxMean = Math.max(...means);
                              const errMax = Math.max(...effectiveColumns.map((_, ci) => {
                                const vals = effectiveRows.map((r) => r[ci]).filter((v): v is number => typeof v === "number");
                                if (vals.length < 2) return 0;
                                const m = vals.reduce((s, v) => s + v, 0) / vals.length;
                                return m + Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1)) / Math.sqrt(vals.length);
                              }));
                              const newBracket = { colA: 0, colB: 1, pValue: "**", y: (errMax || maxMean) * 1.1 + effectiveSettings!.pBrackets.length * (maxMean * 0.08) };
                              updateGraphSetting("pBrackets", [...effectiveSettings!.pBrackets, newBracket]);
                            }}
                            className="cs-tool-btn w-full text-[10px]"
                          >
                            <Plus className="h-3 w-3" /> Add Bracket
                          </button>
                        </div>
                      </PropDrawer>
                    )}

                    {/* ── Legend ── */}
                    <PropDrawer title="Legend" name="legend">
                    <div className="cs-props-row"><span className="cs-props-label">Position</span></div>
                    <div className="p-2 pt-0">
                      <select className="cs-props-input" value={effectiveSettings!.legendPosition} onChange={(e) => {
                        const next = e.target.value as GraphSettings["legendPosition"];
                        // Picking any preset clears the stale drag coords so the
                        // renderer takes the preset branch on the next render.
                        // Without this, a legendX/Y left over from a prior custom
                        // drag can keep the legend visually pinned in place if
                        // any code path checks x/y before position.
                        if (next !== "custom") {
                          updateGraphSettings({ legendPosition: next, legendX: null, legendY: null });
                        } else {
                          updateGraphSetting("legendPosition", next);
                        }
                      }}>
                        <option value="top-right">Top Right</option>
                        <option value="top-left">Top Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="custom">Custom (drag on chart)</option>
                        <option value="none">Hidden</option>
                      </select>
                    </div>
                    <div className="cs-props-row">
                      <span className="cs-props-label">Border</span>
                      <Switch checked={effectiveSettings!.legendBorder} onCheckedChange={(v) => updateGraphSetting("legendBorder", v)} />
                    </div>

                    </PropDrawer>

                    {/* ── Point & Line Style ── */}
                    <PropDrawer title="Points & Lines" name="points">
                    <div className="cs-props-row"><span className="cs-props-label">Shape</span></div>
                    <div className="p-2 pt-0 flex gap-1">
                      {(["circle", "square", "triangle", "diamond", "plus", "cross"] as PointShape[]).map((shape) => (
                        <button key={shape} onClick={() => updateGraphSetting("pointShape", shape)} className={cn("cs-tool-btn flex-1", effectiveSettings!.pointShape === shape && "cs-tool-btn-active")} style={{ padding: "0 2px", minWidth: 0 }}>
                          <svg width={14} height={14} viewBox="0 0 14 14">
                            {shape === "circle" && <circle cx={7} cy={7} r={4} fill="currentColor" />}
                            {shape === "square" && <rect x={3} y={3} width={8} height={8} fill="currentColor" />}
                            {shape === "triangle" && <polygon points="7,2 12,12 2,12" fill="currentColor" />}
                            {shape === "diamond" && <polygon points="7,1 13,7 7,13 1,7" fill="currentColor" />}
                            {shape === "plus" && <><line x1={7} y1={2} x2={7} y2={12} stroke="currentColor" strokeWidth={2.5} /><line x1={2} y1={7} x2={12} y2={7} stroke="currentColor" strokeWidth={2.5} /></>}
                            {shape === "cross" && <><line x1={3} y1={3} x2={11} y2={11} stroke="currentColor" strokeWidth={2.5} /><line x1={11} y1={3} x2={3} y2={11} stroke="currentColor" strokeWidth={2.5} /></>}
                          </svg>
                        </button>
                      ))}
                    </div>
                    <div className="p-2 pt-0">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Point Size</span>
                        <span style={{ fontSize: 10, color: "#1e40af", fontWeight: 700 }}>{effectiveSettings!.pointSize}px</span>
                      </div>
                      <input type="range" className="cs-range" min={1} max={12} value={effectiveSettings!.pointSize} onPointerDown={pushUndoSnapshot} onChange={(e) => updateGraphSettingTransient("pointSize", Number(e.target.value))} />
                    </div>
                    <div className="p-2 pt-0">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Line Width</span>
                        <span style={{ fontSize: 10, color: "#1e40af", fontWeight: 700 }}>{effectiveSettings!.lineWidth}px</span>
                      </div>
                      <input type="range" className="cs-range" min={0.5} max={5} step={0.5} value={effectiveSettings!.lineWidth} onPointerDown={pushUndoSnapshot} onChange={(e) => updateGraphSettingTransient("lineWidth", Number(e.target.value))} />
                    </div>
                    <div className="cs-props-row"><span className="cs-props-label">Line Style</span></div>
                    <div className="p-2 pt-0 flex gap-1">
                      {(["solid", "dashed", "dotted"] as const).map((ls) => (
                        <button key={ls} onClick={() => updateGraphSetting("lineStyle", ls)} className={cn("cs-tool-btn flex-1 text-[10px]", effectiveSettings!.lineStyle === ls && "cs-tool-btn-active")}>
                          <svg width={28} height={8} viewBox="0 0 28 8">
                            <line x1={0} y1={4} x2={28} y2={4} stroke="currentColor" strokeWidth={2} strokeDasharray={ls === "dashed" ? "6 3" : ls === "dotted" ? "2 3" : ""} />
                          </svg>
                        </button>
                      ))}
                    </div>

                    </PropDrawer>

                    {/* ── Chart Dimensions ── */}
                    <PropDrawer title="Dimensions" name="dimensions">
                    <div className="p-2 pt-1 flex gap-2">
                      <div className="flex-1">
                        <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Width</div>
                        <input className="cs-props-input" type="number" min={300} max={1200} step={10} value={effectiveSettings!.chartWidth} onChange={(e) => updateGraphSetting("chartWidth", Number(e.target.value))} />
                      </div>
                      <div className="flex-1">
                        <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Height</div>
                        <input className="cs-props-input" type="number" min={200} max={900} step={10} value={effectiveSettings!.chartHeight} onChange={(e) => updateGraphSetting("chartHeight", Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="p-2 pt-0 flex flex-col gap-1">
                      {[["85mm single col", 600, 450], ["170mm double col", 1000, 500], ["Square", 600, 600]].map(([label, w, h]) => (
                        <button key={label as string} onClick={() => updateGraphSettings({ chartWidth: w as number, chartHeight: h as number })} className="cs-tool-btn w-full justify-start text-[10px]">
                          {label as string} ({w}×{h})
                        </button>
                      ))}
                    </div>

                    </PropDrawer>

                    {/* ── Column Order (Legend Reorder) ── */}
                    <PropDrawer title="Column Order" name="column-order">
                    <div className="p-2 pt-1 flex flex-col gap-1">
                      {effectiveColumns.map((col, ci) => (
                        <div key={ci} className="flex items-center gap-1" style={{ fontSize: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: (effectiveSettings!.traceColors || COLORS)[ci % COLORS.length] }} />
                          <span style={{ flex: 1, color: "#475569", fontWeight: 500 }}>{col}</span>
                          <button disabled={ci === 0} onClick={() => {
                            commitPanel((pn) => {
                              const newCols = [...pn.columns];
                              const newRows = pn.rows.map((r) => { const nr = [...r]; [nr[ci - 1], nr[ci]] = [nr[ci], nr[ci - 1]]; return nr; });
                              [newCols[ci - 1], newCols[ci]] = [newCols[ci], newCols[ci - 1]];
                              const newColors = [...(pn.graphSettings.traceColors || COLORS)];
                              if (newColors[ci] && newColors[ci - 1]) [newColors[ci - 1], newColors[ci]] = [newColors[ci], newColors[ci - 1]];
                              return { ...pn, columns: newCols, rows: newRows, graphSettings: { ...pn.graphSettings, traceColors: newColors } };
                            });
                          }} className="cs-tool-btn" style={{ width: 16, height: 16, minWidth: 16, padding: 0, fontSize: 8 }}>▲</button>
                          <button disabled={ci === effectiveColumns.length - 1} onClick={() => {
                            commitPanel((pn) => {
                              const newCols = [...pn.columns];
                              const newRows = pn.rows.map((r) => { const nr = [...r]; [nr[ci], nr[ci + 1]] = [nr[ci + 1], nr[ci]]; return nr; });
                              [newCols[ci], newCols[ci + 1]] = [newCols[ci + 1], newCols[ci]];
                              const newColors = [...(pn.graphSettings.traceColors || COLORS)];
                              if (newColors[ci] && newColors[ci + 1]) [newColors[ci], newColors[ci + 1]] = [newColors[ci + 1], newColors[ci]];
                              return { ...pn, columns: newCols, rows: newRows, graphSettings: { ...pn.graphSettings, traceColors: newColors } };
                            });
                          }} className="cs-tool-btn" style={{ width: 16, height: 16, minWidth: 16, padding: 0, fontSize: 8 }}>▼</button>
                        </div>
                      ))}
                    </div>

                    </PropDrawer>

                    {/* ── Accessibility ── */}
                    <PropDrawer title="Accessibility" name="accessibility">
                    <div className="p-2 pt-1 flex flex-col gap-1">
                      {([["none", "Normal Vision"], ["deuteranopia", "Deuteranopia (red-green)"], ["protanopia", "Protanopia (red-green)"], ["tritanopia", "Tritanopia (blue-yellow)"]] as const).map(([mode, label]) => (
                        <button key={mode} onClick={() => setColorblindMode(mode)} className={cn("cs-tool-btn w-full justify-start text-[10px]", colorblindMode === mode && "cs-tool-btn-active")}>
                          {mode === "none" ? "👁" : "🔴"} {label}
                        </button>
                      ))}
                    </div>

                    </PropDrawer>

                    {/* ── Chart Theme ── */}
                    <PropDrawer title="Chart Theme" name="theme">
                    <div className="p-2 pt-1 flex flex-col gap-1">
                      {Object.entries(CHART_THEMES).map(([key, t]) => (
                        <button
                          key={key}
                          onClick={() => updateGraphSetting("chartTheme", key)}
                          className={cn("cs-tool-btn w-full justify-start gap-2 text-[10px]", effectiveSettings!.chartTheme === key && "cs-tool-btn-active")}
                        >
                          <div style={{ width: 14, height: 14, borderRadius: 2, background: t.bgColor, border: `1.5px solid ${t.axisColor}`, position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", bottom: 1, left: 1, width: 4, height: 6, background: t.titleColor, borderRadius: 1, opacity: 0.5 }} />
                            <div style={{ position: "absolute", bottom: 1, left: 6, width: 4, height: 9, background: t.titleColor, borderRadius: 1, opacity: 0.3 }} />
                          </div>
                          {t.name}
                        </button>
                      ))}
                    </div>

                    </PropDrawer>

                    {/* ── Publication Presets ── */}
                    <PropDrawer title="Publication Preset" name="pub-preset">
                    <div className="p-2 pt-1 flex flex-col gap-1">
                      {Object.entries(PUB_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => {
                            const s = preset.settings;
                            const patch: Partial<GraphSettings> = { ...s, pubPreset: key };
                            if (s.colorPalette && COLOR_PALETTES[s.colorPalette]) {
                              patch.traceColors = COLOR_PALETTES[s.colorPalette].colors;
                            }
                            updateGraphSettings(patch);
                          }}
                          className={cn("cs-tool-btn w-full justify-start text-[10px]", effectiveSettings!.pubPreset === key && "cs-tool-btn-active")}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>

                    </PropDrawer>

                    {/* ── Saved Styles ── */}
                    <PropDrawer title="Saved Styles" name="saved-styles">
                    <div className="p-2 pt-1">
                      {savedStyles.map((style, i) => (
                        <div key={i} className="flex items-center gap-1 mb-1">
                          <button
                            onClick={() => {
                              updateGraphSettings(style.settings as Partial<GraphSettings>);
                              toast.success(`Applied style: ${style.name}`);
                            }}
                            className="cs-tool-btn flex-1 justify-start text-[10px]"
                          >
                            {style.name}
                          </button>
                          <button onClick={() => {
                            const newStyles = savedStyles.filter((_, j) => j !== i);
                            setSavedStyles(newStyles);
                            localStorage.setItem("chartStudio_styles", JSON.stringify(newStyles));
                          }} className="cs-tool-btn" style={{ width: 18, height: 18, minWidth: 18, padding: 0 }}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setPromptDialog({
                            title: "Save Style",
                            label: "Enter a name for this style",
                            defaultValue: `Style ${savedStyles.length + 1}`,
                            onConfirm: (name) => {
                              const { chartType, title, xLabel, yLabel, ...styleSettings } = effectiveSettings!;
                              const newStyles = [...savedStyles, { name, settings: styleSettings }];
                              setSavedStyles(newStyles);
                              localStorage.setItem("chartStudio_styles", JSON.stringify(newStyles));
                              toast.success(`Saved style: ${name}`);
                            }
                          });
                          setPromptValue(`Style ${savedStyles.length + 1}`);
                        }}
                        className="cs-tool-btn w-full text-[10px]"
                      >
                        <Plus className="h-3 w-3" /> Save Current Style
                      </button>
                    </div>

                    </PropDrawer>

                    {/* ── Annotations ── */}
                    <PropDrawer title="Annotations" name="annotations">
                    <div className="p-2 pt-1">
                      {effectiveSettings!.annotations.map((ann, ai) => (
                        <div key={ai} className="flex items-center gap-1 mb-1.5" style={{ fontSize: 10 }}>
                          <span style={{ color: "#64748b", width: 32 }}>{ann.type === "arrow" ? "→" : "T"}</span>
                          <input
                            className="cs-props-input flex-1"
                            value={ann.text}
                            onChange={(e) => {
                              const newAnns = [...effectiveSettings!.annotations];
                              newAnns[ai] = { ...newAnns[ai], text: e.target.value };
                              updateGraphSetting("annotations", newAnns);
                            }}
                            placeholder="Label text"
                          />
                          <button onClick={() => {
                            updateGraphSetting("annotations", effectiveSettings!.annotations.filter((_, i) => i !== ai));
                          }} className="cs-tool-btn" style={{ width: 18, height: 18, minWidth: 18, padding: 0 }}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            const cx = (effectiveSettings!.chartWidth || 740) / 2;
                            const cy = (effectiveSettings!.chartHeight || 520) / 2;
                            updateGraphSetting("annotations", [...effectiveSettings!.annotations, { x: cx, y: cy, text: "Label", type: "text" }]);
                          }}
                          className="cs-tool-btn flex-1 text-[10px]"
                        >
                          <Plus className="h-3 w-3" /> Text
                        </button>
                        <button
                          onClick={() => {
                            const cx = (effectiveSettings!.chartWidth || 740) / 2;
                            const cy = (effectiveSettings!.chartHeight || 520) / 2;
                            updateGraphSetting("annotations", [...effectiveSettings!.annotations, { x: cx - 40, y: cy - 30, text: "Note", type: "arrow", arrowToX: cx + 30, arrowToY: cy + 20 }]);
                          }}
                          className="cs-tool-btn flex-1 text-[10px]"
                        >
                          <Plus className="h-3 w-3" /> Arrow
                        </button>
                      </div>
                    </div>

                    </PropDrawer>

                    {/* ── Color By (Tier 3, XY scatter) ── */}
                    {effectiveSettings!.chartType === "xy" && effectiveColumns.length >= 3 && (
                      <PropDrawer title="Color By" name="color-by">
                        <div className="p-2 pt-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4 }}>Color points by numeric column</div>
                          <select
                            className="cs-props-input"
                            value={effectiveSettings!.colorByColumn ?? ""}
                            onChange={(e) => updateGraphSetting("colorByColumn", e.target.value === "" ? null : Number(e.target.value))}
                            style={{ width: "100%", marginBottom: 8 }}
                          >
                            <option value="">(off — use trace colors)</option>
                            {effectiveColumns.map((c, ci) => (
                              <option key={ci} value={ci}>{c}</option>
                            ))}
                          </select>
                          {effectiveSettings!.colorByColumn != null && (
                            <>
                              <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4 }}>Palette</div>
                              <select
                                className="cs-props-input"
                                value={effectiveSettings!.colorByPalette || "viridis"}
                                onChange={(e) => updateGraphSetting("colorByPalette", e.target.value)}
                                style={{ width: "100%" }}
                              >
                                <option value="viridis">Viridis</option>
                                <option value="plasma">Plasma</option>
                                <option value="magma">Magma</option>
                                <option value="cool">Cool</option>
                                <option value="warm">Warm</option>
                              </select>
                            </>
                          )}
                        </div>
                      </PropDrawer>
                    )}

                    {/* ── Reference Lines (Tier 3) ── */}
                    <PropDrawer title="Reference Lines" name="reflines">
                      <div className="p-2 pt-1">
                        {(effectiveSettings!.referenceLines || []).map((ln, li) => (
                          <div key={ln.id} className="flex items-center gap-1 mb-1.5" style={{ fontSize: 10 }}>
                            <select
                              value={ln.axis}
                              onChange={(e) => {
                                const next = [...(effectiveSettings!.referenceLines || [])];
                                next[li] = { ...ln, axis: e.target.value as "x" | "y" };
                                updateGraphSetting("referenceLines", next);
                              }}
                              className="cs-props-input"
                              style={{ width: 42 }}
                            >
                              <option value="y">y=</option>
                              <option value="x">x=</option>
                            </select>
                            <input
                              type="number"
                              className="cs-props-input"
                              style={{ width: 54 }}
                              value={ln.value}
                              onChange={(e) => {
                                const next = [...(effectiveSettings!.referenceLines || [])];
                                next[li] = { ...ln, value: Number(e.target.value) };
                                updateGraphSetting("referenceLines", next);
                              }}
                            />
                            <input
                              className="cs-props-input flex-1"
                              value={ln.label}
                              onChange={(e) => {
                                const next = [...(effectiveSettings!.referenceLines || [])];
                                next[li] = { ...ln, label: e.target.value };
                                updateGraphSetting("referenceLines", next);
                              }}
                              placeholder="Label"
                            />
                            <input
                              type="color"
                              value={ln.color}
                              onChange={(e) => {
                                const next = [...(effectiveSettings!.referenceLines || [])];
                                next[li] = { ...ln, color: e.target.value };
                                updateGraphSetting("referenceLines", next);
                              }}
                              style={{ width: 18, height: 18, border: "1px solid #d1d5db", padding: 0 }}
                            />
                            <button
                              onClick={() => {
                                const next = [...(effectiveSettings!.referenceLines || [])];
                                next[li] = { ...ln, dashed: !ln.dashed };
                                updateGraphSetting("referenceLines", next);
                              }}
                              className="cs-tool-btn"
                              style={{ width: 22, height: 18, padding: 0, fontSize: 9 }}
                              title="Toggle dashed"
                            >{ln.dashed ? "⋯" : "—"}</button>
                            <button
                              onClick={() => {
                                updateGraphSetting("referenceLines", (effectiveSettings!.referenceLines || []).filter((_, i) => i !== li));
                              }}
                              className="cs-tool-btn"
                              style={{ width: 18, height: 18, minWidth: 18, padding: 0 }}
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const existing = effectiveSettings!.referenceLines || [];
                            const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                            updateGraphSetting("referenceLines", [...existing, { id, axis: "y", value: 0, label: "", color: "#64748b", dashed: true }]);
                          }}
                          className="cs-tool-btn w-full text-[10px]"
                        >
                          <Plus className="h-3 w-3" /> Add Reference Line
                        </button>
                      </div>
                    </PropDrawer>

                    {/* ── Export Quality ── */}
                    <PropDrawer title="Export Quality" name="export">
                    <div className="p-2 pt-1 flex gap-1">
                      {([150, 300, 600] as const).map((dpi) => (
                        <button key={dpi} onClick={() => updateGraphSetting("exportDPI", dpi)} className={cn("cs-tool-btn flex-1 text-[10px]", effectiveSettings!.exportDPI === dpi && "cs-tool-btn-active")}>
                          {dpi} DPI
                        </button>
                      ))}
                    </div>
                    <div style={{ padding: "4px 8px", fontSize: 9, color: "#94a3b8" }}>
                      {(() => {
                        const d = effectiveSettings!.exportDPI || 300;
                        const w = effectiveSettings!.chartWidth || 740;
                        const h = effectiveSettings!.chartHeight || 520;
                        const s = d / 96;
                        return `Output: ${Math.round(w * s)} × ${Math.round(h * s)} px`;
                      })()}
                    </div>

                    </PropDrawer>

                    {/* ── Margins ── */}
                    <PropDrawer title="Margins (px)" name="margins">
                    <div className="p-2 pt-1">
                      <div className="flex gap-2 mb-1">
                        <div className="flex-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Top</div>
                          <input className="cs-props-input" type="number" min={10} max={100} value={effectiveSettings!.marginTop} onChange={(e) => updateGraphSetting("marginTop", Number(e.target.value))} />
                        </div>
                        <div className="flex-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Right</div>
                          <input className="cs-props-input" type="number" min={10} max={100} value={effectiveSettings!.marginRight} onChange={(e) => updateGraphSetting("marginRight", Number(e.target.value))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Bottom</div>
                          <input className="cs-props-input" type="number" min={10} max={100} value={effectiveSettings!.marginBottom} onChange={(e) => updateGraphSetting("marginBottom", Number(e.target.value))} />
                        </div>
                        <div className="flex-1">
                          <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>Left</div>
                          <input className="cs-props-input" type="number" min={10} max={100} value={effectiveSettings!.marginLeft} onChange={(e) => updateGraphSetting("marginLeft", Number(e.target.value))} />
                        </div>
                      </div>
                    </div>
                    </PropDrawer>
                  </div>
                </div>
              )}
          </div>

        {/* ═══ Status Bar ═══ */}
        <div className="cs-statusbar cs-glass shrink-0" style={{ borderRadius: 0 }}>
          <span style={{ fontWeight: 600 }}>{activeTab === "data" ? "Data" : activeTab === "graph" ? "Graph" : "Analysis"}</span>
          <span>{rowCount}×{colCount}</span>
          <span>{effectiveSettings!.chartType}</span>
          {activeTab === "graph" && <span>Zoom: {graphZoom}%</span>}
          <div className="flex-1" />
          {lastSaved && <span style={{ color: "#16a34a" }}>{user ? "☁" : "💾"} {Math.round((Date.now() - lastSaved.getTime()) / 60000) < 1 ? "Saved" : `${Math.round((Date.now() - lastSaved.getTime()) / 60000)}m ago`}</span>}
          <span style={{ cursor: "pointer", opacity: 0.6 }} onClick={() => { setCmdPaletteOpen(true); setCmdSearch(""); }}><b>/</b> commands</span>
        </div>

        <WelcomeDialog open={showWelcome} onCreate={handleCreate} />

        {/* Project right-click context menu */}
        {datasetContextMenu && (() => {
          const ds = workbook.datasets.find((d) => d.id === datasetContextMenu.datasetId);
          if (!ds) return null;
          const items: { label: string; action?: () => void; danger?: boolean }[] = [
            { label: "Rename…", action: () => {
              setPromptDialog({
                title: "Rename Dataset",
                label: "Dataset name",
                defaultValue: ds.name,
                onConfirm: (v) => renameDataset(ds.id, v),
              });
              setPromptValue(ds.name);
            } },
            { label: "Duplicate", action: () => duplicateDataset(ds.id) },
            { label: "─" },
            { label: "Export CSV", action: () => exportDatasetCSV(ds.id) },
            { label: "─" },
            { label: "Close Tab", action: () => closeDatasetTab(ds.id), danger: true },
          ];
          return (
            <div onClick={() => setDatasetContextMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 200 }}>
              <div style={{
                position: "fixed", left: datasetContextMenu.x, top: datasetContextMenu.y, zIndex: 201,
                background: "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 0",
                boxShadow: "0 8px 24px rgba(0,0,0,0.16)", minWidth: 160,
              }}>
                {items.map((item, i) =>
                  item.label === "─" ? (
                    <div key={i} style={{ height: 1, background: "#e2e8f0", margin: "3px 8px" }} />
                  ) : (
                    <button key={item.label}
                      onClick={() => { item.action?.(); setDatasetContextMenu(null); }}
                      style={{ display: "block", width: "100%", padding: "5px 14px", fontSize: 11, fontWeight: 500, color: item.danger ? "#dc2626" : "#334155", textAlign: "left", background: "none", border: "none", cursor: "default" }}
                      onMouseEnter={(e) => { (e.currentTarget).style.background = "#f1f5f9"; }}
                      onMouseLeave={(e) => { (e.currentTarget).style.background = "none"; }}
                    >{item.label}</button>
                  )
                )}
              </div>
            </div>
          );
        })()}

        {projectContextMenu && (
          <div
            onClick={() => setProjectContextMenu(null)}
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
          >
            <div style={{
              position: "fixed", left: projectContextMenu.x, top: projectContextMenu.y, zIndex: 201,
              background: "white", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.16)", minWidth: 180,
            }}>
              {[
                { label: "Load Project", action: () => loadCloudProject(projectContextMenu.projectId) },
                { label: "─" },
                { label: "Save Data as Dataset", action: () => saveProjectAsDataset(projectContextMenu.projectId) },
                { label: "Save Graph as Preset", action: () => saveProjectAsPreset(projectContextMenu.projectId) },
                { label: "─" },
                { label: "Delete Project", action: () => deleteCloudProject(projectContextMenu.projectId) },
              ].map((item, i) =>
                item.label === "─" ? (
                  <div key={i} style={{ height: 1, background: "#e2e8f0", margin: "3px 8px" }} />
                ) : (
                  <button key={item.label}
                    onClick={() => { item.action?.(); setProjectContextMenu(null); }}
                    style={{ display: "block", width: "100%", padding: "5px 14px", fontSize: 11, fontWeight: 500, color: item.label === "Delete Project" ? "#dc2626" : "#334155", textAlign: "left", background: "none", border: "none", cursor: "default" }}
                    onMouseEnter={(e) => { (e.currentTarget).style.background = "#f1f5f9"; }}
                    onMouseLeave={(e) => { (e.currentTarget).style.background = "none"; }}
                  >{item.label}</button>
                )
              )}
            </div>
          </div>
        )}

        {/* Chart Switch Setup Dialog */}
        {chartSwitchSetup && project && (
          <ChartSwitchSetupDialog
            open={true}
            chartType={chartSwitchSetup}
            currentSettings={effectiveSettings!}
            onApply={(overrides) => {
              commitPanel((pn) => ({ ...pn, graphSettings: { ...pn.graphSettings, ...overrides } }));
              setChartSwitchSetup(null);
            }}
            onCancel={() => setChartSwitchSetup(null)}
          />
        )}

        {/* Prompt Dialog */}
        {promptDialog && (
          <Dialog open={true} onOpenChange={() => setPromptDialog(null)}>
            <DialogContent className="max-w-[360px] p-0 gap-0 border-slate-300 shadow-xl overflow-hidden" style={{ borderRadius: 6 }}>
              <div style={{ background: "#f1f5f9", borderBottom: "1px solid #d1d5db", padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: "'Segoe UI', Inter, sans-serif" }}>
                {promptDialog.title}
              </div>
              <div style={{ padding: 16, fontFamily: "'Segoe UI', Inter, sans-serif" }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>{promptDialog.label}</div>
                <input
                  autoFocus
                  className="cs-props-input"
                  style={{ width: "100%", height: 28, marginBottom: 14 }}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && promptValue.trim()) {
                      promptDialog.onConfirm(promptValue.trim());
                      setPromptDialog(null);
                    }
                    if (e.key === "Escape") setPromptDialog(null);
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => setPromptDialog(null)} style={{ height: 28, padding: "0 14px", fontSize: 11, fontWeight: 600, background: "#f1f5f9", border: "1px solid #d1d5db", borderRadius: 3, color: "#475569", cursor: "default" }}>
                    Cancel
                  </button>
                  <button onClick={() => { if (promptValue.trim()) { promptDialog.onConfirm(promptValue.trim()); setPromptDialog(null); } }} style={{ height: 28, padding: "0 14px", fontSize: 11, fontWeight: 700, background: "#1e40af", border: "1px solid #1e3a8a", borderRadius: 3, color: "white", cursor: "default" }}>
                    OK
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Export Dialog */}
        {exportDialogOpen && (
          <Dialog open={true} onOpenChange={() => setExportDialogOpen(false)}>
            <DialogContent className="max-w-[400px] p-0 gap-0 border-slate-300 shadow-xl overflow-hidden" style={{ borderRadius: 6 }}>
              <div style={{ background: "#f1f5f9", borderBottom: "1px solid #d1d5db", padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Segoe UI', Inter, sans-serif" }}>
                <Download className="h-3.5 w-3.5" /> Export Chart
              </div>
              <div style={{ padding: 16, fontFamily: "'Segoe UI', Inter, sans-serif" }}>
                {/* Format */}
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Format</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                  {(["png", "svg", "pdf", "json"] as const).map((fmt) => (
                    <button key={fmt} onClick={() => setExportFormat(fmt)} style={{ flex: 1, height: 32, fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: exportFormat === fmt ? "#1e293b" : "#f8fafc", color: exportFormat === fmt ? "white" : "#475569", border: `1px solid ${exportFormat === fmt ? "#1e293b" : "#d1d5db"}`, borderRadius: 3, cursor: "default" }}>
                      {fmt}
                    </button>
                  ))}
                </div>

                {/* Resolution (only for PNG/PDF) */}
                {(exportFormat === "png" || exportFormat === "pdf") && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Resolution</div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                      {([150, 300, 600] as const).map((dpi) => (
                        <button key={dpi} onClick={() => setExportDPISel(dpi)} style={{ flex: 1, height: 30, fontSize: 11, fontWeight: 600, background: exportDPISel === dpi ? "#1e293b" : "#f8fafc", color: exportDPISel === dpi ? "white" : "#475569", border: `1px solid ${exportDPISel === dpi ? "#1e293b" : "#d1d5db"}`, borderRadius: 3, cursor: "default" }}>
                          {dpi} DPI
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 14 }}>
                      Output: {Math.round((project?.graphSettings.chartWidth || 740) * exportDPISel / 96)} × {Math.round((project?.graphSettings.chartHeight || 520) * exportDPISel / 96)} px
                    </div>
                  </>
                )}

                {/* Transparent background (PNG only) */}
                {exportFormat === "png" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Transparent background</span>
                    <Switch checked={exportTransparent} onCheckedChange={setExportTransparent} />
                  </div>
                )}

                {/* Info */}
                {exportFormat === "svg" && (
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 14, padding: "6px 8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 3 }}>
                    SVG exports are vector — infinitely scalable, ideal for publications.
                  </div>
                )}
                {exportFormat === "json" && (
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 14, padding: "6px 8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 3 }}>
                    JSON exports the full project — data, settings, and formatting. Can be re-imported later.
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => setExportDialogOpen(false)} style={{ height: 30, padding: "0 16px", fontSize: 11, fontWeight: 600, background: "#f1f5f9", border: "1px solid #d1d5db", borderRadius: 3, color: "#475569", cursor: "default", fontFamily: "'Segoe UI', Inter, sans-serif" }}>
                    Cancel
                  </button>
                  <button onClick={doExport} style={{ height: 30, padding: "0 20px", fontSize: 11, fontWeight: 700, background: "#1e40af", border: "1px solid #1e3a8a", borderRadius: 3, color: "white", cursor: "default", fontFamily: "'Segoe UI', Inter, sans-serif" }}>
                    Export {exportFormat.toUpperCase()}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Command Palette */}
        {cmdPaletteOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80, background: "rgba(0,0,0,0.3)" }} onClick={() => setCmdPaletteOpen(false)}>
            {(() => {
              const allGroups: { group: string; items: { label: string; action: () => void }[] }[] = [
                { group: "View", items: [
                  { label: "Go to Data Table", action: () => setActiveTab("data") },
                  { label: "Go to Graph", action: () => setActiveTab("graph") },
                  { label: "Go to Results", action: () => setActiveTab("results") },
                ]},
                { group: "Edit", items: [
                  { label: "Undo", action: undo },
                  { label: "Redo", action: redo },
                ]},
                { group: "Chart Type", items: [
                  { label: "Switch to Scatter Plot", action: () => setChartSwitchSetup("xy") },
                  { label: "Switch to Column Chart", action: () => setChartSwitchSetup("column") },
                  { label: "Switch to Box Plot", action: () => setChartSwitchSetup("box") },
                  { label: "Switch to Violin Plot", action: () => setChartSwitchSetup("violin") },
                  { label: "Switch to Histogram", action: () => setChartSwitchSetup("histogram") },
                  { label: "Switch to Survival Curve", action: () => setChartSwitchSetup("survival") },
                  { label: "Switch to Pie Chart", action: () => setChartSwitchSetup("parts-of-whole") },
                ]},
                { group: "Theme", items: [
                  { label: "Theme: Modern", action: () => updateGraphSetting("chartTheme", "modern") },
                  { label: "Theme: Classic", action: () => updateGraphSetting("chartTheme", "classic") },
                  { label: "Theme: Nature", action: () => updateGraphSetting("chartTheme", "nature") },
                  { label: "Theme: Dark", action: () => updateGraphSetting("chartTheme", "dark") },
                  { label: "Theme: Minimal", action: () => updateGraphSetting("chartTheme", "minimal") },
                  { label: "Theme: Presentation", action: () => updateGraphSetting("chartTheme", "presentation") },
                ]},
                { group: "Toggle", items: [
                  { label: (effectiveSettings?.showGrid ? "Hide" : "Show") + " Grid Lines", action: () => updateGraphSetting("showGrid", !effectiveSettings?.showGrid) },
                  { label: (effectiveSettings?.showErrorBars ? "Hide" : "Show") + " Error Bars", action: () => updateGraphSetting("showErrorBars", !effectiveSettings?.showErrorBars) },
                  { label: (effectiveSettings?.showDataPoints ? "Hide" : "Show") + " Data Points", action: () => updateGraphSetting("showDataPoints", !effectiveSettings?.showDataPoints) },
                  { label: (effectiveSettings?.yLogScale ? "Disable" : "Enable") + " Y-axis Log₁₀", action: () => updateGraphSetting("yLogScale", !effectiveSettings?.yLogScale) },
                  { label: (effectiveSettings?.showProvenance ? "Hide" : "Show") + " Reproducibility Badge", action: () => updateGraphSetting("showProvenance", !effectiveSettings?.showProvenance) },
                ]},
                { group: "Analysis", items: [
                  { label: "Run Unpaired t-test", action: () => { setAnalysisAutoTest("unpaired-t"); setActiveTab("results"); } },
                  { label: "Run One-Way ANOVA", action: () => { setAnalysisAutoTest("one-way-anova"); setActiveTab("results"); } },
                  { label: "Run Pearson Correlation", action: () => { setAnalysisAutoTest("pearson-corr"); setActiveTab("results"); } },
                  { label: "Run Normality Test", action: () => { setAnalysisAutoTest("normality"); setActiveTab("results"); } },
                  { label: "Descriptive Statistics", action: () => { setAnalysisAutoTest("descriptive"); setActiveTab("results"); } },
                ]},
                { group: "File", items: [
                  { label: "New Project", action: () => { setProject(null); setShowWelcome(true); } },
                  { label: "Import CSV", action: () => document.getElementById("csv-upload")?.click() },
                  { label: "Export as PNG", action: exportPNG },
                  { label: "Export as SVG", action: exportSVG },
                  { label: "Export as PDF", action: exportPDF },
                  { label: "Save Project", action: saveProjectLocal },
                  { label: "Load Last Saved", action: loadProjectLocal },
                  { label: "Add to Canvas", action: addToCanvas },
                ]},
                { group: "Data", items: [
                  { label: "Transpose Data", action: onTranspose },
                  { label: "Add Column", action: onAddColumn },
                  { label: "Add Row", action: onAddRow },
                ]},
              ];
              const q = cmdSearch.trim().toLowerCase();
              // Build a flat filtered list (keeps group headers when first match of a group is present)
              const flat: { group: string; label: string; action: () => void; isFirstOfGroup: boolean }[] = [];
              allGroups.forEach(({ group, items }) => {
                const matching = items.filter((it) => !q || it.label.toLowerCase().includes(q));
                matching.forEach((it, i) => {
                  flat.push({ group, label: it.label, action: it.action, isFirstOfGroup: i === 0 });
                });
              });
              const total = flat.length;
              const activeIdx = Math.min(cmdActiveIdx, Math.max(0, total - 1));
              const run = (i: number) => { const it = flat[i]; if (!it) return; it.action(); setCmdPaletteOpen(false); };
              return (
                <div style={{ width: 520, background: "white", border: "1px solid #d1d5db", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width={16} height={16} viewBox="0 0 16 16"><circle cx={7} cy={7} r={5} fill="none" stroke="#94a3b8" strokeWidth={1.5}/><line x1={11} y1={11} x2={15} y2={15} stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round"/></svg>
                    <input
                      autoFocus
                      value={cmdSearch}
                      onChange={(e) => { setCmdSearch(e.target.value); setCmdActiveIdx(0); }}
                      placeholder="Type a command or action…"
                      style={{ flex: 1, border: "none", outline: "none", fontSize: 13, fontFamily: "'Segoe UI', Inter, sans-serif", color: "#1a1a1a" }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { e.preventDefault(); setCmdPaletteOpen(false); }
                        else if (e.key === "ArrowDown") { e.preventDefault(); setCmdActiveIdx((i) => Math.min(total - 1, i + 1)); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setCmdActiveIdx((i) => Math.max(0, i - 1)); }
                        else if (e.key === "Enter") { e.preventDefault(); run(activeIdx); }
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#94a3b8", background: "#f1f5f9", padding: "2px 6px", borderRadius: 3, fontFamily: "ui-monospace, monospace" }}>ESC</span>
                  </div>
                  <div style={{ maxHeight: 340, overflowY: "auto", padding: 4 }}>
                    {total === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No matching commands</div>}
                    {flat.map((it, i) => (
                      <React.Fragment key={`${it.group}-${it.label}`}>
                        {it.isFirstOfGroup && (
                          <div style={{ padding: "6px 10px 3px", fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>{it.group}</div>
                        )}
                        <button
                          onMouseEnter={() => setCmdActiveIdx(i)}
                          onClick={() => run(i)}
                          ref={(el) => { if (el && i === activeIdx) el.scrollIntoView({ block: "nearest" }); }}
                          style={{
                            width: "100%", padding: "7px 10px", fontSize: 12, fontWeight: 500,
                            textAlign: "left", border: "none", cursor: "default", borderRadius: 4,
                            display: "block", fontFamily: "'Segoe UI', Inter, sans-serif",
                            color: i === activeIdx ? "#1e293b" : "#334155",
                            background: i === activeIdx ? "#dbeafe" : "none",
                          }}
                        >
                          {it.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ padding: "6px 12px", borderTop: "1px solid #e2e8f0", fontSize: 10, color: "#94a3b8", display: "flex", gap: 12, fontFamily: "ui-monospace, monospace" }}>
                    <span>↑↓ navigate</span>
                    <span>↵ run</span>
                    <span>esc close</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Transform Column Dialog */}
        {transformDialog?.open && (() => {
          const needsConstant = ["multiply", "divide", "add", "subtract", "power", "round", "runningavg", "minmaxcustom", "logratio", "ddct"].includes(transformDialog.type);
          const constantLabel: Record<string, string> = {
            multiply: "Multiply by", divide: "Divide by", add: "Add", subtract: "Subtract",
            power: "Exponent (n)", round: "Decimal places", runningavg: "Window size",
            minmaxcustom: "Scale to max value", logratio: "Reference column index (0-based)",
            ddct: "Reference gene column index (0-based)",
          };
          const friendlyName: Record<string, string> = {
            multiply: "Multiply", divide: "Divide", add: "Add Constant", subtract: "Subtract Constant",
            reciprocal: "Reciprocal (1/x)", abs: "Absolute Value", negate: "Negate (×−1)", round: "Round",
            log10: "Log₁₀", log2: "Log₂", ln: "Natural Log", sqrt: "Square Root",
            power: "Power (x^n)", boxcox: "Box-Cox Transform (auto λ)",
            antilog10: "Antilog₁₀ (10^x)", antilog2: "Antilog₂ (2^x)", antiloge: "Antilog e (e^x)",
            normalize: "Normalize (0–1)", minmaxcustom: "Min-Max to Custom Range",
            zscore: "Z-Score", robustzscore: "Robust Z-Score (MAD)",
            quantilenorm: "Quantile Normalization (all columns)", logratio: "Log-ratio to Reference Column",
            baseline: "Subtract Baseline", pctoftotal: "% of Total", percentilerank: "Percentile Rank",
            rank: "Rank Values", cumsum: "Cumulative Sum", runningavg: "Running Average", delta: "Delta (Δ from previous)",
            "fill-mean": "Fill Blanks with Mean", "fill-median": "Fill Blanks with Median", "fill-zero": "Fill Blanks with Zero",
            interpolate: "Interpolate Missing Values", "remove-blank-rows": "Remove Rows with Blanks",
            "remove-outliers-2sd": "Remove Outliers (beyond 2σ)", "remove-outliers-3sd": "Remove Outliers (beyond 3σ)",
            "remove-outliers-iqr": "Remove Outliers (IQR rule)",
            ddct: "ΔΔCt Calculation (qPCR)", pctinhibition: "% Inhibition from Control",
            pctchangefromfirst: "% Change from First Value", auc: "AUC (Trapezoidal)",
            survivalcensor: "Survival Censoring (→ 0/1)",
          };
          return (
          <Dialog open={true} onOpenChange={() => setTransformDialog(null)}>
            <DialogContent className="max-w-[380px] p-0 gap-0 border-slate-300 shadow-xl overflow-hidden [&>button:last-child]:hidden" style={{ borderRadius: 10 }}>
              <div style={{ background: "rgba(241,245,249,0.8)", borderBottom: "1px solid rgba(226,232,240,0.6)", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
                {friendlyName[transformDialog.type] || transformDialog.type}
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Select Column
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 160, overflowY: "auto" }}>
                  {effectiveColumns.map((col, ci) => (
                    <button key={ci} onClick={() => setTransformCol(ci)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, textAlign: "left", cursor: "default",
                      background: transformCol === ci ? "rgba(219,234,254,0.8)" : "rgba(248,250,252,0.6)",
                      border: `1px solid ${transformCol === ci ? "#93c5fd" : "rgba(226,232,240,0.6)"}`,
                      color: transformCol === ci ? "#1e40af" : "#475569", borderRadius: 8,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: (effectiveSettings!.traceColors || COLORS)[ci % COLORS.length] }} />
                      {col}
                    </button>
                  ))}
                </div>

                {/* Constant input for arithmetic transforms */}
                {needsConstant && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                      {constantLabel[transformDialog.type] || "Value"}
                    </div>
                    <input
                      type="number"
                      value={transformValue}
                      onChange={(e) => setTransformValue(Number(e.target.value))}
                      step={transformDialog.type === "round" ? 1 : "any"}
                      min={transformDialog.type === "round" ? 0 : undefined}
                      max={transformDialog.type === "round" ? 10 : undefined}
                      className="cs-props-input"
                      style={{ width: "100%", borderRadius: 8, height: 32, fontSize: 13, fontWeight: 600 }}
                      autoFocus
                    />
                    {transformDialog.type === "divide" && transformValue === 0 && (
                      <div style={{ fontSize: 10, color: "#dc2626", marginTop: 4 }}>Cannot divide by zero</div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button onClick={() => setTransformDialog(null)}
                    style={{ height: 30, padding: "0 16px", fontSize: 11, fontWeight: 600, background: "rgba(241,245,249,0.8)", border: "1px solid rgba(203,213,225,0.6)", borderRadius: 8, color: "#475569", cursor: "default" }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const t = transformDialog.type;
                      if (t.startsWith("fill-") || t.startsWith("remove-") || t === "interpolate") {
                        onMissingDataOp(transformCol, t);
                      } else {
                        onTransformColumn(transformCol, t, needsConstant ? transformValue : undefined);
                      }
                      setTransformDialog(null);
                    }}
                    disabled={transformDialog.type === "divide" && transformValue === 0}
                    style={{ height: 30, padding: "0 16px", fontSize: 11, fontWeight: 700, background: "#1e293b", border: "none", borderRadius: 8, color: "white", cursor: "default", opacity: transformDialog.type === "divide" && transformValue === 0 ? 0.4 : 1 }}>
                    Apply to "{effectiveColumns[transformCol]}"
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          );
        })()}

        {/* Column Operations Dialog (two-column picker) */}
        {colOpDialog?.open && (
          <Dialog open={true} onOpenChange={() => setColOpDialog(null)}>
            <DialogContent className="max-w-[380px] p-0 gap-0 border-slate-300 shadow-xl overflow-hidden [&>button:last-child]:hidden" style={{ borderRadius: 10 }}>
              <div style={{ background: "rgba(241,245,249,0.8)", borderBottom: "1px solid rgba(226,232,240,0.6)", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
                {colOpDialog.op === "diff" ? "Difference (A − B)" : colOpDialog.op === "ratio" ? "Ratio (A / B)" : "Fold Change (log₂(A/B))"}
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Column A</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {effectiveColumns.map((col, ci) => (
                        <button key={ci} onClick={() => setColOpA(ci)} style={{
                          padding: "4px 8px", fontSize: 11, fontWeight: 600, textAlign: "left", cursor: "default", borderRadius: 6,
                          background: colOpA === ci ? "rgba(219,234,254,0.8)" : "transparent",
                          border: `1px solid ${colOpA === ci ? "#93c5fd" : "rgba(226,232,240,0.4)"}`,
                          color: colOpA === ci ? "#1e40af" : "#475569",
                        }}>{col}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Column B</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {effectiveColumns.map((col, ci) => (
                        <button key={ci} onClick={() => setColOpB(ci)} style={{
                          padding: "4px 8px", fontSize: 11, fontWeight: 600, textAlign: "left", cursor: "default", borderRadius: 6,
                          background: colOpB === ci ? "rgba(219,234,254,0.8)" : "transparent",
                          border: `1px solid ${colOpB === ci ? "#93c5fd" : "rgba(226,232,240,0.4)"}`,
                          color: colOpB === ci ? "#1e40af" : "#475569",
                        }}>{col}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: "6px 10px", background: "rgba(241,245,249,0.6)", borderRadius: 8, fontSize: 10, color: "#64748b" }}>
                  Result column: <strong>{effectiveColumns[colOpA]} {colOpDialog.op === "diff" ? "−" : colOpDialog.op === "ratio" ? "/" : "FC vs"} {effectiveColumns[colOpB]}</strong>
                </div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button onClick={() => setColOpDialog(null)} style={{ height: 30, padding: "0 16px", fontSize: 11, fontWeight: 600, background: "rgba(241,245,249,0.8)", border: "1px solid rgba(203,213,225,0.6)", borderRadius: 8, color: "#475569", cursor: "default" }}>Cancel</button>
                  <button onClick={() => { onColumnOperation(colOpA, colOpB, colOpDialog.op); setColOpDialog(null); }}
                    disabled={colOpA === colOpB}
                    style={{ height: 30, padding: "0 16px", fontSize: 11, fontWeight: 700, background: colOpA === colOpB ? "#94a3b8" : "#1e293b", border: "none", borderRadius: 8, color: "white", cursor: "default" }}>
                    Create Column
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
};

// Error boundary wrapper
class ChartStudioErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "Inter, sans-serif" }}>
          <h2 style={{ color: "#dc2626", marginBottom: 8 }}>Chart Studio Error</h2>
          <pre style={{ fontSize: 12, color: "#475569", whiteSpace: "pre-wrap", background: "#f8fafc", padding: 16, borderRadius: 8 }}>{this.state.error.message}{"\n\n"}{this.state.error.stack}</pre>
          <button onClick={() => { this.setState({ error: null }); window.location.reload(); }} style={{ marginTop: 16, padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ChartStudioWrapper() {
  return <ChartStudioErrorBoundary><ChartStudio /></ChartStudioErrorBoundary>;
}

export default ChartStudioWrapper;
