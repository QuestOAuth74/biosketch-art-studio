// Chart Studio — rich-text rendering for SVG.
//
// Input format: simple HTML-like string containing these tags only:
//   <sub>...</sub>   — subscript
//   <sup>...</sup>   — superscript
//   <i>...</i>       — italic
//   <b>...</b>       — bold
//   nested is fine:  <b>H<sub>2</sub>O</b>
//
// Non-tag characters are preserved as-is. Unicode characters (α, μ, ±, ≤, ...) just
// pass through — the editor inserts them as plain text.
//
// Output: a tree of <tspan> elements to drop inside an SVG <text>.

import React from "react";

type NodeStyle = { bold?: boolean; italic?: boolean; super?: boolean; sub?: boolean };

interface WalkCtx {
  style: NodeStyle;
  out: { text: string; style: NodeStyle }[];
}

function walk(node: Node, ctx: WalkCtx) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? "";
    if (text.length > 0) ctx.out.push({ text, style: { ...ctx.style } });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const nextStyle: NodeStyle = { ...ctx.style };
  if (tag === "b" || tag === "strong") nextStyle.bold = true;
  else if (tag === "i" || tag === "em") nextStyle.italic = true;
  else if (tag === "sup") nextStyle.super = true;
  else if (tag === "sub") nextStyle.sub = true;
  // Any unknown tag (span, br, div from contentEditable) just inherits.
  for (const child of Array.from(el.childNodes)) walk(child, { style: nextStyle, out: ctx.out });
}

/** Parse a rich-text HTML fragment into flat styled segments. */
export function parseRichText(input: string): { text: string; style: NodeStyle }[] {
  if (!input) return [];
  const doc = new DOMParser().parseFromString(`<div>${input}</div>`, "text/html");
  const root = doc.body.firstChild as Element | null;
  const ctx: WalkCtx = { style: {}, out: [] };
  if (root) {
    for (const child of Array.from(root.childNodes)) walk(child, ctx);
  }
  return ctx.out;
}

/**
 * Render a rich-text string into a sequence of SVG <tspan> nodes.
 * If the input has no tags, returns the bare string (avoids unnecessary wrappers).
 */
export function renderRichText(input: string): React.ReactNode {
  if (!input) return input;
  // Fast path: no angle brackets at all → plain string.
  if (input.indexOf("<") === -1) return input;
  const segments = parseRichText(input);
  if (segments.length === 0) return input;
  return segments.map((s, i) => (
    <tspan
      key={i}
      fontWeight={s.style.bold ? 700 : undefined}
      fontStyle={s.style.italic ? "italic" : undefined}
      baselineShift={s.style.super ? "super" : s.style.sub ? "sub" : undefined}
      fontSize={s.style.super || s.style.sub ? "0.75em" : undefined}
    >{s.text}</tspan>
  ));
}

export function hasRichTextMarkers(input: string): boolean {
  return input.indexOf("<") !== -1;
}
