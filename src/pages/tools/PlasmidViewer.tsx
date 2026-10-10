import { useState, useMemo, useCallback } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";
import { SeqViz } from "seqviz";

// ── Example GenBank data ──

const EXAMPLE_PUC19 = `LOCUS       pUC19           2686 bp    DNA     circular
FEATURES             Location/Qualifiers
     CDS             complement(1629..2489)
                     /label=AmpR
                     /gene="bla"
                     /note="ampicillin resistance"
     rep_origin      complement(816..1404)
                     /label=pMB1 ori
                     /note="high-copy origin of replication"
     promoter        complement(2530..2558)
                     /label=AmpR promoter
     CDS             217..582
                     /label=lacZ-alpha
                     /gene="lacZ"
                     /note="beta-galactosidase alpha fragment"
     misc_feature    583..626
                     /label=MCS
                     /note="multiple cloning site"
     promoter        complement(160..216)
                     /label=lac promoter
ORIGIN
        1 tcgcgcgttt cggtgatgac ggtgaaaacc tctgacacat gcagctcccg gagacggtca
       61 cagcttgtct gtaagcggat gccgggagca gacaagcccg tcagggcgcg tcagcgggtg
      121 ttggcgggtg tcggggctgg cttaactatg cggcatcaga gcagattgta ctgagagtgc
      181 accatatgcg gtgtgaaata ccgcacagat gcgtaaggag aaaataccgc atcaggcgcc
      241 attcgccatt caggctgcgc aactgttggg aagggcgatc ggtgcgggcc tcttcgctat
      301 tacgccagct ggcgaaaggg ggatgtgctg caaggcgatt aagttgggta acgccagggt
      361 tttcccagtc acgacgttgt aaaacgacgg ccagtgaatt cgagctcggt acccggggat
      421 cctctagagt cgacctgcag gcatgcaagc ttggcgtaat catggtcata gctgtttcct
      481 gtgtgaaatt gttatccgct cacaattcca cacaacatac gagccggaag cataaagtgt
      541 aaagcctggg gtgcctaatg agtgagctaa ctcacattaa ttgcgttgcg ctcactgccc
      601 gctttccagt cgggaaacct gtcgtgccag ctgcattaat gaatcggcca acgcgcgggg
      661 agaggcggtt tgcgtattgg gcgctcttcc gcttcctcgc tcactgactc gctgcgctcg
      721 gtcgttcggc tgcggcgagc ggtatcagct cactcaaagg cggtaatacg gttatccaca
      781 gaatcagggg ataacgcagg aaagaacatg tgagcaaaag gccagcaaaa ggccaggaac
      841 cgtaaaaagg ccgcgttgct ggcgtttttc cataggctcc gcccccctga cgagcatcac
      901 aaaaatcgac gctcaagtca gaggtggcga aacccgacag gactataaag ataccaggcg
      961 tttccccctg gaagctccct cgtgcgctct cctgttccga ccctgccgct taccggatac
     1021 ctgtccgcct ttctcccttc gggaagcgtg gcgctttctc atagctcacg ctgtaggtat
     1081 ctcagttcgg tgtaggtcgt tcgctccaag ctgggctgtg tgcacgaacc ccccgttcag
     1141 cccgaccgct gcgccttatc cggtaactat cgtcttgagt ccaacccggt aagacacgac
     1201 ttatcgccac tggcagcagc cactggtaac aggattagca gagcgaggta tgtaggcggt
     1261 gctacagagt tcttgaagtg gtggcctaac tacggctaca ctagaagaac agtatttggt
     1321 atctgcgctc tgctgaagcc agttaccttc ggaaaaagag ttggtagctc ttgatccggc
     1381 aaacaaaccg ctggtagcgg tggttttttt gtttgcaagc agcagattac gcgcagaaaa
     1441 aaaggatctc aagaagatcc tttgatcttt tctacggggt ctgacgctca gtggaacgaa
     1501 aactcacgtt aagggatttt ggtcatgaga ttatcaaaaa ggatcttcac ctagatcctt
     1561 ttaaattaaa aatgaagttt taaatcaatc taaagtatat atgagtaaac ttggtctgac
     1621 agttaccaat gcttaatcag tgaggcacct atctcagcga tctgtctatt tcgttcatcc
     1681 atagttgcct gactccccgt cgtgtagata actacgatac gggagggctt accatctggc
     1741 cccagtgctg caatgatacc gcgagaccca cgctcaccgg ctccagattt atcagcaata
     1801 aaccagccag ccggaagggc cgagcgcaga agtggtcctg caactttatc cgcctccatc
     1861 cagtctatta attgttgccg ggaagctaga gtaagtagtt cgccagttaa tagtttgcgc
     1921 aacgttgttg ccattgctac aggcatcgtg gtgtcacgct cgtcgtttgg tatggcttca
     1981 ttcagctccg gttcccaacg atcaaggcga gttacatgat cccccatgtt gtgcaaaaaa
     2041 gcggttagct ccttcggtcc tccgatcgtt gtcagaagta agttggccgc agtgttatca
     2101 ctcatggtta tggcagcact gcataattct cttactgtca tgccatccgt aagatgcttt
     2161 tctgtgactg gtgagtactc aaccaagtca ttctgagaat agtgtatgcg gcgaccgagt
     2221 tgctcttgcc cggcgtcaat acgggataat accgcgccac atagcagaac tttaaaagtg
     2281 ctcatcattg gaaaacgttc ttcggggcga aaactctcaa ggatcttacc gctgttgaga
     2341 tccagttcga tgtaacccac tcgtgcaccc aactgatctt cagcatcttt tactttcacc
     2401 agcgtttctg ggtgagcaaa aacaggaagg caaaatgccg caaaaaaggg aataagggcg
     2461 acacggaaat gttgaatact catactcttc ctttttcaat attattgaag catttatcag
     2521 ggttattgtc tcatgagcgg atacatattt gaatgtattt agaaaaataa acaaataggg
     2581 gttccgcgca catttccccg aaaagtgcca cctgacgtct aagaaaccat tattatcatg
     2641 acattaacct ataaaaatag gcgtatcacg aggccctttc gtctcg
//`;

