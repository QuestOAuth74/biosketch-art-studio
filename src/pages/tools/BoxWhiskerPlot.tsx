import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, BarChart3 } from "lucide-react";
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
interface BoxStats {
  label: string;
  values: number[];
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  whiskerLow: number;
  whiskerHigh: number;
  outliers: number[];
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
  jama: {
    name: "JAMA",
    colors: ["#374E55", "#DF8F44", "#00A1D5", "#B24745", "#79AF97", "#6A6599", "#80796B", "#D73027"],
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

// ── Box Styles ──
type BoxStyle = "filled" | "outlined" | "gradient" | "striped" | "rounded";
const BOX_STYLES: { id: BoxStyle; name: string }[] = [
  { id: "filled", name: "Filled" },
  { id: "outlined", name: "Outlined" },
  { id: "gradient", name: "Gradient" },
  { id: "striped", name: "Striped" },
  { id: "rounded", name: "Rounded" },
];

// ── Example Datasets ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  gene_expression: {
    label: "Gene Expression",
    data: `Group\tValue
Control\t5.2
Control\t4.8
Control\t5.5
Control\t4.9
Control\t5.1
Control\t5.3
Control\t4.7
Control\t5.0
Control\t5.4
Control\t4.6
Treatment A\t7.8
Treatment A\t8.2
Treatment A\t7.5
Treatment A\t8.0
Treatment A\t7.9
Treatment A\t8.5
Treatment A\t7.3
Treatment A\t8.1
Treatment A\t7.7
Treatment A\t12.5
Treatment B\t6.1
Treatment B\t6.5
Treatment B\t6.3
Treatment B\t5.8
Treatment B\t6.7
Treatment B\t6.0
Treatment B\t6.4
Treatment B\t6.2
Treatment B\t6.6
Treatment B\t2.1`,
  },
  biomarker: {
    label: "Clinical Biomarker",
    data: `Group\tValue
Healthy\t45
Healthy\t52
Healthy\t48
Healthy\t50
Healthy\t47
Healthy\t55
Healthy\t43
Healthy\t51
Healthy\t49
Healthy\t46
Stage I\t62
Stage I\t58
Stage I\t65
Stage I\t60
Stage I\t63
Stage I\t57
Stage I\t67
Stage I\t61
Stage I\t59
Stage I\t64
Stage II\t78
Stage II\t82
Stage II\t75
Stage II\t80
Stage II\t85
Stage II\t77
Stage II\t83
Stage II\t79
Stage II\t81
Stage II\t110
Stage III\t95
Stage III\t102
Stage III\t98
Stage III\t105
Stage III\t92
Stage III\t108
Stage III\t100
Stage III\t97
Stage III\t103
Stage III\t130`,
  },
  cell_viability: {
    label: "Cell Viability (%)",
    data: `Group\tValue
DMSO\t98
DMSO\t95
DMSO\t97
DMSO\t96
DMSO\t99
DMSO\t94
DMSO\t97
DMSO\t96
Drug 10nM\t85
Drug 10nM\t82
Drug 10nM\t88
Drug 10nM\t80
Drug 10nM\t87
Drug 10nM\t83
Drug 10nM\t86
Drug 10nM\t84
Drug 100nM\t60
Drug 100nM\t55
Drug 100nM\t63
Drug 100nM\t58
Drug 100nM\t62
Drug 100nM\t57
Drug 100nM\t61
Drug 100nM\t56
Drug 1uM\t30
Drug 1uM\t25
Drug 1uM\t35
Drug 1uM\t28
Drug 1uM\t32
Drug 1uM\t27
Drug 1uM\t33
Drug 1uM\t29`,
  },
};

// ── Statistics ──
function calcQuartile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + (sorted[hi] ?? sorted[lo]) * frac;
}

function computeBoxStats(label: string, values: number[]): BoxStats {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = calcQuartile(sorted, 0.25);
  const median = calcQuartile(sorted, 0.5);
  const q3 = calcQuartile(sorted, 0.75);
  const iqr = q3 - q1;
  const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr);
  const whiskerHigh = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
  const outliers = sorted.filter(v => v < whiskerLow || v > whiskerHigh);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;

  return {
    label, values: sorted, min: sorted[0], q1, median, q3,
    max: sorted[sorted.length - 1], mean, whiskerLow, whiskerHigh, outliers,
  };
}

