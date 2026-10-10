import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Copy, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

interface DataPoint { x: number; y: number; }

type RegressionType = "linear" | "polynomial2" | "polynomial3" | "logarithmic" | "exponential" | "power";

interface RegressionResult {
  type: RegressionType;
  label: string;
  equation: string;
  rSquared: number;
  pValue: number;
  predict: (x: number) => number;
  coefficients: number[];
}

// ── Statistics ──

function linearRegression(data: DataPoint[]): RegressionResult {
  const n = data.length;
  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
  const meanX = sumX / n, meanY = sumY / n;

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = meanY - slope * meanX;

  const predict = (x: number) => slope * x + intercept;
  const { rSq, pVal } = calcStats(data, predict, 1);

  return {
    type: "linear", label: "Linear",
    equation: `y = ${fmtCoef(slope)}x ${intercept >= 0 ? "+" : "−"} ${fmtCoef(Math.abs(intercept))}`,
    rSquared: rSq, pValue: pVal, predict, coefficients: [slope, intercept],
  };
}

function polynomialRegression(data: DataPoint[], degree: number): RegressionResult {
  const n = data.length;
  // Normal equations via matrix (Vandermonde)
  const size = degree + 1;
  const A: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const b: number[] = Array(size).fill(0);

  for (const d of data) {
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        A[i][j] += Math.pow(d.x, i + j);
      }
      b[i] += d.y * Math.pow(d.x, i);
    }
  }

  // Gaussian elimination
  const coeffs = gaussianSolve(A, b);
  if (!coeffs) return linearRegression(data);

  const predict = (x: number) => coeffs.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
  const { rSq, pVal } = calcStats(data, predict, degree);

  const terms = coeffs.map((c, i) => {
    if (i === 0) return fmtCoef(c);
    const sign = c >= 0 ? " + " : " − ";
    return `${sign}${fmtCoef(Math.abs(c))}x${i > 1 ? "^" + i : ""}`;
  }).join("");

  return {
    type: degree === 2 ? "polynomial2" : "polynomial3",
    label: `Polynomial (degree ${degree})`,
    equation: `y = ${terms}`, rSquared: rSq, pValue: pVal, predict, coefficients: coeffs,
  };
}

function logarithmicRegression(data: DataPoint[]): RegressionResult {
  const filtered = data.filter(d => d.x > 0);
  if (filtered.length < 3) return linearRegression(data);
  const logData = filtered.map(d => ({ x: Math.log(d.x), y: d.y }));
  const lr = linearRegression(logData);
  const a = lr.coefficients[0], b = lr.coefficients[1];
  const predict = (x: number) => x > 0 ? a * Math.log(x) + b : 0;
  const { rSq, pVal } = calcStats(filtered, predict, 1);
  return {
    type: "logarithmic", label: "Logarithmic",
    equation: `y = ${fmtCoef(a)}·ln(x) ${b >= 0 ? "+" : "−"} ${fmtCoef(Math.abs(b))}`,
    rSquared: rSq, pValue: pVal, predict, coefficients: [a, b],
  };
}

function exponentialRegression(data: DataPoint[]): RegressionResult {
  const filtered = data.filter(d => d.y > 0);
  if (filtered.length < 3) return linearRegression(data);
  const logData = filtered.map(d => ({ x: d.x, y: Math.log(d.y) }));
  const lr = linearRegression(logData);
  const a = Math.exp(lr.coefficients[1]), b = lr.coefficients[0];
  const predict = (x: number) => a * Math.exp(b * x);
  const { rSq, pVal } = calcStats(filtered, predict, 1);
  return {
    type: "exponential", label: "Exponential",
    equation: `y = ${fmtCoef(a)}·e^(${fmtCoef(b)}x)`,
    rSquared: rSq, pValue: pVal, predict, coefficients: [a, b],
  };
}

