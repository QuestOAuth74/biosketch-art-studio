import { useState } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Calculator, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// Periodic table data: symbol → { name, mass, number }
const ELEMENTS: Record<string, { name: string; mass: number; number: number }> = {
  H: { name: 'Hydrogen', mass: 1.008, number: 1 }, He: { name: 'Helium', mass: 4.0026, number: 2 },
  Li: { name: 'Lithium', mass: 6.941, number: 3 }, Be: { name: 'Beryllium', mass: 9.0122, number: 4 },
  B: { name: 'Boron', mass: 10.811, number: 5 }, C: { name: 'Carbon', mass: 12.011, number: 6 },
  N: { name: 'Nitrogen', mass: 14.007, number: 7 }, O: { name: 'Oxygen', mass: 15.999, number: 8 },
  F: { name: 'Fluorine', mass: 18.998, number: 9 }, Ne: { name: 'Neon', mass: 20.180, number: 10 },
  Na: { name: 'Sodium', mass: 22.990, number: 11 }, Mg: { name: 'Magnesium', mass: 24.305, number: 12 },
  Al: { name: 'Aluminium', mass: 26.982, number: 13 }, Si: { name: 'Silicon', mass: 28.086, number: 14 },
  P: { name: 'Phosphorus', mass: 30.974, number: 15 }, S: { name: 'Sulfur', mass: 32.065, number: 16 },
  Cl: { name: 'Chlorine', mass: 35.453, number: 17 }, Ar: { name: 'Argon', mass: 39.948, number: 18 },
  K: { name: 'Potassium', mass: 39.098, number: 19 }, Ca: { name: 'Calcium', mass: 40.078, number: 20 },
  Ti: { name: 'Titanium', mass: 47.867, number: 22 }, V: { name: 'Vanadium', mass: 50.942, number: 23 },
  Cr: { name: 'Chromium', mass: 51.996, number: 24 }, Mn: { name: 'Manganese', mass: 54.938, number: 25 },
  Fe: { name: 'Iron', mass: 55.845, number: 26 }, Co: { name: 'Cobalt', mass: 58.933, number: 27 },
  Ni: { name: 'Nickel', mass: 58.693, number: 28 }, Cu: { name: 'Copper', mass: 63.546, number: 29 },
  Zn: { name: 'Zinc', mass: 65.38, number: 30 }, Ga: { name: 'Gallium', mass: 69.723, number: 31 },
  Ge: { name: 'Germanium', mass: 72.630, number: 32 }, As: { name: 'Arsenic', mass: 74.922, number: 33 },
  Se: { name: 'Selenium', mass: 78.971, number: 34 }, Br: { name: 'Bromine', mass: 79.904, number: 35 },
  Kr: { name: 'Krypton', mass: 83.798, number: 36 }, Rb: { name: 'Rubidium', mass: 85.468, number: 37 },
  Sr: { name: 'Strontium', mass: 87.62, number: 38 }, Y: { name: 'Yttrium', mass: 88.906, number: 39 },
  Zr: { name: 'Zirconium', mass: 91.224, number: 40 }, Mo: { name: 'Molybdenum', mass: 95.95, number: 42 },
  Ag: { name: 'Silver', mass: 107.87, number: 47 }, Cd: { name: 'Cadmium', mass: 112.41, number: 48 },
  Sn: { name: 'Tin', mass: 118.71, number: 50 }, I: { name: 'Iodine', mass: 126.90, number: 53 },
  Ba: { name: 'Barium', mass: 137.33, number: 56 }, W: { name: 'Tungsten', mass: 183.84, number: 74 },
  Pt: { name: 'Platinum', mass: 195.08, number: 78 }, Au: { name: 'Gold', mass: 196.97, number: 79 },
  Hg: { name: 'Mercury', mass: 200.59, number: 80 }, Pb: { name: 'Lead', mass: 207.2, number: 82 },
  U: { name: 'Uranium', mass: 238.03, number: 92 },
};

interface ElementResult {
  symbol: string;
  name: string;
  count: number;
  mass: number;
  totalMass: number;
  percent: number;
}

function parseFormula(formula: string): { elements: Record<string, number>; error?: string } {
  const elements: Record<string, number> = {};
  const regex = /([A-Z][a-z]?)(\d*)/g;
  let match;
  let consumed = '';

  while ((match = regex.exec(formula)) !== null) {
    if (!match[0]) break;
    const sym = match[1];
    const count = match[2] ? parseInt(match[2]) : 1;

    if (!ELEMENTS[sym]) {
      return { elements: {}, error: `Unknown element: ${sym}` };
    }

    elements[sym] = (elements[sym] || 0) + count;
    consumed += match[0];
  }

  if (consumed.length !== formula.replace(/\s/g, '').length) {
    return { elements: {}, error: 'Invalid formula format' };
  }

  return { elements };
}

