import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Download, Clapperboard, Clock, Maximize2, Check, X, FolderOpen, Palette, Sun, Moon } from "lucide-react";
import { useAnimation } from "@/contexts/AnimationContext";
import { AnimateExportDialog } from "./AnimateExportDialog";

export function AnimateHeader() {
  const navigate = useNavigate();
  const {
    sourceProject,
    animProject,
    hasUnsavedChanges,
    saveAnimation,
    updateFps,
    updateDuration,
    lastSavedAt,
    resizeCanvas,
    canvasBgColor,
    setCanvasBgColor,
    workspaceTheme,
    setWorkspaceTheme,
  } = useAnimation();
  const [exportOpen, setExportOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [fpsInput, setFpsInput] = useState("");
  const [durationInput, setDurationInput] = useState("");
  const [editingSize, setEditingSize] = useState(false);
  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [showBgPicker, setShowBgPicker] = useState(false);

  if (!sourceProject) return null;

  const openSettings = () => {
    if (!animProject) return;
    setFpsInput(String(animProject.fps));
    setDurationInput(String(animProject.duration));
    setEditingSettings(true);
  };

  const applySettings = () => {
    const newFps = parseInt(fpsInput, 10);
    const newDuration = parseFloat(durationInput);
    if (!isNaN(newFps) && newFps >= 1 && newFps <= 120) {
      updateFps(newFps);
    }
    if (!isNaN(newDuration) && newDuration >= 0.5 && newDuration <= 300) {
      updateDuration(newDuration);
    }
    setEditingSettings(false);
  };

  const cancelSettings = () => {
    setEditingSettings(false);
  };

  const openSizeEditor = () => {
    setWidthInput(String(sourceProject.canvas_width));
    setHeightInput(String(sourceProject.canvas_height));
    setEditingSize(true);
  };

  const applySizeChange = () => {
    const newW = parseInt(widthInput, 10);
    const newH = parseInt(heightInput, 10);
    if (!isNaN(newW) && !isNaN(newH) && newW >= 100 && newW <= 7680 && newH >= 100 && newH <= 4320) {
      resizeCanvas(newW, newH);
    }
    setEditingSize(false);
  };

  const cancelSizeChange = () => {
    setEditingSize(false);
  };

  return (
    <>
      <header
        className="h-11 flex items-center justify-between px-3 shrink-0 select-none"
        style={{
          background: "var(--aw-surface)",
          backdropFilter: "var(--aw-glass-blur)",
          WebkitBackdropFilter: "var(--aw-glass-blur)",
          borderBottom: "1px solid var(--aw-border)",
        }}
      >
        {/* Left: back + project info */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/projects")}
            className="h-7 w-7 rounded-md flex items-center justify-center transition-colors"
            style={{ color: "var(--aw-text-2)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title="Back to Projects"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px" style={{ background: "var(--aw-border)" }} />

          <div className="flex items-center gap-2.5">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--aw-accent-dim)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <Clapperboard className="h-3.5 w-3.5" style={{ color: "var(--aw-accent)" }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--aw-text)" }}>
                  {sourceProject.name}
                </span>
                {hasUnsavedChanges ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes (auto-saves every 30s)" />
                ) : lastSavedAt ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title={`Saved at ${new Date(lastSavedAt).toLocaleTimeString()}`} />
                ) : null}
              </div>
              <span className="text-[12px] font-medium tracking-wide" style={{ color: "var(--aw-accent)" }}>
                MOTION EDITOR
              </span>
            </div>
          </div>
        </div>

        {/* Center: metadata */}
        <div className="flex items-center gap-1.5">
          {!editingSize ? (
            <button
              onClick={openSizeEditor}
              className="flex items-center gap-1.5 text-[12px] font-mono px-2 py-1 rounded-md transition-colors"
              style={{ background: "var(--aw-accent-glow)", color: "var(--aw-text-2)", border: "1px solid var(--aw-border)" }}
              title="Click to resize canvas"
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--aw-accent-glow)"; }}
            >
              <Maximize2 className="h-3 w-3 opacity-50" />
              {sourceProject.canvas_width}&times;{sourceProject.canvas_height}
            </button>
          ) : (
            <div
              className="flex items-center gap-1 text-[12px] font-mono px-1.5 py-0.5 rounded-md"
              style={{ background: "var(--aw-surface)", border: "1px solid var(--aw-accent)", boxShadow: "0 0 12px rgba(139,92,246,0.15)" }}
            >
              <Maximize2 className="h-3 w-3 opacity-50" style={{ color: "var(--aw-text-3)" }} />
              <input
                type="number"
                value={widthInput}
                onChange={(e) => setWidthInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applySizeChange(); if (e.key === "Escape") cancelSizeChange(); }}
                className="w-12 text-center bg-transparent outline-none"
                style={{ color: "var(--aw-text)" }}
                min={100}
                max={7680}
                autoFocus
              />
              <span style={{ color: "var(--aw-text-3)" }}>&times;</span>
              <input
                type="number"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applySizeChange(); if (e.key === "Escape") cancelSizeChange(); }}
                className="w-12 text-center bg-transparent outline-none"
                style={{ color: "var(--aw-text)" }}
                min={100}
                max={4320}
              />
              <button
                onClick={applySizeChange}
                className="h-5 w-5 rounded flex items-center justify-center ml-0.5"
                style={{ color: "var(--aw-accent)" }}
                title="Apply"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={cancelSizeChange}
                className="h-5 w-5 rounded flex items-center justify-center"
                style={{ color: "var(--aw-text-3)" }}
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {animProject && !editingSettings && (
            <button
              onClick={openSettings}
              className="flex items-center gap-1.5 text-[12px] font-mono px-2 py-1 rounded-md transition-colors"
              style={{ background: "var(--aw-accent-glow)", color: "var(--aw-text-2)", border: "1px solid var(--aw-border)" }}
              title="Click to edit FPS and duration"
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--aw-accent-glow)"; }}
            >
              <Clock className="h-3 w-3 opacity-50" />
              {animProject.fps}fps &middot; {animProject.duration}s
            </button>
          )}

          {editingSettings && (
            <div
              className="flex items-center gap-1 text-[12px] font-mono px-1.5 py-0.5 rounded-md"
              style={{ background: "var(--aw-surface)", border: "1px solid var(--aw-accent)", boxShadow: "0 0 12px rgba(139,92,246,0.15)" }}
            >
              <input
                type="number"
                value={fpsInput}
                onChange={(e) => setFpsInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applySettings(); if (e.key === "Escape") cancelSettings(); }}
                className="w-8 text-center bg-transparent outline-none"
                style={{ color: "var(--aw-text)" }}
                min={1}
                max={120}
                autoFocus
              />
              <span style={{ color: "var(--aw-text-3)" }}>fps</span>
              <span style={{ color: "var(--aw-text-3)" }}>&middot;</span>
              <input
                type="number"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applySettings(); if (e.key === "Escape") cancelSettings(); }}
                className="w-10 text-center bg-transparent outline-none"
                style={{ color: "var(--aw-text)" }}
                min={0.5}
                max={300}
                step={0.5}
              />
              <span style={{ color: "var(--aw-text-3)" }}>s</span>
              <button
                onClick={applySettings}
                className="h-5 w-5 rounded flex items-center justify-center ml-0.5"
                style={{ color: "var(--aw-accent)" }}
                title="Apply"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={cancelSettings}
                className="h-5 w-5 rounded flex items-center justify-center"
                style={{ color: "var(--aw-text-3)" }}
                title="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Background color */}
          <div className="relative">
            <button
              onClick={() => setShowBgPicker(!showBgPicker)}
              className="flex items-center gap-1.5 text-[12px] font-mono px-2 py-1 rounded-md transition-colors"
              style={{ background: "var(--aw-accent-glow)", color: "var(--aw-text-2)", border: "1px solid var(--aw-border)" }}
              title="Canvas background color"
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--aw-accent-glow)"; }}
            >
              <div
                className="w-3 h-3 rounded-sm border"
                style={{
                  backgroundColor: canvasBgColor === "transparent" ? "transparent" : canvasBgColor,
                  borderColor: "var(--aw-border-strong)",
                  backgroundImage: canvasBgColor === "transparent"
                    ? "linear-gradient(45deg, #666 25%, transparent 25%), linear-gradient(-45deg, #666 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #666 75%), linear-gradient(-45deg, transparent 75%, #666 75%)"
                    : undefined,
                  backgroundSize: canvasBgColor === "transparent" ? "6px 6px" : undefined,
                  backgroundPosition: canvasBgColor === "transparent" ? "0 0, 0 3px, 3px -3px, -3px 0px" : undefined,
                }}
              />
              <Palette className="h-3 w-3 opacity-60" />
            </button>
            {showBgPicker && (
              <div
                className="absolute top-full mt-1 left-0 z-50 rounded-lg p-2.5 space-y-2"
                style={{
                  background: "var(--aw-surface)",
                  backdropFilter: "var(--aw-glass-blur)",
                  WebkitBackdropFilter: "var(--aw-glass-blur)",
                  border: "1px solid var(--aw-border-strong)",
                  boxShadow: "var(--aw-glow), 0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                <div className="flex gap-1.5 flex-wrap" style={{ width: 140 }}>
                  {[
                    "#ffffff", "#f0f0f0", "#d4d4d4", "#a3a3a3",
                    "#525252", "#262626", "#0a0a0a", "#000000",
                    "#fecaca", "#fde68a", "#bbf7d0", "#bfdbfe",
                    "#ddd6fe", "#fbcfe8", "#fed7aa", "#99f6e4",
                    "#ef4444", "#eab308", "#22c55e", "#3b82f6",
                    "#8b5cf6", "#ec4899", "#f97316", "#14b8a6",
                  ].map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCanvasBgColor(c); setShowBgPicker(false); }}
                      className="w-5 h-5 rounded-sm border transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: canvasBgColor === c ? "var(--aw-accent)" : "var(--aw-border)",
                        boxShadow: canvasBgColor === c ? "0 0 0 1px var(--aw-accent)" : undefined,
                      }}
                      title={c}
                    />
                  ))}
                  {/* Transparent option */}
                  <button
                    onClick={() => { setCanvasBgColor("transparent"); setShowBgPicker(false); }}
                    className="w-5 h-5 rounded-sm border transition-transform hover:scale-110"
                    style={{
                      backgroundImage: "linear-gradient(45deg, #666 25%, transparent 25%), linear-gradient(-45deg, #666 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #666 75%), linear-gradient(-45deg, transparent 75%, #666 75%)",
                      backgroundSize: "6px 6px",
                      backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
                      borderColor: canvasBgColor === "transparent" ? "var(--aw-accent)" : "var(--aw-border)",
                      boxShadow: canvasBgColor === "transparent" ? "0 0 0 1px var(--aw-accent)" : undefined,
                    }}
                    title="Transparent"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1" style={{ borderTop: "1px solid var(--aw-border)" }}>
                  <input
                    type="color"
                    value={canvasBgColor === "transparent" ? "#ffffff" : canvasBgColor}
                    onChange={(e) => setCanvasBgColor(e.target.value)}
                    className="w-5 h-5 rounded-sm cursor-pointer border-0 p-0"
                    title="Custom color"
                  />
                  <span className="text-[12px] font-mono" style={{ color: "var(--aw-text-3)" }}>Custom</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {/* Theme toggle */}
          <button
            onClick={() => setWorkspaceTheme(workspaceTheme === "dark" ? "light" : "dark")}
            className="h-7 w-7 rounded-md flex items-center justify-center transition-colors"
            style={{ color: "var(--aw-text-2)", border: "1px solid var(--aw-border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title={workspaceTheme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {workspaceTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <div className="h-4 w-px" style={{ background: "var(--aw-border)" }} />

          <button
            onClick={() => navigate("/animations")}
            className="h-7 px-3 rounded-md text-[13px] font-medium flex items-center gap-1.5 transition-colors"
            style={{ background: "transparent", color: "var(--aw-text-2)", border: "1px solid var(--aw-border-strong)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title="My Animations"
          >
            <FolderOpen className="h-3 w-3" />
            Animations
          </button>

          <button
            onClick={() => setExportOpen(true)}
            disabled={!animProject}
            className="h-7 px-3 rounded-md text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-30"
            style={{ background: "transparent", color: "var(--aw-text-2)", border: "1px solid var(--aw-border-strong)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Download className="h-3 w-3" />
            Export
          </button>

          <button
            onClick={saveAnimation}
            className="h-7 px-3 rounded-md text-[13px] font-medium flex items-center gap-1.5 transition-all"
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
              color: "#ffffff",
              boxShadow: "0 2px 12px rgba(139,92,246,0.35)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        </div>
      </header>

      <AnimateExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </>
  );
}
