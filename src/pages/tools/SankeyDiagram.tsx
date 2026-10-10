import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, GitMerge } from "lucide-react";
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
interface SankeyLink { source: string; target: string; value: number; }
interface SankeyNode { id: string; layer: number; y: number; height: number; total: number; }

// ── Color Themes ──
const COLOR_THEMES: Record<string, { name: string; colors: string[]; bg: string; axis: string; text: string }> = {
  academic: { name: "Academic", colors: ["#2166AC","#D6604D","#4DAF4A","#FF7F00","#984EA3","#A65628","#E7298A","#66A61E","#E6AB02","#666666"], bg: "#ffffff", axis: "#000000", text: "#000000" },
  nature: { name: "Nature Journal", colors: ["#E64B35","#4DBBD5","#00A087","#3C5488","#F39B7F","#8491B4","#91D1C2","#DC0000","#7E6148","#B09C85"], bg: "#ffffff", axis: "#000000", text: "#000000" },
  lancet: { name: "Lancet", colors: ["#00468B","#ED0000","#42B540","#0099B4","#925E9F","#FDAF91","#AD002A","#ADB6B6","#1B1919","#F4E842"], bg: "#ffffff", axis: "#000000", text: "#000000" },
  colorblind: { name: "Colorblind Safe", colors: ["#0072B2","#D55E00","#009E73","#CC79A7","#F0E442","#56B4E9","#E69F00","#000000","#88CCEE","#DDCC77"], bg: "#ffffff", axis: "#000000", text: "#000000" },
  allblack: { name: "All Black", colors: ["#000000","#000000","#000000","#000000","#000000","#000000","#000000","#000000","#000000","#000000"], bg: "#ffffff", axis: "#000000", text: "#000000" },
};

// ── Examples ──
const EXAMPLES: Record<string, { label: string; data: string }> = {
  patient_flow: {
    label: "Patient Flow",
    data: `Source\tTarget\tValue
Screening\tEligible\t250
Screening\tExcluded\t80
Eligible\tRandomized\t200
Eligible\tDeclined\t50
Randomized\tTreatment A\t100
Randomized\tTreatment B\t100
Treatment A\tCompleted\t85
Treatment A\tDropped Out\t15
Treatment B\tCompleted\t78
Treatment B\tDropped Out\t22
Completed\tResponder\t95
Completed\tNon-responder\t68`,
  },
  metabolic: {
    label: "Metabolic Pathway",
    data: `Source\tTarget\tValue
Glucose\tGlycolysis\t100
Glycolysis\tPyruvate\t90
Glycolysis\tLactate\t10
Pyruvate\tAcetyl-CoA\t70
Pyruvate\tOxaloacetate\t20
Acetyl-CoA\tTCA Cycle\t65
Acetyl-CoA\tFatty Acids\t5
TCA Cycle\tNADH\t60
TCA Cycle\tFADH2\t30
TCA Cycle\tGTP\t10
NADH\tETC\t55
FADH2\tETC\t28
ETC\tATP\t80`,
  },
  gene_regulation: {
    label: "Gene Regulation",
    data: `Source\tTarget\tValue
TF-A\tGene1\t30
TF-A\tGene2\t25
TF-A\tGene3\t15
TF-B\tGene2\t20
TF-B\tGene4\t35
TF-B\tGene5\t10
TF-C\tGene1\t18
TF-C\tGene3\t22
TF-C\tGene5\t28
Gene1\tProtein X\t40
Gene2\tProtein Y\t38
Gene3\tProtein Z\t30
Gene4\tProtein W\t32
Gene5\tProtein V\t35`,
  },
};

