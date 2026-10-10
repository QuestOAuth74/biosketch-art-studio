import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// ── Gel physics ──
// Migration distance ~ 1 / log10(size) for linear DNA in agarose
// Smaller fragments travel further

interface Lane {
  id: string;
  name: string;
  fragments: number[]; // bp sizes
}

interface LadderBand {
  size: number;
  label: string;
  bright?: boolean; // reference bands shown brighter
}

const LADDERS: Record<string, { name: string; bands: LadderBand[] }> = {
  "1kb": {
    name: "1 kb DNA Ladder",
    bands: [
      { size: 10000, label: "10,000", bright: true },
      { size: 8000, label: "8,000" },
      { size: 6000, label: "6,000", bright: true },
      { size: 5000, label: "5,000" },
      { size: 4000, label: "4,000", bright: true },
      { size: 3000, label: "3,000", bright: true },
      { size: 2000, label: "2,000", bright: true },
      { size: 1500, label: "1,500", bright: true },
      { size: 1000, label: "1,000", bright: true },
      { size: 750, label: "750" },
      { size: 500, label: "500", bright: true },
      { size: 250, label: "250" },
    ],
  },
  "100bp": {
    name: "100 bp DNA Ladder",
    bands: [
      { size: 1500, label: "1,500" },
      { size: 1200, label: "1,200" },
      { size: 1000, label: "1,000", bright: true },
      { size: 900, label: "900" },
      { size: 800, label: "800" },
      { size: 700, label: "700" },
      { size: 600, label: "600", bright: true },
      { size: 500, label: "500", bright: true },
      { size: 400, label: "400" },
      { size: 300, label: "300", bright: true },
      { size: 200, label: "200" },
      { size: 100, label: "100", bright: true },
    ],
  },
  "1kb-plus": {
    name: "1 kb Plus Ladder",
    bands: [
      { size: 15000, label: "15,000" },
      { size: 10000, label: "10,000", bright: true },
      { size: 8000, label: "8,000" },
      { size: 7000, label: "7,000" },
      { size: 6000, label: "6,000" },
      { size: 5000, label: "5,000", bright: true },
      { size: 4000, label: "4,000" },
      { size: 3000, label: "3,000", bright: true },
      { size: 2000, label: "2,000" },
      { size: 1500, label: "1,500", bright: true },
      { size: 1000, label: "1,000", bright: true },
      { size: 850, label: "850" },
      { size: 650, label: "650" },
      { size: 500, label: "500", bright: true },
      { size: 400, label: "400" },
      { size: 300, label: "300" },
      { size: 200, label: "200" },
      { size: 100, label: "100" },
    ],
  },
};

const GEL_PRESETS = [
  {
    label: "Restriction digest",
    lanes: [
      { name: "Uncut", fragments: [5000] },
      { name: "EcoRI", fragments: [3000, 2000] },
      { name: "BamHI", fragments: [2500, 1500, 1000] },
      { name: "Double", fragments: [2000, 1500, 1000, 500] },
    ],
  },
  {
    label: "PCR products",
    lanes: [
      { name: "Gene A", fragments: [450] },
      { name: "Gene B", fragments: [820] },
      { name: "Gene C", fragments: [1200] },
      { name: "Multiplex", fragments: [450, 820, 1200] },
    ],
  },
  {
    label: "Plasmid check",
    lanes: [
      { name: "Uncut", fragments: [6500] },
      { name: "Linear", fragments: [6500] },
      { name: "Insert+", fragments: [4500, 2000] },
      { name: "Empty", fragments: [4500] },
    ],
  },
];

// ── Gel Themes ──
interface GelTheme {
  name: string;
  gelBg: string;
  wellBg: string;
  bandColor: string;
  bandBrightOpacity: number;
  bandDimOpacity: number;
  labelColor: string;
  pngBg: string;
}

