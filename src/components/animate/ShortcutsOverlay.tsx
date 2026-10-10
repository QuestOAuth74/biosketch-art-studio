import { useAnimation } from "@/contexts/AnimationContext";
import { X } from "lucide-react";

const SHORTCUT_GROUPS = [
  {
    title: "Playback",
    shortcuts: [
      { keys: "Space", action: "Play / Pause" },
      { keys: "Home", action: "Go to start" },
      { keys: "End", action: "Go to end" },
      { keys: "\u2190 / \u2192", action: "Step 1 frame" },
      { keys: "Shift + \u2190 / \u2192", action: "Step 10 frames" },
      { keys: "I", action: "Set in point" },
      { keys: "O", action: "Set out point" },
    ],
  },
  {
    title: "Keyframes",
    shortcuts: [
      { keys: "K", action: "Add keyframe" },
      { keys: "Delete", action: "Delete selected keyframes" },
      { keys: "Ctrl+D", action: "Duplicate keyframes" },
      { keys: "Ctrl+C", action: "Copy keyframes" },
      { keys: "Ctrl+V", action: "Paste keyframes" },
      { keys: "Ctrl+Shift+V", action: "Paste to selected object" },
      { keys: "Alt + \u2190 / \u2192", action: "Move keyframes \u00b11 frame" },
      { keys: "Alt+Shift + \u2190 / \u2192", action: "Move keyframes \u00b110 frames" },
    ],
  },
  {
    title: "Timeline",
    shortcuts: [
      { keys: "M", action: "Add marker" },
      { keys: "Ctrl+Scroll", action: "Zoom timeline" },
      { keys: "?", action: "Toggle this help" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: "Ctrl+S", action: "Save animation" },
      { keys: "Ctrl+Z", action: "Undo" },
      { keys: "Ctrl+Shift+Z", action: "Redo" },
    ],
  },
];

export function ShortcutsOverlay() {
  const { shortcutsVisible, setShortcutsVisible } = useAnimation();

  if (!shortcutsVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={() => setShortcutsVisible(false)}
    >
      <div
        className="relative rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto"
        style={{
          background: "rgba(22, 17, 35, 0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(139,92,246,0.2)",
          boxShadow: "0 16px 64px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-5 py-3.5 z-10"
          style={{
            background: "var(--aw-surface)",
            borderBottom: "1px solid var(--aw-border)",
          }}
        >
          <h2 className="text-sm font-bold tracking-wide" style={{ color: "var(--aw-text)" }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setShortcutsVisible(false)}
            className="h-7 w-7 rounded-md flex items-center justify-center transition-colors"
            style={{ color: "var(--aw-text-3)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Groups */}
        <div className="px-5 py-4 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3
                className="text-[12px] font-bold uppercase tracking-[0.15em] mb-2"
                style={{ color: "var(--aw-text-3)" }}
              >
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.keys}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md"
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span className="text-[12px]" style={{ color: "var(--aw-text-2)" }}>
                      {s.action}
                    </span>
                    <div className="flex items-center gap-1">
                      {s.keys.split("+").map((k, i) => (
                        <span key={i}>
                          {i > 0 && (
                            <span className="text-[12px] mx-0.5" style={{ color: "var(--aw-text-3)" }}>
                              +
                            </span>
                          )}
                          <kbd
                            className="inline-block text-[12px] font-mono font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: "var(--aw-bg)",
                              border: "1px solid var(--aw-border-strong)",
                              color: "var(--aw-text)",
                              boxShadow: "0 1px 0 var(--aw-border-strong)",
                            }}
                          >
                            {k.trim()}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 text-center"
          style={{ borderTop: "1px solid var(--aw-border)", color: "var(--aw-text-3)" }}
        >
          <span className="text-[12px]">
            Press <kbd className="font-mono font-semibold px-1 py-0.5 rounded text-[12px]" style={{ background: "var(--aw-bg)", border: "1px solid var(--aw-border-strong)" }}>?</kbd> to dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
