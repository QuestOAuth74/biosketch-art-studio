import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Copy, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// ── 4-Parameter Logistic (4PL) Hill Equation ──
// y = Bottom + (Top - Bottom) / (1 + (x / EC50)^HillSlope)
// For inhibition: y = Top + (Bottom - Top) / (1 + (x / IC50)^HillSlope)

interface DataPoint {
  conc: number;
  response: number;
}

interface FitResult {
  top: number;
  bottom: number;
  ec50: number;
  hillSlope: number;
  rSquared: number;
  fitted: { x: number; y: number }[];
}

// Simple Levenberg-Marquardt-style iterative fit for 4PL
function fit4PL(data: DataPoint[]): FitResult | null {
  if (data.length < 4) return null;

  const xs = data.map(d => d.conc);
  const ys = data.map(d => d.response);
  const n = data.length;

  // Initial guesses
  let top = Math.max(...ys);
  let bottom = Math.min(...ys);
  const midY = (top + bottom) / 2;

  // Estimate EC50 as concentration nearest to midpoint response
  let ec50 = xs[0];
  let minDist = Infinity;
  data.forEach(d => {
    const dist = Math.abs(d.response - midY);
    if (dist < minDist) { minDist = dist; ec50 = d.conc; }
  });
  if (ec50 <= 0) ec50 = 1;

  let hillSlope = ys[0] > ys[ys.length - 1] ? 1 : -1;

  // Iterative optimization (gradient descent with adaptive step)
  const predict = (x: number, t: number, b: number, e: number, h: number) => {
    if (x <= 0 || e <= 0) return t;
    return b + (t - b) / (1 + Math.pow(x / e, h));
  };

  const residualSS = (t: number, b: number, e: number, h: number) => {
    let ss = 0;
    for (let i = 0; i < n; i++) {
      const diff = ys[i] - predict(xs[i], t, b, e, h);
      ss += diff * diff;
    }
    return ss;
  };

  // Simple coordinate descent
  for (let iter = 0; iter < 500; iter++) {
    const step = iter < 100 ? 0.1 : iter < 300 ? 0.01 : 0.001;
    const currentSS = residualSS(top, bottom, ec50, hillSlope);

    // Try adjusting each parameter
    for (const [param, delta] of [
      ['top', top * step],
      ['bottom', Math.max(Math.abs(bottom), 1) * step],
      ['ec50', ec50 * step],
      ['hill', Math.max(Math.abs(hillSlope), 0.1) * step],
    ] as [string, number][]) {
      let newTop = top, newBottom = bottom, newEc50 = ec50, newHill = hillSlope;
      if (param === 'top') newTop = top + delta;
      else if (param === 'bottom') newBottom = bottom + delta;
      else if (param === 'ec50') newEc50 = ec50 + delta;
      else newHill = hillSlope + delta;

      if (newEc50 <= 0) continue;
      const ss1 = residualSS(newTop, newBottom, newEc50, newHill);

      if (param === 'top') newTop = top - delta;
      else if (param === 'bottom') newBottom = bottom - delta;
      else if (param === 'ec50') newEc50 = ec50 - delta;
      else newHill = hillSlope - delta;

      if (newEc50 <= 0) continue;
      const ss2 = residualSS(newTop, newBottom, newEc50, newHill);

      if (ss1 < currentSS && ss1 <= ss2) {
        if (param === 'top') top += delta;
        else if (param === 'bottom') bottom += delta;
        else if (param === 'ec50') ec50 += delta;
        else hillSlope += delta;
      } else if (ss2 < currentSS) {
        if (param === 'top') top -= delta;
        else if (param === 'bottom') bottom -= delta;
        else if (param === 'ec50') ec50 -= delta;
        else hillSlope -= delta;
      }
    }
  }

  // R-squared
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = residualSS(top, bottom, ec50, hillSlope);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Generate fitted curve points (log-spaced)
  const logMin = Math.log10(Math.max(1e-12, Math.min(...xs) / 10));
  const logMax = Math.log10(Math.max(...xs) * 10);
  const fitted: { x: number; y: number }[] = [];
  for (let i = 0; i <= 200; i++) {
    const logX = logMin + (i / 200) * (logMax - logMin);
    const x = Math.pow(10, logX);
    fitted.push({ x, y: predict(x, top, bottom, ec50, hillSlope) });
  }

  return { top, bottom, ec50, hillSlope, rSquared, fitted };
}

