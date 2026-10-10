import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Dna } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

type Tab = "cross" | "hardy";

// ── Genetics helpers ──

function getGametes(genotype: string): string[] {
  // Parse pairs: "AaBb" → [["A","a"], ["B","b"]]
  const pairs: string[][] = [];
  for (let i = 0; i < genotype.length; i += 2) {
    pairs.push([genotype[i], genotype[i + 1]]);
  }
  // Cartesian product of alleles
  const combine = (pairs: string[][]): string[] => {
    if (pairs.length === 0) return [""];
    const [first, ...rest] = pairs;
    const sub = combine(rest);
    const result: string[] = [];
    for (const a of first) {
      for (const s of sub) {
        result.push(a + s);
      }
    }
    return result;
  };
  return combine(pairs);
}

function normalizeGenotype(g: string): string {
  // Sort each pair so uppercase first: "aA" → "Aa"
  let result = "";
  for (let i = 0; i < g.length; i += 2) {
    const a = g[i], b = g[i + 1];
    if (a > b) result += b + a;
    else result += a + b;
  }
  return result;
}

function phenotypeLabel(genotype: string, dominance: string): string {
  const parts: string[] = [];
  for (let i = 0; i < genotype.length; i += 2) {
    const a = genotype[i], b = genotype[i + 1];
    const upper = a.toUpperCase();
    if (dominance === "complete") {
      parts.push(a === a.toUpperCase() || b === b.toUpperCase()
        ? `${upper} dominant`
        : `${upper.toLowerCase()} recessive`);
    } else if (dominance === "incomplete") {
      if (a === a.toUpperCase() && b === b.toUpperCase()) parts.push(`${upper}${upper}`);
      else if (a === a.toLowerCase() && b === b.toLowerCase()) parts.push(`${a}${b}`);
      else parts.push(`${upper}${a.toLowerCase()} (intermediate)`);
    } else {
      // codominant
      if (a === a.toUpperCase() && b === b.toUpperCase()) parts.push(`${upper}${upper}`);
      else if (a === a.toLowerCase() && b === b.toLowerCase()) parts.push(`${a}${b}`);
      else parts.push(`${upper}${a.toLowerCase()} (both expressed)`);
    }
  }
  return parts.join(", ");
}

function isValidGenotype(g: string, numGenes: number): boolean {
  if (g.length !== numGenes * 2) return false;
  for (let i = 0; i < g.length; i += 2) {
    const a = g[i], b = g[i + 1];
    if (a.toUpperCase() !== b.toUpperCase()) return false;
    if (!/[a-zA-Z]/.test(a) || !/[a-zA-Z]/.test(b)) return false;
  }
  return true;
}

