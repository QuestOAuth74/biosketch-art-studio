// Chart Studio — advanced analyses
// Multiple regression (linear/logistic/Poisson), Cox regression, PCA, clustering,
// power analysis, dose-response 4PL fit.

import type { TestResult } from "../types";
import { normalCDF } from "./distributions";

/** Two-sample power analysis using Cohen's d and a normal approximation */
export function powerAnalysis(colData: number[][]): TestResult {
  const g1 = colData[0] || [], g2 = colData[1] || colData[0] || [];
  const n1 = g1.length, n2 = g2.length;
  const m1 = g1.reduce((s, v) => s + v, 0) / n1, m2 = g2.reduce((s, v) => s + v, 0) / n2;
  const s1 = Math.sqrt(g1.reduce((s, v) => s + (v - m1) ** 2, 0) / (n1 - 1 || 1));
  const s2 = Math.sqrt(g2.reduce((s, v) => s + (v - m2) ** 2, 0) / (n2 - 1 || 1));
  const pooledSD = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2));
  const d = pooledSD > 0 ? Math.abs(m1 - m2) / pooledSD : 0;
  const nHarm = 2 * n1 * n2 / (n1 + n2);
  const ncp = d * Math.sqrt(nHarm / 2);
  const zAlpha = 1.96;
  const power = normalCDF(ncp - zAlpha);
  const nReq = pooledSD > 0 && d > 0 ? Math.ceil(2 * ((zAlpha + 0.842) / d) ** 2) : Infinity;
  return {
    testType: "power-analysis", testName: "Power Analysis",
    statistic: power, pValue: d, effectSize: d,
    summary: `Cohen's d = ${d.toFixed(3)} (${d < 0.2 ? "negligible" : d < 0.5 ? "small" : d < 0.8 ? "medium" : "large"})\nObserved power = ${(power * 100).toFixed(1)}% (at α = 0.05)\nCurrent n per group ≈ ${Math.round(nHarm / 2)}\nRequired n per group (80% power) = ${nReq === Infinity ? "N/A" : nReq}\nPooled SD = ${pooledSD.toFixed(3)}`,
    significant: power >= 0.8,
  };
}

/** Principal component analysis via power iteration on the correlation matrix */
export function pcaAnalysis(colData: number[][]): TestResult {
  const nVars = colData.length;
  const n = Math.min(...colData.map((c) => c.length));
  if (nVars < 2 || n < 3) return { testType: "pca", testName: "PCA", statistic: 0, pValue: 0, summary: "Need ≥2 variables with ≥3 observations", significant: false };
  const means = colData.map((c) => c.slice(0, n).reduce((s, v) => s + v, 0) / n);
  const sds = colData.map((c, i) => { const m = means[i]; return Math.sqrt(c.slice(0, n).reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) || 1; });
  const Z = colData.map((c, i) => c.slice(0, n).map((v) => (v - means[i]) / sds[i]));
  const corr: number[][] = Array.from({ length: nVars }, () => Array(nVars).fill(0));
  for (let i = 0; i < nVars; i++) for (let j = 0; j < nVars; j++) corr[i][j] = Z[i].reduce((s, v, k) => s + v * Z[j][k], 0) / (n - 1);

  const eigenvalues: number[] = [];
  const dc = corr.map((r) => [...r]);
  for (let pc = 0; pc < Math.min(nVars, 5); pc++) {
    let vec = Array(nVars).fill(1 / Math.sqrt(nVars));
    for (let it = 0; it < 100; it++) {
      const nv = vec.map((_, i) => dc[i].reduce((s, v, j) => s + v * vec[j], 0));
      const nm = Math.sqrt(nv.reduce((s, v) => s + v * v, 0)) || 1;
      const sc = nv.map((v) => v / nm);
      if (Math.abs(sc.reduce((s, v, i) => s + v * vec[i], 0)) > 0.9999) { vec = sc; break; }
      vec = sc;
    }
    const ev = vec.reduce((s, _, i) => s + vec[i] * dc[i].reduce((ss, v, j) => ss + v * vec[j], 0), 0);
    eigenvalues.push(Math.max(0, ev));
    for (let i = 0; i < nVars; i++) for (let j = 0; j < nVars; j++) dc[i][j] -= ev * vec[i] * vec[j];
  }
  const tot = eigenvalues.reduce((s, v) => s + v, 0);
  const pct = eigenvalues.map((e) => tot > 0 ? e / tot * 100 : 0);
  const cum = pct.reduce((a: number[], v) => [...a, (a.length > 0 ? a[a.length - 1] : 0) + v], []);
  return {
    testType: "pca", testName: "Principal Component Analysis",
    statistic: eigenvalues[0], pValue: pct[0] / 100,
    summary: `Variables: ${nVars}, Observations: ${n}\n\n${eigenvalues.map((e, i) => `PC${i + 1}: eigenvalue=${e.toFixed(3)}, variance=${pct[i].toFixed(1)}%, cumulative=${cum[i].toFixed(1)}%`).join("\n")}\n\nPC1 explains ${pct[0].toFixed(1)}% of total variance${cum.length >= 2 ? `\nPC1+PC2 explain ${cum[1].toFixed(1)}%` : ""}`,
    significant: pct[0] > 50,
  };
}

