// Chart Studio — nonparametric tests (Mann-Whitney, Wilcoxon signed-rank, Kruskal-Wallis)

import type { TestResult } from "../types";
import { normalCDF } from "./distributions";

/** Mann-Whitney U test (rank-based two-sample test for non-normal data) */
export function mannWhitneyU(nameA: string, a: number[], nameB: string, b: number[]): TestResult {
  const all = [...a.map((v) => ({ v, g: "a" })), ...b.map((v) => ({ v, g: "b" }))];
  all.sort((x, y) => x.v - y.v);
  const ranks = new Array(all.length);
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j < all.length && all[j].v === all[i].v) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }
  let rankSumA = 0;
  for (let k = 0; k < all.length; k++) {
    if (all[k].g === "a") rankSumA += ranks[k];
  }
  const nA = a.length, nB = b.length;
  const U = rankSumA - nA * (nA + 1) / 2;
  const meanU = nA * nB / 2;
  const sdU = Math.sqrt(nA * nB * (nA + nB + 1) / 12);
  const z = (U - meanU) / (sdU || 1);
  const p = 2 * (1 - normalCDF(Math.abs(z)));

  // Rank-biserial correlation as effect size: r = 1 - 2U / (nA * nB)
  const rankBiserial = nA * nB > 0 ? 1 - (2 * U) / (nA * nB) : 0;

  return {
    testType: "mann-whitney", testName: "Mann-Whitney U test",
    groupA: nameA, groupB: nameB,
    statistic: U, pValue: p,
    effectSize: rankBiserial,
    summary: `U = ${U.toFixed(1)}, z = ${z.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}, rank-biserial r = ${rankBiserial.toFixed(3)}`,
    significant: p < 0.05,
  };
}

/** Wilcoxon signed-rank test (paired nonparametric) */
export function wilcoxonSignedRank(nameA: string, a: number[], nameB: string, b: number[]): TestResult {
  const n = Math.min(a.length, b.length);
  const diffs = Array.from({ length: n }, (_, i) => a[i] - b[i]).filter((d) => d !== 0);
  const m = diffs.length;
  if (m === 0) return { testType: "wilcoxon-signed", testName: "Wilcoxon Signed-Rank", groupA: nameA, groupB: nameB, statistic: 0, pValue: 1, summary: "All differences are zero", significant: false };
  const absDiffs = diffs.map((d, i) => ({ abs: Math.abs(d), sign: d > 0 ? 1 : -1, i })).sort((a, b) => a.abs - b.abs);
  let idx = 0;
  const ranks = new Array(m);
  while (idx < m) {
    let j = idx;
    while (j < m && absDiffs[j].abs === absDiffs[idx].abs) j++;
    const avg = (idx + 1 + j) / 2;
    for (let k = idx; k < j; k++) ranks[k] = avg;
    idx = j;
  }
  let Wplus = 0, Wminus = 0;
  for (let i = 0; i < m; i++) {
    if (absDiffs[i].sign > 0) Wplus += ranks[i]; else Wminus += ranks[i];
  }
  const W = Math.min(Wplus, Wminus);
  const meanW = m * (m + 1) / 4;
  const sdW = Math.sqrt(m * (m + 1) * (2 * m + 1) / 24);
  const z = (W - meanW) / (sdW || 1);
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  const medianDiff = [...diffs].sort((a, b) => a - b)[Math.floor(diffs.length / 2)];
  return { testType: "wilcoxon-signed", testName: "Wilcoxon Signed-Rank", groupA: nameA, groupB: nameB, statistic: W, pValue: p, meanDiff: medianDiff, summary: `W = ${W.toFixed(0)}, z = ${z.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}, median diff = ${medianDiff.toFixed(3)}`, significant: p < 0.05 };
}

