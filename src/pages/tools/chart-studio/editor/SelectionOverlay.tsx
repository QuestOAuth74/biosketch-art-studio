// Chart Studio — SVG overlay drawing a selection rectangle around the selected element.
// Rendered as a sibling <g> inside the chart SVG, on top of everything else.

import React from "react";
import type { ElementKey } from "./types";
import { keyToString } from "./elementKey";

interface Props {
  svg: SVGSVGElement | null;
  selected: ElementKey | null;
  hovering: ElementKey | null;
}

/** Returns the bounding box (in SVG user space) of the element with the given key, or null. */
function getElementBBox(svg: SVGSVGElement | null, key: ElementKey): DOMRect | null {
  if (!svg) return null;
  const node = svg.querySelector(`[data-element-key="${keyToString(key)}"]`) as SVGGraphicsElement | null;
  if (!node || typeof node.getBBox !== "function") return null;
  try {
    return node.getBBox();
  } catch {
    return null;
  }
}

/**
 * A lightweight selection/hover outline. Re-measured on every render so it tracks
 * the element even when the user types in a label or drags it. Only shows a
 * 1-pixel outline — no resize handles yet (those come in Phase E3 for shapes).
 */
export function SelectionOverlay({ svg, selected, hovering }: Props) {
  // Measurement must happen after the chart has been laid out. We force a re-measure
  // on every render by using a state tick tied to the props — passing the key in,
  // the parent already re-renders when selected/hovering changes.
  const selBox = selected ? getElementBBox(svg, selected) : null;
  const hovBox = hovering ? getElementBBox(svg, hovering) : null;

  return (
    <g pointerEvents="none" data-editor-overlay="">
      {hovBox && !selBox && (
        <rect
          x={hovBox.x - 2} y={hovBox.y - 2}
          width={hovBox.width + 4} height={hovBox.height + 4}
          fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 2" opacity={0.6}
          rx={2} ry={2}
        />
      )}
      {selBox && (
        <>
          <rect
            x={selBox.x - 3} y={selBox.y - 3}
            width={selBox.width + 6} height={selBox.height + 6}
            fill="none" stroke="#2563eb" strokeWidth={1.5} rx={3} ry={3}
          />
          {/* Corner markers — purely visual, no interaction yet */}
          {[
            [selBox.x - 3, selBox.y - 3],
            [selBox.x + selBox.width + 3, selBox.y - 3],
            [selBox.x - 3, selBox.y + selBox.height + 3],
            [selBox.x + selBox.width + 3, selBox.y + selBox.height + 3],
          ].map(([cx, cy], i) => (
            <rect key={i} x={cx - 2.5} y={cy - 2.5} width={5} height={5} fill="#2563eb" stroke="#fff" strokeWidth={0.75} />
          ))}
        </>
      )}
    </g>
  );
}
