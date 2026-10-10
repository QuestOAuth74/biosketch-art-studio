import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// ── Color Scales ──
const COLOR_SCALES: Record<string, { name: string; neg: string; zero: string; pos: string }> = {
  rdbu: { name: "Red–Blue", neg: "#2166AC", zero: "#f7f7f7", pos: "#B2182B" },
  rdylbu: { name: "Red–Yellow–Blue", neg: "#2166AC", zero: "#FFFFBF", pos: "#D73027" },
  prgn: { name: "Purple–Green", neg: "#1B7837", zero: "#f7f7f7", pos: "#762A83" },
  brbg: { name: "Brown–Teal", neg: "#01665E", zero: "#f5f5f5", pos: "#8C510A" },
  piyg: { name: "Pink–Green", neg: "#4DAC26", zero: "#f7f7f7", pos: "#D01C8B" },
  viridis: { name: "Viridis", neg: "#440154", zero: "#21918C", pos: "#FDE725" },
  thermal: { name: "Thermal", neg: "#0000CC", zero: "#FF6600", pos: "#FFFF00" },
  bw: { name: "Grayscale", neg: "#000000", zero: "#999999", pos: "#ffffff" },
};

type CorrMethod = "pearson" | "spearman";

// ── Example Datasets ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  iris: {
    label: "Iris Features",
    data: `SepalLength\tSepalWidth\tPetalLength\tPetalWidth
5.1\t3.5\t1.4\t0.2
4.9\t3.0\t1.4\t0.2
4.7\t3.2\t1.3\t0.2
4.6\t3.1\t1.5\t0.2
5.0\t3.6\t1.4\t0.2
5.4\t3.9\t1.7\t0.4
4.6\t3.4\t1.4\t0.3
5.0\t3.4\t1.5\t0.2
4.4\t2.9\t1.4\t0.2
4.9\t3.1\t1.5\t0.1
7.0\t3.2\t4.7\t1.4
6.4\t3.2\t4.5\t1.5
6.9\t3.1\t4.9\t1.5
5.5\t2.3\t4.0\t1.3
6.5\t2.8\t4.6\t1.5
5.7\t2.8\t4.5\t1.3
6.3\t3.3\t4.7\t1.6
4.9\t2.4\t3.3\t1.0
6.6\t2.9\t4.6\t1.3
5.2\t2.7\t3.9\t1.4
6.3\t3.3\t6.0\t2.5
5.8\t2.7\t5.1\t1.9
7.1\t3.0\t5.9\t2.1
6.3\t2.9\t5.6\t1.8
6.5\t3.0\t5.8\t2.2
7.6\t3.0\t6.6\t2.1
4.9\t2.5\t4.5\t1.7
7.3\t2.9\t6.3\t1.8
6.7\t2.5\t5.8\t1.8
7.2\t3.6\t6.1\t2.5`,
  },
  clinical: {
    label: "Clinical Markers",
    data: `Age\tBMI\tGlucose\tInsulin\tBP
45\t27.3\t95\t12.5\t130
52\t31.2\t110\t18.3\t145
38\t24.1\t88\t10.2\t120
61\t29.8\t125\t22.1\t155
33\t22.5\t82\t8.7\t115
48\t28.6\t102\t15.4\t138
55\t32.1\t118\t20.8\t150
42\t25.7\t91\t11.9\t125
59\t30.5\t122\t21.5\t152
36\t23.8\t85\t9.5\t118
50\t29.2\t108\t17.6\t142
44\t26.4\t93\t13.1\t128
57\t31.8\t120\t19.9\t148
40\t25.0\t89\t10.8\t122
63\t33.5\t130\t24.2\t160
35\t22.9\t83\t8.9\t116
47\t27.9\t99\t14.7\t135
53\t30.0\t115\t19.1\t146
41\t26.1\t92\t12.3\t126
58\t31.4\t123\t21.8\t153`,
  },
  gene_panel: {
    label: "Gene Panel",
    data: `TP53\tBRCA1\tMYC\tEGFR\tKRAS\tPTEN
8.2\t4.1\t6.5\t3.2\t2.8\t5.9
7.8\t4.5\t6.8\t3.0\t3.1\t5.5
9.1\t3.8\t7.2\t3.5\t2.5\t6.2
7.5\t4.3\t6.3\t2.8\t3.3\t5.7
8.5\t4.0\t6.9\t3.3\t2.7\t6.0
8.0\t4.4\t6.6\t3.1\t3.0\t5.8
9.3\t3.6\t7.4\t3.6\t2.4\t6.4
7.2\t4.6\t6.1\t2.7\t3.4\t5.4
8.8\t3.9\t7.1\t3.4\t2.6\t6.1
7.6\t4.2\t6.4\t2.9\t3.2\t5.6
8.3\t4.1\t6.7\t3.2\t2.9\t5.9
9.0\t3.7\t7.3\t3.5\t2.5\t6.3
7.4\t4.5\t6.2\t2.8\t3.3\t5.5
8.6\t3.8\t7.0\t3.3\t2.7\t6.1
7.9\t4.3\t6.5\t3.0\t3.1\t5.7`,
  },
};

