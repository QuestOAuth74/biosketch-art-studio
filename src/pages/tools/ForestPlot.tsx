import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, GitBranch } from "lucide-react";
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
interface Study {
  name: string;
  effect: number;
  lower: number;
  upper: number;
  weight: number;
}

// ── Color Themes ──
const COLOR_THEMES: Record<string, { name: string; point: string; ci: string; diamond: string; null_line: string; bg: string; axis: string; text: string; grid: string }> = {
  academic: {
    name: "Academic",
    point: "#000000", ci: "#000000", diamond: "#2166AC", null_line: "#cc0000", bg: "#ffffff", axis: "#000000", text: "#000000", grid: "#e8e8e8",
  },
  nature: {
    name: "Nature Journal",
    point: "#3C5488", ci: "#3C5488", diamond: "#E64B35", null_line: "#888888", bg: "#ffffff", axis: "#000000", text: "#000000", grid: "#e8e8e8",
  },
  lancet: {
    name: "Lancet",
    point: "#00468B", ci: "#00468B", diamond: "#ED0000", null_line: "#666666", bg: "#ffffff", axis: "#000000", text: "#000000", grid: "#e8e8e8",
  },
  colorblind: {
    name: "Colorblind Safe",
    point: "#0072B2", ci: "#0072B2", diamond: "#D55E00", null_line: "#999999", bg: "#ffffff", axis: "#000000", text: "#000000", grid: "#e8e8e8",
  },
  allblack: {
    name: "All Black",
    point: "#000000", ci: "#000000", diamond: "#000000", null_line: "#999999", bg: "#ffffff", axis: "#000000", text: "#000000", grid: "#e0e0e0",
  },
};

type EffectMeasure = "OR" | "RR" | "HR" | "MD" | "SMD";

// ── Example Datasets ──
const EXAMPLES: Record<string, { label: string; data: string; measure: EffectMeasure; log: boolean }> = {
  meta_or: {
    label: "Meta-analysis (OR)",
    data: `Study\tOR\tLower\tUpper\tWeight
Smith 2018\t0.75\t0.55\t1.02\t12.3
Johnson 2019\t0.62\t0.41\t0.94\t9.8
Williams 2019\t0.88\t0.72\t1.08\t15.1
Brown 2020\t0.71\t0.52\t0.97\t11.2
Davis 2020\t0.93\t0.68\t1.27\t10.5
Miller 2021\t0.58\t0.38\t0.89\t8.4
Wilson 2021\t0.82\t0.65\t1.03\t14.0
Taylor 2022\t0.69\t0.49\t0.97\t10.1
Anderson 2022\t0.77\t0.58\t1.02\t12.8
Thomas 2023\t0.64\t0.44\t0.93\t9.2`,
  },
  survival_hr: {
    label: "Survival (HR)",
    data: `Study\tHR\tLower\tUpper\tWeight
KEYNOTE-024\t0.63\t0.47\t0.86\t14.2
CheckMate-227\t0.73\t0.59\t0.89\t16.8
IMpower110\t0.59\t0.40\t0.89\t10.5
EMPOWER-Lung 1\t0.71\t0.56\t0.90\t15.1
RATIONALE-301\t0.85\t0.67\t1.07\t14.9
ARCTIC\t0.78\t0.56\t1.09\t11.3
MYSTIC\t0.76\t0.62\t0.92\t16.2`,
  },
  mean_diff: {
    label: "Mean Difference",
    data: `Study\tMD\tLower\tUpper\tWeight
Trial A\t-2.3\t-4.1\t-0.5\t11.5
Trial B\t-1.8\t-3.2\t-0.4\t13.2
Trial C\t-3.1\t-5.0\t-1.2\t9.8
Trial D\t-0.9\t-2.5\t0.7\t14.1
Trial E\t-2.5\t-4.3\t-0.7\t10.9
Trial F\t-1.5\t-2.8\t-0.2\t15.3
Trial G\t-2.0\t-3.6\t-0.4\t12.5
Trial H\t-1.2\t-2.9\t0.5\t12.7`,
  },
};