const EXAMPLE_PET28A = `LOCUS       pET-28a(+)      5369 bp    DNA     circular
FEATURES             Location/Qualifiers
     CDS             complement(3296..4111)
                     /label=KanR
                     /gene="aph(3')-Ia"
                     /note="kanamycin resistance"
     CDS             206..450
                     /label=His-tag
                     /note="6xHis tag"
     rep_origin      complement(4462..5050)
                     /label=pBR322 ori
     promoter        137..155
                     /label=T7 promoter
     terminator      complement(26..73)
                     /label=T7 terminator
     CDS             complement(2106..2384)
                     /label=lacI (partial)
                     /gene="lacI"
     misc_feature    451..500
                     /label=MCS
                     /note="multiple cloning site"
     rep_origin      complement(2500..2955)
                     /label=f1 ori
ORIGIN
        1 atccggatat agttcctcct ttcagcaaaa aacccctcaa gacccgttta gaggccccaa
       61 ggggttatgc tagttattgc tcagcggtgg cagcagccaa ctcagcttcc tttcgggctt
      121 tgttagcagc cggatctcag tggtggtggt ggtggtgctc gagtgcggcc gcaagcttgt
      181 cgacggagct cgaattcgga tccgcgaccc atttgctgtc caccagtcat gctagccata
      241 tggctgccgc gcggcaccag gccgctgctg tgatgatgat gatgatggct gctgcccatg
      301 gtatatctcc ttcttaaagt taaacaaaat tatttctaga ggggaattgt tatccgctca
      361 caattcccct atagtgagtc gtattaattt cgcgggatcg agatctcgat cctctacgcc
      421 ggacgcatcg tggccggcat caccggcgcc acaggtgcgg ttgctggcgc ctatatcgcc
//`;

const EXAMPLES = [
  { label: "pUC19 (2.7 kb)", data: EXAMPLE_PUC19 },
  { label: "pET-28a (5.4 kb)", data: EXAMPLE_PET28A },
];

// ── Simple GenBank parser ──
function parseGenBank(text: string): { name: string; seq: string; annotations: any[] } {
  const lines = text.split("\n");
  let name = "Plasmid";
  let seq = "";
  let inOrigin = false;
  const annotations: any[] = [];

  // Parse LOCUS
  const locusMatch = text.match(/LOCUS\s+(\S+)/);
  if (locusMatch) name = locusMatch[1];

  // Parse FEATURES
  const featRegex = /^\s{5}(\S+)\s+(complement\()?(\d+)\.\.(\d+)\)?\s*$/;
  let currentFeat: any = null;

  for (const line of lines) {
    if (line.startsWith("ORIGIN")) {
      if (currentFeat) annotations.push(currentFeat);
      inOrigin = true;
      continue;
    }

    if (inOrigin) {
      if (line.startsWith("//")) break;
      seq += line.replace(/[\s\d]/g, "");
      continue;
    }

    // Feature line
    const featMatch = line.match(/^\s{5}(\S+)\s+(complement\()?([\d<>]+)\.\.([\d<>]+)\)?\s*$/);
    if (featMatch) {
      if (currentFeat) annotations.push(currentFeat);
      const isComplement = !!featMatch[2];
      currentFeat = {
        name: featMatch[1],
        start: parseInt(featMatch[3].replace(/[<>]/g, "")) - 1,
        end: parseInt(featMatch[4].replace(/[<>]/g, "")),
        direction: isComplement ? -1 : 1,
      };
      continue;
    }

    // Qualifier
    if (currentFeat) {
      const labelMatch = line.match(/\/label=(.+)/);
      if (labelMatch) currentFeat.name = labelMatch[1].replace(/"/g, "").trim();
      const geneMatch = line.match(/\/gene="([^"]+)"/);
      if (geneMatch && currentFeat.name === currentFeat.name) currentFeat.name = geneMatch[1];
      const noteMatch = line.match(/\/note="([^"]+)"/);
      if (noteMatch) currentFeat.note = noteMatch[1];
    }
  }

  if (currentFeat) annotations.push(currentFeat);

  return { name, seq: seq.toUpperCase(), annotations };
}

