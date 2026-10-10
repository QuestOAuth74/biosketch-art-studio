import { useEffect, useRef, useCallback, useState } from "react";
import { useAnimation } from "@/contexts/AnimationContext";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import {
  AnimContextMenu,
  AnimContextMenuItem,
  AnimContextMenuSeparator,
} from "./AnimContextMenu";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.1;

export function AnimateStage() {
  const {
    sourceProject,
    canvasRef,
    fabricCanvasRef,
    objectMapRef,
    selectedTrackId,
    setSelectedTrackId,
    setSelectedKeyframeIndex,
    addKeyframeAtCurrentFrame,
    pasteKeyframes,
    pasteKeyframesToTrack,
    clipboard,
    animProject,
  } = useAnimation();

  const containerRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [stageZoom, setStageZoom] = useState(1);
  const fitScaleRef = useRef(1);

  const closeMenu = useCallback(() => setCtxMenu(null), []);

  const computeFitScale = useCallback(() => {
    const container = containerRef.current;
    if (!container || !sourceProject) return 1;
    const padding = 64;
    const maxW = container.clientWidth - padding;
    const maxH = container.clientHeight - padding;
    return Math.min(maxW / sourceProject.canvas_width, maxH / sourceProject.canvas_height, 1);
  }, [sourceProject]);

  const applyZoom = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !sourceProject) return;

    const fitScale = computeFitScale();
    fitScaleRef.current = fitScale;
    const finalScale = fitScale * stageZoom;

    canvas.setZoom(finalScale);
    canvas.setDimensions({
      width: sourceProject.canvas_width * finalScale,
      height: sourceProject.canvas_height * finalScale,
    });
  }, [fabricCanvasRef, sourceProject, stageZoom, computeFitScale]);

  useEffect(() => {
    const timer = setTimeout(applyZoom, 50);
    window.addEventListener("resize", applyZoom);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", applyZoom);
    };
  }, [applyZoom]);

  // Ctrl+scroll to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        setStageZoom((prev) => Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + delta)) * 100) / 100);
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const zoomIn = useCallback(() => {
    setStageZoom((prev) => Math.round(Math.min(ZOOM_MAX, prev + ZOOM_STEP) * 100) / 100);
  }, []);

  const zoomOut = useCallback(() => {
    setStageZoom((prev) => Math.round(Math.max(ZOOM_MIN, prev - ZOOM_STEP) * 100) / 100);
  }, []);

  const zoomFit = useCallback(() => {
    setStageZoom(1);
  }, []);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (!selectedTrackId) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      return;
    }

    const obj = objectMapRef.current.get(selectedTrackId);
    if (obj) {
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
    }
  }, [selectedTrackId, fabricCanvasRef, objectMapRef]);

  if (!sourceProject) return null;

  // Whether the canvas overflows the container at current zoom
  const canvasW = sourceProject ? sourceProject.canvas_width * fitScaleRef.current * stageZoom : 0;
  const canvasH = sourceProject ? sourceProject.canvas_height * fitScaleRef.current * stageZoom : 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 relative"
      style={{ background: "var(--aw-bg)" }}
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* Grid dots pattern — fixed behind scroll */}
      <div
        className="absolute inset-0 opacity-[0.5] pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(139,92,246,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Scrollable area */}
      <div
        className="absolute inset-0 z-10 overflow-auto"
        style={{
          scrollbarColor: "rgba(139,92,246,0.15) transparent",
          scrollbarWidth: "thin",
        }}
      >
        {/* Inner wrapper — centers canvas when smaller than container, expands when larger */}
        <div
          className="flex items-center justify-center"
          style={{
            minWidth: "100%",
            minHeight: "100%",
            width: canvasW > 0 ? Math.max(canvasW + 64, 0) : "100%",
            height: canvasH > 0 ? Math.max(canvasH + 64, 0) : "100%",
          }}
        >
          <div
            className="rounded-lg overflow-hidden relative"
            style={{
              boxShadow: "0 0 0 1px rgba(139,92,246,0.15), 0 4px 32px rgba(0,0,0,0.3), 0 0 60px rgba(139,92,246,0.06)",
            }}
          >
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>

      {/* Zoom controls — fixed in corner */}
      <div
        className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg px-1.5 py-1 select-none"
        style={{
          background: "var(--aw-surface)",
          backdropFilter: "var(--aw-glass-blur)",
          WebkitBackdropFilter: "var(--aw-glass-blur)",
          border: "1px solid var(--aw-border)",
          boxShadow: "var(--aw-glow)",
        }}
      >
        <button
          onClick={zoomOut}
          disabled={stageZoom <= ZOOM_MIN}
          className="h-6 w-6 rounded flex items-center justify-center transition-colors disabled:opacity-30"
          style={{ color: "var(--aw-text-2)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={zoomFit}
          className="h-6 min-w-[3rem] rounded text-[12px] font-mono font-medium flex items-center justify-center transition-colors"
          style={{ color: "var(--aw-text-2)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          title="Fit to View"
        >
          {Math.round(stageZoom * 100)}%
        </button>
        <button
          onClick={zoomIn}
          disabled={stageZoom >= ZOOM_MAX}
          className="h-6 w-6 rounded flex items-center justify-center transition-colors disabled:opacity-30"
          style={{ color: "var(--aw-text-2)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 mx-0.5" style={{ background: "var(--aw-border)" }} />
        <button
          onClick={zoomFit}
          className="h-6 w-6 rounded flex items-center justify-center transition-colors"
          style={{ color: "var(--aw-text-2)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          title="Fit to View"
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Context menu */}
      <AnimContextMenu position={ctxMenu} onClose={closeMenu}>
        <AnimContextMenuItem
          onClick={() => {
            addKeyframeAtCurrentFrame();
            closeMenu();
          }}
          shortcut="K"
        >
          Add Keyframe
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            pasteKeyframes();
            closeMenu();
          }}
          disabled={clipboard.length === 0}
          shortcut="Ctrl+V"
        >
          Paste Keyframes
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            pasteKeyframesToTrack();
            closeMenu();
          }}
          disabled={clipboard.length === 0 || !selectedTrackId}
          shortcut="Ctrl+Shift+V"
        >
          Paste to Selected Object
        </AnimContextMenuItem>
        <AnimContextMenuSeparator />
        <AnimContextMenuItem
          onClick={() => {
            if (animProject) {
              // Select all tracks by selecting each — for now just select first
              // There's no multi-track select, so select all keyframes across tracks
              animProject.tracks.forEach((t) => {
                setSelectedTrackId(t.objectId);
              });
            }
            closeMenu();
          }}
        >
          Select All Objects
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            setSelectedTrackId(null);
            setSelectedKeyframeIndex(null);
            closeMenu();
          }}
        >
          Deselect
        </AnimContextMenuItem>
      </AnimContextMenu>
    </div>
  );
}
