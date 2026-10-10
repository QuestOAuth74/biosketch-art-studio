import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, X, Square, PenTool, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildRectMaskPng,
  buildFreeformMaskPng,
  pointsBounds,
  type MaskBox,
  type Point,
} from '@/lib/regionRefine';

type Tool = 'rect' | 'pen';

interface RefineRegionOverlayProps {
  imageUrl: string;
  onSubmit: (args: { maskImage: string; box: MaskBox; prompt: string }) => Promise<void> | void;
  onClose: () => void;
  submitting?: boolean;
}

/**
 * Selection state model — both tools produce a "locked" flag that gates the
 * submit button. Rectangle locks on mouse-up. Pen locks when the user closes
 * the polygon (click near the first anchor or double-click).
 */
interface RectState {
  x: number; y: number; w: number; h: number;
  locked: boolean;
}
interface PenState {
  points: { x: number; y: number }[];
  closed: boolean;
}

const CLOSE_THRESHOLD_PX = 12; // Click within this distance of the first pen point closes the path

export function RefineRegionOverlay({
  imageUrl,
  onSubmit,
  onClose,
  submitting = false,
}: RefineRegionOverlayProps) {
  const [tool, setTool] = useState<Tool>('rect');
  const [prompt, setPrompt] = useState('');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Rectangle drag-in-progress start point (screen coords). `null` when idle.
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<RectState | null>(null);
  const [pen, setPen] = useState<PenState | null>(null);
  // Live cursor position for the pen's preview segment (last-point → cursor).
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  // Reset any in-progress selection when the tool changes.
  useEffect(() => {
    setRect(null);
    setPen(null);
    setCursor(null);
    dragStartRef.current = null;
  }, [tool]);

  const canSubmit = useMemo(() => {
    if (!naturalSize || prompt.trim().length === 0) return false;
    if (tool === 'rect') return !!rect && rect.locked && rect.w >= 12 && rect.h >= 12;
    return !!pen && pen.closed && pen.points.length >= 3;
  }, [tool, rect, pen, naturalSize, prompt]);

  const clearSelection = () => {
    setRect(null);
    setPen(null);
    setCursor(null);
    dragStartRef.current = null;
  };

  const submit = async () => {
    if (!canSubmit || !naturalSize || !imgRef.current) return;
    const rectBB = imgRef.current.getBoundingClientRect();
    const scaleX = naturalSize.w / rectBB.width;
    const scaleY = naturalSize.h / rectBB.height;

    let maskImage: string;
    let box: MaskBox;

    if (tool === 'rect' && rect) {
      box = {
        x: Math.round(rect.x * scaleX),
        y: Math.round(rect.y * scaleY),
        w: Math.round(rect.w * scaleX),
        h: Math.round(rect.h * scaleY),
      };
      maskImage = await buildRectMaskPng(imageUrl, box);
    } else if (tool === 'pen' && pen) {
      const pxPoints: Point[] = pen.points.map((p) => ({
        x: Math.round(p.x * scaleX),
        y: Math.round(p.y * scaleY),
      }));
      box = pointsBounds(pxPoints);
      maskImage = await buildFreeformMaskPng(imageUrl, pxPoints);
    } else {
      return;
    }

    await onSubmit({ maskImage, box, prompt: prompt.trim() });
  };

  // ── Rectangle pointer handlers ─────────────────────────────────────────────
  const rectPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (submitting) return;
    const rectBB = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rectBB.left;
    const y = e.clientY - rectBB.top;
    dragStartRef.current = { x, y };
    setRect({ x, y, w: 0, h: 0, locked: false });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const rectPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (submitting || !dragStartRef.current) return;
    const rectBB = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rectBB.width, e.clientX - rectBB.left));
    const y = Math.max(0, Math.min(rectBB.height, e.clientY - rectBB.top));
    setRect({
      x: Math.min(dragStartRef.current.x, x),
      y: Math.min(dragStartRef.current.y, y),
      w: Math.abs(x - dragStartRef.current.x),
      h: Math.abs(y - dragStartRef.current.y),
      locked: false,
    });
  };
  const rectPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (submitting || !dragStartRef.current) return;
    dragStartRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    // If the drag produced a big-enough rectangle, LOCK it. Otherwise clear.
    setRect((r) => {
      if (!r) return null;
      if (r.w < 12 || r.h < 12) return null;
      return { ...r, locked: true };
    });
  };

  // ── Pen (bezier-style click-to-add) pointer handlers ──────────────────────
  const penClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (submitting) return;
    // Ignore clicks that were part of a drag (browser's dblclick emits click too;
    // both variants land here). We keep this cheap by not tracking drag distance
    // — real drags on the pen tool don't exist; only clicks.
    const rectBB = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rectBB.left;
    const y = e.clientY - rectBB.top;

    setPen((prev) => {
      if (!prev) return { points: [{ x, y }], closed: false };
      if (prev.closed) return prev; // Locked — ignore further clicks

      // Click near the first anchor closes the path (need ≥3 points).
      if (prev.points.length >= 3) {
        const first = prev.points[0];
        const dx = x - first.x;
        const dy = y - first.y;
        if (Math.sqrt(dx * dx + dy * dy) <= CLOSE_THRESHOLD_PX) {
          return { points: prev.points, closed: true };
        }
      }
      return { points: [...prev.points, { x, y }], closed: false };
    });
  };
  const penDblClick = () => {
    if (submitting) return;
    setPen((prev) => {
      if (!prev || prev.closed) return prev;
      if (prev.points.length < 3) return prev; // Need at least a triangle
      return { points: prev.points, closed: true };
    });
  };
  const penMouseMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'pen') return;
    if (!pen || pen.closed) { setCursor(null); return; }
    const rectBB = e.currentTarget.getBoundingClientRect();
    setCursor({ x: e.clientX - rectBB.left, y: e.clientY - rectBB.top });
  };
  const penMouseLeave = () => {
    if (tool === 'pen') setCursor(null);
  };

  // Explicit close button — nicer than requiring a precise click on the first anchor.
  const closePenPath = () => {
    if (submitting) return;
    setPen((prev) => (prev && !prev.closed && prev.points.length >= 3 ? { ...prev, closed: true } : prev));
  };

  // ── Path strings for the pen SVG ──────────────────────────────────────────
  const penClosedPathD = useMemo(() => {
    if (!pen || pen.points.length < 3) return '';
    let d = `M ${pen.points[0].x} ${pen.points[0].y}`;
    for (let i = 1; i < pen.points.length; i++) d += ` L ${pen.points[i].x} ${pen.points[i].y}`;
    if (pen.closed) d += ' Z';
    return d;
  }, [pen]);
  const penOpenLineD = useMemo(() => {
    if (!pen || pen.points.length === 0 || pen.closed) return '';
    let d = `M ${pen.points[0].x} ${pen.points[0].y}`;
    for (let i = 1; i < pen.points.length; i++) d += ` L ${pen.points[i].x} ${pen.points[i].y}`;
    return d;
  }, [pen]);

  const hasLockedSelection =
    (tool === 'rect' && !!rect?.locked) || (tool === 'pen' && !!pen?.closed);
  const isBuildingSelection =
    (tool === 'rect' && rect && !rect.locked) ||
    (tool === 'pen' && pen && !pen.closed && pen.points.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      {/* Locked-selection pulse keyframes */}
      <style>{`
        @keyframes region-lock-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* ── Left sidebar: instructions + tool picker ────────────────────── */}
      <aside className="w-[280px] shrink-0 border-r border-white/10 bg-slate-950/80 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between mb-1">
            <div className="text-white text-sm font-semibold">Refine region</div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-white/60">
            Redraw part of the figure while the rest stays intact.
            <span className="block mt-1 text-primary/80 font-medium">1 AI credit</span>
          </p>
        </div>

        <div className="p-5 border-b border-white/10 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">How it works</div>
          {[
            { n: 1, title: 'Pick a tool', body: 'Rectangle for boxes, Pen for freehand shapes.' },
            { n: 2, title: 'Select region', body: tool === 'rect'
                ? 'Drag on the image. Release to lock the selection.'
                : 'Click to add anchor points. Click the first anchor (or Close path) to lock.' },
            { n: 3, title: 'Type your prompt', body: 'Describe the change you want in the selected area.' },
            { n: 4, title: 'Click Redraw region', body: 'AI edits only your selection — the rest stays pixel-exact.' },
          ].map((s) => (
            <div key={s.n} className="flex gap-2.5">
              <div className="h-5 w-5 shrink-0 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center">
                {s.n}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">{s.title}</div>
                <div className="text-[11px] text-white/60 leading-snug">{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-b border-white/10 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Selection tool</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTool('rect')}
              disabled={submitting}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border transition-all',
                tool === 'rect'
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/40'
                  : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Square className="h-4 w-4" />
              <span className="text-xs font-semibold">Rectangle</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('pen')}
              disabled={submitting}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border transition-all',
                tool === 'pen'
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/40'
                  : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <PenTool className="h-4 w-4" />
              <span className="text-xs font-semibold">Pen</span>
            </button>
          </div>

          {/* Pen-specific: explicit Close button once we have enough points */}
          {tool === 'pen' && pen && !pen.closed && pen.points.length >= 3 && (
            <button
              type="button"
              onClick={closePenPath}
              disabled={submitting}
              className="w-full mt-2 text-xs font-semibold py-1.5 rounded-md bg-primary/20 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
            >
              Close path ({pen.points.length} points)
            </button>
          )}

          {(rect || pen) && (
            <button
              type="button"
              onClick={clearSelection}
              disabled={submitting}
              className="w-full text-xs text-white/50 hover:text-white/80 pt-1"
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Lock status */}
        {hasLockedSelection && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
            <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Selection locked
            </div>
            <div className="text-[11px] text-emerald-200/70 mt-0.5">
              Type your prompt below and click Redraw region.
            </div>
          </div>
        )}

        <div className="flex-1" />
      </aside>

      {/* ── Right side: image workspace + prompt/submit ─────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
          <div
            className="relative inline-block select-none touch-none"
            style={{ cursor: 'crosshair' }}
            onPointerDown={tool === 'rect' ? rectPointerDown : penClick}
            onPointerMove={tool === 'rect' ? rectPointerMove : penMouseMove}
            onPointerUp={tool === 'rect' ? rectPointerUp : undefined}
            onPointerCancel={tool === 'rect' ? rectPointerUp : undefined}
            onDoubleClick={tool === 'pen' ? penDblClick : undefined}
            onPointerLeave={tool === 'pen' ? penMouseLeave : undefined}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              draggable={false}
              className="max-w-[70vw] max-h-[68vh] rounded-lg shadow-2xl block"
              onLoad={(e) => {
                const im = e.currentTarget;
                setNaturalSize({ w: im.naturalWidth, h: im.naturalHeight });
              }}
            />

            {/* ── Rectangle overlay ────────────────────────────────────── */}
            {tool === 'rect' && rect && rect.w > 0 && rect.h > 0 && (
              <>
                <div
                  className={cn(
                    'absolute pointer-events-none border-2 rounded-sm',
                    rect.locked ? 'border-primary' : 'border-primary/70'
                  )}
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.w,
                    height: rect.h,
                    boxShadow: rect.locked
                      ? // Locked: strong outer glow + inner glow + inset dim shadow
                        '0 0 0 9999px rgba(0,0,0,0.6), ' +
                        '0 0 24px 6px hsl(213 100% 62% / 0.85), ' +
                        'inset 0 0 14px hsl(213 100% 72% / 0.55)'
                      : // In-progress: lighter feedback, no lock ring
                        '0 0 0 9999px rgba(0,0,0,0.5), ' +
                        '0 0 12px 2px hsl(213 90% 60% / 0.55)',
                    animation: rect.locked ? 'region-lock-pulse 1.8s ease-in-out infinite' : undefined,
                  }}
                />
                {rect.locked && (
                  <div
                    className="absolute pointer-events-none flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-semibold shadow-lg"
                    style={{ left: rect.x + 6, top: rect.y + 6 }}
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Locked
                  </div>
                )}
              </>
            )}

            {/* ── Pen overlay ──────────────────────────────────────────── */}
            {tool === 'pen' && pen && naturalSize && (
              <svg
                className="absolute inset-0 pointer-events-none"
                width="100%"
                height="100%"
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <mask id="penMask">
                    <rect width="100%" height="100%" fill="white" />
                    {pen.closed && penClosedPathD && (
                      <path d={penClosedPathD} fill="black" />
                    )}
                  </mask>
                </defs>
                {/* Full-image dim scrim — only cuts out when the path is closed */}
                <rect
                  width="100%"
                  height="100%"
                  fill={pen.closed ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)'}
                  mask="url(#penMask)"
                />

                {/* Open path so far (thin outline) */}
                {penOpenLineD && !pen.closed && (
                  <path
                    d={penOpenLineD}
                    fill="none"
                    stroke="hsl(213 100% 65%)"
                    strokeWidth={1.75}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 4px hsl(213 100% 60% / 0.7))' }}
                  />
                )}

                {/* Preview segment from last anchor to cursor (dashed) */}
                {!pen.closed && pen.points.length > 0 && cursor && (
                  <line
                    x1={pen.points[pen.points.length - 1].x}
                    y1={pen.points[pen.points.length - 1].y}
                    x2={cursor.x}
                    y2={cursor.y}
                    stroke="hsl(213 100% 65%)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.7}
                  />
                )}

                {/* Closed path — locked glow + pulse */}
                {pen.closed && penClosedPathD && (
                  <path
                    d={penClosedPathD}
                    fill="none"
                    stroke="hsl(213 100% 62%)"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                      filter: 'drop-shadow(0 0 10px hsl(213 100% 60% / 0.9))',
                      animation: 'region-lock-pulse 1.8s ease-in-out infinite',
                    }}
                  />
                )}

                {/* Anchor points */}
                {pen.points.map((p, i) => {
                  const isFirst = i === 0;
                  const canClose = !pen.closed && pen.points.length >= 3;
                  const nearCursor = cursor && isFirst && canClose
                    ? Math.sqrt((cursor.x - p.x) ** 2 + (cursor.y - p.y) ** 2) <= CLOSE_THRESHOLD_PX
                    : false;
                  const r = isFirst ? 5 : 3.5;
                  const fill = isFirst
                    ? (nearCursor ? 'hsl(160 80% 55%)' : 'hsl(213 100% 65%)')
                    : 'hsl(213 100% 65%)';
                  return (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={fill}
                      stroke="white"
                      strokeWidth={1.25}
                      style={{
                        filter: nearCursor ? 'drop-shadow(0 0 6px hsl(160 80% 55% / 0.9))' : undefined,
                      }}
                    />
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Bottom prompt + submit */}
        <div className="border-t border-white/10 bg-black/50 p-4 shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={submitting || !hasLockedSelection}
              placeholder={
                !hasLockedSelection
                  ? 'Lock a selection first, then describe what to redraw…'
                  : "Describe what to redraw in the selected region…  e.g. 'Change the mitochondria to blue'"
              }
              className="resize-none bg-white text-slate-900 disabled:opacity-60"
              rows={2}
              maxLength={400}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-white/60">
                {tool === 'rect'
                  ? rect && rect.locked
                    ? `Rectangle locked: ${Math.round(rect.w)} × ${Math.round(rect.h)} px`
                    : isBuildingSelection
                      ? 'Release to lock the rectangle'
                      : 'Drag on the image to mark a rectangle'
                  : pen && pen.closed
                    ? `Pen shape locked: ${pen.points.length} points`
                    : pen && pen.points.length > 0
                      ? `${pen.points.length} point${pen.points.length === 1 ? '' : 's'} — click first anchor or "Close path" to lock`
                      : 'Click on the image to place anchor points'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={submitting}
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={!canSubmit || submitting}
                  className="gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Redrawing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Redraw region
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
