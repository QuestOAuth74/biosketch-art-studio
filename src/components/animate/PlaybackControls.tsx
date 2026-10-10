import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Repeat,
  ArrowRight,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Undo2,
  Redo2,
  Layers,
  Magnet,
  Spline,
  CircleDot,
  Plus,
  Minus,
  Sparkles,
  ChevronDown,
  Crosshair,
  Music,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAnimation } from "@/contexts/AnimationContext";
import type { PlaybackMode } from "@/lib/animationEngine";
import { ANIMATION_PRESETS } from "@/lib/animationPresets";

function TransportBtn({
  onClick,
  children,
  title,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 w-7 rounded-md flex items-center justify-center transition-colors disabled:opacity-20"
      style={{ color: "var(--aw-text-2)" }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

const LOOP_MODES: { mode: PlaybackMode; label: string; icon: typeof Repeat }[] = [
  { mode: "once", label: "Play Once", icon: ArrowRight },
  { mode: "loop", label: "Loop", icon: Repeat },
  { mode: "ping-pong", label: "Ping-Pong", icon: ArrowLeftRight },
];

const SPEED_OPTIONS = [0.25, 0.5, 1, 2];

export function PlaybackControls() {
  const {
    animProject,
    currentFrame,
    playing,
    togglePlayback,
    stopPlayback,
    goToFrame,
    stepFrame,
    currentTimeStr,
    totalTimeStr,
    timelineZoom,
    setTimelineZoom,
    playbackMode,
    setPlaybackMode,
    playbackSpeed,
    setPlaybackSpeed,
    undo,
    redo,
    canUndo,
    canRedo,
    onionSkinning,
    setOnionSkinning,
    onionFrameCount,
    setOnionFrameCount,
    snapping,
    setSnapping,
    pathPreview,
    setPathPreview,
    autoKey,
    setAutoKey,
    addKeyframeAtCurrentFrame,
    deleteSelectedKeyframes,
    selectedKeyframes,
    selectedTrackId,
    applyPreset,
    selectKeyframesAtFrame,
    audioBuffer,
    audioMuted,
    setAudioMuted,
    importAudio,
    removeAudio,
    applyCameraMove,
  } = useAnimation();

  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Close presets dropdown on outside click
  useEffect(() => {
    if (!presetsOpen) return;
    const handler = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setPresetsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [presetsOpen]);

  const hasSelection = selectedKeyframes.length > 0;
  const hasTrack = !!selectedTrackId;

  const currentLoopMode = LOOP_MODES.find((m) => m.mode === playbackMode) ?? LOOP_MODES[1];
  const LoopIcon = currentLoopMode.icon;

  const cycleLoopMode = () => {
    const idx = LOOP_MODES.findIndex((m) => m.mode === playbackMode);
    const next = LOOP_MODES[(idx + 1) % LOOP_MODES.length];
    setPlaybackMode(next.mode);
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackSpeed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackSpeed(next);
  };

  return (
    <div
      className="h-10 flex items-center justify-between px-3 shrink-0 select-none"
      style={{ background: "var(--aw-surface)", backdropFilter: "var(--aw-glass-blur)", WebkitBackdropFilter: "var(--aw-glass-blur)", borderBottom: "1px solid var(--aw-border)" }}
    >
      {/* Left: Undo/Redo + Transport */}
      <div className="flex items-center gap-0.5">
        {/* Undo / Redo */}
        <TransportBtn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </TransportBtn>
        <TransportBtn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="h-3.5 w-3.5" />
        </TransportBtn>

        <div className="w-px h-5 mx-1" style={{ background: "var(--aw-border)" }} />

        {/* Keyframe actions */}
        <button
          onClick={addKeyframeAtCurrentFrame}
          disabled={!hasTrack}
          title="Add Keyframe (K)"
          className="h-7 px-2 rounded-md flex items-center gap-1 text-[13px] font-semibold transition-colors disabled:opacity-25"
          style={{
            color: "#ffffff",
            background: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
            boxShadow: "0 2px 12px rgba(139,92,246,0.3)",
          }}
          onMouseEnter={(e) => { if (hasTrack) e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          <Plus className="h-3 w-3" strokeWidth={3} />
          <span className="hidden sm:inline">Key</span>
        </button>

        <button
          onClick={deleteSelectedKeyframes}
          disabled={!hasSelection}
          title="Remove Selected Keyframes (Delete)"
          className="h-7 px-2 rounded-md flex items-center gap-1 text-[13px] font-semibold transition-colors disabled:opacity-25"
          style={{
            color: hasSelection ? "#ef4444" : "var(--aw-text-3)",
            background: hasSelection ? "rgba(239,68,68,0.1)" : "transparent",
            border: "1px solid",
            borderColor: hasSelection ? "rgba(192,57,43,0.2)" : "var(--aw-border)",
          }}
          onMouseEnter={(e) => { if (hasSelection) e.currentTarget.style.background = "rgba(239,68,68,0.18)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = hasSelection ? "rgba(239,68,68,0.1)" : "transparent"; }}
        >
          <Minus className="h-3 w-3" strokeWidth={3} />
          <span className="hidden sm:inline">Key</span>
        </button>

        <button
          onClick={() => selectKeyframesAtFrame(currentFrame)}
          title="Select all keyframes at playhead (Ctrl+A)"
          className="h-7 px-2 rounded-md flex items-center gap-1 text-[13px] font-semibold transition-colors"
          style={{
            color: "var(--aw-text-2)",
            background: "transparent",
            border: "1px solid",
            borderColor: "var(--aw-border)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Crosshair className="h-3 w-3" strokeWidth={2.5} />
          <span className="hidden sm:inline">Select</span>
        </button>

        {/* Presets dropdown */}
        <div className="relative" ref={presetsRef}>
          <button
            onClick={() => setPresetsOpen(!presetsOpen)}
            disabled={!hasTrack}
            title="Keyframe Presets"
            className="h-7 px-2 rounded-md flex items-center gap-1 text-[13px] font-semibold transition-colors disabled:opacity-25"
            style={{
              color: presetsOpen ? "var(--aw-accent)" : "var(--aw-text-2)",
              background: presetsOpen ? "var(--aw-accent-glow)" : "transparent",
              border: "1px solid",
              borderColor: presetsOpen ? "var(--aw-accent)" : "var(--aw-border)",
            }}
            onMouseEnter={(e) => { if (hasTrack) e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = presetsOpen ? "var(--aw-accent-glow)" : "transparent"; }}
          >
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">Presets</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-50" />
          </button>

          {presetsOpen && (
            <div
              className="absolute top-full left-0 mt-1 z-50 rounded-lg shadow-xl overflow-hidden"
              style={{
                background: "var(--aw-surface)",
                border: "1px solid var(--aw-border-strong)",
                minWidth: 200,
              }}
            >
              {(["entrance", "exit", "emphasis", "motion"] as const).map((cat) => {
                const presets = ANIMATION_PRESETS.filter((p) => p.category === cat);
                if (presets.length === 0) return null;
                return (
                  <div key={cat}>
                    <div
                      className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--aw-text-3)", background: "rgba(139,92,246,0.05)" }}
                    >
                      {cat}
                    </div>
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          applyPreset(preset.id);
                          setPresetsOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 transition-colors"
                        style={{ color: "var(--aw-text)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.08)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <span className="font-medium">{preset.name}</span>
                        <span className="ml-auto text-[12px] opacity-40">{preset.description?.slice(0, 25)}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-px h-5 mx-1" style={{ background: "var(--aw-border)" }} />

        {/* Transport controls */}
        <TransportBtn onClick={() => goToFrame(0)} title="Go to start (Home)">
          <SkipBack className="h-3.5 w-3.5" />
        </TransportBtn>
        <TransportBtn onClick={() => stepFrame(-1)} title="Previous frame">
          <ChevronLeft className="h-3.5 w-3.5" />
        </TransportBtn>

        {/* Play button */}
        <button
          onClick={togglePlayback}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          className="h-8 w-8 rounded-full flex items-center justify-center mx-0.5 transition-all"
          style={{
            background: playing
              ? "rgba(139,92,246,0.2)"
              : "linear-gradient(135deg, #8b5cf6, #a78bfa)",
            color: playing ? "var(--aw-accent)" : "#ffffff",
            boxShadow: playing
              ? "none"
              : "0 2px 12px rgba(139,92,246,0.35)",
          }}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5 ml-0.5" />
          )}
        </button>

        <TransportBtn onClick={stopPlayback} title="Stop">
          <Square className="h-3 w-3" />
        </TransportBtn>
        <TransportBtn onClick={() => stepFrame(1)} title="Next frame">
          <ChevronRight className="h-3.5 w-3.5" />
        </TransportBtn>
        <TransportBtn onClick={() => { if (animProject) goToFrame(animProject.totalFrames - 1); }} title="Go to end (End)">
          <SkipForward className="h-3.5 w-3.5" />
        </TransportBtn>

        <div className="w-px h-5 mx-1" style={{ background: "var(--aw-border)" }} />

        {/* Loop mode */}
        <button
          onClick={cycleLoopMode}
          title={`${currentLoopMode.label} (click to cycle)`}
          className="h-7 px-1.5 rounded-md flex items-center gap-1 transition-colors text-[12px] font-medium"
          style={{
            color: playbackMode === "once" ? "var(--aw-text-3)" : "var(--aw-accent)",
            background: playbackMode !== "once" ? "var(--aw-accent-glow)" : "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = playbackMode !== "once" ? "var(--aw-accent-glow)" : "transparent"; }}
        >
          <LoopIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Center: Timecode + Speed */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[13px]"
          style={{ background: "var(--aw-bg)", border: "1px solid var(--aw-border)" }}
        >
          <span className="font-semibold tabular-nums" style={{ color: "var(--aw-text)" }}>
            {currentTimeStr}
          </span>
          <span style={{ color: "var(--aw-text-3)" }}>/</span>
          <span className="tabular-nums" style={{ color: "var(--aw-text-3)" }}>
            {totalTimeStr}
          </span>
        </div>

        <div className="text-[13px] font-mono tabular-nums" style={{ color: "var(--aw-text-3)" }}>
          <span style={{ color: "var(--aw-accent)" }}>{currentFrame}</span>
          <span className="mx-px">/</span>
          <span>{animProject?.totalFrames ?? 0}</span>
          <span className="ml-0.5 text-[11px] opacity-50">f</span>
        </div>

        {/* Speed */}
        <button
          onClick={cycleSpeed}
          title={`Playback speed: ${playbackSpeed}x (click to cycle)`}
          className="h-6 px-1.5 rounded text-[12px] font-mono font-semibold transition-colors"
          style={{
            color: playbackSpeed === 1 ? "var(--aw-text-3)" : "var(--aw-accent)",
            background: playbackSpeed !== 1 ? "var(--aw-accent-glow)" : "transparent",
            border: "1px solid var(--aw-border)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = playbackSpeed !== 1 ? "var(--aw-accent-glow)" : "transparent"; }}
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Right: Onion skin + Zoom */}
      <div className="flex items-center gap-0.5">
        {/* Onion skin */}
        <button
          onClick={() => setOnionSkinning(!onionSkinning)}
          title={`Onion skinning: ${onionSkinning ? "ON" : "OFF"}`}
          className="h-7 px-1.5 rounded-md flex items-center gap-1 transition-colors text-[12px] font-medium"
          style={{
            color: onionSkinning ? "var(--aw-accent)" : "var(--aw-text-3)",
            background: onionSkinning ? "var(--aw-accent-glow)" : "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = onionSkinning ? "var(--aw-accent-glow)" : "transparent"; }}
        >
          <Layers className="h-3.5 w-3.5" />
        </button>

        {onionSkinning && (
          <div className="flex items-center gap-0.5 mx-1">
            <button
              onClick={() => setOnionFrameCount(Math.max(1, onionFrameCount - 1))}
              disabled={onionFrameCount <= 1}
              className="h-5 w-5 rounded flex items-center justify-center text-[12px] font-mono disabled:opacity-25"
              style={{ color: "var(--aw-text-3)" }}
            >
              −
            </button>
            <span
              className="text-[12px] w-4 text-center font-mono tabular-nums"
              style={{ color: "var(--aw-text-2)" }}
            >
              {onionFrameCount}
            </span>
            <button
              onClick={() => setOnionFrameCount(Math.min(8, onionFrameCount + 1))}
              disabled={onionFrameCount >= 8}
              className="h-5 w-5 rounded flex items-center justify-center text-[12px] font-mono disabled:opacity-25"
              style={{ color: "var(--aw-text-3)" }}
            >
              +
            </button>
          </div>
        )}

        {/* Snapping */}
        <button
          onClick={() => setSnapping(!snapping)}
          title={`Snap to grid: ${snapping ? "ON" : "OFF"}`}
          className="h-7 px-1.5 rounded-md flex items-center gap-1 transition-colors text-[12px] font-medium"
          style={{
            color: snapping ? "var(--aw-accent)" : "var(--aw-text-3)",
            background: snapping ? "var(--aw-accent-glow)" : "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = snapping ? "var(--aw-accent-glow)" : "transparent"; }}
        >
          <Magnet className="h-3.5 w-3.5" />
        </button>

        {/* Path preview */}
        <button
          onClick={() => setPathPreview(!pathPreview)}
          title={`Motion path: ${pathPreview ? "ON" : "OFF"}`}
          className="h-7 px-1.5 rounded-md flex items-center gap-1 transition-colors text-[12px] font-medium"
          style={{
            color: pathPreview ? "var(--aw-accent)" : "var(--aw-text-3)",
            background: pathPreview ? "var(--aw-accent-glow)" : "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = pathPreview ? "var(--aw-accent-glow)" : "transparent"; }}
        >
          <Spline className="h-3.5 w-3.5" />
        </button>

        {/* Auto-key */}
        <button
          onClick={() => setAutoKey(!autoKey)}
          title={`Auto-key: ${autoKey ? "ON" : "OFF"} — automatically record keyframes when objects move`}
          className="h-7 px-1.5 rounded-md flex items-center gap-1 transition-colors text-[12px] font-medium"
          style={{
            color: autoKey ? "#ef4444" : "var(--aw-text-3)",
            background: autoKey ? "rgba(239,68,68,0.1)" : "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = autoKey ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = autoKey ? "rgba(239,68,68,0.1)" : "transparent"; }}
        >
          <CircleDot className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-5 mx-1" style={{ background: "var(--aw-border)" }} />

        {/* Audio controls */}
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importAudio(file);
            e.target.value = "";
          }}
        />
        <TransportBtn
          onClick={() => audioInputRef.current?.click()}
          title="Import audio"
        >
          <Music className="h-3.5 w-3.5" />
        </TransportBtn>

        {audioBuffer && (
          <>
            <TransportBtn
              onClick={() => setAudioMuted(!audioMuted)}
              title={audioMuted ? "Unmute audio" : "Mute audio"}
            >
              {audioMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </TransportBtn>
            <TransportBtn onClick={removeAudio} title="Remove audio">
              <X className="h-3.5 w-3.5" />
            </TransportBtn>
          </>
        )}

        <div className="w-px h-5 mx-1" style={{ background: "var(--aw-border)" }} />

        {/* Camera moves */}
        <span className="text-[11px] font-semibold uppercase tracking-wider mr-0.5" style={{ color: "var(--aw-text-3)" }}>
          Cam
        </span>
        <TransportBtn onClick={() => applyCameraMove("zoom-in")} title="Camera Zoom In">
          <ZoomIn className="h-3 w-3" />
        </TransportBtn>
        <TransportBtn onClick={() => applyCameraMove("zoom-out")} title="Camera Zoom Out">
          <ZoomOut className="h-3 w-3" />
        </TransportBtn>
        <TransportBtn onClick={() => applyCameraMove("pan-left")} title="Camera Pan Left">
          <ArrowLeft className="h-3 w-3" />
        </TransportBtn>
        <TransportBtn onClick={() => applyCameraMove("pan-right")} title="Camera Pan Right">
          <ArrowRight className="h-3 w-3" />
        </TransportBtn>
        <TransportBtn onClick={() => applyCameraMove("pan-up")} title="Camera Pan Up">
          <ArrowUp className="h-3 w-3" />
        </TransportBtn>
        <TransportBtn onClick={() => applyCameraMove("pan-down")} title="Camera Pan Down">
          <ArrowDown className="h-3 w-3" />
        </TransportBtn>

        <div className="w-px h-5 mx-1" style={{ background: "var(--aw-border)" }} />

        {/* Zoom */}
        <TransportBtn
          onClick={() => setTimelineZoom(Math.max(0.5, timelineZoom - 0.25))}
          disabled={timelineZoom <= 0.5}
          title="Zoom out"
        >
          <ZoomOut className="h-3 w-3" />
        </TransportBtn>
        <span
          className="text-[12px] w-8 text-center font-mono tabular-nums"
          style={{ color: "var(--aw-text-3)" }}
        >
          {(timelineZoom * 100).toFixed(0)}%
        </span>
        <TransportBtn
          onClick={() => setTimelineZoom(Math.min(10, timelineZoom + 0.25))}
          disabled={timelineZoom >= 10}
          title="Zoom in"
        >
          <ZoomIn className="h-3 w-3" />
        </TransportBtn>
      </div>
    </div>
  );
}
