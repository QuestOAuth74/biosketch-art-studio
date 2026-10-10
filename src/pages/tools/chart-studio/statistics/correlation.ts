// Chart Studio — correlation tests (Pearson, Spearman)

import type { TestResult } from "../types";
import { tTestPValue } from "./distributions";

/** Pearson product-moment correlation */
export function pearsonCorrelation(nameA: string, a: number[], nameB: string, b: number[]): TestResult {
  const n = Math.min(a.length, b.length);
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; denA += da * da; denB += db * db;
  }
  const r = (denA > 0 && denB > 0) ? num / Math.sqrt(denA * denB) : 0;
  const t = r * Math.sqrt((n - 2) / (1 - r * r || 1e-10));
  const df = n - 2;
  const p = tTestPValue(t, df);

  return {
    testType: "pearson-corr", testName: "Pearson Correlation",
    groupA: nameA, groupB: nameB,
    statistic: r, pValue: p, df,
    effectSize: r * r,
    summary: `r = ${r.toFixed(4)}, R² = ${(r * r).toFixed(4)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}`,
    significant: p < 0.05,
  };
}

/** Spearman rank correlation (nonparametric monotonic association) */
export function spearmanCorrelation(nameA: string, a: number[], nameB: string, b: number[]): TestResult {
  const n = Math.min(a.length, b.length);
  const x = a.slice(0, n), y = b.slice(0, n);
  function rank(arr: number[]): number[] {
    const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
      const avg = (i + 1 + j) / 2;
      for (let k = i; k < j; k++) ranks[indexed[k].i] = avg;
      i = j;
    }
    return ranks;
  }
  const rx = rank(x), ry = rank(y);
  const meanRx = rx.reduce((s, v) => s + v, 0) / n;
  const meanRy = ry.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - meanRx) * (ry[i] - meanRy); denX += (rx[i] - meanRx) ** 2; denY += (ry[i] - meanRy) ** 2; }
  const rho = (denX > 0 && denY > 0) ? num / Math.sqrt(denX * denY) : 0;
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho || 1e-10));
  const p = tTestPValue(t, n - 2);
  return { testType: "spearman-corr", testName: "Spearman Rank Correlation", groupA: nameA, groupB: nameB, statistic: rho, pValue: p, df: n - 2, effectSize: rho * rho, summary: `ρ = ${rho.toFixed(4)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}`, significant: p < 0.05 };
}
