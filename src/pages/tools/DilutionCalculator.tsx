import { useState } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Beaker, FlaskConical, TestTubes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

type Tab = "dilution" | "molarity" | "serial";

// ── C1V1 = C2V2 ──
function DilutionTab() {
  const [c1, setC1] = useState(""); const [v1, setV1] = useState("");
  const [c2, setC2] = useState(""); const [v2, setV2] = useState("");
  const [solve, setSolve] = useState<"c1"|"v1"|"c2"|"v2">("v2");

  const compute = () => {
    const vals = { c1: parseFloat(c1), v1: parseFloat(v1), c2: parseFloat(c2), v2: parseFloat(v2) };
    if (solve === "v2" && vals.c1 && vals.v1 && vals.c2) return (vals.c1 * vals.v1) / vals.c2;
    if (solve === "c2" && vals.c1 && vals.v1 && vals.v2) return (vals.c1 * vals.v1) / vals.v2;
    if (solve === "v1" && vals.c2 && vals.v2 && vals.c1) return (vals.c2 * vals.v2) / vals.c1;
    if (solve === "c1" && vals.c2 && vals.v2 && vals.v1) return (vals.c2 * vals.v2) / vals.v1;
    return null;
  };

  const result = compute();
  const labels = { c1: "C₁ (stock conc.)", v1: "V₁ (stock vol.)", c2: "C₂ (final conc.)", v2: "V₂ (final vol.)" };

  return (
    <div className="space-y-5">
      <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/40">
        <p className="text-lg font-mono font-semibold text-foreground">C₁V₁ = C₂V₂</p>
        <p className="text-xs text-muted-foreground mt-1">Enter any 3 values, select which to solve for</p>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Solve for</Label>
        <div className="flex gap-1.5">
          {(["c1","v1","c2","v2"] as const).map(k => (
            <button key={k} onClick={() => setSolve(k)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${solve === k ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
              {k === "c1" ? "C₁" : k === "v1" ? "V₁" : k === "c2" ? "C₂" : "V₂"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["c1","v1","c2","v2"] as const).map(k => (
          <div key={k}>
            <Label className="text-xs text-muted-foreground">{labels[k]}</Label>
            {solve === k ? (
              <div className="h-9 mt-1 rounded-lg bg-primary/5 border border-primary/20 flex items-center px-3">
                <span className="text-sm font-semibold text-primary">{result !== null ? result.toPrecision(6) : "—"}</span>
              </div>
            ) : (
              <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" placeholder="0"
                value={k === "c1" ? c1 : k === "v1" ? v1 : k === "c2" ? c2 : v2}
                onChange={e => k === "c1" ? setC1(e.target.value) : k === "v1" ? setV1(e.target.value) : k === "c2" ? setC2(e.target.value) : setV2(e.target.value)} />
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">Use consistent units (e.g. M and L, or mM and mL)</p>
    </div>
  );
}

// ── Molarity from mass/vol/MW ──
function MolarityTab() {
  const [mass, setMass] = useState(""); // grams
  const [mw, setMw] = useState(""); // g/mol
  const [volume, setVolume] = useState(""); // liters

  const massN = parseFloat(mass);
  const mwN = parseFloat(mw);
  const volN = parseFloat(volume);

  const molarity = (massN > 0 && mwN > 0 && volN > 0) ? (massN / mwN) / volN : null;
  const moles = (massN > 0 && mwN > 0) ? massN / mwN : null;

  return (
    <div className="space-y-5">
      <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/40">
        <p className="text-lg font-mono font-semibold text-foreground">M = (mass / MW) / V</p>
        <p className="text-xs text-muted-foreground mt-1">Calculate molarity from mass, molecular weight, and volume</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Mass of solute (g)</Label>
          <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" placeholder="e.g. 5.84" value={mass} onChange={e => setMass(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Molecular weight (g/mol)</Label>
          <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" placeholder="e.g. 58.44 (NaCl)" value={mw} onChange={e => setMw(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Final volume (L)</Label>
          <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" placeholder="e.g. 1.0" value={volume} onChange={e => setVolume(e.target.value)} />
        </div>
      </div>

      {molarity !== null && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Moles of solute</span>
            <span className="text-sm font-semibold text-foreground">{moles!.toPrecision(6)} mol</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Molarity</span>
            <span className="text-sm font-semibold text-primary">{molarity.toPrecision(6)} M</span>
          </div>
          {molarity >= 0.001 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Also</span>
              <span className="text-sm font-medium text-foreground">
                {molarity >= 1 ? `${molarity.toPrecision(4)} M` : molarity >= 0.001 ? `${(molarity * 1000).toPrecision(4)} mM` : `${(molarity * 1e6).toPrecision(4)} µM`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Quick examples */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Quick examples</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "1M NaCl", mass: "58.44", mw: "58.44", vol: "1" },
            { label: "0.1M Tris", mass: "12.11", mw: "121.14", vol: "1" },
            { label: "0.5M EDTA", mass: "186.12", mw: "372.24", vol: "1" },
            { label: "10mM ATP", mass: "0.551", mw: "551.14", vol: "0.1" },
          ].map(ex => (
            <button key={ex.label} onClick={() => { setMass(ex.mass); setMw(ex.mw); setVolume(ex.vol); }}
              className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Serial Dilution ──
function SerialTab() {
  const [startConc, setStartConc] = useState("100");
  const [dilutionFactor, setDilutionFactor] = useState("2");
  const [steps, setSteps] = useState("8");
  const [transferVol, setTransferVol] = useState("100"); // µL
  const [copied, setCopied] = useState(false);

  const startN = parseFloat(startConc);
  const factorN = parseFloat(dilutionFactor);
  const stepsN = Math.min(Math.max(parseInt(steps) || 0, 1), 20);
  const transferN = parseFloat(transferVol);

  const series = [];
  if (startN > 0 && factorN > 1) {
    for (let i = 0; i < stepsN; i++) {
      const conc = startN / Math.pow(factorN, i);
      series.push(conc);
    }
  }

  const diluent = transferN > 0 && factorN > 1 ? transferN * (factorN - 1) : 0;

  const copyTable = () => {
    const header = "Step\tConcentration\tTransfer (µL)\tDiluent (µL)";
    const rows = series.map((c, i) =>
      `${i + 1}\t${c >= 0.01 ? c.toPrecision(4) : c.toExponential(2)}\t${transferN}\t${i === 0 ? "—" : diluent.toFixed(1)}`
    );
    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setCopied(true);
    toast.success("Table copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/40">
        <p className="text-lg font-mono font-semibold text-foreground">Cₙ = C₀ / Fⁿ</p>
        <p className="text-xs text-muted-foreground mt-1">Generate a serial dilution series with exact volumes</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Starting concentration</Label>
          <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" value={startConc} onChange={e => setStartConc(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Dilution factor</Label>
          <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" value={dilutionFactor} onChange={e => setDilutionFactor(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Number of steps</Label>
          <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" min="1" max="20" value={steps} onChange={e => setSteps(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Transfer volume (µL)</Label>
          <Input type="text" inputMode="decimal" className="mt-1 h-9 text-sm" value={transferVol} onChange={e => setTransferVol(e.target.value)} />
        </div>
      </div>

      {diluent > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Add <strong>{diluent.toFixed(1)} µL</strong> diluent to each tube before transferring <strong>{transferN} µL</strong>
        </p>
      )}

      {series.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Dilution Series</span>
            <button onClick={copyTable} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy table"}
            </button>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Step</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Concentration</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Fold</th>
                </tr>
              </thead>
              <tbody>
                {series.map((c, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium text-foreground">
                      {c >= 0.01 ? c.toPrecision(4) : c.toExponential(2)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">
                      1:{Math.pow(factorN, i).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Quick presets</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "2-fold, 8 steps", factor: "2", steps: "8" },
            { label: "3-fold, 8 steps", factor: "3", steps: "8" },
            { label: "10-fold, 6 steps", factor: "10", steps: "6" },
            { label: "Half-log, 10 steps", factor: "3.162", steps: "10" },
          ].map(ex => (
            <button key={ex.label} onClick={() => { setDilutionFactor(ex.factor); setSteps(ex.steps); }}
              className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Dilution & Molarity Calculator - BioSketch",
  description: "C1V1=C2V2 dilution calculator, molarity from mass/volume/MW, and serial dilution generator. Free for researchers and students.",
  url: "https://biosketch.art/dilution-calculator",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const DilutionCalculator = () => {
  useTrackToolVisit("dilution-calculator");
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dilution");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dilution", label: "C₁V₁ = C₂V₂", icon: <Beaker className="h-3.5 w-3.5" /> },
    { id: "molarity", label: "Molarity", icon: <FlaskConical className="h-3.5 w-3.5" /> },
    { id: "serial", label: "Serial Dilution", icon: <TestTubes className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Dilution & Molarity Calculator | BioSketch"
        description="C1V1=C2V2 dilution calculator, molarity from mass/volume/MW, and serial dilution series generator. Free online tool for researchers, students, and lab scientists. No signup required."
        canonical="https://biosketch.art/dilution-calculator"
        keywords="dilution calculator, C1V1=C2V2, molarity calculator, serial dilution calculator, concentration calculator, lab dilution tool, solution preparation, molar concentration"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-md">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
            Dilution & Molarity Calculator
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Dilutions, molarity, and serial dilution series for lab preparation.
          </p>
          <ToolRating toolId="dilution-calculator" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/40 mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "dilution" && <DilutionTab />}
        {tab === "molarity" && <MolarityTab />}
        {tab === "serial" && <SerialTab />}

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
          <p><strong>C₁V₁ = C₂V₂</strong> — the dilution equation. Solve for any variable given the other three.</p>
          <p><strong>Molarity</strong> — concentration in moles per liter. M = (mass in grams / MW) / volume in liters.</p>
          <p><strong>Serial dilution</strong> — each step dilutes the previous concentration by a constant factor.</p>
        </div>
      </div>
    </div>
  );
};

export default DilutionCalculator;
