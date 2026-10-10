// ─── Lottie JSON Builder ──────────────────────────────────────────────────────
// Converts AnimationProject data to Lottie (bodymovin) JSON format.
// Supports position, scale, rotation, opacity animations.

import type { AnimationProject, AnimationTrack, Keyframe, EasingType } from "./animationEngine";

// ─── Lottie Easing Mappings ──────────────────────────────────────────────────

/** Maps our easing types to Lottie cubic-bezier control points [outX, outY, inX, inY] */
const EASING_TO_BEZIER: Record<string, { o: { x: number[]; y: number[] }; i: { x: number[]; y: number[] } }> = {
  linear:         { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
  easeIn:         { o: { x: [0.42], y: [0] }, i: { x: [1], y: [1] } },
  easeOut:        { o: { x: [0], y: [0] }, i: { x: [0.58], y: [1] } },
  easeInOut:      { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } },
  easeInCubic:    { o: { x: [0.32], y: [0] }, i: { x: [0.67], y: [1] } },
  easeOutCubic:   { o: { x: [0.33], y: [1] }, i: { x: [0.68], y: [1] } },
  easeInOutCubic: { o: { x: [0.65], y: [0] }, i: { x: [0.35], y: [1] } },
  easeInBack:     { o: { x: [0.6], y: [-0.28] }, i: { x: [0.735], y: [0.045] } },
  easeOutBack:    { o: { x: [0.175], y: [0.885] }, i: { x: [0.32], y: [1.275] } },
  easeOutBounce:  { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } }, // Approximation
  easeInElastic:  { o: { x: [0.5], y: [0] }, i: { x: [1], y: [1] } },    // Approximation
  easeOutElastic: { o: { x: [0], y: [0] }, i: { x: [0.5], y: [1] } },    // Approximation
};

function getEasingBezier(easing: EasingType, customBezier?: [number, number, number, number]) {
  if (easing === "custom" && customBezier) {
    return {
      o: { x: [customBezier[0]], y: [customBezier[1]] },
      i: { x: [customBezier[2]], y: [customBezier[3]] },
    };
  }
  return EASING_TO_BEZIER[easing] ?? EASING_TO_BEZIER.linear;
}

// ─── Lottie Keyframe Builders ────────────────────────────────────────────────

interface LottieKeyframe {
  t: number; // frame
  s: number[]; // start value(s)
  e?: number[]; // end value(s)  (omitted on last keyframe)
  o?: { x: number[]; y: number[] }; // out tangent
  i?: { x: number[]; y: number[] }; // in tangent
}

function buildPropertyKeyframes(
  track: AnimationTrack,
  propNames: (keyof import("./animationEngine").AnimatableProps)[],
  defaultValues: number[],
): LottieKeyframe[] {
  const kfs = track.keyframes;
  if (kfs.length === 0) return [];

  const result: LottieKeyframe[] = [];

  for (let i = 0; i < kfs.length; i++) {
    const kf = kfs[i];
    const values = propNames.map((p, idx) =>
      kf.properties[p] !== undefined ? (kf.properties[p] as number) : defaultValues[idx]
    );

    const lottieKf: LottieKeyframe = {
      t: kf.frame,
      s: values,
    };

    if (i < kfs.length - 1) {
      const nextKf = kfs[i + 1];
      const nextValues = propNames.map((p, idx) =>
        nextKf.properties[p] !== undefined ? (nextKf.properties[p] as number) : defaultValues[idx]
      );
      lottieKf.e = nextValues;

      const bezier = getEasingBezier(kf.easing, kf.customBezier);
      lottieKf.o = bezier.o;
      lottieKf.i = bezier.i;
    }

    result.push(lottieKf);
  }

  return result;
}

// ─── Main Builder ────────────────────────────────────────────────────────────

export function buildLottieJSON(
  animProject: AnimationProject,
  canvasWidth: number,
  canvasHeight: number,
): Record<string, unknown> {
  const layers: Record<string, unknown>[] = [];

  // Process tracks in reverse (Lottie renders bottom layer first)
  const reversedTracks = [...animProject.tracks].reverse();

  reversedTracks.forEach((track, idx) => {
    const positionKfs = buildPropertyKeyframes(track, ["left", "top"], [0, 0]);
    const scaleKfs = buildPropertyKeyframes(track, ["scaleX", "scaleY"], [1, 1]);
    const rotationKfs = buildPropertyKeyframes(track, ["angle"], [0]);
    const opacityKfs = buildPropertyKeyframes(track, ["opacity"], [1]);

    // Convert scale from multiplier to percentage (Lottie uses 0-100)
    scaleKfs.forEach((kf) => {
      kf.s = kf.s.map((v) => v * 100);
      if (kf.e) kf.e = kf.e.map((v) => v * 100);
    });

    // Convert opacity from 0-1 to 0-100
    opacityKfs.forEach((kf) => {
      kf.s = kf.s.map((v) => v * 100);
      if (kf.e) kf.e = kf.e.map((v) => v * 100);
    });

    const layer: Record<string, unknown> = {
      ddd: 0,
      ind: idx,
      ty: 4, // Shape layer
      nm: track.objectName,
      sr: 1,
      ks: {
        o: opacityKfs.length > 0
          ? { a: opacityKfs.length > 1 ? 1 : 0, k: opacityKfs.length > 1 ? opacityKfs : opacityKfs[0]?.s[0] ?? 100 }
          : { a: 0, k: 100 },
        r: rotationKfs.length > 0
          ? { a: rotationKfs.length > 1 ? 1 : 0, k: rotationKfs.length > 1 ? rotationKfs : rotationKfs[0]?.s[0] ?? 0 }
          : { a: 0, k: 0 },
        p: positionKfs.length > 0
          ? { a: positionKfs.length > 1 ? 1 : 0, k: positionKfs.length > 1 ? positionKfs : positionKfs[0]?.s ?? [0, 0] }
          : { a: 0, k: [0, 0] },
        s: scaleKfs.length > 0
          ? { a: scaleKfs.length > 1 ? 1 : 0, k: scaleKfs.length > 1 ? scaleKfs : scaleKfs[0]?.s ?? [100, 100] }
          : { a: 0, k: [100, 100] },
        a: { a: 0, k: [0, 0, 0] }, // Anchor point
      },
      ip: 0,
      op: animProject.totalFrames,
      st: 0,
      bm: 0,
      // Placeholder shape (rectangle) since we can't fully convert Fabric objects
      shapes: [
        {
          ty: "rc",
          d: 1,
          s: { a: 0, k: [50, 50] },
          p: { a: 0, k: [0, 0] },
          r: { a: 0, k: 0 },
        },
        {
          ty: "fl",
          c: { a: 0, k: [0.545, 0.361, 0.965, 1] }, // Purple fill
          o: { a: 0, k: 100 },
          r: 1,
          bm: 0,
        },
      ],
    };

    layers.push(layer);
  });

  return {
    v: "5.7.4",
    fr: animProject.fps,
    ip: 0,
    op: animProject.totalFrames,
    w: canvasWidth,
    h: canvasHeight,
    nm: animProject.name || "Animation",
    ddd: 0,
    assets: [],
    layers,
    markers: [],
  };
}
