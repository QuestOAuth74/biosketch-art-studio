import { useRef, useCallback, useState, useMemo } from "react";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { useAnimation } from "@/contexts/AnimationContext";
import type { AnimationTrack } from "@/lib/animationEngine";
import type { EasingType } from "@/lib/animationEngine";
import {
  AnimContextMenu,
  AnimContextMenuItem,
  AnimContextMenuSeparator,
  AnimContextMenuSub,
} from "./AnimContextMenu";

/** Small SVG curve icon representing an easing type, shown on interpolation lines. */
function getEasingIcon(easing: EasingType) {
  const paths: Record<string, string> = {
    linear:          "M 0 10 L 16 0",
    easeIn:          "M 0 10 Q 12 10 16 0",
    easeOut:         "M 0 10 Q 4 0 16 0",
    easeInOut:       "M 0 10 C 6 10 10 0 16 0",
    easeInCubic:     "M 0 10 Q 14 10 16 0",
    easeOutCubic:    "M 0 10 Q 2 0 16 0",
    easeInOutCubic:  "M 0 10 C 8 10 8 0 16 0",
    easeInBack:      "M 0 10 Q 14 12 16 0",
    easeOutBack:     "M 0 10 Q 2 -2 16 0",
    easeOutBounce:   "M 0 10 Q 4 0 8 5 Q 10 2 12 3 Q 14 1 16 0",
    easeInElastic:   "M 0 10 Q 2 8 4 10 Q 8 12 12 6 L 16 0",
    easeOutElastic:  "M 0 10 L 4 4 Q 8 -2 12 0 Q 14 2 16 0",
  };
  const d = paths[easing] ?? paths.linear;
  return (
    <svg
      width={16}
      height={10}
      viewBox="0 -2 16 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <path d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "easeIn", label: "Ease In" },
  { value: "easeOut", label: "Ease Out" },
  { value: "easeInOut", label: "Ease In-Out" },
  { value: "easeInCubic", label: "Cubic In" },
  { value: "easeOutCubic", label: "Cubic Out" },
  { value: "easeInOutCubic", label: "Cubic In-Out" },
  { value: "easeInBack", label: "Back In" },
  { value: "easeOutBack", label: "Back Out" },
  { value: "easeOutBounce", label: "Bounce" },
  { value: "easeInElastic", label: "Elastic In" },
  { value: "easeOutElastic", label: "Elastic Out" },
];

interface TrackRowProps {
  track: AnimationTrack;
  trackAreaWidth: number;
  hoverFrame?: number | null;
}

export function TrackRow({ track, trackAreaWidth, hoverFrame }: TrackRowProps) {
  const {
    animProject,
    currentFrame,
    selectedTrackId,
    setSelectedTrackId,
    selectedKeyframeIndex,
    setSelectedKeyframeIndex,
    selectedKeyframes,
    isKeyframeSelected,
    toggleKeyframeSelection,
    goToFrame,
    toggleTrackVisibility,
    toggleTrackLock,
    moveKeyframe,
    pushUndoState,
    addKeyframeAtCurrentFrame,
    handleDeleteKeyframe,
    handleEasingChange,
    copySelectedKeyframes,
    pasteKeyframes,
    pasteKeyframesToTrack,
    clipboard,
    scaleTrackKeyframes,
  } = useAnimation();

  const [draggingKfIndex, setDraggingKfIndex] = useState<number | null>(null);
  const [resizeDragging, setResizeDragging] = useState(false);
  const [resizeHover, setResizeHover] = useState(false);
  const trackAreaRef = useRef<HTMLDivElement>(null);

  // Context menu state for track label
  const [trackMenu, setTrackMenu] = useState<{ x: number; y: number } | null>(null);
  // Context menu state for keyframe
  const [kfMenu, setKfMenu] = useState<{ x: number; y: number; kfIndex: number } | null>(null);

  const closeTrackMenu = useCallback(() => setTrackMenu(null), []);
  const closeKfMenu = useCallback(() => setKfMenu(null), []);

  if (!animProject) return null;

  const totalFrames = animProject.totalFrames;
  const isSelected = selectedTrackId === track.objectId;

  const pixelToFrame = useCallback(
    (px: number): number => {
      if (totalFrames <= 1 || trackAreaWidth <= 0) return 0;
      const ratio = px / trackAreaWidth;
      return Math.max(0, Math.min(totalFrames - 1, Math.round(ratio * (totalFrames - 1))));
    },
    [totalFrames, trackAreaWidth]
  );

  const handleDragStart = useCallback(
    (e: React.MouseEvent, kfIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      setDraggingKfIndex(kfIndex);
      setSelectedTrackId(track.objectId);
      setSelectedKeyframeIndex(kfIndex);

      const startX = e.clientX;
      const trackRect = trackAreaRef.current?.getBoundingClientRect();
      if (!trackRect) return;

      const kf = track.keyframes[kfIndex];
      const startFrame = kf.frame;

      const handleMouseMove = (moveEvt: MouseEvent) => {
        const deltaX = moveEvt.clientX - startX;
        const startPx =
          totalFrames > 1
            ? (startFrame / (totalFrames - 1)) * trackAreaWidth
            : 0;
        const newFrame = pixelToFrame(startPx + deltaX);
        moveKeyframe(track.objectId, kfIndex, newFrame);
        goToFrame(newFrame);
      };

      const handleMouseUp = () => {
        setDraggingKfIndex(null);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [track, totalFrames, trackAreaWidth, pixelToFrame, moveKeyframe, goToFrame, setSelectedTrackId, setSelectedKeyframeIndex]
  );

  // Last keyframe position for the resize handle
  const lastKeyframeFrame = useMemo(() => {
    if (track.keyframes.length < 2) return null;
    return Math.max(...track.keyframes.map((kf) => kf.frame));
  }, [track.keyframes]);

  const handleResizeDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (track.locked || lastKeyframeFrame == null || lastKeyframeFrame === 0) return;

      setResizeDragging(true);
      pushUndoState();

      const startX = e.clientX;
      const trackRect = trackAreaRef.current?.getBoundingClientRect();
      if (!trackRect) return;

      const originalLastFrame = lastKeyframeFrame;
      const startPx =
        totalFrames > 1
          ? (originalLastFrame / (totalFrames - 1)) * trackAreaWidth
          : 0;

      const handleMouseMove = (moveEvt: MouseEvent) => {
        const deltaX = moveEvt.clientX - startX;
        const newLastFrame = pixelToFrame(startPx + deltaX);
        if (newLastFrame <= 0) return;
        const scaleFactor = newLastFrame / originalLastFrame;
        scaleTrackKeyframes(track.objectId, scaleFactor);
      };

      const handleMouseUp = () => {
        setResizeDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [track, lastKeyframeFrame, totalFrames, trackAreaWidth, pixelToFrame, scaleTrackKeyframes, pushUndoState]
  );

  const typeLabel = track.objectType.length > 12
    ? track.objectType.slice(0, 12)
    : track.objectType;

  return (
    <div
      className="flex items-center h-9 text-xs cursor-pointer transition-colors group"
      style={{
        background: isSelected ? "var(--aw-accent-glow)" : "transparent",
        borderBottom: "1px solid var(--aw-border)",
        borderLeft: isSelected ? "2px solid var(--aw-accent)" : "2px solid transparent",
      }}
      onClick={() => {
        setSelectedTrackId(track.objectId);
        setSelectedKeyframeIndex(null);
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(139,92,246,0.05)"; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Track label */}
      <div
        className="w-[178px] shrink-0 flex items-center gap-1 px-2"
        style={{ borderRight: "1px solid var(--aw-border)" }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelectedTrackId(track.objectId);
          setTrackMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <button
          className="p-0.5 rounded transition-colors"
          style={{ color: track.visible ? "var(--aw-text-2)" : "var(--aw-text-3)" }}
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackVisibility(track.objectId);
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--aw-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = track.visible ? "var(--aw-text-2)" : "var(--aw-text-3)"; }}
        >
          {track.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
        <button
          className="p-0.5 rounded transition-colors"
          style={{ color: track.locked ? "#f59e0b" : "var(--aw-text-3)" }}
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackLock(track.objectId);
          }}
          onMouseEnter={(e) => { if (!track.locked) e.currentTarget.style.color = "var(--aw-text-2)"; }}
          onMouseLeave={(e) => { if (!track.locked) e.currentTarget.style.color = "var(--aw-text-3)"; }}
        >
          {track.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
        <div className="flex-1 min-w-0 ml-0.5">
          <span
            className="block truncate text-[13px] font-medium leading-tight"
            style={{ color: isSelected ? "var(--aw-text)" : "var(--aw-text-2)" }}
          >
            {track.objectName}
          </span>
          <span className="block text-[11px] leading-tight" style={{ color: "var(--aw-text-3)" }}>
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Keyframe area */}
      <div
        ref={trackAreaRef}
        className="relative h-full flex-1"
        style={{ width: trackAreaWidth, minWidth: trackAreaWidth }}
      >
        {/* Interpolation lines between keyframes */}
        {track.keyframes.length > 1 && track.keyframes.map((kf, i) => {
          if (i === 0) return null;
          const prevKf = track.keyframes[i - 1];
          const x1 = totalFrames > 1 ? (prevKf.frame / (totalFrames - 1)) * trackAreaWidth : 0;
          const x2 = totalFrames > 1 ? (kf.frame / (totalFrames - 1)) * trackAreaWidth : 0;
          const segWidth = x2 - x1;
          return (
            <div
              key={`line-${i}`}
              className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                left: x1,
                width: segWidth,
                background: isSelected
                  ? "linear-gradient(90deg, rgba(139,92,246,0.3), rgba(139,92,246,0.12))"
                  : "linear-gradient(90deg, rgba(139,92,246,0.06), rgba(139,92,246,0.03))",
              }}
            >
              {/* Easing type indicator */}
              {segWidth > 30 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    opacity: isSelected ? 0.7 : 0.5,
                    color: isSelected ? "var(--aw-accent)" : "rgba(139,92,246,0.2)",
                    background: "rgba(22,17,35,0.8)",
                    borderRadius: 3,
                    padding: "1px 2px",
                    lineHeight: 0,
                  }}
                >
                  {getEasingIcon(kf.easing)}
                </div>
              )}
            </div>
          );
        })}

        {/* Keyframe diamonds */}
        {track.keyframes.map((kf, kfIndex) => {
          const x =
            totalFrames > 1
              ? (kf.frame / (totalFrames - 1)) * trackAreaWidth
              : 0;
          const isKfSelected = isKeyframeSelected(track.objectId, kf.frame);
          const isDragging = draggingKfIndex === kfIndex;

          return (
            <button
              key={kfIndex}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-transform"
              style={{
                left: x,
                transform: `translate(-50%, -50%) rotate(45deg) scale(${isDragging ? 1.5 : isKfSelected ? 1.2 : 1})`,
                width: "8px",
                height: "8px",
                borderRadius: "1.5px",
                background: isDragging || isKfSelected
                  ? "var(--aw-accent)"
                  : isSelected
                  ? "rgba(139,92,246,0.45)"
                  : "rgba(139,92,246,0.25)",
                boxShadow: isDragging
                  ? "0 0 10px rgba(139,92,246,0.4)"
                  : isKfSelected
                  ? "0 0 6px rgba(139,92,246,0.3)"
                  : "none",
                cursor: track.locked ? "default" : isDragging ? "grabbing" : "grab",
              }}
              onClick={(e) => {
                e.stopPropagation();
                const mode = e.shiftKey ? "range" : (e.ctrlKey || e.metaKey) ? "toggle" : "replace";
                toggleKeyframeSelection(track.objectId, kf.frame, mode);
                goToFrame(kf.frame);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedTrackId(track.objectId);
                setSelectedKeyframeIndex(kfIndex);
                toggleKeyframeSelection(track.objectId, kf.frame, "replace");
                setKfMenu({ x: e.clientX, y: e.clientY, kfIndex });
              }}
              onMouseDown={(e) => {
                if (e.button === 2) return; // Don't drag on right-click
                if (track.locked) return;
                pushUndoState();
                handleDragStart(e, kfIndex);
              }}
            />
          );
        })}

        {/* Resize handle at last keyframe */}
        {isSelected && !track.locked && lastKeyframeFrame != null && totalFrames > 1 && (
          <div
            className="absolute top-1/2 z-20"
            style={{
              left: (lastKeyframeFrame / (totalFrames - 1)) * trackAreaWidth,
              transform: "translate(-50%, -50%)",
              width: "10px",
              height: "100%",
              cursor: "col-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={() => setResizeHover(true)}
            onMouseLeave={() => { if (!resizeDragging) setResizeHover(false); }}
            onMouseDown={handleResizeDragStart}
          >
            <div
              style={{
                width: "3px",
                height: "16px",
                borderRadius: "1.5px",
                background: "var(--aw-accent)",
                opacity: resizeDragging ? 0.9 : resizeHover ? 0.8 : 0.4,
                transition: "opacity 0.15s ease",
              }}
            />
          </div>
        )}

        {/* Hover preview line */}
        {hoverFrame != null && totalFrames > 1 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-0"
            style={{
              left: (hoverFrame / (totalFrames - 1)) * trackAreaWidth,
              transform: "translateX(-50%)",
              width: "1px",
              borderLeft: "1px dashed rgba(139,92,246,0.3)",
            }}
          />
        )}

        {/* Playhead */}
        {totalFrames > 1 && (
          <div
            className="absolute top-0 bottom-0 w-px pointer-events-none z-0"
            style={{
              left: (currentFrame / (totalFrames - 1)) * trackAreaWidth,
              background: "var(--aw-accent)",
              opacity: 0.35,
            }}
          />
        )}
      </div>

      {/* Track label context menu */}
      <AnimContextMenu position={trackMenu} onClose={closeTrackMenu}>
        <AnimContextMenuItem
          onClick={() => {
            setSelectedTrackId(track.objectId);
            addKeyframeAtCurrentFrame();
            closeTrackMenu();
          }}
        >
          Add Keyframe at Current Frame
        </AnimContextMenuItem>
        <AnimContextMenuSeparator />
        <AnimContextMenuItem
          onClick={() => {
            toggleTrackVisibility(track.objectId);
            closeTrackMenu();
          }}
        >
          Toggle Visibility
        </AnimContextMenuItem>
        <AnimContextMenuItem
          onClick={() => {
            toggleTrackLock(track.objectId);
            closeTrackMenu();
          }}
        >
          Toggle Lock
        </AnimContextMenuItem>
        <AnimContextMenuSeparator />
        <AnimContextMenuItem
          onClick={() => {
            track.keyframes.forEach((kf) => {
              toggleKeyframeSelection(track.objectId, kf.frame, "toggle");
            });
            closeTrackMenu();
          }}
        >
          Select All Keyframes
        </AnimContextMenuItem>
        <AnimContextMenuItem onClick={() => closeTrackMenu()} disabled>
          Duplicate Track
        </AnimContextMenuItem>
        <AnimContextMenuSeparator />
        <AnimContextMenuItem
          onClick={() => {
            pasteKeyframesToTrack(track.objectId);
            closeTrackMenu();
          }}
          disabled={clipboard.length === 0}
          shortcut="Ctrl+Shift+V"
        >
          Paste Animation to This Object
        </AnimContextMenuItem>
      </AnimContextMenu>

      {/* Keyframe context menu */}
      {kfMenu && (
        <AnimContextMenu position={kfMenu} onClose={closeKfMenu}>
          <AnimContextMenuSub label="Edit Easing">
            {EASING_OPTIONS.map((opt) => (
              <AnimContextMenuItem
                key={opt.value}
                onClick={() => {
                  handleEasingChange(track.objectId, kfMenu.kfIndex, opt.value);
                  closeKfMenu();
                }}
              >
                {opt.label}
              </AnimContextMenuItem>
            ))}
          </AnimContextMenuSub>
          <AnimContextMenuSeparator />
          <AnimContextMenuItem
            onClick={() => {
              copySelectedKeyframes();
              closeKfMenu();
            }}
            shortcut="Ctrl+C"
          >
            Copy Keyframe(s)
          </AnimContextMenuItem>
          <AnimContextMenuItem
            onClick={() => {
              pasteKeyframes();
              closeKfMenu();
            }}
            disabled={clipboard.length === 0}
            shortcut="Ctrl+V"
          >
            Paste at Playhead
          </AnimContextMenuItem>
          <AnimContextMenuItem
            onClick={() => {
              pasteKeyframesToTrack(track.objectId);
              closeKfMenu();
            }}
            disabled={clipboard.length === 0}
            shortcut="Ctrl+Shift+V"
          >
            Paste to This Object
          </AnimContextMenuItem>
          <AnimContextMenuSeparator />
          <AnimContextMenuItem
            onClick={() => {
              handleDeleteKeyframe(track.objectId, kfMenu.kfIndex);
              closeKfMenu();
            }}
            shortcut="Del"
          >
            Delete Keyframe
          </AnimContextMenuItem>
        </AnimContextMenu>
      )}
    </div>
  );
}