// ── Statistics ──
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

function spearmanCorrelation(x: number[], y: number[]): number {
  const rank = (arr: number[]) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    for (let i = 0; i < sorted.length; i++) ranks[sorted[i].i] = i + 1;
    return ranks;
  };
  return pearsonCorrelation(rank(x), rank(y));
}

function interpolateColor(c1: string, c2: string, t: number): string {
  const hex = (s: string) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const [r1, g1, b1] = hex(c1);
  const [r2, g2, b2] = hex(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ── Component ──
const CorrelationMatrix = () => {
  useTrackToolVisit("correlation-matrix");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [rawData, setRawData] = useState(EXAMPLES.iris.data);
  const [title, setTitle] = useState("Correlation Matrix");
  const [colorScale, setColorScale] = useState("rdbu");
  const [method, setMethod] = useState<CorrMethod>("pearson");
  const [showValues, setShowValues] = useState(true);
  const [showColorbar, setShowColorbar] = useState(true);
  const [upperTriangleOnly, setUpperTriangleOnly] = useState(false);
  const [absScale, setAbsScale] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse data into columns
  const { variables, corrMatrix } = useMemo(() => {
    const lines = rawData.trim().split("\n").filter(Boolean);
    if (lines.length < 3) return { variables: [] as string[], corrMatrix: [] as number[][] };

    const header = lines[0].split(/\t|,/).map(h => h.trim());
    const nVars = header.length;
    const columns: number[][] = header.map(() => []);

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\t|,/);
      for (let j = 0; j < nVars; j++) {
        const val = parseFloat(parts[j]);
        if (!isNaN(val)) columns[j].push(val);
      }
    }

    // Ensure all columns have the same length
    const minLen = Math.min(...columns.map(c => c.length));
    const trimmed = columns.map(c => c.slice(0, minLen));

    const corrFn = method === "spearman" ? spearmanCorrelation : pearsonCorrelation;
    const matrix: number[][] = [];
    for (let i = 0; i < nVars; i++) {
      const row: number[] = [];
      for (let j = 0; j < nVars; j++) {
        row.push(corrFn(trimmed[i], trimmed[j]));
      }
      matrix.push(row);
    }

    return { variables: header, corrMatrix: matrix };
  }, [rawData, method]);

  const n = variables.length;
  const cellSize = Math.min(60, Math.max(30, 400 / Math.max(n, 1)));
  const labelSpace = 80;
  const colorbarW = 20;
  const colorbarGap = 15;
  const svgW = labelSpace + n * cellSize + (showColorbar ? colorbarGap + colorbarW + 30 : 0) + 20;
  const svgH = 50 + n * cellSize + labelSpace;
  const gridX = labelSpace;
  const gridY = 50;

  const scale = COLOR_SCALES[colorScale];

  const getColor = (r: number): string => {
    const v = absScale ? Math.abs(r) : r;
    if (absScale) {
      return interpolateColor(scale.zero, scale.pos, v);
    }
    if (v >= 0) return interpolateColor(scale.zero, scale.pos, v);
    return interpolateColor(scale.zero, scale.neg, -v);
  };

  const getTextColor = (r: number): string => {
    const abs = Math.abs(r);
    return abs > 0.65 ? "#ffffff" : "#000000";
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
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "correlation-matrix.svg"; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "correlation-matrix.png"; a.click(); });
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
      sessionStorage.setItem("corrmatrix_svg_import", svgOut);
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
        title="Free Correlation Matrix Maker | BioSketch"
        description="Generate publication-quality correlation matrices online for free. Pearson and Spearman correlations with customizable color scales. Export as SVG or PNG."
        keywords="correlation matrix, Pearson correlation, Spearman correlation, heatmap, pairwise correlation, data analysis, scientific figure, free correlation tool"
        canonical="https://biosketch.art/correlation-matrix"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Grid3X3 className="h-6 w-6 text-primary" />
                Correlation Matrix
              </h1>
              <p className="text-sm text-muted-foreground">Pearson or Spearman correlation heatmap with customizable color scales</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              <div className="space-y-2">
                <Label>Data (columns = variables, tab/comma separated with headers)</Label>
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
                <Label>Correlation Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as CorrMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pearson">Pearson (linear)</SelectItem>
                    <SelectItem value="spearman">Spearman (rank)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color Scale</Label>
                <Select value={colorScale} onValueChange={setColorScale}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLOR_SCALES).map(([id, cs]) => (
                      <SelectItem key={id} value={id}>
                        <span className="flex items-center gap-2">
                          <span className="flex">
                            <span className="w-3 h-3 inline-block" style={{ backgroundColor: cs.neg }} />
                            <span className="w-3 h-3 inline-block" style={{ backgroundColor: cs.zero }} />
                            <span className="w-3 h-3 inline-block" style={{ backgroundColor: cs.pos }} />
                          </span>
                          {cs.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Values</Label>
                  <Switch checked={showValues} onCheckedChange={setShowValues} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Color Bar</Label>
                  <Switch checked={showColorbar} onCheckedChange={setShowColorbar} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Upper Triangle Only</Label>
                  <Switch checked={upperTriangleOnly} onCheckedChange={setUpperTriangleOnly} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Absolute Scale (0 to 1)</Label>
                  <Switch checked={absScale} onCheckedChange={setAbsScale} />
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
              <div className="border rounded-lg overflow-auto bg-white p-4">
                <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="max-w-full h-auto" style={{ minWidth: Math.min(svgW, 400) }}>
                  <rect width={svgW} height={svgH} fill="#ffffff" />

                  {/* Title */}
                  <text x={gridX + (n * cellSize) / 2} y={30} textAnchor="middle" fill="#000000" fontSize="16" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">{title}</text>

                  {/* Row labels (left) */}
                  {variables.map((v, i) => (
                    <text key={`rl-${i}`} x={gridX - 6} y={gridY + i * cellSize + cellSize / 2 + 4} textAnchor="end" fill="#000000" fontSize={Math.min(11, cellSize * 0.35)} fontFamily="Inter,system-ui,sans-serif">{v}</text>
                  ))}

                  {/* Column labels (bottom, rotated) */}
                  {variables.map((v, j) => (
                    <text key={`cl-${j}`} x={gridX + j * cellSize + cellSize / 2} y={gridY + n * cellSize + 8} textAnchor="start" fill="#000000" fontSize={Math.min(11, cellSize * 0.35)} fontFamily="Inter,system-ui,sans-serif"
                      transform={`rotate(45, ${gridX + j * cellSize + cellSize / 2}, ${gridY + n * cellSize + 8})`}>{v}</text>
                  ))}

                  {/* Cells */}
                  {corrMatrix.map((row, i) =>
                    row.map((r, j) => {
                      if (upperTriangleOnly && j < i) return null;
                      const x = gridX + j * cellSize;
                      const y = gridY + i * cellSize;
                      return (
                        <g key={`${i}-${j}`}>
                          <rect x={x} y={y} width={cellSize} height={cellSize} fill={getColor(r)} stroke="#ffffff" strokeWidth="1" />
                          {showValues && (
                            <text x={x + cellSize / 2} y={y + cellSize / 2 + 4} textAnchor="middle" fill={getTextColor(r)}
                              fontSize={Math.min(10, cellSize * 0.3)} fontWeight="500" fontFamily="Inter,system-ui,sans-serif">
                              {r.toFixed(2)}
                            </text>
                          )}
                        </g>
                      );
                    })
                  )}

                  {/* Grid outline */}
                  <rect x={gridX} y={gridY} width={n * cellSize} height={n * cellSize} fill="none" stroke="#000000" strokeWidth="1" />

                  {/* Color bar */}
                  {showColorbar && (
                    <g>
                      <defs>
                        <linearGradient id="corrColorbar" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor={absScale ? scale.zero : scale.neg} />
                          <stop offset="50%" stopColor={scale.zero} />
                          <stop offset="100%" stopColor={scale.pos} />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const cbX = gridX + n * cellSize + colorbarGap;
                        const cbH = n * cellSize;
                        return (
                          <>
                            <rect x={cbX} y={gridY} width={colorbarW} height={cbH} fill="url(#corrColorbar)" stroke="#000000" strokeWidth="0.5" />
                            <text x={cbX + colorbarW + 5} y={gridY + 4} fill="#000000" fontSize="9" fontFamily="Inter,system-ui,sans-serif">{absScale ? "1.0" : "+1.0"}</text>
                            <text x={cbX + colorbarW + 5} y={gridY + cbH / 2 + 3} fill="#000000" fontSize="9" fontFamily="Inter,system-ui,sans-serif">{absScale ? "0.5" : "0.0"}</text>
                            <text x={cbX + colorbarW + 5} y={gridY + cbH + 4} fill="#000000" fontSize="9" fontFamily="Inter,system-ui,sans-serif">{absScale ? "0.0" : "-1.0"}</text>
                          </>
                        );
                      })()}
                    </g>
                  )}
                </svg>
              </div>

              <div className="mt-4"><ToolRating toolId="correlation-matrix" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawData); navigate("/chart-studio?type=heatmap"); }}
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

export default CorrelationMatrix;