function powerRegression(data: DataPoint[]): RegressionResult {
  const filtered = data.filter(d => d.x > 0 && d.y > 0);
  if (filtered.length < 3) return linearRegression(data);
  const logData = filtered.map(d => ({ x: Math.log(d.x), y: Math.log(d.y) }));
  const lr = linearRegression(logData);
  const a = Math.exp(lr.coefficients[1]), b = lr.coefficients[0];
  const predict = (x: number) => x > 0 ? a * Math.pow(x, b) : 0;
  const { rSq, pVal } = calcStats(filtered, predict, 1);
  return {
    type: "power", label: "Power",
    equation: `y = ${fmtCoef(a)}·x^${fmtCoef(b)}`,
    rSquared: rSq, pValue: pVal, predict, coefficients: [a, b],
  };
}

function calcStats(data: DataPoint[], predict: (x: number) => number, p: number) {
  const n = data.length;
  const meanY = data.reduce((s, d) => s + d.y, 0) / n;
  const ssTot = data.reduce((s, d) => s + (d.y - meanY) ** 2, 0);
  const ssRes = data.reduce((s, d) => s + (d.y - predict(d.x)) ** 2, 0);
  const rSq = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // F-statistic for regression significance
  const ssReg = ssTot - ssRes;
  const dfReg = p;
  const dfRes = Math.max(n - p - 1, 1);
  const fStat = dfRes > 0 && ssRes > 0 ? (ssReg / dfReg) / (ssRes / dfRes) : 0;
  const pVal = fToPValue(fStat, dfReg, dfRes);

  return { rSq, pVal };
}

// Approximate F-distribution p-value
function fToPValue(f: number, d1: number, d2: number): number {
  if (f <= 0 || d1 <= 0 || d2 <= 0) return 1;
  const x = d2 / (d2 + d1 * f);
  return betaIncomplete(d2 / 2, d1 / 2, x);
}

function betaIncomplete(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betaCF(a, b, x) / a;
  return 1 - bt * betaCF(b, a, 1 - x) / b;
}

function betaCF(a: number, b: number, x: number): number {
  const maxIter = 200;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return h;
}

function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function gaussianSolve(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    if (Math.abs(M[i][i]) < 1e-12) return null;
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function fmtCoef(v: number): string {
  return Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(3) : v.toFixed(4).replace(/\.?0+$/, '');
}

// ── Confidence interval (linear only) ──
function linearCI(data: DataPoint[], slope: number, intercept: number, x: number, alpha: number = 0.05): number {
  const n = data.length;
  if (n < 3) return 0;
  const meanX = data.reduce((s, d) => s + d.x, 0) / n;
  const ssRes = data.reduce((s, d) => s + (d.y - (slope * d.x + intercept)) ** 2, 0);
  const mse = ssRes / (n - 2);
  const ssX = data.reduce((s, d) => s + (d.x - meanX) ** 2, 0);
  // t-value approximation for 95% CI
  const tVal = 1.96 + 2.4 / n; // rough approximation
  return tVal * Math.sqrt(mse * (1 / n + (x - meanX) ** 2 / ssX));
}

// ── Examples ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  correlation: {
    label: "Linear correlation",
    data: `x\ty
2\t4.1
4\t7.8
6\t12.3
8\t15.9
10\t20.2
12\t23.5
14\t28.1
16\t31.4
18\t35.8
20\t39.2`,
  },
  enzyme: {
    label: "Enzyme activity",
    data: `Temperature\tActivity
10\t12
15\t22
20\t38
25\t55
30\t72
35\t85
37\t92
40\t88
45\t65
50\t35`,
  },
  growth: {
    label: "Bacterial growth",
    data: `Time_h\tOD600
0\t0.05
1\t0.08
2\t0.14
3\t0.28
4\t0.55
5\t1.05
6\t1.82
7\t2.45
8\t2.85
9\t3.02
10\t3.10`,
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
    const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
    if (isNaN(x) || isNaN(y)) continue;
    points.push({ x, y });
  }
  return points.sort((a, b) => a.x - b.x);
}

