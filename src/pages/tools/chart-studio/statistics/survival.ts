// Chart Studio — survival analysis (log-rank test for Kaplan-Meier curves)

import type { TestResult } from "../types";
import { normalCDF } from "./distributions";

/**
 * Log-rank test. Input columns expected as pairs: [time1, event1, time2, event2, ...]
 * where event is 1 (event observed) or 0 (censored).
 */
export function logRankTest(colData: number[][]): TestResult {
  const nGroups = Math.floor(colData.length / 2);
  if (nGroups < 2) return { testType: "log-rank", testName: "Log-Rank Test", statistic: 0, pValue: 1, summary: "Need 2+ survival groups", significant: false };
  const groups: { time: number; event: boolean; group: number }[][] = [];
  for (let g = 0; g < nGroups; g++) {
    const times = colData[g * 2], events = colData[g * 2 + 1];
    const n = Math.min(times.length, events.length);
    groups.push(Array.from({ length: n }, (_, i) => ({ time: times[i], event: events[i] === 1, group: g })));
  }
  const all = groups.flat().sort((a, b) => a.time - b.time);
  const O = new Array(nGroups).fill(0);
  const E = new Array(nGroups).fill(0);
  const atRisk = groups.map((g) => g.length);
  let i = 0;
  while (i < all.length) {
    const t = all[i].time;
    const totalAtRisk = atRisk.reduce((s, v) => s + v, 0);
    let totalEvents = 0;
    const eventsPerGroup = new Array(nGroups).fill(0);
    const leavingPerGroup = new Array(nGroups).fill(0);
    while (i < all.length && all[i].time === t) {
      if (all[i].event) { totalEvents++; eventsPerGroup[all[i].group]++; }
      leavingPerGroup[all[i].group]++;
      i++;
    }
    for (let g = 0; g < nGroups; g++) {
      O[g] += eventsPerGroup[g];
      E[g] += totalAtRisk > 0 ? atRisk[g] * totalEvents / totalAtRisk : 0;
      atRisk[g] -= leavingPerGroup[g];
    }
  }
  let chiSq = 0;
  for (let g = 0; g < nGroups; g++) {
    if (E[g] > 0) chiSq += (O[g] - E[g]) ** 2 / E[g];
  }
  const df = nGroups - 1;
  const zH = df > 0 ? Math.pow(chiSq / df, 1 / 3) - (1 - 2 / (9 * df)) : 0;
  const zNorm = zH / Math.sqrt(2 / (9 * df) || 1);
  const p = Math.max(0, 1 - normalCDF(zNorm));
  return { testType: "log-rank", testName: "Log-Rank Test", statistic: chiSq, pValue: p, df, summary: `χ²(${df}) = ${chiSq.toFixed(3)}, p = ${p < 0.001 ? "<0.001" : p.toFixed(4)}${nGroups === 2 ? `, O₁=${O[0]}, E₁=${E[0].toFixed(1)}, O₂=${O[1]}, E₂=${E[1].toFixed(1)}` : ""}`, significant: p < 0.05 };
}
