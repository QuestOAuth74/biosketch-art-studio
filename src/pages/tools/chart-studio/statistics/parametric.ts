// Chart Studio — parametric tests (t-tests, ANOVA, Tukey post-hoc, linear regression)

import type { TestResult } from "../types";
import { tTestPValue, normalCDF } from "./distributions";

/** Unpaired t-test with Welch's correction for unequal variances */
export function unpairedTTest(nameA: string, a: number[], nameB: string, b: number[]): TestResult {
  const nA = a.length, nB = b.length;
  const meanA = a.reduce((s, v) => s + v, 0) / nA;
  const meanB = b.reduce((s, v) => s + v, 0) / nB;
  const varA = a.reduce((s, v) => s + (v - meanA) ** 2, 0) / (nA - 1);
  const varB = b.reduce((s, v) => s + (v - meanB) ** 2, 0) / (nB - 1);
  const se = Math.sqrt(varA / nA + varB / nB);
  const t = (meanA - meanB) / (se || 1e-10);
  const num = (varA / nA + varB / nB) ** 2;
  const den = (varA / nA) ** 2 / (nA - 1) + (varB / nB) ** 2 / (nB - 1);
  const df = den > 0 ? num / den : nA + nB - 2;
  const p = tTestPValue(t, df);
  const meanDiff = meanA - meanB;
  const pooledSD = Math.sqrt(((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2));
  const cohensD = pooledSD > 0 ? meanDiff / pooledSD : 0;

  // Hedges' g correction (small-sample-corrected Cohen's d)
  const J = 1 - 3 / (4 * (nA + nB) - 9);
  const hedgesG = cohensD * (isFinite(J) ? J : 1);
  const ciLo = meanDiff - 1.96 * se;
  const ciHi = meanDiff + 1.96 * se;

  return {
    testType: "unpaired-t", testName: "Unpaired t-test (Welch's)",
    groupA: nameA, groupB: nameB,
    statistic: t, pValue: p, df: Math.round(df * 10) / 10,
    meanDiff, effectSize: hedgesG,
    ci95: [ciLo, ciHi],
    summary: `t(${df.toFixed(1)}) = ${t.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}, Hedges' g = ${hedgesG.toFixed(3)}, 95% CI of diff = [${ciLo.toFixed(3)}, ${ciHi.toFixed(3)}]`,
    significant: p < 0.05,
  };
}

/** Paired t-test (for matched observations) */
export function pairedTTest(nameA: string, a: number[], nameB: string, b: number[]): TestResult {
  const n = Math.min(a.length, b.length);
  const diffs = Array.from({ length: n }, (_, i) => a[i] - b[i]);
  const meanD = diffs.reduce((s, v) => s + v, 0) / n;
  const sdD = Math.sqrt(diffs.reduce((s, v) => s + (v - meanD) ** 2, 0) / (n - 1 || 1));
  const seD = sdD / Math.sqrt(n);
  const t = meanD / (seD || 1e-10);
  const df = n - 1;
  const p = tTestPValue(t, df);

  const dz = sdD > 0 ? meanD / sdD : 0; // Cohen's dz for paired
  const ciLo = meanD - 1.96 * seD;
  const ciHi = meanD + 1.96 * seD;
  return {
    testType: "paired-t", testName: "Paired t-test",
    groupA: nameA, groupB: nameB,
    statistic: t, pValue: p, df,
    meanDiff: meanD, effectSize: dz,
    ci95: [ciLo, ciHi],
    summary: `t(${df}) = ${t.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}, Cohen's dz = ${dz.toFixed(3)}, 95% CI of mean diff = [${ciLo.toFixed(3)}, ${ciHi.toFixed(3)}]`,
    significant: p < 0.05,
  };
}

/** One-sample t-test vs a theoretical mean μ₀ */
export function oneSampleTTest(name: string, vals: number[], mu0: number): TestResult {
  const n = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1));
  const se = sd / Math.sqrt(n);
  const t = (mean - mu0) / (se || 1e-10);
  const df = n - 1;
  const p = tTestPValue(t, df);
  return {
    testType: "one-sample-t", testName: "One-Sample t-test",
    groupA: name, statistic: t, pValue: p, df, meanDiff: mean - mu0,
    ci95: [mean - 1.96 * se, mean + 1.96 * se],
    summary: `Mean = ${mean.toFixed(4)}, μ₀ = ${mu0}, t(${df}) = ${t.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}`,
    significant: p < 0.05,
  };
}

