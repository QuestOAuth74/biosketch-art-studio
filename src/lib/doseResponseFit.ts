/**
 * 4-Parameter Logistic (4PL) Dose-Response Curve Fitting
 *
 * Model: y = bottom + (top - bottom) / (1 + (x / ec50) ^ hillSlope)
 *
 * Uses Nelder-Mead simplex optimization for robust parameter estimation.
 */

export interface FitParams {
  bottom: number;
  top: number;
  ec50: number;
  hillSlope: number;
}

/** Evaluate 4PL model at a single x value */
export function evaluate4PL(x: number, p: FitParams): number {
  if (x <= 0) return p.top; // at zero dose, response is at top
  return p.bottom + (p.top - p.bottom) / (1 + Math.pow(x / p.ec50, p.hillSlope));
}

/** Generate smooth curve points for plotting */
export function generateCurvePoints(
  params: FitParams,
  xMin: number,
  xMax: number,
  numPoints: number = 100
): { x: number[]; y: number[] } {
  const logMin = Math.log10(Math.max(xMin, 1e-12));
  const logMax = Math.log10(Math.max(xMax, 1e-12));
  const x: number[] = [];
  const y: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const logX = logMin + (logMax - logMin) * (i / (numPoints - 1));
    const xVal = Math.pow(10, logX);
    x.push(xVal);
    y.push(evaluate4PL(xVal, params));
  }

  return { x, y };
}

/** Estimate initial parameters from raw data */
function estimateInitialParams(xData: number[], yData: number[]): FitParams {
  const sortedY = [...yData].sort((a, b) => a - b);
  const bottom = sortedY[0];
  const top = sortedY[sortedY.length - 1];
  const midResponse = (bottom + top) / 2;

  // Find x closest to mid-response
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < yData.length; i++) {
    const dist = Math.abs(yData[i] - midResponse);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }
  const ec50 = Math.max(xData[closestIdx] || 1, 1e-12);

  // Determine hill slope sign from data trend
  // Sort by x and check if y generally increases or decreases
  const paired = xData.map((x, i) => ({ x, y: yData[i] })).sort((a, b) => a.x - b.x);
  const firstHalf = paired.slice(0, Math.ceil(paired.length / 2));
  const secondHalf = paired.slice(Math.floor(paired.length / 2));
  const avgFirst = firstHalf.reduce((s, p) => s + p.y, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, p) => s + p.y, 0) / secondHalf.length;
  const hillSlope = avgSecond < avgFirst ? 1 : -1;

  return { bottom, top, ec50, hillSlope };
}

/** Sum of squared residuals (objective function) */
function ssr(xData: number[], yData: number[], params: number[]): number {
  const [bottom, top, logEC50, hillSlope] = params;
  const ec50 = Math.pow(10, logEC50);
  let sum = 0;
  for (let i = 0; i < xData.length; i++) {
    const predicted = bottom + (top - bottom) / (1 + Math.pow(xData[i] / ec50, hillSlope));
    sum += (yData[i] - predicted) ** 2;
  }
  return sum;
}

/**
 * Nelder-Mead simplex optimizer (derivative-free).
 * Minimizes fn(params) over n-dimensional parameter space.
 */
function nelderMead(
  fn: (params: number[]) => number,
  initial: number[],
  maxIter: number = 300
): number[] {
  const n = initial.length;
  const alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;

  // Build initial simplex
  const simplex: { point: number[]; value: number }[] = [];
  simplex.push({ point: [...initial], value: fn(initial) });
  for (let i = 0; i < n; i++) {
    const point = [...initial];
    point[i] = point[i] !== 0 ? point[i] * 1.5 : 0.1;
    simplex.push({ point, value: fn(point) });
  }

  for (let iter = 0; iter < maxIter; iter++) {
    simplex.sort((a, b) => a.value - b.value);

    // Convergence check
    if (simplex[n].value - simplex[0].value < 1e-12) break;

    // Centroid of all points except worst
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += simplex[i].point[j] / n;
      }
    }

    const worst = simplex[n];

    // Reflection
    const reflected = centroid.map((c, j) => c + alpha * (c - worst.point[j]));
    const fr = fn(reflected);

    if (fr < simplex[0].value) {
      // Expansion
      const expanded = centroid.map((c, j) => c + gamma * (reflected[j] - c));
      const fe = fn(expanded);
      simplex[n] = fe < fr
        ? { point: expanded, value: fe }
        : { point: reflected, value: fr };
    } else if (fr < simplex[n - 1].value) {
      simplex[n] = { point: reflected, value: fr };
    } else {
      // Contraction
      const contracted = centroid.map((c, j) => c + rho * (worst.point[j] - c));
      const fc = fn(contracted);
      if (fc < worst.value) {
        simplex[n] = { point: contracted, value: fc };
      } else {
        // Shrink
        for (let i = 1; i <= n; i++) {
          simplex[i].point = simplex[i].point.map((p, j) =>
            simplex[0].point[j] + sigma * (p - simplex[0].point[j])
          );
          simplex[i].value = fn(simplex[i].point);
        }
      }
    }
  }

  simplex.sort((a, b) => a.value - b.value);
  return simplex[0].point;
}

/**
 * Fit a 4-parameter logistic model to dose-response data.
 * Returns fitted parameters and R-squared value.
 */
export function fit4PL(
  xData: number[],
  yData: number[]
): { params: FitParams; rSquared: number } {
  if (xData.length < 3) {
    // Not enough data for fitting, return simple defaults
    return {
      params: { bottom: 0, top: 100, ec50: 1, hillSlope: -1 },
      rSquared: 0,
    };
  }

  // Filter out zero/negative x values for fitting (log scale)
  const validIndices = xData.map((x, i) => (x > 0 ? i : -1)).filter(i => i >= 0);
  const xValid = validIndices.map(i => xData[i]);
  const yValid = validIndices.map(i => yData[i]);

  if (xValid.length < 3) {
    return {
      params: { bottom: 0, top: 100, ec50: 1, hillSlope: -1 },
      rSquared: 0,
    };
  }

  const initial = estimateInitialParams(xValid, yValid);

  // Optimize in log-EC50 space for numerical stability
  const initialParams = [
    initial.bottom,
    initial.top,
    Math.log10(initial.ec50),
    initial.hillSlope,
  ];

  const objective = (params: number[]) => ssr(xValid, yValid, params);
  const optimized = nelderMead(objective, initialParams);

  const params: FitParams = {
    bottom: optimized[0],
    top: optimized[1],
    ec50: Math.pow(10, optimized[2]),
    hillSlope: optimized[3],
  };

  // Calculate R-squared
  const yMean = yValid.reduce((s, y) => s + y, 0) / yValid.length;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < xValid.length; i++) {
    const predicted = evaluate4PL(xValid[i], params);
    ssRes += (yValid[i] - predicted) ** 2;
    ssTot += (yValid[i] - yMean) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { params, rSquared };
}