/** Kruskal-Wallis test (nonparametric one-way ANOVA) */
/** Dunn's post-hoc with Bonferroni correction — pairwise comparisons from Kruskal-Wallis ranks. */
export function dunnPostHoc(colNames: string[], colData: number[][]): { groupA: string; groupB: string; pValue: number; significant: boolean; meanDiff: number }[] {
  // Re-rank across all groups
  const all: { v: number; g: number }[] = [];
  colData.forEach((col, gi) => col.forEach((v) => all.push({ v, g: gi })));
  all.sort((a, b) => a.v - b.v);
  const N = all.length;
  const ranks = new Array(N);
  // Tie-adjust mean ranks
  let i = 0;
  let tieSum = 0;
  while (i < N) {
    let j = i;
    while (j < N && all[j].v === all[i].v) j++;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) ranks[k] = avg;
    const t = j - i;
    if (t > 1) tieSum += t * t * t - t;
    i = j;
  }
  const meanRanks = colData.map(() => 0);
  const ns = colData.map((c) => c.length);
  for (let k = 0; k < N; k++) meanRanks[all[k].g] += ranks[k];
  for (let g = 0; g < colData.length; g++) meanRanks[g] = ns[g] > 0 ? meanRanks[g] / ns[g] : 0;

  const k = colData.length;
  const nComparisons = k * (k - 1) / 2;
  const varTerm = (N * (N + 1) - tieSum / (N - 1)) / 12;
  const subResults: { groupA: string; groupB: string; pValue: number; significant: boolean; meanDiff: number }[] = [];
  for (let i1 = 0; i1 < k; i1++) {
    for (let j1 = i1 + 1; j1 < k; j1++) {
      const se = Math.sqrt(varTerm * (1 / ns[i1] + 1 / ns[j1]));
      const z = Math.abs(meanRanks[i1] - meanRanks[j1]) / (se || 1e-10);
      const rawP = 2 * (1 - normalCDF(z));
      const adjP = Math.min(1, rawP * nComparisons);
      const mI = colData[i1].reduce((s, v) => s + v, 0) / (ns[i1] || 1);
      const mJ = colData[j1].reduce((s, v) => s + v, 0) / (ns[j1] || 1);
      subResults.push({ groupA: colNames[i1], groupB: colNames[j1], pValue: adjP, significant: adjP < 0.05, meanDiff: mI - mJ });
    }
  }
  return subResults;
}

export function kruskalWallis(colNames: string[], colData: number[][]): TestResult {
  const all: { v: number; g: number }[] = [];
  colData.forEach((col, gi) => col.forEach((v) => all.push({ v, g: gi })));
  all.sort((a, b) => a.v - b.v);
  const N = all.length;
  const ranks = new Array(N);
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N && all[j].v === all[i].v) j++;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) ranks[k] = avg;
    i = j;
  }
  const rankSums = colData.map(() => 0);
  const ns = colData.map((c) => c.length);
  for (let k = 0; k < N; k++) rankSums[all[k].g] += ranks[k];
  let H = 0;
  for (let g = 0; g < colData.length; g++) {
    if (ns[g] > 0) H += (rankSums[g] ** 2) / ns[g];
  }
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
  const df = colData.length - 1;
  const zH = df > 0 ? Math.pow(H / df, 1 / 3) - (1 - 2 / (9 * df)) : 0;
  const zNorm = zH / Math.sqrt(2 / (9 * df) || 1);
  const p = Math.max(0, 1 - normalCDF(zNorm));
  // Auto post-hoc: when omnibus is significant and k > 2, compute pairwise Dunn
  const subResults = (p < 0.05 && colData.length > 2) ? dunnPostHoc(colNames, colData) : undefined;
  const sigPairs = subResults ? subResults.filter((r) => r.significant).length : 0;
  const summary = `H(${df}) = ${H.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}`
    + (subResults ? ` · Dunn-Bonferroni: ${sigPairs}/${subResults.length} pairs significant` : "");
  return { testType: "kruskal-wallis", testName: "Kruskal-Wallis Test", groupA: colNames.join(", "), statistic: H, pValue: p, df, subResults, summary, significant: p < 0.05 };
}
