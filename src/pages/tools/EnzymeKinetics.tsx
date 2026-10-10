import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Copy, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

interface DataPoint { s: number; v: number; }

// ── Michaelis-Menten fit: v = Vmax * [S] / (Km + [S]) ──
// Uses Lineweaver-Burk linear regression for initial estimates,
// then refines with iterative least-squares

function fitMM(data: DataPoint[]): { km: number; vmax: number; rSq: number } | null {
  if (data.length < 3) return null;

  // Lineweaver-Burk: 1/v = (Km/Vmax)(1/[S]) + 1/Vmax
  // y = mx + b  where y=1/v, x=1/[S], m=Km/Vmax, b=1/Vmax
  const lbData = data.filter(d => d.s > 0 && d.v > 0).map(d => ({ x: 1 / d.s, y: 1 / d.v }));
  if (lbData.length < 2) return null;

  const n = lbData.length;
  const sumX = lbData.reduce((s, d) => s + d.x, 0);
  const sumY = lbData.reduce((s, d) => s + d.y, 0);
  const sumXY = lbData.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = lbData.reduce((s, d) => s + d.x * d.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-20) return null;

  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;

  if (b <= 0) return null;
  let vmax = 1 / b;
  let km = m * vmax;
  if (km < 0) km = Math.abs(km);

  // Refine with coordinate descent
  const predict = (s: number, km: number, vmax: number) => (vmax * s) / (km + s);
  const residualSS = (km: number, vmax: number) =>
    data.reduce((ss, d) => ss + (d.v - predict(d.s, km, vmax)) ** 2, 0);

  for (let iter = 0; iter < 300; iter++) {
    const step = iter < 100 ? 0.05 : iter < 200 ? 0.01 : 0.002;
    const ss0 = residualSS(km, vmax);

    // Try Km
    const ssKmUp = residualSS(km * (1 + step), vmax);
    const ssKmDn = residualSS(km * (1 - step), vmax);
    if (ssKmUp < ss0 && ssKmUp <= ssKmDn) km *= (1 + step);
    else if (ssKmDn < ss0) km *= (1 - step);

    // Try Vmax
    const ssVUp = residualSS(km, vmax * (1 + step));
    const ssVDn = residualSS(km, vmax * (1 - step));
    if (ssVUp < ss0 && ssVUp <= ssVDn) vmax *= (1 + step);
    else if (ssVDn < ss0) vmax *= (1 - step);
  }

  // R²
  const meanV = data.reduce((s, d) => s + d.v, 0) / data.length;
  const ssTot = data.reduce((s, d) => s + (d.v - meanV) ** 2, 0);
  const ssRes = residualSS(km, vmax);
  const rSq = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { km, vmax, rSq };
}

// ── Examples ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  standard: {
    label: "Standard enzyme",
    data: `[S]\tv
0.5\t2.5
1\t4.4
2\t6.8
4\t8.9
8\t10.8
12\t11.6
20\t12.4
40\t13.2
80\t13.8`,
  },
  highAffinity: {
    label: "High affinity",
    data: `[S]\tv
0.01\t5.2
0.02\t8.9
0.05\t14.6
0.1\t18.8
0.2\t22.4
0.5\t25.1
1\t26.8
2\t27.5
5\t28.1`,
  },
  inhibited: {
    label: "Low Vmax enzyme",
    data: `[S]\tv
1\t0.8
2\t1.4
5\t2.6
10\t3.6
20\t4.5
50\t5.3
100\t5.7
200\t5.9`,
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
    const s = parseFloat(parts[0]);
    const v = parseFloat(parts[1]);
    if (isNaN(s) || isNaN(v) || s < 0) continue;
    points.push({ s, v });
  }
  return points.sort((a, b) => a.s - b.s);
}

type PlotType = "mm" | "lb" | "eh";