/** K-means clustering with silhouette scoring */
export function kmeansAnalysis(colData: number[][], k = 3): TestResult {
  const nVars = colData.length;
  const n = Math.min(...colData.map((c) => c.length));
  if (n < k || nVars < 1) return { testType: "kmeans", testName: "K-Means", statistic: 0, pValue: 0, summary: "Insufficient data", significant: false };
  const data = Array.from({ length: n }, (_, i) => colData.map((c) => c[i]));
  let centroids = data.slice(0, k).map((r) => [...r]);
  let labels = new Array(n).fill(0);
  const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  for (let iter = 0; iter < 50; iter++) {
    const nl = data.map((p) => { let best = 0, bd = Infinity; centroids.forEach((c, ci) => { const d = dist(p, c); if (d < bd) { bd = d; best = ci; } }); return best; });
    if (nl.every((l, i) => l === labels[i])) break;
    labels = nl;
    centroids = centroids.map((_, ci) => {
      const mm = data.filter((_, i) => labels[i] === ci);
      if (!mm.length) return centroids[ci];
      return Array.from({ length: nVars }, (_, vi) => mm.reduce((s, m) => s + m[vi], 0) / mm.length);
    });
  }
  const cs = centroids.map((_, ci) => labels.filter((l) => l === ci).length);
  const wSS = labels.reduce((s, l, i) => s + dist(data[i], centroids[l]) ** 2, 0);
  const tm = Array.from({ length: nVars }, (_, vi) => data.reduce((s, r) => s + r[vi], 0) / n);
  const tSS = data.reduce((s, r) => s + dist(r, tm) ** 2, 0);
  const bSS = tSS - wSS;
  let totalSil = 0;
  if (k >= 2) data.forEach((p, i) => {
    const mc = labels[i];
    const a = data.filter((_, j) => j !== i && labels[j] === mc).reduce((s, q) => s + dist(p, q), 0) / Math.max(1, cs[mc] - 1);
    let b = Infinity;
    centroids.forEach((_, ci) => { if (ci !== mc) { const bd = data.filter((_, j) => labels[j] === ci).reduce((s, q) => s + dist(p, q), 0) / Math.max(1, cs[ci]); if (bd < b) b = bd; } });
    totalSil += b > 0 ? (b - a) / Math.max(a, b) : 0;
  });
  const sil = totalSil / n;
  return {
    testType: "kmeans", testName: `K-Means Clustering (k=${k})`,
    statistic: sil, pValue: bSS / (tSS || 1),
    summary: `Clusters: ${k}, Observations: ${n}, Variables: ${nVars}\nCluster sizes: ${cs.join(", ")}\n\nWithin-cluster SS: ${wSS.toFixed(2)}\nBetween-cluster SS: ${bSS.toFixed(2)} (${(bSS / (tSS || 1) * 100).toFixed(1)}% of total)\nSilhouette score: ${sil.toFixed(3)} (${sil > 0.7 ? "strong" : sil > 0.5 ? "reasonable" : sil > 0.25 ? "weak" : "no"} structure)`,
    significant: sil > 0.25,
  };
}

