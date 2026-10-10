// ─── Animation Templates ─────────────────────────────────────────────────────
// Multi-keyframe animation sequences that can be saved, loaded, and applied.
// Templates store relative keyframe data that adapts to any object's position.

import type { Keyframe, EasingType, AnimatableProps } from "./animationEngine";

export interface AnimationTemplate {
  id: string;
  name: string;
  category: "entrance" | "exit" | "emphasis" | "motion" | "custom";
  description: string;
  /** Duration in frames at 30fps (scaled proportionally for other fps) */
  durationFrames: number;
  /** Whether keyframe positions are relative to current object position */
  relative: boolean;
  /** The keyframe data — frame offsets from start + property deltas */
  keyframes: TemplateKeyframe[];
}

interface TemplateKeyframe {
  /** Frame offset from the template start (0 = first frame) */
  frameOffset: number;
  /** Property values — if relative, these are deltas from current state */
  properties: Partial<AnimatableProps>;
  easing: EasingType;
}

// ─── Built-in Templates ────────────────────────────────────────────────────

export const BUILT_IN_TEMPLATES: AnimationTemplate[] = [
  // ── Entrance ─────────────────────────────────────────────────────────
  {
    id: "typewriter-reveal",
    name: "Typewriter Reveal",
    category: "entrance",
    description: "Fade in while sliding from left, like a typewriter",
    durationFrames: 30,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { opacity: 0, left: -40 }, easing: "easeOutCubic" },
      { frameOffset: 8, properties: { opacity: 1, left: 0 }, easing: "easeOutCubic" },
      { frameOffset: 30, properties: { opacity: 1, left: 0 }, easing: "linear" },
    ],
  },
  {
    id: "drop-in",
    name: "Drop In",
    category: "entrance",
    description: "Fall from above with bounce landing",
    durationFrames: 45,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { top: -200, opacity: 0 }, easing: "easeInCubic" },
      { frameOffset: 20, properties: { top: 10, opacity: 1 }, easing: "easeOutCubic" },
      { frameOffset: 30, properties: { top: -5 }, easing: "easeInOut" },
      { frameOffset: 38, properties: { top: 3 }, easing: "easeInOut" },
      { frameOffset: 45, properties: { top: 0 }, easing: "easeOut" },
    ],
  },
  {
    id: "zoom-blur-in",
    name: "Zoom Blur In",
    category: "entrance",
    description: "Zoom from 3x down to 1x with fade",
    durationFrames: 24,
    relative: false,
    keyframes: [
      { frameOffset: 0, properties: { scaleX: 3, scaleY: 3, opacity: 0 }, easing: "easeOutCubic" },
      { frameOffset: 24, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "linear" },
    ],
  },
  {
    id: "flip-in",
    name: "Flip In",
    category: "entrance",
    description: "Flip in with rotation and scale",
    durationFrames: 30,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { angle: -90, scaleX: 0.5, scaleY: 0.5, opacity: 0 }, easing: "easeOutBack" },
      { frameOffset: 20, properties: { angle: 5, scaleX: 1.05, scaleY: 1.05, opacity: 1 }, easing: "easeOut" },
      { frameOffset: 30, properties: { angle: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: "linear" },
    ],
  },

  // ── Exit ─────────────────────────────────────────────────────────────
  {
    id: "fly-away",
    name: "Fly Away",
    category: "exit",
    description: "Shrink and float upward while fading",
    durationFrames: 30,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { top: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeInCubic" },
      { frameOffset: 30, properties: { top: -150, scaleX: 0.3, scaleY: 0.3, opacity: 0 }, easing: "linear" },
    ],
  },
  {
    id: "dissolve-out",
    name: "Dissolve Out",
    category: "exit",
    description: "Slow scale up with fade out",
    durationFrames: 40,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { scaleX: 1, scaleY: 1, opacity: 1 }, easing: "easeIn" },
      { frameOffset: 40, properties: { scaleX: 1.3, scaleY: 1.3, opacity: 0 }, easing: "linear" },
    ],
  },

  // ── Emphasis ─────────────────────────────────────────────────────────
  {
    id: "shake",
    name: "Shake",
    category: "emphasis",
    description: "Quick horizontal shake to draw attention",
    durationFrames: 20,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { left: 0 }, easing: "easeInOut" },
      { frameOffset: 3, properties: { left: -12 }, easing: "easeInOut" },
      { frameOffset: 6, properties: { left: 10 }, easing: "easeInOut" },
      { frameOffset: 9, properties: { left: -8 }, easing: "easeInOut" },
      { frameOffset: 12, properties: { left: 6 }, easing: "easeInOut" },
      { frameOffset: 15, properties: { left: -3 }, easing: "easeInOut" },
      { frameOffset: 20, properties: { left: 0 }, easing: "easeOut" },
    ],
  },
  {
    id: "heartbeat",
    name: "Heartbeat",
    category: "emphasis",
    description: "Two quick pulses like a heartbeat",
    durationFrames: 30,
    relative: false,
    keyframes: [
      { frameOffset: 0, properties: { scaleX: 1, scaleY: 1 }, easing: "easeOut" },
      { frameOffset: 5, properties: { scaleX: 1.25, scaleY: 1.25 }, easing: "easeIn" },
      { frameOffset: 10, properties: { scaleX: 1, scaleY: 1 }, easing: "easeOut" },
      { frameOffset: 14, properties: { scaleX: 1.15, scaleY: 1.15 }, easing: "easeIn" },
      { frameOffset: 20, properties: { scaleX: 1, scaleY: 1 }, easing: "linear" },
      { frameOffset: 30, properties: { scaleX: 1, scaleY: 1 }, easing: "linear" },
    ],
  },
  {
    id: "jello",
    name: "Jello",
    category: "emphasis",
    description: "Wobbly skew effect",
    durationFrames: 30,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { angle: 0 }, easing: "easeInOut" },
      { frameOffset: 5, properties: { angle: -8 }, easing: "easeInOut" },
      { frameOffset: 10, properties: { angle: 5 }, easing: "easeInOut" },
      { frameOffset: 15, properties: { angle: -3 }, easing: "easeInOut" },
      { frameOffset: 20, properties: { angle: 2 }, easing: "easeInOut" },
      { frameOffset: 25, properties: { angle: -1 }, easing: "easeOut" },
      { frameOffset: 30, properties: { angle: 0 }, easing: "linear" },
    ],
  },
  {
    id: "glow-pulse",
    name: "Glow Pulse",
    category: "emphasis",
    description: "Opacity pulsing glow effect",
    durationFrames: 40,
    relative: false,
    keyframes: [
      { frameOffset: 0, properties: { opacity: 1 }, easing: "easeInOut" },
      { frameOffset: 10, properties: { opacity: 0.4 }, easing: "easeInOut" },
      { frameOffset: 20, properties: { opacity: 1 }, easing: "easeInOut" },
      { frameOffset: 30, properties: { opacity: 0.6 }, easing: "easeInOut" },
      { frameOffset: 40, properties: { opacity: 1 }, easing: "linear" },
    ],
  },

  // ── Motion ───────────────────────────────────────────────────────────
  {
    id: "orbit",
    name: "Orbit",
    category: "motion",
    description: "Circular orbit path (approximated with keyframes)",
    durationFrames: 60,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { left: 0, top: -80 }, easing: "easeInOut" },
      { frameOffset: 15, properties: { left: 80, top: 0 }, easing: "easeInOut" },
      { frameOffset: 30, properties: { left: 0, top: 80 }, easing: "easeInOut" },
      { frameOffset: 45, properties: { left: -80, top: 0 }, easing: "easeInOut" },
      { frameOffset: 60, properties: { left: 0, top: -80 }, easing: "linear" },
    ],
  },
  {
    id: "zigzag",
    name: "Zigzag",
    category: "motion",
    description: "Move in a zigzag pattern",
    durationFrames: 60,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { left: 0, top: 0 }, easing: "linear" },
      { frameOffset: 15, properties: { left: 80, top: 50 }, easing: "linear" },
      { frameOffset: 30, properties: { left: 0, top: 100 }, easing: "linear" },
      { frameOffset: 45, properties: { left: 80, top: 150 }, easing: "linear" },
      { frameOffset: 60, properties: { left: 0, top: 200 }, easing: "linear" },
    ],
  },
  {
    id: "float",
    name: "Float",
    category: "motion",
    description: "Gentle floating up and down",
    durationFrames: 60,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { top: 0 }, easing: "easeInOut" },
      { frameOffset: 15, properties: { top: -15 }, easing: "easeInOut" },
      { frameOffset: 30, properties: { top: 0 }, easing: "easeInOut" },
      { frameOffset: 45, properties: { top: -15 }, easing: "easeInOut" },
      { frameOffset: 60, properties: { top: 0 }, easing: "linear" },
    ],
  },
  {
    id: "spin-scale",
    name: "Spin & Scale",
    category: "motion",
    description: "Rotate 360° while pulsing scale",
    durationFrames: 60,
    relative: true,
    keyframes: [
      { frameOffset: 0, properties: { angle: 0, scaleX: 1, scaleY: 1 }, easing: "easeInOut" },
      { frameOffset: 15, properties: { angle: 90, scaleX: 1.3, scaleY: 1.3 }, easing: "easeInOut" },
      { frameOffset: 30, properties: { angle: 180, scaleX: 1, scaleY: 1 }, easing: "easeInOut" },
      { frameOffset: 45, properties: { angle: 270, scaleX: 1.3, scaleY: 1.3 }, easing: "easeInOut" },
      { frameOffset: 60, properties: { angle: 360, scaleX: 1, scaleY: 1 }, easing: "linear" },
    ],
  },
];