// ── SVG Plot ──
function ScatterSVG({ data, reg, showCI, svgRef, xLabel, yLabel }: {
  data: DataPoint[]; reg: RegressionResult | null; showCI: boolean;
  svgRef: React.RefObject<SVGSVGElement>; xLabel: string; yLabel: string;
}) {
  const svgW = 650, svgH = 460;
  const margin = { top: 25, right: 25, bottom: 55, left: 60 };
  const w = svgW - margin.left - margin.right;
  const h = svgH - margin.top - margin.bottom;

  const xs = data.map(d => d.x), ys = data.map(d => d.y);
  const xMin = Math.min(...xs) - (Math.max(...xs) - Math.min(...xs)) * 0.08;
  const xMax = Math.max(...xs) + (Math.max(...xs) - Math.min(...xs)) * 0.08;
  const yMin = Math.min(...ys) - (Math.max(...ys) - Math.min(...ys)) * 0.08;
  const yMax = Math.max(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.08;

  const xScale = (v: number) => margin.left + ((v - xMin) / (xMax - xMin)) * w;
  const yScale = (v: number) => margin.top + h - ((v - yMin) / (yMax - yMin)) * h;

  // Regression curve points
  const curveN = 200;
  const curvePoints: string[] = [];
  if (reg) {
    for (let i = 0; i <= curveN; i++) {
      const x = xMin + (i / curveN) * (xMax - xMin);
      const y = reg.predict(x);
      if (isFinite(y)) curvePoints.push(`${i === 0 ? 'M' : 'L'}${xScale(x).toFixed(1)},${yScale(y).toFixed(1)}`);
    }
  }

  // CI band (linear only)
  const ciUpper: string[] = [], ciLower: string[] = [];
  if (showCI && reg?.type === "linear") {
    const [slope, intercept] = reg.coefficients;
    for (let i = 0; i <= curveN; i++) {
      const x = xMin + (i / curveN) * (xMax - xMin);
      const ci = linearCI(data, slope, intercept, x);
      const yPred = reg.predict(x);
      ciUpper.push(`${i === 0 ? 'M' : 'L'}${xScale(x).toFixed(1)},${yScale(yPred + ci).toFixed(1)}`);
      ciLower.push(`${xScale(x).toFixed(1)},${yScale(yPred - ci).toFixed(1)}`);
    }
  }

  // Axis ticks
  const xTicks = autoTicks(xMin, xMax, 8);
  const yTicks = autoTicks(yMin, yMax, 6);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
      <rect width={svgW} height={svgH} fill="#fff" />

      {/* Grid */}
      {yTicks.map(t => (
        <line key={`yg-${t}`} x1={margin.left} x2={svgW - margin.right} y1={yScale(t)} y2={yScale(t)} stroke="#f1f5f9" strokeWidth="1" />
      ))}

      {/* CI band */}
      {ciUpper.length > 0 && (
        <path d={ciUpper.join(' ') + ' L' + ciLower.reverse().join(' L') + ' Z'}
          fill="#2563eb" opacity="0.08" />
      )}

      {/* Regression curve */}
      {curvePoints.length > 0 && (
        <path d={curvePoints.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2" />
      )}

      {/* Data points */}
      {data.map((d, i) => (
        <circle key={i} cx={xScale(d.x)} cy={yScale(d.y)} r={4.5}
          fill="#2563eb" stroke="#fff" strokeWidth="1.5" opacity="0.85">
          <title>{`(${d.x}, ${d.y})`}</title>
        </circle>
      ))}

      {/* X axis */}
      <line x1={margin.left} x2={svgW - margin.right} y1={margin.top + h} y2={margin.top + h} stroke="#e2e8f0" />
      {xTicks.map(t => (
        <g key={`xt-${t}`}>
          <line x1={xScale(t)} x2={xScale(t)} y1={margin.top + h} y2={margin.top + h + 4} stroke="#94a3b8" />
          <text x={xScale(t)} y={margin.top + h + 16} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="Inter, sans-serif">{fmtTick(t)}</text>
        </g>
      ))}
      <text x={margin.left + w / 2} y={svgH - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif">{xLabel}</text>

      {/* Y axis */}
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + h} stroke="#e2e8f0" />
      {yTicks.map(t => (
        <g key={`yt-${t}`}>
          <line x1={margin.left - 4} x2={margin.left} y1={yScale(t)} y2={yScale(t)} stroke="#94a3b8" />
          <text x={margin.left - 8} y={yScale(t) + 3} textAnchor="end" fontSize="10" fill="#64748b" fontFamily="Inter, sans-serif">{fmtTick(t)}</text>
        </g>
      ))}
      <text x={14} y={margin.top + h / 2} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif" transform={`rotate(-90, 14, ${margin.top + h / 2})`}>{yLabel}</text>

      {/* Stats annotation */}
      {reg && (
        <g transform={`translate(${margin.left + 10}, ${margin.top + 10})`}>
          <rect width="200" height="42" rx="4" fill="#fff" stroke="#e2e8f0" opacity="0.95" />
          <text x="8" y="14" fontSize="9" fill="#334155" fontFamily="Inter, sans-serif" fontWeight="600">{reg.equation}</text>
          <text x="8" y="27" fontSize="9" fill="#64748b" fontFamily="Inter, sans-serif">
            R² = {reg.rSquared.toFixed(4)}
          </text>
          <text x="100" y="27" fontSize="9" fill="#64748b" fontFamily="Inter, sans-serif">
            p = {reg.pValue < 0.001 ? reg.pValue.toExponential(2) : reg.pValue.toFixed(4)}
          </text>
          <text x="8" y="38" fontSize="8" fill="#94a3b8" fontFamily="Inter, sans-serif">n = {data.length}</text>
        </g>
      )}
    </svg>
  );
}

function autoTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(range / count)));
  const mult = [1, 2, 5, 10].find(m => range / (step * m) <= count) || 1;
  const s = step * mult;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / s) * s; t <= max; t += s) ticks.push(t);
  return ticks;
}

