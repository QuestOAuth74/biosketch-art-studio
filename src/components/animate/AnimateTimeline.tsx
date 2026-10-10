import { useRef, useCallback, useState } from "react";
import { useAnimation } from "@/contexts/AnimationContext";
import { PlaybackControls } from "./PlaybackControls";
import { TrackRow } from "./TrackRow";
import { TimelineRuler } from "./TimelineRuler";
import { Layers } from "lucide-react";
import {
  AnimContextMenu,
  AnimContextMenuItem,
  AnimContextMenuSeparator,
} from "./AnimContextMenu";
import { AudioWaveform } from "./AudioWaveform";
import { TimelineMinimap } from "./TimelineMinimap";

interface RubberBand {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function AnimateTimeline() {
  const {
    animProject,
    playing,
    stopPlayback,
    goToFrame,
    currentFrame,
    timelineZoom,
    setTimelineZoom,
    timelineScrollLeft,
    setTimelineScrollLeft,
    pasteKeyframes,
    pasteKeyframesToTrack,
    clipboard,
    selectedTrackId,
    toggleKeyframeSelection,
    addMarker,
    removeMarker,
    markers,
    setInPoint,
    setOutPoint,
    clearPlaybackRange,
    audioBuffer,
  } = useAnimation();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [hoverFrame, setHoverFrame] = useState<number | null>(null);
  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null);

