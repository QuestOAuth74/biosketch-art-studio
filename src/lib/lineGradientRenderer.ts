/**
 * Line gradient renderer utilities.
 *
 * Gradients are drawn as a post-render overlay via canvas.on('after:render').
 * The original line objects are never modified, preserving all edit-mode,
 * pathfinding, and smart-connector behaviour.
 */

import type { LineGradientConfig } from '@/types/effects';
import { Gradient } from 'fabric';

interface _PathSeg {
  type: 'L' | 'C';
  x0: number; y0: number;
  x1: number; y1: number;
  cp1x?: number; cp1y?: number;
  cp2x?: number; cp2y?: number;
  tStart: number; tEnd: number;
}

function _approxCubicBezierLen(
  x0: number, y0: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x1: number, y1: number,
  steps = 12
): number {
  let len = 0, px = x0, py = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, mt = 1 - t;
    const x = mt*mt*mt*x0 + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*x1;
    const y = mt*mt*mt*y0 + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*y1;
    const dx = x - px, dy = y - py;
    len += Math.sqrt(dx*dx + dy*dy);
    px = x; py = y;
  }
  return len;
}

function _evalCubicBezierAt(
  x0: number, y0: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x1: number, y1: number,
  t: number
): [number, number] {
  const u = 1 - t;
  const uu = u * u, uuu = uu * u;
  const tt = t * t, ttt = tt * t;
  return [
    uuu * x0 + 3 * uu * t * cp1x + 3 * u * tt * cp2x + ttt * x1,
    uuu * y0 + 3 * uu * t * cp1y + 3 * u * tt * cp2y + ttt * y1,
  ];
}