// ── Layout Algorithm ──
function computeSankeyLayout(links: SankeyLink[], nodeH: number, svgW: number, svgH: number, margin: { top: number; right: number; bottom: number; left: number }) {
  // Find all nodes and assign layers via topological ordering
  const nodeSet = new Set<string>();
  const outgoing = new Map<string, SankeyLink[]>();
  const incoming = new Map<string, SankeyLink[]>();

  for (const l of links) {
    nodeSet.add(l.source);
    nodeSet.add(l.target);
    if (!outgoing.has(l.source)) outgoing.set(l.source, []);
    outgoing.get(l.source)!.push(l);
    if (!incoming.has(l.target)) incoming.set(l.target, []);
    incoming.get(l.target)!.push(l);
  }

  // Assign layers: sources with no incoming = layer 0, then BFS
  const layers = new Map<string, number>();
  const roots = [...nodeSet].filter(n => !incoming.has(n) || incoming.get(n)!.length === 0);
  const queue = roots.map(r => ({ node: r, layer: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { node, layer } = queue.shift()!;
    if (visited.has(node)) {
      layers.set(node, Math.max(layers.get(node) || 0, layer));
    } else {
      layers.set(node, layer);
      visited.add(node);
    }
    for (const l of (outgoing.get(node) || [])) {
      queue.push({ node: l.target, layer: layer + 1 });
    }
  }

  // Handle nodes not reached
  for (const n of nodeSet) {
    if (!layers.has(n)) layers.set(n, 0);
  }

  const maxLayer = Math.max(...layers.values(), 0);
  const plotW = svgW - margin.left - margin.right;
  const plotH = svgH - margin.top - margin.bottom;

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  for (const [node, layer] of layers) {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(node);
  }

  // Compute node totals (max of incoming or outgoing)
  const nodeTotals = new Map<string, number>();
  for (const n of nodeSet) {
    const outTotal = (outgoing.get(n) || []).reduce((s, l) => s + l.value, 0);
    const inTotal = (incoming.get(n) || []).reduce((s, l) => s + l.value, 0);
    nodeTotals.set(n, Math.max(outTotal, inTotal));
  }

  // Total value for scaling
  const globalMax = Math.max(...nodeTotals.values(), 1);

  // Position nodes
  const nodes = new Map<string, SankeyNode>();
  const layerX = (layer: number) => margin.left + (maxLayer > 0 ? (layer / maxLayer) * plotW : plotW / 2);

  for (const [layer, group] of layerGroups) {
    // Sort by total descending for visual weight
    group.sort((a, b) => (nodeTotals.get(b) || 0) - (nodeTotals.get(a) || 0));

    const totalNodeH = group.reduce((s, n) => s + Math.max(nodeH, (nodeTotals.get(n)! / globalMax) * plotH * 0.6), 0);
    const gap = group.length > 1 ? Math.min(20, (plotH - totalNodeH) / (group.length - 1)) : 0;
    let y = margin.top + (plotH - totalNodeH - gap * (group.length - 1)) / 2;

    for (const n of group) {
      const h = Math.max(nodeH, (nodeTotals.get(n)! / globalMax) * plotH * 0.6);
      nodes.set(n, { id: n, layer, y, height: h, total: nodeTotals.get(n)! });
      y += h + gap;
    }
  }

  return { nodes, maxLayer, layerX };
}

// ── Component ──
const SankeyDiagram = () => {
  useTrackToolVisit("sankey-diagram");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [rawData, setRawData] = useState(EXAMPLES.patient_flow.data);
  const [title, setTitle] = useState("Sankey Diagram");
  const [theme, setTheme] = useState("academic");
  const [showValues, setShowValues] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [linkOpacity, setLinkOpacity] = useState(0.4);
  const [nodeWidth, setNodeWidth] = useState(18);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse links
  const links = useMemo<SankeyLink[]>(() => {
    const lines = rawData.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const result: SankeyLink[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\t|,/).map(p => p.trim());
      if (parts.length < 3) continue;
      const value = parseFloat(parts[2]);
      if (isNaN(value) || value <= 0) continue;
      result.push({ source: parts[0], target: parts[1], value });
    }
    return result;
  }, [rawData]);

  const svgW = 700, svgH = 450;
  const margin = { top: 50, right: 100, bottom: 30, left: 100 };
  const t = COLOR_THEMES[theme];

  const { nodes, maxLayer, layerX } = useMemo(
    () => computeSankeyLayout(links, 12, svgW, svgH, margin),
    [links, svgW, svgH]
  );

  // Assign colors to nodes
  const nodeColor = useMemo(() => {
    const map = new Map<string, string>();
    let ci = 0;
    for (const [id] of nodes) {
      map.set(id, t.colors[ci % t.colors.length]);
      ci++;
    }
    return map;
  }, [nodes, t.colors]);

  // Compute link paths with proper y-offsets within nodes
  const linkPaths = useMemo(() => {
    // Track y-offset for outgoing/incoming per node
    const outOffset = new Map<string, number>();
    const inOffset = new Map<string, number>();
    for (const [id, node] of nodes) {
      outOffset.set(id, node.y);
      inOffset.set(id, node.y);
    }

    return links.map(l => {
      const src = nodes.get(l.source)!;
      const tgt = nodes.get(l.target)!;
      if (!src || !tgt) return null;

      const srcX = layerX(src.layer) + nodeWidth;
      const tgtX = layerX(tgt.layer);

      const linkH = src.total > 0 ? (l.value / src.total) * src.height : 4;
      const tgtLinkH = tgt.total > 0 ? (l.value / tgt.total) * tgt.height : 4;

      const y0 = outOffset.get(l.source)!;
      outOffset.set(l.source, y0 + linkH);

      const y1 = inOffset.get(l.target)!;
      inOffset.set(l.target, y1 + tgtLinkH);

      const midX = (srcX + tgtX) / 2;

      return {
        ...l,
        path: `M ${srcX} ${y0} C ${midX} ${y0}, ${midX} ${y1}, ${tgtX} ${y1} L ${tgtX} ${y1 + tgtLinkH} C ${midX} ${y1 + tgtLinkH}, ${midX} ${y0 + linkH}, ${srcX} ${y0 + linkH} Z`,
        color: nodeColor.get(l.source) || "#999",
      };
    }).filter(Boolean) as (SankeyLink & { path: string; color: string })[];
  }, [links, nodes, layerX, nodeWidth, nodeColor]);

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
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sankey-diagram.svg"; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "sankey-diagram.png"; a.click(); });
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
      sessionStorage.setItem("sankey_svg_import", svgOut);
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
        title="Free Sankey Diagram Maker | BioSketch"
        description="Create publication-quality Sankey flow diagrams online for free. Visualize patient flow, metabolic pathways, gene regulation networks. Export as SVG or PNG."
        keywords="Sankey diagram maker, flow diagram, alluvial plot, patient flow, metabolic pathway, network visualization, free Sankey tool"
        canonical="https://biosketch.art/sankey-diagram"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <GitMerge className="h-6 w-6 text-primary" />
                Sankey Diagram Maker
              </h1>
              <p className="text-sm text-muted-foreground">Flow diagrams for patient flow, metabolic pathways, and networks</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              <div className="space-y-2">
                <Label>Data (Source, Target, Value — tab/comma separated)</Label>
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

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Values on Links</Label>
                  <Switch checked={showValues} onCheckedChange={setShowValues} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Node Labels</Label>
                  <Switch checked={showLabels} onCheckedChange={setShowLabels} />
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

                  {/* Links */}
                  {linkPaths.map((lp, i) => (
                    <path key={i} d={lp.path} fill={lp.color} fillOpacity={linkOpacity} stroke={lp.color} strokeWidth="0.5" strokeOpacity={linkOpacity * 0.5} />
                  ))}

                  {/* Nodes */}
                  {[...nodes.entries()].map(([id, node]) => {
                    const x = layerX(node.layer);
                    const color = nodeColor.get(id) || "#999";
                    const isFirst = node.layer === 0;
                    const isLast = node.layer === maxLayer;

                    return (
                      <g key={id}>
                        <rect x={x} y={node.y} width={nodeWidth} height={node.height} fill={color} stroke={t.axis} strokeWidth="0.5" rx="2" />

                        {/* Label */}
                        {showLabels && (
                          <text
                            x={isFirst ? x - 4 : isLast ? x + nodeWidth + 4 : x + nodeWidth / 2}
                            y={node.y + node.height / 2 + 4}
                            textAnchor={isFirst ? "end" : isLast ? "start" : "middle"}
                            fill={t.text} fontSize="10" fontWeight="500" fontFamily="Inter,system-ui,sans-serif"
                          >
                            {id}{showValues ? ` (${node.total})` : ""}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="mt-4"><ToolRating toolId="sankey-diagram" /></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SankeyDiagram;