function fmtTick(v: number): string {
  if (Math.abs(v) >= 10000 || (Math.abs(v) < 0.01 && v !== 0)) return v.toExponential(1);
  return parseFloat(v.toPrecision(4)).toString();
}

// ── Main ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Scatter Plot with Regression - BioSketch",
  description: "Create scatter plots with regression lines, R-squared, p-values, and confidence intervals. Linear, polynomial, logarithmic, exponential, and power regression.",
  url: "https://biosketch.art/scatter-plot",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const ScatterPlot = () => {
  useTrackToolVisit("scatter-plot");
  const navigate = useNavigate();
  const [rawInput, setRawInput] = useState(EXAMPLES.correlation.data);
  const [regType, setRegType] = useState<RegressionType>("linear");
  const [showCI, setShowCI] = useState(true);
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => parseData(rawInput), [rawInput]);

  // Parse axis labels from header
  const headers = useMemo(() => {
    const lines = rawInput.trim().split("\n");
    if (lines.length < 1) return { x: "X", y: "Y" };
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const parts = lines[0].split(sep);
    return { x: parts[0]?.trim() || "X", y: parts[1]?.trim() || "Y" };
  }, [rawInput]);

  const reg = useMemo(() => {
    if (data.length < 3) return null;
    switch (regType) {
      case "linear": return linearRegression(data);
      case "polynomial2": return polynomialRegression(data, 2);
      case "polynomial3": return polynomialRegression(data, 3);
      case "logarithmic": return logarithmicRegression(data);
      case "exponential": return exponentialRegression(data);
      case "power": return powerRegression(data);
      default: return linearRegression(data);
    }
  }, [data, regType]);

  const svgW = 650, svgH = 460;

  const exportPlot = (format: 'svg' | 'png') => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(svgW)); clone.setAttribute('height', String(svgH));
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = 'text{font-family:Inter,sans-serif}';
    clone.insertBefore(styleEl, clone.firstChild);
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    if (format === 'svg') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'scatter-plot.svg'; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = svgW * 3; c.height = svgH * 3;
        const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'scatter-plot.png'; a.click(); });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const openInCanvas = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(svgW)); clone.setAttribute('height', String(svgH));
    clone.removeAttribute('class');
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = 'text{font-family:Inter,sans-serif}';
    clone.insertBefore(styleEl, clone.firstChild);
    const svgStr = new XMLSerializer().serializeToString(clone);
    const scale = 3; const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = svgW * scale; c.height = svgH * scale;
      const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/png');
      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"><image width="${svgW}" height="${svgH}" xlink:href="${dataUrl}"/></svg>`;
      sessionStorage.setItem('volcano_svg_import', svgOut);
      window.location.href = '/canvas';
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  };

  const copyResults = () => {
    if (!reg) return;
    navigator.clipboard.writeText(`${reg.equation}\nR² = ${reg.rSquared.toFixed(4)}\np-value = ${reg.pValue < 0.001 ? reg.pValue.toExponential(2) : reg.pValue.toFixed(4)}\nn = ${data.length}`);
    setCopied(true); toast.success("Results copied"); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Scatter Plot with Regression & Statistics | BioSketch"
        description="Create scatter plots with regression lines online for free. Linear, polynomial, logarithmic, exponential, and power regression with R-squared, p-value, and 95% confidence intervals. Export publication-quality plots as SVG or PNG. No signup required."
        canonical="https://biosketch.art/scatter-plot"
        keywords="scatter plot maker, regression line calculator, R squared calculator, scatter plot with statistics, linear regression online, polynomial regression, confidence interval plot, p value regression, XY scatter plot, free scatter plot tool, publication scatter plot"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">Scatter Plot with Regression</h1>
          <p className="text-sm text-muted-foreground mt-1.5">XY scatter with regression line, R², p-value, and confidence intervals.</p>
          <ToolRating toolId="scatter-plot" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawInput); navigate("/chart-studio?type=xy"); }}
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
              <p className="text-[10px] text-muted-foreground mb-1.5">Columns: X, Y (header row = axis labels)</p>
              <textarea className="w-full font-mono text-[10px] p-2.5 rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-vertical min-h-[100px]"
                value={rawInput} onChange={e => setRawInput(e.target.value)} rows={6} />
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

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Regression type</Label>
              <Select value={regType} onValueChange={(v: any) => setRegType(v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear" className="text-xs">Linear</SelectItem>
                  <SelectItem value="polynomial2" className="text-xs">Polynomial (degree 2)</SelectItem>
                  <SelectItem value="polynomial3" className="text-xs">Polynomial (degree 3)</SelectItem>
                  <SelectItem value="logarithmic" className="text-xs">Logarithmic</SelectItem>
                  <SelectItem value="exponential" className="text-xs">Exponential</SelectItem>
                  <SelectItem value="power" className="text-xs">Power</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer mt-2">
                <input type="checkbox" checked={showCI} onChange={e => setShowCI(e.target.checked)} className="accent-primary" />
                95% confidence interval {regType !== "linear" && "(linear only)"}
              </label>
            </div>

            {reg && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{reg.label} Regression</span>
                  <button onClick={copyResults} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <p className="text-[10px] font-mono text-foreground break-all">{reg.equation}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">R²</span>
                    <span className={`ml-1 font-semibold font-mono ${reg.rSquared > 0.9 ? "text-green-600" : reg.rSquared > 0.7 ? "text-yellow-600" : "text-red-600"}`}>
                      {reg.rSquared.toFixed(4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">p</span>
                    <span className={`ml-1 font-semibold font-mono ${reg.pValue < 0.05 ? "text-green-600" : "text-muted-foreground"}`}>
                      {reg.pValue < 0.001 ? reg.pValue.toExponential(2) : reg.pValue.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => exportPlot('svg')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> SVG
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => exportPlot('png')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> PNG
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={openInCanvas}>Canvas</Button>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-xl border border-border p-4 aspect-[65/46]">
              {data.length > 0 ? (
                <ScatterSVG data={data} reg={reg} showCI={showCI} svgRef={svgRef} xLabel={headers.x} yLabel={headers.y} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Paste X, Y data to generate plot</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5 max-w-2xl">
          <p><strong>Regression types:</strong> Linear (y=mx+b), Polynomial (degree 2-3), Logarithmic (y=a·ln(x)+b), Exponential (y=a·e^bx), Power (y=a·x^b).</p>
          <p><strong>R² (coefficient of determination):</strong> Proportion of variance explained. 1.0 = perfect fit, 0.0 = no relationship.</p>
          <p><strong>p-value:</strong> F-test significance of the regression. p&lt;0.05 = statistically significant relationship.</p>
          <p><strong>95% CI:</strong> Confidence interval for the regression line (linear regression only). Shows the range where the true mean response lies with 95% confidence.</p>
          <p><strong>Axis labels:</strong> Automatically extracted from the header row of your data.</p>
        </div>
      </div>
    </div>
  );
};

export default ScatterPlot;
