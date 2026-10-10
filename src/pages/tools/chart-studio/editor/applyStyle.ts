// Chart Studio — merge element-level style overrides with base rendering parameters

import type { ElementStyle, ElementStyles, ElementKey } from "./types";
import { keyToString } from "./elementKey";

/** Base text style used when no override is set. */
export interface BaseTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  color: string;
}

/** Merge base + override into a single resolved style. Override wins when set. */
export function resolveTextStyle(base: BaseTextStyle, override?: ElementStyle): BaseTextStyle {
  if (!override) return base;
  return {
    fontFamily: override.fontFamily ?? base.fontFamily,
    fontSize: override.fontSize ?? base.fontSize,
    fontWeight: override.fontWeight ?? base.fontWeight,
    fontStyle: override.fontStyle ?? base.fontStyle,
    color: override.color ?? base.color,
  };
}

/** Get the x/y offset to apply to an element (0,0 if no override). */
export function getOffset(override?: ElementStyle): { dx: number; dy: number } {
  return { dx: override?.offsetX ?? 0, dy: override?.offsetY ?? 0 };
}

/** Get the rotation (deg) to apply to an element. */
export function getRotation(override?: ElementStyle): number {
  return override?.rotation ?? 0;
}

/** Look up a style override by key. Safe on missing map or missing key. */
export function lookupStyle(styles: ElementStyles | undefined, key: ElementKey): ElementStyle | undefined {
  if (!styles) return undefined;
  return styles[keyToString(key)];
}
