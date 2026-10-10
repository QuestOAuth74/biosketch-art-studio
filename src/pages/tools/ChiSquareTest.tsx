import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Grid3X3, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

// ── Chi-square distribution CDF (regularized gamma) ──
function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// Lower regularized incomplete gamma function P(a, x)
function gammaCDF(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Series expansion
    let sum = 1 / a, term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-14 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  } else {
    // Continued fraction
    let f = 1e-30, c = 1e-30, d = 0;
    for (let i = 1; i < 200; i++) {
      const an = i % 2 === 1 ? ((i + 1) / 2 - a) : (i / 2);
      const bn = i % 2 === 1 ? 1 : x;
      d = bn + an * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
      c = bn + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
      f *= d * c;
    }
    // This gives Q(a,x) = 1 - P(a,x); we need a different approach
    // Use the complement
    return 1 - f * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
}

function chiSquarePValue(chiSq: number, df: number): number {
  if (df <= 0 || chiSq <= 0) return 1;
  return 1 - gammaCDF(df / 2, chiSq / 2);
}

// ── Test Modes ──
type TestMode = "goodness" | "contingency";

// ── Examples ──
const EXAMPLES: Record<string, { label: string; mode: TestMode; data: string; expected?: string }> = {
  dice: {
    label: "Fair Dice (Goodness of Fit)",
    mode: "goodness",
    data: "18\t22\t16\t21\t14\t19",
    expected: "18.33\t18.33\t18.33\t18.33\t18.33\t18.33",
  },
  genetics: {
    label: "Mendelian Ratio 9:3:3:1",
    mode: "goodness",
    data: "315\t108\t101\t32",
    expected: "312.75\t104.25\t104.25\t34.75",
  },
  survey: {
    label: "Treatment vs Outcome (2×2)",
    mode: "contingency",
    data: "45\t15\n25\t35",
  },
  clinical: {
    label: "Drug Response (3×3)",
    mode: "contingency",
    data: "50\t30\t20\n35\t40\t25\n15\t30\t55",
  },
  smoking: {
    label: "Smoking & Disease (2×3)",
    mode: "contingency",
    data: "120\t80\t30\n90\t60\t50",
  },
};