// ── Pooled estimate (inverse-variance fixed-effect) ──
function computePooledEstimate(studies: Study[], isLog: boolean): Study | null {
  if (studies.length === 0) return null;
  let sumW = 0, sumWE = 0;
  for (const s of studies) {
    const e = isLog ? Math.log(s.effect) : s.effect;
    const se = isLog
      ? (Math.log(s.upper) - Math.log(s.lower)) / 3.92
      : (s.upper - s.lower) / 3.92;
    if (se <= 0) continue;
    const w = 1 / (se * se);
    sumW += w;
    sumWE += w * e;
  }
  if (sumW === 0) return null;
  const pooledE = sumWE / sumW;
  const pooledSE = 1 / Math.sqrt(sumW);
  const effect = isLog ? Math.exp(pooledE) : pooledE;
  const lower = isLog ? Math.exp(pooledE - 1.96 * pooledSE) : pooledE - 1.96 * pooledSE;
  const upper = isLog ? Math.exp(pooledE + 1.96 * pooledSE) : pooledE + 1.96 * pooledSE;
  return { name: "Pooled Estimate", effect, lower, upper, weight: 100 };
}

// ── Component ──
const ForestPlot = () => {
  useTrackToolVisit("forest-plot");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [rawData, setRawData] = useState(EXAMPLES.meta_or.data);
  const [title, setTitle] = useState("Forest Plot");
  const [theme, setTheme] = useState("academic");
  const [measure, setMeasure] = useState<EffectMeasure>("OR");
  const [useLogScale, setUseLogScale] = useState(true);
  const [showPooled, setShowPooled] = useState(true);
  const [showWeights, setShowWeights] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [nullValue, setNullValue] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse
  const studies = useMemo<Study[]>(() => {
    const lines = rawData.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const result: Study[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\t|,/).map(p => p.trim());
      if (parts.length < 4) continue;
      const name = parts[0];
      const effect = parseFloat(parts[1]);
      const lower = parseFloat(parts[2]);
      const upper = parseFloat(parts[3]);
      const weight = parts.length >= 5 ? parseFloat(parts[4]) : 10;
      if (isNaN(effect) || isNaN(lower) || isNaN(upper)) continue;
      result.push({ name, effect, lower, upper, weight: isNaN(weight) ? 10 : weight });
    }
    return result;
  }, [rawData]);

  const pooled = useMemo(() => showPooled ? computePooledEstimate(studies, useLogScale && (measure === "OR" || measure === "RR" || measure === "HR")) : null, [studies, showPooled, useLogScale, measure]);

  // SVG dimensions
  const rowH = 28;
  const labelW = 160;
  const plotW = 320;
  const weightW = showWeights ? 60 : 0;
  const effectW = 80;
  const svgW = labelW + plotW + weightW + effectW + 40;
  const headerH = 50;
  const nRows = studies.length + (pooled ? 2 : 0); // +1 for separator, +1 for pooled
  const svgH = headerH + nRows * rowH + 40;

  const t = COLOR_THEMES[theme];
  const isRatio = measure === "OR" || measure === "RR" || measure === "HR";
  const nv = isRatio ? 1 : 0;

  // X scale for effect sizes
  const allLower = [...studies.map(s => s.lower), ...(pooled ? [pooled.lower] : [])];
  const allUpper = [...studies.map(s => s.upper), ...(pooled ? [pooled.upper] : [])];
  const dataMin = Math.min(...allLower, nv);
  const dataMax = Math.max(...allUpper, nv);
  const pad = (dataMax - dataMin) * 0.15;
  const xMin = dataMin - pad;
  const xMax = dataMax + pad;

  const xScale = (v: number) => {
    if (useLogScale && isRatio) {
      const logMin = Math.log(Math.max(xMin, 0.01));
      const logMax = Math.log(Math.max(xMax, 0.02));
      const logV = Math.log(Math.max(v, 0.01));
      return labelW + ((logV - logMin) / (logMax - logMin)) * plotW;
    }
    return labelW + ((v - xMin) / (xMax - xMin)) * plotW;
  };

  const maxWeight = Math.max(...studies.map(s => s.weight), 1);

  // X ticks
  const xTicks = useMemo(() => {
    if (useLogScale && isRatio) {
      const candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 4, 5, 10];
      return candidates.filter(v => v >= xMin * 0.9 && v <= xMax * 1.1);
    }
    const range = xMax - xMin;
    const step = range <= 2 ? 0.5 : range <= 5 ? 1 : range <= 10 ? 2 : Math.ceil(range / 6);
    const ticks: number[] = [];
    const start = Math.ceil(xMin / step) * step;
    for (let v = start; v <= xMax; v += step) ticks.push(Math.round(v * 100) / 100);
    return ticks;
  }, [xMin, xMax, useLogScale, isRatio]);

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
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "forest-plot.svg"; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "forest-plot.png"; a.click(); });
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
      sessionStorage.setItem("forest_svg_import", svgOut);
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
        title="Free Forest Plot Maker | BioSketch"
        description="Create publication-quality forest plots for meta-analyses online for free. Odds ratios, hazard ratios, risk ratios, mean differences with pooled estimates and confidence intervals."
        keywords="forest plot maker, meta-analysis, odds ratio, hazard ratio, confidence interval, pooled estimate, systematic review, free forest plot tool"
        canonical="https://biosketch.art/forest-plot"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <GitBranch className="h-6 w-6 text-primary" />
                Forest Plot Maker
              </h1>
              <p className="text-sm text-muted-foreground">Meta-analysis forest plots with pooled estimates and confidence intervals</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              <div className="space-y-2">
                <Label>Data (Study, Effect, Lower CI, Upper CI, Weight)</Label>
                <Textarea value={rawData} onChange={(e) => setRawData(e.target.value)} rows={10} className="font-mono text-xs" />
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
                      onClick={() => {
                        setRawData(ex.data); setMeasure(ex.measure);
                        setUseLogScale(ex.log); setNullValue(ex.measure === "MD" || ex.measure === "SMD" ? 0 : 1);
                        toast.success(`Loaded: ${ex.label}`);
                      }}>
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
                <Label>Effect Measure</Label>
                <Select value={measure} onValueChange={(v) => { setMeasure(v as EffectMeasure); setNullValue(v === "MD" || v === "SMD" ? 0 : 1); setUseLogScale(v !== "MD" && v !== "SMD"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR">Odds Ratio (OR)</SelectItem>
                    <SelectItem value="RR">Risk Ratio (RR)</SelectItem>
                    <SelectItem value="HR">Hazard Ratio (HR)</SelectItem>
                    <SelectItem value="MD">Mean Difference (MD)</SelectItem>
                    <SelectItem value="SMD">Std. Mean Difference (SMD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLOR_THEMES).map(([id, th]) => (
                      <SelectItem key={id} value={id}>{th.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Log Scale</Label>
                  <Switch checked={useLogScale} onCheckedChange={setUseLogScale} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Pooled Estimate</Label>
                  <Switch checked={showPooled} onCheckedChange={setShowPooled} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Weights</Label>
                  <Switch checked={showWeights} onCheckedChange={setShowWeights} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Grid Lines</Label>
                  <Switch checked={showGrid} onCheckedChange={setShowGrid} />
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
              <div className="border rounded-lg overflow-auto bg-white">
                <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto" style={{ minWidth: 500 }}>
                  <rect width={svgW} height={svgH} fill={t.bg} />

                  {/* Title */}
                  <text x={svgW / 2} y={25} textAnchor="middle" fill={t.text} fontSize="15" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">{title}</text>

                  {/* Column headers */}
                  <text x={10} y={headerH - 8} fill={t.text} fontSize="10" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">Study</text>
                  <text x={labelW + plotW / 2} y={headerH - 8} textAnchor="middle" fill={t.text} fontSize="10" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">{measure} (95% CI)</text>
                  {showWeights && <text x={labelW + plotW + 10} y={headerH - 8} fill={t.text} fontSize="10" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">Weight</text>}
                  <text x={labelW + plotW + weightW + 10} y={headerH - 8} fill={t.text} fontSize="10" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">{measure} [95% CI]</text>

                  {/* Header separator */}
                  <line x1={0} y1={headerH} x2={svgW} y2={headerH} stroke={t.axis} strokeWidth="1" />

                  {/* Null effect line (vertical) */}
                  <line x1={xScale(nullValue)} y1={headerH} x2={xScale(nullValue)} y2={headerH + studies.length * rowH + (pooled ? rowH : 0)} stroke={t.null_line} strokeWidth="1" strokeDasharray="4 2" />

                  {/* Grid lines */}
                  {showGrid && xTicks.map(v => (
                    <line key={v} x1={xScale(v)} y1={headerH} x2={xScale(v)} y2={headerH + studies.length * rowH + (pooled ? rowH * 2 : 0)} stroke={t.grid} strokeWidth="0.5" />
                  ))}

                  {/* Studies */}
                  {studies.map((s, i) => {
                    const y = headerH + i * rowH + rowH / 2;
                    const dotR = Math.max(3, Math.min(8, (s.weight / maxWeight) * 8));
                    const ciX1 = xScale(s.lower);
                    const ciX2 = xScale(s.upper);
                    const dotX = xScale(s.effect);

                    return (
                      <g key={i}>
                        {/* Alternating row background */}
                        {i % 2 === 0 && <rect x={0} y={headerH + i * rowH} width={svgW} height={rowH} fill="#f9f9f9" />}

                        {/* Study name */}
                        <text x={10} y={y + 4} fill={t.text} fontSize="10" fontFamily="Inter,system-ui,sans-serif">{s.name}</text>

                        {/* CI line */}
                        <line x1={ciX1} y1={y} x2={ciX2} y2={y} stroke={t.ci} strokeWidth="1.5" />

                        {/* CI caps */}
                        <line x1={ciX1} y1={y - 4} x2={ciX1} y2={y + 4} stroke={t.ci} strokeWidth="1" />
                        <line x1={ciX2} y1={y - 4} x2={ciX2} y2={y + 4} stroke={t.ci} strokeWidth="1" />

                        {/* Effect point (size = weight) */}
                        <rect x={dotX - dotR} y={y - dotR} width={dotR * 2} height={dotR * 2} fill={t.point} />

                        {/* Weight */}
                        {showWeights && (
                          <text x={labelW + plotW + 10} y={y + 4} fill={t.text} fontSize="9" fontFamily="Inter,system-ui,sans-serif">{s.weight.toFixed(1)}%</text>
                        )}

                        {/* Effect text */}
                        <text x={labelW + plotW + weightW + 10} y={y + 4} fill={t.text} fontSize="9" fontFamily="Inter,system-ui,sans-serif">
                          {s.effect.toFixed(2)} [{s.lower.toFixed(2)}, {s.upper.toFixed(2)}]
                        </text>
                      </g>
                    );
                  })}

                  {/* Pooled estimate */}
                  {pooled && (() => {
                    const sepY = headerH + studies.length * rowH;
                    const y = sepY + rowH + rowH / 2;
                    const dX = xScale(pooled.effect);
                    const dL = xScale(pooled.lower);
                    const dR = xScale(pooled.upper);
                    const dH = 8;

                    return (
                      <g>
                        {/* Separator */}
                        <line x1={0} y1={sepY} x2={svgW} y2={sepY} stroke={t.axis} strokeWidth="1" />

                        {/* Diamond */}
                        <polygon
                          points={`${dL},${y} ${dX},${y - dH} ${dR},${y} ${dX},${y + dH}`}
                          fill={t.diamond} stroke={t.diamond} strokeWidth="1"
                        />

                        {/* Label */}
                        <text x={10} y={y + 4} fill={t.text} fontSize="10" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Pooled Estimate</text>

                        {/* Effect text */}
                        <text x={labelW + plotW + weightW + 10} y={y + 4} fill={t.text} fontSize="9" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">
                          {pooled.effect.toFixed(2)} [{pooled.lower.toFixed(2)}, {pooled.upper.toFixed(2)}]
                        </text>
                      </g>
                    );
                  })()}

                  {/* X axis */}
                  {(() => {
                    const axisY = headerH + studies.length * rowH + (pooled ? rowH * 2 : 0) + 5;
                    return (
                      <g>
                        <line x1={labelW} y1={axisY} x2={labelW + plotW} y2={axisY} stroke={t.axis} strokeWidth="1" />
                        {xTicks.map(v => (
                          <g key={v}>
                            <line x1={xScale(v)} y1={axisY} x2={xScale(v)} y2={axisY + 4} stroke={t.axis} strokeWidth="1" />
                            <text x={xScale(v)} y={axisY + 15} textAnchor="middle" fill={t.text} fontSize="9" fontFamily="Inter,system-ui,sans-serif">{v}</text>
                          </g>
                        ))}
                        {/* Favours labels */}
                        <text x={xScale(nullValue) - 30} y={axisY + 28} textAnchor="end" fill={t.text} fontSize="8" fontStyle="italic" fontFamily="Inter,system-ui,sans-serif">
                          Favours treatment
                        </text>
                        <text x={xScale(nullValue) + 30} y={axisY + 28} textAnchor="start" fill={t.text} fontSize="8" fontStyle="italic" fontFamily="Inter,system-ui,sans-serif">
                          Favours control
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>

              <div className="mt-4"><ToolRating toolId="forest-plot" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawData); navigate("/chart-studio?type=forest"); }}
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

export default ForestPlot;