// ── Cross Tab ──
function CrossTab() {
  const [numGenes, setNumGenes] = useState<1 | 2 | 3>(1);
  const [parent1, setParent1] = useState("Aa");
  const [parent2, setParent2] = useState("Aa");
  const [dominance, setDominance] = useState("complete");
  const [copied, setCopied] = useState(false);

  const valid = isValidGenotype(parent1, numGenes) && isValidGenotype(parent2, numGenes);

  const gametes1 = useMemo(() => valid ? getGametes(parent1) : [], [parent1, valid]);
  const gametes2 = useMemo(() => valid ? getGametes(parent2) : [], [parent2, valid]);

  const grid = useMemo(() => {
    if (!valid) return [];
    return gametes1.map(g1 =>
      gametes2.map(g2 => {
        let combined = "";
        for (let i = 0; i < g1.length; i++) {
          combined += g1[i] + g2[i];
        }
        return normalizeGenotype(combined);
      })
    );
  }, [gametes1, gametes2, valid]);

  const { genotypeCounts, phenotypeCounts, total } = useMemo(() => {
    const gCounts: Record<string, number> = {};
    const pCounts: Record<string, number> = {};
    let total = 0;
    for (const row of grid) {
      for (const g of row) {
        gCounts[g] = (gCounts[g] || 0) + 1;
        const p = phenotypeLabel(g, dominance);
        pCounts[p] = (pCounts[p] || 0) + 1;
        total++;
      }
    }
    return { genotypeCounts: gCounts, phenotypeCounts: pCounts, total };
  }, [grid, dominance]);

  const copyResults = () => {
    const lines = ["Genotype Ratios:"];
    Object.entries(genotypeCounts).sort((a, b) => b[1] - a[1]).forEach(([g, c]) => {
      lines.push(`  ${g}: ${c}/${total} (${((c / total) * 100).toFixed(1)}%)`);
    });
    lines.push("", "Phenotype Ratios:");
    Object.entries(phenotypeCounts).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
      lines.push(`  ${p}: ${c}/${total} (${((c / total) * 100).toFixed(1)}%)`);
    });
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Ratios copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const presets = [
    { label: "Aa × Aa", p1: "Aa", p2: "Aa", genes: 1 as const },
    { label: "Aa × aa", p1: "Aa", p2: "aa", genes: 1 as const },
    { label: "AaBb × AaBb", p1: "AaBb", p2: "AaBb", genes: 2 as const },
    { label: "AaBb × aabb", p1: "AaBb", p2: "aabb", genes: 2 as const },
    { label: "AaBbCc × AaBbCc", p1: "AaBbCc", p2: "AaBbCc", genes: 3 as const },
  ];

  // Color for genotype cell
  const cellColor = (g: string) => {
    if (dominance !== "complete") return "bg-muted/30";
    // Check if all dominant
    let allDom = true, allRec = true;
    for (let i = 0; i < g.length; i += 2) {
      const a = g[i], b = g[i + 1];
      if (a === a.toLowerCase() && b === b.toLowerCase()) allDom = false;
      if (a === a.toUpperCase() || b === b.toUpperCase()) allRec = false;
    }
    if (allDom) return "bg-primary/10";
    if (allRec) return "bg-red-50 dark:bg-red-950/20";
    return "bg-muted/30";
  };

  return (
    <div className="space-y-5">
      {/* Gene count selector */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Number of genes</Label>
        <div className="flex gap-1.5">
          {([1, 2, 3] as const).map(n => (
            <button key={n} onClick={() => {
              setNumGenes(n);
              if (n === 1) { setParent1("Aa"); setParent2("Aa"); }
              else if (n === 2) { setParent1("AaBb"); setParent2("AaBb"); }
              else { setParent1("AaBbCc"); setParent2("AaBbCc"); }
            }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${numGenes === n ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
              {n === 1 ? "Monohybrid" : n === 2 ? "Dihybrid" : "Trihybrid"}
            </button>
          ))}
        </div>
      </div>

      {/* Parent inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Parent 1</Label>
          <Input className="mt-1 h-9 text-sm font-mono" value={parent1}
            onChange={e => setParent1(e.target.value)}
            placeholder={numGenes === 1 ? "Aa" : numGenes === 2 ? "AaBb" : "AaBbCc"} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Parent 2</Label>
          <Input className="mt-1 h-9 text-sm font-mono" value={parent2}
            onChange={e => setParent2(e.target.value)}
            placeholder={numGenes === 1 ? "Aa" : numGenes === 2 ? "AaBb" : "AaBbCc"} />
        </div>
      </div>

      {/* Dominance */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Dominance</Label>
        <div className="flex gap-1.5">
          {[
            { id: "complete", label: "Complete" },
            { id: "incomplete", label: "Incomplete" },
            { id: "codominant", label: "Codominant" },
          ].map(d => (
            <button key={d.id} onClick={() => setDominance(d.id)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${dominance === d.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Quick crosses</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button key={p.label} onClick={() => { setNumGenes(p.genes); setParent1(p.p1); setParent2(p.p2); }}
              className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-mono">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!valid && (
        <p className="text-xs text-red-500 text-center">
          Enter valid genotypes ({numGenes * 2} characters, pairs of same letter like {numGenes === 1 ? "Aa" : numGenes === 2 ? "AaBb" : "AaBbCc"})
        </p>
      )}

      {/* Punnett Square Grid */}
      {valid && grid.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2 border border-border/50 bg-muted/20 text-muted-foreground font-medium">
                  {parent1} × {parent2}
                </th>
                {gametes2.map((g, i) => (
                  <th key={i} className="p-2 border border-border/50 bg-primary/5 font-mono font-semibold text-primary">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 border border-border/50 bg-primary/5 font-mono font-semibold text-primary text-center">
                    {gametes1[i]}
                  </td>
                  {row.map((g, j) => (
                    <td key={j} className={`p-2 border border-border/50 font-mono text-center font-medium text-foreground ${cellColor(g)}`}>
                      {g}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ratios */}
      {valid && total > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ratios</span>
            <button onClick={copyResults} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Genotype */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2">Genotype</p>
            <div className="space-y-1.5">
              {Object.entries(genotypeCounts).sort((a, b) => b[1] - a[1]).map(([g, c]) => (
                <div key={g} className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-foreground w-20">{g}</span>
                  <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(c / total) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-16 text-right">
                    {c}/{total} ({((c / total) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Phenotype */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-2">Phenotype</p>
            <div className="space-y-1.5">
              {Object.entries(phenotypeCounts).sort((a, b) => b[1] - a[1]).map(([p, c]) => (
                <div key={p} className="flex items-center gap-2">
                  <span className="text-xs text-foreground flex-1 truncate">{p}</span>
                  <span className="text-[10px] font-semibold text-primary tabular-nums">
                    {c}/{total} ({((c / total) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Classic ratio shorthand */}
          {dominance === "complete" && (
            <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-center">
              <span className="text-xs text-muted-foreground">Phenotype ratio: </span>
              <span className="text-sm font-semibold font-mono text-foreground">
                {Object.values(phenotypeCounts).sort((a, b) => b - a).join(" : ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hardy-Weinberg Tab ──
function HardyWeinbergTab() {
  const [input, setInput] = useState<"p" | "q" | "freq">("p");
  const [value, setValue] = useState("0.6");

  const valN = parseFloat(value);
  let p = 0, q = 0;

  if (input === "p" && valN >= 0 && valN <= 1) { p = valN; q = 1 - p; }
  else if (input === "q" && valN >= 0 && valN <= 1) { q = valN; p = 1 - q; }
  else if (input === "freq" && valN >= 0 && valN <= 1) { q = Math.sqrt(valN); p = 1 - q; }

  const valid = p >= 0 && p <= 1 && q >= 0 && q <= 1 && (p + q) > 0.99;
  const pp = p * p, pq2 = 2 * p * q, qq = q * q;

  return (
    <div className="space-y-5">
      <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/40">
        <p className="text-lg font-mono font-semibold text-foreground">p² + 2pq + q² = 1</p>
        <p className="text-xs text-muted-foreground mt-1">Hardy-Weinberg equilibrium — predict genotype frequencies from allele frequencies</p>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Input type</Label>
        <div className="flex gap-1.5">
          {[
            { id: "p" as const, label: "p (dominant allele freq)" },
            { id: "q" as const, label: "q (recessive allele freq)" },
            { id: "freq" as const, label: "q² (recessive phenotype freq)" },
          ].map(opt => (
            <button key={opt.id} onClick={() => setInput(opt.id)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${input === opt.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">
          {input === "p" ? "p (0–1)" : input === "q" ? "q (0–1)" : "Recessive phenotype frequency (0–1)"}
        </Label>
        <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" min="0" max="1" step="0.01"
          value={value} onChange={e => setValue(e.target.value)} />
      </div>

      {valid && (
        <div className="space-y-4">
          {/* Allele frequencies */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Allele Frequencies</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-foreground">{p.toFixed(4)}</div>
                <div className="text-[10px] text-muted-foreground">p (dominant)</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-foreground">{q.toFixed(4)}</div>
                <div className="text-[10px] text-muted-foreground">q (recessive)</div>
              </div>
            </div>
          </div>

          {/* Genotype frequencies */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Genotype Frequencies</p>
            <div className="space-y-2">
              {[
                { label: "AA (homozygous dominant)", formula: "p²", value: pp, color: "bg-primary/60" },
                { label: "Aa (heterozygous)", formula: "2pq", value: pq2, color: "bg-primary/40" },
                { label: "aa (homozygous recessive)", formula: "q²", value: qq, color: "bg-red-400/60" },
              ].map(g => (
                <div key={g.formula} className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-28 truncate">{g.label}</span>
                  <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                    <div className={`h-full ${g.color} rounded-full transition-all`} style={{ width: `${g.value * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-20 text-right">
                    {g.formula} = {(g.value * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Population prediction */}
          <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-xs text-muted-foreground space-y-1">
            <p>In a population of <strong>10,000</strong>:</p>
            <p>• <strong>{Math.round(pp * 10000).toLocaleString()}</strong> homozygous dominant (AA)</p>
            <p>• <strong>{Math.round(pq2 * 10000).toLocaleString()}</strong> heterozygous carriers (Aa)</p>
            <p>• <strong>{Math.round(qq * 10000).toLocaleString()}</strong> homozygous recessive (aa)</p>
          </div>

          {/* Quick examples */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Examples</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "CF (q²=0.0004)", input: "freq" as const, val: "0.0004" },
                { label: "Sickle cell (q=0.1)", input: "q" as const, val: "0.1" },
                { label: "PKU (q²=0.0001)", input: "freq" as const, val: "0.0001" },
                { label: "50/50 (p=0.5)", input: "p" as const, val: "0.5" },
              ].map(ex => (
                <button key={ex.label} onClick={() => { setInput(ex.input); setValue(ex.val); }}
                  className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Punnett Square & Genetics Calculator - BioSketch",
  description: "Punnett square generator for monohybrid, dihybrid, and trihybrid crosses. Calculate genotype and phenotype ratios with Hardy-Weinberg equilibrium. Free for students and educators.",
  url: "https://biosketch.art/punnett-square",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const PunnettSquare = () => {
  useTrackToolVisit("punnett-square");
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("cross");

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Punnett Square Calculator - Genetics Cross Tool | BioSketch"
        description="Generate Punnett squares for monohybrid, dihybrid, and trihybrid crosses. Calculate genotype and phenotype ratios with complete, incomplete, and codominant inheritance. Includes Hardy-Weinberg equilibrium calculator. Free, no signup."
        canonical="https://biosketch.art/punnett-square"
        keywords="Punnett square calculator, genetics calculator, monohybrid cross, dihybrid cross, trihybrid cross, genotype ratio, phenotype ratio, Hardy-Weinberg calculator, inheritance patterns, genetics education, Mendelian genetics"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-lg">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <Dna className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
              Punnett Square Calculator
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Genetic crosses with genotype & phenotype ratios, plus Hardy-Weinberg equilibrium.
          </p>
          <ToolRating toolId="punnett-square" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/40 mb-6">
          {[
            { id: "cross" as Tab, label: "Punnett Square" },
            { id: "hardy" as Tab, label: "Hardy-Weinberg" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "cross" && <CrossTab />}
        {tab === "hardy" && <HardyWeinbergTab />}

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
          <p><strong>Punnett Square</strong> — predicts offspring genotype ratios from parental crosses. Use uppercase for dominant alleles, lowercase for recessive.</p>
          <p><strong>Hardy-Weinberg</strong> — p² + 2pq + q² = 1. Predicts genotype frequencies in a population at equilibrium (no selection, mutation, migration, or drift).</p>
          <p><strong>Dominance modes</strong> — Complete: dominant masks recessive. Incomplete: heterozygote is intermediate. Codominant: both alleles fully expressed.</p>
        </div>
      </div>
    </div>
  );
};

export default PunnettSquare;
