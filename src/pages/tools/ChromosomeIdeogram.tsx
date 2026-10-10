import { useState, useEffect, useRef, useCallback } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";
import Ideogram from "ideogram";

interface Annotation {
  name: string;
  chr: string;
  start: number;
  stop: number;
  color?: string;
}

const ORGANISMS = [
  { id: "human", label: "Human (GRCh38)" },
  { id: "mouse", label: "Mouse (GRCm39)" },
  { id: "rat", label: "Rat (mRatBN7.2)" },
  { id: "drosophila-melanogaster", label: "Drosophila" },
  { id: "c-elegans", label: "C. elegans" },
  { id: "zebrafish", label: "Zebrafish" },
];

const EXAMPLE_ANNOTATIONS: Record<string, Annotation[]> = {
  "cancer-genes": [
    { name: "TP53", chr: "17", start: 7668421, stop: 7687490, color: "#dc2626" },
    { name: "BRCA1", chr: "17", start: 43044294, stop: 43125482, color: "#dc2626" },
    { name: "BRCA2", chr: "13", start: 32315508, stop: 32399672, color: "#dc2626" },
    { name: "KRAS", chr: "12", start: 25205246, stop: 25250929, color: "#f97316" },
    { name: "EGFR", chr: "7", start: 55019017, stop: 55211628, color: "#f97316" },
    { name: "MYC", chr: "8", start: 127735434, stop: 127742951, color: "#8b5cf6" },
    { name: "PTEN", chr: "10", start: 87863438, stop: 87971930, color: "#2563eb" },
    { name: "RB1", chr: "13", start: 48303747, stop: 48481890, color: "#2563eb" },
    { name: "APC", chr: "5", start: 112707505, stop: 112846239, color: "#059669" },
    { name: "VHL", chr: "3", start: 10141634, stop: 10153669, color: "#059669" },
  ],
  "gwas-hits": [
    { name: "rs1421085 (FTO)", chr: "16", start: 53800954, stop: 53800954, color: "#dc2626" },
    { name: "rs9939609 (FTO)", chr: "16", start: 53820527, stop: 53820527, color: "#dc2626" },
    { name: "rs7903146 (TCF7L2)", chr: "10", start: 114758349, stop: 114758349, color: "#f97316" },
    { name: "rs4988235 (MCM6/LCT)", chr: "2", start: 136608646, stop: 136608646, color: "#2563eb" },
    { name: "rs12913832 (HERC2)", chr: "15", start: 28365618, stop: 28365618, color: "#8b5cf6" },
    { name: "rs1805007 (MC1R)", chr: "16", start: 89919736, stop: 89919736, color: "#059669" },
  ],
  "empty": [],
};