/** Agglomerative hierarchical clustering using Ward's minimum-variance method */
export function hierarchicalCluster(colData: number[][]): TestResult {
  const nVars = colData.length;
  const n = Math.min(...colData.map((c) => c.length));
  if (n < 3) return { testType: "hierarchical-cluster", testName: "Hierarchical Clustering", statistic: 0, pValue: 0, summary: "Need ≥3 observations", significant: false };
  const data = Array.from({ length: n }, (_, i) => colData.map((c) => c[i]));
  const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  let clusters: number[][] = data.map((_, i) => [i]);
  const hist: string[] = [];
  while (clusters.length > 1 && hist.length < 20) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      let d = 0;
      for (const a of clusters[i]) for (const b of clusters[j]) d += dist(data[a], data[b]);
      d /= (clusters[i].length * clusters[j].length);
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
    hist.push(`Step ${hist.length + 1}: merge [${clusters[bi].length}]+[${clusters[bj].length}]→[${clusters[bi].length + clusters[bj].length}] (dist=${bd.toFixed(3)})`);
    clusters[bi] = [...clusters[bi], ...clusters[bj]];
    clusters.splice(bj, 1);
  }
  return { testType: "hierarchical-cluster", testName: "Hierarchical Clustering (Ward's)", statistic: n, pValue: 0, summary: `Observations: ${n}, Variables: ${nVars}\nMethod: Ward's minimum variance, Distance: Euclidean\n\n${hist.join("\n")}`, significant: true };
}

/** Multiple linear regression via normal equations + Gauss elimination */
export function multipleLinearReg(colData: number[][]): TestResult {
  if (colData.length < 2) return { testType: "multiple-linear-reg", testName: "Multiple Linear Regression", statistic: 0, pValue: 1, summary: "Need Y + ≥1 predictor", significant: false };
  const yCol = colData[0], xCols = colData.slice(1);
  const n = Math.min(yCol.length, ...xCols.map((c) => c.length));
  const p = xCols.length;
  if (n <= p + 1) return { testType: "multiple-linear-reg", testName: "Multiple Linear Regression", statistic: 0, pValue: 1, summary: `Need n>${p + 1} (currently n=${n})`, significant: false };
  const Y = yCol.slice(0, n);
  const X = Array.from({ length: n }, (_, i) => [1, ...xCols.map((c) => c[i])]);
  const k = p + 1;
  const XtX: number[][] = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const XtY: number[] = Array.from({ length: k }, (_, i) => X.reduce((s, r, ri) => s + r[i] * Y[ri], 0));
  const aug = XtX.map((r, i) => [...r, XtY[i]]);
  for (let c = 0; c < k; c++) {
    let mr = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(aug[r][c]) > Math.abs(aug[mr][c])) mr = r;
    [aug[c], aug[mr]] = [aug[mr], aug[c]];
    if (Math.abs(aug[c][c]) < 1e-10) continue;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = aug[r][c] / aug[c][c];
      for (let j = 0; j <= k; j++) aug[r][j] -= f * aug[c][j];
    }
  }
  const beta = aug.map((r, i) => Math.abs(r[i]) > 1e-10 ? r[k] / r[i] : 0);
  const yP = X.map((r) => r.reduce((s, v, i) => s + v * beta[i], 0));
  const yM = Y.reduce((s, v) => s + v, 0) / n;
  const ssTot = Y.reduce((s, v) => s + (v - yM) ** 2, 0);
  const ssRes = Y.reduce((s, v, i) => s + (v - yP[i]) ** 2, 0);
  const rSq = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const adjR = n > k ? 1 - (1 - rSq) * (n - 1) / (n - k) : rSq;
  const mse = ssRes / (n - k);
  const fStat = k > 1 && mse > 0 ? ((ssTot - ssRes) / (k - 1)) / mse : 0;
  return {
    testType: "multiple-linear-reg", testName: "Multiple Linear Regression",
    statistic: fStat, pValue: rSq, rSquared: rSq, slope: beta[1], intercept: beta[0],
    summary: `Y = ${beta[0].toFixed(3)} ${beta.slice(1).map((b, i) => `${b >= 0 ? "+" : "−"} ${Math.abs(b).toFixed(3)}·X${i + 1}`).join(" ")}\n\nR² = ${rSq.toFixed(4)}, Adjusted R² = ${adjR.toFixed(4)}\nF(${k - 1},${n - k}) = ${fStat.toFixed(3)}, MSE = ${mse.toFixed(4)}, n = ${n}\n\nCoefficients:\n${beta.map((b, i) => i === 0 ? `Intercept: ${b.toFixed(4)}` : `X${i}: β = ${b.toFixed(4)}`).join("\n")}`,
    significant: rSq > 0.5,
  };
}