function _hexOpacity(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const parse = (s: string) => parseInt(s, 16);
  const r = parse(h.length === 3 ? h[0]+h[0] : h.slice(0,2));
  const g = parse(h.length === 3 ? h[1]+h[1] : h.slice(2,4));
  const b = parse(h.length === 3 ? h[2]+h[2] : h.slice(4,6));
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, opacity))})`;
}

function _lerpHexRgba(c1: string, o1: number, c2: string, o2: number, t: number): string {
  const h1 = c1.replace('#', ''), h2 = c2.replace('#', '');
  const p = (s: string) => parseInt(s, 16);
  const r1 = p(h1.length===3 ? h1[0]+h1[0] : h1.slice(0,2)), g1 = p(h1.length===3 ? h1[1]+h1[1] : h1.slice(2,4)), b1 = p(h1.length===3 ? h1[2]+h1[2] : h1.slice(4,6));
  const r2 = p(h2.length===3 ? h2[0]+h2[0] : h2.slice(0,2)), g2 = p(h2.length===3 ? h2[1]+h2[1] : h2.slice(2,4)), b2 = p(h2.length===3 ? h2[2]+h2[2] : h2.slice(4,6));
  return `rgba(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)},${+(o1+(o2-o1)*t).toFixed(4)})`;
}

function _gradientColorAtT(config: LineGradientConfig, t: number): string {
  const stops = config.stops;
  if (!stops?.length) return 'rgba(0,0,0,1)';
  if (t <= stops[0].offset) return _hexOpacity(stops[0].color, stops[0].opacity ?? 1);
  const last = stops[stops.length - 1];
  if (t >= last.offset) return _hexOpacity(last.color, last.opacity ?? 1);
  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i], s2 = stops[i + 1];
    if (t >= s1.offset && t <= s2.offset) {
      const span = s2.offset - s1.offset;
      const lt = span > 0 ? (t - s1.offset) / span : 0;
      return _lerpHexRgba(s1.color, s1.opacity ?? 1, s2.color, s2.opacity ?? 1, lt);
    }
  }
  return _hexOpacity(last.color, last.opacity ?? 1);
}

/**
 * Draw a gradient stroke along a set of Fabric.js path commands.
 * The context must already be transformed to the object's local coordinate space
 * (viewport × object world transform applied before calling this).
 */
function _drawGradientOnPath(
  ctx: CanvasRenderingContext2D,
  pathCmds: any[],
  gc: LineGradientConfig,
  pox: number,
  poy: number,
  strokeWidth: number
): void {
  // Build path segments
  const segments: _PathSeg[] = [];
  let curX = 0, curY = 0, subpathStartX = 0, subpathStartY = 0, totalLen = 0;

  for (const cmd of pathCmds) {
    const c = cmd[0].toUpperCase();
    if (c === 'M') {
      subpathStartX = cmd[1]; subpathStartY = cmd[2];
      curX = cmd[1]; curY = cmd[2];
      continue;
    }
    if (c === 'L') {
      const dx = cmd[1]-curX, dy = cmd[2]-curY;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > 0.001) { segments.push({ type:'L', x0:curX, y0:curY, x1:cmd[1], y1:cmd[2], tStart:0, tEnd:0 }); totalLen += len; }
      curX = cmd[1]; curY = cmd[2];
    } else if (c === 'C') {
      const len = _approxCubicBezierLen(curX, curY, cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6]);
      if (len > 0.001) { segments.push({ type:'C', x0:curX, y0:curY, x1:cmd[5], y1:cmd[6], cp1x:cmd[1], cp1y:cmd[2], cp2x:cmd[3], cp2y:cmd[4], tStart:0, tEnd:0 }); totalLen += len; }
      curX = cmd[5]; curY = cmd[6];
    } else if (c === 'Q') {
      // Convert quadratic to cubic: cp1 = P0 + 2/3*(P1-P0), cp2 = P2 + 2/3*(P1-P2)
      const qcx = cmd[1], qcy = cmd[2], qex = cmd[3], qey = cmd[4];
      const cp1x = curX + 2/3*(qcx-curX), cp1y = curY + 2/3*(qcy-curY);
      const cp2x = qex + 2/3*(qcx-qex), cp2y = qey + 2/3*(qcy-qey);
      const len = _approxCubicBezierLen(curX, curY, cp1x, cp1y, cp2x, cp2y, qex, qey);
      if (len > 0.001) { segments.push({ type:'C', x0:curX, y0:curY, x1:qex, y1:qey, cp1x, cp1y, cp2x, cp2y, tStart:0, tEnd:0 }); totalLen += len; }
      curX = qex; curY = qey;
    } else if (c === 'Z') {
      const dx = subpathStartX - curX, dy = subpathStartY - curY;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > 0.001) { segments.push({ type:'L', x0:curX, y0:curY, x1:subpathStartX, y1:subpathStartY, tStart:0, tEnd:0 }); totalLen += len; }
      curX = subpathStartX; curY = subpathStartY;
    }
  }

  if (totalLen < 0.001 || segments.length === 0) return;

  // Assign t ranges
  let cumLen = 0;
  for (const seg of segments) {
    seg.tStart = cumLen / totalLen;
    const segLen = seg.type === 'L'
      ? Math.sqrt((seg.x1-seg.x0)**2 + (seg.y1-seg.y0)**2)
      : _approxCubicBezierLen(seg.x0, seg.y0, seg.cp1x!, seg.cp1y!, seg.cp2x!, seg.cp2y!, seg.x1, seg.y1);
    cumLen += segLen;
    seg.tEnd = cumLen / totalLen;
  }

  // Render each path segment as many tiny solid-colored sub-segments.
  // This makes the gradient follow the actual path length across all segments
  // (e.g. an L-shaped orthogonal line gets a gradient that flows along both legs).
  const STEPS_L = 30;
  const STEPS_C = 60;
  const rev = gc.direction === 'reverse';

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const seg of segments) {
    const steps = seg.type === 'L' ? STEPS_L : STEPS_C;
    const x0 = seg.x0 + pox, y0 = seg.y0 + poy;
    const x1 = seg.x1 + pox, y1 = seg.y1 + poy;
    const cp1x = (seg.cp1x ?? 0) + pox, cp1y = (seg.cp1y ?? 0) + poy;
    const cp2x = (seg.cp2x ?? 0) + pox, cp2y = (seg.cp2y ?? 0) + poy;

    for (let k = 0; k < steps; k++) {
      const t0 = k / steps;
      const t1 = (k + 1) / steps;
      const tMid = (t0 + t1) / 2;

      let px0: number, py0: number, px1: number, py1: number;
      if (seg.type === 'L') {
        px0 = x0 + (x1 - x0) * t0; py0 = y0 + (y1 - y0) * t0;
        px1 = x0 + (x1 - x0) * t1; py1 = y0 + (y1 - y0) * t1;
      } else {
        [px0, py0] = _evalCubicBezierAt(x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1, t0);
        [px1, py1] = _evalCubicBezierAt(x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1, t1);
      }

      const globalT = seg.tStart + (seg.tEnd - seg.tStart) * tMid;
      ctx.strokeStyle = _gradientColorAtT(gc, rev ? 1 - globalT : globalT);
      ctx.beginPath();
      ctx.moveTo(px0, py0);
      ctx.lineTo(px1, py1);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draw gradient overlays for all canvas objects that have a `gradientConfig`.
 * Call from canvas.on('after:render', ...).
 *
 * @param overrideCtx  If provided, draw on this context instead of
 *                     `fabricCanvas.contextContainer`. Pass the `ctx` from
 *                     the `after:render` event so gradients render correctly
 *                     during `toCanvasElement` / `toDataURL` exports.
 *
 * Objects with `_gradientHidden = true` are skipped (used during edit mode).
 */
export function drawAllLineGradients(fabricCanvas: any, objects?: any[], overrideCtx?: CanvasRenderingContext2D): void {
  const ctx: CanvasRenderingContext2D = overrideCtx ?? fabricCanvas.contextContainer;
  if (!ctx) return;

  const vt: number[] = fabricCanvas.viewportTransform ?? [1,0,0,1,0,0];
  if (!objects) objects = fabricCanvas.getObjects();

  for (const obj of objects) {
    const gc = (obj as any).gradientConfig as LineGradientConfig | undefined;
    if (!gc || (obj as any)._gradientHidden) continue;

    // Find the path object: either the object itself, or a path child inside a group
    let pathObj: any = null;
    if ((obj as any).path) {
      pathObj = obj;
    } else if (obj.type === 'group' && (obj as any)._objects) {
      // Prefer mainPath (curved lines), otherwise first path/line child
      pathObj = (obj as any).mainPath
        ?? (obj as any)._objects.find((o: any) => o.path && (o.type === 'path' || o.type === 'line'));
    }

    if (!pathObj?.path) continue;

    const pathCmds: any[] = pathObj.path;
    const pox = -(pathObj.pathOffset?.x ?? 0);
    const poy = -(pathObj.pathOffset?.y ?? 0);
    const sw = pathObj.strokeWidth ?? (obj as any).strokeWidth ?? 2;

    // Compute full transform: viewport × object world-space transform
    const m: number[] = pathObj.calcTransformMatrix();

    // The manual stroke is rendered AFTER ctx.transform(m), which bakes in the
    // object's scale. When the path has strokeUniform: true (as forced on line
    // presets), divide lineWidth by that scale so the visible stroke stays a
    // constant width — matching Fabric's built-in strokeUniform semantics.
    const scaleX = Math.hypot(m[0], m[1]);
    const scaleY = Math.hypot(m[2], m[3]);
    const compensation = pathObj.strokeUniform ? Math.max(scaleX, scaleY) : 1;
    const effectiveSw = sw / compensation;

    ctx.save();
    // Apply viewport transform (zoom/pan)
    ctx.transform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5]);
    // Apply object's local-to-world transform
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    _drawGradientOnPath(ctx, pathCmds, gc, pox, poy, effectiveSw);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export helpers: temporarily bake gradient overlays into Fabric Gradient
// objects so that toDataURL / toSVG captures them.
// ─────────────────────────────────────────────────────────────────────────────

interface _BakedEntry {
  targetObj: any;
}

/**
 * Temporarily replace `'transparent'` strokes with real Fabric.js Gradient
 * objects for all line objects that use the overlay gradient system.
 *
 * Returns a restore function that reverts the strokes to `'transparent'`.
 */
export function bakeLineGradientsForExport(fabricCanvas: any): () => void {
  const entries: _BakedEntry[] = [];
  const objects: any[] = fabricCanvas.getObjects();

  for (const obj of objects) {
    const gc = obj.gradientConfig as LineGradientConfig | undefined;
    if (!gc || obj._gradientHidden) continue;

    // Find the target path (same logic as drawAllLineGradients)
    let pathObj: any = null;
    if (obj.path) {
      pathObj = obj;
    } else if (obj.type === 'group' && obj._objects) {
      pathObj = obj.mainPath
        ?? obj._objects.find((o: any) => o.path && (o.type === 'path' || o.type === 'line'));
    }
    if (!pathObj?.path) continue;

    const pathCmds: any[] = pathObj.path;
    const pox = pathObj.pathOffset?.x ?? 0;
    const poy = pathObj.pathOffset?.y ?? 0;

    // Extract first and last points from path commands
    let firstX = 0, firstY = 0, lastX = 0, lastY = 0;
    let foundFirst = false;
    for (const cmd of pathCmds) {
      const c = (cmd[0] as string).toUpperCase();
      if (c === 'M') {
        if (!foundFirst) { firstX = cmd[1]; firstY = cmd[2]; foundFirst = true; }
        lastX = cmd[1]; lastY = cmd[2];
      } else if (c === 'L') {
        lastX = cmd[1]; lastY = cmd[2];
      } else if (c === 'C') {
        lastX = cmd[5]; lastY = cmd[6];
      } else if (c === 'Q') {
        lastX = cmd[3]; lastY = cmd[4];
      }
    }

    // Convert to object-local coords (subtract pathOffset)
    const x1 = firstX - pox;
    const y1 = firstY - poy;
    const x2 = lastX - pox;
    const y2 = lastY - poy;

    // Determine direction
    const rev = gc.direction === 'reverse';
    const coords = rev
      ? { x1: x2, y1: y2, x2: x1, y2: y1 }
      : { x1, y1, x2, y2 };

    // Build color stops – convert hex+opacity to rgba strings
    const colorStops = gc.stops.map(stop => ({
      offset: stop.offset,
      color: _hexOpacity(stop.color, stop.opacity ?? 1),
    }));

    const gradient = new Gradient({
      type: 'linear',
      gradientUnits: 'pixels',
      coords,
      colorStops,
    });

    pathObj.set('stroke', gradient);
    entries.push({ targetObj: pathObj });
  }

  // Return restore function
  return () => {
    for (const entry of entries) {
      entry.targetObj.set('stroke', 'transparent');
    }
  };
}
