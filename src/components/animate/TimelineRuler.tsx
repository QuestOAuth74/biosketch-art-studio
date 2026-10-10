import { useCallback, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useAnimation } from "@/contexts/AnimationContext";
import { formatFrameTime } from "@/lib/animationEngine";

const MARKER_COLORS = [
  "#f59e0b", // amber (default)
  "#ef4444", // red
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

interface MarkerContextMenu {
  x: number;
  y: number;
  frame: number;
}

interface TimelineRulerProps {
  trackAreaWidth: number;
  hoverFrame: number | null;
  setHoverFrame: (frame: number | null) => void;
}

export function TimelineRuler({ trackAreaWidth, hoverFrame, setHoverFrame }: TimelineRulerProps) {
  const {
    animProject,
    currentFrame,
    playing,
    stopPlayback,
    goToFrame,
    inPoint,
    outPoint,
    hasPlaybackRange,
    markers,
    removeMarker,
    renameMarker,
    updateMarkerColor,
  } = useAnimation();

  const [scrubbing, setScrubbing] = useState(false);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [markerCtx, setMarkerCtx] = useState<MarkerContextMenu | null>(null);
  const [hoveredMarkerFrame, setHoveredMarkerFrame] = useState<number | null>(null);
  const [renamingFrame, setRenamingFrame] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const markerMenuRef = useRef<HTMLDivElement>(null);

  if (!animProject) return null;

  const totalFrames = animProject.totalFrames;
  const fps = animProject.fps;
  const pixelsPerFrame = trackAreaWidth / Math.max(1, totalFrames - 1);

  const tickInterval = useMemo(() => {
    const candidates = [1, 2, 5, 10, fps / 2, fps, fps * 2, fps * 5, fps * 10];
    for (const interval of candidates) {
      if (interval * pixelsPerFrame >= 40) return Math.max(1, Math.round(interval));
    }
    return Math.max(1, Math.round(fps));
  }, [pixelsPerFrame, fps]);

  const ticks = useMemo(() => {
    const result: { frame: number; label: string; major: boolean }[] = [];
    for (let f = 0; f < totalFrames; f += tickInterval) {
      const seconds = Math.floor(f / fps);
      const subFrames = f % fps;
      const label = subFrames === 0 ? `${seconds}s` : `${seconds}:${String(subFrames).padStart(2, "0")}`;
      result.push({ frame: f, label, major: f % fps === 0 });
    }
    if (result.length === 0 || result[result.length - 1].frame !== totalFrames - 1) {
      const f = totalFrames - 1;
      const seconds = Math.floor(f / fps);
      result.push({ frame: f, label: `${seconds}s`, major: false });
    }
    return result;
  }, [totalFrames, tickInterval, fps]);

  const frameFromClientX = useCallback(
    (clientX: number) => {
      if (!rulerRef.current) return 0;
      const rect = rulerRef.current.getBoundingClientRect();
      const localX = clientX - rect.left;
      const frame = Math.round((localX / trackAreaWidth) * (totalFrames - 1));
      return Math.max(0, Math.min(totalFrames - 1, frame));
    },
    [trackAreaWidth, totalFrames]
  );

  // ─── Scrubbing (mousedown + drag to seek) ──────────────────────────────

  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (playing) stopPlayback();
      const frame = frameFromClientX(e.clientX);
      goToFrame(frame);
      setScrubbing(true);

      const onMove = (ev: MouseEvent) => {
        const f = frameFromClientX(ev.clientX);
        goToFrame(f);
      };
      const onUp = () => {
        setScrubbing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [playing, stopPlayback, goToFrame, frameFromClientX]
  );

  const handleRulerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const frame = frameFromClientX(e.clientX);
      setHoverFrame(frame);
    },
    [frameFromClientX, setHoverFrame]
  );

  const handleRulerMouseLeave = useCallback(() => {
    setHoverFrame(null);
  }, [setHoverFrame]);

  const playheadX =
    totalFrames > 1 ? (currentFrame / (totalFrames - 1)) * trackAreaWidth : 0;

  const hoverX = hoverFrame !== null && totalFrames > 1
    ? (hoverFrame / (totalFrames - 1)) * trackAreaWidth
    : null;

  // ─── In/Out point positions ──────────────────────────────────────────

  const effectiveOut = outPoint >= 0 ? Math.min(outPoint, totalFrames - 1) : totalFrames - 1;
  const inX = totalFrames > 1 ? (inPoint / (totalFrames - 1)) * trackAreaWidth : 0;
  const outX = totalFrames > 1 ? (effectiveOut / (totalFrames - 1)) * trackAreaWidth : trackAreaWidth;

  return (
    <div
      className="flex h-7 sticky top-0 z-10 select-none"
      style={{ background: "var(--aw-surface-2)", borderBottom: "1px solid var(--aw-border)" }}
    >
      {/* Label spacer */}
      <div
        className="w-[180px] shrink-0 px-3 flex items-center"
        style={{ borderRight: "1px solid var(--aw-border)" }}
      >
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--aw-text-3)" }}>
          {animProject.fps} FPS
        </span>
      </div>

      {/* Ruler */}
      <div
        ref={rulerRef}
        className="relative h-full"
        style={{
          width: trackAreaWidth,
          minWidth: trackAreaWidth,
          cursor: scrubbing ? "grabbing" : "pointer",
        }}
        onMouseDown={handleRulerMouseDown}
        onMouseMove={handleRulerMouseMove}
        onMouseLeave={handleRulerMouseLeave}
      >
        {/* In/Out range highlight */}
        {hasPlaybackRange && (
          <>
            {/* Dimmed area before in-point */}
            {inPoint > 0 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: 0,
                  width: inX,
                  background: "rgba(139,92,246,0.08)",
                }}
              />
            )}
            {/* Dimmed area after out-point */}
            {outPoint >= 0 && outPoint < totalFrames - 1 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: outX,
                  right: 0,
                  background: "rgba(139,92,246,0.08)",
                }}
              />
            )}
            {/* In marker */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-15"
              style={{ left: inX, transform: "translateX(-1px)" }}
            >
              <div className="w-0.5 h-full" style={{ background: "#22c55e" }} />
              <div
                className="absolute top-0 left-0 text-[10px] font-bold px-1 rounded-br"
                style={{ background: "#22c55e", color: "#fff", lineHeight: "12px" }}
              >
                I
              </div>
            </div>
            {/* Out marker */}
            {outPoint >= 0 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-15"
                style={{ left: outX, transform: "translateX(-1px)" }}
              >
                <div className="w-0.5 h-full" style={{ background: "#ef4444" }} />
                <div
                  className="absolute top-0 right-0 text-[10px] font-bold px-1 rounded-bl"
                  style={{ background: "#ef4444", color: "#fff", lineHeight: "12px" }}
                >
                  O
                </div>
              </div>
            )}
          </>
        )}

        {/* Timeline markers */}
        {markers.map((marker) => {
          const mx = totalFrames > 1 ? (marker.frame / (totalFrames - 1)) * trackAreaWidth : 0;
          const color = marker.color || "#f59e0b";
          const isHovered = hoveredMarkerFrame === marker.frame;
          return (
            <div
              key={marker.frame}
              className="absolute top-0 z-[12]"
              style={{
                left: mx,
                transform: "translateX(-50%)",
                cursor: "pointer",
                height: 28,
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setHoveredMarkerFrame(marker.frame);
              }}
              onMouseLeave={() => setHoveredMarkerFrame(null)}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (e.button === 0) {
                  if (playing) stopPlayback();
                  goToFrame(marker.frame);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMarkerCtx({ x: e.clientX, y: e.clientY, frame: marker.frame });
              }}
            >
              {/* Flag triangle */}
              <div
                className="mx-auto"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: `7px solid ${color}`,
                  filter: isHovered ? "brightness(1.3)" : undefined,
                }}
              />
              {/* Stem line */}
              <div
                className="mx-auto"
                style={{
                  width: 1,
                  height: 21,
                  background: color,
                  opacity: 0.5,
                }}
              />
              {/* Hover tooltip with label */}
              {isHovered && (
                <div
                  className="absolute whitespace-nowrap"
                  style={{
                    top: 28,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(22, 17, 35, 0.92)",
                    border: `1px solid ${color}`,
                    color: "#fff",
                    fontSize: "9px",
                    fontWeight: 600,
                    padding: "1px 5px",
                    borderRadius: 3,
                    lineHeight: "14px",
                    pointerEvents: "none",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                    zIndex: 30,
                  }}
                >
                  {marker.label}
                </div>
              )}
            </div>
          );
        })}

        {/* Tick marks */}
        {ticks.map((tick) => {
          const x =
            totalFrames > 1
              ? (tick.frame / (totalFrames - 1)) * trackAreaWidth
              : 0;
          return (
            <div
              key={tick.frame}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: x, transform: "translateX(-50%)" }}
            >
              <span
                className="text-[11px] leading-none mb-0.5 font-mono"
                style={{ color: tick.major ? "var(--aw-text-2)" : "var(--aw-text-3)" }}
              >
                {tick.label}
              </span>
              <div
                className="w-px"
                style={{
                  height: tick.major ? "10px" : "6px",
                  background: tick.major ? "var(--aw-border-strong)" : "var(--aw-border)",
                }}
              />
            </div>
          );
        })}

        {/* Hover preview line */}
        {hoverX !== null && !scrubbing && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{
              left: hoverX,
              transform: "translateX(-50%)",
              width: "1px",
              borderLeft: "1px dashed rgba(139,92,246,0.3)",
            }}
          />
        )}

        {/* Hover tooltip */}
        {hoverFrame !== null && hoverX !== null && !scrubbing && (
          <div
            className="absolute pointer-events-none z-30"
            style={{
              left: hoverX + 8,
              top: 2,
              background: "var(--aw-surface)",
              border: "1px solid var(--aw-border)",
              boxShadow: "0 2px 8px rgba(139,92,246,0.12)",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "10px",
              fontFamily: "ui-monospace, monospace",
              color: "var(--aw-text)",
              whiteSpace: "nowrap",
            }}
          >
            Frame {hoverFrame} &bull; {formatFrameTime(hoverFrame, fps)}
          </div>
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-20"
          style={{ left: playheadX, transform: "translateX(-50%)" }}
        >
          <div className="w-0.5 h-full" style={{ background: "var(--aw-accent)" }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2">
            <svg width="12" height="8" viewBox="0 0 12 8" style={{ filter: "drop-shadow(0 1px 3px rgba(139,92,246,0.35))" }}>
              <path d="M1 0h10L6 7z" fill="var(--aw-accent)" />
            </svg>
          </div>
        </div>
      </div>

      {/* Marker context menu (portaled) */}
      {markerCtx && (() => {
        const marker = markers.find((m) => m.frame === markerCtx.frame);
        if (!marker) return null;
        const color = marker.color || "#f59e0b";
        return createPortal(
          <>
          {/* Invisible backdrop to close menu on click outside */}
          <div
            className="fixed inset-0 z-[9998]"
            onMouseDown={() => { setMarkerCtx(null); setRenamingFrame(null); }}
            onContextMenu={(e) => { e.preventDefault(); setMarkerCtx(null); setRenamingFrame(null); }}
          />
          <div
            ref={markerMenuRef}
            className="fixed z-[9999] min-w-[180px] py-1 rounded-lg border"
            style={{
              top: markerCtx.y,
              left: markerCtx.x,
              background: "rgba(22, 17, 35, 0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderColor: "rgba(139,92,246,0.2)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.08)",
              fontSize: "12px",
              color: "rgba(255, 255, 255, 0.95)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Rename */}
            {renamingFrame === marker.frame ? (
              <div className="px-3 py-[5px]">
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renameMarker(marker.frame, renameValue);
                      setRenamingFrame(null);
                      setMarkerCtx(null);
                    } else if (e.key === "Escape") {
                      setRenamingFrame(null);
                    }
                  }}
                  onBlur={() => {
                    renameMarker(marker.frame, renameValue);
                    setRenamingFrame(null);
                    setMarkerCtx(null);
                  }}
                  style={{
                    width: "100%",
                    background: "rgba(139,92,246,0.1)",
                    border: "1px solid rgba(139,92,246,0.3)",
                    borderRadius: 4,
                    padding: "2px 6px",
                    color: "rgba(255,255,255,0.95)",
                    fontSize: "12px",
                    outline: "none",
                  }}
                />
              </div>
            ) : (
              <button
                className="w-full flex items-center justify-between px-3 py-[5px] text-left"
                style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.95)", fontSize: "12px", lineHeight: "16px", cursor: "pointer" }}
                onClick={() => {
                  setRenameValue(marker.label);
                  setRenamingFrame(marker.frame);
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Rename Marker
              </button>
            )}

            {/* Remove */}
            <button
              className="w-full flex items-center justify-between px-3 py-[5px] text-left"
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.95)", fontSize: "12px", lineHeight: "16px", cursor: "pointer" }}
              onClick={() => {
                removeMarker(marker.frame);
                setMarkerCtx(null);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Remove Marker
            </button>

            {/* Separator */}
            <div className="my-1 mx-2" style={{ height: 1, background: "rgba(139,92,246,0.15)" }} />

            {/* Color picker */}
            <div className="px-3 py-[5px]">
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Color</div>
              <div className="flex gap-1 flex-wrap">
                {MARKER_COLORS.map((c) => (
                  <button
                    key={c}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      background: c,
                      border: c === color ? "2px solid #fff" : "2px solid transparent",
                      cursor: "pointer",
                      padding: 0,
                      outline: "none",
                    }}
                    onClick={() => {
                      updateMarkerColor(marker.frame, c);
                      setMarkerCtx(null);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          </>,
          document.body
        );
      })()}
    </div>
  );
}
