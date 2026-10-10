// Chart Studio — contingency table tests (chi-square, Fisher's exact)

import type { TestResult } from "../types";
import { normalCDF } from "./distributions";

/** Chi-square test of independence for a contingency table */
export function chiSquareTest(observed: number[][]): TestResult {
  const nRows = observed.length, nCols = observed[0]?.length || 0;
  const rowTotals = observed.map((r) => r.reduce((s, v) => s + v, 0));
  const colTotals = Array.from({ length: nCols }, (_, j) => observed.reduce((s, r) => s + r[j], 0));
  const total = rowTotals.reduce((s, v) => s + v, 0);
  let chiSq = 0;
  for (let i = 0; i < nRows; i++) for (let j = 0; j < nCols; j++) {
    const exp = (rowTotals[i] * colTotals[j]) / (total || 1);
    if (exp > 0) chiSq += (observed[i][j] - exp) ** 2 / exp;
  }
  const df = (nRows - 1) * (nCols - 1);
  const z = df > 0 ? Math.pow(chiSq / df, 1 / 3) - (1 - 2 / (9 * df)) : 0;
  const zNorm = z / Math.sqrt(2 / (9 * df) || 1);
  const p = 1 - normalCDF(zNorm);
  const minDim = Math.min(nRows, nCols) - 1;
  const cramersV = minDim > 0 && total > 0 ? Math.sqrt(chiSq / (total * minDim)) : 0;
  return { testType: "chi-square", testName: "Chi-Square Test", statistic: chiSq, pValue: Math.max(0, p), df, effectSize: cramersV, summary: `χ²(${df}) = ${chiSq.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : Math.max(0, p).toFixed(4)}, V = ${cramersV.toFixed(3)}`, significant: p < 0.05 };
}

/** Fisher's exact test for a 2×2 contingency table */
export function fisherExact(table: number[][]): TestResult {
  const a = table[0][0], b = table[0][1], c = table[1][0], d = table[1][1];
  const n = a + b + c + d;
  function logFact(k: number): number { let s = 0; for (let i = 2; i <= k; i++) s += Math.log(i); return s; }
  function hypergeomProb(a: number, b: number, c: number, d: number): number {
    return Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(n) - logFact(a) - logFact(b) - logFact(c) - logFact(d));
  }
  const pObserved = hypergeomProb(a, b, c, d);
  let pValue = 0;
  const rowSum0 = a + b, rowSum1 = c + d, colSum0 = a + c;
  for (let aa = 0; aa <= Math.min(rowSum0, colSum0); aa++) {
    const bb = rowSum0 - aa, cc = colSum0 - aa, dd = rowSum1 - cc;
    if (bb >= 0 && cc >= 0 && dd >= 0) {
      const pThis = hypergeomProb(aa, bb, cc, dd);
      if (pThis <= pObserved + 1e-10) pValue += pThis;
    }
  }
  pValue = Math.min(1, pValue);
  const oddsRatio = (b > 0 && c > 0) ? (a * d) / (b * c) : Infinity;
  return { testType: "fisher-exact", testName: "Fisher's Exact Test (2×2)", statistic: oddsRatio, pValue, effectSize: oddsRatio, summary: `OR = ${oddsRatio === Infinity ? "∞" : oddsRatio.toFixed(3)}, p = ${pValue < 0.001 ? "<0.001" : pValue.toFixed(4)}`, significant: pValue < 0.05 };
}
