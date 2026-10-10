import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Copy, Check, Upload, ChevronDown, X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

interface DataPoint {
  gene: string;
  log2FC: number;
  pValue: number;
  pAdj: number | null;
  negLog10P: number;
  status: "up" | "down" | "ns";
}

// ── Example datasets ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  deseq2: {
    label: "DESeq2 (RNA-seq)",
    data: `Gene\tlog2FoldChange\tpvalue\tpadj
TP53\t2.45\t0.00001\t0.00008
BRCA1\t-3.12\t0.000005\t0.00005
MYC\t1.89\t0.0003\t0.0018
EGFR\t-1.56\t0.002\t0.009
KRAS\t0.34\t0.45\t0.62
PTEN\t-2.78\t0.00002\t0.00015
RB1\t1.12\t0.01\t0.038
APC\t-0.89\t0.08\t0.18
CDK4\t2.01\t0.0001\t0.0007
PIK3CA\t-1.23\t0.005\t0.021
BRAF\t0.67\t0.12\t0.25
ATM\t-2.34\t0.00008\t0.0006
CDKN2A\t3.45\t0.000001\t0.00001
MDM2\t1.78\t0.0004\t0.0024
NRAS\t-0.45\t0.34\t0.51
ERBB2\t2.89\t0.00003\t0.00025
VHL\t-1.67\t0.003\t0.014
WT1\t0.23\t0.67\t0.79
SMAD4\t-2.12\t0.0002\t0.0013
CTNNB1\t1.45\t0.007\t0.029
JAK2\t0.12\t0.89\t0.94
ABL1\t-1.89\t0.001\t0.005
FLT3\t2.67\t0.00005\t0.0004
KIT\t-0.56\t0.23\t0.39
RET\t1.34\t0.009\t0.035
ALK\t-2.56\t0.00006\t0.00048
MET\t0.78\t0.06\t0.15
FGFR1\t-1.01\t0.04\t0.11
IDH1\t2.23\t0.0002\t0.0013
NPM1\t-0.34\t0.56\t0.71
RUNX1\t1.56\t0.004\t0.018
EZH2\t-1.45\t0.006\t0.025
DNMT3A\t0.89\t0.05\t0.13
TET2\t-2.01\t0.0003\t0.0018
ASXL1\t1.23\t0.01\t0.038
SF3B1\t-0.67\t0.15\t0.29
SRSF2\t0.45\t0.34\t0.51
U2AF1\t-1.78\t0.002\t0.009
STAG2\t2.12\t0.0001\t0.0007
RAD21\t-0.23\t0.78\t0.87`,
  },
  proteomics: {
    label: "Proteomics (TMT)",
    data: `Protein\tlog2FC\tpvalue
HSP90AA1\t1.89\t0.0001
GAPDH\t0.12\t0.78
ACTB\t-0.23\t0.56
TUBB\t0.34\t0.34
ENO1\t1.45\t0.003
PKM\t-1.67\t0.001
LDHA\t2.12\t0.00005
ALDOA\t-0.89\t0.07
TPI1\t0.67\t0.12
PGK1\t1.23\t0.008
PGAM1\t-1.34\t0.005
GPI\t0.45\t0.23
HK2\t2.56\t0.00002
PFKL\t-1.12\t0.02
CS\t0.78\t0.09
ACO2\t-2.34\t0.00008
IDH2\t1.78\t0.0006
OGDH\t-0.56\t0.34
SUCLA2\t0.23\t0.67
SDHA\t-1.89\t0.0004
FH\t1.01\t0.03
MDH2\t-0.34\t0.45
ATP5F1A\t2.01\t0.0002
NDUFS1\t-1.56\t0.002
UQCRC1\t0.89\t0.06
COX5A\t-2.12\t0.0001
CYC1\t1.67\t0.001
SOD2\t-0.67\t0.18
CAT\t2.89\t0.00001
GPX1\t-1.23\t0.009`,
  },
  edger: {
    label: "edgeR (miRNA)",
    data: `miRNA\tlogFC\tPValue\tFDR
hsa-miR-21-5p\t3.21\t0.0000002\t0.000003
hsa-miR-155-5p\t2.67\t0.000001\t0.000008
hsa-miR-34a-5p\t-2.89\t0.0000008\t0.000005
hsa-miR-122-5p\t-1.45\t0.003\t0.012
hsa-miR-200c-3p\t1.89\t0.0001\t0.0006
hsa-miR-let-7a-5p\t-0.34\t0.45\t0.58
hsa-miR-146a-5p\t2.12\t0.00003\t0.0002
hsa-miR-16-5p\t0.23\t0.67\t0.78
hsa-miR-223-3p\t-2.34\t0.00005\t0.0003
hsa-miR-10b-5p\t1.56\t0.002\t0.009
hsa-miR-221-3p\t2.45\t0.00002\t0.00015
hsa-miR-199a-3p\t-1.78\t0.001\t0.005
hsa-miR-125b-5p\t-0.67\t0.12\t0.22
hsa-miR-9-5p\t1.23\t0.008\t0.028
hsa-miR-142-3p\t0.45\t0.34\t0.48
hsa-miR-150-5p\t-1.12\t0.02\t0.055
hsa-miR-181a-5p\t1.78\t0.0004\t0.002
hsa-miR-29a-3p\t-2.01\t0.0002\t0.001
hsa-miR-92a-3p\t0.56\t0.18\t0.31
hsa-miR-130a-3p\t-0.89\t0.06\t0.14`,
  },
  metabolomics: {
    label: "Metabolomics",
    data: `Metabolite\tlog2FC\tpvalue
Glucose\t-1.89\t0.0002
Lactate\t2.34\t0.00005
Pyruvate\t-0.45\t0.34
Citrate\t-1.56\t0.003
Succinate\t1.23\t0.008
Fumarate\t-0.78\t0.09
Malate\t0.34\t0.45
Glutamate\t2.12\t0.00008
Glutamine\t-2.45\t0.00003
Aspartate\t1.67\t0.001
Alanine\t0.23\t0.67
Serine\t-1.34\t0.005
Glycine\t0.89\t0.04
Tryptophan\t-2.01\t0.0001
Phenylalanine\t1.45\t0.006
Leucine\t0.56\t0.15
Valine\t-0.67\t0.12
Palmitate\t1.89\t0.0003
Oleate\t-1.12\t0.02
Cholesterol\t0.12\t0.78`,
  },
};

