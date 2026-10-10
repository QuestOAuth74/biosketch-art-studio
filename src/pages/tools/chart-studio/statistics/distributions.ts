// Chart Studio — probability distribution helpers
// Pure math utilities used by statistical tests.

/** Standard normal CDF (Abramowitz & Stegun approximation) */
export function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/** t-distribution CDF (Abramowitz & Stegun numerical integration approximation) */
export function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const a = df / 2, b = 0.5;
  if (df <= 0) return 0.5;
  const steps = 200;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps;
    sum += Math.pow(u, a - 1) * Math.pow(1 - u, b - 1);
  }
  const betaFull = sum / steps;
  let sumPartial = 0;
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps * x;
    sumPartial += Math.pow(u, a - 1) * Math.pow(1 - u, b - 1) * (x / steps);
  }
  const Ix = betaFull > 0 ? sumPartial / (betaFull / steps * 1) : 0.5;
  const p = 1 - Ix;
  return t >= 0 ? 1 - p / 2 : p / 2;
}

/** Two-tailed p-value from a t-statistic */
export function tTestPValue(t: number, df: number): number {
  const cdf = tCDF(Math.abs(t), df);
  return 2 * (1 - cdf);
}