// ── Example datasets ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  ic50: {
    label: "IC50 (inhibition)",
    data: `Concentration\tResponse
0.001\t98.2
0.003\t97.5
0.01\t95.1
0.03\t90.3
0.1\t78.6
0.3\t55.2
1\t30.8
3\t12.4
10\t5.1
30\t2.8
100\t1.9`,
  },
  ec50: {
    label: "EC50 (activation)",
    data: `Concentration\tResponse
0.001\t2.1
0.003\t3.5
0.01\t5.8
0.03\t12.4
0.1\t28.6
0.3\t52.3
1\t75.8
3\t89.2
10\t95.6
30\t98.1
100\t99.2`,
  },
  cytotoxicity: {
    label: "Cytotoxicity assay",
    data: `Concentration\tViability
0.01\t100
0.05\t98
0.1\t95
0.5\t82
1\t60
2.5\t35
5\t18
10\t8
25\t3
50\t1.5`,
  },
};

function parseData(text: string): DataPoint[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const points: DataPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 2) continue;
    const conc = parseFloat(parts[0]);
    const response = parseFloat(parts[1]);
    if (isNaN(conc) || isNaN(response) || conc <= 0) continue;
    points.push({ conc, response });
  }
  return points.sort((a, b) => a.conc - b.conc);
}

function formatConc(v: number): string {
  if (v >= 1) return v.toPrecision(4);
  if (v >= 0.001) return v.toPrecision(3);
  return v.toExponential(2);
}