// Clean pasted text (Excel BOM, Windows \r\n, curly quotes, extra whitespace)
function cleanPastedText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")           // BOM
    .replace(/\r\n/g, "\n")           // Windows line endings
    .replace(/\r/g, "\n")             // Old Mac line endings
    .replace(/[\u201C\u201D]/g, '"')  // Curly double quotes
    .replace(/[\u2018\u2019]/g, "'")  // Curly single quotes
    .replace(/\u00A0/g, " ");         // Non-breaking spaces
}

function detectHasPadj(text: string): boolean {
  const lines = cleanPastedText(text).trim().split("\n");
  if (lines.length < 1) return false;
  const header = lines[0].toLowerCase();
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const cols = header.split(sep);
  if (cols.length < 4) return false;
  const padjKeywords = ["padj", "p_adj", "p.adj", "fdr", "q_value", "qvalue", "adj.p", "adjp", "p.adjust", "p_adjust"];
  return padjKeywords.some(kw => cols[3].trim().includes(kw)) || cols.length >= 4;
}

function parseData(text: string, fcThreshold: number, pThreshold: number, useAdjusted: boolean): DataPoint[] {
  const lines = cleanPastedText(text).trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes("\t") ? "\t" : ",";
  const points: DataPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 3) continue;
    const gene = parts[0].trim();
    const log2FC = parseFloat(parts[1]);
    const pValue = parseFloat(parts[2]);
    const pAdj = parts.length >= 4 ? parseFloat(parts[3]) : null;
    if (isNaN(log2FC) || isNaN(pValue) || pValue <= 0) continue;
    if (pAdj !== null && (isNaN(pAdj) || pAdj <= 0)) {
      // If padj column exists but value is invalid, still parse with raw p-value
    }

    const effectiveP = (useAdjusted && pAdj !== null && !isNaN(pAdj) && pAdj > 0) ? pAdj : pValue;
    const negLog10P = -Math.log10(effectiveP);
    let status: "up" | "down" | "ns" = "ns";
    if (effectiveP < pThreshold && log2FC > fcThreshold) status = "up";
    else if (effectiveP < pThreshold && log2FC < -fcThreshold) status = "down";

    points.push({ gene, log2FC, pValue, pAdj: (pAdj !== null && !isNaN(pAdj) && pAdj > 0) ? pAdj : null, negLog10P, status });
  }
  return points;
}