  const closeMenu = useCallback(() => setCtxMenu(null), []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setTimelineZoom(
          Math.max(0.5, Math.min(10, timelineZoom + (e.deltaY < 0 ? 0.25 : -0.25)))
        );
      }
    },
    [timelineZoom, setTimelineZoom]
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setTimelineScrollLeft(e.currentTarget.scrollLeft);
    },
    [setTimelineScrollLeft]
  );

  const handleTrackAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!animProject) return;
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const labelWidth = 180;
      const clickX = e.clientX - rect.left - labelWidth + (scrollContainerRef.current?.scrollLeft ?? 0);
      const trackAreaWidth = (animProject.totalFrames - 1) * 8 * timelineZoom;

      if (clickX < 0 || trackAreaWidth <= 0) return;

      const frame = Math.round((clickX / trackAreaWidth) * (animProject.totalFrames - 1));
      const clamped = Math.max(0, Math.min(animProject.totalFrames - 1, frame));
      if (playing) stopPlayback();
      goToFrame(clamped);
    },
    [animProject, timelineZoom, playing, stopPlayback, goToFrame]
  );

  const handleTrackAreaMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!animProject) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const labelWidth = 180;
      const localX = e.clientX - rect.left - labelWidth + (scrollContainerRef.current?.scrollLeft ?? 0);
      if (localX < 0) {
        setHoverFrame(null);
        return;
      }
      const taw = Math.max(600, (animProject.totalFrames - 1) * 8 * timelineZoom);
      const frame = Math.round((localX / taw) * (animProject.totalFrames - 1));
      const clamped = Math.max(0, Math.min(animProject.totalFrames - 1, frame));
      setHoverFrame(clamped);
    },
    [animProject, timelineZoom]
  );

  const handleTrackAreaMouseLeave = useCallback(() => {
    setHoverFrame(null);
  }, []);

  // ─── Rubber-band selection ─────────────────────────────────────────────

  const handleRubberBandStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only start rubber-band on middle-button or shift+click on empty area
      if (!e.shiftKey && e.button !== 1) return;
      if (!animProject) return;
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;

      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      setRubberBand({ startX, startY, currentX: startX, currentY: startY });

      const onMove = (ev: MouseEvent) => {
        const curX = ev.clientX - rect.left;
        const curY = ev.clientY - rect.top;
        setRubberBand((prev) => prev ? { ...prev, currentX: curX, currentY: curY } : null);
      };

      const onUp = (ev: MouseEvent) => {
        const endX = ev.clientX - rect.left;
        const endY = ev.clientY - rect.top;

        // Calculate selection rectangle in timeline coords
        const labelWidth = 180;
        const scrollLeft = scrollContainerRef.current?.scrollLeft ?? 0;
        const taw = Math.max(600, (animProject.totalFrames - 1) * 8 * timelineZoom);
        const trackRowHeight = 32;
        const rulerHeight = 28;

        const x1 = Math.min(startX, endX) - labelWidth + scrollLeft;
        const x2 = Math.max(startX, endX) - labelWidth + scrollLeft;
        const y1 = Math.min(startY, endY) - rulerHeight;
        const y2 = Math.max(startY, endY) - rulerHeight;

        // Find keyframes within the rectangle
        animProject.tracks.forEach((track, trackIndex) => {
          const trackTop = trackIndex * trackRowHeight;
          const trackBottom = trackTop + trackRowHeight;

          if (trackBottom < y1 || trackTop > y2) return;

          track.keyframes.forEach((kf) => {
            const kfX = (kf.frame / Math.max(1, animProject.totalFrames - 1)) * taw;
            if (kfX >= x1 && kfX <= x2) {
              toggleKeyframeSelection(track.objectId, kf.frame, "toggle");
            }
          });
        });

        setRubberBand(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [animProject, timelineZoom, toggleKeyframeSelection]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest('[class*="w-[178px]"]')) return;
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const trackAreaWidth = animProject
    ? Math.max(600, (animProject.totalFrames - 1) * 8 * timelineZoom)
    : 600;

  // Rubber-band rect
  const rbRect = rubberBand
    ? {
        left: Math.min(rubberBand.startX, rubberBand.currentX),
        top: Math.min(rubberBand.startY, rubberBand.currentY),
        width: Math.abs(rubberBand.currentX - rubberBand.startX),
        height: Math.abs(rubberBand.currentY - rubberBand.startY),
      }
    : null;

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: "var(--aw-surface)", backdropFilter: "var(--aw-glass-blur)", WebkitBackdropFilter: "var(--aw-glass-blur)", borderTop: "1px solid var(--aw-border-strong)" }}
      onWheel={handleWheel}
    >
      <PlaybackControls />

      {/* Scrollable tracks area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
        onClick={handleTrackAreaClick}
        onMouseDown={handleRubberBandStart}
        onMouseMove={handleTrackAreaMouseMove}
        onMouseLeave={handleTrackAreaMouseLeave}
        onContextMenu={handleContextMenu}
        style={{
          scrollbarColor: "rgba(139,92,246,0.08) transparent",
          scrollbarWidth: "thin",
        }}
      >
        {animProject && <TimelineMinimap />}

        {animProject && (
          <TimelineRuler trackAreaWidth={trackAreaWidth} hoverFrame={hoverFrame} setHoverFrame={setHoverFrame} />
        )}

        {animProject?.tracks.map((track) => (
          <TrackRow
            key={track.objectId}
            track={track}
            trackAreaWidth={trackAreaWidth}
            hoverFrame={hoverFrame}
          />
        ))}

        {animProject && audioBuffer && (
          <AudioWaveform
            audioBuffer={audioBuffer}
            trackAreaWidth={trackAreaWidth}
            duration={(animProject.totalFrames - 1) / animProject.fps}
          />
        )}

        {animProject && animProject.tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <Layers className="h-5 w-5 mb-2" style={{ color: "var(--aw-text-3)" }} />
            <p className="text-xs" style={{ color: "var(--aw-text-3)" }}>
              No animatable objects found
            </p>
          </div>
        )}

        {/* Rubber-band overlay */}
        {rbRect && (
          <div
            className="absolute pointer-events-none z-30"
            style={{
              left: rbRect.left,
              top: rbRect.top,
              width: rbRect.width,
              height: rbRect.height,
              border: "1px dashed var(--aw-accent)",
              background: "rgba(139,92,246,0.08)",
              borderRadius: 2,
            }}
          />
        )}
      </div>

      {/* Timeline context menu */}
      <AnimContextMenu position={ctxMenu} onClose={closeMenu}>
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
            addMarker(currentFrame);
            closeMenu();
          }}
          shortcut="M"
        >
          Add Marker Here
        </AnimContextMenuItem>
        {markers.some((m) => m.frame === currentFrame) && (
          <AnimContextMenuItem
            onClick={() => {
              removeMarker(currentFrame);
              closeMenu();
            }}
          >
            Remove Marker
          </AnimContextMenuItem>
        )}
        <AnimContextMenuSeparator />
        <AnimContextMenuItem
          onClick={() => {
            setInPoint(currentFrame);
            closeMenu();
          }}
          shortcut="I"
        >
          Set In Point
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            setOutPoint(currentFrame);
            closeMenu();
          }}
          shortcut="O"
        >
          Set Out Point
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            clearPlaybackRange();
            closeMenu();
          }}
        >
          Clear Range
        </AnimContextMenuItem>
        <AnimContextMenuSeparator />
        <AnimContextMenuItem
          onClick={() => {
            if (animProject) goToFrame(0);
            closeMenu();
          }}
          shortcut="Home"
        >
          Go to Start
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            if (animProject) goToFrame(animProject.totalFrames - 1);
            closeMenu();
          }}
          shortcut="End"
        >
          Go to End
        </AnimContextMenuItem>
        <AnimContextMenuSeparator />
        <AnimContextMenuItem
          onClick={() => {
            setTimelineZoom(Math.min(10, timelineZoom + 0.5));
            closeMenu();
          }}
        >
          Zoom In
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            setTimelineZoom(Math.max(0.5, timelineZoom - 0.5));
            closeMenu();
          }}
        >
          Zoom Out
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            setTimelineZoom(1);
            closeMenu();
          }}
        >
          Reset Zoom
        </AnimContextMenuItem>
      </AnimContextMenu>
    </div>
  );
}