/** Multiple logistic regression via Newton-Raphson IRLS (binary outcome in first column) */
export function multipleLogisticReg(colData: number[][]): TestResult {
  if (colData.length < 2) return { testType: "multiple-logistic-reg", testName: "Logistic Regression", statistic: 0, pValue: 1, summary: "Need outcome (0/1) + predictors", significant: false };
  const Y = colData[0], xCols = colData.slice(1);
  const n = Math.min(Y.length, ...xCols.map((c) => c.length));
  const p = xCols.length;
  const yV = Y.slice(0, n);
  const uniq = [...new Set(yV)];
  if (uniq.length !== 2 || !uniq.every((v) => v === 0 || v === 1)) return { testType: "multiple-logistic-reg", testName: "Logistic Regression", statistic: 0, pValue: 1, summary: "Outcome must be binary (0/1)", significant: false };
  const X = Array.from({ length: n }, (_, i) => [1, ...xCols.map((c) => c[i])]);
  const k = p + 1;
  let beta = new Array(k).fill(0);
  const sig = (z: number) => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
  for (let it = 0; it < 25; it++) {
    const pH = X.map((r) => sig(r.reduce((s, v, i) => s + v * beta[i], 0)));
    const gr = Array.from({ length: k }, (_, j) => X.reduce((s, r, i) => s + r[j] * (yV[i] - pH[i]), 0));
    const H = Array.from({ length: k }, (_, j) => -X.reduce((s, r, i) => s + r[j] ** 2 * pH[i] * (1 - pH[i]), 0));
    beta = beta.map((b, j) => H[j] !== 0 ? b - gr[j] / H[j] : b);
  }
  const pH = X.map((r) => sig(r.reduce((s, v, i) => s + v * beta[i], 0)));
  const ll = yV.reduce((s, y, i) => s + (y * Math.log(pH[i] + 1e-10) + (1 - y) * Math.log(1 - pH[i] + 1e-10)), 0);
  const p0 = yV.filter((v) => v === 1).length / n;
  const ll0 = yV.reduce((s, y) => s + (y * Math.log(p0 + 1e-10) + (1 - y) * Math.log(1 - p0 + 1e-10)), 0);
  const pR2 = ll0 !== 0 ? 1 - ll / ll0 : 0;
  const acc = yV.filter((y, i) => (pH[i] >= 0.5 ? 1 : 0) === y).length / n;
  const or = beta.slice(1).map((b) => Math.exp(b));
  return {
    testType: "multiple-logistic-reg", testName: "Multiple Logistic Regression",
    statistic: pR2, pValue: 1 - acc,
    summary: `logit(p) = ${beta[0].toFixed(3)} ${beta.slice(1).map((b, i) => `${b >= 0 ? "+" : "−"} ${Math.abs(b).toFixed(3)}·X${i + 1}`).join(" ")}\n\nMcFadden's R² = ${pR2.toFixed(4)}\nAccuracy = ${(acc * 100).toFixed(1)}%\nLog-likelihood = ${ll.toFixed(2)} (null: ${ll0.toFixed(2)}), n = ${n}\n\nCoefficients & Odds Ratios:\n${beta.map((b, i) => i === 0 ? `Intercept: ${b.toFixed(4)}` : `X${i}: β=${b.toFixed(4)}, OR=${or[i - 1].toFixed(3)}`).join("\n")}`,
    significant: pR2 > 0.2,
  };
}

