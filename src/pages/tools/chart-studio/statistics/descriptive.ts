// Chart Studio — descriptive statistics & normality

import type { DescriptiveStats, TestResult } from "../types";

/** Compute mean, SD, SEM, median, min/max, 95% CI of the mean for a column of values. */
export function computeDescriptive(name: string, vals: number[]): DescriptiveStats {
  if (vals.length === 0) return { column: name, n: 0, mean: 0, sd: 0, sem: 0, median: 0, min: 0, max: 0, ci95Lower: 0, ci95Upper: 0 };
  const n = vals.length, mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1 || 1));
  const sem = sd / Math.sqrt(n);
  const sorted = [...vals].sort((a, b) => a - b);
  return { column: name, n, mean, sd, sem, median: sorted[Math.floor(n / 2)], min: sorted[0], max: sorted[n - 1], ci95Lower: mean - 1.96 * sem, ci95Upper: mean + 1.96 * sem };
}

/** D'Agostino-Pearson omnibus normality test (requires n ≥ 8) */
export function normalityTest(name: string, vals: number[]): TestResult {
  const n = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1));
  if (sd === 0) return { testType: "normality", testName: "Normality Test", groupA: name, statistic: 0, pValue: 1, summary: "All values identical", significant: false };
  const z = vals.map((v) => (v - mean) / sd);
  const m3 = z.reduce((s, v) => s + v ** 3, 0) / n;
  const m4 = z.reduce((s, v) => s + v ** 4, 0) / n;
  const kurtosis = m4 - 3;
  const Y = m3 * Math.sqrt((n + 1) * (n + 3) / (6 * (n - 2)));
  const beta2s = 3 * (n * n + 27 * n - 70) * (n + 1) * (n + 3) / ((n - 2) * (n + 5) * (n + 7) * (n + 9));
  const Ws = Math.sqrt(2 * (beta2s - 1)) - 1;
  const deltaS = 1 / Math.sqrt(Math.log(Math.sqrt(Ws > 0 ? Ws : 1)));
  const alphaS = Math.sqrt(2 / (Ws > 0 ? Ws - 1 : 1));
  const Zs = alphaS > 0 ? deltaS * Math.log(Y / alphaS + Math.sqrt((Y / alphaS) ** 2 + 1)) : 0;
  const meanK = -6 / (n + 1);
  const varK = 24 * n * (n - 2) * (n - 3) / ((n + 1) ** 2 * (n + 3) * (n + 5));
  const Zk = varK > 0 ? (kurtosis - meanK) / Math.sqrt(varK) : 0;
  const K2 = Zs * Zs + Zk * Zk;
  const p = Math.min(1, Math.max(0, Math.exp(-K2 / 2)));
  return { testType: "normality", testName: "Normality (D'Agostino-Pearson)", groupA: name, statistic: K2, pValue: p, summary: `K² = ${K2.toFixed(3)}, Skew = ${m3.toFixed(3)}, Kurt = ${kurtosis.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}${p >= 0.05 ? " → Normal" : " → Non-normal"}`, significant: p < 0.05 };
}
