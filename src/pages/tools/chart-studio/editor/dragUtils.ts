// Chart Studio — shared pointer/drag utilities for the editor

/**
 * Convert a client-space pointer event into SVG user-space coordinates.
 * Returns null if the conversion fails (no CTM).
 */
export function clientToSvgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/**
 * Start a drag. Calls onMove with SVG-space delta from the drag origin.
 * Calls onEnd (or cancel) when the pointer is released or Escape is pressed.
 * Returns a teardown function in case the caller needs to cancel early.
 */
export function beginDrag(opts: {
  svg: SVGSVGElement;
  startEvent: { clientX: number; clientY: number };
  onMove: (dx: number, dy: number) => void;
  onEnd?: () => void;
  onCancel?: () => void;
}): () => void {
  const { svg, startEvent, onMove, onEnd, onCancel } = opts;
  const origin = clientToSvgPoint(svg, startEvent);
  if (!origin) { onCancel?.(); return () => {}; }

  const onPointerMove = (e: PointerEvent) => {
    const p = clientToSvgPoint(svg, e);
    if (!p) return;
    onMove(p.x - origin.x, p.y - origin.y);
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKey);
  };
  const onPointerUp = () => { cleanup(); onEnd?.(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { cleanup(); onCancel?.(); } };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKey);
  return cleanup;
}

/** Find the nearest ancestor element carrying a data-element-key attribute. */
export function findElementKeyTarget(el: Element | null): { key: string; el: Element } | null {
  let cur: Element | null = el;
  while (cur) {
    const k = cur.getAttribute?.("data-element-key");
    if (k) return { key: k, el: cur };
    cur = cur.parentElement;
  }
  return null;
}