// ── Feature colors ──
const FEATURE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
];

function colorAnnotations(annotations: any[]): any[] {
  return annotations.map((a, i) => ({
    ...a,
    color: a.color || FEATURE_COLORS[i % FEATURE_COLORS.length],
  }));
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Plasmid Map Viewer - BioSketch",
  description: "Visualize plasmid maps from GenBank files. Circular and linear views with annotated features, restriction sites, and sequence viewer. Free for researchers and students.",
  url: "https://biosketch.art/plasmid-viewer",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const PlasmidViewer = () => {
  useTrackToolVisit("plasmid-viewer");
  const navigate = useNavigate();
  const [rawInput, setRawInput] = useState(EXAMPLE_PUC19);
  const [viewMode, setViewMode] = useState<"both" | "circular" | "linear">("both");
  const [showInput, setShowInput] = useState(false);

  const parsed = useMemo(() => {
    try {
      const result = parseGenBank(rawInput);
      if (!result.seq) return null;
      return {
        ...result,
        annotations: colorAnnotations(result.annotations),
      };
    } catch {
      return null;
    }
  }, [rawInput]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setRawInput(text);
        setShowInput(false);
        toast.success(`Loaded ${file.name}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Free Plasmid Map Viewer - GenBank Visualizer | BioSketch"
        description="Visualize plasmid maps online from GenBank format files. Circular and linear views with annotated features, gene labels, and sequence browser. Upload .gb files or paste GenBank text. Free, no signup required."
        canonical="https://biosketch.art/plasmid-viewer"
        keywords="plasmid map viewer, GenBank viewer, circular plasmid map, linear sequence viewer, plasmid visualization, DNA map maker, GenBank file viewer, molecular cloning tool, restriction map, free plasmid viewer"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl flex-1 flex flex-col">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground self-start">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
              Plasmid Map Viewer
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Visualize circular and linear plasmid maps from GenBank format.
            </p>
            <ToolRating toolId="plasmid-viewer" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View mode */}
            <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
              <SelectTrigger className="h-9 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both" className="text-xs">Both views</SelectItem>
                <SelectItem value="circular" className="text-xs">Circular</SelectItem>
                <SelectItem value="linear" className="text-xs">Linear</SelectItem>
              </SelectContent>
            </Select>

            {/* Toggle input */}
            <Button variant="outline" size="sm" className="text-xs gap-1.5"
              onClick={() => setShowInput(!showInput)}>
              <Eye className="h-3.5 w-3.5" />
              {showInput ? "Hide Input" : "Edit Input"}
            </Button>

            {/* File upload */}
            <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
              <label className="cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                Upload .gb
                <input type="file" accept=".gb,.gbk,.genbank,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </Button>
          </div>
        </div>

        {/* Examples */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-medium text-muted-foreground">Examples:</span>
          {EXAMPLES.map(ex => (
            <button key={ex.label} onClick={() => { setRawInput(ex.data); setShowInput(false); }}
              className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {ex.label}
            </button>
          ))}
        </div>

        {/* Input panel */}
        {showInput && (
          <div className="mb-4">
            <textarea
              className="w-full font-mono text-[10px] p-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-vertical min-h-[120px] max-h-[300px]"
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder="Paste GenBank format data here..."
              rows={8}
            />
          </div>
        )}

        {/* Plasmid info bar */}
        {parsed && (
          <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{parsed.name}</span>
            <span>{parsed.seq.length.toLocaleString()} bp</span>
            <span>{parsed.annotations.length} features</span>
          </div>
        )}

        {/* SeqViz viewer */}
        {parsed ? (
          <div className="flex-1 min-h-[500px] rounded-xl border border-border bg-card overflow-hidden">
            <SeqViz
              name={parsed.name}
              seq={parsed.seq}
              annotations={parsed.annotations}
              viewer={viewMode}
              showComplement={true}
              showIndex={true}
              rotateOnScroll={true}
              style={{ height: "100%", width: "100%" }}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-[400px] rounded-xl border border-border bg-card flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Paste or upload a GenBank file to visualize.</p>
          </div>
        )}

        {/* Feature legend */}
        {parsed && parsed.annotations.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Features</p>
            <div className="flex flex-wrap gap-2">
              {parsed.annotations.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: a.color }} />
                  <span className="text-foreground font-medium">{a.name}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {a.start + 1}–{a.end} {a.direction === -1 ? "(rev)" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
          <p><strong>GenBank format</strong> — standard format for annotated DNA sequences. Paste the full file including LOCUS, FEATURES, and ORIGIN sections.</p>
          <p><strong>Circular view</strong> — shows the plasmid map with annotated features as colored arcs. Click features to select regions.</p>
          <p><strong>Linear view</strong> — shows the full sequence with annotations, complement strand, and index numbering. Scroll to browse.</p>
          <p><strong>Upload</strong> — supports .gb, .gbk, and .genbank file extensions.</p>
        </div>
      </div>
    </div>
  );
};

export default PlasmidViewer;
