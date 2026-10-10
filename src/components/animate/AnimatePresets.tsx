import { useState } from "react";
import {
  Wand2,
  SunMedium,
  Moon,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  Sparkles,
  Activity,
  RotateCw,
  Zap,
  Palette,
  HeartPulse,
  Eye,
  Vibrate,
  type LucideIcon,
} from "lucide-react";
import { useAnimation } from "@/contexts/AnimationContext";
import {
  ANIMATION_PRESETS,
  type AnimationPreset,
} from "@/lib/animationPresets";

// Map icon name strings to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  SunMedium,
  Moon,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  Sparkles,
  Activity,
  RotateCw,
  Zap,
  Palette,
  HeartPulse,
  Eye,
  Vibrate,
};

const CATEGORIES: { key: AnimationPreset["category"]; label: string }[] = [
  { key: "entrance", label: "Entrance" },
  { key: "exit", label: "Exit" },
  { key: "emphasis", label: "Emphasis" },
  { key: "motion", label: "Motion" },
];

export default function AnimatePresets() {
  const { selectedTrack, applyPreset } = useAnimation();
  const [activeCategory, setActiveCategory] =
    useState<AnimationPreset["category"]>("entrance");

  const presets = ANIMATION_PRESETS.filter(
    (p) => p.category === activeCategory,
  );

  const disabled = !selectedTrack;

  return (
    <div
      className="px-3 py-3"
      style={{ borderBottom: "1px solid var(--aw-border)" }}
    >
      {/* Section header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Wand2
          className="h-3.5 w-3.5"
          style={{ color: "var(--aw-accent)" }}
        />
        <span
          className="text-[12px] font-bold tracking-wider uppercase"
          style={{ color: "var(--aw-text-2)" }}
        >
          Presets
        </span>
      </div>

      {/* Category tabs */}
      <div
        className="flex rounded-md overflow-hidden mb-2"
        style={{
          border: "1px solid var(--aw-border)",
          background: "var(--aw-bg)",
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className="flex-1 text-[11px] font-semibold py-1 transition-colors"
            style={{
              color:
                activeCategory === cat.key
                  ? "var(--aw-accent)"
                  : "var(--aw-text-3)",
              background:
                activeCategory === cat.key
                  ? "var(--aw-accent-dim)"
                  : "transparent",
            }}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-3 gap-1">
        {presets.map((preset) => {
          const Icon = ICON_MAP[preset.icon] ?? Sparkles;
          return (
            <button
              key={preset.id}
              disabled={disabled}
              title={preset.description}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-30"
              style={{
                color: "var(--aw-text-2)",
                background: "rgba(139,92,246,0.05)",
                border: "1px solid var(--aw-border)",
              }}
              onClick={() => applyPreset(preset.id)}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.background = "var(--aw-accent-dim)";
                  e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)";
                  e.currentTarget.style.color = "var(--aw-accent)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(139,92,246,0.05)";
                e.currentTarget.style.borderColor = "var(--aw-border)";
                e.currentTarget.style.color = "var(--aw-text-2)";
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate w-full text-center leading-tight">
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
