import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// ── Statistical Methods ──

// Wilson score interval (recommended for proportions)
function wilsonCI(x: number, n: number, z: number): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 };
  const p = x / n;
  const denom = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

// Clopper-Pearson exact interval (conservative)
function clopperPearsonCI(x: number, n: number, alpha: number): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 };
  // Use beta distribution quantiles via approximation
  const lower = x === 0 ? 0 : betaInv(alpha / 2, x, n - x + 1);
  const upper = x === n ? 1 : betaInv(1 - alpha / 2, x + 1, n - x);
  return { lower, upper };
}

// Wald (normal approximation) interval
function waldCI(x: number, n: number, z: number): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 };
  const p = x / n;
  const se = Math.sqrt(p * (1 - p) / n);
  return {
    lower: Math.max(0, p - z * se),
    upper: Math.min(1, p + z * se),
  };
}

// Agresti-Coull interval
function agrestiCoullCI(x: number, n: number, z: number): { lower: number; upper: number } {
  const nTilde = n + z * z;
  const pTilde = (x + z * z / 2) / nTilde;
  const se = Math.sqrt(pTilde * (1 - pTilde) / nTilde);
  return {
    lower: Math.max(0, pTilde - z * se),
    upper: Math.min(1, pTilde + z * se),
  };
}

// Jeffreys interval (Bayesian)
function jeffreysCI(x: number, n: number, alpha: number): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 0 };
  const lower = x === 0 ? 0 : betaInv(alpha / 2, x + 0.5, n - x + 0.5);
  const upper = x === n ? 1 : betaInv(1 - alpha / 2, x + 0.5, n - x + 0.5);
  return { lower, upper };
}

// Poisson CI for counts
function poissonCI(count: number, z: number): { lower: number; upper: number } {
  if (count === 0) return { lower: 0, upper: -Math.log(0.5) }; // approximate
  const lower = Math.max(0, count - z * Math.sqrt(count));
  const upper = count + z * Math.sqrt(count);
  return { lower, upper };
}

// Beta distribution inverse CDF approximation (Newton's method on regularized incomplete beta)
function betaInv(p: number, a: number, b: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  // Initial guess
  let x = a / (a + b);
  for (let i = 0; i < 100; i++) {
    const fx = betaCDF(x, a, b) - p;
    const dx = betaPDF(x, a, b);
    if (Math.abs(dx) < 1e-15) break;
    const step = fx / dx;
    x = Math.max(1e-10, Math.min(1 - 1e-10, x - step));
    if (Math.abs(step) < 1e-12) break;
  }
  return x;
}

function betaPDF(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b));
}

function betaCDF(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return regularizedBeta(x, a, b);
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(x: number): number {
  // Stirling-Lanczos approximation
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function regularizedBeta(x: number, a: number, b: number): number {
  // Continued fraction expansion
  if (x < (a + 1) / (a + b + 2)) {
    return betaCF(x, a, b) * Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b)) / a;
  }
  return 1 - betaCF(1 - x, b, a) * Math.exp(b * Math.log(1 - x) + a * Math.log(x) - logBeta(a, b)) / b;
}