// ── Component ──
const BoxWhiskerPlot = () => {
  useTrackToolVisit("box-whisker-plot");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [rawData, setRawData] = useState(EXAMPLES.gene_expression.data);
  const [title, setTitle] = useState("Box & Whisker Plot");
  const [yLabel, setYLabel] = useState("Value");
  const [theme, setTheme] = useState("academic");
  const [boxStyle, setBoxStyle] = useState<BoxStyle>("filled");
  const [showPoints, setShowPoints] = useState(true);
  const [showMean, setShowMean] = useState(false);
  const [showNotch, setShowNotch] = useState(false);
  const [horizontal, setHorizontal] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0.6);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse data
  const groups = useMemo<BoxStats[]>(() => {
    const lines = rawData.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];

    const header = lines[0].split(/\t|,/);
    const isColumnFormat = header.length > 2 || (header.length === 2 && header[1] !== "Value" && header[1] !== "value");

    if (isColumnFormat && header.length > 1 && header[0].toLowerCase() !== "group") {
      // Column-per-group format
      const groupMap: Record<string, number[]> = {};
      header.forEach(h => { groupMap[h.trim()] = []; });
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/\t|,/);
        header.forEach((h, j) => {
          const val = parseFloat(cols[j]);
          if (!isNaN(val)) groupMap[h.trim()].push(val);
        });
      }
      return Object.entries(groupMap)
        .filter(([_, vals]) => vals.length >= 3)
        .map(([label, vals]) => computeBoxStats(label, vals));
    }

    // Two-column format: Group, Value
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
      .filter(label => groupMap[label].length >= 3)
      .map(label => computeBoxStats(label, groupMap[label]));
  }, [rawData]);

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

  // Y ticks
  const yTicks = useMemo(() => {
    const range = yMax - yMin;
    const step = range <= 10 ? 1 : range <= 50 ? 5 : range <= 100 ? 10 : Math.ceil(range / 8);
    const ticks: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) ticks.push(v);
    return ticks;
  }, [yMin, yMax]);

  // Jitter for data points
  const jitter = (idx: number, total: number) => {
    const spread = groupW * boxWidth * 0.3;
    return (Math.random() - 0.5) * spread;
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
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "box-whisker-plot.svg";
      a.click();
    } else {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = t.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => {
          if (!b) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = "box-whisker-plot.png";
          a.click();
        });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const openInCanvas = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(svgW));
    clone.setAttribute("height", String(svgH));
    clone.removeAttribute("class");
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = "text{font-family:Inter,system-ui,sans-serif}";
    clone.insertBefore(styleEl, clone.firstChild);
    const svgStr = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = svgW * 3; c.height = svgH * 3;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = t.bg; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/png");
      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"><image width="${svgW}" height="${svgH}" xlink:href="${dataUrl}"/></svg>`;
      sessionStorage.setItem("boxwhisker_svg_import", svgOut);
      window.location.href = "/canvas";
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) { setRawData(text); toast.success("Data loaded"); }
    };
    reader.readAsText(file);
  };

  const bw = groupW * boxWidth;
  const rr = boxStyle === "rounded" ? 4 : 0;

  return (
    <>
      <SEOHead
        title="Free Box & Whisker Plot Maker | BioSketch"
        description="Create publication-quality box and whisker plots online for free. Paste your data, choose color themes and styles, export as SVG or PNG."
        keywords="box plot maker, box and whisker plot, quartile plot, IQR, outlier detection, data visualization, free statistics tool"
        canonical="https://biosketch.art/box-whisker-plot"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Box & Whisker Plot Maker
              </h1>
              <p className="text-sm text-muted-foreground">Create box plots with quartiles, whiskers, and outlier detection</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              {/* Data Input */}
              <div className="space-y-2">
                <Label>Data (Group, Value — tab or comma separated)</Label>
                <Textarea
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                  placeholder="Group\tValue&#10;Control\t5.2&#10;Treatment\t7.8"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" /> Upload CSV
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileUpload} />
                </div>
              </div>

              {/* Examples */}
              <div className="space-y-2">
                <Label>Example Datasets</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(EXAMPLES).map(([key, ex]) => (
                    <Button key={key} variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => { setRawData(ex.data); toast.success(`Loaded: ${ex.label}`); }}>
                      {ex.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Labels */}
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Y-Axis Label</Label>
                <Input value={yLabel} onChange={(e) => setYLabel(e.target.value)} />
              </div>

              {/* Theme */}
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

              {/* Style */}
              <div className="space-y-2">
                <Label>Box Style</Label>
                <Select value={boxStyle} onValueChange={(v) => setBoxStyle(v as BoxStyle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOX_STYLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Data Points</Label>
                  <Switch checked={showPoints} onCheckedChange={setShowPoints} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Mean (diamond)</Label>
                  <Switch checked={showMean} onCheckedChange={setShowMean} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Notch</Label>
                  <Switch checked={showNotch} onCheckedChange={setShowNotch} />
                </div>
              </div>

              {/* Export */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => exportPlot("svg")}>
                  <Download className="h-3 w-3 mr-1" /> SVG
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportPlot("png")}>
                  <Download className="h-3 w-3 mr-1" /> PNG
                </Button>
                <Button size="sm" onClick={openInCanvas}>
                  Open in Canvas
                </Button>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-w-0">
              <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: t.bg }}>
                <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
                  <rect width={svgW} height={svgH} fill={t.bg} />

                  {/* Defs for gradients and patterns */}
                  <defs>
                    {groups.map((g, i) => {
                      const color = t.colors[i % t.colors.length];
                      return (
                        <linearGradient key={`grad-${i}`} id={`boxGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                          <stop offset="100%" stopColor={color} stopOpacity="0.5" />
                        </linearGradient>
                      );
                    })}
                    {groups.map((g, i) => {
                      const color = t.colors[i % t.colors.length];
                      return (
                        <pattern key={`stripe-${i}`} id={`boxStripe-${i}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                          <rect width="6" height="6" fill={color} fillOpacity="0.3" />
                          <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2" />
                        </pattern>
                      );
                    })}
                  </defs>

                  {/* Title */}
                  <text x={svgW / 2} y={28} textAnchor="middle" fill={t.text} fontSize="16" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">
                    {title}
                  </text>

                  {/* Y axis label */}
                  <text
                    x={18} y={margin.top + plotH / 2}
                    textAnchor="middle" fill={t.text} fontSize="12" fontFamily="Inter,system-ui,sans-serif"
                    transform={`rotate(-90, 18, ${margin.top + plotH / 2})`}
                  >
                    {yLabel}
                  </text>

                  {/* Grid lines and Y ticks */}
                  {yTicks.map((v) => (
                    <g key={v}>
                      <line x1={margin.left} y1={yScale(v)} x2={margin.left + plotW} y2={yScale(v)} stroke={t.grid} strokeWidth="1" />
                      <text x={margin.left - 8} y={yScale(v) + 4} textAnchor="end" fill={t.axis} fontSize="10" fontFamily="Inter,system-ui,sans-serif">
                        {v}
                      </text>
                    </g>
                  ))}

                  {/* X axis line */}
                  <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke={t.axis} strokeWidth="1" />
                  {/* Y axis line */}
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke={t.axis} strokeWidth="1" />

                  {/* Box plots */}
                  {groups.map((g, i) => {
                    const cx = xCenter(i);
                    const color = t.colors[i % t.colors.length];
                    const halfBox = bw / 2;

                    const boxFill =
                      boxStyle === "filled" || boxStyle === "rounded" ? color + "88" :
                      boxStyle === "gradient" ? `url(#boxGrad-${i})` :
                      boxStyle === "striped" ? `url(#boxStripe-${i})` :
                      "none";
                    const boxStroke = color;

                    return (
                      <g key={i}>
                        {/* Whisker lines */}
                        <line x1={cx} y1={yScale(g.whiskerHigh)} x2={cx} y2={yScale(g.q3)} stroke={color} strokeWidth="1.5" />
                        <line x1={cx} y1={yScale(g.q1)} x2={cx} y2={yScale(g.whiskerLow)} stroke={color} strokeWidth="1.5" />

                        {/* Whisker caps */}
                        <line x1={cx - halfBox * 0.4} y1={yScale(g.whiskerHigh)} x2={cx + halfBox * 0.4} y2={yScale(g.whiskerHigh)} stroke={color} strokeWidth="1.5" />
                        <line x1={cx - halfBox * 0.4} y1={yScale(g.whiskerLow)} x2={cx + halfBox * 0.4} y2={yScale(g.whiskerLow)} stroke={color} strokeWidth="1.5" />

                        {/* Box */}
                        {showNotch ? (
                          <path
                            d={`M ${cx - halfBox} ${yScale(g.q3)}
                                L ${cx - halfBox} ${yScale(g.median) - 4}
                                L ${cx - halfBox * 0.7} ${yScale(g.median)}
                                L ${cx - halfBox} ${yScale(g.median) + 4}
                                L ${cx - halfBox} ${yScale(g.q1)}
                                L ${cx + halfBox} ${yScale(g.q1)}
                                L ${cx + halfBox} ${yScale(g.median) + 4}
                                L ${cx + halfBox * 0.7} ${yScale(g.median)}
                                L ${cx + halfBox} ${yScale(g.median) - 4}
                                L ${cx + halfBox} ${yScale(g.q3)}
                                Z`}
                            fill={boxFill} stroke={boxStroke} strokeWidth="1.5"
                          />
                        ) : (
                          <rect
                            x={cx - halfBox} y={yScale(g.q3)}
                            width={bw} height={yScale(g.q1) - yScale(g.q3)}
                            rx={rr} ry={rr}
                            fill={boxFill} stroke={boxStroke} strokeWidth="1.5"
                          />
                        )}

                        {/* Median line */}
                        <line x1={cx - halfBox} y1={yScale(g.median)} x2={cx + halfBox} y2={yScale(g.median)} stroke={color} strokeWidth="2.5" />

                        {/* Mean diamond */}
                        {showMean && (
                          <polygon
                            points={`${cx},${yScale(g.mean) - 5} ${cx + 4},${yScale(g.mean)} ${cx},${yScale(g.mean) + 5} ${cx - 4},${yScale(g.mean)}`}
                            fill={t.bg} stroke={color} strokeWidth="1.5"
                          />
                        )}

                        {/* Data points (jittered) */}
                        {showPoints && g.values.filter(v => v >= g.whiskerLow && v <= g.whiskerHigh).map((v, j) => (
                          <circle
                            key={j}
                            cx={cx + jitter(j, g.values.length)}
                            cy={yScale(v)}
                            r="2.5"
                            fill={color}
                            fillOpacity="0.4"
                            stroke={color}
                            strokeWidth="0.5"
                            strokeOpacity="0.6"
                          />
                        ))}

                        {/* Outliers */}
                        {g.outliers.map((v, j) => (
                          <circle
                            key={`out-${j}`}
                            cx={cx}
                            cy={yScale(v)}
                            r="3.5"
                            fill="none"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                        ))}

                        {/* X label */}
                        <text
                          x={cx} y={margin.top + plotH + 20}
                          textAnchor="middle" fill={t.text} fontSize="11" fontFamily="Inter,system-ui,sans-serif"
                        >
                          {g.label}
                        </text>

                        {/* Stats annotation */}
                        <text
                          x={cx} y={margin.top + plotH + 35}
                          textAnchor="middle" fill={t.axis} fontSize="8" fontFamily="Inter,system-ui,sans-serif" opacity="0.7"
                        >
                          n={g.values.length}
                        </text>
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
                        <th className="text-right px-3 py-2 font-medium">Outliers</th>
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
                          <td className="text-right px-3 py-1.5">{g.outliers.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4">
                <ToolRating toolId="box-whisker-plot" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawData); navigate("/chart-studio?type=box"); }}
            style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600,
              background: "#1e40af", color: "white", border: "1px solid #1e3a8a",
              borderRadius: 6, cursor: "pointer", fontFamily: "'Segoe UI', Inter, sans-serif",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14"><rect x={1} y={7} width={3} height={6} rx={0.5} fill="white"/><rect x={5.5} y={3} width={3} height={10} rx={0.5} fill="white" opacity={0.7}/><rect x={10} y={5} width={3} height={8} rx={0.5} fill="white" opacity={0.4}/></svg>
            Open in Chart Studio
          </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BoxWhiskerPlot;
