import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Copy, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// ── Types ──
interface Event { time: number; status: number; group: string; }
interface KMStep { time: number; survival: number; nRisk: number; nEvent: number; nCensor: number; }
interface GroupResult { name: string; steps: KMStep[]; median: number | null; color: string; }
interface LogRankResult { chiSq: number; pValue: number; df: number; }

// ── Kaplan-Meier estimator ──
function computeKM(events: Event[], groupName: string): KMStep[] {
  const grouped = events.filter(e => e.group === groupName).sort((a, b) => a.time - b.time);
  if (grouped.length === 0) return [];

  const steps: KMStep[] = [{ time: 0, survival: 1, nRisk: grouped.length, nEvent: 0, nCensor: 0 }];
  let nRisk = grouped.length;
  let survival = 1;

  // Get unique event times
  const times = Array.from(new Set(grouped.map(e => e.time))).sort((a, b) => a - b);

  for (const t of times) {
    const atTime = grouped.filter(e => e.time === t);
    const nEvent = atTime.filter(e => e.status === 1).length;
    const nCensor = atTime.filter(e => e.status === 0).length;

    if (nEvent > 0) {
      survival *= (nRisk - nEvent) / nRisk;
      steps.push({ time: t, survival, nRisk, nEvent, nCensor });
    } else if (nCensor > 0) {
      steps.push({ time: t, survival, nRisk, nEvent: 0, nCensor });
    }
    nRisk -= (nEvent + nCensor);
  }

  return steps;
}

function getMedian(steps: KMStep[]): number | null {
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].survival <= 0.5) return steps[i].time;
  }
  return null;
}

// ── Log-rank test ──
function logRankTest(events: Event[], groups: string[]): LogRankResult | null {
  if (groups.length < 2) return null;

  const allTimes = Array.from(new Set(events.filter(e => e.status === 1).map(e => e.time))).sort((a, b) => a - b);

  // For each group, compute observed vs expected
  const O: Record<string, number> = {};
  const E: Record<string, number> = {};
  const V: Record<string, number> = {};
  groups.forEach(g => { O[g] = 0; E[g] = 0; V[g] = 0; });

  for (const t of allTimes) {
    // At-risk counts
    const nj: Record<string, number> = {};
    const dj: Record<string, number> = {};
    let N = 0, D = 0;

    groups.forEach(g => {
      nj[g] = events.filter(e => e.group === g && e.time >= t).length;
      dj[g] = events.filter(e => e.group === g && e.time === t && e.status === 1).length;
      N += nj[g];
      D += dj[g];
    });

    if (N <= 1) continue;

    groups.forEach(g => {
      O[g] += dj[g];
      const ej = (nj[g] * D) / N;
      E[g] += ej;
      V[g] += ej * (N - D) * (N - nj[g]) / (N * Math.max(N - 1, 1));
    });
  }

  // Chi-squared statistic (using first k-1 groups)
  let chiSq = 0;
  for (let i = 0; i < groups.length - 1; i++) {
    const g = groups[i];
    if (V[g] > 0) chiSq += (O[g] - E[g]) ** 2 / V[g];
  }

  const df = groups.length - 1;

  // Chi-squared p-value approximation (Wilson-Hilferty)
  const pValue = chiSquaredPValue(chiSq, df);

  return { chiSq, pValue, df };
}

// Simple chi-squared p-value via incomplete gamma approximation
function chiSquaredPValue(x: number, k: number): number {
  if (x <= 0) return 1;
  // Use regularized incomplete gamma function approximation
  const a = k / 2;
  const z = x / 2;
  // Series expansion for lower incomplete gamma
  let sum = 0, term = 1 / a;
  sum = term;
  for (let n = 1; n < 200; n++) {
    term *= z / (a + n);
    sum += term;
    if (Math.abs(term) < 1e-12) break;
  }
  const lowerGamma = Math.exp(-z + a * Math.log(z) - lgamma(a)) * sum;
  return Math.max(0, Math.min(1, 1 - lowerGamma));
}