// ─── Custom Template Storage (localStorage) ────────────────────────────────

const STORAGE_KEY = "animation-custom-templates";

export function loadCustomTemplates(): AnimationTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: AnimationTemplate): void {
  const existing = loadCustomTemplates();
  existing.push(template);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function deleteCustomTemplate(id: string): void {
  const existing = loadCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

/**
 * Apply a template to a track starting at a given frame.
 * Returns the keyframes to insert.
 */
export function applyTemplate(
  template: AnimationTemplate,
  startFrame: number,
  currentProps: Partial<AnimatableProps>,
  fps: number,
): Keyframe[] {
  const fpsScale = fps / 30; // Templates are authored at 30fps
  return template.keyframes.map((tkf) => {
    const frame = Math.round(startFrame + tkf.frameOffset * fpsScale);
    const properties: Partial<AnimatableProps> = {};

    for (const [key, val] of Object.entries(tkf.properties)) {
      const prop = key as keyof AnimatableProps;
      if (template.relative && typeof val === "number") {
        const current = (currentProps[prop] as number) ?? 0;
        (properties as any)[prop] = current + val;
      } else {
        (properties as any)[prop] = val;
      }
    }

    return { frame, properties, easing: tkf.easing };
  });
}

/**
 * Create a template from existing track keyframes.
 */
export function createTemplateFromTrack(
  name: string,
  keyframes: Keyframe[],
  category: AnimationTemplate["category"] = "custom",
): AnimationTemplate {
  if (keyframes.length === 0) {
    throw new Error("Cannot create template from empty keyframes");
  }

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const startFrame = sorted[0].frame;
  const endFrame = sorted[sorted.length - 1].frame;

  // Store as relative offsets from the first keyframe's position
  const baseProps = sorted[0].properties;

  const templateKeyframes: TemplateKeyframe[] = sorted.map((kf) => {
    const properties: Partial<AnimatableProps> = {};
    for (const [key, val] of Object.entries(kf.properties)) {
      const prop = key as keyof AnimatableProps;
      if (typeof val === "number" && typeof baseProps[prop] === "number") {
        (properties as any)[prop] = val - (baseProps[prop] as number);
      } else {
        (properties as any)[prop] = val;
      }
    }
    return {
      frameOffset: kf.frame - startFrame,
      properties,
      easing: kf.easing,
    };
  });

  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    category,
    description: `Custom template with ${keyframes.length} keyframes`,
    durationFrames: endFrame - startFrame,
    relative: true,
    keyframes: templateKeyframes,
  };
}

export function getAllTemplates(): AnimationTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...loadCustomTemplates()];
}
