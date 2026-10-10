import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Dna } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";
import {
  cleanSequence, reverseComplement, complement,
  translateAllFrames, findORFs,
  sequenceStats, proteinStats,
  toFasta, aaToThreeLetter,
} from "./seqUtils";

type Tab = "tools" | "translate" | "orfs";

const EXAMPLES: Record<string, { label: string; seq: string }> = {
  insulin: {
    label: "Human Insulin (INS)",
    seq: "ATGGCCCTGTGGATGCGCCTCCTGCCCCTGCTGGCGCTGCTGGCCCTCTGGGGACCTGACCCAGCCGCAGCCTTTGTGAACCAACACCTGTGCGGCTCACACCTGGTGGAAGCTCTCTACCTAGTGTGCGGGGAACGAGGCTTCTTCTACACACCCAAGACCCGCCGGGAGGCAGAGGACCTGCAGGTGGGGCAGGTGGAGCTGGGCGGGGGCCCTGGTGCAGGCAGCCTGCAGCCCTTGGCCCTGGAGGGGTCCCTGCAGAAGCGTGGCATTGTGGAACAATGCTGTACCAGCATCTGCTCCCTCTACCAGCTGGAGAACTACTGCAACTAG",
  },
  gfp: {
    label: "GFP (partial)",
    seq: "ATGAGTAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCAGTGGAGAGGGTGAAGGTGATGCAACATACGGAAAACTTACCCTTAAATTTATTTGCACTACTGGAAAACTACCTGTTCCATGGCCAACACTTGTCACTACTTTCTCTTATGGTGTTCAATGCTTTTCAAGATACCCAGATCATATGAAACGGCATGACTTTTTCAAGAGTGCCATGCCCGAAGGTTATGTACAGGAAAGAACTATATTTTTCAAAGATGACGGGAACTACAAGACACGTGCTGAAGTCAAGTTTGAAGGTGATACCCTTGTTAATAGAATCGAGTTAAAAGGTATTGATTTTAAAGAAGATGGAAACATTCTTGGACACAAATTGGAATACAACTATAACTCACACAATGTATACATCATGGCAGACAAACAAAAGAATGGAATCAAAGTTAACTTCAAAATTAGACACAACATTGAAGATGGAAGCGTTCAACTAGCAGACCATTATCAACAAAATACTCCAATTGGCGATGGCCCTGTCCTTTTACCAGACAACCATTACCTGTCCACACAATCTGCCCTTTCGAAAGATCCCAACGAAAAGAGAGACCACATGGTCCTTCTTGAGTTTGTAACAGCTGCTGGGATTACACATGGCATGGATGAACTATACAAATAA",
  },
  brca1: {
    label: "BRCA1 (exon 11 partial)",
    seq: "ATGGATTTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTAGAGTGTCCCATCTGTCTGGAGTTGATCAAGGAACCTGTCTCCACAAAGTGTGACCACATATTTTGCAAATTTTGCATGCTGAAACTTCTCAACCAGAAGAAAGGGCCTTCACAGTGTCCTTTATGTAAGAATGAT",
  },
  short: {
    label: "Short oligo (24 bp)",
    seq: "ATGGCTAGCGAATTCGGATCCAAG",
  },
};

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(label ? `${label} copied` : "Copied");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SeqBox({ label, seq, mono }: { label: string; seq: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <CopyBtn text={seq} label={label} />
      </div>
      <div className={`p-3 rounded-lg bg-muted/20 border border-border/30 text-xs leading-relaxed break-all ${mono !== false ? "font-mono" : ""}`}>
        {seq.length > 2000 ? seq.slice(0, 2000) + "…" : seq}
      </div>
    </div>
  );
}

