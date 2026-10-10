import { useState, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, CircleDot } from "lucide-react";
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
const COLOR_THEMES: Record<string, { name: string; colors: string[]; bg: string; text: string; labelColor: string }> = {
  academic: {
    name: "Academic",
    colors: ["#2166AC", "#D6604D", "#4DAF4A"],
    bg: "#ffffff", text: "#000000", labelColor: "#000000",
  },
  nature: {
    name: "Nature Journal",
    colors: ["#E64B35", "#4DBBD5", "#00A087"],
    bg: "#ffffff", text: "#000000", labelColor: "#000000",
  },
  science: {
    name: "Science / AAAS",
    colors: ["#3B4992", "#EE0000", "#008B45"],
    bg: "#ffffff", text: "#000000", labelColor: "#000000",
  },
  lancet: {
    name: "Lancet",
    colors: ["#00468B", "#ED0000", "#42B540"],
    bg: "#ffffff", text: "#000000", labelColor: "#000000",
  },
  colorblind: {
    name: "Colorblind Safe",
    colors: ["#0072B2", "#D55E00", "#009E73"],
    bg: "#ffffff", text: "#000000", labelColor: "#000000",
  },
  allblack: {
    name: "All Black",
    colors: ["#000000", "#000000", "#000000"],
    bg: "#ffffff", text: "#000000", labelColor: "#000000",
  },
};

type VennMode = "2" | "3";

// ── Examples ──
const EXAMPLES: Record<string, { label: string; mode: VennMode; setA: string; setB: string; setC: string; labelA: string; labelB: string; labelC: string }> = {
  gene_overlap: {
    label: "Gene Overlap (2-set)",
    mode: "2",
    setA: "TP53, BRCA1, MYC, EGFR, KRAS, PTEN, RB1, APC, CDK4, PIK3CA, BRAF, ATM",
    setB: "TP53, EGFR, KRAS, BRAF, ALK, MET, RET, ERBB2, ROS1, NTRK1, FGFR1, PIK3CA",
    setC: "",
    labelA: "Panel A", labelB: "Panel B", labelC: "",
  },
  pathway: {
    label: "Pathway Overlap (3-set)",
    mode: "3",
    setA: "AKT1, PIK3CA, MTOR, PTEN, TSC1, TSC2, RPTOR, RICTOR, PDK1, SGK1",
    setB: "KRAS, BRAF, MEK1, ERK1, RAF1, NRAS, SOS1, GRB2, SHC1, MAPK1",
    setC: "TP53, MDM2, CDKN2A, RB1, E2F1, CDK4, CDK6, CCND1, PTEN, ATM",
    labelA: "PI3K/AKT", labelB: "MAPK/ERK", labelC: "Cell Cycle",
  },
  protein: {
    label: "Proteomics (3-set)",
    mode: "3",
    setA: "HSP90, GAPDH, ACTB, ENO1, PKM, LDHA, ALDOA, TPI1, PGK1, PGAM1, GPI, HK2, PFKL, CS, ACO2",
    setB: "HSP90, ACTB, PKM, NDUFS1, COX5A, CYC1, ATP5A1, UQCRC1, SOD2, CAT, GPX1, SDHA, FH, MDH2",
    setC: "HSP90, GAPDH, PKM, ACTB, SOD2, CAT, PRDX1, TXN, GSTP1, NQO1, HMOX1, GPX1",
    labelA: "Glycolysis", labelB: "Mitochondria", labelC: "Redox",
  },
};

// ── Set Operations ──
function parseSet(input: string): Set<string> {
  return new Set(
    input.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  );
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter(x => b.has(x)));
}

function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter(x => !b.has(x)));
}