const GEL_THEMES: Record<string, GelTheme> = {
  "uv-green": {
    name: "UV / EtBr (Green)",
    gelBg: "#1a1a2e",
    wellBg: "#2a2a4a",
    bandColor: "#4ade80",
    bandBrightOpacity: 0.9,
    bandDimOpacity: 0.5,
    labelColor: "#94a3b8",
    pngBg: "#1a1a2e",
  },
  "sybr-safe": {
    name: "SYBR Safe (Orange)",
    gelBg: "#1a1410",
    wellBg: "#2a2218",
    bandColor: "#fb923c",
    bandBrightOpacity: 0.95,
    bandDimOpacity: 0.5,
    labelColor: "#a8977a",
    pngBg: "#1a1410",
  },
  "coomassie": {
    name: "Coomassie Blue",
    gelBg: "#e8edf5",
    wellBg: "#d0d8e8",
    bandColor: "#1e3a8a",
    bandBrightOpacity: 0.9,
    bandDimOpacity: 0.45,
    labelColor: "#475569",
    pngBg: "#e8edf5",
  },
  "silver-stain": {
    name: "Silver Stain",
    gelBg: "#f0ede6",
    wellBg: "#ddd8cc",
    bandColor: "#3b2f1e",
    bandBrightOpacity: 0.9,
    bandDimOpacity: 0.45,
    labelColor: "#6b5e4e",
    pngBg: "#f0ede6",
  },
};

let laneIdCounter = 0;
function newLaneId() { return 'lane-' + (++laneIdCounter); }