/** One-way ANOVA (normal approximation of F-distribution p-value) */
export function oneWayAnova(colNames: string[], colData: number[][]): TestResult {
  const k = colData.length;
  const allN = colData.reduce((s, d) => s + d.length, 0);
  const grandMean = colData.flat().reduce((s, v) => s + v, 0) / allN;
  let ssBetween = 0, ssWithin = 0;
  for (const col of colData) {
    const colMean = col.reduce((s, v) => s + v, 0) / col.length;
    ssBetween += col.length * (colMean - grandMean) ** 2;
    for (const v of col) ssWithin += (v - colMean) ** 2;
  }
  const dfBetween = k - 1, dfWithin = allN - k;
  const msBetween = ssBetween / (dfBetween || 1);
  const msWithin = ssWithin / (dfWithin || 1);
  const F = msBetween / (msWithin || 1e-10);
  const p = 1 - normalCDF(Math.sqrt(2 * F * dfBetween / (dfBetween + 1)) - Math.sqrt(2 * dfWithin / (dfWithin - 1) - 1));

  // Effect size: η² = SS_between / SS_total
  const ssTotal = ssBetween + ssWithin;
  const etaSquared = ssTotal > 0 ? ssBetween / ssTotal : 0;
  // Auto post-hoc: when omnibus is significant and k > 2, compute Tukey-style pairwise
  const sub = (p < 0.05 && k > 2) ? tukeyPostHoc(colNames, colData).subResults : undefined;
  const sigPairs = sub ? sub.filter((r) => r.significant).length : 0;
  const summary = `F(${dfBetween}, ${dfWithin}) = ${F.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : Math.max(0, p).toFixed(4)}, η² = ${etaSquared.toFixed(3)}`
    + (sub ? ` · Tukey/Bonferroni: ${sigPairs}/${sub.length} pairs significant` : "");
  return {
    testType: "one-way-anova", testName: "One-Way ANOVA",
    groupA: colNames.join(", "),
    statistic: F, pValue: Math.max(0, Math.min(1, p)), df: dfBetween,
    effectSize: etaSquared,
    subResults: sub,
    summary,
    significant: p < 0.05,
  };
}

/** Tukey-style post-hoc pairwise comparisons with Bonferroni correction */
export function tukeyPostHoc(colNames: string[], colData: number[][]): TestResult {
  const k = colData.length;
  const nComparisons = k * (k - 1) / 2;
  const allN = colData.reduce((s, d) => s + d.length, 0);
  let ssWithin = 0;
  for (const col of colData) {
    const m = col.reduce((s, v) => s + v, 0) / col.length;
    for (const v of col) ssWithin += (v - m) ** 2;
  }
  const msWithin = ssWithin / (allN - k || 1);
  const subResults: { groupA: string; groupB: string; pValue: number; significant: boolean; meanDiff: number }[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const nI = colData[i].length, nJ = colData[j].length;
      const meanI = colData[i].reduce((s, v) => s + v, 0) / nI;
      const meanJ = colData[j].reduce((s, v) => s + v, 0) / nJ;
      const se = Math.sqrt(msWithin * (1 / nI + 1 / nJ) / 2);
      const q = Math.abs(meanI - meanJ) / (se || 1e-10);
      const z = q / Math.SQRT2;
      const rawP = 2 * (1 - normalCDF(z));
      const adjP = Math.min(1, rawP * nComparisons);
      subResults.push({ groupA: colNames[i], groupB: colNames[j], pValue: adjP, significant: adjP < 0.05, meanDiff: meanI - meanJ });
    }
  }
  const nSig = subResults.filter((r) => r.significant).length;
  return { testType: "tukey-posthoc", testName: "Post-hoc Pairwise (Bonferroni)", groupA: colNames.join(", "), statistic: nSig, pValue: 0, subResults, summary: `${nSig} of ${subResults.length} pairs significant (α=0.05, Bonferroni)`, significant: nSig > 0 };
}