// ── Component ──
const VennDiagram = () => {
  useTrackToolVisit("venn-diagram");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [mode, setMode] = useState<VennMode>("3");
  const [setAInput, setSetAInput] = useState(EXAMPLES.pathway.setA);
  const [setBInput, setSetBInput] = useState(EXAMPLES.pathway.setB);
  const [setCInput, setSetCInput] = useState(EXAMPLES.pathway.setC);
  const [labelA, setLabelA] = useState(EXAMPLES.pathway.labelA);
  const [labelB, setLabelB] = useState(EXAMPLES.pathway.labelB);
  const [labelC, setLabelC] = useState(EXAMPLES.pathway.labelC);
  const [title, setTitle] = useState("Venn Diagram");
  const [theme, setTheme] = useState("academic");
  const [showCounts, setShowCounts] = useState(true);
  const [showItems, setShowItems] = useState(false);
  const [opacity, setOpacity] = useState(0.35);

  const t = COLOR_THEMES[theme];

  // Compute sets
  const setA = parseSet(setAInput);
  const setB = parseSet(setBInput);
  const setC = mode === "3" ? parseSet(setCInput) : new Set<string>();

  // 2-set regions
  const onlyA2 = difference(setA, setB);
  const onlyB2 = difference(setB, setA);
  const ab2 = intersection(setA, setB);

  // 3-set regions
  const abc = intersection(intersection(setA, setB), setC);
  const abOnly = difference(intersection(setA, setB), setC);
  const acOnly = difference(intersection(setA, setC), setB);
  const bcOnly = difference(intersection(setB, setC), setA);
  const aOnly = difference(difference(setA, setB), setC);
  const bOnly = difference(difference(setB, setA), setC);
  const cOnly = difference(difference(setC, setA), setB);

  const svgW = 550, svgH = mode === "3" ? 480 : 400;
  const cx = svgW / 2, cy = mode === "3" ? 240 : 210;
  const r = mode === "3" ? 120 : 130;
  const offset = mode === "3" ? 70 : 80;

  // Circle positions
  const circles = mode === "3" ? [
    { x: cx - offset * 0.5, y: cy - offset * 0.4, label: labelA, color: t.colors[0] },
    { x: cx + offset * 0.5, y: cy - offset * 0.4, label: labelB, color: t.colors[1] },
    { x: cx, y: cy + offset * 0.5, label: labelC, color: t.colors[2] },
  ] : [
    { x: cx - offset * 0.5, y: cy, label: labelA, color: t.colors[0] },
    { x: cx + offset * 0.5, y: cy, label: labelB, color: t.colors[1] },
  ];

  // Region label positions (approximate centers of each region)
  const regions2 = [
    { x: cx - offset * 0.5 - 40, y: cy, count: onlyA2.size, items: [...onlyA2] },
    { x: cx, y: cy, count: ab2.size, items: [...ab2] },
    { x: cx + offset * 0.5 + 40, y: cy, count: onlyB2.size, items: [...onlyB2] },
  ];

  const regions3 = [
    { x: cx - offset * 0.5 - 30, y: cy - offset * 0.4 - 20, count: aOnly.size, items: [...aOnly] },
    { x: cx + offset * 0.5 + 30, y: cy - offset * 0.4 - 20, count: bOnly.size, items: [...bOnly] },
    { x: cx, y: cy + offset * 0.5 + 35, count: cOnly.size, items: [...cOnly] },
    { x: cx, y: cy - offset * 0.4 - 5, count: abOnly.size, items: [...abOnly] },
    { x: cx - offset * 0.35, y: cy + offset * 0.2, count: acOnly.size, items: [...acOnly] },
    { x: cx + offset * 0.35, y: cy + offset * 0.2, count: bcOnly.size, items: [...bcOnly] },
    { x: cx, y: cy + offset * 0.05, count: abc.size, items: [...abc] },
  ];

  const regions = mode === "3" ? regions3 : regions2;

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
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "venn-diagram.svg"; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "venn-diagram.png"; a.click(); });
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
      sessionStorage.setItem("venn_svg_import", svgOut);
      window.location.href = "/canvas";
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  };

  const loadExample = (key: string) => {
    const ex = EXAMPLES[key];
    setMode(ex.mode);
    setSetAInput(ex.setA);
    setSetBInput(ex.setB);
    setSetCInput(ex.setC);
    setLabelA(ex.labelA);
    setLabelB(ex.labelB);
    setLabelC(ex.labelC);
    toast.success(`Loaded: ${ex.label}`);
  };

  return (
    <>
      <SEOHead
        title="Free Venn Diagram Maker | BioSketch"
        description="Create publication-quality 2 or 3-set Venn diagrams online for free. Paste gene lists, protein sets, or any items. Automatic overlap calculation. Export as SVG or PNG."
        keywords="Venn diagram maker, set overlap, gene list comparison, 2 circle Venn, 3 circle Venn, set intersection, free Venn diagram tool"
        canonical="https://biosketch.art/venn-diagram"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <CircleDot className="h-6 w-6 text-primary" />
                Venn Diagram Maker
              </h1>
              <p className="text-sm text-muted-foreground">2 or 3-set Venn diagrams with automatic overlap calculation</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-4">
              <div className="space-y-2">
                <Label>Number of Sets</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as VennMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Sets</SelectItem>
                    <SelectItem value="3">3 Sets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Set A — {labelA} ({setA.size} items)</Label>
                <Textarea value={setAInput} onChange={(e) => setSetAInput(e.target.value)} rows={3} className="font-mono text-xs" placeholder="Item1, Item2, Item3..." />
                <Input value={labelA} onChange={(e) => setLabelA(e.target.value)} placeholder="Label A" className="h-7 text-xs" />
              </div>

              <div className="space-y-2">
                <Label>Set B — {labelB} ({setB.size} items)</Label>
                <Textarea value={setBInput} onChange={(e) => setSetBInput(e.target.value)} rows={3} className="font-mono text-xs" placeholder="Item1, Item2, Item3..." />
                <Input value={labelB} onChange={(e) => setLabelB(e.target.value)} placeholder="Label B" className="h-7 text-xs" />
              </div>

              {mode === "3" && (
                <div className="space-y-2">
                  <Label>Set C — {labelC} ({setC.size} items)</Label>
                  <Textarea value={setCInput} onChange={(e) => setSetCInput(e.target.value)} rows={3} className="font-mono text-xs" placeholder="Item1, Item2, Item3..." />
                  <Input value={labelC} onChange={(e) => setLabelC(e.target.value)} placeholder="Label C" className="h-7 text-xs" />
                </div>
              )}

              <div className="space-y-2">
                <Label>Examples</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(EXAMPLES).map(([key, ex]) => (
                    <Button key={key} variant="outline" size="sm" className="text-xs h-7" onClick={() => loadExample(key)}>
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
                            {th.colors.map((c, i) => (
                              <span key={i} className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c }} />
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
                  <Label className="text-sm">Show Counts</Label>
                  <Switch checked={showCounts} onCheckedChange={setShowCounts} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Items in Regions</Label>
                  <Switch checked={showItems} onCheckedChange={setShowItems} />
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
                  <text x={svgW / 2} y={30} textAnchor="middle" fill={t.text} fontSize="16" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">{title}</text>

                  {/* Circles */}
                  {circles.map((c, i) => (
                    <circle key={i} cx={c.x} cy={c.y} r={r} fill={c.color} fillOpacity={opacity} stroke={c.color} strokeWidth="2" />
                  ))}

                  {/* Set labels — positioned fully outside circles */}
                  {mode === "3" ? (
                    <>
                      <text x={circles[0].x - r - 10} y={circles[0].y - r + 10} textAnchor="end" fill={t.colors[0]} fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">{labelA}</text>
                      <text x={circles[1].x + r + 10} y={circles[1].y - r + 10} textAnchor="start" fill={t.colors[1]} fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">{labelB}</text>
                      <text x={circles[2].x} y={circles[2].y + r + 20} textAnchor="middle" fill={t.colors[2]} fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">{labelC}</text>
                    </>
                  ) : (
                    <>
                      <text x={circles[0].x} y={circles[0].y - r - 12} textAnchor="middle" fill={t.colors[0]} fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">{labelA}</text>
                      <text x={circles[1].x} y={circles[1].y - r - 12} textAnchor="middle" fill={t.colors[1]} fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">{labelB}</text>
                    </>
                  )}

                  {/* Region counts and items */}
                  {regions.map((reg, i) => (
                    <g key={i}>
                      {showCounts && (
                        <text x={reg.x} y={reg.y} textAnchor="middle" fill={t.text} fontSize="16" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">
                          {reg.count}
                        </text>
                      )}
                      {showItems && reg.items.length > 0 && reg.items.length <= 8 && (
                        <text x={reg.x} y={reg.y + (showCounts ? 14 : 0)} textAnchor="middle" fill={t.text} fontSize="7" fontFamily="Inter,system-ui,sans-serif" opacity="0.7">
                          {reg.items.slice(0, 5).join(", ")}{reg.items.length > 5 ? "..." : ""}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Totals */}
                  <text x={svgW / 2} y={svgH - 10} textAnchor="middle" fill={t.text} fontSize="10" fontFamily="Inter,system-ui,sans-serif" opacity="0.6">
                    {mode === "3"
                      ? `Total unique: ${new Set([...setA, ...setB, ...setC]).size}`
                      : `Total unique: ${new Set([...setA, ...setB]).size}`
                    }
                  </text>
                </svg>
              </div>

              {/* Summary table */}
              <div className="mt-4 overflow-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Region</th>
                      <th className="text-right px-3 py-2 font-medium">Count</th>
                      <th className="text-left px-3 py-2 font-medium">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mode === "2" ? (
                      <>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelA} only</td><td className="text-right px-3 py-1.5">{onlyA2.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...onlyA2].join(", ")}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelA} ∩ {labelB}</td><td className="text-right px-3 py-1.5 font-semibold">{ab2.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...ab2].join(", ")}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelB} only</td><td className="text-right px-3 py-1.5">{onlyB2.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...onlyB2].join(", ")}</td></tr>
                      </>
                    ) : (
                      <>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelA} only</td><td className="text-right px-3 py-1.5">{aOnly.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...aOnly].join(", ")}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelB} only</td><td className="text-right px-3 py-1.5">{bOnly.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...bOnly].join(", ")}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelC} only</td><td className="text-right px-3 py-1.5">{cOnly.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...cOnly].join(", ")}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelA} ∩ {labelB}</td><td className="text-right px-3 py-1.5">{abOnly.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...abOnly].join(", ")}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelA} ∩ {labelC}</td><td className="text-right px-3 py-1.5">{acOnly.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...acOnly].join(", ")}</td></tr>
                        <tr className="border-t"><td className="px-3 py-1.5 font-medium">{labelB} ∩ {labelC}</td><td className="text-right px-3 py-1.5">{bcOnly.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...bcOnly].join(", ")}</td></tr>
                        <tr className="border-t bg-muted/30"><td className="px-3 py-1.5 font-semibold">{labelA} ∩ {labelB} ∩ {labelC}</td><td className="text-right px-3 py-1.5 font-semibold">{abc.size}</td><td className="px-3 py-1.5 truncate max-w-[200px]">{[...abc].join(", ")}</td></tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4"><ToolRating toolId="venn-diagram" /></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VennDiagram;