// ── Gel SVG Component ──
function GelSVG({ lanes, ladder, gelPct, theme }: { lanes: Lane[]; ladder: string; gelPct: number; theme: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  const t = GEL_THEMES[theme] || GEL_THEMES["uv-green"];
  const ladderData = LADDERS[ladder];
  const allSizes = [
    ...ladderData.bands.map(b => b.size),
    ...lanes.flatMap(l => l.fragments),
  ];
  const minSize = Math.max(10, Math.min(...allSizes) * 0.5);
  const maxSize = Math.max(...allSizes) * 1.2;

  // Migration: log scale, smaller = further
  const migrate = (size: number) => {
    const logMin = Math.log10(minSize);
    const logMax = Math.log10(maxSize);
    const logSize = Math.log10(Math.max(size, minSize));
    // 0 = top (well), 1 = bottom
    // Adjust by gel percentage (higher % = better separation of small fragments)
    const base = 1 - (logSize - logMin) / (logMax - logMin);
    return 0.08 + base * 0.85; // 8% to 93% of gel height
  };

  const totalLanes = lanes.length + 1; // +1 for ladder
  const svgW = 500;
  const svgH = 600;
  const gelTop = 40;
  const gelBottom = svgH - 20;
  const gelH = gelBottom - gelTop;
  const laneW = Math.min(50, (svgW - 60) / totalLanes);
  const gelLeft = (svgW - laneW * totalLanes) / 2;

  const bandY = (size: number) => gelTop + migrate(size) * gelH;

  // Band opacity: bright for few bands, dimmer as count grows
  const bandOpacity = (lane: Lane, bright?: boolean) => {
    const n = lane.fragments.length;
    const base = bright ? t.bandBrightOpacity : t.bandDimOpacity;
    return Math.max(base * 0.5, base - (n - 1) * 0.06);
  };

  const exportGel = (format: 'svg' | 'png') => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml' });

    if (format === 'svg') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gel-electrophoresis.svg';
      a.click();
    } else {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svgW * 3; canvas.height = svgH * 3;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = t.pngBg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => {
          if (!b) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'gel-electrophoresis.png';
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
    const svgStr = new XMLSerializer().serializeToString(clone);
    const scale = 3;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = svgW * scale; c.height = svgH * scale;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = t.pngBg; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/png');
      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"><image width="${svgW}" height="${svgH}" xlink:href="${dataUrl}"/></svg>`;
      sessionStorage.setItem('gel_svg_import', svgOut);
      window.location.href = '/canvas';
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  };

  // Expose export + canvas via parent
  (window as any).__exportGel = exportGel;
  (window as any).__openGelInCanvas = openInCanvas;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
      {/* Gel background */}
      <rect x="10" y={gelTop - 5} width={svgW - 20} height={gelH + 10} rx="6" fill={t.gelBg} />

      {/* Wells */}
      {Array.from({ length: totalLanes }).map((_, i) => (
        <rect key={`well-${i}`} x={gelLeft + i * laneW + 4} y={gelTop - 2} width={laneW - 8} height={4} rx="1" fill={t.wellBg} />
      ))}

      {/* Ladder lane (first) */}
      {ladderData.bands.map((band, i) => {
        const y = bandY(band.size);
        const x = gelLeft + 4;
        return (
          <g key={`ladder-${i}`}>
            <rect x={x} y={y - 1.5} width={laneW - 8} height={3} rx="1"
              fill={t.bandColor} opacity={band.bright ? t.bandBrightOpacity : t.bandDimOpacity} />
            <text x={x - 3} y={y + 1} textAnchor="end" fontSize="7"
              fill={t.labelColor} fontFamily="Inter, sans-serif">
              {band.label}
            </text>
          </g>
        );
      })}

      {/* Ladder label */}
      <text x={gelLeft + laneW / 2} y={gelTop - 10} textAnchor="middle"
        fontSize="8" fill={t.labelColor} fontFamily="Inter, sans-serif" fontWeight="600">
        M
      </text>

      {/* Sample lanes */}
      {lanes.map((lane, lIdx) => {
        const laneX = gelLeft + (lIdx + 1) * laneW;
        return (
          <g key={lane.id}>
            {/* Lane label */}
            <text x={laneX + laneW / 2} y={gelTop - 10} textAnchor="middle"
              fontSize="7" fill={t.labelColor} fontFamily="Inter, sans-serif" fontWeight="500">
              {lane.name.length > 6 ? lane.name.slice(0, 6) + '…' : lane.name}
            </text>
            {/* Bands */}
            {lane.fragments.map((frag, fIdx) => {
              const y = bandY(frag);
              return (
                <rect key={`${lane.id}-${fIdx}`}
                  x={laneX + 4} y={y - 1.5} width={laneW - 8} height={3} rx="1"
                  fill={t.bandColor} opacity={bandOpacity(lane)} />
              );
            })}
          </g>
        );
      })}

      {/* Polarity markers */}
      <text x={svgW - 16} y={gelTop + 10} fontSize="10" fill="#ef4444" fontFamily="Inter, sans-serif" fontWeight="700">−</text>
      <text x={svgW - 16} y={gelBottom - 4} fontSize="10" fill="#3b82f6" fontFamily="Inter, sans-serif" fontWeight="700">+</text>
    </svg>
  );
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Gel Electrophoresis Simulator - BioSketch",
  description: "Simulate agarose gel electrophoresis with custom DNA fragment sizes, DNA ladders, and adjustable gel percentage. Visualize band migration patterns and export as SVG or PNG.",
  url: "https://biosketch.art/gel-electrophoresis",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const GelElectrophoresis = () => {
  useTrackToolVisit("gel-electrophoresis");
  const navigate = useNavigate();
  const [ladder, setLadder] = useState("1kb");
  const [gelPct, setGelPct] = useState("1.0");
  const [gelTheme, setGelTheme] = useState("uv-green");
  const [lanes, setLanes] = useState<Lane[]>([
    { id: newLaneId(), name: "Sample 1", fragments: [3000, 2000] },
    { id: newLaneId(), name: "Sample 2", fragments: [2500, 1500, 1000] },
  ]);
  const [newFragment, setNewFragment] = useState("");
  const [editingLane, setEditingLane] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const addLane = () => {
    if (lanes.length >= 10) { toast.error("Maximum 10 sample lanes"); return; }
    setLanes([...lanes, { id: newLaneId(), name: `Sample ${lanes.length + 1}`, fragments: [] }]);
  };

  const removeLane = (id: string) => {
    setLanes(lanes.filter(l => l.id !== id));
  };

  const updateLaneName = (id: string, name: string) => {
    setLanes(lanes.map(l => l.id === id ? { ...l, name } : l));
  };

  const addFragment = (laneId: string) => {
    const size = parseInt(newFragment);
    if (!size || size < 10 || size > 50000) { toast.error("Enter a size between 10–50,000 bp"); return; }
    setLanes(lanes.map(l => l.id === laneId ? { ...l, fragments: [...l.fragments, size].sort((a, b) => b - a) } : l));
    setNewFragment("");
  };

  const removeFragment = (laneId: string, idx: number) => {
    setLanes(lanes.map(l => l.id === laneId ? { ...l, fragments: l.fragments.filter((_, i) => i !== idx) } : l));
  };

  const loadPreset = (preset: typeof GEL_PRESETS[0]) => {
    setLanes(preset.lanes.map(l => ({ id: newLaneId(), name: l.name, fragments: [...l.fragments] })));
  };

  const copyBandTable = () => {
    const header = "Lane\tFragment (bp)";
    const rows = lanes.flatMap(l => l.fragments.map(f => `${l.name}\t${f}`));
    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setCopied(true);
    toast.success("Band table copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Gel Electrophoresis Simulator | BioSketch"
        description="Simulate agarose gel electrophoresis online. Enter DNA fragment sizes, choose a DNA ladder (1kb, 100bp, 1kb Plus), adjust gel percentage, and visualize band migration patterns. Export as SVG or PNG. Free, no signup."
        canonical="https://biosketch.art/gel-electrophoresis"
        keywords="gel electrophoresis simulator, virtual gel electrophoresis, agarose gel simulator, DNA gel electrophoresis, gel band migration, DNA ladder, restriction digest gel, PCR gel, electrophoresis education, molecular biology tool"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
            Gel Electrophoresis Simulator
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Simulate agarose gel electrophoresis with custom fragments and DNA ladders.
          </p>
          <ToolRating toolId="gel-electrophoresis" />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Controls */}
          <div className="lg:w-80 space-y-5 shrink-0">
            {/* Gel settings */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gel Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">DNA Ladder</Label>
                  <Select value={ladder} onValueChange={setLadder}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LADDERS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Gel % agarose</Label>
                  <Select value={gelPct} onValueChange={setGelPct}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["0.5", "0.8", "1.0", "1.2", "1.5", "2.0", "3.0"].map(v => (
                        <SelectItem key={v} value={v} className="text-xs">{v}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stain / Theme</Label>
                <Select value={gelTheme} onValueChange={setGelTheme}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GEL_THEMES).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Presets */}
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Presets</h3>
              <div className="flex flex-wrap gap-1.5">
                {GEL_PRESETS.map(p => (
                  <button key={p.label} onClick={() => loadPreset(p)}
                    className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lanes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sample Lanes ({lanes.length}/10)
                </h3>
                <button onClick={addLane} className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors">
                  <Plus className="h-3 w-3" /> Add lane
                </button>
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {lanes.map(lane => (
                  <div key={lane.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input className="h-7 text-xs flex-1 font-medium" value={lane.name}
                        onChange={e => updateLaneName(lane.id, e.target.value)} />
                      <button onClick={() => removeLane(lane.id)} className="text-muted-foreground/40 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Fragments */}
                    <div className="flex flex-wrap gap-1">
                      {lane.fragments.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                          {f.toLocaleString()} bp
                          <button onClick={() => removeFragment(lane.id, i)} className="hover:text-red-500">×</button>
                        </span>
                      ))}
                    </div>

                    {/* Add fragment */}
                    {editingLane === lane.id ? (
                      <div className="flex gap-1.5">
                        <Input type="text" inputMode="numeric" className="h-7 text-xs flex-1 font-mono" placeholder="Size (bp)"
                          value={newFragment} onChange={e => setNewFragment(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addFragment(lane.id); }} autoFocus />
                        <Button size="sm" className="h-7 text-[10px] px-2" onClick={() => addFragment(lane.id)}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setEditingLane(null)}>Done</Button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingLane(lane.id); setNewFragment(""); }}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                        + Add fragment
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__exportGel?.('svg')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> SVG
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (window as any).__exportGel?.('png')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> PNG
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={copyBandTable}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div>
              <Button variant="outline" size="sm" className="w-full text-xs text-primary" onClick={() => (window as any).__openGelInCanvas?.()}>
                Open in Canvas Editor
              </Button>
            </div>
          </div>

          {/* Gel visualization */}
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-xl border border-border p-4 aspect-[5/6] max-h-[600px]">
              <GelSVG lanes={lanes} ladder={ladder} gelPct={parseFloat(gelPct)} theme={gelTheme} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5 max-w-2xl">
          <p><strong>How it works:</strong> DNA fragments migrate through agarose gel toward the positive electrode. Smaller fragments travel further. Migration distance is proportional to 1/log(size).</p>
          <p><strong>Gel percentage:</strong> Higher agarose % gives better resolution of small fragments. Use 0.5–0.8% for large DNA (&gt;5 kb), 1–1.5% for mid-range, 2–3% for small fragments (&lt;500 bp).</p>
          <p><strong>DNA ladders:</strong> M lane shows the molecular weight marker. Brighter bands indicate reference sizes for easier estimation.</p>
        </div>
      </div>
    </div>
  );
};

export default GelElectrophoresis;