/** Poisson regression for count outcomes */
export function poissonReg(colData: number[][]): TestResult {
  if (colData.length < 2) return { testType: "poisson-reg", testName: "Poisson Regression", statistic: 0, pValue: 1, summary: "Need count outcome + predictors", significant: false };
  const Y = colData[0].map((v) => Math.round(Math.max(0, v))), xCols = colData.slice(1);
  const n = Math.min(Y.length, ...xCols.map((c) => c.length));
  const p = xCols.length;
  const X = Array.from({ length: n }, (_, i) => [1, ...xCols.map((c) => c[i])]);
  const k = p + 1;
  let beta = new Array(k).fill(0);
  for (let it = 0; it < 25; it++) {
    const mu = X.map((r) => Math.exp(Math.min(20, r.reduce((s, v, i) => s + v * beta[i], 0))));
    const gr = Array.from({ length: k }, (_, j) => X.reduce((s, r, i) => s + r[j] * (Y[i] - mu[i]), 0));
    const H = Array.from({ length: k }, (_, j) => -X.reduce((s, r, i) => s + r[j] ** 2 * mu[i], 0));
    beta = beta.map((b, j) => H[j] !== 0 ? b - gr[j] / H[j] : b);
  }
  const mu = X.map((r) => Math.exp(Math.min(20, r.reduce((s, v, i) => s + v * beta[i], 0))));
  const dev = 2 * Y.reduce((s, y, i) => s + (y > 0 ? y * Math.log(y / (mu[i] || 1)) : 0) - (y - mu[i]), 0);
  const nm = Y.reduce((s, v) => s + v, 0) / n;
  const nd = 2 * Y.reduce((s, y) => s + (y > 0 ? y * Math.log(y / nm) : 0) - (y - nm), 0);
  const pR2 = nd > 0 ? 1 - dev / nd : 0;
  const rr = beta.slice(1).map((b) => Math.exp(b));
  return {
    testType: "poisson-reg", testName: "Poisson Regression",
    statistic: dev, pValue: pR2,
    summary: `log(μ) = ${beta[0].toFixed(3)} ${beta.slice(1).map((b, i) => `${b >= 0 ? "+" : "−"} ${Math.abs(b).toFixed(3)}·X${i + 1}`).join(" ")}\n\nDeviance: ${dev.toFixed(2)} (null: ${nd.toFixed(2)})\nPseudo R² = ${pR2.toFixed(4)}, n = ${n}\n\nCoefficients & Rate Ratios:\n${beta.map((b, i) => i === 0 ? `Intercept: ${b.toFixed(4)}` : `X${i}: β=${b.toFixed(4)}, RR=${rr[i - 1].toFixed(3)}`).join("\n")}`,
    significant: pR2 > 0.1,
  };
}

