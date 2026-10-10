import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

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
  colorblind: {
    name: "Colorblind Safe",
    colors: ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#F0E442", "#56B4E9", "#E69F00", "#000000"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
  grayscale: {
    name: "Grayscale (Print)",
    colors: ["#1a1a1a", "#4d4d4d", "#808080", "#b3b3b3", "#333333", "#666666", "#999999", "#cccccc"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000",
  },
};

// ── Example Datasets ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  gene_profile: {
    label: "Gene Expression Profile",
    data: `Category\tSample A\tSample B\tSample C
Apoptosis\t8.2\t5.1\t6.8
Cell Cycle\t6.5\t7.9\t4.3
DNA Repair\t7.1\t6.2\t8.5
Metabolism\t5.8\t8.4\t7.2
Signaling\t9.0\t4.7\t5.9
Transcription\t4.3\t7.5\t8.1`,
  },
  biomarker: {
    label: "Biomarker Comparison",
    data: `Biomarker\tHealthy\tDisease
CRP\t2.1\t7.8
IL-6\t1.5\t6.4
TNF-a\t3.2\t8.1
Albumin\t8.5\t4.2
Hemoglobin\t9.0\t5.5
WBC\t6.0\t8.9`,
  },
  skills: {
    label: "Lab Skills Assessment",
    data: `Skill\tStudent A\tStudent B
PCR\t9\t6
Western Blot\t7\t8
Cell Culture\t8\t5
Microscopy\t6\t9
Flow Cytometry\t5\t7
ELISA\t8\t4
Cloning\t7\t8`,
  },
};

interface ParsedData {
  axes: string[];
  series: { name: string; values: number[] }[];
  maxValue: number;
}

const svgW = 600;
const svgH = 600;
const cx = svgW / 2;
const cy = svgH / 2;
const chartRadius = 220;
const labelOffset = 30;

