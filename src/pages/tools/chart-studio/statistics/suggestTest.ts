// Chart Studio — statistical test recommendation engine (chart-type-aware)

import type { ChartType, TestSuggestion, AssumptionCheck } from "../types";

/**
 * Suggest an appropriate statistical test given the data and chart context.
 * Returns null if there is no data to analyze.
 */
export function suggestStatisticalTest(
  columns: string[],
  colData: number[][],
  chartType?: ChartType,
): TestSuggestion | null {
  const validCols = colData.filter((d) => d.length >= 2);
  const nGroups = validCols.length;
  if (nGroups < 1) return null;

  const assumptions: AssumptionCheck[] = [];
  const warnings: string[] = [];

  // ── Chart-type context detection ──
  const isPairedContext = chartType === "before-after" || chartType === "bland-altman";
  const isCorrelationContext = chartType === "correlation" || chartType === "xy";
  const isSurvivalContext = chartType === "survival";
  const isContingencyContext = chartType === "heatmap" || chartType === "stacked-bar";

  // Override for chart types with clear test requirements
  if (isSurvivalContext) {
    return {
      recommended: "log-rank", testName: "Log-Rank Test",
      reason: "Survival data — compare event-free probability between groups (Kaplan-Meier curves)",
      assumptions: [{ label: "Data format", passed: colData.length >= 4, detail: colData.length >= 4 ? "Time + Event column pairs detected" : "Need paired Time, Event columns" }],
      warnings: colData.length < 4 ? ["Need at least 2 groups with Time and Event columns each"] : [],
      alternatives: [],
    };
  }

  if (isCorrelationContext && nGroups >= 2) {
    const xs = colData[0] || [], ys = colData[1] || [];
    const n = Math.min(xs.length, ys.length);
    const checkNorm = (vals: number[]) => {
      if (vals.length < 8) return true;
      const nn = vals.length, m = vals.reduce((s, v) => s + v, 0) / nn;
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (nn - 1 || 1));
      if (sd === 0) return true;
      const z = vals.map((v) => (v - m) / sd);
      const m3 = z.reduce((s, v) => s + v ** 3, 0) / nn;
      const m4 = z.reduce((s, v) => s + v ** 4, 0) / nn;
      const sk2 = m3 ** 2 * (nn + 1) * (nn + 3) / (6 * (nn - 2));
      const ku = (m4 - 3), mkK = -6 / (nn + 1), vkK = 24 * nn * (nn - 2) * (nn - 3) / ((nn + 1) ** 2 * (nn + 3) * (nn + 5));
      const K2 = sk2 + (vkK > 0 ? ((ku - mkK) ** 2) / vkK : 0);
      return K2 < 6;
    };
    const bothNormal = checkNorm(xs.slice(0, n)) && checkNorm(ys.slice(0, n));
    assumptions.push({ label: "Bivariate normality", passed: bothNormal, detail: bothNormal ? "Both variables approximately normal" : "One or both variables depart from normality" });
    if (bothNormal) {
      return {
        recommended: "pearson-corr", testName: "Pearson Correlation",
        reason: "Two continuous variables, both approximately normal — Pearson r measures linear association",
        assumptions, warnings: n < 10 ? ["Small sample (n < 10) — interpret correlation with caution"] : [],
        alternatives: [
          { test: "spearman-corr", name: "Spearman Correlation", when: "For monotonic (not necessarily linear) relationships or ordinal data" },
          { test: "linear-reg", name: "Linear Regression", when: "To predict Y from X and get slope/intercept with confidence intervals" },
        ],
      };
    } else {
      return {
        recommended: "spearman-corr", testName: "Spearman Rank Correlation",
        reason: "Two continuous variables, non-normal distribution — Spearman rs measures monotonic association",
        assumptions, warnings: n < 10 ? ["Small sample (n < 10) — interpret correlation with caution"] : [],
        alternatives: [
          { test: "pearson-corr", name: "Pearson Correlation", when: "If you believe the departure from normality is mild" },
          { test: "linear-reg", name: "Linear Regression", when: "To model the X-Y relationship with prediction equation" },
        ],
      };
    }
  }

  if (isContingencyContext && nGroups >= 2) {
    const totalCells = validCols.flat().length;
    const isSmall = validCols.length === 2 && validCols.every((c) => c.length <= 2);
    if (isSmall) {
      return {
        recommended: "fisher-exact", testName: "Fisher's Exact Test",
        reason: "2×2 contingency table — Fisher's exact test is preferred for small tables",
        assumptions: [{ label: "Table size", passed: true, detail: "2×2 table detected" }], warnings: [],
        alternatives: [{ test: "chi-square", name: "Chi-Square Test", when: "For larger contingency tables (expected counts ≥ 5)" }],
      };
    }
    return {
      recommended: "chi-square", testName: "Chi-Square Test of Independence",
      reason: "Contingency/frequency data — tests whether row and column categories are independent",
      assumptions: [{ label: "Expected counts", passed: totalCells > 4, detail: totalCells > 4 ? "Sufficient cell counts" : "Some expected counts may be < 5" }], warnings: totalCells <= 4 ? ["Very small table — Fisher's exact may be more appropriate"] : [],
      alternatives: [{ test: "fisher-exact", name: "Fisher's Exact Test", when: "For 2×2 tables or when expected counts < 5" }],
    };
  }

  // ── Sample size checks ──
  const sizes = validCols.map((d) => d.length);
  const minN = Math.min(...sizes);
  const maxN = Math.max(...sizes);
  if (minN < 5) warnings.push(`Small sample size (n=${minN}) — low statistical power, results may be unreliable`);
  else if (minN < 10) warnings.push(`Moderate sample size (n=${minN}) — adequate for most tests but power may be limited`);
  if (nGroups >= 2 && maxN / minN > 2) warnings.push(`Unbalanced groups (ratio ${(maxN / minN).toFixed(1)}:1) — may affect test assumptions`);

  // ── Normality check (D'Agostino-Pearson K²) ──
  const normalityResults = validCols.map((vals) => {
    if (vals.length < 8) return { normal: true, p: 1, tooSmall: true };
    const n = vals.length;
    const mean = vals.reduce((s, v) => s + v, 0) / n;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1));
    if (sd === 0) return { normal: true, p: 1, tooSmall: false };
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
    return { normal: p >= 0.05, p, tooSmall: false };
  });

  const allNormal = normalityResults.every((r) => r.normal);
  const anyTooSmall = normalityResults.some((r) => r.tooSmall);

  if (anyTooSmall) {
    assumptions.push({ label: "Normality", passed: false, detail: `Cannot test (n < 8 in ${normalityResults.filter((r) => r.tooSmall).length} group(s)) — normality unverified; consider nonparametric test` });
  } else {
    const failCount = normalityResults.filter((r) => !r.normal).length;
    assumptions.push({ label: "Normality", passed: allNormal, detail: allNormal
      ? `All ${nGroups} group(s) pass D'Agostino-Pearson test (p > 0.05)`
      : `${failCount} of ${nGroups} group(s) depart from normality (p < 0.05)` });
  }

  // ── Equal variances (Levene's median-based test) ──
  let equalVariance = true;
  if (nGroups >= 2) {
    const medians = validCols.map((vals) => { const s = [...vals].sort((a, b) => a - b); return s.length % 2 === 0 ? (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : s[Math.floor(s.length / 2)]; });
    const deviations = validCols.map((vals, i) => vals.map((v) => Math.abs(v - medians[i])));
    const allDevs = deviations.flat();
    const grandMean = allDevs.reduce((s, v) => s + v, 0) / allDevs.length;
    const groupMeans = deviations.map((d) => d.reduce((s, v) => s + v, 0) / d.length);
    const ssB = deviations.reduce((s, d, i) => s + d.length * (groupMeans[i] - grandMean) ** 2, 0);
    const ssW = deviations.reduce((s, d, i) => s + d.reduce((ss, v) => ss + (v - groupMeans[i]) ** 2, 0), 0);
    const dfB = nGroups - 1, dfW = allDevs.length - nGroups;
    const fStat = dfW > 0 && dfB > 0 ? (ssB / dfB) / (ssW / dfW) : 0;
    const fCrit = dfW > 30 ? 3.0 : dfW > 10 ? 3.5 : 4.5;
    equalVariance = fStat < fCrit;
    const varRatio = (() => { const vars = validCols.map((v) => { const m = v.reduce((s, x) => s + x, 0) / v.length; return v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1 || 1); }); return Math.max(...vars) / (Math.min(...vars) || 1); })();
    assumptions.push({ label: "Equal variances", passed: equalVariance, detail: equalVariance
      ? `Levene's test: F=${fStat.toFixed(2)}, variance ratio ${varRatio.toFixed(1)}:1 — acceptable`
      : `Levene's test: F=${fStat.toFixed(2)}, variance ratio ${varRatio.toFixed(1)}:1 — significantly unequal` });
  }

  // ── Outlier detection (IQR method) ──
  let outlierCount = 0;
  validCols.forEach((vals) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    outlierCount += vals.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
  });
  if (outlierCount > 0) warnings.push(`${outlierCount} outlier(s) detected (IQR method) — may inflate Type I error. Consider nonparametric test or data review.`);

  // ── Decision tree (chart-type-aware) ──
  const isPaired = isPairedContext || (nGroups === 2 && validCols[0].length === validCols[1].length && validCols[0].length >= 3);

  if (nGroups === 1) {
    if (allNormal && !anyTooSmall) {
      return {
        recommended: "one-sample-t", testName: "One-Sample t-test",
        reason: "Single group, normally distributed — compare mean to a theoretical/expected value",
        assumptions, warnings,
        alternatives: [{ test: "normality", name: "Normality Test", when: "Run first to verify the normality assumption" }],
      };
    }
    return {
      recommended: "normality", testName: "Normality Test",
      reason: "Single group — run normality test first to determine if parametric methods are appropriate",
      assumptions, warnings,
      alternatives: [{ test: "one-sample-t", name: "One-Sample t-test", when: "If data passes normality test (p > 0.05)" }],
    };
  }

  if (nGroups === 2) {
    if (isPaired) {
      if (allNormal && !anyTooSmall) {
        return {
          recommended: "paired-t", testName: "Paired t-test",
          reason: isPairedContext
            ? `Paired/matched data (${chartType} chart) — compares mean difference within pairs`
            : "2 groups with equal sample sizes — likely paired/matched observations",
          assumptions, warnings,
          alternatives: [
            { test: "wilcoxon-signed", name: "Wilcoxon Signed-Rank", when: "If the differences between pairs are not normally distributed" },
            { test: "unpaired-t", name: "Unpaired t-test", when: "Only if observations are truly independent (not matched)" },
          ],
        };
      } else {
        return {
          recommended: "wilcoxon-signed", testName: "Wilcoxon Signed-Rank Test",
          reason: isPairedContext
            ? `Paired/matched data (${chartType} chart), non-normal — nonparametric paired test`
            : "2 groups, likely paired, data departs from normality — nonparametric paired test",
          assumptions, warnings,
          alternatives: [
            { test: "paired-t", name: "Paired t-test", when: "If you confirm differences are approximately normal (paired t is robust to mild violations)" },
          ],
        };
      }
    } else {
      if (allNormal && equalVariance) {
        return {
          recommended: "unpaired-t", testName: "Unpaired t-test (Student's)",
          reason: "2 independent groups, normally distributed with equal variances",
          assumptions, warnings,
          alternatives: [
            { test: "mann-whitney", name: "Mann-Whitney U", when: "If normality is questionable or data is ordinal" },
            { test: "paired-t", name: "Paired t-test", when: "If observations are actually matched/paired (e.g., same subjects measured twice)" },
          ],
        };
      } else if (allNormal && !equalVariance) {
        return {
          recommended: "unpaired-t", testName: "Unpaired t-test (Welch's)",
          reason: "2 independent groups, normally distributed but unequal variances — Welch's correction applied automatically",
          assumptions, warnings,
          alternatives: [
            { test: "mann-whitney", name: "Mann-Whitney U", when: "If normality is also questionable" },
          ],
        };
      } else {
        return {
          recommended: "mann-whitney", testName: "Mann-Whitney U Test",
          reason: `2 independent groups, data departs from normality — rank-based nonparametric test`,
          assumptions, warnings,
          alternatives: [
            { test: "unpaired-t", name: "Unpaired t-test", when: "If departure from normality is mild (t-test is robust with n > 30)" },
            { test: "wilcoxon-signed", name: "Wilcoxon Signed-Rank", when: "If observations are actually matched/paired" },
          ],
        };
      }
    }
  }

  // 3+ groups
  if (allNormal && equalVariance) {
    return {
      recommended: "one-way-anova", testName: "One-Way ANOVA",
      reason: `${nGroups} independent groups, normally distributed with equal variances — tests if any group mean differs`,
      assumptions, warnings,
      alternatives: [
        { test: "tukey-posthoc", name: "Tukey Post-hoc Test", when: "After significant ANOVA — identifies which specific pairs of groups differ" },
        { test: "kruskal-wallis", name: "Kruskal-Wallis", when: "If normality assumption is questionable" },
      ],
    };
  } else {
    return {
      recommended: "kruskal-wallis", testName: "Kruskal-Wallis Test",
      reason: `${nGroups} groups, ${!allNormal ? "data departs from normality" : "unequal variances"} — nonparametric alternative to ANOVA`,
      assumptions, warnings,
      alternatives: [
        { test: "one-way-anova", name: "One-Way ANOVA", when: "If departures are mild — ANOVA is robust with large samples (n > 30 per group)" },
        { test: "tukey-posthoc", name: "Tukey Post-hoc Test", when: "After significant ANOVA to identify specific group differences" },
      ],
    };
  }
}