// ── Component ──
const ChiSquareTest = () => {
  useTrackToolVisit("chi-square");
  const navigate = useNavigate();

  const [mode, setMode] = useState<TestMode>("contingency");
  const [observedInput, setObservedInput] = useState(EXAMPLES.survey.data);
  const [expectedInput, setExpectedInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      // Convert CSV to tab-separated for the textarea
      const converted = text.trim().split("\n").map(line =>
        line.split(",").map(v => v.trim()).join("\t")
      ).join("\n");
      setObservedInput(converted);
      toast.success("CSV loaded");
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const [yatesCorrection, setYatesCorrection] = useState(false);
  const [rowLabels, setRowLabels] = useState("");
  const [colLabels, setColLabels] = useState("");

  const results = useMemo(() => {
    if (mode === "goodness") {
      // Goodness of fit: single row of observed vs expected
      const obs = observedInput.split(/[\t,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      if (obs.length < 2) return null;

      let exp: number[];
      if (expectedInput.trim()) {
        exp = expectedInput.split(/[\t,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        if (exp.length !== obs.length) return null;
      } else {
        // Equal expected
        const mean = obs.reduce((s, v) => s + v, 0) / obs.length;
        exp = obs.map(() => mean);
      }

      const n = obs.reduce((s, v) => s + v, 0);
      let chiSq = 0;
      const cells = obs.map((o, i) => {
        const e = exp[i];
        const diff = o - e;
        const contrib = e > 0 ? (diff * diff) / e : 0;
        chiSq += contrib;
        return { observed: o, expected: e, diff, contrib };
      });

      const df = obs.length - 1;
      const pValue = chiSquarePValue(chiSq, df);

      return { mode: "goodness" as const, chiSq, df, pValue, n, cells, rows: 0, cols: 0, table: null, rowTotals: null, colTotals: null };
    }

    // Contingency table
    const rows = observedInput.trim().split("\n").map(row =>
      row.split(/[\t,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    ).filter(r => r.length > 0);

    if (rows.length < 2) return null;
    const nCols = Math.max(...rows.map(r => r.length));
    // Pad rows
    const table = rows.map(r => { while (r.length < nCols) r.push(0); return r; });
    const nRows = table.length;

    const rowTotals = table.map(r => r.reduce((s, v) => s + v, 0));
    const colTotals: number[] = [];
    for (let j = 0; j < nCols; j++) {
      colTotals.push(table.reduce((s, r) => s + r[j], 0));
    }
    const n = rowTotals.reduce((s, v) => s + v, 0);

    if (n === 0) return null;

    // Expected frequencies
    const expected = table.map((r, i) => r.map((_, j) => (rowTotals[i] * colTotals[j]) / n));

    // Chi-square
    let chiSq = 0;
    const cellContribs = table.map((r, i) => r.map((o, j) => {
      const e = expected[i][j];
      const diff = yatesCorrection && nRows === 2 && nCols === 2
        ? Math.max(0, Math.abs(o - e) - 0.5)
        : Math.abs(o - e);
      const contrib = e > 0 ? (diff * diff) / e : 0;
      chiSq += contrib;
      return { observed: o, expected: e, contrib };
    }));

    const df = (nRows - 1) * (nCols - 1);
    const pValue = chiSquarePValue(chiSq, df);

    // Cramér's V
    const k = Math.min(nRows, nCols);
    const cramersV = n > 0 && k > 1 ? Math.sqrt(chiSq / (n * (k - 1))) : 0;

    return {
      mode: "contingency" as const, chiSq, df, pValue, n, cells: null,
      rows: nRows, cols: nCols, table: cellContribs, rowTotals, colTotals,
      expected, cramersV, yates: yatesCorrection && nRows === 2 && nCols === 2,
    };
  }, [observedInput, expectedInput, mode, yatesCorrection]);

  const loadExample = (key: string) => {
    const ex = EXAMPLES[key];
    setMode(ex.mode);
    setObservedInput(ex.data);
    setExpectedInput(ex.expected || "");
    toast.success(`Loaded: ${ex.label}`);
  };

  const sigLabel = (p: number) => p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "ns";

  const rLabels = rowLabels ? rowLabels.split(/[,\t]+/).map(s => s.trim()) : [];
  const cLabels = colLabels ? colLabels.split(/[,\t]+/).map(s => s.trim()) : [];

  return (
    <>
      <SEOHead
        title="Free Chi-Square Test Calculator | BioSketch"
        description="Chi-square goodness of fit and test of independence online. Contingency tables, expected frequencies, Yates correction, Cramér's V. Free, no signup."
        keywords="chi-square test, chi-square calculator, goodness of fit, contingency table, test of independence, Yates correction, Cramér's V, statistics"
        canonical="https://biosketch.art/chi-square"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Grid3X3 className="h-6 w-6 text-muted-foreground" />
                Chi-Square Test
              </h1>
              <p className="text-sm text-muted-foreground">Goodness of fit and test of independence for contingency tables</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="space-y-2">
                  <Label>Test Type</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as TestMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contingency">Test of Independence (contingency table)</SelectItem>
                      <SelectItem value="goodness">Goodness of Fit (observed vs expected)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mode === "contingency" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Contingency Table (rows = groups, columns = categories, tab/comma separated)</Label>
                      <Textarea value={observedInput} onChange={(e) => setObservedInput(e.target.value)} rows={4} className="font-mono text-xs" placeholder="45,15&#10;25,35" />
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3 w-3 mr-1" /> Import CSV
                      </Button>
                      <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileUpload} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Row labels (optional)</Label>
                        <Input value={rowLabels} onChange={(e) => setRowLabels(e.target.value)} placeholder="Treatment, Control" className="text-xs h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Column labels (optional)</Label>
                        <Input value={colLabels} onChange={(e) => setColLabels(e.target.value)} placeholder="Yes, No" className="text-xs h-8" />
                      </div>
                    </div>
                    {results?.mode === "contingency" && results.rows === 2 && results.cols === 2 && (
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Yates' Continuity Correction</Label>
                        <Switch checked={yatesCorrection} onCheckedChange={setYatesCorrection} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Observed Frequencies (tab/comma separated)</Label>
                      <Input value={observedInput} onChange={(e) => setObservedInput(e.target.value)} className="font-mono text-xs" placeholder="18, 22, 16, 21, 14, 19" />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Frequencies (leave blank for equal)</Label>
                      <Input value={expectedInput} onChange={(e) => setExpectedInput(e.target.value)} className="font-mono text-xs" placeholder="18.33, 18.33, 18.33, ..." />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Examples</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(EXAMPLES).map(([key, ex]) => (
                    <Button key={key} variant="outline" size="sm" className="text-xs h-7" onClick={() => loadExample(key)}>
                      {ex.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-4">
              {results ? (
                <>
                  {/* Main stats */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Results</h3>
                    <div className="grid grid-cols-3 gap-4 text-center mb-4">
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <p className="text-2xl font-bold">{results.chiSq.toFixed(4)}</p>
                        <p className="text-[10px] text-muted-foreground">χ² statistic</p>
                      </div>
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <p className="text-2xl font-bold">{results.df}</p>
                        <p className="text-[10px] text-muted-foreground">df</p>
                      </div>
                      <div className={`p-3 rounded-lg ${results.pValue < 0.05 ? "bg-green-50 dark:bg-green-950/30" : "bg-muted/20"}`}>
                        <p className="text-2xl font-bold">{results.pValue < 0.0001 ? "<0.0001" : results.pValue.toFixed(4)}</p>
                        <p className="text-[10px] text-muted-foreground">p-value {sigLabel(results.pValue)}</p>
                      </div>
                    </div>
                    {results.mode === "contingency" && "cramersV" in results && (
                      <div className="flex justify-between text-sm border-t pt-3">
                        <span className="text-muted-foreground">Cramér's V (effect size):</span>
                        <span className="font-semibold">{(results as any).cramersV.toFixed(4)}</span>
                      </div>
                    )}
                    {results.mode === "contingency" && (results as any).yates && (
                      <p className="text-[10px] text-muted-foreground mt-2">Yates' continuity correction applied</p>
                    )}
                    <div className="text-sm mt-2">
                      <span className="text-muted-foreground">N = </span><span className="font-medium">{results.n}</span>
                    </div>
                  </div>

                  {/* Contingency table with expected */}
                  {results.mode === "contingency" && results.table && (
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Observed (Expected) — Contribution</h3>
                      <div className="overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2"></th>
                              {Array.from({ length: results.cols }).map((_, j) => (
                                <th key={j} className="px-3 py-2 text-center font-medium">{cLabels[j] || `Col ${j + 1}`}</th>
                              ))}
                              <th className="px-3 py-2 text-center font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.table.map((row: any[], i: number) => (
                              <tr key={i} className="border-t">
                                <td className="px-3 py-2 font-medium">{rLabels[i] || `Row ${i + 1}`}</td>
                                {row.map((cell: any, j: number) => (
                                  <td key={j} className="px-3 py-2 text-center">
                                    <span className="font-semibold">{cell.observed}</span>
                                    <br />
                                    <span className="text-muted-foreground">({cell.expected.toFixed(1)})</span>
                                    <br />
                                    <span className="text-[9px] text-muted-foreground">{cell.contrib.toFixed(2)}</span>
                                  </td>
                                ))}
                                <td className="px-3 py-2 text-center font-medium">{results.rowTotals![i]}</td>
                              </tr>
                            ))}
                            <tr className="border-t bg-muted/30">
                              <td className="px-3 py-2 font-medium">Total</td>
                              {results.colTotals!.map((t: number, j: number) => (
                                <td key={j} className="px-3 py-2 text-center font-medium">{t}</td>
                              ))}
                              <td className="px-3 py-2 text-center font-bold">{results.n}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Goodness of fit table */}
                  {results.mode === "goodness" && results.cells && (
                    <div className="rounded-xl border border-border bg-card p-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Category Breakdown</h3>
                      <div className="overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Category</th>
                              <th className="px-3 py-2 text-right font-medium">Observed</th>
                              <th className="px-3 py-2 text-right font-medium">Expected</th>
                              <th className="px-3 py-2 text-right font-medium">O − E</th>
                              <th className="px-3 py-2 text-right font-medium">(O−E)²/E</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.cells.map((cell, i) => (
                              <tr key={i} className="border-t">
                                <td className="px-3 py-2 font-medium">{i + 1}</td>
                                <td className="text-right px-3 py-2">{cell.observed}</td>
                                <td className="text-right px-3 py-2">{cell.expected.toFixed(2)}</td>
                                <td className="text-right px-3 py-2">{cell.diff.toFixed(2)}</td>
                                <td className="text-right px-3 py-2 font-semibold">{cell.contrib.toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Interpretation */}
                  <div className="rounded-xl border border-border bg-muted/30 p-5">
                    <h3 className="text-sm font-semibold mb-2">Interpretation</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {results.mode === "goodness" ? (
                        <>
                          χ²({results.df}) = {results.chiSq.toFixed(4)}, p = {results.pValue < 0.0001 ? "<0.0001" : results.pValue.toFixed(4)}.{" "}
                          {results.pValue < 0.05
                            ? "The observed frequencies differ significantly from the expected frequencies."
                            : "There is no significant difference between observed and expected frequencies."}
                        </>
                      ) : (
                        <>
                          χ²({results.df}, N={results.n}) = {results.chiSq.toFixed(4)}, p = {results.pValue < 0.0001 ? "<0.0001" : results.pValue.toFixed(4)}
                          {results.mode === "contingency" && "cramersV" in results ? `, Cramér's V = ${(results as any).cramersV.toFixed(3)}` : ""}.{" "}
                          {results.pValue < 0.05
                            ? "There is a significant association between the row and column variables."
                            : "There is no significant association between the row and column variables."}
                        </>
                      )}
                    </p>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      <p>Significance: * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001, ns = not significant</p>
                      {results.mode === "contingency" && results.n < 20 && (
                        <p className="mt-1 text-amber-600 dark:text-amber-400">⚠ Small sample size (N&lt;20). Consider using Fisher's exact test instead.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
                  <p className="text-sm text-muted-foreground">Enter data to see results</p>
                </div>
              )}

              <ToolRating toolId="chi-square" />
          <button
            onClick={() => { sessionStorage.setItem("chartStudio_importData", observedInput); navigate("/chart-studio?type=column"); }}
            style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600,
              background: "#1e40af", color: "white", border: "1px solid #1e3a8a",
              borderRadius: 6, cursor: "pointer", fontFamily: "'Segoe UI', Inter, sans-serif",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14"><rect x={1} y={7} width={3} height={6} rx={0.5} fill="white"/><rect x={5.5} y={3} width={3} height={10} rx={0.5} fill="white" opacity={0.7}/><rect x={10} y={5} width={3} height={8} rx={0.5} fill="white" opacity={0.4}/></svg>
            Open in Chart Studio
          </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChiSquareTest;
