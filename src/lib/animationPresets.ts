// ─── Animation Presets ──────────────────────────────────────────────────────
// Pure functions — no React or Fabric.js dependencies.

import type { Keyframe, EasingType, AnimatableProps, AnimationTrack } from "./animationEngine";
import { captureObjectProps } from "./animationEngine";

export interface AnimationPreset {
  id: string;
  name: string;
  icon: string; // lucide icon name
  category: "entrance" | "exit" | "emphasis" | "motion";
  description: string;
  /** Generate keyframes for this preset given current object state */
  generate: (opts: {
    currentProps: Partial<AnimatableProps>;
    startFrame: number;
    endFrame: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => Keyframe[];
}

export interface StaggerOptions {
  presetId: string;
  /** Delay in frames between each object's animation start */
  staggerDelay: number;
  /** Order: 'normal' = first-to-last, 'reverse' = last-to-first, 'center' = center-outward */
  order: 'normal' | 'reverse' | 'center';
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function kf(
  frame: number,
  properties: Partial<AnimatableProps>,
  easing: EasingType = "linear",
): Keyframe {
  return { frame, properties, easing };
}

/** Linearly interpolate a frame between start and end by ratio (0–1). */
function lerpFrame(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

// ─── Presets ────────────────────────────────────────────────────────────────

export const ANIMATION_PRESETS: AnimationPreset[] = [
  // ── Entrance ────────────────────────────────────────────────────────────
  {
    id: "fade-in",
    name: "Fade In",
    icon: "SunMedium",
    category: "entrance",
    description: "Opacity 0 → 1 over the duration",
    generate: ({ currentProps, startFrame, endFrame }) => [
      kf(startFrame, { ...currentProps, opacity: 0 }, "easeOut"),
      kf(endFrame, { ...currentProps, opacity: 1 }),
    ],
  },
  {
    id: "scale-up",
    name: "Scale Up",
    icon: "Maximize2",
    category: "entrance",
    description: "Grow from nothing to full size",
    generate: ({ currentProps, startFrame, endFrame }) => [
      kf(startFrame, { ...currentProps, scaleX: 0, scaleY: 0 }, "easeOutCubic"),
      kf(endFrame, { ...currentProps }),
    ],
  },
  {
    id: "slide-left",
    name: "Slide Left",
    icon: "ArrowLeft",
    category: "entrance",
    description: "Slide in from the right edge",
    generate: ({ currentProps, startFrame, endFrame, canvasWidth }) => [
      kf(startFrame, { ...currentProps, left: canvasWidth + 100 }, "easeOut"),
      kf(endFrame, { ...currentProps }),
    ],
  },
  {
    id: "slide-right",
    name: "Slide Right",
    icon: "ArrowRight",
    category: "entrance",
    description: "Slide in from the left edge",
    generate: ({ currentProps, startFrame, endFrame }) => [
      kf(startFrame, { ...currentProps, left: -100 }, "easeOut"),
      kf(endFrame, { ...currentProps }),
    ],
  },
  {
    id: "slide-up",
    name: "Slide Up",
    icon: "ArrowUp",
    category: "entrance",
    description: "Slide in from below the canvas",
    generate: ({ currentProps, startFrame, endFrame, canvasHeight }) => [
      kf(startFrame, { ...currentProps, top: canvasHeight + 100 }, "easeOut"),
      kf(endFrame, { ...currentProps }),
    ],
  },
  {
    id: "slide-down",
    name: "Slide Down",
    icon: "ArrowDown",
    category: "entrance",
    description: "Slide in from above the canvas",
    generate: ({ currentProps, startFrame, endFrame }) => [
      kf(startFrame, { ...currentProps, top: -100 }, "easeOut"),
      kf(endFrame, { ...currentProps }),
    ],
  },
  {
    id: "bounce-in",
    name: "Bounce In",
    icon: "ArrowDownToLine",
    category: "entrance",
    description: "Bouncy scale entrance (0 → 1.15 → 0.9 → 1)",
    generate: ({ currentProps, startFrame, endFrame }) => {
      const sx = currentProps.scaleX ?? 1;
      const sy = currentProps.scaleY ?? 1;
      return [
        kf(startFrame, { ...currentProps, scaleX: 0, scaleY: 0 }, "easeOutBounce"),
        kf(lerpFrame(startFrame, endFrame, 0.5), { ...currentProps, scaleX: sx * 1.15, scaleY: sy * 1.15 }, "easeOutBounce"),
        kf(lerpFrame(startFrame, endFrame, 0.75), { ...currentProps, scaleX: sx * 0.9, scaleY: sy * 0.9 }, "easeOutBounce"),
        kf(endFrame, { ...currentProps }),
      ];
    },
  },
  {
    id: "pop",
    name: "Pop",
    icon: "Sparkles",
    category: "entrance",
    description: "Pop in with slight overshoot (0 → 1.1 → 1)",
    generate: ({ currentProps, startFrame, endFrame }) => {
      const sx = currentProps.scaleX ?? 1;
      const sy = currentProps.scaleY ?? 1;
      return [
        kf(startFrame, { ...currentProps, scaleX: 0, scaleY: 0 }, "easeOutBack"),
        kf(lerpFrame(startFrame, endFrame, 0.65), { ...currentProps, scaleX: sx * 1.1, scaleY: sy * 1.1 }, "easeOutBack"),
        kf(endFrame, { ...currentProps }),
      ];
    },
  },

  // ── Exit ────────────────────────────────────────────────────────────────
  {
    id: "fade-out",
    name: "Fade Out",
    icon: "Moon",
    category: "exit",
    description: "Opacity 1 → 0 over the duration",
    generate: ({ currentProps, startFrame, endFrame }) => [
      kf(startFrame, { ...currentProps, opacity: 1 }, "easeIn"),
      kf(endFrame, { ...currentProps, opacity: 0 }),
    ],
  },
  {
    id: "scale-down",
    name: "Scale Down",
    icon: "Minimize2",
    category: "exit",
    description: "Shrink to nothing",
    generate: ({ currentProps, startFrame, endFrame }) => [
      kf(startFrame, { ...currentProps }, "easeInCubic"),
      kf(endFrame, { ...currentProps, scaleX: 0, scaleY: 0 }),
    ],
  },

  // ── Emphasis ────────────────────────────────────────────────────────────
  {
    id: "pulse",
    name: "Pulse",
    icon: "Activity",
    category: "emphasis",
    description: "Scale 1 → 1.2 → 1",
    generate: ({ currentProps, startFrame, endFrame }) => {
      const sx = currentProps.scaleX ?? 1;
      const sy = currentProps.scaleY ?? 1;
      return [
        kf(startFrame, { ...currentProps }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.5), { ...currentProps, scaleX: sx * 1.2, scaleY: sy * 1.2 }, "easeInOut"),
        kf(endFrame, { ...currentProps }),
      ];
    },
  },

  {
    id: "glow-pulse",
    name: "Glow Pulse",
    icon: "Zap",
    category: "emphasis",
    description: "Pulse strokeWidth up to 3x and back — highlight a membrane",
    generate: ({ currentProps, startFrame, endFrame }) => {
      const sw = currentProps.strokeWidth ?? 2;
      return [
        kf(startFrame, { ...currentProps }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.25), { ...currentProps, strokeWidth: sw * 3, opacity: 0.85 }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.5), { ...currentProps, strokeWidth: sw, opacity: 1 }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.75), { ...currentProps, strokeWidth: sw * 2, opacity: 0.9 }, "easeInOut"),
        kf(endFrame, { ...currentProps }),
      ];
    },
  },
  {
    id: "color-flash",
    name: "Color Flash",
    icon: "Palette",
    category: "emphasis",
    description: "Flash fill to amber highlight then back — spotlight an organelle",
    generate: ({ currentProps, startFrame, endFrame }) => {
      const origFill = currentProps.fill ?? "#ffffff";
      return [
        kf(startFrame, { ...currentProps }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.3), { ...currentProps, fill: "#fbbf24" }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.7), { ...currentProps, fill: "#fbbf24" }, "easeInOut"),
        kf(endFrame, { ...currentProps, fill: origFill }),
      ];
    },
  },
  {
    id: "scale-pulse",
    name: "Scale Pulse",
    icon: "HeartPulse",
    category: "emphasis",
    description: "Double bounce scale 1 → 1.2 → 1 → 1.2 → 1",
    generate: ({ currentProps, startFrame, endFrame }) => {
      const sx = currentProps.scaleX ?? 1;
      const sy = currentProps.scaleY ?? 1;
      return [
        kf(startFrame, { ...currentProps }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.25), { ...currentProps, scaleX: sx * 1.2, scaleY: sy * 1.2 }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.5), { ...currentProps }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.75), { ...currentProps, scaleX: sx * 1.2, scaleY: sy * 1.2 }, "easeInOut"),
        kf(endFrame, { ...currentProps }),
      ];
    },
  },
  {
    id: "fade-blink",
    name: "Fade Blink",
    icon: "Eye",
    category: "emphasis",
    description: "Rapid opacity blink 1 → 0.2 → 1 → 0.2 → 1",
    generate: ({ currentProps, startFrame, endFrame }) => [
      kf(startFrame, { ...currentProps, opacity: 1 }, "linear"),
      kf(lerpFrame(startFrame, endFrame, 0.2), { ...currentProps, opacity: 0.2 }, "linear"),
      kf(lerpFrame(startFrame, endFrame, 0.4), { ...currentProps, opacity: 1 }, "linear"),
      kf(lerpFrame(startFrame, endFrame, 0.6), { ...currentProps, opacity: 0.2 }, "linear"),
      kf(lerpFrame(startFrame, endFrame, 0.8), { ...currentProps, opacity: 1 }, "linear"),
      kf(endFrame, { ...currentProps, opacity: 1 }),
    ],
  },
  {
    id: "wiggle",
    name: "Wiggle",
    icon: "Vibrate",
    category: "emphasis",
    description: "Small rapid angle oscillation for playful emphasis",
    generate: ({ currentProps, startFrame, endFrame }) => {
      const baseAngle = currentProps.angle ?? 0;
      return [
        kf(startFrame, { ...currentProps, angle: baseAngle }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.2), { ...currentProps, angle: baseAngle - 5 }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.4), { ...currentProps, angle: baseAngle + 5 }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.6), { ...currentProps, angle: baseAngle - 5 }, "easeInOut"),
        kf(lerpFrame(startFrame, endFrame, 0.8), { ...currentProps, angle: baseAngle + 3 }, "easeInOut"),
        kf(endFrame, { ...currentProps, angle: baseAngle }),
      ];
    },
  },

  // ── Motion ──────────────────────────────────────────────────────────────
  {
    id: "spin",
    name: "Spin",
    icon: "RotateCw",
    category: "motion",
    description: "Full 360° rotation",
    generate: ({ currentProps, startFrame, endFrame }) => {
      const baseAngle = currentProps.angle ?? 0;
      return [
        kf(startFrame, { ...currentProps, angle: baseAngle }, "linear"),
        kf(endFrame, { ...currentProps, angle: baseAngle + 360 }),
      ];
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getPresetsByCategory(
  category?: AnimationPreset["category"],
): AnimationPreset[] {
  if (!category) return ANIMATION_PRESETS;
  return ANIMATION_PRESETS.filter((p) => p.category === category);
}

export function getPresetById(id: string): AnimationPreset | undefined {
  return ANIMATION_PRESETS.find((p) => p.id === id);
}

/**
 * Generate staggered keyframes for multiple tracks using the same preset.
 * Each track starts its animation `staggerDelay` frames after the previous one.
 * Returns a map of trackId → keyframes.
 */
export function generateStaggeredKeyframes(
  tracks: AnimationTrack[],
  objectMap: Map<string, any>,
  options: StaggerOptions & {
    startFrame: number;
    durationPerObject: number;
    canvasWidth: number;
    canvasHeight: number;
  },
): Map<string, Keyframe[]> {
  const preset = getPresetById(options.presetId);
  if (!preset) return new Map();

  const result = new Map<string, Keyframe[]>();

  // Determine order
  let ordered = [...tracks];
  if (options.order === 'reverse') {
    ordered.reverse();
  } else if (options.order === 'center') {
    // Center-outward: middle first, then expand alternately
    const mid = Math.floor(ordered.length / 2);
    const centered: AnimationTrack[] = [];
    for (let i = 0; i <= mid; i++) {
      if (mid + i < ordered.length) centered.push(ordered[mid + i]);
      if (i > 0 && mid - i >= 0) centered.push(ordered[mid - i]);
    }
    ordered = centered;
  }

  ordered.forEach((track, index) => {
    const obj = objectMap.get(track.objectId);
    if (!obj) return;

    const currentProps = captureObjectProps(obj);
    const trackStart = options.startFrame + index * options.staggerDelay;
    const trackEnd = trackStart + options.durationPerObject;

    const keyframes = preset.generate({
      currentProps,
      startFrame: trackStart,
      endFrame: trackEnd,
      canvasWidth: options.canvasWidth,
      canvasHeight: options.canvasHeight,
    });

    result.set(track.objectId, keyframes);
  });

  return result;
}
