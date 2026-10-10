import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, Target } from "lucide-react";
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
interface ROCPoint { fpr: number; tpr: number; threshold: number; }
interface ROCData { label: string; points: ROCPoint[]; auc: number; }

// ── Color Themes ──
const COLOR_THEMES: Record<string, { name: string; colors: string[]; bg: string; axis: string; grid: string; text: string; diagonal: string }> = {
  academic: {
    name: "Academic",
    colors: ["#2166AC", "#D6604D", "#4DAF4A", "#FF7F00", "#984EA3", "#A65628"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000", diagonal: "#cccccc",
  },
  nature: {
    name: "Nature Journal",
    colors: ["#E64B35", "#4DBBD5", "#00A087", "#3C5488", "#F39B7F", "#8491B4"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000", diagonal: "#cccccc",
  },
  lancet: {
    name: "Lancet",
    colors: ["#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F", "#FDAF91"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000", diagonal: "#cccccc",
  },
  colorblind: {
    name: "Colorblind Safe",
    colors: ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#F0E442", "#56B4E9"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000", diagonal: "#cccccc",
  },
  allblack: {
    name: "All Black",
    colors: ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    bg: "#ffffff", axis: "#000000", grid: "#e0e0e0", text: "#000000", diagonal: "#cccccc",
  },
};

type LineStyle = "solid" | "varied";

// ── Example Datasets ──
// Generate realistic ROC data with controlled overlap for target AUC
function generateROCData(nPerClass: number, negMean: number, negStd: number, posMean: number, posStd: number, seed: number): string {
  // Simple seeded pseudo-random (mulberry32)
  let s = seed;
  const rand = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // Box-Muller for normal distribution
  const randn = () => { const u1 = rand(), u2 = rand(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  const clamp = (v: number) => Math.max(0.01, Math.min(0.99, v));

  const lines = ["Score\tLabel"];
  for (let i = 0; i < nPerClass; i++) lines.push(`${clamp(negMean + negStd * randn()).toFixed(3)}\t0`);
  for (let i = 0; i < nPerClass; i++) lines.push(`${clamp(posMean + posStd * randn()).toFixed(3)}\t1`);
  return lines.join("\n");
}

function generateMultiModelData(n: number, seed: number): string {
  let s = seed;
  const rand = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const randn = () => { const u1 = rand(), u2 = rand(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
  const clamp = (v: number) => Math.max(0.01, Math.min(0.99, v));

  // Weak: small separation → AUC ~0.62, Good: moderate → ~0.80, Strong: large → ~0.90
  const lines = ["Weak_Model\tGood_Model\tStrong_Model\tLabel"];
  for (let i = 0; i < n; i++) {
    const w = clamp(0.42 + 0.15 * randn());
    const g = clamp(0.35 + 0.14 * randn());
    const st = clamp(0.28 + 0.12 * randn());
    lines.push(`${w.toFixed(3)}\t${g.toFixed(3)}\t${st.toFixed(3)}\t0`);
  }
  for (let i = 0; i < n; i++) {
    const w = clamp(0.55 + 0.15 * randn());
    const g = clamp(0.65 + 0.14 * randn());
    const st = clamp(0.75 + 0.12 * randn());
    lines.push(`${w.toFixed(3)}\t${g.toFixed(3)}\t${st.toFixed(3)}\t1`);
  }
  return lines.join("\n");
}

const EXAMPLES: Record<string, { label: string; data: string }> = {
  biomarker: {
    label: "Biomarker (AUC ~0.80)",
    data: generateROCData(100, 0.38, 0.15, 0.62, 0.15, 42),
  },
  multi_model: {
    label: "3 Models (AUC ~0.62 / 0.80 / 0.90)",
    data: generateMultiModelData(100, 77),
  },
  diagnostic: {
    label: "Diagnostic Test (AUC ~0.90)",
    data: generateROCData(100, 0.30, 0.13, 0.70, 0.13, 99),
  },
};

// ── ROC Computation ──
function computeROC(scores: number[], labels: number[]): { points: ROCPoint[]; auc: number } {
  const pairs = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => b.s - a.s);
  const nPos = labels.filter(l => l === 1).length;
  const nNeg = labels.filter(l => l === 0).length;
  if (nPos === 0 || nNeg === 0) return { points: [{ fpr: 0, tpr: 0, threshold: 1 }, { fpr: 1, tpr: 1, threshold: 0 }], auc: 0.5 };

  const points: ROCPoint[] = [{ fpr: 0, tpr: 0, threshold: Infinity }];
  let tp = 0, fp = 0;

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].l === 1) tp++;
    else fp++;
    // Only add point if threshold changes or it's the last point
    if (i === pairs.length - 1 || pairs[i].s !== pairs[i + 1].s) {
      points.push({ fpr: fp / nNeg, tpr: tp / nPos, threshold: pairs[i].s });
    }
  }

  // AUC via trapezoidal rule
  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    auc += (points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr) / 2;
  }

  return { points, auc };
}

// ── Component ──
const ROCCurve = () => {
  useTrackToolVisit("roc-curve");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [rawData, setRawData] = useState(EXAMPLES.biomarker.data);
  const [title, setTitle] = useState("ROC Curve");
  const [theme, setTheme] = useState("academic");
  const [lineStyle, setLineStyle] = useState<LineStyle>("solid");
  const [showDiagonal, setShowDiagonal] = useState(true);
  const [showAUC, setShowAUC] = useState(true);
  const [showOptimalPoint, setShowOptimalPoint] = useState(true);
  const [lineWidth, setLineWidth] = useState(2);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse data — supports single or multi-model
  const curves = useMemo<ROCData[]>(() => {
    const lines = rawData.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];

    const header = lines[0].split(/\t|,/).map(h => h.trim());
    const labelColIdx = header.findIndex(h => h.toLowerCase() === "label" || h.toLowerCase() === "class" || h.toLowerCase() === "outcome");
    if (labelColIdx === -1) return [];

    const scoreColIdxs = header.map((_, i) => i).filter(i => i !== labelColIdx);

    const rows: number[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\t|,/).map(p => parseFloat(p.trim()));
      if (parts.some(isNaN)) continue;
      rows.push(parts);
    }

    const labels = rows.map(r => r[labelColIdx]);

    return scoreColIdxs.map(colIdx => {
      const scores = rows.map(r => r[colIdx]);
      const { points, auc } = computeROC(scores, labels);
      return { label: header[colIdx], points, auc };
    });
  }, [rawData]);

  // SVG dimensions
  const svgW = 550, svgH = 500;
  const margin = { top: 50, right: 30, bottom: 60, left: 60 };
  const plotW = svgW - margin.left - margin.right;
  const plotH = svgH - margin.top - margin.bottom;

  const t = COLOR_THEMES[theme];
  const xScale = (v: number) => margin.left + v * plotW;
  const yScale = (v: number) => margin.top + plotH - v * plotH;

  // Ticks
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // Dash patterns for multi-curve
  const dashPatterns = ["none", "8 4", "4 4", "12 4 4 4", "2 4", "8 4 2 4"];

  // Optimal point (Youden's index)
  const getOptimalPoint = (points: ROCPoint[]) => {
    let best = points[0];
    let bestJ = -1;
    for (const p of points) {
      const j = p.tpr - p.fpr;
      if (j > bestJ) { bestJ = j; best = p; }
    }
    return best;
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
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "roc-curve.svg"; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "roc-curve.png"; a.click(); });
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
      sessionStorage.setItem("roc_svg_import", svgOut);
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
        title="Free ROC Curve Maker | BioSketch"
        description="Create publication-quality ROC curves online for free. Calculate AUC, compare multiple models, find optimal cutoffs with Youden's index. Export as SVG or PNG."
        keywords="ROC curve maker, AUC calculator, receiver operating characteristic, sensitivity specificity, Youden index, diagnostic test, classifier evaluation, free ROC tool"
        canonical="https://biosketch.art/roc-curve"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Target className="h-6 w-6 text-primary" />
                ROC Curve Maker
              </h1>
              <p className="text-sm text-muted-foreground">Receiver Operating Characteristic curves with AUC and optimal cutoff</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              <div className="space-y-2">
                <Label>Data (Score columns + Label column, tab/comma separated)</Label>
                <Textarea value={rawData} onChange={(e) => setRawData(e.target.value)} rows={8} className="font-mono text-xs" />
                <p className="text-[10px] text-muted-foreground">Last column named "Label" (0/1). Multiple score columns = multiple curves.</p>
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
                <Label>Color Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLOR_THEMES).map(([id, th]) => (
                      <SelectItem key={id} value={id}>
                        <span className="flex items-center gap-2">
                          <span className="flex gap-0.5">
                            {th.colors.slice(0, 3).map((c, i) => (
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
                <Label>Line Style (multi-curve)</Label>
                <Select value={lineStyle} onValueChange={(v) => setLineStyle(v as LineStyle)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">All Solid</SelectItem>
                    <SelectItem value="varied">Varied (solid, dashed, dotted)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Diagonal Reference</Label>
                  <Switch checked={showDiagonal} onCheckedChange={setShowDiagonal} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show AUC in Legend</Label>
                  <Switch checked={showAUC} onCheckedChange={setShowAUC} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Optimal Cutoff Point</Label>
                  <Switch checked={showOptimalPoint} onCheckedChange={setShowOptimalPoint} />
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
              <div className="border rounded-lg overflow-hidden bg-white">
                <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
                  <rect width={svgW} height={svgH} fill={t.bg} />

                  {/* Title */}
                  <text x={svgW / 2} y={28} textAnchor="middle" fill={t.text} fontSize="16" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">{title}</text>

                  {/* Grid */}
                  {ticks.map(v => (
                    <g key={v}>
                      <line x1={xScale(v)} y1={margin.top} x2={xScale(v)} y2={margin.top + plotH} stroke={t.grid} strokeWidth="0.5" />
                      <line x1={margin.left} y1={yScale(v)} x2={margin.left + plotW} y2={yScale(v)} stroke={t.grid} strokeWidth="0.5" />
                    </g>
                  ))}

                  {/* Axes */}
                  <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke={t.axis} strokeWidth="1" />
                  <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke={t.axis} strokeWidth="1" />

                  {/* Axis labels */}
                  <text x={margin.left + plotW / 2} y={svgH - 10} textAnchor="middle" fill={t.text} fontSize="12" fontFamily="Inter,system-ui,sans-serif">
                    False Positive Rate (1 - Specificity)
                  </text>
                  <text x={15} y={margin.top + plotH / 2} textAnchor="middle" fill={t.text} fontSize="12" fontFamily="Inter,system-ui,sans-serif"
                    transform={`rotate(-90, 15, ${margin.top + plotH / 2})`}>
                    True Positive Rate (Sensitivity)
                  </text>

                  {/* Tick labels */}
                  {ticks.map(v => (
                    <g key={`tick-${v}`}>
                      <text x={xScale(v)} y={margin.top + plotH + 18} textAnchor="middle" fill={t.axis} fontSize="10" fontFamily="Inter,system-ui,sans-serif">{v.toFixed(1)}</text>
                      <text x={margin.left - 8} y={yScale(v) + 4} textAnchor="end" fill={t.axis} fontSize="10" fontFamily="Inter,system-ui,sans-serif">{v.toFixed(1)}</text>
                    </g>
                  ))}

                  {/* Diagonal reference line */}
                  {showDiagonal && (
                    <line x1={xScale(0)} y1={yScale(0)} x2={xScale(1)} y2={yScale(1)} stroke={t.diagonal} strokeWidth="1" strokeDasharray="6 3" />
                  )}

                  {/* ROC Curves */}
                  {curves.map((curve, ci) => {
                    const color = t.colors[ci % t.colors.length];
                    const dash = lineStyle === "varied" ? dashPatterns[ci % dashPatterns.length] : "none";
                    const pathD = curve.points.map((p, i) =>
                      `${i === 0 ? "M" : "L"} ${xScale(p.fpr)} ${yScale(p.tpr)}`
                    ).join(" ");

                    const optimal = getOptimalPoint(curve.points);

                    return (
                      <g key={ci}>
                        <path d={pathD} fill="none" stroke={color} strokeWidth={lineWidth}
                          strokeDasharray={dash === "none" ? undefined : dash} />

                        {/* Optimal point */}
                        {showOptimalPoint && (
                          <g>
                            <circle cx={xScale(optimal.fpr)} cy={yScale(optimal.tpr)} r="5" fill="none" stroke={color} strokeWidth="2" />
                            <circle cx={xScale(optimal.fpr)} cy={yScale(optimal.tpr)} r="2" fill={color} />
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Legend — positioned bottom-right to avoid overlapping curves */}
                  {curves.length > 0 && (() => {
                    const legendH = curves.length * 18 + 12;
                    const lx = margin.left + plotW - 200;
                    const lyStart = margin.top + plotH - legendH;
                    return (
                      <g>
                        {/* Legend background */}
                        <rect x={lx - 6} y={lyStart - 6} width={210} height={legendH + 4} rx="3" fill={t.bg} fillOpacity="0.9" stroke={t.grid} strokeWidth="0.5" />
                        {curves.map((curve, ci) => {
                          const color = t.colors[ci % t.colors.length];
                          const dash = lineStyle === "varied" ? dashPatterns[ci % dashPatterns.length] : "none";
                          const ly = lyStart + ci * 18 + 6;
                          return (
                            <g key={ci}>
                              <line x1={lx} y1={ly} x2={lx + 20} y2={ly} stroke={color} strokeWidth={lineWidth}
                                strokeDasharray={dash === "none" ? undefined : dash} />
                              <text x={lx + 26} y={ly + 4} fill={t.text} fontSize="10" fontFamily="Inter,system-ui,sans-serif">
                                {curve.label}{showAUC ? ` (AUC = ${curve.auc.toFixed(3)})` : ""}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}
                </svg>
              </div>

              {/* Stats table */}
              {curves.length > 0 && (
                <div className="mt-4 overflow-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Model</th>
                        <th className="text-right px-3 py-2 font-medium">AUC</th>
                        <th className="text-right px-3 py-2 font-medium">Optimal Threshold</th>
                        <th className="text-right px-3 py-2 font-medium">Sensitivity</th>
                        <th className="text-right px-3 py-2 font-medium">Specificity</th>
                        <th className="text-right px-3 py-2 font-medium">Youden's J</th>
                      </tr>
                    </thead>
                    <tbody>
                      {curves.map((curve, i) => {
                        const opt = getOptimalPoint(curve.points);
                        return (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5 font-medium">{curve.label}</td>
                            <td className="text-right px-3 py-1.5 font-semibold">{curve.auc.toFixed(4)}</td>
                            <td className="text-right px-3 py-1.5">{opt.threshold.toFixed(4)}</td>
                            <td className="text-right px-3 py-1.5">{opt.tpr.toFixed(4)}</td>
                            <td className="text-right px-3 py-1.5">{(1 - opt.fpr).toFixed(4)}</td>
                            <td className="text-right px-3 py-1.5">{(opt.tpr - opt.fpr).toFixed(4)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4"><ToolRating toolId="roc-curve" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawData); navigate("/chart-studio?type=roc"); }}
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

export default ROCCurve;