/** Two-way ANOVA (row × column factorial, normal approximation p-value) */
export function twoWayAnova(columns: string[], rows: any[][]): TestResult {
  const numericRows = rows.filter((r) => r.every((v) => typeof v === "number")) as number[][];
  const nRows = numericRows.length, nCols = columns.length;
  if (nRows < 2 || nCols < 2) return { testType: "two-way-anova", testName: "Two-Way ANOVA", statistic: 0, pValue: 1, summary: "Need at least 2 rows × 2 columns of complete data", significant: false };
  const N = nRows * nCols;
  const grandMean = numericRows.flat().reduce((s, v) => s + v, 0) / N;
  const rowMeans = numericRows.map((r) => r.reduce((s, v) => s + v, 0) / nCols);
  const colMeans = columns.map((_, ci) => numericRows.reduce((s, r) => s + r[ci], 0) / nRows);
  let ssRow = 0, ssCol = 0, ssError = 0;
  for (let ri = 0; ri < nRows; ri++) ssRow += nCols * (rowMeans[ri] - grandMean) ** 2;
  for (let ci = 0; ci < nCols; ci++) ssCol += nRows * (colMeans[ci] - grandMean) ** 2;
  for (let ri = 0; ri < nRows; ri++) for (let ci = 0; ci < nCols; ci++) {
    ssError += (numericRows[ri][ci] - rowMeans[ri] - colMeans[ci] + grandMean) ** 2;
  }
  const dfRow = nRows - 1, dfCol = nCols - 1, dfError = dfRow * dfCol;
  const msRow = ssRow / (dfRow || 1), msCol = ssCol / (dfCol || 1), msError = ssError / (dfError || 1);
  const fRow = msError > 0 ? msRow / msError : 0;
  const fCol = msError > 0 ? msCol / msError : 0;
  const pRow = Math.max(0, 1 - normalCDF(Math.sqrt(2 * fRow * dfRow / (dfRow + 1)) - Math.sqrt(2 * dfError / (dfError > 1 ? dfError - 1 : 1) - 1)));
  const pCol = Math.max(0, 1 - normalCDF(Math.sqrt(2 * fCol * dfCol / (dfCol + 1)) - Math.sqrt(2 * dfError / (dfError > 1 ? dfError - 1 : 1) - 1)));
  return { testType: "two-way-anova", testName: "Two-Way ANOVA", statistic: fCol, pValue: pCol, df: dfCol,
    summary: `Factor A (rows): F(${dfRow},${dfError})=${fRow.toFixed(3)}, p=${pRow < 0.001 ? "<0.001" : pRow.toFixed(4)} | Factor B (cols): F(${dfCol},${dfError})=${fCol.toFixed(3)}, p=${pCol < 0.001 ? "<0.001" : pCol.toFixed(4)}`,
    significant: pCol < 0.05 || pRow < 0.05 };
}

/** Simple linear regression with slope, intercept, R², and significance test */
export function linearRegressionTest(nameX: string, xs: number[], nameY: string, ys: number[]): TestResult {
  const n = Math.min(xs.length, ys.length);
  const x = xs.slice(0, n), y = ys.slice(0, n);
  const meanX = x.reduce((s, v) => s + v, 0) / n, meanY = y.reduce((s, v) => s + v, 0) / n;
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) { ssXY += (x[i] - meanX) * (y[i] - meanY); ssXX += (x[i] - meanX) ** 2; ssYY += (y[i] - meanY) ** 2; }
  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  const r = (ssXX > 0 && ssYY > 0) ? ssXY / Math.sqrt(ssXX * ssYY) : 0;
  const rSq = r * r;
  const ssReg = slope * ssXY, ssRes = ssYY - ssReg;
  const dfRes = n - 2;
  const msRes = ssRes / (dfRes || 1);
  const seSlope = msRes > 0 && ssXX > 0 ? Math.sqrt(msRes / ssXX) : 0;
  const tSlope = seSlope > 0 ? slope / seSlope : 0;
  const p = tTestPValue(tSlope, dfRes);
  const F = msRes > 0 ? (ssReg / 1) / msRes : 0;
  const slopeLo = slope - 1.96 * seSlope;
  const slopeHi = slope + 1.96 * seSlope;
  return { testType: "linear-reg", testName: "Linear Regression", groupA: nameX, groupB: nameY, statistic: F, pValue: p, df: dfRes, slope, intercept, rSquared: rSq, effectSize: rSq, ci95: [slopeLo, slopeHi], summary: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}, R² = ${rSq.toFixed(4)}, slope 95% CI = [${slopeLo.toFixed(4)}, ${slopeHi.toFixed(4)}], p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}`, significant: p < 0.05 };
}
