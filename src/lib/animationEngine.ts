// ─── Animation Engine ─────────────────────────────────────────────────────────
// Standalone animation data model, interpolation, easing, and persistence.
// No React or Fabric.js dependencies — pure TypeScript.

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlaybackMode = "once" | "loop" | "ping-pong";

export interface KeyframeSelection {
  trackId: string;
  frame: number;
}

export interface ClipboardEntry {
  trackId: string;
  relativeFrame: number;
  properties: Partial<AnimatableProps>;
  easing: EasingType;
}

export type EasingType =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInBack"
  | "easeOutBack"
  | "easeInOutBack"
  | "easeOutBounce"
  | "easeInBounce"
  | "easeInElastic"
  | "easeOutElastic"
  | "easeInOutElastic"
  | "spring"
  | "custom";

export interface AnimatableProps {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** SVG path data string for path morphing between shapes */
  pathData: string;
}

/** Properties that can be numerically interpolated */
export type NumericAnimatableProp = Exclude<keyof AnimatableProps, "fill" | "stroke" | "pathData">;

/** Properties that are colors and need color interpolation */
export type ColorAnimatableProp = Extract<keyof AnimatableProps, "fill" | "stroke">;

/** Properties that need SVG path interpolation */
export type PathAnimatableProp = Extract<keyof AnimatableProps, "pathData">;

export const NUMERIC_PROPS: NumericAnimatableProp[] = [
  "left", "top", "scaleX", "scaleY", "angle", "opacity", "strokeWidth",
];

export const COLOR_PROPS: ColorAnimatableProp[] = ["fill", "stroke"];

export interface Keyframe {
  frame: number;
  properties: Partial<AnimatableProps>;
  easing: EasingType;
  /** Per-property easing overrides — falls back to the main easing if not set */
  propertyEasings?: Partial<Record<keyof AnimatableProps, EasingType>>;
  /** Control points for custom cubic-bezier easing: [x1, y1, x2, y2] */
  customBezier?: [number, number, number, number];
}

export interface AnimationTrack {
  objectId: string;
  objectName: string;
  objectType: string;
  visible: boolean;
  locked: boolean;
  keyframes: Keyframe[];
  /** Optional group membership */
  groupId?: string;
}

export interface TrackGroup {
  id: string;
  name: string;
  collapsed: boolean;
  color?: string;
}

export interface AnimationProject {
  id?: string;
  sourceProjectId: string;
  name: string;
  fps: number;
  duration: number;
  totalFrames: number;
  tracks: AnimationTrack[];
  trackGroups?: TrackGroup[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── Cubic Bezier ─────────────────────────────────────────────────────────────

/**
 * Create a cubic-bezier easing function matching CSS cubic-bezier(x1, y1, x2, y2).
 * Uses Newton's method to solve for t given x, then evaluates y at that t.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (t: number) => number {
  // Coefficients for the bezier polynomial B(t) = at^3 + bt^2 + ct
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t: number): number {
    return ((ax * t + bx) * t + cx) * t;
  }

  function sampleCurveY(t: number): number {
    return ((ay * t + by) * t + cy) * t;
  }

  function sampleCurveDerivativeX(t: number): number {
    return (3 * ax * t + 2 * bx) * t + cx;
  }

  /** Solve for the bezier parameter t given an input x using Newton's method */
  function solveCurveX(x: number): number {
    // Newton's method
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xEstimate = sampleCurveX(t) - x;
      if (Math.abs(xEstimate) < 1e-7) return t;
      const d = sampleCurveDerivativeX(t);
      if (Math.abs(d) < 1e-7) break;
      t -= xEstimate / d;
    }

    // Fall back to bisection
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const xEst = sampleCurveX(t);
      if (Math.abs(xEst - x) < 1e-7) return t;
      if (x > xEst) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
      if (hi - lo < 1e-7) break;
    }
    return t;
  }

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleCurveY(solveCurveX(x));
  };
}

/**
 * Resolve the easing function for a keyframe, handling custom bezier curves.
 */
export function resolveEasingFunction(
  easingType: EasingType,
  customBezierData?: [number, number, number, number]
): (t: number) => number {
  if (easingType === "custom" && customBezierData) {
    return cubicBezier(...customBezierData);
  }
  return easingFunctions[easingType] || easingFunctions.linear;
}