// ── Tools Tab ──
function ToolsTab({ seq }: { seq: string }) {
  const stats = useMemo(() => sequenceStats(seq), [seq]);
  const rc = useMemo(() => reverseComplement(seq), [seq]);
  const comp = useMemo(() => complement(seq), [seq]);
  const fasta = useMemo(() => toFasta(seq, "input_sequence"), [seq]);

  if (!seq) return <p className="text-xs text-muted-foreground text-center py-8">Enter a DNA sequence above to begin.</p>;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Length", value: `${stats.length.toLocaleString()} bp` },
          { label: "GC%", value: `${stats.gcPercent.toFixed(1)}%` },
          { label: "Tm (est.)", value: `${stats.meltingTemp.toFixed(1)} °C` },
        ].map(s => (
          <div key={s.label} className="text-center p-2.5 rounded-lg bg-muted/20 border border-border/30">
            <div className="text-sm font-bold text-foreground">{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Composition bar */}
      <div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nucleotide Composition</span>
        <div className="flex h-6 rounded-full overflow-hidden mt-1.5 border border-border/30">
          {[
            { base: "A", count: stats.aCount, color: "bg-green-500" },
            { base: "T", count: stats.tCount, color: "bg-red-400" },
            { base: "G", count: stats.gCount, color: "bg-yellow-500" },
            { base: "C", count: stats.cCount, color: "bg-blue-500" },
          ].map(b => (
            <div key={b.base} className={`${b.color} flex items-center justify-center text-[9px] font-bold text-white`}
              style={{ width: `${(b.count / stats.length) * 100}%` }}
              title={`${b.base}: ${b.count} (${((b.count / stats.length) * 100).toFixed(1)}%)`}>
              {(b.count / stats.length) > 0.08 ? `${b.base} ${((b.count / stats.length) * 100).toFixed(0)}%` : ""}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
          <span>A: {stats.aCount}</span>
          <span>T: {stats.tCount}</span>
          <span>G: {stats.gCount}</span>
          <span>C: {stats.cCount}</span>
        </div>
      </div>

      {/* MW */}
      <div className="text-xs text-muted-foreground">
        Estimated MW (ssDNA): <strong className="text-foreground">{(stats.molecularWeight / 1000).toFixed(1)} kDa</strong>
      </div>

      <SeqBox label="Complement (5'→3')" seq={comp} />
      <SeqBox label="Reverse Complement (5'→3')" seq={rc} />
      <SeqBox label="FASTA Format" seq={fasta} />
    </div>
  );
}

// ── Translate Tab ──
function TranslateTab({ seq }: { seq: string }) {
  const frames = useMemo(() => translateAllFrames(seq), [seq]);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  if (!seq) return <p className="text-xs text-muted-foreground text-center py-8">Enter a DNA sequence above to begin.</p>;

  const selected = selectedFrame ? frames.find(f => f.frame === selectedFrame) : null;
  const pStats = selected ? proteinStats(selected.protein) : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">All 6 reading frames. Click a frame to see details.</p>

      {frames.map(f => (
        <div key={f.frame}>
          <button
            onClick={() => setSelectedFrame(selectedFrame === f.frame ? null : f.frame)}
            className={`w-full text-left rounded-lg border p-3 transition-all ${
              selectedFrame === f.frame ? "border-primary/40 bg-primary/5" : "border-border/30 hover:border-border/60"
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground">Frame {f.frame}</span>
              <span className="text-[10px] text-muted-foreground">{f.protein.length} aa</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground break-all line-clamp-2">
              {f.protein.slice(0, 120)}{f.protein.length > 120 ? "…" : ""}
            </div>
          </button>

          {selectedFrame === f.frame && selected && pStats && (
            <div className="mt-2 space-y-3 pl-3 border-l-2 border-primary/20">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Length: <strong className="text-foreground">{pStats.length} aa</strong></span>
                <span>MW: <strong className="text-foreground">{(pStats.mw / 1000).toFixed(1)} kDa</strong></span>
              </div>
              <SeqBox label="Protein (1-letter)" seq={selected.protein} />
              <SeqBox label="Protein (3-letter)" seq={aaToThreeLetter(selected.protein)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── ORF Tab ──
function OrfTab({ seq }: { seq: string }) {
  const [minLen, setMinLen] = useState("30");
  const minN = parseInt(minLen) || 30;
  const orfs = useMemo(() => findORFs(seq, minN), [seq, minN]);

  if (!seq) return <p className="text-xs text-muted-foreground text-center py-8">Enter a DNA sequence above to begin.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Min ORF length</Label>
        <input type="text" inputMode="numeric" className="h-8 w-20 px-2 text-xs font-mono rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50"
          value={minLen} onChange={e => setMinLen(e.target.value)} />
        <span className="text-[10px] text-muted-foreground">codons</span>
      </div>

      {orfs.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          No ORFs found with minimum {minN} codons. Try a lower threshold.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{orfs.length} ORF{orfs.length !== 1 ? "s" : ""} found</p>

          {/* ORF map visualization */}
          <div className="p-3 rounded-lg bg-muted/10 border border-border/30 space-y-1.5">
            {["+1", "+2", "+3", "-1", "-2", "-3"].map(frame => {
              const frameOrfs = orfs.filter(o => o.frame === frame);
              if (frameOrfs.length === 0) return null;
              return (
                <div key={frame} className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-muted-foreground w-6">{frame}</span>
                  <div className="flex-1 h-4 bg-muted/20 rounded relative">
                    {frameOrfs.map((orf, i) => {
                      const left = (orf.start / seq.length) * 100;
                      const width = Math.max(1, ((orf.end - orf.start) / seq.length) * 100);
                      return (
                        <div key={i}
                          className={`absolute h-full rounded ${frame.startsWith("+") ? "bg-primary/60" : "bg-orange-400/60"}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${orf.frame}: ${orf.start}-${orf.end} (${orf.length} aa)`} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ORF list */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Frame</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Position</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Length</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {orfs.slice(0, 20).map((orf, i) => (
                  <tr key={i} className="border-t border-border/30">
                    <td className="px-3 py-1.5 font-mono font-medium text-foreground">{orf.frame}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{orf.start.toLocaleString()}–{orf.end.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-foreground">{orf.length} aa</td>
                    <td className="px-3 py-1.5 text-right">
                      <CopyBtn text={orf.protein} label={`ORF ${orf.frame}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orfs.length > 20 && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground text-center border-t border-border/30">
                Showing top 20 of {orfs.length} ORFs
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free DNA Sequence Tools - BioSketch",
  description: "DNA and protein sequence analysis tools: reverse complement, 6-frame translation, ORF finder, GC content, melting temperature, and FASTA formatting. Free for researchers and students.",
  url: "https://biosketch.art/dna-tools",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function DnaTools() {
  useTrackToolVisit("dna-tools");
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("tools");
  const [rawInput, setRawInput] = useState(EXAMPLES.insulin.seq);

  const seq = useMemo(() => cleanSequence(rawInput), [rawInput]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free DNA Sequence Tools - Reverse Complement, Translation, ORF Finder | BioSketch"
        description="Analyze DNA sequences online: reverse complement, 6-frame translation to protein, ORF finder, GC content, nucleotide composition, melting temperature, molecular weight, and FASTA formatting. Supports FASTA input. Free, no signup."
        canonical="https://biosketch.art/dna-tools"
        keywords="DNA sequence tools, reverse complement tool, DNA to protein translation, 6 frame translation, ORF finder online, GC content calculator, DNA melting temperature, FASTA converter, nucleotide composition, bioinformatics tools free, molecular biology tools"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <Dna className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
              DNA Sequence Tools
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Reverse complement, translation, ORF finder, GC content, and more.
          </p>
          <ToolRating toolId="dna-tools" />
        </div>

        {/* Sequence input */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">DNA Sequence (FASTA or plain text)</Label>
            <span className="text-[10px] text-muted-foreground tabular-nums">{seq.length.toLocaleString()} bp</span>
          </div>
          <textarea
            className="w-full font-mono text-xs p-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-vertical min-h-[100px]"
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder="Paste DNA sequence here (FASTA headers are auto-removed)..."
            rows={4}
          />
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(EXAMPLES).map(([k, ex]) => (
              <button key={k} onClick={() => setRawInput(ex.seq)}
                className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/40 mb-6">
          {[
            { id: "tools" as Tab, label: "Analysis" },
            { id: "translate" as Tab, label: "Translation" },
            { id: "orfs" as Tab, label: "ORF Finder" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "tools" && <ToolsTab seq={seq} />}
        {tab === "translate" && <TranslateTab seq={seq} />}
        {tab === "orfs" && <OrfTab seq={seq} />}

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
          <p><strong>Input</strong> — paste raw DNA or FASTA format. Headers (&gt;) are auto-stripped. Non-ATGC characters are removed.</p>
          <p><strong>Translation</strong> — uses NCBI Standard Genetic Code (Table 1). All 6 reading frames (3 forward + 3 reverse complement).</p>
          <p><strong>ORF Finder</strong> — scans for ATG start codons through stop codons (TAA, TAG, TGA). Default minimum: 30 codons (~90 bp).</p>
          <p><strong>Tm estimate</strong> — Wallace rule for &le;14 nt; salt-adjusted formula for longer sequences. For precise Tm, use nearest-neighbor methods.</p>
        </div>
      </div>
    </div>
  );
}