function lgamma(x: number): number {
  // Stirling's approximation for log-gamma
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ── Colors ──
const GROUP_COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

// ── Example datasets ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  treatment: {
    label: "Treatment vs Control",
    data: `Time\tStatus\tGroup
2\t1\tControl
5\t1\tControl
7\t0\tControl
9\t1\tControl
12\t1\tControl
14\t0\tControl
17\t1\tControl
20\t1\tControl
23\t1\tControl
25\t0\tControl
28\t1\tControl
30\t1\tControl
4\t0\tTreatment
8\t1\tTreatment
12\t0\tTreatment
16\t0\tTreatment
20\t1\tTreatment
24\t0\tTreatment
28\t0\tTreatment
32\t1\tTreatment
36\t0\tTreatment
40\t0\tTreatment
44\t1\tTreatment
48\t0\tTreatment`,
  },
  oncology: {
    label: "3-arm oncology trial",
    data: `Time\tStatus\tGroup
1\t1\tPlacebo
3\t1\tPlacebo
5\t1\tPlacebo
6\t0\tPlacebo
8\t1\tPlacebo
10\t1\tPlacebo
12\t1\tPlacebo
14\t1\tPlacebo
16\t0\tPlacebo
18\t1\tPlacebo
3\t0\tLow Dose
6\t1\tLow Dose
9\t0\tLow Dose
12\t1\tLow Dose
15\t0\tLow Dose
18\t1\tLow Dose
21\t0\tLow Dose
24\t1\tLow Dose
27\t0\tLow Dose
30\t1\tLow Dose
5\t0\tHigh Dose
10\t0\tHigh Dose
15\t1\tHigh Dose
20\t0\tHigh Dose
25\t0\tHigh Dose
30\t0\tHigh Dose
35\t1\tHigh Dose
40\t0\tHigh Dose
45\t0\tHigh Dose
50\t0\tHigh Dose`,
  },
};

function parseData(text: string): Event[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const events: Event[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 3) continue;
    const time = parseFloat(parts[0]);
    const status = parseInt(parts[1]);
    const group = parts[2].trim();
    if (isNaN(time) || isNaN(status) || time < 0) continue;
    events.push({ time, status, group });
  }
  return events;
}