// ── SVG Plot ──
function DoseResponseSVG({ data, fit }: { data: DataPoint[]; fit: FitResult | null }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const svgW = 650, svgH = 450;
  const margin = { top: 30, right: 30, bottom: 60, left: 65 };
  const w = svgW - margin.left - margin.right;
  const h = svgH - margin.top - margin.bottom;

  const allX = data.map(d => d.conc);
  const allY = data.map(d => d.response);
  const logXMin = Math.log10(Math.min(...allX) / 3);
  const logXMax = Math.log10(Math.max(...allX) * 3);
  const yMin = Math.min(0, ...allY) - 5;
  const yMax = Math.max(...allY) + 10;

  const xScale = (v: number) => margin.left + ((Math.log10(v) - logXMin) / (logXMax - logXMin)) * w;
  const yScale = (v: number) => margin.top + h - ((v - yMin) / (yMax - yMin)) * h;

  // X ticks (log scale)
  const xTicks: number[] = [];
  for (let p = Math.ceil(logXMin); p <= Math.floor(logXMax); p++) {
    xTicks.push(Math.pow(10, p));
  }

  // Y ticks
  const yRange = yMax - yMin;
  const yStep = yRange > 100 ? 20 : yRange > 50 ? 10 : 5;
  const yTicks: number[] = [];
  for (let t = Math.ceil(yMin / yStep) * yStep; t <= yMax; t += yStep) yTicks.push(t);

  // EC50 / IC50 line
  const ec50X = fit ? xScale(fit.ec50) : 0;
  const ec50Y = fit ? yScale(fit.bottom + (fit.top - fit.bottom) / 2) : 0;

  const exportPlot = (format: 'svg' | 'png') => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = 'text{font-family:Inter,sans-serif}';
    clone.insertBefore(styleEl, clone.firstChild);
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    if (format === 'svg') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dose-response.svg';
      a.click();
    } else {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => {
          if (!b) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'dose-response.png';
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
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(svgW));
    clone.setAttribute('height', String(svgH));
    clone.removeAttribute('class');
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = 'text{font-family:Inter,sans-serif}';
    clone.insertBefore(styleEl, clone.firstChild);
    const svgStr = new XMLSerializer().serializeToString(clone);
    const scale = 3;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = svgW * scale; c.height = svgH * scale;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/png');
      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"><image width="${svgW}" height="${svgH}" xlink:href="${dataUrl}"/></svg>`;
      sessionStorage.setItem('volcano_svg_import', svgOut);
      window.location.href = '/canvas';
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  };

  (window as any).__exportDoseResponse = exportPlot;
  (window as any).__openDoseResponseInCanvas = openInCanvas;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
      <rect width={svgW} height={svgH} fill="#ffffff" />

      {/* Grid */}
      {yTicks.map(t => (
        <line key={`yg-${t}`} x1={margin.left} x2={svgW - margin.right}
          y1={yScale(t)} y2={yScale(t)} stroke="#f1f5f9" strokeWidth="1" />
      ))}

      {/* EC50/IC50 reference lines */}
      {fit && fit.ec50 > 0 && (
        <>
          <line x1={ec50X} x2={ec50X} y1={margin.top} y2={margin.top + h}
            stroke="#e11d48" strokeWidth="1" strokeDasharray="4,3" />
          <line x1={margin.left} x2={ec50X} y1={ec50Y} y2={ec50Y}
            stroke="#e11d48" strokeWidth="1" strokeDasharray="4,3" />
          <text x={ec50X + 4} y={margin.top + 14} fontSize="9" fill="#e11d48"
            fontFamily="Inter, sans-serif" fontWeight="600">
            EC₅₀={formatConc(fit.ec50)}
          </text>
        </>
      )}

      {/* Fitted curve */}
      {fit && (
        <path
          d={fit.fitted.map((p, i) =>
            `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(2)},${yScale(p.y).toFixed(2)}`
          ).join(' ')}
          fill="none" stroke="#2563eb" strokeWidth="2.5" />
      )}

      {/* Data points */}
      {data.map((d, i) => (
        <circle key={i} cx={xScale(d.conc)} cy={yScale(d.response)} r={4}
          fill="#2563eb" stroke="#fff" strokeWidth="1.5">
          <title>{`${d.conc}: ${d.response}`}</title>
        </circle>
      ))}

      {/* X axis */}
      <line x1={margin.left} x2={svgW - margin.right}
        y1={margin.top + h} y2={margin.top + h} stroke="#e2e8f0" strokeWidth="1" />
      {xTicks.map(t => (
        <g key={`xt-${t}`}>
          <line x1={xScale(t)} x2={xScale(t)} y1={margin.top + h} y2={margin.top + h + 4} stroke="#94a3b8" />
          <text x={xScale(t)} y={margin.top + h + 16} textAnchor="middle"
            fontSize="10" fill="#64748b" fontFamily="Inter, sans-serif">
            {t >= 1 ? t.toString() : t.toExponential(0)}
          </text>
        </g>
      ))}
      <text x={margin.left + w / 2} y={svgH - 10} textAnchor="middle"
        fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif">
        Concentration (log scale)
      </text>

      {/* Y axis */}
      <line x1={margin.left} x2={margin.left}
        y1={margin.top} y2={margin.top + h} stroke="#e2e8f0" strokeWidth="1" />
      {yTicks.map(t => (
        <g key={`yt-${t}`}>
          <line x1={margin.left - 4} x2={margin.left} y1={yScale(t)} y2={yScale(t)} stroke="#94a3b8" />
          <text x={margin.left - 8} y={yScale(t) + 3} textAnchor="end"
            fontSize="10" fill="#64748b" fontFamily="Inter, sans-serif">{t}</text>
        </g>
      ))}
      <text x={15} y={margin.top + h / 2} textAnchor="middle"
        fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif"
        transform={`rotate(-90, 15, ${margin.top + h / 2})`}>
        Response (%)
      </text>
    </svg>
  );
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Dose-Response IC50/EC50 Curve Fitter - BioSketch",
  description: "Fit 4-parameter logistic dose-response curves online. Calculate IC50/EC50, Hill slope, R-squared. Free alternative to GraphPad Prism for pharmacology and drug discovery.",
  url: "https://biosketch.art/dose-response",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const DoseResponse = () => {
  useTrackToolVisit("dose-response");
  const navigate = useNavigate();
  const [rawInput, setRawInput] = useState(EXAMPLES.ic50.data);
  const [copied, setCopied] = useState(false);

  const data = useMemo(() => parseData(rawInput), [rawInput]);
  const fit = useMemo(() => fit4PL(data), [data]);

  const isInhibition = fit ? fit.top > fit.bottom && fit.hillSlope > 0 : false;
  const label50 = isInhibition ? "IC₅₀" : "EC₅₀";

  const copyResults = () => {
    if (!fit) return;
    const lines = [
      `${label50}: ${formatConc(fit.ec50)}`,
      `Hill slope: ${fit.hillSlope.toFixed(3)}`,
      `Top: ${fit.top.toFixed(2)}`,
      `Bottom: ${fit.bottom.toFixed(2)}`,
      `R²: ${fit.rSquared.toFixed(4)}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Results copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free IC50/EC50 Dose-Response Curve Fitter | BioSketch"
        description="Fit 4-parameter logistic (4PL) dose-response curves online for free. Paste concentration and response data to calculate IC50/EC50, Hill slope, and R-squared. Publication-quality sigmoidal curve plots with SVG/PNG export. Free alternative to GraphPad Prism. No signup required."
        canonical="https://biosketch.art/dose-response"
        keywords="IC50 calculator, EC50 calculator, dose response curve fitter, 4PL curve fitting, Hill equation, sigmoidal curve, GraphPad alternative free, drug response curve, pharmacology tool, dose response plot maker, 4 parameter logistic, inhibition curve"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
            Dose-Response Curve Fitter
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            4-parameter logistic (Hill equation) curve fitting for IC₅₀/EC₅₀ determination.
          </p>
          <ToolRating toolId="dose-response" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawInput); navigate("/chart-studio?type=dose-response"); }}
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

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Controls */}
          <div className="lg:w-72 space-y-5 shrink-0">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Data (tab or comma-separated)</Label>
                <label className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 cursor-pointer transition-colors">
                  <Upload className="h-3 w-3" /> Upload CSV
                  <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader(); r.onload = ev => { if (ev.target?.result) setRawInput(ev.target.result as string); };
                    r.readAsText(f); e.target.value = "";
                  }} />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Columns: Concentration, Response (%)</p>
              <textarea
                className="w-full font-mono text-[10px] p-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-vertical min-h-[120px]"
                value={rawInput} onChange={e => setRawInput(e.target.value)}
                rows={8}
              />
            </div>

            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Examples</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(EXAMPLES).map(([k, ex]) => (
                  <button key={k} onClick={() => setRawInput(ex.data)}
                    className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fit results */}
            {fit && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Curve Parameters</span>
                  <button onClick={copyResults} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{label50}</span>
                    <span className="text-sm font-bold font-mono text-primary">{formatConc(fit.ec50)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Hill slope</span>
                    <span className="text-xs font-semibold font-mono text-foreground">{fit.hillSlope.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Top</span>
                    <span className="text-xs font-mono text-foreground">{fit.top.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Bottom</span>
                    <span className="text-xs font-mono text-foreground">{fit.bottom.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">R²</span>
                    <span className={`text-xs font-semibold font-mono ${fit.rSquared > 0.95 ? "text-green-600" : fit.rSquared > 0.8 ? "text-yellow-600" : "text-red-600"}`}>
                      {fit.rSquared.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/10 text-[10px] text-muted-foreground">
                  <p>Model: y = Bottom + (Top − Bottom) / (1 + (x/{label50})^n)</p>
                  <p className="mt-1">Data points: {data.length}</p>
                </div>
              </div>
            )}

            {data.length > 0 && data.length < 4 && (
              <p className="text-xs text-red-500 text-center">Need at least 4 data points for curve fitting.</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__exportDoseResponse?.("svg")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> SVG
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__exportDoseResponse?.("png")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> PNG
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => (window as any).__openDoseResponseInCanvas?.()}>
                Canvas
              </Button>
            </div>
          </div>

          {/* Plot */}
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-xl border border-border p-4 aspect-[65/45]">
              {data.length > 0 ? (
                <DoseResponseSVG data={data} fit={fit} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                  Paste data with Concentration and Response columns
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5 max-w-2xl">
          <p><strong>4-Parameter Logistic (4PL):</strong> y = Bottom + (Top − Bottom) / (1 + (x/EC₅₀)^HillSlope). The standard model for dose-response curves in pharmacology.</p>
          <p><strong>IC₅₀ vs EC₅₀:</strong> IC₅₀ = half-maximal inhibitory concentration (response decreases). EC₅₀ = half-maximal effective concentration (response increases). Auto-detected from data direction.</p>
          <p><strong>Hill slope (n):</strong> Steepness of the curve. n=1 for standard Michaelis-Menten. n&gt;1 indicates positive cooperativity. n&lt;1 indicates negative cooperativity.</p>
          <p><strong>R²:</strong> Goodness of fit. &gt;0.95 = excellent, 0.8–0.95 = good, &lt;0.8 = poor fit (check data quality or try different model).</p>
          <p><strong>Compatible with:</strong> Viability assays (MTT, CellTiter-Glo), enzyme inhibition, receptor binding, cytotoxicity, and any concentration-response data.</p>
        </div>
      </div>
    </div>
  );
};

export default DoseResponse;
