import { useEffect, useRef, useCallback } from 'react';
import { useGridAndRulerStore } from '@/stores/gridAndRulerStore';

const RULER_SIZE = 22;
const LABEL_STEP_MIN_PX = 50;
const TICK_COLOR = '#999';
const LABEL_COLOR = '#666';
const BG_COLOR = '#f8f8f8';
const BORDER_COLOR = '#ddd';

const NICE_STEPS = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

function niceStep(minCanvasUnits: number): number {
  for (const s of NICE_STEPS) {
    if (s >= minCanvasUnits) return s;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

interface CanvasRulersProps {
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export const CanvasRulers = ({
  zoom,
  canvasWidth,
  canvasHeight,
  scrollContainerRef,
}: CanvasRulersProps) => {
  const rulersEnabled = useGridAndRulerStore((s) => s.rulersEnabled);
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const getScrollEl = useCallback((): HTMLElement | null => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    return (container.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement) || container;
  }, [scrollContainerRef]);

  const draw = useCallback(() => {
    const scrollEl = getScrollEl();
    if (!scrollEl) return;

    const scale = zoom / 100;
    const pxPerUnit = scale;

    const minCanvasUnitsPerLabel = LABEL_STEP_MIN_PX / pxPerUnit;
    const step = niceStep(minCanvasUnitsPerLabel);
    const subTicks = 5;

    const scrollLeft = scrollEl.scrollLeft;
    const scrollTop = scrollEl.scrollTop;
    const viewW = scrollEl.clientWidth;
    const viewH = scrollEl.clientHeight;

    // Find the canvas wrapper inside the scroll viewport
    const canvasEl = scrollEl.querySelector('[data-testid="canvas-editor-canvas-wrapper"]') as HTMLElement | null;
    if (!canvasEl) return;

    // Compute offset: how far the canvas wrapper's top-left is from the viewport's top-left (in scrollable content coords)
    const canvasRect = canvasEl.getBoundingClientRect();
    const viewportRect = scrollEl.getBoundingClientRect();
    const canvasOffsetX = canvasRect.left - viewportRect.left + scrollLeft;
    const canvasOffsetY = canvasRect.top - viewportRect.top + scrollTop;

    const dpr = window.devicePixelRatio || 1;

    // ─── Top ruler ───
    const topCanvas = topCanvasRef.current;
    if (topCanvas) {
      topCanvas.width = viewW * dpr;
      topCanvas.height = RULER_SIZE * dpr;
      topCanvas.style.width = `${viewW}px`;
      topCanvas.style.height = `${RULER_SIZE}px`;

      const ctx = topCanvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, viewW, RULER_SIZE);

      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, RULER_SIZE - 0.5);
      ctx.lineTo(viewW, RULER_SIZE - 0.5);
      ctx.stroke();

      const viewStartCanvas = (scrollLeft - canvasOffsetX) / pxPerUnit;
      const viewEndCanvas = (scrollLeft + viewW - canvasOffsetX) / pxPerUnit;
      const firstStep = Math.floor(viewStartCanvas / step) * step;
      const lastStep = Math.ceil(viewEndCanvas / step) * step;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';

      for (let val = firstStep; val <= lastStep; val += step) {
        const screenX = canvasOffsetX + val * pxPerUnit - scrollLeft;

        ctx.strokeStyle = TICK_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(screenX) + 0.5, RULER_SIZE - 10);
        ctx.lineTo(Math.round(screenX) + 0.5, RULER_SIZE - 1);
        ctx.stroke();

        if (val >= 0 && val <= canvasWidth) {
          ctx.fillStyle = LABEL_COLOR;
          ctx.fillText(String(Math.round(val)), screenX, 2);
        }

        const subStep = step / subTicks;
        for (let s = 1; s < subTicks; s++) {
          const subVal = val + s * subStep;
          const subX = canvasOffsetX + subVal * pxPerUnit - scrollLeft;
          if (subX < 0 || subX > viewW) continue;
          ctx.strokeStyle = '#ccc';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.round(subX) + 0.5, RULER_SIZE - 5);
          ctx.lineTo(Math.round(subX) + 0.5, RULER_SIZE - 1);
          ctx.stroke();
        }
      }

      // Corner square
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE);
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(-0.5, -0.5, RULER_SIZE + 1, RULER_SIZE + 1);
    }

    // ─── Left ruler ───
    const leftCanvas = leftCanvasRef.current;
    if (leftCanvas) {
      leftCanvas.width = RULER_SIZE * dpr;
      leftCanvas.height = viewH * dpr;
      leftCanvas.style.width = `${RULER_SIZE}px`;
      leftCanvas.style.height = `${viewH}px`;

      const ctx = leftCanvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, RULER_SIZE, viewH);

      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(RULER_SIZE - 0.5, 0);
      ctx.lineTo(RULER_SIZE - 0.5, viewH);
      ctx.stroke();

      const viewStartCanvas = (scrollTop - canvasOffsetY) / pxPerUnit;
      const viewEndCanvas = (scrollTop + viewH - canvasOffsetY) / pxPerUnit;
      const firstStep = Math.floor(viewStartCanvas / step) * step;
      const lastStep = Math.ceil(viewEndCanvas / step) * step;

      for (let val = firstStep; val <= lastStep; val += step) {
        const screenY = canvasOffsetY + val * pxPerUnit - scrollTop;

        ctx.strokeStyle = TICK_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(RULER_SIZE - 10, Math.round(screenY) + 0.5);
        ctx.lineTo(RULER_SIZE - 1, Math.round(screenY) + 0.5);
        ctx.stroke();

        if (val >= 0 && val <= canvasHeight) {
          ctx.save();
          ctx.translate(7, screenY);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = LABEL_COLOR;
          ctx.fillText(String(Math.round(val)), 0, 0);
          ctx.restore();
        }

        const subStep = step / subTicks;
        for (let s = 1; s < subTicks; s++) {
          const subVal = val + s * subStep;
          const subY = canvasOffsetY + subVal * pxPerUnit - scrollTop;
          if (subY < 0 || subY > viewH) continue;
          ctx.strokeStyle = '#ccc';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(RULER_SIZE - 5, Math.round(subY) + 0.5);
          ctx.lineTo(RULER_SIZE - 1, Math.round(subY) + 0.5);
          ctx.stroke();
        }
      }
    }
  }, [zoom, canvasWidth, canvasHeight, getScrollEl]);

  // Redraw on scroll, zoom, resize
  useEffect(() => {
    if (!rulersEnabled) return;

    const scrollEl = getScrollEl();
    if (!scrollEl) return;

    const scheduleDraw = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };

    scrollEl.addEventListener('scroll', scheduleDraw, { passive: true });
    window.addEventListener('resize', scheduleDraw);

    // Initial draw with small delay for DOM to settle
    const timer = setTimeout(draw, 50);

    return () => {
      scrollEl.removeEventListener('scroll', scheduleDraw);
      window.removeEventListener('resize', scheduleDraw);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timer);
    };
  }, [rulersEnabled, draw, getScrollEl]);

  // Redraw when zoom changes
  useEffect(() => {
    if (rulersEnabled) {
      // Delay slightly because zoom changes also resize the canvas element
      const timer = setTimeout(draw, 50);
      return () => clearTimeout(timer);
    }
  }, [rulersEnabled, zoom, draw]);

  if (!rulersEnabled) return null;

  return (
    <>
      <canvas
        ref={topCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={leftCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
