import { useRef, useCallback } from "react";
import { useAnimation } from "@/contexts/AnimationContext";

export function TimelineMinimap() {
  const {
    animProject,
    currentFrame,
    timelineZoom,
    timelineScrollLeft,
    markers,
    goToFrame,
    playing,
    stopPlayback,
  } = useAnimation();

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const totalFrames = animProject?.totalFrames ?? 1;
  const tracks = animProject?.tracks ?? [];

  // The main timeline uses trackAreaWidth = max(600, (totalFrames-1) * 8 * zoom)
  const trackAreaWidth = Math.max(600, (totalFrames - 1) * 8 * timelineZoom);

  const frameFromClientX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el || !animProject) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * (animProject.totalFrames - 1));
    },
    [animProject]
  );

  const seekTo = useCallback(
    (clientX: number) => {
      const frame = frameFromClientX(clientX);
      if (playing) stopPlayback();
      goToFrame(Math.max(0, Math.min(totalFrames - 1, frame)));
    },
    [frameFromClientX, playing, stopPlayback, goToFrame, totalFrames]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      seekTo(e.clientX);

      const onMove = (ev: MouseEvent) => {
        if (draggingRef.current) seekTo(ev.clientX);
      };
      const onUp = () => {
        draggingRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [seekTo]
  );

  if (!animProject || tracks.length === 0) return null;

  // Viewport indicator: the visible portion of the main timeline
  // The scroll container has labelWidth=180 offset, but we care about
  // the scrollable track area portion. The visible width of the scroll
  // container is approximately the minimap container width (they share the same parent).
  // We'll estimate using the container ref width as the visible area.
  const containerWidth = containerRef.current?.offsetWidth ?? 800;
  // labelWidth is part of the scroll container but doesn't scroll
  const labelWidth = 180;
  const visibleTrackWidth = Math.max(1, containerWidth - labelWidth);

  const viewportStartPct = (timelineScrollLeft / trackAreaWidth) * 100;
  const viewportWidthPct = Math.min(100, (visibleTrackWidth / trackAreaWidth) * 100);

  // Layout: distribute track lanes evenly
  const minimapHeight = 30;
  const padding = 4;
  const usableHeight = minimapHeight - padding * 2;
  const laneHeight = Math.max(2, Math.min(4, usableHeight / Math.max(1, tracks.length)));
  const laneGap = tracks.length > 1 ? (usableHeight - laneHeight * tracks.length) / Math.max(1, tracks.length - 1) : 0;

  const playheadPct = (currentFrame / Math.max(1, totalFrames - 1)) * 100;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none cursor-pointer"
      style={{
        height: minimapHeight,
        background: "rgba(10, 7, 20, 0.85)",
        borderBottom: "1px solid rgba(139,92,246,0.1)",
        flexShrink: 0,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Track lanes with keyframe dots */}
      {tracks.map((track, i) => {
        const top = padding + i * (laneHeight + laneGap);
        return (
          <div
            key={track.objectId}
            className="absolute"
            style={{ left: 0, right: 0, top, height: laneHeight }}
          >
            {/* Lane background line */}
            <div
              className="absolute"
              style={{
                left: 0,
                right: 0,
                top: Math.floor(laneHeight / 2),
                height: 1,
                background: "rgba(139,92,246,0.06)",
              }}
            />
            {/* Keyframe dots */}
            {track.keyframes.map((kf) => {
              const leftPct = (kf.frame / Math.max(1, totalFrames - 1)) * 100;
              return (
                <div
                  key={kf.frame}
                  className="absolute"
                  style={{
                    left: `${leftPct}%`,
                    top: 0,
                    width: 2,
                    height: laneHeight,
                    background: "rgba(139,92,246,0.6)",
                    borderRadius: 1,
                    transform: "translateX(-1px)",
                  }}
                />
              );
            })}
          </div>
        );
      })}

      {/* Markers */}
      {markers.map((marker) => {
        const leftPct = (marker.frame / Math.max(1, totalFrames - 1)) * 100;
        const color = marker.color || "rgba(251,191,36,0.8)";
        return (
          <div
            key={`marker-${marker.frame}`}
            className="absolute"
            style={{
              left: `${leftPct}%`,
              bottom: 0,
              transform: "translateX(-3px)",
              width: 0,
              height: 0,
              borderLeft: "3px solid transparent",
              borderRight: "3px solid transparent",
              borderBottom: `5px solid ${color}`,
            }}
          />
        );
      })}

      {/* Viewport indicator */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: `${viewportStartPct}%`,
          width: `${viewportWidthPct}%`,
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.18)",
          borderRadius: 1,
        }}
      />

      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: `${playheadPct}%`,
          width: 1,
          background: "var(--aw-accent, #8b5cf6)",
        }}
      />
    </div>
  );
}