const EXAMPLES = [
  { formula: 'H2O', name: 'Water' },
  { formula: 'NaCl', name: 'Sodium Chloride' },
  { formula: 'C6H12O6', name: 'Glucose' },
  { formula: 'C2H5OH', name: 'Ethanol' },
  { formula: 'C8H10N4O2', name: 'Caffeine' },
  { formula: 'C9H8O4', name: 'Aspirin' },
  { formula: 'C27H46O', name: 'Cholesterol' },
  { formula: 'C10H15N3O6S', name: 'Glutathione (reduced)' },
  { formula: 'C21H30O2', name: 'THC' },
  { formula: 'Fe2O3', name: 'Iron(III) Oxide' },
];

const MolecularWeight = () => {
  useTrackToolVisit("molecular-weight");
  const navigate = useNavigate();
  const [formula, setFormula] = useState('C6H12O6');
  const [results, setResults] = useState<ElementResult[] | null>(null);
  const [totalMW, setTotalMW] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const calculate = (f?: string) => {
    const input = (f || formula).trim();
    if (!input) return;
    if (f) setFormula(f);

    const { elements, error: parseError } = parseFormula(input);
    if (parseError) { setError(parseError); setResults(null); setTotalMW(null); return; }

    let mw = 0;
    const rows: ElementResult[] = [];

    for (const [sym, count] of Object.entries(elements)) {
      const el = ELEMENTS[sym];
      const tm = el.mass * count;
      mw += tm;
      rows.push({ symbol: sym, name: el.name, count, mass: el.mass, totalMass: tm, percent: 0 });
    }

    rows.forEach(r => r.percent = (r.totalMass / mw) * 100);
    rows.sort((a, b) => b.percent - a.percent);

    setResults(rows);
    setTotalMW(mw);
    setError('');
  };

  const copyMW = () => {
    if (totalMW) {
      navigator.clipboard.writeText(totalMW.toFixed(4));
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Auto-calculate on load
  useState(() => { calculate(); });

  const structuredData = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "Molecular Weight Calculator - BioSketch",
    description: "Calculate molecular weight, elemental composition, and percent composition from chemical formulas.",
    url: "https://biosketch.art/molecular-weight",
    applicationCategory: "EducationalApplication", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Molecular Weight Calculator | BioSketch"
        description="Calculate molecular weight, elemental composition, and percent composition from any chemical formula. Supports all common elements. Free, no signup."
        canonical="https://biosketch.art/molecular-weight"
        keywords="molecular weight calculator, molar mass calculator, chemical formula calculator, elemental composition, percent composition, molecular mass"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <button onClick={() => navigate('/tools')} className="text-sm text-muted-foreground hover:text-primary mb-4 inline-block">&larr; Back to Tools</button>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-serif tracking-tight">Molecular Weight Calculator</h1>
            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">FREE</span>
          </div>
          <p className="text-muted-foreground text-sm">Enter a chemical formula to calculate molecular weight, elemental composition, and percent composition.</p>
          <ToolRating toolId="molecular-weight" />
        </div>

        {/* Input */}
        <div className="flex gap-3 mb-6">
          <Input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && calculate()}
            placeholder="Enter formula, e.g. C6H12O6"
            className="text-lg font-mono h-12 flex-1"
          />
          <Button onClick={() => calculate()} className="h-12 px-6 text-sm">Calculate</Button>
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-2 mb-8">
          {EXAMPLES.map(ex => (
            <button
              key={ex.formula}
              onClick={() => calculate(ex.formula)}
              className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-card hover:border-primary/50 hover:text-primary transition-all"
            >
              <span className="font-mono font-medium">{ex.formula}</span>
              <span className="text-muted-foreground ml-1.5">{ex.name}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-6">{error}</div>
        )}

        {/* Results */}
        {totalMW !== null && results && (
          <div className="space-y-6">
            {/* MW Result */}
            <div className="p-6 rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground font-medium">Molecular Weight</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={copyMW}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="text-4xl font-bold font-mono text-foreground">{totalMW.toFixed(4)}</div>
              <div className="text-sm text-muted-foreground mt-1">g/mol</div>
            </div>

            {/* Composition Table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50">
                <h2 className="text-sm font-semibold">Elemental Composition</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3 text-left font-semibold">Element</th>
                    <th className="px-6 py-3 text-right font-semibold">Count</th>
                    <th className="px-6 py-3 text-right font-semibold">Atomic Mass</th>
                    <th className="px-6 py-3 text-right font-semibold">Total Mass</th>
                    <th className="px-6 py-3 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.symbol} className="border-t border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-mono font-semibold text-foreground">{r.symbol}</span>
                        <span className="text-muted-foreground text-xs ml-2">{r.name}</span>
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-sm">{r.count}</td>
                      <td className="px-6 py-3 text-right font-mono text-sm">{r.mass.toFixed(4)}</td>
                      <td className="px-6 py-3 text-right font-mono text-sm">{r.totalMass.toFixed(4)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${r.percent}%` }} />
                          </div>
                          <span className="font-mono text-sm font-medium w-14 text-right">{r.percent.toFixed(2)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MolecularWeight;