export default function RadarChart() {
  useTrackToolVisit("radar-chart");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawData, setRawData] = useState(EXAMPLES.gene_profile.data);
  const [title, setTitle] = useState("Radar Chart");
  const [theme, setTheme] = useState("academic");
  const [gridLevels, setGridLevels] = useState(5);
  const [showFill, setShowFill] = useState(true);
  const [fillOpacity, setFillOpacity] = useState(0.2);
  const [showDots, setShowDots] = useState(true);
  const [showValues, setShowValues] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(2);

  const t = COLOR_THEMES[theme] || COLOR_THEMES.academic;

  // Parse data
  const parsed: ParsedData | null = useMemo(() => {
    try {
      const lines = rawData.trim().split("\n").filter(Boolean);
      if (lines.length < 2) return null;

      const sep = lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(sep).map((s) => s.trim());
      const seriesNames = headers.slice(1);

      const axes: string[] = [];
      const seriesData: number[][] = seriesNames.map(() => []);

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map((s) => s.trim());
        if (cols.length < 2) continue;
        axes.push(cols[0]);
        for (let j = 1; j < cols.length && j <= seriesNames.length; j++) {
          const val = parseFloat(cols[j]);
          seriesData[j - 1].push(isNaN(val) ? 0 : val);
        }
      }

      if (axes.length < 3) return null;

      const allValues = seriesData.flat();
      const maxValue = Math.max(...allValues, 1);

      const series = seriesNames.map((name, i) => ({
        name,
        values: seriesData[i],
      }));

      return { axes, series, maxValue };
    } catch {
      return null;
    }
  }, [rawData]);

  // Helpers
  const angleFor = (i: number, total: number) => (Math.PI * 2 * i) / total - Math.PI / 2;

  const pointAt = (angle: number, radius: number) => ({
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  });

  // Nice max for grid
  const niceMax = useMemo(() => {
    if (!parsed) return 10;
    const raw = parsed.maxValue;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const candidates = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (const c of candidates) {
      if (c * magnitude >= raw) return c * magnitude;
    }
    return Math.ceil(raw);
  }, [parsed]);

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
      a.download = "radar-chart.svg";
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
        canvas.toBlob((b) => {
          if (!b) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = "radar-chart.png";
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
      sessionStorage.setItem("radarchart_svg_import", svgOut);
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
      if (text) { setRawData(text.trim()); toast.success("File loaded"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const n = parsed?.axes.length || 0;

  return (
    <>
      <SEOHead
        title="Free Radar Chart Maker | BioSketch"
        description="Create publication-quality radar charts (spider plots) online for free. Compare multiple datasets across categories. Export as SVG or PNG."
        keywords="radar chart maker, spider plot, radar plot, data visualization, multi-axis chart, free science tool"
        canonical="https://biosketch.art/radar-chart"
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
                <Radar className="h-6 w-6 text-primary" />
                Radar Chart Maker
              </h1>
              <p className="text-sm text-muted-foreground">Create spider/radar plots to compare multiple datasets across categories</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              {/* Data Input */}
              <div className="space-y-2">
                <Label>Data (Category, Series values — tab or comma separated)</Label>
                <Textarea
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                  placeholder={"Category\tSeries A\tSeries B\nAxis 1\t8\t6\nAxis 2\t5\t9"}
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
                    <Button key={key} variant="outline" size="sm" className="text-xs" onClick={() => setRawData(ex.data)}>
                      {ex.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Chart Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              {/* Theme */}
              <div className="space-y-2">
                <Label>Color Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLOR_THEMES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grid Levels */}
              <div className="space-y-2">
                <Label>Grid Levels: {gridLevels}</Label>
                <input type="range" min={3} max={10} value={gridLevels} onChange={(e) => setGridLevels(+e.target.value)} className="w-full" />
              </div>

              {/* Stroke Width */}
              <div className="space-y-2">
                <Label>Stroke Width: {strokeWidth}</Label>
                <input type="range" min={1} max={5} step={0.5} value={strokeWidth} onChange={(e) => setStrokeWidth(+e.target.value)} className="w-full" />
              </div>

              {/* Fill Opacity */}
              {showFill && (
                <div className="space-y-2">
                  <Label>Fill Opacity: {(fillOpacity * 100).toFixed(0)}%</Label>
                  <input type="range" min={0.05} max={0.5} step={0.05} value={fillOpacity} onChange={(e) => setFillOpacity(+e.target.value)} className="w-full" />
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Show Fill</Label>
                  <Switch checked={showFill} onCheckedChange={setShowFill} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Show Dots</Label>
                  <Switch checked={showDots} onCheckedChange={setShowDots} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Show Values</Label>
                  <Switch checked={showValues} onCheckedChange={setShowValues} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Show Legend</Label>
                  <Switch checked={showLegend} onCheckedChange={setShowLegend} />
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

              <ToolRating toolId="radar-chart" />
            </div>

            {/* Chart */}
            <div className="flex-1 flex flex-col items-center gap-4">
              <div className="w-full overflow-auto border rounded-lg bg-white p-4">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-auto max-h-[600px]"
                  style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                >
                  <rect width={svgW} height={svgH} fill={t.bg} />

                  {parsed && n >= 3 ? (
                    <>
                      {/* Grid rings */}
                      {Array.from({ length: gridLevels }, (_, lvl) => {
                        const r = (chartRadius * (lvl + 1)) / gridLevels;
                        const pts = Array.from({ length: n }, (_, i) => {
                          const a = angleFor(i, n);
                          return pointAt(a, r);
                        });
                        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
                        return (
                          <path key={`grid-${lvl}`} d={d} fill="none" stroke={t.grid} strokeWidth={0.5} />
                        );
                      })}

                      {/* Grid level labels */}
                      {Array.from({ length: gridLevels }, (_, lvl) => {
                        const val = (niceMax * (lvl + 1)) / gridLevels;
                        const r = (chartRadius * (lvl + 1)) / gridLevels;
                        return (
                          <text
                            key={`glabel-${lvl}`}
                            x={cx + 4}
                            y={cy - r + 4}
                            fontSize={9}
                            fill={t.text}
                            opacity={0.5}
                          >
                            {Number.isInteger(val) ? val : val.toFixed(1)}
                          </text>
                        );
                      })}

                      {/* Axis spokes */}
                      {parsed.axes.map((_, i) => {
                        const a = angleFor(i, n);
                        const end = pointAt(a, chartRadius);
                        return (
                          <line key={`spoke-${i}`} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={t.grid} strokeWidth={0.5} />
                        );
                      })}

                      {/* Axis labels */}
                      {parsed.axes.map((label, i) => {
                        const a = angleFor(i, n);
                        const p = pointAt(a, chartRadius + labelOffset);
                        const cos = Math.cos(a);
                        let anchor = "middle";
                        if (cos > 0.1) anchor = "start";
                        else if (cos < -0.1) anchor = "end";
                        return (
                          <text
                            key={`label-${i}`}
                            x={p.x}
                            y={p.y}
                            textAnchor={anchor}
                            dominantBaseline="central"
                            fontSize={11}
                            fontWeight={600}
                            fill={t.text}
                          >
                            {label}
                          </text>
                        );
                      })}

                      {/* Data series */}
                      {parsed.series.map((series, si) => {
                        const color = t.colors[si % t.colors.length];
                        const points = series.values.map((v, i) => {
                          const a = angleFor(i, n);
                          const r = (v / niceMax) * chartRadius;
                          return pointAt(a, Math.min(r, chartRadius));
                        });
                        const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

                        return (
                          <g key={`series-${si}`}>
                            {/* Fill */}
                            {showFill && (
                              <path d={d} fill={color} opacity={fillOpacity} stroke="none" />
                            )}
                            {/* Stroke */}
                            <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
                            {/* Dots */}
                            {showDots && points.map((p, i) => (
                              <circle key={`dot-${si}-${i}`} cx={p.x} cy={p.y} r={3.5} fill={color} stroke={t.bg} strokeWidth={1.5} />
                            ))}
                            {/* Values */}
                            {showValues && points.map((p, i) => {
                              const a = angleFor(i, n);
                              const nudge = 14;
                              return (
                                <text
                                  key={`val-${si}-${i}`}
                                  x={p.x + Math.cos(a) * nudge}
                                  y={p.y + Math.sin(a) * nudge}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fontSize={9}
                                  fontWeight={600}
                                  fill={color}
                                >
                                  {series.values[i]}
                                </text>
                              );
                            })}
                          </g>
                        );
                      })}

                      {/* Title */}
                      {title && (
                        <text x={cx} y={24} textAnchor="middle" fontSize={16} fontWeight={700} fill={t.text}>
                          {title}
                        </text>
                      )}

                      {/* Legend */}
                      {showLegend && parsed.series.length > 1 && (
                        <g>
                          {parsed.series.map((s, i) => {
                            const color = t.colors[i % t.colors.length];
                            const lx = svgW - 140;
                            const ly = 20 + i * 20;
                            return (
                              <g key={`legend-${i}`}>
                                <rect x={lx} y={ly - 5} width={14} height={14} rx={2} fill={color} opacity={0.8} />
                                <text x={lx + 20} y={ly + 5} fontSize={11} fill={t.text} dominantBaseline="central">
                                  {s.name}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      )}
                    </>
                  ) : (
                    <text x={cx} y={cy} textAnchor="middle" fontSize={14} fill={t.text} opacity={0.5}>
                      Enter at least 3 axes and 1 series to generate chart
                    </text>
                  )}
                </svg>
              </div>

              {/* Data table */}
              {parsed && parsed.series.length > 0 && (
                <div className="w-full overflow-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-semibold">Category</th>
                        {parsed.series.map((s) => (
                          <th key={s.name} className="text-right p-2 font-semibold">{s.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.axes.map((axis, i) => (
                        <tr key={axis} className="border-t border-border/30">
                          <td className="p-2 font-medium">{axis}</td>
                          {parsed.series.map((s) => (
                            <td key={s.name} className="text-right p-2 tabular-nums">{s.values[i]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
