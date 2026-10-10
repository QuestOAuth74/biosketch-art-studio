import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, BarChart2 } from "lucide-react";
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
interface BarGroup {
  label: string;
  subgroups: { name: string; mean: number; error: number; values: number[] }[];
}

// ── Color Themes (publication-grade) ──
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

type BarStyle = "solid" | "outlined" | "striped" | "rounded";
type ErrorType = "sem" | "sd" | "ci95" | "custom";
type BarLayout = "grouped" | "stacked";

const BAR_STYLES: { id: BarStyle; name: string }[] = [
  { id: "solid", name: "Solid Fill" },
  { id: "outlined", name: "Outlined" },
  { id: "striped", name: "Striped" },
  { id: "rounded", name: "Rounded" },
];

// ── Example Datasets ──
const EXAMPLES: Record<string, { label: string; data: string; format: string }> = {
  gene_expression: {
    label: "Gene Expression",
    format: "mean_error",
    data: `Group\tCondition\tMean\tSEM
TP53\tControl\t5.2\t0.4
TP53\tTreated\t8.7\t0.6
BRCA1\tControl\t3.8\t0.3
BRCA1\tTreated\t6.1\t0.5
MYC\tControl\t4.5\t0.35
MYC\tTreated\t9.2\t0.7`,
  },
  cell_viability: {
    label: "Cell Viability",
    format: "raw",
    data: `Group\tValue
DMSO\t98
DMSO\t95
DMSO\t97
DMSO\t96
DMSO\t99
DMSO\t94
Drug 10nM\t85
Drug 10nM\t82
Drug 10nM\t88
Drug 10nM\t80
Drug 10nM\t87
Drug 10nM\t83
Drug 100nM\t60
Drug 100nM\t55
Drug 100nM\t63
Drug 100nM\t58
Drug 100nM\t62
Drug 100nM\t57
Drug 1uM\t30
Drug 1uM\t25
Drug 1uM\t35
Drug 1uM\t28
Drug 1uM\t32
Drug 1uM\t27`,
  },
  protein_levels: {
    label: "Protein Levels",
    format: "mean_error",
    data: `Group\tCondition\tMean\tSEM
Liver\tWT\t120\t8
Liver\tKO\t45\t5
Kidney\tWT\t95\t6
Kidney\tKO\t30\t4
Brain\tWT\t80\t7
Brain\tKO\t65\t6
Heart\tWT\t110\t9
Heart\tKO\t55\t5`,
  },
};

// ── Statistics ──
function calcSEM(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance / n);
}

