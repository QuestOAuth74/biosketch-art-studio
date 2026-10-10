// Chart Studio — serialize/deserialize ElementKey for use as object keys (elementStyles lookup)

import type { ElementKey } from "./types";

/** Stable string form of an ElementKey, safe as an object key. */
export function keyToString(k: ElementKey): string {
  switch (k.kind) {
    case "title": return "title";
    case "xlabel": return "xlabel";
    case "ylabel": return "ylabel";
    case "legend": return "legend";
    case "tick": return `tick:${k.axis}:${k.index}`;
    case "series": return `series:${k.traceIndex}`;
    case "point": return `point:${k.traceIndex}:${k.pointIndex}`;
    case "bar": return `bar:${k.traceIndex}:${k.barIndex}`;
    case "annotation": return `annotation:${k.id}`;
    case "bracket": return `bracket:${k.index}`;
  }
}

/** Parse a data-element-key string back into an ElementKey. Returns null for unknown shapes. */
export function stringToKey(s: string): ElementKey | null {
  if (s === "title") return { kind: "title" };
  if (s === "xlabel") return { kind: "xlabel" };
  if (s === "ylabel") return { kind: "ylabel" };
  if (s === "legend") return { kind: "legend" };
  const parts = s.split(":");
  if (parts[0] === "tick" && parts.length === 3 && (parts[1] === "x" || parts[1] === "y")) {
    return { kind: "tick", axis: parts[1], index: Number(parts[2]) };
  }
  if (parts[0] === "series" && parts.length === 2) {
    return { kind: "series", traceIndex: Number(parts[1]) };
  }
  if (parts[0] === "point" && parts.length === 3) {
    return { kind: "point", traceIndex: Number(parts[1]), pointIndex: Number(parts[2]) };
  }
  if (parts[0] === "bar" && parts.length === 3) {
    return { kind: "bar", traceIndex: Number(parts[1]), barIndex: Number(parts[2]) };
  }
  if (parts[0] === "annotation" && parts.length === 2) {
    return { kind: "annotation", id: parts[1] };
  }
  if (parts[0] === "bracket" && parts.length === 2) {
    return { kind: "bracket", index: Number(parts[1]) };
  }
  return null;
}

/** True if two keys reference the same element. */
export function keysEqual(a: ElementKey | null, b: ElementKey | null): boolean {
  if (!a || !b) return a === b;
  return keyToString(a) === keyToString(b);
}