// ── SVG Plots ──
function MMPlot({ data, fit, svgRef }: { data: DataPoint[]; fit: ReturnType<typeof fitMM>; svgRef: React.RefObject<SVGSVGElement> }) {
  const svgW = 600, svgH = 420;
  const margin = { top: 25, right: 25, bottom: 55, left: 60 };
  const w = svgW - margin.left - margin.right;
  const h = svgH - margin.top - margin.bottom;

  const maxS = Math.max(...data.map(d => d.s)) * 1.15;
  const maxV = Math.max(...data.map(d => d.v), fit?.vmax || 0) * 1.15;

  const xScale = (v: number) => margin.left + (v / maxS) * w;
  const yScale = (v: number) => margin.top + h - (v / maxV) * h;

  // Fitted curve
  const curvePoints: string[] = [];
  if (fit) {
    for (let i = 0; i <= 200; i++) {
      const s = (i / 200) * maxS;
      const v = (fit.vmax * s) / (fit.km + s);
      curvePoints.push(`${i === 0 ? 'M' : 'L'}${xScale(s).toFixed(1)},${yScale(v).toFixed(1)}`);
    }
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
      <rect width={svgW} height={svgH} fill="#fff" />

      {/* Vmax reference */}
      {fit && (
        <>
          <line x1={margin.left} x2={svgW - margin.right} y1={yScale(fit.vmax)} y2={yScale(fit.vmax)}
            stroke="#e11d48" strokeWidth="1" strokeDasharray="4,3" />
          <text x={svgW - margin.right - 4} y={yScale(fit.vmax) - 5} textAnchor="end"
            fontSize="9" fill="#e11d48" fontFamily="Inter, sans-serif" fontWeight="600">
            Vmax = {fit.vmax.toPrecision(4)}
          </text>
          {/* Km reference */}
          <line x1={xScale(fit.km)} x2={xScale(fit.km)} y1={margin.top} y2={margin.top + h}
            stroke="#2563eb" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
          <line x1={margin.left} x2={xScale(fit.km)} y1={yScale(fit.vmax / 2)} y2={yScale(fit.vmax / 2)}
            stroke="#2563eb" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
          <text x={xScale(fit.km) + 4} y={margin.top + 14} fontSize="9" fill="#2563eb"
            fontFamily="Inter, sans-serif" fontWeight="600">
            Km = {fit.km.toPrecision(4)}
          </text>
        </>
      )}

      {/* Fitted curve */}
      {curvePoints.length > 0 && (
        <path d={curvePoints.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      )}

      {/* Data points */}
      {data.map((d, i) => (
        <circle key={i} cx={xScale(d.s)} cy={yScale(d.v)} r={4}
          fill="#2563eb" stroke="#fff" strokeWidth="1.5">
          <title>[S]={d.s}, v={d.v}</title>
        </circle>
      ))}

      {/* Axes */}
      <line x1={margin.left} x2={svgW - margin.right} y1={margin.top + h} y2={margin.top + h} stroke="#e2e8f0" />
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + h} stroke="#e2e8f0" />
      <text x={margin.left + w / 2} y={svgH - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif">[S] (substrate concentration)</text>
      <text x={14} y={margin.top + h / 2} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif" transform={`rotate(-90, 14, ${margin.top + h / 2})`}>v (reaction velocity)</text>
      <text x={margin.left + w / 2} y={margin.top - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">Michaelis-Menten Plot</text>
    </svg>
  );
}

function LBPlot({ data, fit, svgRef }: { data: DataPoint[]; fit: ReturnType<typeof fitMM>; svgRef: React.RefObject<SVGSVGElement> }) {
  const svgW = 600, svgH = 420;
  const margin = { top: 25, right: 25, bottom: 55, left: 65 };
  const w = svgW - margin.left - margin.right;
  const h = svgH - margin.top - margin.bottom;

  const lbData = data.filter(d => d.s > 0 && d.v > 0).map(d => ({ x: 1 / d.s, y: 1 / d.v }));
  if (lbData.length === 0) return null;

  // Extend x-axis to include -1/Km
  const xIntercept = fit ? -1 / fit.km : 0;
  const minX = Math.min(xIntercept * 1.2, 0);
  const maxX = Math.max(...lbData.map(d => d.x)) * 1.15;
  const maxY = Math.max(...lbData.map(d => d.y)) * 1.2;
  const minY = 0;

  const xScale = (v: number) => margin.left + ((v - minX) / (maxX - minX)) * w;
  const yScale = (v: number) => margin.top + h - ((v - minY) / (maxY - minY)) * h;

  // Regression line
  let lineD = "";
  if (fit) {
    const slope = fit.km / fit.vmax;
    const intercept = 1 / fit.vmax;
    const x1 = xIntercept;
    const x2 = maxX;
    lineD = `M${xScale(x1).toFixed(1)},${yScale(slope * x1 + intercept).toFixed(1)} L${xScale(x2).toFixed(1)},${yScale(slope * x2 + intercept).toFixed(1)}`;
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
      <rect width={svgW} height={svgH} fill="#fff" />

      {/* Zero lines */}
      <line x1={xScale(0)} x2={xScale(0)} y1={margin.top} y2={margin.top + h} stroke="#e2e8f0" strokeWidth="1" />

      {/* Regression line */}
      {lineD && <path d={lineD} fill="none" stroke="#2563eb" strokeWidth="2" />}

      {/* X-intercept marker (-1/Km) */}
      {fit && (
        <>
          <circle cx={xScale(xIntercept)} cy={yScale(0)} r={4} fill="#e11d48" stroke="#fff" strokeWidth="1.5" />
          <text x={xScale(xIntercept)} y={yScale(0) + 16} textAnchor="middle" fontSize="9" fill="#e11d48" fontFamily="Inter, sans-serif" fontWeight="600">
            -1/Km
          </text>
        </>
      )}

      {/* Y-intercept marker (1/Vmax) */}
      {fit && (
        <>
          <circle cx={xScale(0)} cy={yScale(1 / fit.vmax)} r={4} fill="#e11d48" stroke="#fff" strokeWidth="1.5" />
          <text x={xScale(0) + 8} y={yScale(1 / fit.vmax) - 6} fontSize="9" fill="#e11d48" fontFamily="Inter, sans-serif" fontWeight="600">
            1/Vmax
          </text>
        </>
      )}

      {/* Data points */}
      {lbData.map((d, i) => (
        <circle key={i} cx={xScale(d.x)} cy={yScale(d.y)} r={4}
          fill="#2563eb" stroke="#fff" strokeWidth="1.5">
          <title>1/[S]={d.x.toPrecision(3)}, 1/v={d.y.toPrecision(3)}</title>
        </circle>
      ))}

      {/* Axes */}
      <line x1={margin.left} x2={svgW - margin.right} y1={yScale(0)} y2={yScale(0)} stroke="#94a3b8" />
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + h} stroke="#e2e8f0" />
      <text x={margin.left + w / 2} y={svgH - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif">1/[S]</text>
      <text x={14} y={margin.top + h / 2} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif" transform={`rotate(-90, 14, ${margin.top + h / 2})`}>1/v</text>
      <text x={margin.left + w / 2} y={margin.top - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">Lineweaver-Burk Plot</text>
    </svg>
  );
}

function EHPlot({ data, fit, svgRef }: { data: DataPoint[]; fit: ReturnType<typeof fitMM>; svgRef: React.RefObject<SVGSVGElement> }) {
  const svgW = 600, svgH = 420;
  const margin = { top: 25, right: 25, bottom: 55, left: 60 };
  const w = svgW - margin.left - margin.right;
  const h = svgH - margin.top - margin.bottom;

  // Eadie-Hofstee: v = Vmax - Km * (v/[S])
  const ehData = data.filter(d => d.s > 0 && d.v > 0).map(d => ({ x: d.v / d.s, y: d.v }));
  if (ehData.length === 0) return null;

  const maxX = Math.max(...ehData.map(d => d.x)) * 1.3;
  const maxY = Math.max(...ehData.map(d => d.y), fit?.vmax || 0) * 1.15;

  const xScale = (v: number) => margin.left + (v / maxX) * w;
  const yScale = (v: number) => margin.top + h - (v / maxY) * h;

  let lineD = "";
  if (fit) {
    const x1 = 0;
    const x2 = fit.vmax / fit.km;
    lineD = `M${xScale(x1).toFixed(1)},${yScale(fit.vmax).toFixed(1)} L${xScale(x2).toFixed(1)},${yScale(0).toFixed(1)}`;
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
      <rect width={svgW} height={svgH} fill="#fff" />

      {lineD && <path d={lineD} fill="none" stroke="#2563eb" strokeWidth="2" />}

      {/* Vmax intercept */}
      {fit && (
        <text x={xScale(0) + 8} y={yScale(fit.vmax) + 4} fontSize="9" fill="#e11d48" fontFamily="Inter, sans-serif" fontWeight="600">
          Vmax = {fit.vmax.toPrecision(4)}
        </text>
      )}

      {ehData.map((d, i) => (
        <circle key={i} cx={xScale(d.x)} cy={yScale(d.y)} r={4}
          fill="#2563eb" stroke="#fff" strokeWidth="1.5">
          <title>v/[S]={d.x.toPrecision(3)}, v={d.y.toPrecision(3)}</title>
        </circle>
      ))}

      <line x1={margin.left} x2={svgW - margin.right} y1={margin.top + h} y2={margin.top + h} stroke="#e2e8f0" />
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + h} stroke="#e2e8f0" />
      <text x={margin.left + w / 2} y={svgH - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif">v / [S]</text>
      <text x={14} y={margin.top + h / 2} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif" transform={`rotate(-90, 14, ${margin.top + h / 2})`}>v</text>
      <text x={margin.left + w / 2} y={margin.top - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">Eadie-Hofstee Plot</text>
    </svg>
  );
}

// ── Main ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Enzyme Kinetics Plotter - BioSketch",
  description: "Plot Michaelis-Menten, Lineweaver-Burk, and Eadie-Hofstee curves. Calculate Km and Vmax from substrate concentration and velocity data.",
  url: "https://biosketch.art/enzyme-kinetics",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const EnzymeKinetics = () => {
  useTrackToolVisit("enzyme-kinetics");
  const navigate = useNavigate();
  const [rawInput, setRawInput] = useState(EXAMPLES.standard.data);
  const [plotType, setPlotType] = useState<PlotType>("mm");
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => parseData(rawInput), [rawInput]);
  const fit = useMemo(() => fitMM(data), [data]);

  const svgW = 600, svgH = 420;

  const exportPlot = (format: 'svg' | 'png') => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(svgW));
    clone.setAttribute('height', String(svgH));
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = 'text{font-family:Inter,sans-serif}';
    clone.insertBefore(styleEl, clone.firstChild);
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    if (format === 'svg') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `enzyme-kinetics-${plotType}.svg`; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = svgW * 3; c.height = svgH * 3;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `enzyme-kinetics-${plotType}.png`; a.click(); });
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

  const copyResults = () => {
    if (!fit) return;
    navigator.clipboard.writeText(`Km: ${fit.km.toPrecision(4)}\nVmax: ${fit.vmax.toPrecision(4)}\nR²: ${fit.rSq.toFixed(4)}\nKcat/Km: ${(fit.vmax / fit.km).toPrecision(4)}`);
    setCopied(true);
    toast.success("Results copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Enzyme Kinetics Plotter - Michaelis-Menten, Lineweaver-Burk | BioSketch"
        description="Plot Michaelis-Menten, Lineweaver-Burk, and Eadie-Hofstee enzyme kinetics curves online for free. Calculate Km, Vmax, catalytic efficiency, and R-squared from substrate concentration and velocity data. Export publication-quality plots. No signup required."
        canonical="https://biosketch.art/enzyme-kinetics"
        keywords="Michaelis-Menten plot, Lineweaver-Burk plot, Eadie-Hofstee plot, enzyme kinetics calculator, Km Vmax calculator, enzyme kinetics plotter, Michaelis-Menten equation, double reciprocal plot, enzyme kinetics online, biochemistry tool"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
            Enzyme Kinetics Plotter
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Michaelis-Menten, Lineweaver-Burk, and Eadie-Hofstee plots with Km/Vmax determination.
          </p>
          <ToolRating toolId="enzyme-kinetics" />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-72 space-y-5 shrink-0">
            {/* Data */}
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
              <p className="text-[10px] text-muted-foreground mb-1.5">Columns: [S] (substrate conc.), v (velocity)</p>
              <textarea
                className="w-full font-mono text-[10px] p-2.5 rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-vertical min-h-[100px]"
                value={rawInput} onChange={e => setRawInput(e.target.value)} rows={6}
              />
            </div>

            {/* Examples */}
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

            {/* Plot type */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Plot type</Label>
              <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/40">
                {([
                  { id: "mm" as PlotType, label: "M-M" },
                  { id: "lb" as PlotType, label: "L-B" },
                  { id: "eh" as PlotType, label: "E-H" },
                ]).map(t => (
                  <button key={t.id} onClick={() => setPlotType(t.id)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${plotType === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            {fit && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Kinetic Parameters</span>
                  <button onClick={copyResults} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: "Km", value: fit.km.toPrecision(4) },
                    { label: "Vmax", value: fit.vmax.toPrecision(4) },
                    { label: "Vmax/Km", value: (fit.vmax / fit.km).toPrecision(4) },
                    { label: "R²", value: fit.rSq.toFixed(4) },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="font-semibold font-mono text-foreground">{r.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-primary/10">
                  Model: v = Vmax·[S] / (Km + [S])
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => exportPlot('svg')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> SVG
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => exportPlot('png')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> PNG
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={openInCanvas}>
                Canvas
              </Button>
            </div>
          </div>

          {/* Plot */}
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-xl border border-border p-4 aspect-[60/42]">
              {data.length > 0 ? (
                plotType === "mm" ? <MMPlot data={data} fit={fit} svgRef={svgRef} /> :
                plotType === "lb" ? <LBPlot data={data} fit={fit} svgRef={svgRef} /> :
                <EHPlot data={data} fit={fit} svgRef={svgRef} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                  Paste [S] and v data to generate plots
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5 max-w-2xl">
          <p><strong>Michaelis-Menten:</strong> v = Vmax·[S] / (Km + [S]). The hyperbolic curve plots velocity vs substrate concentration directly.</p>
          <p><strong>Lineweaver-Burk:</strong> 1/v = (Km/Vmax)·(1/[S]) + 1/Vmax. Double-reciprocal linearization. Y-intercept = 1/Vmax, X-intercept = -1/Km, slope = Km/Vmax.</p>
          <p><strong>Eadie-Hofstee:</strong> v = Vmax - Km·(v/[S]). Plots v vs v/[S]. Y-intercept = Vmax, slope = -Km. Less sensitive to outliers than Lineweaver-Burk.</p>
          <p><strong>Km:</strong> Substrate concentration at half-maximal velocity — indicates enzyme-substrate affinity. Lower Km = higher affinity.</p>
          <p><strong>Vmax/Km:</strong> Catalytic efficiency (specificity constant when [E] is known). Higher = more efficient enzyme.</p>
        </div>
      </div>
    </div>
  );
};

export default EnzymeKinetics;
