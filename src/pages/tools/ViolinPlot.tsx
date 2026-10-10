import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// ── Types ──
interface ViolinGroup {
  label: string;
  values: number[];
  sorted: number[];
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  kde: { x: number; density: number }[];
  maxDensity: number;
}

// ── Color Themes ──
const COLOR_THEMES: Record<string, { name: string; colors: string[]; bg: string; axis: string; grid: string; text: string }> = {
  academic: {
    name: "Academic",
    colors: ["#2166AC", "#D6604D", "#4DAF4A", "#FF7F00", "#984EA3", "#A65628", "#E7298A", "#66A61E"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
  nature: {
    name: "Nature Journal",
    colors: ["#E64B35", "#4DBBD5", "#00A087", "#3C5488", "#F39B7F", "#8491B4", "#91D1C2", "#DC0000"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
  science: {
    name: "Science / AAAS",
    colors: ["#3B4992", "#EE0000", "#008B45", "#631879", "#008280", "#BB0021", "#5F559B", "#A20056"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
  lancet: {
    name: "Lancet",
    colors: ["#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F", "#FDAF91", "#AD002A", "#ADB6B6"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
  nejm: {
    name: "NEJM",
    colors: ["#BC3C29", "#0072B5", "#E18727", "#20854E", "#7876B1", "#6F99AD", "#FFDC91", "#EE4C97"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
  grayscale: {
    name: "Grayscale (Print)",
    colors: ["#1a1a1a", "#4d4d4d", "#808080", "#b3b3b3", "#333333", "#666666", "#999999", "#cccccc"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
  colorblind: {
    name: "Colorblind Safe",
    colors: ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#F0E442", "#56B4E9", "#E69F00", "#000000"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
  allblack: {
    name: "All Black",
    colors: ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
};

type ViolinStyle = "filled" | "outlined" | "half" | "split";

// ── Example Datasets ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  gene_expression: {
    label: "Gene Expression",
    data: `Group\tValue
Control\t5.2\nControl\t4.8\nControl\t5.5\nControl\t4.9\nControl\t5.1\nControl\t5.3\nControl\t4.7\nControl\t5.0\nControl\t5.4\nControl\t4.6\nControl\t5.15\nControl\t4.85\nControl\t5.35\nControl\t5.05\nControl\t4.95\nControl\t5.25\nControl\t4.75\nControl\t5.45\nControl\t5.08\nControl\t4.92
Treatment A\t7.8\nTreatment A\t8.2\nTreatment A\t7.5\nTreatment A\t8.0\nTreatment A\t7.9\nTreatment A\t8.5\nTreatment A\t7.3\nTreatment A\t8.1\nTreatment A\t7.7\nTreatment A\t7.6\nTreatment A\t8.3\nTreatment A\t7.4\nTreatment A\t8.4\nTreatment A\t7.85\nTreatment A\t8.15\nTreatment A\t7.65\nTreatment A\t7.95\nTreatment A\t8.05\nTreatment A\t7.55\nTreatment A\t12.5
Treatment B\t6.1\nTreatment B\t6.5\nTreatment B\t6.3\nTreatment B\t5.8\nTreatment B\t6.7\nTreatment B\t6.0\nTreatment B\t6.4\nTreatment B\t6.2\nTreatment B\t6.6\nTreatment B\t6.15\nTreatment B\t6.45\nTreatment B\t6.35\nTreatment B\t5.9\nTreatment B\t6.55\nTreatment B\t6.05\nTreatment B\t6.25\nTreatment B\t6.12\nTreatment B\t6.48\nTreatment B\t6.32\nTreatment B\t2.1`,
  },
  biomarker: {
    label: "Clinical Biomarker",
    data: `Group\tValue
Healthy\t45\nHealthy\t52\nHealthy\t48\nHealthy\t50\nHealthy\t47\nHealthy\t55\nHealthy\t43\nHealthy\t51\nHealthy\t49\nHealthy\t46\nHealthy\t53\nHealthy\t44\nHealthy\t50\nHealthy\t48\nHealthy\t47\nHealthy\t51\nHealthy\t46\nHealthy\t54\nHealthy\t49\nHealthy\t52
Stage I\t62\nStage I\t58\nStage I\t65\nStage I\t60\nStage I\t63\nStage I\t57\nStage I\t67\nStage I\t61\nStage I\t59\nStage I\t64\nStage I\t56\nStage I\t66\nStage I\t60\nStage I\t62\nStage I\t58\nStage I\t63\nStage I\t61\nStage I\t59\nStage I\t65\nStage I\t57
Stage II\t78\nStage II\t82\nStage II\t75\nStage II\t80\nStage II\t85\nStage II\t77\nStage II\t83\nStage II\t79\nStage II\t81\nStage II\t76\nStage II\t84\nStage II\t78\nStage II\t80\nStage II\t82\nStage II\t77\nStage II\t83\nStage II\t79\nStage II\t81\nStage II\t85\nStage II\t110`,
  },
  response_time: {
    label: "Response Time (ms)",
    data: `Group\tValue
Placebo\t320\nPlacebo\t345\nPlacebo\t310\nPlacebo\t360\nPlacebo\t335\nPlacebo\t325\nPlacebo\t350\nPlacebo\t315\nPlacebo\t340\nPlacebo\t330\nPlacebo\t355\nPlacebo\t305\nPlacebo\t365\nPlacebo\t328\nPlacebo\t342\nPlacebo\t318\nPlacebo\t348\nPlacebo\t322\nPlacebo\t338\nPlacebo\t352
Drug Low\t280\nDrug Low\t295\nDrug Low\t270\nDrug Low\t300\nDrug Low\t285\nDrug Low\t275\nDrug Low\t305\nDrug Low\t290\nDrug Low\t265\nDrug Low\t310\nDrug Low\t278\nDrug Low\t292\nDrug Low\t268\nDrug Low\t302\nDrug Low\t288\nDrug Low\t282\nDrug Low\t296\nDrug Low\t272\nDrug Low\t298\nDrug Low\t286
Drug High\t220\nDrug High\t240\nDrug High\t210\nDrug High\t250\nDrug High\t230\nDrug High\t215\nDrug High\t245\nDrug High\t225\nDrug High\t235\nDrug High\t205\nDrug High\t255\nDrug High\t218\nDrug High\t242\nDrug High\t228\nDrug High\t238\nDrug High\t212\nDrug High\t248\nDrug High\t222\nDrug High\t232\nDrug High\t208`,
  },
};

// ── KDE (Kernel Density Estimation) ──
function gaussianKDE(values: number[], bandwidth: number, nPoints: number = 100): { x: number; density: number }[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15;
  const lo = min - pad;
  const hi = max + pad;
  const step = (hi - lo) / (nPoints - 1);
  const n = values.length;

  const result: { x: number; density: number }[] = [];
  for (let i = 0; i < nPoints; i++) {
    const x = lo + i * step;
    let sum = 0;
    for (const v of values) {
      const z = (x - v) / bandwidth;
      sum += Math.exp(-0.5 * z * z);
    }
    const density = sum / (n * bandwidth * Math.sqrt(2 * Math.PI));
    result.push({ x, density });
  }
  return result;
}

function calcQuartile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + (sorted[hi] ?? sorted[lo]) * frac;
}

function silvermanBandwidth(values: number[]): number {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  const sorted = [...values].sort((a, b) => a - b);
  const iqr = calcQuartile(sorted, 0.75) - calcQuartile(sorted, 0.25);
  const A = Math.min(sd, iqr / 1.34);
  return 0.9 * A * Math.pow(n, -0.2);
}

// ── Component ──
const ViolinPlot = () => {
  useTrackToolVisit("violin-plot");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [rawData, setRawData] = useState(EXAMPLES.gene_expression.data);
  const [title, setTitle] = useState("Violin Plot");
  const [yLabel, setYLabel] = useState("Value");
  const [theme, setTheme] = useState("academic");
  const [violinStyle, setViolinStyle] = useState<ViolinStyle>("filled");
  const [showBox, setShowBox] = useState(true);
  const [showMedian, setShowMedian] = useState(true);
  const [showMean, setShowMean] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [bandwidth, setBandwidth] = useState<"auto" | number>("auto");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse data
  const groups = useMemo<ViolinGroup[]>(() => {
    const lines = rawData.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];

    const groupMap: Record<string, number[]> = {};
    const order: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\t|,/);
      if (parts.length < 2) continue;
      const label = parts[0].trim();
      const val = parseFloat(parts[1]);
      if (!label || isNaN(val)) continue;
      if (!groupMap[label]) { groupMap[label] = []; order.push(label); }
      groupMap[label].push(val);
    }

    return order
      .filter(label => groupMap[label].length >= 4)
      .map(label => {
        const values = groupMap[label];
        const sorted = [...values].sort((a, b) => a - b);
        const bw = bandwidth === "auto" ? silvermanBandwidth(values) : bandwidth;
        const kde = gaussianKDE(values, Math.max(bw, 0.001));
        const maxDensity = Math.max(...kde.map(p => p.density));
        return {
          label, values, sorted,
          min: sorted[0],
          q1: calcQuartile(sorted, 0.25),
          median: calcQuartile(sorted, 0.5),
          q3: calcQuartile(sorted, 0.75),
          max: sorted[sorted.length - 1],
          mean: values.reduce((s, v) => s + v, 0) / values.length,
          kde, maxDensity,
        };
      });
  }, [rawData, bandwidth]);

  // SVG dimensions
  const svgW = 700, svgH = 450;
  const margin = { top: 50, right: 30, bottom: 70, left: 70 };
  const plotW = svgW - margin.left - margin.right;
  const plotH = svgH - margin.top - margin.bottom;

  const t = COLOR_THEMES[theme];

  // Y scale
  const allValues = groups.flatMap(g => g.values);
  const dataMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 10;
  const yPad = (dataMax - dataMin) * 0.1 || 1;
  const yMin = Math.floor(dataMin - yPad);
  const yMax = Math.ceil(dataMax + yPad);
  const yScale = (v: number) => margin.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // X layout
  const groupW = groups.length > 0 ? plotW / groups.length : plotW;
  const xCenter = (i: number) => margin.left + groupW * i + groupW / 2;

  // Global max density for consistent width scaling
  const globalMaxDensity = Math.max(...groups.map(g => g.maxDensity), 0.001);
  const maxHalfWidth = groupW * 0.4;

  // Y ticks
  const yTicks = useMemo(() => {
    const range = yMax - yMin;
    const step = range <= 10 ? 1 : range <= 50 ? 5 : range <= 100 ? 10 : Math.ceil(range / 8);
    const ticks: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) ticks.push(v);
    return ticks;
  }, [yMin, yMax]);

  // Build violin path
  const buildViolinPath = (g: ViolinGroup, cx: number, side: "both" | "left" | "right" = "both"): string => {
    const points = g.kde.map(p => ({
      y: yScale(p.x),
      w: (p.density / globalMaxDensity) * maxHalfWidth,
    }));

    if (side === "both") {
      const rightSide = points.map(p => `${cx + p.w},${p.y}`).join(" L ");
      const leftSide = [...points].reverse().map(p => `${cx - p.w},${p.y}`).join(" L ");
      return `M ${cx + points[0].w},${points[0].y} L ${rightSide} L ${leftSide} Z`;
    } else if (side === "right") {
      const rightSide = points.map(p => `${cx + p.w},${p.y}`).join(" L ");
      return `M ${cx},${points[0].y} L ${rightSide} L ${cx},${points[points.length - 1].y} Z`;
    } else {
      const leftSide = points.map(p => `${cx - p.w},${p.y}`).join(" L ");
      return `M ${cx},${points[0].y} L ${leftSide} L ${cx},${points[points.length - 1].y} Z`;
    }
  };

  // Export
  const exportPlot = (format: "svg" | "png") => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = "text{font-family:Inter,system-ui,sans-serif}";
    clone.insertBefore(styleEl, clone.firstChild);
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: "image/svg+xml" });
    if (format === "svg") {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "violin-plot.svg"; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "violin-plot.png"; a.click(); });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const openInCanvas = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(svgW)); clone.setAttribute("height", String(svgH));
    clone.removeAttribute("class");
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = "text{font-family:Inter,system-ui,sans-serif}";
    clone.insertBefore(styleEl, clone.firstChild);
    const svgStr = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = svgW * 3; c.height = svgH * 3;
      const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/png");
      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"><image width="${svgW}" height="${svgH}" xlink:href="${dataUrl}"/></svg>`;
      sessionStorage.setItem("violin_svg_import", svgOut);
      window.location.href = "/canvas";
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; if (text) { setRawData(text); toast.success("Data loaded"); } };
    reader.readAsText(file);
  };

  return (
    <>
      <SEOHead
        title="Free Violin Plot Maker | BioSketch"
        description="Create publication-quality violin plots online for free. Kernel density estimation with inner box plots, quartile markers, and data point overlays. Multiple journal color themes."
        keywords="violin plot maker, kernel density plot, data distribution, KDE, box plot alternative, scientific figure, free violin plot tool"
        canonical="https://biosketch.art/violin-plot"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                Violin Plot Maker
              </h1>
              <p className="text-sm text-muted-foreground">Kernel density estimation with inner box plots and data overlays</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              <div className="space-y-2">
                <Label>Data (Group, Value — tab or comma separated)</Label>
                <Textarea value={rawData} onChange={(e) => setRawData(e.target.value)} rows={8} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1" /> Upload CSV
                </Button>
                <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileUpload} />
              </div>

              <div className="space-y-2">
                <Label>Examples</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(EXAMPLES).map(([key, ex]) => (
                    <Button key={key} variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => { setRawData(ex.data); toast.success(`Loaded: ${ex.label}`); }}>
                      {ex.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Y-Axis Label</Label>
                <Input value={yLabel} onChange={(e) => setYLabel(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Color Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLOR_THEMES).map(([id, th]) => (
                      <SelectItem key={id} value={id}>
                        <span className="flex items-center gap-2">
                          <span className="flex gap-0.5">
                            {th.colors.slice(0, 4).map((c, i) => (
                              <span key={i} className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: c }} />
                            ))}
                          </span>
                          {th.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Violin Style</Label>
                <Select value={violinStyle} onValueChange={(v) => setViolinStyle(v as ViolinStyle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="filled">Filled</SelectItem>
                    <SelectItem value="outlined">Outlined</SelectItem>
                    <SelectItem value="half">Half (Right)</SelectItem>
                    <SelectItem value="split">Split (Left + Right)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Inner Box Plot</Label>
                  <Switch checked={showBox} onCheckedChange={setShowBox} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Median Line</Label>
                  <Switch checked={showMedian} onCheckedChange={setShowMedian} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Mean Marker</Label>
                  <Switch checked={showMean} onCheckedChange={setShowMean} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Data Points</Label>
                  <Switch checked={showPoints} onCheckedChange={setShowPoints} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => exportPlot("svg")}><Download className="h-3 w-3 mr-1" /> SVG</Button>
                <Button size="sm" variant="outline" onClick={() => exportPlot("png")}><Download className="h-3 w-3 mr-1" /> PNG</Button>
                <Button size="sm" onClick={openInCanvas}>Open in Canvas</Button>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-w-0">
              <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: t.bg }}>
                <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
                  <rect width={svgW} height={svgH} fill={t.bg} />

                  {/* Title */}
                  <text x={svgW / 2} y={28} textAnchor="middle" fill={t.text} fontSize="16" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">{title}</text>

                  {/* Y axis label */}
                  <text x={18} y={margin.top + plotH / 2} textAnchor="middle" fill={t.text} fontSize="12" fontFamily="Inter,system-ui,sans-serif"
                    transform={`rotate(-90, 18, ${margin.top + plotH / 2})`}>{yLabel}</text>

                  {/* Grid + Y ticks */}
                  {yTicks.map(v => (
                    <g key={v}>
                      <line x1={margin.left} y1={yScale(v)} x2={margin.left + plotW} y2={yScale(v)} stroke={t.grid} strokeWidth="1" />
                      <text x={margin.left - 8} y={yScale(v) + 4} textAnchor="end" fill={t.axis} fontSize="10" fontFamily="Inter,system-ui,sans-serif">{v}</text>
                    </g>
                  ))}

                  {/* Axes */}
                  <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke={t.axis} strokeWidth="1" />
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke={t.axis} strokeWidth="1" />

                  {/* Violins */}
                  {groups.map((g, i) => {
                    const cx = xCenter(i);
                    const color = t.colors[i % t.colors.length];

                    const side = violinStyle === "half" ? "right" : violinStyle === "split" ? "both" : "both";
                    const path = buildViolinPath(g, cx, side);
                    const fillColor = violinStyle === "outlined" ? "none" : color;
                    const fillOpacity = violinStyle === "outlined" ? 0 : 0.35;

                    return (
                      <g key={i}>
                        {/* Violin shape */}
                        <path d={path} fill={fillColor} fillOpacity={fillOpacity} stroke={color} strokeWidth="1.5" />

                        {/* Inner box plot */}
                        {showBox && (
                          <g>
                            {/* Whisker line */}
                            <line x1={cx} y1={yScale(g.min)} x2={cx} y2={yScale(g.max)} stroke={t.axis} strokeWidth="1" />
                            {/* Box */}
                            <rect
                              x={cx - 6} y={yScale(g.q3)}
                              width={12} height={yScale(g.q1) - yScale(g.q3)}
                              fill={color} stroke={t.axis} strokeWidth="1"
                            />
                          </g>
                        )}

                        {/* Median */}
                        {showMedian && (
                          <circle cx={cx} cy={yScale(g.median)} r="3" fill={t.bg} stroke={t.axis} strokeWidth="1.5" />
                        )}

                        {/* Mean */}
                        {showMean && (
                          <polygon
                            points={`${cx},${yScale(g.mean) - 4} ${cx + 3.5},${yScale(g.mean)} ${cx},${yScale(g.mean) + 4} ${cx - 3.5},${yScale(g.mean)}`}
                            fill="none" stroke={color} strokeWidth="1.5"
                          />
                        )}

                        {/* Data points (jittered inside violin width) */}
                        {showPoints && g.values.map((v, j) => {
                          const kdePoint = g.kde.reduce((best, p) => Math.abs(p.x - v) < Math.abs(best.x - v) ? p : best);
                          const w = (kdePoint.density / globalMaxDensity) * maxHalfWidth;
                          const jitterX = (Math.random() - 0.5) * w * 0.8;
                          return (
                            <circle key={j} cx={cx + jitterX} cy={yScale(v)} r="2" fill={color} fillOpacity="0.5" stroke={color} strokeWidth="0.5" strokeOpacity="0.7" />
                          );
                        })}

                        {/* X label */}
                        <text x={cx} y={margin.top + plotH + 20} textAnchor="middle" fill={t.text} fontSize="11" fontFamily="Inter,system-ui,sans-serif">{g.label}</text>
                        <text x={cx} y={margin.top + plotH + 35} textAnchor="middle" fill={t.axis} fontSize="8" fontFamily="Inter,system-ui,sans-serif" opacity="0.7">n={g.values.length}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Stats table */}
              {groups.length > 0 && (
                <div className="mt-4 overflow-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Group</th>
                        <th className="text-right px-3 py-2 font-medium">n</th>
                        <th className="text-right px-3 py-2 font-medium">Min</th>
                        <th className="text-right px-3 py-2 font-medium">Q1</th>
                        <th className="text-right px-3 py-2 font-medium">Median</th>
                        <th className="text-right px-3 py-2 font-medium">Q3</th>
                        <th className="text-right px-3 py-2 font-medium">Max</th>
                        <th className="text-right px-3 py-2 font-medium">Mean</th>
                        <th className="text-right px-3 py-2 font-medium">IQR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{g.label}</td>
                          <td className="text-right px-3 py-1.5">{g.values.length}</td>
                          <td className="text-right px-3 py-1.5">{g.min.toFixed(2)}</td>
                          <td className="text-right px-3 py-1.5">{g.q1.toFixed(2)}</td>
                          <td className="text-right px-3 py-1.5 font-semibold">{g.median.toFixed(2)}</td>
                          <td className="text-right px-3 py-1.5">{g.q3.toFixed(2)}</td>
                          <td className="text-right px-3 py-1.5">{g.max.toFixed(2)}</td>
                          <td className="text-right px-3 py-1.5">{g.mean.toFixed(2)}</td>
                          <td className="text-right px-3 py-1.5">{(g.q3 - g.q1).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4"><ToolRating toolId="violin-plot" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawData); navigate("/chart-studio?type=violin"); }}
            style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600,
              background: "#1e40af", color: "white", border: "1px solid #1e3a8a",
              borderRadius: 6, cursor: "pointer", fontFamily: "'Segoe UI', Inter, sans-serif",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14"><rect x={1} y={7} width={3} height={6} rx={0.5} fill="white"/><rect x={5.5} y={3} width={3} height={10} rx={0.5} fill="white" opacity={0.7}/><rect x={10} y={5} width={3} height={8} rx={0.5} fill="white" opacity={0.4}/></svg>
            Open in Chart Studio
          </button></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ViolinPlot;
