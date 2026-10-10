import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// ── Category definitions ──

interface UnitDef {
  label: string;
  toBase: (v: number) => number;   // convert to base unit
  fromBase: (v: number) => number; // convert from base unit
}

interface Category {
  name: string;
  icon: string;
  baseUnit: string;
  units: Record<string, UnitDef>;
}

const CATEGORIES: Record<string, Category> = {
  temperature: {
    name: "Temperature",
    icon: "🌡️",
    baseUnit: "K",
    units: {
      C: { label: "Celsius (°C)", toBase: v => v + 273.15, fromBase: v => v - 273.15 },
      F: { label: "Fahrenheit (°F)", toBase: v => (v - 32) * 5/9 + 273.15, fromBase: v => (v - 273.15) * 9/5 + 32 },
      K: { label: "Kelvin (K)", toBase: v => v, fromBase: v => v },
    },
  },
  concentration: {
    name: "Concentration",
    icon: "🧪",
    baseUnit: "M",
    units: {
      M: { label: "Molar (M)", toBase: v => v, fromBase: v => v },
      mM: { label: "Millimolar (mM)", toBase: v => v * 1e-3, fromBase: v => v * 1e3 },
      uM: { label: "Micromolar (µM)", toBase: v => v * 1e-6, fromBase: v => v * 1e6 },
      nM: { label: "Nanomolar (nM)", toBase: v => v * 1e-9, fromBase: v => v * 1e9 },
      pM: { label: "Picomolar (pM)", toBase: v => v * 1e-12, fromBase: v => v * 1e12 },
    },
  },
  mass: {
    name: "Mass",
    icon: "⚖️",
    baseUnit: "g",
    units: {
      kg: { label: "Kilogram (kg)", toBase: v => v * 1e3, fromBase: v => v * 1e-3 },
      g: { label: "Gram (g)", toBase: v => v, fromBase: v => v },
      mg: { label: "Milligram (mg)", toBase: v => v * 1e-3, fromBase: v => v * 1e3 },
      ug: { label: "Microgram (µg)", toBase: v => v * 1e-6, fromBase: v => v * 1e6 },
      ng: { label: "Nanogram (ng)", toBase: v => v * 1e-9, fromBase: v => v * 1e9 },
      pg: { label: "Picogram (pg)", toBase: v => v * 1e-12, fromBase: v => v * 1e12 },
      lb: { label: "Pound (lb)", toBase: v => v * 453.592, fromBase: v => v / 453.592 },
      oz: { label: "Ounce (oz)", toBase: v => v * 28.3495, fromBase: v => v / 28.3495 },
    },
  },
  volume: {
    name: "Volume",
    icon: "🧫",
    baseUnit: "L",
    units: {
      L: { label: "Liter (L)", toBase: v => v, fromBase: v => v },
      mL: { label: "Milliliter (mL)", toBase: v => v * 1e-3, fromBase: v => v * 1e3 },
      uL: { label: "Microliter (µL)", toBase: v => v * 1e-6, fromBase: v => v * 1e6 },
      nL: { label: "Nanoliter (nL)", toBase: v => v * 1e-9, fromBase: v => v * 1e9 },
      gallon: { label: "Gallon (US)", toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
      floz: { label: "Fluid Ounce (US)", toBase: v => v * 0.0295735, fromBase: v => v / 0.0295735 },
    },
  },
  length: {
    name: "Length",
    icon: "📏",
    baseUnit: "m",
    units: {
      km: { label: "Kilometer (km)", toBase: v => v * 1e3, fromBase: v => v * 1e-3 },
      m: { label: "Meter (m)", toBase: v => v, fromBase: v => v },
      cm: { label: "Centimeter (cm)", toBase: v => v * 1e-2, fromBase: v => v * 1e2 },
      mm: { label: "Millimeter (mm)", toBase: v => v * 1e-3, fromBase: v => v * 1e3 },
      um: { label: "Micrometer (µm)", toBase: v => v * 1e-6, fromBase: v => v * 1e6 },
      nm: { label: "Nanometer (nm)", toBase: v => v * 1e-9, fromBase: v => v * 1e9 },
      A: { label: "Ångström (Å)", toBase: v => v * 1e-10, fromBase: v => v * 1e10 },
      in: { label: "Inch (in)", toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
      ft: { label: "Foot (ft)", toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
    },
  },
  pressure: {
    name: "Pressure",
    icon: "🔬",
    baseUnit: "Pa",
    units: {
      Pa: { label: "Pascal (Pa)", toBase: v => v, fromBase: v => v },
      kPa: { label: "Kilopascal (kPa)", toBase: v => v * 1e3, fromBase: v => v * 1e-3 },
      atm: { label: "Atmosphere (atm)", toBase: v => v * 101325, fromBase: v => v / 101325 },
      bar: { label: "Bar", toBase: v => v * 1e5, fromBase: v => v * 1e-5 },
      mmHg: { label: "mmHg (Torr)", toBase: v => v * 133.322, fromBase: v => v / 133.322 },
      psi: { label: "PSI", toBase: v => v * 6894.76, fromBase: v => v / 6894.76 },
    },
  },
  energy: {
    name: "Energy",
    icon: "⚡",
    baseUnit: "J",
    units: {
      J: { label: "Joule (J)", toBase: v => v, fromBase: v => v },
      kJ: { label: "Kilojoule (kJ)", toBase: v => v * 1e3, fromBase: v => v * 1e-3 },
      cal: { label: "Calorie (cal)", toBase: v => v * 4.184, fromBase: v => v / 4.184 },
      kcal: { label: "Kilocalorie (kcal)", toBase: v => v * 4184, fromBase: v => v / 4184 },
      eV: { label: "Electron volt (eV)", toBase: v => v * 1.602e-19, fromBase: v => v / 1.602e-19 },
      kWh: { label: "Kilowatt-hour (kWh)", toBase: v => v * 3.6e6, fromBase: v => v / 3.6e6 },
    },
  },
};

// ── Bio-specific converters ──
interface BioConverter {
  name: string;
  desc: string;
  inputs: { id: string; label: string; placeholder: string; suffix?: string }[];
  compute: (vals: Record<string, number>) => { label: string; value: string }[];
}

const BIO_CONVERTERS: BioConverter[] = [
  {
    name: "OD600 → Cell Count",
    desc: "Estimate cell density from optical density at 600nm",
    inputs: [
      { id: "od", label: "OD600 reading", placeholder: "e.g. 0.5" },
      { id: "factor", label: "Cells per OD unit", placeholder: "8e8", suffix: "cells/mL/OD" },
    ],
    compute: (v) => {
      const od = v.od || 0;
      const factor = v.factor || 8e8;
      const cells = od * factor;
      return [
        { label: "Cells/mL", value: cells.toExponential(2) },
        { label: "Cells/L", value: (cells * 1000).toExponential(2) },
      ];
    },
  },
  {
    name: "ng/µL → nM (DNA)",
    desc: "Convert DNA concentration to nanomolar using fragment size",
    inputs: [
      { id: "conc", label: "Concentration", placeholder: "e.g. 50", suffix: "ng/µL" },
      { id: "bp", label: "Fragment size", placeholder: "e.g. 5000", suffix: "bp" },
    ],
    compute: (v) => {
      const conc = v.conc || 0;
      const bp = v.bp || 0;
      if (!conc || !bp) return [];
      // MW of dsDNA = bp × 660 g/mol
      const mw = bp * 660;
      const concGperL = conc * 1e-9 / 1e-6; // ng/µL to g/L
      const molar = concGperL / mw;
      return [
        { label: "Molarity", value: (molar * 1e9).toFixed(2) + " nM" },
        { label: "Also", value: (molar * 1e12).toFixed(2) + " pM" },
        { label: "MW (dsDNA)", value: mw.toLocaleString() + " g/mol" },
      ];
    },
  },
  {
    name: "µg/mL → Molarity",
    desc: "Convert mass concentration to molar using molecular weight",
    inputs: [
      { id: "conc", label: "Concentration", placeholder: "e.g. 100", suffix: "µg/mL" },
      { id: "mw", label: "Molecular weight", placeholder: "e.g. 150000", suffix: "g/mol" },
    ],
    compute: (v) => {
      const conc = v.conc || 0;
      const mw = v.mw || 0;
      if (!conc || !mw) return [];
      const gPerL = conc * 1e-6 / 1e-3; // µg/mL to g/L
      const molar = gPerL / mw;
      return [
        { label: "Molarity", value: molar >= 1e-3 ? (molar * 1e3).toFixed(4) + " mM" : (molar * 1e6).toFixed(4) + " µM" },
        { label: "Also", value: (molar * 1e9).toFixed(2) + " nM" },
      ];
    },
  },
  {
    name: "Absorbance → Concentration",
    desc: "Beer-Lambert: A = εcl. Solve for concentration.",
    inputs: [
      { id: "abs", label: "Absorbance (A)", placeholder: "e.g. 0.35" },
      { id: "epsilon", label: "Molar absorptivity (ε)", placeholder: "e.g. 6220", suffix: "M⁻¹cm⁻¹" },
      { id: "path", label: "Path length", placeholder: "1", suffix: "cm" },
    ],
    compute: (v) => {
      const abs = v.abs || 0;
      const epsilon = v.epsilon || 0;
      const path = v.path || 1;
      if (!abs || !epsilon) return [];
      const conc = abs / (epsilon * path);
      return [
        { label: "Concentration", value: conc >= 1e-3 ? (conc * 1e3).toFixed(4) + " mM" : (conc * 1e6).toFixed(4) + " µM" },
        { label: "Also", value: conc.toExponential(4) + " M" },
      ];
    },
  },
];

type Tab = "standard" | "bio";

// ── Formatting ──
function formatResult(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-4) return n.toExponential(6);
  // Show up to 6 significant figures
  return parseFloat(n.toPrecision(7)).toString();
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Scientific Unit Converter - BioSketch",
  description: "Convert between scientific units: concentration, temperature, pressure, mass, volume, length, energy. Includes OD600 to cell count, ng/µL to nM, and Beer-Lambert calculations.",
  url: "https://biosketch.art/unit-converter",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const UnitConverter = () => {
  useTrackToolVisit("unit-converter");
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("standard");
  const [category, setCategory] = useState("concentration");
  const [fromUnit, setFromUnit] = useState("mM");
  const [toUnit, setToUnit] = useState("uM");
  const [inputVal, setInputVal] = useState("1");
  const [copied, setCopied] = useState(false);

  // Bio converter state
  const [bioIdx, setBioIdx] = useState(0);
  const [bioInputs, setBioInputs] = useState<Record<string, string>>({});

  const cat = CATEGORIES[category];
  const result = useMemo(() => {
    const n = parseFloat(inputVal);
    if (isNaN(n) || !cat) return null;
    const base = cat.units[fromUnit]?.toBase(n);
    if (base === undefined || base === null) return null;
    return cat.units[toUnit]?.fromBase(base) ?? null;
  }, [inputVal, fromUnit, toUnit, cat]);

  const swapUnits = () => {
    const tmp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(tmp);
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    const units = Object.keys(CATEGORIES[newCat].units);
    setFromUnit(units[0]);
    setToUnit(units[1] || units[0]);
    setInputVal("1");
  };

  const copyResult = () => {
    if (result === null) return;
    navigator.clipboard.writeText(formatResult(result));
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Bio converter
  const bioConv = BIO_CONVERTERS[bioIdx];
  const bioResults = useMemo(() => {
    const vals: Record<string, number> = {};
    bioConv.inputs.forEach(inp => { vals[inp.id] = parseFloat(bioInputs[inp.id] || "0") || 0; });
    return bioConv.compute(vals);
  }, [bioInputs, bioIdx, bioConv]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Scientific Unit Converter | BioSketch"
        description="Convert between scientific units: concentration (M, mM, µM, nM), temperature (°C, °F, K), pressure (atm, Pa, mmHg), mass, volume, length, and energy. Includes OD600 to cell count, ng/µL to nM DNA, µg/mL to molarity, and Beer-Lambert calculator. Free, no signup."
        canonical="https://biosketch.art/unit-converter"
        keywords="scientific unit converter, concentration converter, molarity converter, temperature converter, OD600 cell count, ng/uL to nM, Beer-Lambert calculator, lab unit converter, chemistry unit converter, pressure converter, scientific calculator"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-md">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">
            Scientific Unit Converter
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Standard unit conversions and biology-specific calculators.
          </p>
          <ToolRating toolId="unit-converter" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/40 mb-6">
          {[
            { id: "standard" as Tab, label: "Unit Converter" },
            { id: "bio" as Tab, label: "Bio Calculators" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "standard" && (
          <div className="space-y-5">
            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CATEGORIES).map(([k, c]) => (
                <button key={k} onClick={() => handleCategoryChange(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    category === k ? "bg-foreground text-background" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>

            {/* From */}
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <div className="flex gap-2 mt-1">
                <Input type="text" inputMode="decimal" className="h-10 text-sm font-mono flex-1"
                  value={inputVal} onChange={e => setInputVal(e.target.value)} />
                <Select value={fromUnit} onValueChange={setFromUnit}>
                  <SelectTrigger className="h-10 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(cat.units).map(([k, u]) => (
                      <SelectItem key={k} value={k} className="text-xs">{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Swap button */}
            <div className="flex justify-center">
              <button onClick={swapUnits}
                className="p-2 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground rotate-90" />
              </button>
            </div>

            {/* To */}
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <div className="flex gap-2 mt-1">
                <div className="h-10 flex-1 flex items-center px-3 rounded-lg bg-primary/5 border border-primary/20 font-mono text-sm font-semibold text-primary">
                  {result !== null ? formatResult(result) : "—"}
                </div>
                <Select value={toUnit} onValueChange={setToUnit}>
                  <SelectTrigger className="h-10 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(cat.units).map(([k, u]) => (
                      <SelectItem key={k} value={k} className="text-xs">{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Copy */}
            {result !== null && (
              <button onClick={copyResult}
                className="flex items-center gap-1.5 mx-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy result"}
              </button>
            )}

            {/* All conversions table */}
            {result !== null && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-2">All {cat.name.toLowerCase()} units</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(cat.units).map(([k, u]) => {
                        const n = parseFloat(inputVal);
                        if (isNaN(n)) return null;
                        const base = cat.units[fromUnit].toBase(n);
                        const converted = u.fromBase(base);
                        return (
                          <tr key={k} className={`border-t border-border/30 ${k === toUnit ? "bg-primary/5" : ""}`}>
                            <td className="px-3 py-1.5 text-muted-foreground">{u.label}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-medium text-foreground">
                              {formatResult(converted)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "bio" && (
          <div className="space-y-5">
            {/* Bio converter selector */}
            <div className="flex flex-wrap gap-1.5">
              {BIO_CONVERTERS.map((bc, i) => (
                <button key={i} onClick={() => { setBioIdx(i); setBioInputs({}); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    bioIdx === i ? "bg-foreground text-background" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}>
                  {bc.name}
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">{bioConv.desc}</p>

            {/* Inputs */}
            <div className="space-y-3">
              {bioConv.inputs.map(inp => (
                <div key={inp.id}>
                  <Label className="text-xs text-muted-foreground">{inp.label}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="text" inputMode="decimal" className="h-9 text-sm font-mono flex-1"
                      placeholder={inp.placeholder}
                      value={bioInputs[inp.id] || ""}
                      onChange={e => setBioInputs({ ...bioInputs, [inp.id]: e.target.value })} />
                    {inp.suffix && (
                      <span className="flex items-center text-[10px] text-muted-foreground px-2 bg-muted/30 rounded-lg border border-border/30">
                        {inp.suffix}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Results */}
            {bioResults.length > 0 && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                {bioResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{r.label}</span>
                    <span className="text-sm font-semibold font-mono text-primary">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
          <p><strong>Standard conversions</strong> — 7 categories with 40+ units. Select a category, enter a value, and see instant conversions across all units in that category.</p>
          <p><strong>OD600</strong> — E. coli: ~8×10⁸ cells/mL per OD unit (varies by species and growth phase).</p>
          <p><strong>DNA ng/µL → nM</strong> — Uses MW = bp × 660 g/mol for double-stranded DNA.</p>
          <p><strong>Beer-Lambert</strong> — A = εcl. Common ε values: NADH at 340nm = 6,220 M⁻¹cm⁻¹; BSA at 280nm = 43,824 M⁻¹cm⁻¹.</p>
        </div>
      </div>
    </div>
  );
};

export default UnitConverter;