const ChromosomeIdeogram = () => {
  useTrackToolVisit("chromosome-ideogram");
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const ideoRef = useRef<any>(null);
  const [organism, setOrganism] = useState("human");
  const [annotations, setAnnotations] = useState<Annotation[]>(EXAMPLE_ANNOTATIONS["cancer-genes"]);
  const [resolution, setResolution] = useState("550");
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAnnot, setNewAnnot] = useState<Annotation>({ name: "", chr: "1", start: 0, stop: 0, color: "#dc2626" });

  const renderIdeogram = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const config: any = {
      organism,
      container: "#ideogram-container",
      orientation: orientation === "horizontal" ? "horizontal" : "vertical",
      resolution: parseInt(resolution),
      showBandLabels: true,
      showChromosomeLabels: true,
      showAnnotTooltip: true,
      rotatable: true,
      chrHeight: orientation === "horizontal" ? 300 : 400,
      chrWidth: 10,
    };

    if (annotations.length > 0) {
      config.annotations = annotations.map(a => ({
        name: a.name,
        chr: a.chr,
        start: a.start,
        stop: a.stop || a.start + 1,
        color: a.color || "#dc2626",
      }));
      config.annotationsLayout = "overlay";
    }

    try {
      ideoRef.current = new Ideogram(config);
    } catch (err) {
      console.error("Ideogram render error:", err);
    }
  }, [organism, annotations, resolution, orientation]);

  useEffect(() => {
    // Small delay to ensure container is in DOM
    const timer = setTimeout(renderIdeogram, 200);
    return () => clearTimeout(timer);
  }, [renderIdeogram]);

  const addAnnotation = () => {
    if (!newAnnot.name || !newAnnot.chr || !newAnnot.start) {
      toast.error("Fill in name, chromosome, and start position");
      return;
    }
    setAnnotations([...annotations, { ...newAnnot, stop: newAnnot.stop || newAnnot.start + 1 }]);
    setNewAnnot({ name: "", chr: "1", start: 0, stop: 0, color: "#dc2626" });
    setShowAddForm(false);
  };

  const removeAnnotation = (idx: number) => {
    setAnnotations(annotations.filter((_, i) => i !== idx));
  };

  const exportPlot = (format: "svg" | "png") => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) { toast.error("No ideogram to export"); return; }

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const bbox = svgEl.getBoundingClientRect();
    clone.setAttribute("width", String(Math.ceil(bbox.width)));
    clone.setAttribute("height", String(Math.ceil(bbox.height)));
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: "image/svg+xml" });

    if (format === "svg") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "chromosome-ideogram.svg";
      a.click();
    } else {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const w = Math.ceil(bbox.width), h = Math.ceil(bbox.height);
        const c = document.createElement("canvas");
        c.width = w * 3; c.height = h * 3;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => {
          if (!b) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = "chromosome-ideogram.png";
          a.click();
        });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const openInCanvas = () => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const bbox = svgEl.getBoundingClientRect();
    const w = Math.ceil(bbox.width), h = Math.ceil(bbox.height);
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    const svgStr = new XMLSerializer().serializeToString(clone);
    const scale = 3;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w * scale; c.height = h * scale;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/png");
      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" xlink:href="${dataUrl}"/></svg>`;
      sessionStorage.setItem("volcano_svg_import", svgOut);
      window.location.href = "/canvas";
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  };

  const structuredData = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "Free Chromosome Ideogram Viewer - BioSketch",
    description: "Visualize chromosome ideograms with G-banding patterns, gene loci annotations, and multiple organisms. Export as SVG or PNG.",
    url: "https://biosketch.art/chromosome-ideogram",
    applicationCategory: "EducationalApplication", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Chromosome Ideogram Viewer - Karyotype with Gene Annotations | BioSketch"
        description="Visualize chromosome ideograms online with G-banding patterns at multiple resolutions. Annotate gene loci, GWAS hits, and cytogenetic markers on human, mouse, rat, Drosophila, and more. Export as SVG or PNG. Free, no signup required."
        canonical="https://biosketch.art/chromosome-ideogram"
        keywords="chromosome ideogram, karyotype viewer, chromosome banding, G-banding, cytogenetics, gene locus map, chromosome map maker, GWAS visualization, chromosome annotation, karyotype diagram, chromosome viewer online, free ideogram tool"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
            Chromosome Ideogram Viewer
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Karyotype visualization with G-banding patterns and gene locus annotations.
          </p>
          <ToolRating toolId="chromosome-ideogram" />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Controls */}
          <div className="lg:w-72 space-y-5 shrink-0">
            {/* Organism */}
            <div>
              <Label className="text-xs text-muted-foreground">Organism</Label>
              <Select value={organism} onValueChange={setOrganism}>
                <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORGANISMS.map(o => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="400" className="text-xs">400 bands</SelectItem>
                    <SelectItem value="550" className="text-xs">550 bands</SelectItem>
                    <SelectItem value="850" className="text-xs">850 bands</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Orientation</Label>
                <Select value={orientation} onValueChange={(v: any) => setOrientation(v)}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vertical" className="text-xs">Vertical</SelectItem>
                    <SelectItem value="horizontal" className="text-xs">Horizontal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Example presets */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Cancer genes", key: "cancer-genes" },
                  { label: "GWAS hits", key: "gwas-hits" },
                  { label: "No annotations", key: "empty" },
                ].map(p => (
                  <button key={p.key} onClick={() => setAnnotations(EXAMPLE_ANNOTATIONS[p.key])}
                    className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Annotations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Annotations ({annotations.length})
                </span>
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors">
                  {showAddForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {showAddForm ? "Cancel" : "Add"}
                </button>
              </div>

              {showAddForm && (
                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2 mb-2">
                  <Input className="h-7 text-xs" placeholder="Gene name" value={newAnnot.name}
                    onChange={e => setNewAnnot({ ...newAnnot, name: e.target.value })} />
                  <div className="grid grid-cols-3 gap-1.5">
                    <Input className="h-7 text-xs" placeholder="Chr" value={newAnnot.chr}
                      onChange={e => setNewAnnot({ ...newAnnot, chr: e.target.value })} />
                    <Input className="h-7 text-xs font-mono" placeholder="Start" type="text" inputMode="numeric"
                      value={newAnnot.start || ""} onChange={e => setNewAnnot({ ...newAnnot, start: parseInt(e.target.value) || 0 })} />
                    <Input className="h-7 text-xs font-mono" placeholder="Stop" type="text" inputMode="numeric"
                      value={newAnnot.stop || ""} onChange={e => setNewAnnot({ ...newAnnot, stop: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex gap-1.5">
                    <input type="color" value={newAnnot.color} onChange={e => setNewAnnot({ ...newAnnot, color: e.target.value })}
                      className="h-7 w-10 rounded border border-border cursor-pointer" />
                    <Button size="sm" className="h-7 text-[10px] flex-1" onClick={addAnnotation}>Add Annotation</Button>
                  </div>
                </div>
              )}

              <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                {annotations.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/20 text-[10px]">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                    <span className="font-medium text-foreground truncate flex-1">{a.name}</span>
                    <span className="text-muted-foreground">chr{a.chr}</span>
                    <button onClick={() => removeAnnotation(i)} className="text-muted-foreground/40 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => exportPlot("svg")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> SVG
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => exportPlot("png")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> PNG
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={openInCanvas}>Canvas</Button>
            </div>
          </div>

          {/* Ideogram */}
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-xl border border-border p-4 min-h-[500px] overflow-auto">
              <div id="ideogram-container" ref={containerRef} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5 max-w-2xl">
          <p><strong>Ideogram:</strong> Schematic representation of chromosomes showing cytogenetic banding patterns. G-banding (Giemsa) is the most common technique, producing dark (gene-poor AT-rich) and light (gene-rich GC-rich) bands.</p>
          <p><strong>Resolution:</strong> 400 bands = low resolution (routine karyotyping), 550 = standard, 850 = high resolution (prometaphase banding).</p>
          <p><strong>Annotations:</strong> Click "Add" to mark gene loci, GWAS SNPs, or cytogenetic regions. Specify chromosome, start/stop positions (bp), and color.</p>
          <p><strong>Click a chromosome</strong> to rotate and zoom in. Powered by <a href="https://github.com/eweitz/ideogram" target="_blank" rel="noopener" className="text-primary hover:underline">ideogram.js</a> (CC0 license).</p>
        </div>
      </div>
    </div>
  );
};

export default ChromosomeIdeogram;