function betaCF(x: number, a: number, b: number): number {
  const maxIter = 200;
  const eps = 1e-14;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

// Z-values for common confidence levels
const Z_VALUES: Record<string, { z: number; alpha: number }> = {
  "90": { z: 1.6449, alpha: 0.10 },
  "95": { z: 1.96, alpha: 0.05 },
  "99": { z: 2.5758, alpha: 0.01 },
  "99.9": { z: 3.2905, alpha: 0.001 },
};

type CIMethod = "wilson" | "clopper-pearson" | "wald" | "agresti-coull" | "jeffreys";
type InputMode = "proportion" | "count";

const METHODS: { id: CIMethod; name: string; desc: string }[] = [
  { id: "wilson", name: "Wilson Score", desc: "Recommended. Good coverage even for small n or extreme p." },
  { id: "clopper-pearson", name: "Clopper-Pearson (Exact)", desc: "Conservative. Guarantees at least stated coverage." },
  { id: "wald", name: "Wald (Normal)", desc: "Simple but poor for small n or p near 0/1." },
  { id: "agresti-coull", name: "Agresti-Coull", desc: "Simple adjustment to Wald. Good for moderate n." },
  { id: "jeffreys", name: "Jeffreys (Bayesian)", desc: "Bayesian with non-informative prior. Often best coverage." },
];

// ── Component ──
const CIProportionCalculator = () => {
  useTrackToolVisit("ci-proportion");
  const navigate = useNavigate();

  const [inputMode, setInputMode] = useState<InputMode>("proportion");
  const [numerator, setNumerator] = useState("45");
  const [denominator, setDenominator] = useState("100");
  const [count, setCount] = useState("15");
  const [confLevel, setConfLevel] = useState("95");
  const [method, setMethod] = useState<CIMethod>("wilson");

  const results = useMemo(() => {
    const { z, alpha } = Z_VALUES[confLevel] || Z_VALUES["95"];

    if (inputMode === "proportion") {
      const x = parseInt(numerator) || 0;
      const n = parseInt(denominator) || 0;
      if (n <= 0 || x < 0 || x > n) return null;

      const p = x / n;
      const se = Math.sqrt(p * (1 - p) / n);

      const methods: Record<CIMethod, { lower: number; upper: number }> = {
        wilson: wilsonCI(x, n, z),
        "clopper-pearson": clopperPearsonCI(x, n, alpha),
        wald: waldCI(x, n, z),
        "agresti-coull": agrestiCoullCI(x, n, z),
        jeffreys: jeffreysCI(x, n, alpha),
      };

      const selected = methods[method];
      return {
        proportion: p,
        se,
        lower: selected.lower,
        upper: selected.upper,
        marginOfError: (selected.upper - selected.lower) / 2,
        n,
        x,
        allMethods: methods,
      };
    } else {
      const c = parseInt(count) || 0;
      if (c < 0) return null;
      const ci = poissonCI(c, z);
      return {
        proportion: c,
        se: Math.sqrt(c),
        lower: ci.lower,
        upper: ci.upper,
        marginOfError: (ci.upper - ci.lower) / 2,
        n: 0,
        x: c,
        allMethods: null,
      };
    }
  }, [numerator, denominator, count, confLevel, method, inputMode]);

  const formatPct = (v: number) => (v * 100).toFixed(2) + "%";
  const formatNum = (v: number) => v.toFixed(4);

  return (
    <>
      <SEOHead
        title="Free Confidence Interval of Proportion Calculator | BioSketch"
        description="Calculate confidence intervals for proportions and counts online. Wilson, Clopper-Pearson, Wald, Agresti-Coull, and Jeffreys methods. Free, no signup."
        keywords="confidence interval calculator, proportion CI, Wilson score interval, Clopper-Pearson, binomial confidence interval, exact CI, statistics tool"
        canonical="https://biosketch.art/ci-proportion"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calculator className="h-6 w-6 text-muted-foreground" />
                Confidence Interval of a Proportion
              </h1>
              <p className="text-sm text-muted-foreground">Wilson, Clopper-Pearson, Wald, Agresti-Coull, and Jeffreys methods</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input */}
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="space-y-2">
                  <Label>Input Type</Label>
                  <Select value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proportion">Proportion (x successes out of n trials)</SelectItem>
                      <SelectItem value="count">Count (Poisson rate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inputMode === "proportion" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Successes (x)</Label>
                      <Input type="number" min="0" value={numerator} onChange={(e) => setNumerator(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Total (n)</Label>
                      <Input type="number" min="1" value={denominator} onChange={(e) => setDenominator(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Observed Count</Label>
                    <Input type="number" min="0" value={count} onChange={(e) => setCount(e.target.value)} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Confidence Level</Label>
                  <Select value={confLevel} onValueChange={setConfLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90%</SelectItem>
                      <SelectItem value="95">95%</SelectItem>
                      <SelectItem value="99">99%</SelectItem>
                      <SelectItem value="99.9">99.9%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inputMode === "proportion" && (
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as CIMethod)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {METHODS.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <div>
                              <span className="font-medium">{m.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{m.desc}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Method descriptions */}
              {inputMode === "proportion" && (
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <h3 className="text-sm font-semibold mb-3">About the Methods</h3>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {METHODS.map(m => (
                      <div key={m.id} className={m.id === method ? "font-medium text-foreground" : ""}>
                        <strong>{m.name}:</strong> {m.desc}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            <div className="space-y-5">
              {results ? (
                <>
                  {/* Main result */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Result</h3>

                    {inputMode === "proportion" ? (
                      <div className="space-y-4">
                        <div className="text-center py-4 bg-muted/30 rounded-lg">
                          <p className="text-3xl font-bold">{formatPct(results.proportion)}</p>
                          <p className="text-sm text-muted-foreground mt-1">{results.x} / {results.n}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="p-3 bg-muted/20 rounded-lg">
                            <p className="text-lg font-bold">{formatPct(results.lower)}</p>
                            <p className="text-xs text-muted-foreground">Lower {confLevel}% CI</p>
                          </div>
                          <div className="p-3 bg-muted/20 rounded-lg">
                            <p className="text-lg font-bold">{formatPct(results.upper)}</p>
                            <p className="text-xs text-muted-foreground">Upper {confLevel}% CI</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Standard Error:</span>
                            <span className="font-medium ml-2">{formatNum(results.se)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Margin of Error:</span>
                            <span className="font-medium ml-2">±{formatPct(results.marginOfError)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center py-4 bg-muted/30 rounded-lg">
                          <p className="text-3xl font-bold">{results.x}</p>
                          <p className="text-sm text-muted-foreground mt-1">Observed Count</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="p-3 bg-muted/20 rounded-lg">
                            <p className="text-lg font-bold">{results.lower.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Lower {confLevel}% CI</p>
                          </div>
                          <div className="p-3 bg-muted/20 rounded-lg">
                            <p className="text-lg font-bold">{results.upper.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Upper {confLevel}% CI</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* All methods comparison */}
                  {inputMode === "proportion" && results.allMethods && (
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Methods Comparison</h3>
                      <div className="overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Method</th>
                              <th className="text-right px-3 py-2 font-medium">Lower</th>
                              <th className="text-right px-3 py-2 font-medium">Upper</th>
                              <th className="text-right px-3 py-2 font-medium">Width</th>
                            </tr>
                          </thead>
                          <tbody>
                            {METHODS.map(m => {
                              const ci = results.allMethods![m.id];
                              const isActive = m.id === method;
                              return (
                                <tr key={m.id} className={`border-t ${isActive ? "bg-primary/5 font-semibold" : ""}`}>
                                  <td className="px-3 py-2">{m.name}{isActive ? " ✓" : ""}</td>
                                  <td className="text-right px-3 py-2">{formatPct(ci.lower)}</td>
                                  <td className="text-right px-3 py-2">{formatPct(ci.upper)}</td>
                                  <td className="text-right px-3 py-2">{formatPct(ci.upper - ci.lower)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Interpretation */}
                  <div className="rounded-xl border border-border bg-muted/30 p-5">
                    <h3 className="text-sm font-semibold mb-2">Interpretation</h3>
                    {inputMode === "proportion" ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        We are {confLevel}% confident that the true population proportion lies between{" "}
                        <strong className="text-foreground">{formatPct(results.lower)}</strong> and{" "}
                        <strong className="text-foreground">{formatPct(results.upper)}</strong> ({METHODS.find(m => m.id === method)?.name} method).
                        The observed proportion is {formatPct(results.proportion)} based on {results.x} successes out of {results.n} trials.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        We are {confLevel}% confident that the true rate lies between{" "}
                        <strong className="text-foreground">{results.lower.toFixed(2)}</strong> and{" "}
                        <strong className="text-foreground">{results.upper.toFixed(2)}</strong> (Poisson approximation).
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
                  <p className="text-sm text-muted-foreground">Enter valid values to see results</p>
                </div>
              )}

              <ToolRating toolId="ci-proportion" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CIProportionCalculator;