function calcSD(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

function calcCI95(values: number[]): number {
  return calcSEM(values) * 1.96;
}

// ── Significance brackets ──
interface SigBracket {
  group1: number;
  group2: number;
  label: string;
}

// ── Component ──
const BarChartErrorBars = () => {
  useTrackToolVisit("bar-chart");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [rawData, setRawData] = useState(EXAMPLES.gene_expression.data);
  const [dataFormat, setDataFormat] = useState<"raw" | "mean_error">("mean_error");
  const [title, setTitle] = useState("Bar Chart with Error Bars");
  const [yLabel, setYLabel] = useState("Value");
  const [theme, setTheme] = useState("academic");
  const [barStyle, setBarStyle] = useState<BarStyle>("solid");
  const [errorType, setErrorType] = useState<ErrorType>("sem");
  const [barLayout, setBarLayout] = useState<BarLayout>("grouped");
  const [showValues, setShowValues] = useState(false);
  const [showDots, setShowDots] = useState(false);
  const [barWidth, setBarWidth] = useState(0.7);
  const [sigBrackets, setSigBrackets] = useState<SigBracket[]>([]);
  const [newBracketG1, setNewBracketG1] = useState("");
  const [newBracketG2, setNewBracketG2] = useState("");
  const [newBracketLabel, setNewBracketLabel] = useState("*");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse data into BarGroups
  const { groups, subgroupNames } = useMemo(() => {
    const lines = rawData.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return { groups: [] as BarGroup[], subgroupNames: [] as string[] };

    const header = lines[0].split(/\t|,/).map(h => h.trim());

    if (dataFormat === "mean_error") {
      // Format: Group, Condition, Mean, SEM/SD
      const groupMap: Record<string, { name: string; mean: number; error: number; values: number[] }[]> = {};
      const order: string[] = [];
      const subNames = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\t|,/).map(p => p.trim());
        if (parts.length < 3) continue;
        const group = parts[0];
        const condition = parts.length >= 4 ? parts[1] : "Value";
        const mean = parseFloat(parts.length >= 4 ? parts[2] : parts[1]);
        const error = parseFloat(parts.length >= 4 ? parts[3] : parts[2]) || 0;
        if (isNaN(mean)) continue;

        if (!groupMap[group]) { groupMap[group] = []; order.push(group); }
        subNames.add(condition);
        groupMap[group].push({ name: condition, mean, error, values: [mean] });
      }

      return {
        groups: order.map(label => ({ label, subgroups: groupMap[label] })),
        subgroupNames: [...subNames],
      };
    }

    // Raw format: Group, Value
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

    const calcError = (vals: number[]) => {
      if (errorType === "sd") return calcSD(vals);
      if (errorType === "ci95") return calcCI95(vals);
      return calcSEM(vals);
    };

    return {
      groups: order.map(label => {
        const vals = groupMap[label];
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        return {
          label,
          subgroups: [{ name: "Value", mean, error: calcError(vals), values: vals }],
        };
      }),
      subgroupNames: ["Value"],
    };
  }, [rawData, dataFormat, errorType]);

  // SVG dimensions
  const svgW = 700, svgH = 450;
  const margin = { top: 50, right: 30, bottom: 80, left: 70 };
  const plotW = svgW - margin.left - margin.right;
  const plotH = svgH - margin.top - margin.bottom;

  const t = COLOR_THEMES[theme];

  // Y scale
  const allMeans = groups.flatMap(g => g.subgroups.map(s => s.mean + s.error));
  const yMax = allMeans.length > 0 ? Math.ceil(Math.max(...allMeans) * 1.2) : 10;
  const yScale = (v: number) => margin.top + plotH - (v / yMax) * plotH;

  // X layout
  const groupW = groups.length > 0 ? plotW / groups.length : plotW;

  // Y ticks
  const yTicks = useMemo(() => {
    const step = yMax <= 10 ? 1 : yMax <= 50 ? 5 : yMax <= 100 ? 10 : Math.ceil(yMax / 8);
    const ticks: number[] = [];
    for (let v = 0; v <= yMax; v += step) ticks.push(v);
    return ticks;
  }, [yMax]);

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
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "bar-chart.svg"; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "bar-chart.png"; a.click(); });
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
      const c = document.createElement("canvas");
      c.width = svgW * 3; c.height = svgH * 3;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/png");
      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"><image width="${svgW}" height="${svgH}" xlink:href="${dataUrl}"/></svg>`;
      sessionStorage.setItem("barchart_svg_import", svgOut);
      window.location.href = "/canvas";
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; if (text) { setRawData(text); toast.success("Data loaded"); } };
    reader.readAsText(file);
  };

  const addBracket = () => {
    const g1 = parseInt(newBracketG1);
    const g2 = parseInt(newBracketG2);
    if (isNaN(g1) || isNaN(g2) || g1 === g2 || g1 < 0 || g2 < 0 || g1 >= groups.length || g2 >= groups.length) {
      toast.error("Invalid group indices"); return;
    }
    setSigBrackets(prev => [...prev, { group1: g1, group2: g2, label: newBracketLabel || "*" }]);
    setNewBracketLabel("*");
  };

  const rr = barStyle === "rounded" ? 3 : 0;

  return (
    <>
      <SEOHead
        title="Free Bar Chart with Error Bars | BioSketch"
        description="Create publication-quality bar charts with SEM, SD, or 95% CI error bars online for free. Grouped and stacked layouts, significance brackets, multiple color themes."
        keywords="bar chart maker, error bars, SEM, standard deviation, grouped bar chart, significance brackets, scientific figure, free bar chart tool"
        canonical="https://biosketch.art/bar-chart"
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
                <BarChart2 className="h-6 w-6 text-primary" />
                Bar Chart with Error Bars
              </h1>
              <p className="text-sm text-muted-foreground">Grouped bars with SEM, SD, or 95% CI error bars and significance brackets</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              <div className="space-y-2">
                <Label>Data Format</Label>
                <Select value={dataFormat} onValueChange={(v) => setDataFormat(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mean_error">Mean + Error (Group, Condition, Mean, SEM)</SelectItem>
                    <SelectItem value="raw">Raw Values (Group, Value)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
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
                      onClick={() => { setRawData(ex.data); setDataFormat(ex.format as any); toast.success(`Loaded: ${ex.label}`); }}>
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
                <Label>Bar Style</Label>
                <Select value={barStyle} onValueChange={(v) => setBarStyle(v as BarStyle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BAR_STYLES.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {dataFormat === "raw" && (
                <div className="space-y-2">
                  <Label>Error Bars</Label>
                  <Select value={errorType} onValueChange={(v) => setErrorType(v as ErrorType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem">SEM</SelectItem>
                      <SelectItem value="sd">Standard Deviation</SelectItem>
                      <SelectItem value="ci95">95% Confidence Interval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Values</Label>
                  <Switch checked={showValues} onCheckedChange={setShowValues} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Data Points</Label>
                  <Switch checked={showDots} onCheckedChange={setShowDots} />
                </div>
              </div>

              {/* Significance Brackets */}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-semibold">Significance Brackets</Label>
                <div className="flex gap-1.5 items-end">
                  <div className="flex-1">
                    <Label className="text-[10px]">G1 (index)</Label>
                    <Input value={newBracketG1} onChange={(e) => setNewBracketG1(e.target.value)} placeholder="0" className="h-7 text-xs" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px]">G2 (index)</Label>
                    <Input value={newBracketG2} onChange={(e) => setNewBracketG2(e.target.value)} placeholder="1" className="h-7 text-xs" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px]">Label</Label>
                    <Input value={newBracketLabel} onChange={(e) => setNewBracketLabel(e.target.value)} placeholder="*" className="h-7 text-xs" />
                  </div>
                  <Button size="sm" className="h-7 text-xs" onClick={addBracket}>Add</Button>
                </div>
                {sigBrackets.length > 0 && (
                  <div className="space-y-1">
                    {sigBrackets.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{groups[b.group1]?.label || b.group1} vs {groups[b.group2]?.label || b.group2}: {b.label}</span>
                        <button onClick={() => setSigBrackets(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:underline">remove</button>
                      </div>
                    ))}
                  </div>
                )}
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

                  {/* Defs */}
                  <defs>
                    {t.colors.map((color, i) => (
                      <pattern key={`stripe-${i}`} id={`barStripe-${i}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="6" height="6" fill={color} fillOpacity="0.3" />
                        <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2" />
                      </pattern>
                    ))}
                  </defs>

                  {/* Title */}
                  <text x={svgW / 2} y={28} textAnchor="middle" fill={t.text} fontSize="16" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">
                    {title}
                  </text>

                  {/* Y axis label */}
                  <text x={18} y={margin.top + plotH / 2} textAnchor="middle" fill={t.text} fontSize="12" fontFamily="Inter,system-ui,sans-serif"
                    transform={`rotate(-90, 18, ${margin.top + plotH / 2})`}>
                    {yLabel}
                  </text>

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

                  {/* Bars */}
                  {groups.map((g, gi) => {
                    const nSub = subgroupNames.length;
                    const totalBarW = groupW * barWidth;
                    const singleBarW = totalBarW / nSub;
                    const groupLeft = margin.left + groupW * gi + (groupW - totalBarW) / 2;

                    return (
                      <g key={gi}>
                        {g.subgroups.map((sub, si) => {
                          const colorIdx = nSub > 1 ? si : gi;
                          const color = t.colors[colorIdx % t.colors.length];
                          const barX = groupLeft + singleBarW * si;
                          const barH = Math.max(0, (sub.mean / yMax) * plotH);
                          const barY = yScale(sub.mean);

                          const fill = barStyle === "outlined" ? "none" :
                            barStyle === "striped" ? `url(#barStripe-${colorIdx % t.colors.length})` : color;

                          return (
                            <g key={si}>
                              {/* Bar */}
                              <rect
                                x={barX} y={barY}
                                width={singleBarW - 2} height={barH}
                                rx={rr} ry={rr}
                                fill={fill} stroke={color} strokeWidth="1.5"
                              />

                              {/* Error bar */}
                              {sub.error > 0 && (
                                <g>
                                  <line
                                    x1={barX + (singleBarW - 2) / 2} y1={yScale(sub.mean + sub.error)}
                                    x2={barX + (singleBarW - 2) / 2} y2={yScale(sub.mean - sub.error)}
                                    stroke={t.axis} strokeWidth="1.5"
                                  />
                                  {/* Top cap */}
                                  <line
                                    x1={barX + (singleBarW - 2) / 2 - 5} y1={yScale(sub.mean + sub.error)}
                                    x2={barX + (singleBarW - 2) / 2 + 5} y2={yScale(sub.mean + sub.error)}
                                    stroke={t.axis} strokeWidth="1.5"
                                  />
                                  {/* Bottom cap */}
                                  <line
                                    x1={barX + (singleBarW - 2) / 2 - 5} y1={yScale(Math.max(0, sub.mean - sub.error))}
                                    x2={barX + (singleBarW - 2) / 2 + 5} y2={yScale(Math.max(0, sub.mean - sub.error))}
                                    stroke={t.axis} strokeWidth="1.5"
                                  />
                                </g>
                              )}

                              {/* Data dots */}
                              {showDots && sub.values.length > 1 && sub.values.map((v, vi) => (
                                <circle
                                  key={vi}
                                  cx={barX + (singleBarW - 2) / 2 + (Math.random() - 0.5) * (singleBarW * 0.3)}
                                  cy={yScale(v)}
                                  r="2.5" fill={t.axis} fillOpacity="0.5"
                                />
                              ))}

                              {/* Value label */}
                              {showValues && (
                                <text
                                  x={barX + (singleBarW - 2) / 2} y={barY - 4 - (sub.error > 0 ? (sub.error / yMax) * plotH : 0)}
                                  textAnchor="middle" fill={t.text} fontSize="9" fontFamily="Inter,system-ui,sans-serif"
                                >
                                  {sub.mean.toFixed(1)}
                                </text>
                              )}
                            </g>
                          );
                        })}

                        {/* X label */}
                        <text
                          x={margin.left + groupW * gi + groupW / 2} y={margin.top + plotH + 20}
                          textAnchor="middle" fill={t.text} fontSize="11" fontFamily="Inter,system-ui,sans-serif"
                        >
                          {g.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Significance brackets */}
                  {sigBrackets.map((b, bi) => {
                    const x1 = margin.left + groupW * b.group1 + groupW / 2;
                    const x2 = margin.left + groupW * b.group2 + groupW / 2;
                    const bracketY = margin.top - 5 - bi * 18;

                    return (
                      <g key={`sig-${bi}`}>
                        <line x1={x1} y1={bracketY + 8} x2={x1} y2={bracketY} stroke={t.axis} strokeWidth="1" />
                        <line x1={x1} y1={bracketY} x2={x2} y2={bracketY} stroke={t.axis} strokeWidth="1" />
                        <line x1={x2} y1={bracketY} x2={x2} y2={bracketY + 8} stroke={t.axis} strokeWidth="1" />
                        <text x={(x1 + x2) / 2} y={bracketY - 3} textAnchor="middle" fill={t.text} fontSize="12" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">
                          {b.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Legend (for grouped bars with multiple conditions) */}
                  {subgroupNames.length > 1 && (
                    <g>
                      {subgroupNames.map((name, i) => {
                        const lx = margin.left + plotW - 120;
                        const ly = margin.top + 10 + i * 18;
                        const color = t.colors[i % t.colors.length];
                        return (
                          <g key={i}>
                            <rect x={lx} y={ly} width="12" height="12" fill={color} rx="2" />
                            <text x={lx + 18} y={ly + 10} fill={t.text} fontSize="10" fontFamily="Inter,system-ui,sans-serif">{name}</text>
                          </g>
                        );
                      })}
                    </g>
                  )}
                </svg>
              </div>

              <div className="mt-4">
                <ToolRating toolId="bar-chart" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawData); navigate("/chart-studio?type=column"); }}
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

export default BarChartErrorBars;