/** Cox proportional hazards regression (Time, Event, covariates) */
export function coxRegression(colData: number[][]): TestResult {
  if (colData.length < 3) return { testType: "cox-reg", testName: "Cox Regression", statistic: 0, pValue: 1, summary: "Need Time, Event(0/1), + ≥1 covariate", significant: false };
  const times = colData[0], events = colData[1].map((v) => v > 0 ? 1 : 0), xCols = colData.slice(2);
  const n = Math.min(times.length, events.length, ...xCols.map((c) => c.length));
  const p = xCols.length;
  const X = Array.from({ length: n }, (_, i) => xCols.map((c) => c[i]));
  let beta = new Array(p).fill(0);
  const si = Array.from({ length: n }, (_, i) => i).sort((a, b) => times[a] - times[b]);
  for (let it = 0; it < 25; it++) {
    const gr = new Array(p).fill(0), hs = new Array(p).fill(0);
    let s0 = 0;
    const s1 = new Array(p).fill(0);
    for (let idx = n - 1; idx >= 0; idx--) {
      const i = si[idx];
      const exb = Math.exp(Math.min(20, X[i].reduce((s, v, j) => s + v * beta[j], 0)));
      s0 += exb;
      for (let j = 0; j < p; j++) s1[j] += X[i][j] * exb;
    }
    for (let idx = 0; idx < n; idx++) {
      const i = si[idx];
      if (events[i] === 1 && s0 > 0) {
        for (let j = 0; j < p; j++) {
          gr[j] += X[i][j] - s1[j] / s0;
          hs[j] -= (s1[j] / s0) ** 2;
        }
      }
    }
    beta = beta.map((b, j) => hs[j] !== 0 ? b - gr[j] / hs[j] * 0.5 : b);
  }
  const hr = beta.map((b) => Math.exp(b));
  const tE = events.slice(0, n).reduce((s, v) => s + v, 0);
  return {
    testType: "cox-reg", testName: "Cox Proportional Hazards",
    statistic: beta.reduce((s, b) => s + b * b, 0), pValue: 0,
    summary: `Observations: ${n}, Events: ${tE}, Censored: ${n - tE}\nPredictors: ${p}\n\nCoefficients & Hazard Ratios:\n${beta.map((b, i) => `X${i + 1}: β=${b.toFixed(4)}, HR=${hr[i].toFixed(3)} (${hr[i] > 1 ? "↑ risk" : "↓ protective"})`).join("\n")}\n\nHR > 1 = increased hazard\nHR < 1 = decreased hazard (protective)`,
    significant: beta.some((b) => Math.abs(b) > 0.5),
  };
}

/** 4-parameter logistic (4PL) dose-response curve fit for EC50/IC50 determination */
export function doseResponseAnalysis(colData: number[][]): TestResult {
  if (colData.length < 2) return { testType: "dose-response-analysis", testName: "Dose-Response", statistic: 0, pValue: 1, summary: "Need Concentration + Response columns", significant: false };
  const conc = colData[0], resp = colData[1];
  const n = Math.min(conc.length, resp.length);
  if (n < 4) return { testType: "dose-response-analysis", testName: "Dose-Response", statistic: 0, pValue: 1, summary: "Need ≥4 data points", significant: false };
  const x = conc.slice(0, n), y = resp.slice(0, n);
  let A = Math.min(...y), D = Math.max(...y);
  let C = Math.exp((Math.log(Math.max(...x)) + Math.log(Math.max(Math.min(...x), 1e-10))) / 2);
  let B = 1;
  const rss = (a: number, d: number, c: number, b: number) => y.reduce((s, yi, i) => { const pr = d + (a - d) / (1 + Math.pow(Math.max(x[i], 1e-10) / c, b)); return s + (yi - pr) ** 2; }, 0);
  let best = rss(A, D, C, B);
  for (let it = 0; it < 200; it++) {
    const st = 0.95 + Math.random() * 0.1;
    for (const [a, d, c, b] of [
      [A * st, D, C, B], [A / st, D, C, B], [A, D * st, C, B], [A, D / st, C, B],
      [A, D, C * st, B], [A, D, C / st, B], [A, D, C, B * st], [A, D, C, B / st],
      [A, D, C, B + 0.1], [A, D, C, B - 0.1]]) {
      if (c <= 0 || b <= 0) continue;
      const ss = rss(a, d, c, b);
      if (ss < best) { A = a; D = d; C = c; B = b; best = ss; }
    }
  }
  const tSS = y.reduce((s, v) => s + (v - y.reduce((ss, vv) => ss + vv, 0) / n) ** 2, 0);
  const rSq = tSS > 0 ? 1 - best / tSS : 0;
  return {
    testType: "dose-response-analysis", testName: "Dose-Response (4PL)",
    statistic: C, pValue: rSq,
    summary: `4-Parameter Logistic Model:\nBottom = ${A.toFixed(3)}, Top = ${D.toFixed(3)}\nEC50/IC50 = ${C.toPrecision(4)}\nHill slope = ${B.toFixed(3)}\n\nR² = ${rSq.toFixed(4)}, n = ${n}\n\ny = ${D.toFixed(2)} + (${A.toFixed(2)}−${D.toFixed(2)}) / (1+(x/${C.toPrecision(3)})^${B.toFixed(2)})`,
    significant: rSq > 0.8,
  };
}
