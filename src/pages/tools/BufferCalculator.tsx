import { useState } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { FlaskConical, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

interface BufferSystem {
  name: string;
  acid: string;
  base: string;
  pKa: number;
  rangeMin: number;
  rangeMax: number;
  acidMW: number;
  baseMW: number;
}

const BUFFERS: BufferSystem[] = [
  { name: 'Acetate', acid: 'Acetic acid (CH₃COOH)', base: 'Sodium acetate (CH₃COONa)', pKa: 4.76, rangeMin: 3.7, rangeMax: 5.8, acidMW: 60.05, baseMW: 82.03 },
  { name: 'MES', acid: 'MES acid', base: 'MES sodium salt', pKa: 6.15, rangeMin: 5.5, rangeMax: 6.7, acidMW: 195.24, baseMW: 217.22 },
  { name: 'Phosphate', acid: 'NaH₂PO₄ (monobasic)', base: 'Na₂HPO₄ (dibasic)', pKa: 7.20, rangeMin: 5.8, rangeMax: 8.0, acidMW: 119.98, baseMW: 141.96 },
  { name: 'HEPES', acid: 'HEPES acid', base: 'HEPES sodium salt', pKa: 7.55, rangeMin: 6.8, rangeMax: 8.2, acidMW: 238.30, baseMW: 260.29 },
  { name: 'Tris', acid: 'Tris-HCl', base: 'Tris base', pKa: 8.06, rangeMin: 7.0, rangeMax: 9.0, acidMW: 157.60, baseMW: 121.14 },
  { name: 'TAPS', acid: 'TAPS acid', base: 'TAPS sodium salt', pKa: 8.44, rangeMin: 7.7, rangeMax: 9.1, acidMW: 243.28, baseMW: 265.27 },
  { name: 'Bicine', acid: 'Bicine', base: 'Bicine sodium salt', pKa: 8.35, rangeMin: 7.6, rangeMax: 9.0, acidMW: 163.17, baseMW: 185.16 },
  { name: 'Glycine-NaOH', acid: 'Glycine', base: 'NaOH', pKa: 9.60, rangeMin: 8.6, rangeMax: 10.6, acidMW: 75.07, baseMW: 40.00 },
  { name: 'CAPS', acid: 'CAPS acid', base: 'CAPS sodium salt', pKa: 10.40, rangeMin: 9.7, rangeMax: 11.1, acidMW: 221.32, baseMW: 243.30 },
  { name: 'Carbonate', acid: 'NaHCO₃', base: 'Na₂CO₃', pKa: 10.33, rangeMin: 9.2, rangeMax: 10.8, acidMW: 84.01, baseMW: 105.99 },
];

const BufferCalculator = () => {
  useTrackToolVisit("buffer-calculator");
  const navigate = useNavigate();
  const [selectedBuffer, setSelectedBuffer] = useState('Phosphate');
  const [targetPH, setTargetPH] = useState('7.4');
  const [totalConc, setTotalConc] = useState('0.1');
  const [totalVol, setTotalVol] = useState('1000');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const calculate = () => {
    const buf = BUFFERS.find(b => b.name === selectedBuffer);
    if (!buf) { setError('Select a buffer system'); return; }

    const pH = parseFloat(targetPH);
    const conc = parseFloat(totalConc); // mol/L
    const vol = parseFloat(totalVol); // mL

    if (isNaN(pH) || isNaN(conc) || isNaN(vol)) { setError('Enter valid numbers'); return; }
    if (pH < buf.rangeMin - 1 || pH > buf.rangeMax + 1) {
      setError(`pH ${pH} is outside the effective range (${buf.rangeMin}–${buf.rangeMax}) for ${buf.name} buffer. Results may be inaccurate.`);
    } else {
      setError('');
    }

    // Henderson-Hasselbalch: pH = pKa + log([A-]/[HA])
    // [A-]/[HA] = 10^(pH - pKa)
    const ratio = Math.pow(10, pH - buf.pKa);
    const baseConc = conc * ratio / (1 + ratio); // [A-]
    const acidConc = conc / (1 + ratio); // [HA]

    const volL = vol / 1000;
    const acidMoles = acidConc * volL;
    const baseMoles = baseConc * volL;
    const acidGrams = acidMoles * buf.acidMW;
    const baseGrams = baseMoles * buf.baseMW;

    setResults({
      buffer: buf,
      pH,
      ratio,
      acidConc,
      baseConc,
      acidMoles,
      baseMoles,
      acidGrams,
      baseGrams,
      totalVol: vol,
    });
  };

  const copyRecipe = () => {
    if (!results) return;
    const { buffer: buf, acidGrams, baseGrams, totalVol: vol, pH } = results;
    const text = `${buf.name} Buffer (pH ${pH}, ${totalConc} M, ${vol} mL)\n${buf.acid}: ${acidGrams.toFixed(4)} g\n${buf.base}: ${baseGrams.toFixed(4)} g\nDissolve in ~${(vol * 0.8).toFixed(0)} mL water, adjust pH to ${pH}, bring to ${vol} mL.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Recipe copied');
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-calculate on load
  useState(() => { calculate(); });

  const currentBuffer = BUFFERS.find(b => b.name === selectedBuffer);

  const structuredData = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "Buffer Calculator - BioSketch",
    description: "Henderson-Hasselbalch buffer calculator. Enter target pH, buffer system, and concentration to get a preparation recipe.",
    url: "https://biosketch.art/buffer-calculator",
    applicationCategory: "EducationalApplication", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Buffer Calculator - Henderson-Hasselbalch | BioSketch"
        description="Calculate buffer recipes using the Henderson-Hasselbalch equation. Select buffer system, enter target pH and concentration, get exact amounts. Free, no signup."
        canonical="https://biosketch.art/buffer-calculator"
        keywords="buffer calculator, Henderson-Hasselbalch calculator, pH buffer recipe, Tris buffer calculator, phosphate buffer calculator, HEPES buffer, buffer preparation"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <button onClick={() => navigate('/tools')} className="text-sm text-muted-foreground hover:text-primary mb-4 inline-block">&larr; Back to Tools</button>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold font-serif tracking-tight">Buffer Calculator</h1>
            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">FREE</span>
          </div>
          <p className="text-muted-foreground text-sm">Henderson-Hasselbalch equation solver. Select a buffer system, enter your target pH and concentration, get exact preparation amounts.</p>
          <ToolRating toolId="buffer-calculator" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input panel */}
          <div className="space-y-5">
            <div className="p-6 rounded-2xl border border-border bg-card space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buffer System</Label>
                <Select value={selectedBuffer} onValueChange={setSelectedBuffer}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUFFERS.map(b => (
                      <SelectItem key={b.name} value={b.name}>
                        {b.name} (pKa {b.pKa}) — pH {b.rangeMin}–{b.rangeMax}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentBuffer && (
                <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground space-y-1">
                  <p><strong className="text-foreground">pKa:</strong> {currentBuffer.pKa}</p>
                  <p><strong className="text-foreground">Effective range:</strong> pH {currentBuffer.rangeMin} – {currentBuffer.rangeMax}</p>
                  <p><strong className="text-foreground">Acid:</strong> {currentBuffer.acid} (MW {currentBuffer.acidMW})</p>
                  <p><strong className="text-foreground">Base:</strong> {currentBuffer.base} (MW {currentBuffer.baseMW})</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target pH</Label>
                  <Input value={targetPH} onChange={(e) => setTargetPH(e.target.value)} className="h-10 font-mono" placeholder="7.4" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conc. (M)</Label>
                  <Input value={totalConc} onChange={(e) => setTotalConc(e.target.value)} className="h-10 font-mono" placeholder="0.1" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Volume (mL)</Label>
                  <Input value={totalVol} onChange={(e) => setTotalVol(e.target.value)} className="h-10 font-mono" placeholder="1000" />
                </div>
              </div>

              <Button onClick={calculate} className="w-full h-10">Calculate Buffer Recipe</Button>
            </div>

            {/* Henderson-Hasselbalch reference */}
            <div className="p-5 rounded-2xl border border-border bg-card">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Henderson-Hasselbalch Equation</h3>
              <div className="text-center py-3 font-mono text-lg text-foreground">
                pH = pKa + log([A⁻] / [HA])
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Where [A⁻] is the conjugate base concentration and [HA] is the weak acid concentration.
                The buffer is most effective within ±1 pH unit of the pKa.
              </p>
            </div>
          </div>

          {/* Results panel */}
          <div className="space-y-5">
            {error && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">{error}</div>
            )}

            {results && (
              <>
                {/* Recipe card */}
                <div className="p-6 rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold">Buffer Recipe</h2>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={copyRecipe}>
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy Recipe'}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <div className="text-xs text-blue-600 font-medium mb-1">{results.buffer.acid}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-mono text-blue-700">{results.acidGrams.toFixed(4)}</span>
                        <span className="text-blue-600 text-sm">grams</span>
                      </div>
                      <div className="text-xs text-blue-500 mt-1">{results.acidMoles.toFixed(6)} mol | {(results.acidConc * 1000).toFixed(2)} mM</div>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                      <div className="text-xs text-emerald-600 font-medium mb-1">{results.buffer.base}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-mono text-emerald-700">{results.baseGrams.toFixed(4)}</span>
                        <span className="text-emerald-600 text-sm">grams</span>
                      </div>
                      <div className="text-xs text-emerald-500 mt-1">{results.baseMoles.toFixed(6)} mol | {(results.baseConc * 1000).toFixed(2)} mM</div>
                    </div>
                  </div>
                </div>

                {/* Preparation steps */}
                <div className="p-6 rounded-2xl border border-border bg-card">
                  <h2 className="text-sm font-semibold mb-4">Preparation Steps</h2>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</span>
                      <span>Weigh <strong className="text-foreground font-mono">{results.acidGrams.toFixed(4)} g</strong> of {results.buffer.acid}</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</span>
                      <span>Weigh <strong className="text-foreground font-mono">{results.baseGrams.toFixed(4)} g</strong> of {results.buffer.base}</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">3</span>
                      <span>Dissolve both in approximately <strong className="text-foreground">{(results.totalVol * 0.8).toFixed(0)} mL</strong> of deionized water</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">4</span>
                      <span>Adjust pH to <strong className="text-foreground">{results.pH}</strong> using HCl or NaOH</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">5</span>
                      <span>Bring final volume to <strong className="text-foreground">{results.totalVol} mL</strong> with deionized water</span>
                    </li>
                  </ol>
                </div>

                {/* Ratio info */}
                <div className="p-4 rounded-xl bg-muted/40 text-xs text-muted-foreground">
                  <strong className="text-foreground">Base:Acid ratio:</strong> {results.ratio.toFixed(4)} : 1 &nbsp;|&nbsp;
                  <strong className="text-foreground">Buffer capacity:</strong> {results.ratio > 0.1 && results.ratio < 10 ? 'Good' : 'Poor — consider a different buffer system'}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BufferCalculator;