// ── SVG Plot ──
function KMPlot({ groups, logRank, showCI, showNAR, maxTime }: {
  groups: GroupResult[]; logRank: LogRankResult | null;
  showCI: boolean; showNAR: boolean; maxTime: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const svgW = 680, svgH = showNAR ? 520 : 440;
  const margin = { top: 30, right: 30, bottom: showNAR ? 100 : 55, left: 55 };
  const w = svgW - margin.left - margin.right;
  const h = svgH - margin.top - margin.bottom - (showNAR ? 40 : 0);

  const xScale = (v: number) => margin.left + (v / maxTime) * w;
  const yScale = (v: number) => margin.top + h - v * h;

  // X ticks
  const xStep = maxTime <= 20 ? 2 : maxTime <= 50 ? 5 : maxTime <= 100 ? 10 : 20;
  const xTicks: number[] = [];
  for (let t = 0; t <= maxTime; t += xStep) xTicks.push(t);

  // Y ticks
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // Number at risk time points
  const narTimes = xTicks;

  const getNARAtTime = (steps: KMStep[], t: number): number => {
    let nar = 0;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].time <= t) { nar = steps[i].nRisk - steps[i].nEvent - steps[i].nCensor; break; }
    }
    return Math.max(0, nar);
  };

  // Step path builder
  const stepPath = (steps: KMStep[]): string => {
    if (steps.length === 0) return "";
    let d = `M${xScale(steps[0].time).toFixed(1)},${yScale(steps[0].survival).toFixed(1)}`;
    for (let i = 1; i < steps.length; i++) {
      // Horizontal to this time point at previous survival
      d += ` L${xScale(steps[i].time).toFixed(1)},${yScale(steps[i - 1].survival).toFixed(1)}`;
      // Vertical drop
      d += ` L${xScale(steps[i].time).toFixed(1)},${yScale(steps[i].survival).toFixed(1)}`;
    }
    // Extend to maxTime
    const last = steps[steps.length - 1];
    d += ` L${xScale(maxTime).toFixed(1)},${yScale(last.survival).toFixed(1)}`;
    return d;
  };

  const exportPlot = (format: 'svg' | 'png') => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = 'text{font-family:Inter,sans-serif}';
    clone.insertBefore(styleEl, clone.firstChild);
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    if (format === 'svg') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'kaplan-meier.svg'; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => {
          if (!b) return; const a = document.createElement('a');
          a.href = URL.createObjectURL(b); a.download = 'kaplan-meier.png'; a.click();
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
    // Rasterize to PNG so Fabric.js resize works proportionally
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

  (window as any).__exportKM = exportPlot;
  (window as any).__openKMInCanvas = openInCanvas;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
      <rect width={svgW} height={svgH} fill="#fff" />

      {/* Grid */}
      {yTicks.map(t => (
        <line key={`yg-${t}`} x1={margin.left} x2={svgW - margin.right}
          y1={yScale(t)} y2={yScale(t)} stroke="#f1f5f9" strokeWidth="1" />
      ))}

      {/* 50% reference line */}
      <line x1={margin.left} x2={svgW - margin.right}
        y1={yScale(0.5)} y2={yScale(0.5)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4,3" />

      {/* Curves */}
      {groups.map((g, gi) => (
        <g key={g.name}>
          {/* Step curve */}
          <path d={stepPath(g.steps)} fill="none" stroke={g.color} strokeWidth="2.5" />

          {/* Censoring ticks */}
          {g.steps.filter(s => s.nCensor > 0 && s.time > 0).map((s, i) => {
            const prevStep = g.steps[g.steps.indexOf(s) - 1] || s;
            return (
              <line key={`c-${gi}-${i}`}
                x1={xScale(s.time)} x2={xScale(s.time)}
                y1={yScale(prevStep.survival) - 5} y2={yScale(prevStep.survival) + 5}
                stroke={g.color} strokeWidth="1.5" />
            );
          })}

          {/* Median line */}
          {g.median !== null && (
            <line x1={xScale(g.median)} x2={xScale(g.median)}
              y1={yScale(0.5)} y2={margin.top + h}
              stroke={g.color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
          )}
        </g>
      ))}

      {/* X axis */}
      <line x1={margin.left} x2={svgW - margin.right}
        y1={margin.top + h} y2={margin.top + h} stroke="#e2e8f0" strokeWidth="1" />
      {xTicks.map(t => (
        <g key={`xt-${t}`}>
          <line x1={xScale(t)} x2={xScale(t)} y1={margin.top + h} y2={margin.top + h + 4} stroke="#94a3b8" />
          <text x={xScale(t)} y={margin.top + h + 16} textAnchor="middle"
            fontSize="10" fill="#64748b" fontFamily="Inter, sans-serif">{t}</text>
        </g>
      ))}
      <text x={margin.left + w / 2} y={margin.top + h + 34} textAnchor="middle"
        fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif">
        Time
      </text>

      {/* Y axis */}
      <line x1={margin.left} x2={margin.left}
        y1={margin.top} y2={margin.top + h} stroke="#e2e8f0" strokeWidth="1" />
      {yTicks.map(t => (
        <g key={`yt-${t}`}>
          <line x1={margin.left - 4} x2={margin.left} y1={yScale(t)} y2={yScale(t)} stroke="#94a3b8" />
          <text x={margin.left - 8} y={yScale(t) + 3} textAnchor="end"
            fontSize="10" fill="#64748b" fontFamily="Inter, sans-serif">{(t * 100).toFixed(0)}%</text>
        </g>
      ))}
      <text x={15} y={margin.top + h / 2} textAnchor="middle"
        fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif"
        transform={`rotate(-90, 15, ${margin.top + h / 2})`}>
        Survival Probability
      </text>

      {/* Legend */}
      <g transform={`translate(${svgW - margin.right - 140}, ${margin.top + 5})`}>
        <rect width="135" height={groups.length * 18 + 10} rx="4" fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
        {groups.map((g, i) => (
          <g key={g.name} transform={`translate(8, ${i * 18 + 12})`}>
            <line x1="0" x2="16" y1="0" y2="0" stroke={g.color} strokeWidth="2.5" />
            <text x="22" y="3" fontSize="10" fill="#475569" fontFamily="Inter, sans-serif">{g.name}</text>
          </g>
        ))}
      </g>

      {/* Log-rank p-value */}
      {logRank && (
        <text x={svgW - margin.right - 5} y={margin.top + groups.length * 18 + 30}
          textAnchor="end" fontSize="10" fill="#64748b" fontFamily="Inter, sans-serif">
          Log-rank p={logRank.pValue < 0.001 ? logRank.pValue.toExponential(2) : logRank.pValue.toFixed(4)}
        </text>
      )}

      {/* Number at risk table */}
      {showNAR && (
        <g transform={`translate(0, ${margin.top + h + 50})`}>
          <text x={margin.left - 8} y={0} textAnchor="end" fontSize="8" fontWeight="600"
            fill="#94a3b8" fontFamily="Inter, sans-serif">No. at risk</text>
          {groups.map((g, gi) => (
            <g key={g.name} transform={`translate(0, ${gi * 14 + 14})`}>
              <text x={margin.left - 8} y={0} textAnchor="end" fontSize="8"
                fill={g.color} fontFamily="Inter, sans-serif" fontWeight="500">{g.name}</text>
              {narTimes.map((t, ti) => (
                <text key={ti} x={xScale(t)} y={0} textAnchor="middle" fontSize="8"
                  fill="#64748b" fontFamily="Inter, sans-serif">
                  {getNARAtTime(g.steps, t)}
                </text>
              ))}
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Kaplan-Meier Survival Curve Generator - BioSketch",
  description: "Generate Kaplan-Meier survival curves online. Paste time-to-event data, compute log-rank p-value, median survival, and number-at-risk tables. Export as SVG or PNG.",
  url: "https://biosketch.art/kaplan-meier",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const KaplanMeier = () => {
  useTrackToolVisit("kaplan-meier");
  const navigate = useNavigate();
  const [rawInput, setRawInput] = useState(EXAMPLES.treatment.data);
  const [showNAR, setShowNAR] = useState(true);
  const [showCI, setShowCI] = useState(false);
  const [copied, setCopied] = useState(false);

  const events = useMemo(() => parseData(rawInput), [rawInput]);
  const groupNames = useMemo(() => Array.from(new Set(events.map(e => e.group))), [events]);
  const maxTime = useMemo(() => Math.max(...events.map(e => e.time), 1) * 1.1, [events]);

  const groupResults: GroupResult[] = useMemo(() => {
    return groupNames.map((name, i) => {
      const steps = computeKM(events, name);
      return { name, steps, median: getMedian(steps), color: GROUP_COLORS[i % GROUP_COLORS.length] };
    });
  }, [events, groupNames]);

  const logRank = useMemo(() => {
    if (groupNames.length < 2) return null;
    return logRankTest(events, groupNames);
  }, [events, groupNames]);

  const copyResults = () => {
    const lines: string[] = [];
    groupResults.forEach(g => {
      lines.push(`${g.name}: Median survival = ${g.median !== null ? g.median.toFixed(1) : 'NR'}, N = ${g.steps[0]?.nRisk || 0}`);
    });
    if (logRank) {
      lines.push(`Log-rank test: χ² = ${logRank.chiSq.toFixed(3)}, df = ${logRank.df}, p = ${logRank.pValue < 0.001 ? logRank.pValue.toExponential(2) : logRank.pValue.toFixed(4)}`);
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Results copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Kaplan-Meier Survival Curve Generator | BioSketch"
        description="Generate Kaplan-Meier survival curves online for free. Paste time-to-event data with censoring, compute log-rank test p-value, median survival time, and number-at-risk tables. Supports multiple groups. Export publication-quality plots as SVG or PNG. No signup required."
        canonical="https://biosketch.art/kaplan-meier"
        keywords="Kaplan-Meier survival curve, survival analysis tool, log-rank test calculator, time to event analysis, censoring survival data, median survival calculator, Kaplan-Meier plot maker, clinical trial survival curve, free survival analysis, KM curve generator"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
            Kaplan-Meier Survival Curves
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Time-to-event survival analysis with log-rank test and number-at-risk tables.
          </p>
          <ToolRating toolId="kaplan-meier" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawInput); navigate("/chart-studio?type=survival"); }}
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
              <p className="text-[10px] text-muted-foreground mb-1.5">Columns: Time, Status (1=event, 0=censored), Group</p>
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

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showNAR} onChange={e => setShowNAR(e.target.checked)} className="accent-primary" />
                Number-at-risk table
              </label>
            </div>

            {/* Group summaries */}
            {groupResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Groups</span>
                  <button onClick={copyResults} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                {groupResults.map(g => (
                  <div key={g.name} className="p-3 rounded-lg border border-border/40 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="text-xs font-semibold text-foreground">{g.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 text-[10px] text-muted-foreground">
                      <span>N = {g.steps[0]?.nRisk || 0}</span>
                      <span>Events = {g.steps.reduce((s, st) => s + st.nEvent, 0)}</span>
                      <span>Median = {g.median !== null ? g.median.toFixed(1) : "NR"}</span>
                      <span>Censored = {g.steps.reduce((s, st) => s + st.nCensor, 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Log-rank test */}
            {logRank && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                <span className="text-xs font-semibold text-foreground">Log-Rank Test</span>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <p>χ² = {logRank.chiSq.toFixed(3)}, df = {logRank.df}</p>
                  <p>p-value = <span className={`font-semibold ${logRank.pValue < 0.05 ? "text-green-600" : "text-muted-foreground"}`}>
                    {logRank.pValue < 0.001 ? logRank.pValue.toExponential(2) : logRank.pValue.toFixed(4)}
                  </span>
                    {logRank.pValue < 0.05 && " *"}
                    {logRank.pValue < 0.01 && "*"}
                    {logRank.pValue < 0.001 && "*"}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__exportKM?.("svg")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> SVG
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__exportKM?.("png")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> PNG
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => (window as any).__openKMInCanvas?.()}>
                Canvas
              </Button>
            </div>
          </div>

          {/* Plot */}
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-xl border border-border p-4">
              {groupResults.length > 0 ? (
                <KMPlot groups={groupResults} logRank={logRank}
                  showCI={showCI} showNAR={showNAR} maxTime={maxTime} />
              ) : (
                <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">
                  Paste data with Time, Status, and Group columns
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5 max-w-2xl">
          <p><strong>Format:</strong> Tab or comma-separated with 3 columns — Time, Status (1=event/death, 0=censored/alive), Group name. First row is the header.</p>
          <p><strong>Kaplan-Meier estimator:</strong> Non-parametric survival function estimate. Step function decreases at each event time. Censored observations are marked with vertical ticks.</p>
          <p><strong>Log-rank test:</strong> Tests the null hypothesis that survival curves are identical across groups. *p&lt;0.05, **p&lt;0.01, ***p&lt;0.001.</p>
          <p><strong>Median survival:</strong> Time at which the survival probability drops to 50%. NR = not reached (survival stays above 50%).</p>
          <p><strong>Number-at-risk:</strong> Shows how many subjects remain in each group at each time point — essential for assessing statistical power.</p>
        </div>
      </div>
    </div>
  );
};

export default KaplanMeier;