// ── SVG Volcano Plot ──
function VolcanoSVG({
  points, fcThreshold, pThreshold, showLabels, topN, pinnedLabels, onTogglePin, useAdjusted,
  colors, symmetricX, highlightedGenes,
  labelOffsets, onUpdateLabelOffset,
}: {
  points: DataPoint[]; fcThreshold: number; pThreshold: number;
  showLabels: boolean; topN: number;
  pinnedLabels: Set<string>; onTogglePin: (gene: string) => void;
  useAdjusted: boolean;
  colors: { up: string; down: string; ns: string };
  symmetricX: boolean;
  highlightedGenes: Set<string>;
  labelOffsets: Map<string, { dx: number; dy: number }>;
  onUpdateLabelOffset: (gene: string, dx: number, dy: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ point: DataPoint; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<{ gene: string; startX: number; startY: number; origDx: number; origDy: number } | null>(null);

  const handleMouseEnter = useCallback((p: DataPoint, cx: number, cy: number) => {
    setHoveredPoint({ point: p, x: cx, y: cy });
  }, []);
  const handleMouseLeave = useCallback(() => setHoveredPoint(null), []);

  // Convert mouse event to SVG coordinates
  const toSvgCoords = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleLabelMouseDown = useCallback((e: React.MouseEvent, gene: string, defaultDx: number, defaultDy: number) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = toSvgCoords(e);
    const existing = labelOffsets.get(gene);
    setDragging({
      gene,
      startX: pos.x,
      startY: pos.y,
      origDx: existing?.dx ?? defaultDx,
      origDy: existing?.dy ?? defaultDy,
    });
  }, [toSvgCoords, labelOffsets]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const pos = toSvgCoords(e);
    const newDx = dragging.origDx + (pos.x - dragging.startX);
    const newDy = dragging.origDy + (pos.y - dragging.startY);
    onUpdateLabelOffset(dragging.gene, newDx, newDy);
  }, [dragging, toSvgCoords, onUpdateLabelOffset]);

  const handleSvgMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const svgW = 700, svgH = 520;
  const margin = { top: 30, right: 30, bottom: 60, left: 65 };
  const w = svgW - margin.left - margin.right;
  const h = svgH - margin.top - margin.bottom;

  // Scales
  let xMin = Math.min(-5, ...points.map(p => p.log2FC)) - 0.5;
  let xMax = Math.max(5, ...points.map(p => p.log2FC)) + 0.5;
  if (symmetricX) {
    const absMax = Math.max(Math.abs(xMin), Math.abs(xMax));
    xMin = -absMax;
    xMax = absMax;
  }
  const yMax = Math.max(5, ...points.map(p => p.negLog10P)) * 1.1;

  const xScale = (v: number) => margin.left + ((v - xMin) / (xMax - xMin)) * w;
  const yScale = (v: number) => margin.top + h - (v / yMax) * h;

  const negLog10PThresh = -Math.log10(pThreshold);

  // Top significant genes for labeling
  const sigPoints = points.filter(p => p.status !== "ns").sort((a, b) => b.negLog10P - a.negLog10P);
  const labeled = showLabels ? sigPoints.slice(0, topN) : [];

  // Tick helpers
  const xTicks: number[] = [];
  const xStep = Math.ceil((xMax - xMin) / 10);
  for (let t = Math.ceil(xMin); t <= Math.floor(xMax); t += xStep) xTicks.push(t);

  const yTicks: number[] = [];
  const yStep = Math.max(1, Math.ceil(yMax / 8));
  for (let t = 0; t <= yMax; t += yStep) yTicks.push(t);

  const exportPlot = (format: "svg" | "png") => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = "text{font-family:Inter,sans-serif}";
    clone.insertBefore(styleEl, clone.firstChild);
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: "image/svg+xml" });

    if (format === "svg") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "volcano-plot.svg";
      a.click();
    } else {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => {
          if (!b) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = "volcano-plot.png";
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

  (window as any).__exportVolcano = exportPlot;
  (window as any).__openVolcanoInCanvas = openInCanvas;

  // Counts
  const upCount = points.filter(p => p.status === "up").length;
  const downCount = points.filter(p => p.status === "down").length;
  const nsCount = points.filter(p => p.status === "ns").length;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full" data-volcano-svg
      onMouseMove={handleSvgMouseMove}
      onMouseUp={handleSvgMouseUp}
      onMouseLeave={handleSvgMouseUp}>
      <rect width={svgW} height={svgH} fill="#ffffff" />

      {/* Grid lines */}
      {yTicks.map(t => (
        <line key={`yg-${t}`} x1={margin.left} x2={svgW - margin.right}
          y1={yScale(t)} y2={yScale(t)} stroke="#f1f5f9" strokeWidth="1" />
      ))}

      {/* Threshold lines */}
      {/* p-value threshold */}
      <line x1={margin.left} x2={svgW - margin.right}
        y1={yScale(negLog10PThresh)} y2={yScale(negLog10PThresh)}
        stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" />
      {/* FC thresholds */}
      <line x1={xScale(fcThreshold)} x2={xScale(fcThreshold)}
        y1={margin.top} y2={margin.top + h}
        stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" />
      <line x1={xScale(-fcThreshold)} x2={xScale(-fcThreshold)}
        y1={margin.top} y2={margin.top + h}
        stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" />

      {/* Data points */}
      {points.map((p, i) => {
        const cx = xScale(p.log2FC);
        const cy = yScale(p.negLog10P);
        const isHovered = hoveredPoint?.point === p;
        const isHighlighted = highlightedGenes.size > 0 && highlightedGenes.has(p.gene);
        const dimmed = highlightedGenes.size > 0 && !isHighlighted && !isHovered;
        return (
          <circle key={i}
            cx={cx} cy={cy}
            r={isHovered ? 5.5 : isHighlighted ? 5 : 3.5}
            fill={colors[p.status]}
            opacity={dimmed ? 0.12 : isHovered ? 1 : (p.status === "ns" ? 0.4 : 0.8)}
            stroke={isHighlighted ? "#1e293b" : isHovered ? "#1e293b" : (p.status === "ns" ? "none" : "#fff")}
            strokeWidth={isHighlighted ? 1.5 : isHovered ? 1.5 : 0.5}
            style={{ cursor: "pointer", transition: "r 0.1s, opacity 0.1s" }}
            onMouseEnter={() => handleMouseEnter(p, cx, cy)}
            onMouseLeave={handleMouseLeave}
            onClick={() => onTogglePin(p.gene)}
          />
        );
      })}

      {/* Gene labels (auto top-N + pinned) — draggable */}
      {(() => {
        const autoLabelGenes = new Set(labeled.map(p => p.gene));
        const pinnedPoints = points.filter(p => pinnedLabels.has(p.gene) && !autoLabelGenes.has(p.gene));
        const allLabeled = [...labeled.map(p => ({ ...p, pinned: false })), ...pinnedPoints.map(p => ({ ...p, pinned: true }))];
        return allLabeled.map((p, i) => {
          const pointX = xScale(p.log2FC);
          const pointY = yScale(p.negLog10P);
          const defaultDx = p.log2FC > 0 ? 6 : -6;
          const defaultDy = -5;
          const offset = labelOffsets.get(p.gene);
          const dx = offset?.dx ?? defaultDx;
          const dy = offset?.dy ?? defaultDy;
          const labelX = pointX + dx;
          const labelY = pointY + dy;
          const hasCustomOffset = offset !== undefined;
          const isDraggingThis = dragging?.gene === p.gene;
          // Show leader line if label has been repositioned or is pinned
          const showLeader = hasCustomOffset || p.pinned;
          // Determine text anchor based on which side the label is on
          const anchor = dx >= 0 ? "start" : "end";
          return (
            <g key={`lbl-${i}`}>
              {/* Leader line from data point to label */}
              {showLeader && (
                <line
                  x1={pointX} y1={pointY}
                  x2={labelX} y2={labelY + 3}
                  stroke={colors[p.status]} strokeWidth="0.8" opacity="0.4"
                  strokeDasharray={hasCustomOffset ? "none" : "2,2"}
                  pointerEvents="none"
                />
              )}
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fontSize="9" fontWeight={p.pinned ? "700" : "500"}
                fill={colors[p.status]} fontFamily="Inter, sans-serif"
                textDecoration={p.pinned ? "underline" : "none"}
                style={{ cursor: isDraggingThis ? "grabbing" : "grab", userSelect: "none" }}
                onMouseDown={(e) => handleLabelMouseDown(e, p.gene, defaultDx, defaultDy)}>
                {p.gene}
              </text>
            </g>
          );
        });
      })()}

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
      <text x={margin.left + w / 2} y={svgH - 10} textAnchor="middle"
        fontSize="12" fontWeight="600" fill="#334155" fontFamily="Inter, sans-serif">
        log₂(Fold Change)
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
        {useAdjusted ? "−log₁₀(padj)" : "−log₁₀(p-value)"}
      </text>

      {/* Legend */}
      <g transform={`translate(${svgW - margin.right - 130}, ${margin.top + 5})`}>
        <rect width="125" height="58" rx="4" fill="#fff" stroke="#e2e8f0" strokeWidth="1" />
        {[
          { label: `Up (${upCount})`, color: colors.up, y: 14 },
          { label: `Down (${downCount})`, color: colors.down, y: 30 },
          { label: `NS (${nsCount})`, color: colors.ns, y: 46 },
        ].map(l => (
          <g key={l.label}>
            <circle cx={12} cy={l.y} r={4} fill={l.color} opacity={l.color === colors.ns ? 0.4 : 0.8} />
            <text x={22} y={l.y + 3} fontSize="10" fill="#475569" fontFamily="Inter, sans-serif">{l.label}</text>
          </g>
        ))}
      </g>

      {/* Hover tooltip */}
      {hoveredPoint && (() => {
        const { point: hp, x: tx, y: ty } = hoveredPoint;
        const tooltipW = 180;
        const hasPadj = hp.pAdj !== null;
        const tooltipH = hasPadj ? 68 : 54;
        // Flip tooltip left if near the right edge
        const flipX = tx + tooltipW + 12 > svgW - margin.right;
        const ttX = flipX ? tx - tooltipW - 10 : tx + 10;
        // Flip tooltip down if near the top
        const flipY = ty - tooltipH - 8 < margin.top;
        const ttY = flipY ? ty + 10 : ty - tooltipH - 8;
        const statusLabel = hp.status === "up" ? "Upregulated" : hp.status === "down" ? "Downregulated" : "Not significant";
        return (
          <g pointerEvents="none">
            {/* Shadow */}
            <rect x={ttX - 1} y={ttY - 1} width={tooltipW + 2} height={tooltipH + 2}
              rx="6" fill="rgba(0,0,0,0.08)" />
            {/* Background */}
            <rect x={ttX} y={ttY} width={tooltipW} height={tooltipH}
              rx="5" fill="#1e293b" stroke="#334155" strokeWidth="1" />
            {/* Gene name */}
            <text x={ttX + 8} y={ttY + 15} fontSize="11" fontWeight="700"
              fill="#f8fafc" fontFamily="Inter, sans-serif">
              {hp.gene}
            </text>
            {/* Status badge */}
            <text x={ttX + tooltipW - 8} y={ttY + 15} fontSize="9" fontWeight="600"
              fill={colors[hp.status]} fontFamily="Inter, sans-serif" textAnchor="end">
              {statusLabel}
            </text>
            {/* log2FC */}
            <text x={ttX + 8} y={ttY + 30} fontSize="10"
              fill="#94a3b8" fontFamily="Inter, sans-serif">
              log₂FC: <tspan fill="#e2e8f0" fontWeight="600" fontFamily="monospace">{hp.log2FC.toFixed(3)}</tspan>
            </text>
            {/* p-value */}
            <text x={ttX + 8} y={ttY + 44} fontSize="10"
              fill="#94a3b8" fontFamily="Inter, sans-serif">
              p-value: <tspan fill="#e2e8f0" fontWeight="600" fontFamily="monospace">{hp.pValue.toExponential(2)}</tspan>
            </text>
            {/* padj */}
            {hasPadj && (
              <text x={ttX + 8} y={ttY + 58} fontSize="10"
                fill={useAdjusted ? "#fbbf24" : "#94a3b8"} fontFamily="Inter, sans-serif">
                padj: <tspan fill={useAdjusted ? "#fde68a" : "#e2e8f0"} fontWeight="600" fontFamily="monospace">{hp.pAdj!.toExponential(2)}</tspan>
              </text>
            )}
          </g>
        );
      })()}
    </svg>
  );
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Volcano Plot Maker - BioSketch",
  description: "Generate publication-quality volcano plots from differential expression data. Paste log2 fold-change and p-value data, customize thresholds, label top genes, and export as SVG or PNG.",
  url: "https://biosketch.art/volcano-plot",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const VolcanoPlot = () => {
  useTrackToolVisit("volcano-plot");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Restore state from URL params if present
  const initialFc = searchParams.get("fc") || "1";
  const initialP = searchParams.get("p") || "0.05";
  const initialAdj = searchParams.get("adj") === "1";

  const [rawInput, setRawInput] = useState(EXAMPLES.deseq2.data);
  const [fcThreshold, setFcThreshold] = useState(initialFc);
  const [pThreshold, setPThreshold] = useState(initialP);
  const [showLabels, setShowLabels] = useState(true);
  const [topN, setTopN] = useState("10");
  const [copied, setCopied] = useState(false);
  const [pinnedLabels, setPinnedLabels] = useState<Set<string>>(new Set());
  const [useAdjusted, setUseAdjusted] = useState(initialAdj);
  const [colorUp, setColorUp] = useState("#ef4444");
  const [colorDown, setColorDown] = useState("#3b82f6");
  const [colorNs, setColorNs] = useState("#cbd5e1");
  const [symmetricX, setSymmetricX] = useState(false);
  const [geneSearch, setGeneSearch] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [labelOffsets, setLabelOffsets] = useState<Map<string, { dx: number; dy: number }>>(new Map());
  const [zoomModal, setZoomModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.5);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const zoomAreaRef = useRef<HTMLDivElement>(null);

  const updateLabelOffset = useCallback((gene: string, dx: number, dy: number) => {
    setLabelOffsets(prev => {
      const next = new Map(prev);
      next.set(gene, { dx, dy });
      return next;
    });
  }, []);

  const togglePinnedLabel = useCallback((gene: string) => {
    setPinnedLabels(prev => {
      const next = new Set(prev);
      if (next.has(gene)) next.delete(gene);
      else next.add(gene);
      return next;
    });
  }, []);

  const fcT = parseFloat(fcThreshold) || 1;
  const pT = parseFloat(pThreshold) || 0.05;
  const topNVal = parseInt(topN) || 10;

  const hasPadjColumn = useMemo(() => detectHasPadj(rawInput), [rawInput]);
  const points = useMemo(() => parseData(rawInput, fcT, pT, useAdjusted && hasPadjColumn), [rawInput, fcT, pT, useAdjusted, hasPadjColumn]);

  // Non-passive wheel listener on inline plot to open zoom modal
  useEffect(() => {
    const el = plotContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (points.length === 0) return;
      e.preventDefault();
      setZoomModal(true);
      setZoomLevel(e.deltaY < 0 ? 1.8 : 1.3);
      setPanOffset({ x: 0, y: 0 });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [points.length]);

  // Non-passive wheel listener inside zoom modal for zoom control
  useEffect(() => {
    const el = zoomAreaRef.current;
    if (!el || !zoomModal) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoomLevel(z => {
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        return Math.min(5, Math.max(0.5, z + delta));
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomModal]);

  const sigUp = points.filter(p => p.status === "up");
  const sigDown = points.filter(p => p.status === "down");

  const buildSigGenesTable = (sep: string) => {
    const anyPadj = points.some(p => p.pAdj !== null);
    const header = anyPadj ? `Status${sep}Gene${sep}log2FC${sep}p-value${sep}padj` : `Status${sep}Gene${sep}log2FC${sep}p-value`;
    const lines = [header];
    [...sigUp, ...sigDown].sort((a, b) => a.pValue - b.pValue).forEach(p => {
      const base = `${p.status === "up" ? "UP" : "DOWN"}${sep}${p.gene}${sep}${p.log2FC.toFixed(3)}${sep}${p.pValue.toExponential(2)}`;
      lines.push(anyPadj ? `${base}${sep}${p.pAdj !== null ? p.pAdj.toExponential(2) : "NA"}` : base);
    });
    return lines.join("\n");
  };

  const copySigGenes = () => {
    navigator.clipboard.writeText(buildSigGenesTable("\t"));
    setCopied(true);
    toast.success(`${sigUp.length + sigDown.length} significant genes copied`);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSigGenes = (format: "csv" | "tsv") => {
    const sep = format === "csv" ? "," : "\t";
    const content = buildSigGenesTable(sep);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `significant-genes.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Downloaded ${sigUp.length + sigDown.length} significant genes as ${format.toUpperCase()}`);
  };

  const copyShareUrl = () => {
    const params = new URLSearchParams();
    if (fcThreshold !== "1") params.set("fc", fcThreshold);
    if (pThreshold !== "0.05") params.set("p", pThreshold);
    if (useAdjusted) params.set("adj", "1");
    const qs = params.toString();
    const url = `${window.location.origin}/volcano-plot${qs ? "?" + qs : ""}`;
    navigator.clipboard.writeText(url);
    toast.success("Share URL copied to clipboard");
  };

  const exportPdf = useCallback(() => {
    const svgEl = document.querySelector<SVGSVGElement>("[data-volcano-svg]");
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = "text{font-family:Inter,sans-serif}";
    clone.insertBefore(styleEl, clone.firstChild);
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 700 * 4; canvas.height = 520 * 4;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/png");
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(`<!DOCTYPE html><html><head><title>Volcano Plot</title><style>@page{margin:0.5in}body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}img{max-width:100%;height:auto}</style></head><body><img src="${dataUrl}" onload="setTimeout(()=>{window.print();window.close()},300)"/></body></html>`);
        printWin.document.close();
      }
    };
    img.src = url;
  }, []);

  const highlightedGenes = useMemo(() => {
    if (!geneSearch.trim()) return new Set<string>();
    const q = geneSearch.trim().toUpperCase();
    return new Set(points.filter(p => p.gene.toUpperCase().includes(q)).map(p => p.gene));
  }, [geneSearch, points]);

  const volcanoSvgProps = {
    points, fcThreshold: fcT, pThreshold: pT,
    showLabels, topN: topNVal,
    pinnedLabels, onTogglePin: togglePinnedLabel,
    useAdjusted: useAdjusted && hasPadjColumn,
    colors: { up: colorUp, down: colorDown, ns: colorNs } as { up: string; down: string; ns: string },
    symmetricX,
    highlightedGenes,
    labelOffsets,
    onUpdateLabelOffset: updateLabelOffset,
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Volcano Plot Maker - Differential Expression Visualization | BioSketch"
        description="Generate publication-quality volcano plots online for free. Paste RNA-seq DESeq2 or proteomics data with log2 fold-change and p-values. Customize significance thresholds, label top genes, and export as SVG or PNG. No signup required."
        canonical="https://biosketch.art/volcano-plot"
        keywords="volcano plot maker, volcano plot generator, differential expression plot, DESeq2 volcano plot, RNA-seq visualization, proteomics volcano plot, log2 fold change plot, gene expression visualization, free volcano plot tool, publication volcano plot"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
            Volcano Plot Maker
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Visualize differential expression data with publication-quality volcano plots.
          </p>
          <ToolRating toolId="volcano-plot" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", rawInput); navigate("/chart-studio?type=volcano"); }}
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
            {/* Data input */}
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
              <p className="text-[10px] text-muted-foreground mb-1.5">Columns: Gene, log2FC, p-value{hasPadjColumn ? ", padj" : " (+ optional padj)"}</p>
              <textarea
                className="w-full font-mono text-[10px] p-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-vertical min-h-[100px]"
                value={rawInput} onChange={e => setRawInput(e.target.value)}
                rows={6}
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

            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">|log2FC| cutoff</Label>
                <Input type="text" inputMode="decimal" className="mt-1 h-8 text-xs font-mono"
                  value={fcThreshold} onChange={e => setFcThreshold(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">p-value cutoff</Label>
                <Input type="text" inputMode="decimal" className="mt-1 h-8 text-xs font-mono"
                  value={pThreshold} onChange={e => setPThreshold(e.target.value)} />
              </div>
            </div>

            {/* Adjusted p-value toggle */}
            {hasPadjColumn && (
              <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={useAdjusted} onChange={e => setUseAdjusted(e.target.checked)}
                    className="accent-amber-500" />
                  <span>Use adjusted p-value <span className="text-[10px] opacity-70">(padj/FDR)</span></span>
                </label>
                {useAdjusted && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 ml-5">
                    Y-axis and thresholds use padj
                  </p>
                )}
              </div>
            )}

            {/* Labels */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)}
                  className="accent-primary" />
                Show gene labels
              </label>
              {showLabels && (
                <div>
                  <Label className="text-xs text-muted-foreground">Top N labels</Label>
                  <Input type="text" inputMode="numeric" className="mt-1 h-8 text-xs font-mono w-20"
                    value={topN} onChange={e => setTopN(e.target.value)} />
                </div>
              )}
            </div>

            {/* Search genes */}
            <div>
              <Label className="text-xs text-muted-foreground">Search genes</Label>
              <Input type="text" placeholder="e.g. TP53, BRCA" className="mt-1 h-8 text-xs"
                value={geneSearch} onChange={e => setGeneSearch(e.target.value)} />
              {geneSearch.trim() && (() => {
                const q = geneSearch.trim().toUpperCase();
                const matches = points.filter(p => p.gene.toUpperCase().includes(q));
                return (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {matches.length} match{matches.length !== 1 ? "es" : ""} highlighted
                  </p>
                );
              })()}
            </div>

            {/* Appearance */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground">Appearance</p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={symmetricX} onChange={e => setSymmetricX(e.target.checked)}
                  className="accent-primary" />
                Symmetric x-axis
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <input type="color" value={colorUp} onChange={e => setColorUp(e.target.value)}
                    className="w-5 h-5 rounded border-0 cursor-pointer p-0" />
                  <span className="text-[10px] text-muted-foreground">Up</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={colorDown} onChange={e => setColorDown(e.target.value)}
                    className="w-5 h-5 rounded border-0 cursor-pointer p-0" />
                  <span className="text-[10px] text-muted-foreground">Down</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={colorNs} onChange={e => setColorNs(e.target.value)}
                    className="w-5 h-5 rounded border-0 cursor-pointer p-0" />
                  <span className="text-[10px] text-muted-foreground">NS</span>
                </div>
              </div>
            </div>

            {/* Repositioned labels */}
            {labelOffsets.size > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {labelOffsets.size} label{labelOffsets.size !== 1 ? "s" : ""} repositioned
                </span>
                <button
                  onClick={() => setLabelOffsets(new Map())}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset positions
                </button>
              </div>
            )}

            {/* Pinned labels */}
            {pinnedLabels.size > 0 && (
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/15 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Pinned labels ({pinnedLabels.size})
                  </span>
                  <button
                    onClick={() => setPinnedLabels(new Set())}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[...pinnedLabels].map(gene => (
                    <button key={gene} onClick={() => togglePinnedLabel(gene)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono">
                      {gene} &times;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            {points.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total genes</span>
                  <span className="font-semibold text-foreground">{points.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-500">Upregulated</span>
                  <span className="font-semibold text-red-500">{sigUp.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-500">Downregulated</span>
                  <span className="font-semibold text-blue-500">{sigDown.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Not significant</span>
                  <span className="font-semibold text-muted-foreground">{points.length - sigUp.length - sigDown.length}</span>
                </div>
              </div>
            )}

            {/* Export plot */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Export plot</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__exportVolcano?.("svg")}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> SVG
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__exportVolcano?.("png")}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> PNG
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={exportPdf}
                  title="Print to PDF">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
                </Button>
              </div>
              <div className="flex gap-2 mt-1.5">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__openVolcanoInCanvas?.()}
                  title="Open in Canvas Editor">
                  Open in Canvas
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={copyShareUrl}
                  title="Copy shareable URL with current settings">
                  Share URL
                </Button>
              </div>
            </div>

            {/* Export data */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">
                Export significant genes ({sigUp.length + sigDown.length})
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => downloadSigGenes("csv")}
                  disabled={sigUp.length + sigDown.length === 0}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => downloadSigGenes("tsv")}
                  disabled={sigUp.length + sigDown.length === 0}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> TSV
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={copySigGenes}
                  disabled={sigUp.length + sigDown.length === 0}
                  title="Copy to clipboard">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Plot */}
          <div className="flex-1 min-w-0">
            <div ref={plotContainerRef} className="bg-card rounded-xl border border-border p-4 aspect-[7/5.2] relative group">
              {points.length > 0 ? (
                <>
                  <VolcanoSVG {...volcanoSvgProps} />
                  <button
                    onClick={() => { setZoomModal(true); setZoomLevel(1.5); setPanOffset({ x: 0, y: 0 }); }}
                    className="absolute top-6 right-6 p-1.5 rounded-md bg-background/80 border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    title="Expand plot (or scroll to zoom)"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <p className="absolute bottom-6 right-6 text-[9px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Scroll to zoom
                  </p>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                  Paste data with Gene, log2FC, and p-value columns
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zoom modal overlay */}
        {zoomModal && points.length > 0 && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setZoomModal(false); }}
            onKeyDown={(e) => { if (e.key === "Escape") setZoomModal(false); }}
            tabIndex={0}
            ref={(el) => el?.focus()}
          >
            {/* Controls bar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/95 border border-border rounded-lg px-3 py-2 shadow-lg z-10">
              <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-muted-foreground min-w-[3.5rem] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button onClick={() => setZoomLevel(z => Math.min(5, z + 0.25))}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button onClick={() => { setZoomLevel(1.5); setPanOffset({ x: 0, y: 0 }); }}
                className="text-[10px] px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                Reset
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button onClick={() => setZoomModal(false)}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Close (Esc)">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Zoomable plot area */}
            <div
              ref={zoomAreaRef}
              className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                setIsPanning(true);
                panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
              }}
              onMouseMove={(e) => {
                if (!isPanning) return;
                setPanOffset({
                  x: panStart.current.ox + (e.clientX - panStart.current.x),
                  y: panStart.current.oy + (e.clientY - panStart.current.y),
                });
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
            >
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transformOrigin: "center center",
                  transition: isPanning ? "none" : "transform 0.15s ease-out",
                }}
              >
                <div className="bg-white rounded-lg shadow-2xl" style={{ width: "80vmin", aspectRatio: "700/520" }}>
                  <VolcanoSVG {...volcanoSvgProps} />
                </div>
              </div>
            </div>

            {/* Hint */}
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/50 pointer-events-none">
              Scroll to zoom &middot; Drag to pan &middot; Esc to close
            </p>
          </div>
        )}

        {/* How to read a volcano plot — collapsible guide */}
        <div className="mt-8 max-w-2xl">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/30 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-semibold text-foreground">How to read a volcano plot</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showGuide ? "rotate-180" : ""}`} />
          </button>

          {showGuide && (
            <div className="mt-2 p-5 rounded-xl bg-muted/10 border border-border/20 text-[12px] text-muted-foreground leading-relaxed space-y-3">
              <div>
                <p className="font-semibold text-foreground mb-1">What is a volcano plot?</p>
                <p>A volcano plot is a scatter plot used in genomics, proteomics, and metabolomics to visualize differential expression results. Each point represents a gene (or protein/metabolite). The name comes from its volcano-like shape when many genes are significant.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">The axes</p>
                <p><strong>X-axis: log₂(Fold Change)</strong> — how much a gene's expression changed between conditions. A value of 1 means expression doubled; −1 means it halved. Points further from center changed more.</p>
                <p className="mt-1"><strong>Y-axis: −log₁₀(p-value)</strong> — statistical significance. Higher points are more statistically significant. A value of 2 corresponds to p = 0.01; a value of 5 corresponds to p = 0.00001.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">The four quadrants</p>
                <p><strong className="text-red-500">Top-right (red):</strong> Significantly upregulated — high fold change AND high significance. These are your most interesting upregulated candidates.</p>
                <p className="mt-1"><strong className="text-blue-500">Top-left (blue):</strong> Significantly downregulated — large negative fold change AND high significance.</p>
                <p className="mt-1"><strong>Bottom-center (gray):</strong> Not significant — either the fold change is too small, the p-value too high, or both. Most genes in a typical experiment fall here.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Threshold lines</p>
                <p>The dashed lines mark your significance cutoffs. Only points above the horizontal line AND outside the vertical lines are considered significant. Common thresholds: |log₂FC| &gt; 1 and p-value &lt; 0.05.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Raw vs. adjusted p-values</p>
                <p>When testing thousands of genes simultaneously, raw p-values produce false positives. Adjusted p-values (padj, FDR, q-value) correct for multiple testing using methods like Benjamini-Hochberg. Most published papers use adjusted p-values — if your tool (DESeq2, edgeR, limma) provides them, toggle "Use adjusted p-value" above.</p>
              </div>
              <div className="pt-2 border-t border-border/30">
                <p className="font-semibold text-foreground mb-1">Data format</p>
                <p>Tab or comma-separated with 3–4 columns: Gene name, log₂(Fold Change), p-value, and optional adjusted p-value (padj/FDR). First row is the header (auto-skipped).</p>
                <p className="mt-1"><strong>Compatible with:</strong> DESeq2, edgeR, limma, MaxQuant, Perseus, Seurat, Scanpy, and any tool that outputs log₂FC + p-values.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VolcanoPlot;