// ─── Easing Functions ─────────────────────────────────────────────────────────

export const easingFunctions: Record<EasingType, (t: number) => number> = {
  // Linear
  linear: (t) => t,

  // Quadratic
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // Cubic
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Back (overshoot)
  easeInBack: (t) => {
    const s = 1.70158;
    return t * t * ((s + 1) * t - s);
  },
  easeOutBack: (t) => {
    const s = 1.70158;
    const t1 = t - 1;
    return t1 * t1 * ((s + 1) * t1 + s) + 1;
  },
  easeInOutBack: (t) => {
    const s = 1.70158 * 1.525;
    if (t < 0.5) {
      return (Math.pow(2 * t, 2) * ((s + 1) * 2 * t - s)) / 2;
    }
    return (Math.pow(2 * t - 2, 2) * ((s + 1) * (2 * t - 2) + s) + 2) / 2;
  },

  // Bounce
  easeOutBounce: (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { const t1 = t - 1.5 / 2.75; return 7.5625 * t1 * t1 + 0.75; }
    if (t < 2.5 / 2.75) { const t1 = t - 2.25 / 2.75; return 7.5625 * t1 * t1 + 0.9375; }
    const t1 = t - 2.625 / 2.75;
    return 7.5625 * t1 * t1 + 0.984375;
  },
  easeInBounce: (t) => {
    return 1 - easingFunctions.easeOutBounce(1 - t);
  },

  // Elastic
  easeInElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
  easeInOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    if (t < 0.5) {
      return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) / 2;
    }
    return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * ((2 * Math.PI) / 4.5))) / 2 + 1;
  },

  // Spring (damped oscillation)
  spring: (t) => {
    return 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-t * 6);
  },

  // Custom — placeholder (actual resolution uses cubicBezier via resolveEasingFunction)
  custom: (t) => t,
};

// ─── Color Utilities ──────────────────────────────────────────────────────────

interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parse a hex color (#rgb, #rrggbb, #rrggbbaa) or rgb()/rgba() to RGB components */
export function parseColor(color: string): RGB | null {
  if (!color || color === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  // Hex
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // rgb() / rgba()
  const rgbMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  return null;
}

/** Convert RGB components back to a hex string */
export function rgbToHex(rgb: RGB): string {
  const r = Math.round(Math.max(0, Math.min(255, rgb.r)));
  const g = Math.round(Math.max(0, Math.min(255, rgb.g)));
  const b = Math.round(Math.max(0, Math.min(255, rgb.b)));
  if (rgb.a < 1) {
    const a = Math.round(Math.max(0, Math.min(255, rgb.a * 255)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`;
  }
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Interpolate between two colors */
export function interpolateColor(
  colorA: string,
  colorB: string,
  t: number
): string {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  if (!a || !b) return t < 0.5 ? colorA : colorB;

  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  });
}

// ─── Interpolation Engine ─────────────────────────────────────────────────────

/** Interpolate a numeric property at a given frame */
export function interpolateNumeric(
  track: AnimationTrack,
  frame: number,
  property: NumericAnimatableProp
): number | undefined {
  const keyframes = track.keyframes
    .filter((kf) => kf.properties[property] !== undefined)
    .sort((a, b) => a.frame - b.frame);

  if (keyframes.length === 0) return undefined;

  // Before first keyframe — hold
  if (frame <= keyframes[0].frame)
    return keyframes[0].properties[property] as number;

  // After last keyframe — hold
  if (frame >= keyframes[keyframes.length - 1].frame)
    return keyframes[keyframes.length - 1].properties[property] as number;

  // Between two keyframes
  for (let i = 0; i < keyframes.length - 1; i++) {
    const kfA = keyframes[i];
    const kfB = keyframes[i + 1];
    if (frame >= kfA.frame && frame <= kfB.frame) {
      const t = (frame - kfA.frame) / (kfB.frame - kfA.frame);
      const propEasing = kfB.propertyEasings?.[property];
      const easingType = propEasing ?? kfB.easing;
      const easing = resolveEasingFunction(easingType, kfB.customBezier);
      const easedT = easing(t);
      const valA = kfA.properties[property] as number;
      const valB = kfB.properties[property] as number;
      return valA + (valB - valA) * easedT;
    }
  }

  return undefined;
}

/** Interpolate a color property at a given frame */
export function interpolateColorProp(
  track: AnimationTrack,
  frame: number,
  property: ColorAnimatableProp
): string | undefined {
  const keyframes = track.keyframes
    .filter((kf) => kf.properties[property] !== undefined)
    .sort((a, b) => a.frame - b.frame);

  if (keyframes.length === 0) return undefined;

  if (frame <= keyframes[0].frame)
    return keyframes[0].properties[property] as string;

  if (frame >= keyframes[keyframes.length - 1].frame)
    return keyframes[keyframes.length - 1].properties[property] as string;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const kfA = keyframes[i];
    const kfB = keyframes[i + 1];
    if (frame >= kfA.frame && frame <= kfB.frame) {
      const t = (frame - kfA.frame) / (kfB.frame - kfA.frame);
      const propEasing = kfB.propertyEasings?.[property];
      const easingType = propEasing ?? kfB.easing;
      const easing = resolveEasingFunction(easingType, kfB.customBezier);
      const easedT = easing(t);
      const colorA = kfA.properties[property] as string;
      const colorB = kfB.properties[property] as string;
      return interpolateColor(colorA, colorB, easedT);
    }
  }

  return undefined;
}

// ─── Path Morphing ──────────────────────────────────────────────────────────

/** Cache for flubber interpolators to avoid re-creating them every frame */
const pathInterpolatorCache = new Map<string, (t: number) => string>();

let flubberModule: { interpolate: (from: string, to: string, opts?: any) => (t: number) => string } | null = null;

async function loadFlubber() {
  if (!flubberModule) {
    try {
      flubberModule = await import('flubber');
    } catch {
      flubberModule = null;
    }
  }
  return flubberModule;
}

// Pre-load flubber on module init (non-blocking)
loadFlubber();

function getPathInterpolator(fromPath: string, toPath: string): (t: number) => string {
  const cacheKey = `${fromPath}|||${toPath}`;
  const cached = pathInterpolatorCache.get(cacheKey);
  if (cached) return cached;

  if (flubberModule) {
    try {
      const interp = flubberModule.interpolate(fromPath, toPath, { maxSegmentLength: 10 });
      pathInterpolatorCache.set(cacheKey, interp);
      // Keep cache bounded
      if (pathInterpolatorCache.size > 100) {
        const firstKey = pathInterpolatorCache.keys().next().value;
        if (firstKey) pathInterpolatorCache.delete(firstKey);
      }
      return interp;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: snap to target at t >= 0.5
  const fallback = (t: number) => t < 0.5 ? fromPath : toPath;
  pathInterpolatorCache.set(cacheKey, fallback);
  return fallback;
}

/** Clear the path interpolator cache (e.g., when project changes) */
export function clearPathInterpolatorCache(): void {
  pathInterpolatorCache.clear();
}

/** Interpolate a pathData property at a given frame */
export function interpolatePathProp(
  track: AnimationTrack,
  frame: number,
): string | undefined {
  const keyframes = track.keyframes
    .filter((kf) => kf.properties.pathData !== undefined)
    .sort((a, b) => a.frame - b.frame);

  if (keyframes.length === 0) return undefined;

  if (frame <= keyframes[0].frame)
    return keyframes[0].properties.pathData as string;

  if (frame >= keyframes[keyframes.length - 1].frame)
    return keyframes[keyframes.length - 1].properties.pathData as string;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const kfA = keyframes[i];
    const kfB = keyframes[i + 1];
    if (frame >= kfA.frame && frame <= kfB.frame) {
      const t = (frame - kfA.frame) / (kfB.frame - kfA.frame);
      const propEasing = kfB.propertyEasings?.pathData;
      const easingType = propEasing ?? kfB.easing;
      const easing = resolveEasingFunction(easingType, kfB.customBezier);
      const easedT = easing(t);
      const pathA = kfA.properties.pathData as string;
      const pathB = kfB.properties.pathData as string;
      const interpolator = getPathInterpolator(pathA, pathB);
      return interpolator(easedT);
    }
  }

  return undefined;
}

// ─── Frame Rendering ──────────────────────────────────────────────────────────

/** Compute all interpolated property values for a track at a given frame */
export function getInterpolatedValues(
  track: AnimationTrack,
  frame: number
): Partial<AnimatableProps> {
  const result: Partial<AnimatableProps> = {};

  for (const prop of NUMERIC_PROPS) {
    const val = interpolateNumeric(track, frame, prop);
    if (val !== undefined) {
      (result as any)[prop] = val;
    }
  }

  for (const prop of COLOR_PROPS) {
    const val = interpolateColorProp(track, frame, prop);
    if (val !== undefined) {
      (result as any)[prop] = val;
    }
  }

  // Path morphing
  const pathVal = interpolatePathProp(track, frame);
  if (pathVal !== undefined) {
    (result as any).pathData = pathVal;
  }

  return result;
}

// ─── Track Helpers ────────────────────────────────────────────────────────────

/** Helper object filter — matches the filter used in CanvasContext */
export function isHelperObject(obj: any): boolean {
  // Explicit helper flags
  if (
    obj.isGridLine || obj.isRuler || obj.isEraserPath || obj.isEndpointMarker ||
    obj.isDimensionLabel || obj.isGuideLine || obj.isSpacingGuide ||
    obj.isConnectionPoint || obj.isAnchorHandle || obj.isControlHandle || obj.isHandleLine ||
    obj.isOnionSkin || obj.isPathPreview
  ) return true;

  return false;
}

/** Capture current animatable properties from an object */
export function captureObjectProps(obj: any): Partial<AnimatableProps> {
  const props: Partial<AnimatableProps> = {
    left: obj.left ?? 0,
    top: obj.top ?? 0,
    scaleX: obj.scaleX ?? 1,
    scaleY: obj.scaleY ?? 1,
    angle: obj.angle ?? 0,
    opacity: obj.opacity ?? 1,
  };

  // Only capture color/stroke if they are simple strings (not gradients/patterns)
  if (typeof obj.fill === "string") props.fill = obj.fill;
  if (typeof obj.stroke === "string") props.stroke = obj.stroke;
  if (typeof obj.strokeWidth === "number") props.strokeWidth = obj.strokeWidth;

  // Capture SVG path data for path morphing
  if (obj.path && Array.isArray(obj.path)) {
    // Fabric.js Path object — convert path array to SVG d string
    try {
      const d = obj.path.map((seg: any[]) => seg.join(' ')).join(' ');
      if (d) props.pathData = d;
    } catch { /* skip if path is malformed */ }
  } else if (typeof obj.d === 'string') {
    props.pathData = obj.d;
  }

  return props;
}

/** Create a new track from a canvas object */
export function createTrackFromObject(
  obj: any,
  index: number
): AnimationTrack {
  const objectId = (obj.id as string) || `obj_${index}`;
  const objectName = (obj.name as string) || obj.type || `Object ${index + 1}`;
  const objectType = obj.type || "object";

  return {
    objectId,
    objectName,
    objectType,
    visible: true,
    locked: false,
    keyframes: [
      {
        frame: 0,
        properties: captureObjectProps(obj),
        easing: "linear" as EasingType,
      },
    ],
  };
}

/** Create a new animation project from tracks */
export function createAnimationProject(
  sourceProjectId: string,
  name: string,
  tracks: AnimationTrack[],
  fps = 24,
  duration = 5
): AnimationProject {
  return {
    sourceProjectId,
    name,
    fps,
    duration,
    totalFrames: fps * duration,
    tracks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Keyframe Operations ──────────────────────────────────────────────────────

/** Add or replace a keyframe on a track */
export function upsertKeyframe(
  track: AnimationTrack,
  keyframe: Keyframe
): AnimationTrack {
  const existingIdx = track.keyframes.findIndex(
    (kf) => kf.frame === keyframe.frame
  );

  let newKeyframes: Keyframe[];
  if (existingIdx >= 0) {
    newKeyframes = [...track.keyframes];
    newKeyframes[existingIdx] = keyframe;
  } else {
    newKeyframes = [...track.keyframes, keyframe].sort(
      (a, b) => a.frame - b.frame
    );
  }

  return { ...track, keyframes: newKeyframes };
}

/** Delete a keyframe by index (won't delete the last remaining keyframe) */
export function deleteKeyframe(
  track: AnimationTrack,
  keyframeIndex: number
): AnimationTrack {
  if (track.keyframes.length <= 1) return track;
  return {
    ...track,
    keyframes: track.keyframes.filter((_, i) => i !== keyframeIndex),
  };
}

/** Update the easing of a specific keyframe */
export function updateKeyframeEasing(
  track: AnimationTrack,
  keyframeIndex: number,
  easing: EasingType
): AnimationTrack {
  const newKeyframes = [...track.keyframes];
  newKeyframes[keyframeIndex] = { ...newKeyframes[keyframeIndex], easing };
  return { ...track, keyframes: newKeyframes };
}

// ─── Project Duration ─────────────────────────────────────────────────────────

/** Update FPS and recalculate total frames */
export function updateProjectFps(
  project: AnimationProject,
  fps: number
): AnimationProject {
  return {
    ...project,
    fps,
    totalFrames: fps * project.duration,
    updatedAt: new Date().toISOString(),
  };
}

/** Update duration and recalculate total frames */
export function updateProjectDuration(
  project: AnimationProject,
  duration: number
): AnimationProject {
  return {
    ...project,
    duration,
    totalFrames: project.fps * duration,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Time Formatting ──────────────────────────────────────────────────────────

/** Format a frame number as mm:ss:ff */
export function formatFrameTime(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = frame % fps;

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
  }
  return `${seconds}:${String(frames).padStart(2, "0")}`;
}

// ─── LocalStorage Persistence ─────────────────────────────────────────────────

const STORAGE_PREFIX = "biosketch_anim_";

/** Save an animation project to localStorage */
export function saveAnimationToLocal(project: AnimationProject): string {
  const id = project.id || `anim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const projectWithId: AnimationProject = {
    ...project,
    id,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${id}`,
      JSON.stringify(projectWithId)
    );

    // Update the index
    const index = getAnimationIndex();
    const entry = {
      id,
      name: project.name,
      sourceProjectId: project.sourceProjectId,
      updatedAt: projectWithId.updatedAt!,
      trackCount: project.tracks.length,
      duration: project.duration,
      fps: project.fps,
    };
    const existingIdx = index.findIndex((e) => e.id === id);
    if (existingIdx >= 0) {
      index[existingIdx] = entry;
    } else {
      index.push(entry);
    }
    localStorage.setItem(`${STORAGE_PREFIX}index`, JSON.stringify(index));

    return id;
  } catch (err) {
    console.error("Failed to save animation to localStorage:", err);
    throw err;
  }
}

/** Load an animation project from localStorage */
export function loadAnimationFromLocal(id: string): AnimationProject | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as AnimationProject;
  } catch (err) {
    console.error("Failed to load animation from localStorage:", err);
    return null;
  }
}

/** Load an animation project by source project ID (most recent) */
export function loadAnimationBySourceId(
  sourceProjectId: string
): AnimationProject | null {
  const index = getAnimationIndex();
  const entries = index
    .filter((e) => e.sourceProjectId === sourceProjectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (entries.length === 0) return null;
  return loadAnimationFromLocal(entries[0].id);
}

/** Delete an animation project from localStorage */
export function deleteAnimationFromLocal(id: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);

    const index = getAnimationIndex().filter((e) => e.id !== id);
    localStorage.setItem(`${STORAGE_PREFIX}index`, JSON.stringify(index));
  } catch (err) {
    console.error("Failed to delete animation from localStorage:", err);
  }
}

interface AnimationIndexEntry {
  id: string;
  name: string;
  sourceProjectId: string;
  updatedAt: string;
  trackCount: number;
  duration: number;
  fps: number;
}

/** Get all saved animation project entries */
export function getAnimationIndex(): AnimationIndexEntry[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}index`);
    if (!raw) return [];
    return JSON.parse(raw) as AnimationIndexEntry[];
  } catch {
    return [];
  }
}
