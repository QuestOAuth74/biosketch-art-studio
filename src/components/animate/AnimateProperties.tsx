import { useState, useRef, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, KeyRound, Layers, Move, RotateCw, Scaling, Blend, Diamond, Copy, ClipboardPaste } from "lucide-react";
import AnimatePresets from "./AnimatePresets";
import CubicBezierEditor from "./CubicBezierEditor";
import { useAnimation } from "@/contexts/AnimationContext";
import type { EasingType, AnimatableProps, AnimationTrack } from "@/lib/animationEngine";
import { easingFunctions, cubicBezier } from "@/lib/animationEngine";

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
  { value: "easeInOutBack", label: "Back In-Out" },
  { value: "easeOutBounce", label: "Bounce Out" },
  { value: "easeInBounce", label: "Bounce In" },
  { value: "easeInElastic", label: "Elastic In" },
  { value: "easeOutElastic", label: "Elastic Out" },
  { value: "easeInOutElastic", label: "Elastic In-Out" },
  { value: "spring", label: "Spring" },
  { value: "custom", label: "Custom" },
];

function getKeyframeStatus(
  track: AnimationTrack | null,
  property: keyof AnimatableProps,
  currentFrame: number
): "none" | "at-current" | "elsewhere" {
  if (!track) return "none";
  const atCurrent = track.keyframes.some(
    kf => kf.frame === currentFrame && kf.properties[property] !== undefined
  );
  if (atCurrent) return "at-current";
  const elsewhere = track.keyframes.some(
    kf => kf.properties[property] !== undefined
  );
  return elsewhere ? "elsewhere" : "none";
}

function PropRow({
  label,
  value,
  icon: Icon,
  property,
  suffix,
  scale,
  dragSensitivity = 1,
  onCommit,
  keyframeStatus = "none",
}: {
  label: string;
  value: string;
  icon?: typeof Move;
  property?: keyof AnimatableProps;
  suffix?: string;
  scale?: number;
  dragSensitivity?: number;
  onCommit?: (property: keyof AnimatableProps, value: number) => void;
  keyframeStatus?: "none" | "at-current" | "elsewhere";
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startValue: number; hasDragged: boolean } | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = () => {
    if (!property || !onCommit) return;
    const raw = value.replace(/[°%]/g, "");
    setEditValue(raw);
    setEditing(true);
  };

  const commit = () => {
    if (!property || !onCommit) return;
    const num = parseFloat(editValue);
    if (!isNaN(num)) {
      const finalValue = scale ? num / scale : num;
      onCommit(property, finalValue);
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (!property || !onCommit || editing) return;
    e.preventDefault();
    const raw = parseFloat(value.replace(/[°%]/g, ""));
    if (isNaN(raw)) return;

    dragRef.current = { startX: e.clientX, startValue: raw, hasDragged: false };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !property || !onCommit) return;
      const dx = ev.clientX - dragRef.current.startX;
      if (Math.abs(dx) > 3) dragRef.current.hasDragged = true;
      if (!dragRef.current.hasDragged) return;

      let sensitivity = dragSensitivity;
      if (ev.shiftKey) sensitivity *= 10;
      if (ev.altKey) sensitivity *= 0.1;

      const displayValue = dragRef.current.startValue + dx * sensitivity;
      const finalValue = scale ? displayValue / scale : displayValue;
      onCommit(property, finalValue);
    };

    const onUp = () => {
      if (dragRef.current && !dragRef.current.hasDragged) {
        startEditing();
      }
      dragRef.current = null;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    document.body.style.cursor = "ew-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="flex items-center justify-between py-1.5 px-2 rounded transition-colors"
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.04)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span className="text-[13px] flex items-center gap-1.5" style={{ color: "var(--aw-text-3)" }}>
        {Icon && <Icon className="h-3 w-3 opacity-60" />}
        {label}
        {keyframeStatus === "at-current" ? (
          <Diamond className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "var(--aw-accent)", fill: "var(--aw-accent)" }} />
        ) : keyframeStatus === "elsewhere" ? (
          <Diamond className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "var(--aw-text-3)" }} />
        ) : null}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          onBlur={commit}
          className="font-mono text-[13px] font-medium tabular-nums text-right w-16 bg-transparent outline-none rounded px-1"
          style={{
            color: "var(--aw-text)",
            border: "1px solid var(--aw-accent)",
            background: "var(--aw-bg)",
          }}
          step={suffix === "°" || !suffix ? 1 : 0.01}
        />
      ) : (
        <span
          className="font-mono text-[13px] font-medium tabular-nums rounded px-1 hover:bg-[rgba(139,92,246,0.08)] select-none"
          style={{ color: "var(--aw-text)", cursor: property ? "ew-resize" : "default" }}
          onMouseDown={handleDragStart}
          title={property ? "Click to edit, drag to adjust" : undefined}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function ColorRow({
  label,
  color,
  property,
  onCommit,
}: {
  label: string;
  color: string;
  property?: keyof AnimatableProps;
  onCommit?: (property: keyof AnimatableProps, value: string) => void;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleSwatchClick = () => {
    if (!property || !onCommit) return;
    colorInputRef.current?.click();
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!property || !onCommit) return;
    onCommit(property, e.target.value);
  };

  return (
    <div
      className="flex items-center justify-between py-1.5 px-2 rounded transition-colors"
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.04)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span className="text-[13px]" style={{ color: "var(--aw-text-3)" }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <div
          className="w-4 h-4 rounded cursor-pointer"
          style={{ backgroundColor: color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }}
          onClick={handleSwatchClick}
        />
        <span
          className="font-mono text-[12px] uppercase cursor-pointer"
          style={{ color: "var(--aw-text-3)" }}
          onClick={handleSwatchClick}
        >
          {color}
        </span>
        {property && onCommit && (
          <input
            ref={colorInputRef}
            type="color"
            value={color}
            onChange={handleColorChange}
            className="sr-only"
            tabIndex={-1}
          />
        )}
      </div>
    </div>
  );
}

const PROPERTY_OPTIONS: { value: keyof AnimatableProps; label: string }[] = [
  { value: "left", label: "X Position" },
  { value: "top", label: "Y Position" },
  { value: "scaleX", label: "Scale X" },
  { value: "scaleY", label: "Scale Y" },
  { value: "angle", label: "Rotation" },
  { value: "opacity", label: "Opacity" },
  { value: "fill", label: "Fill" },
  { value: "stroke", label: "Stroke" },
];

function PropertyEasingAdder({
  trackId,
  keyframeIndex,
  currentEasing,
  existingOverrides,
  onAdd,
}: {
  trackId: string;
  keyframeIndex: number;
  currentEasing: EasingType;
  existingOverrides?: Partial<Record<keyof AnimatableProps, EasingType>>;
  onAdd: (trackId: string, keyframeIndex: number, property: keyof AnimatableProps, easing: EasingType) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [selectedProp, setSelectedProp] = useState<keyof AnimatableProps | "">("");
  const [selectedEasing, setSelectedEasing] = useState<EasingType>(currentEasing);

  const availableProps = PROPERTY_OPTIONS.filter(
    (p) => !existingOverrides || !(p.value in existingOverrides)
  );

  if (availableProps.length === 0) return null;

  if (!adding) {
    return (
      <button
        onClick={() => {
          setSelectedProp("");
          setSelectedEasing(currentEasing);
          setAdding(true);
        }}
        className="flex items-center gap-1 text-[12px] font-medium transition-colors"
        style={{ color: "var(--aw-accent)" }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        <Plus className="h-3 w-3" />
        Add property override
      </button>
    );
  }

  return (
    <div className="space-y-1.5 p-2 rounded-md" style={{ background: "var(--aw-bg)", border: "1px solid var(--aw-border)" }}>
      <label className="text-[11px] font-semibold tracking-[0.1em] uppercase block" style={{ color: "var(--aw-text-3)" }}>
        Property
      </label>
      <Select value={selectedProp} onValueChange={(val) => setSelectedProp(val as keyof AnimatableProps)}>
        <SelectTrigger className="h-7 text-[12px] rounded" style={{ background: "var(--aw-surface)", border: "1px solid var(--aw-border)", color: "var(--aw-text)" }}>
          <SelectValue placeholder="Select property…" />
        </SelectTrigger>
        <SelectContent>
          {availableProps.map((p) => (
            <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label className="text-[11px] font-semibold tracking-[0.1em] uppercase block" style={{ color: "var(--aw-text-3)" }}>
        Easing
      </label>
      <Select value={selectedEasing} onValueChange={(val) => setSelectedEasing(val as EasingType)}>
        <SelectTrigger className="h-7 text-[12px] rounded" style={{ background: "var(--aw-surface)", border: "1px solid var(--aw-border)", color: "var(--aw-text)" }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EASING_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-1.5 pt-0.5">
        <button
          disabled={!selectedProp}
          onClick={() => {
            if (selectedProp) {
              onAdd(trackId, keyframeIndex, selectedProp, selectedEasing);
              setAdding(false);
            }
          }}
          className="flex-1 h-6 rounded text-[12px] font-medium transition-colors disabled:opacity-30"
          style={{ background: "var(--aw-accent-dim)", color: "var(--aw-accent)", border: "1px solid rgba(139,92,246,0.15)" }}
        >
          Add
        </button>
        <button
          onClick={() => setAdding(false)}
          className="flex-1 h-6 rounded text-[12px] font-medium transition-colors"
          style={{ color: "var(--aw-text-3)", border: "1px solid var(--aw-border)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface EasingCurveGridProps {
  value: EasingType;
  onChange: (easing: EasingType) => void;
  customBezier?: [number, number, number, number];
  onCustomBezierChange?: (bezier: [number, number, number, number]) => void;
}

/** A single easing button with hover-animated preview dot */
function EasingButton({
  easingType,
  label,
  selected,
  easingFn,
  onClick,
}: {
  easingType: EasingType;
  label: string;
  selected: boolean;
  easingFn: (t: number) => number;
  onClick: () => void;
}) {
  const dotRef = useRef<SVGCircleElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const LOOP_DURATION = 1500; // ms

  const points = Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    const v = easingFn(t);
    const x = 3 + t * 34;
    const y = 24 - v * 20;
    return `${x},${y}`;
  }).join(" ");

  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) % LOOP_DURATION;
    const t = elapsed / LOOP_DURATION;
    const v = easingFn(t);
    const cx = 3 + t * 34;
    const cy = 24 - v * 20;
    if (dotRef.current) {
      dotRef.current.setAttribute("cx", String(cx));
      dotRef.current.setAttribute("cy", String(cy));
      dotRef.current.setAttribute("opacity", "1");
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [easingFn]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selected) e.currentTarget.style.background = "rgba(139,92,246,0.05)";
    startTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
  }, [selected, animate]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selected) e.currentTarget.style.background = "var(--aw-bg)";
    cancelAnimationFrame(rafRef.current);
    if (dotRef.current) {
      dotRef.current.setAttribute("opacity", "0");
    }
  }, [selected]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <button
      onClick={onClick}
      className="rounded transition-colors"
      style={{
        background: selected ? "rgba(139,92,246,0.10)" : "var(--aw-bg)",
        border: selected
          ? "1.5px solid rgba(139,92,246,1)"
          : "1px solid var(--aw-border)",
        padding: "3px 2px 1px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <svg viewBox="0 0 40 28" style={{ width: "100%", height: 24, display: "block" }}>
        <polyline
          points={points}
          fill="none"
          stroke={selected ? "rgba(139,92,246,1)" : "rgba(160,160,180,0.5)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="3" cy="24" r="1.5" fill={selected ? "rgba(139,92,246,1)" : "rgba(160,160,180,0.5)"} />
        <circle
          cx="37"
          cy={24 - easingFn(1) * 20}
          r="1.5"
          fill={selected ? "rgba(139,92,246,1)" : "rgba(160,160,180,0.5)"}
        />
        <circle
          ref={dotRef}
          cx="3"
          cy="24"
          r="2.5"
          fill="rgba(139,92,246,1)"
          opacity="0"
        />
      </svg>
      <span
        style={{
          fontSize: "8px",
          lineHeight: "11px",
          color: selected ? "rgba(139,92,246,1)" : "rgba(160,160,180,0.7)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
          display: "block",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function EasingCurveGrid({ value, onChange, customBezier, onCustomBezierChange }: EasingCurveGridProps) {
  const [showEditor, setShowEditor] = useState(value === "custom");

  const handleCustomClick = () => {
    onChange("custom" as EasingType);
    setShowEditor(true);
  };

  // Generate the custom curve preview using the actual bezier data
  const customBezierValues = customBezier || [0.42, 0, 0.58, 1] as [number, number, number, number];
  const customEasingFn = cubicBezier(...customBezierValues);
  const customSelected = value === "custom";

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "4px",
        }}
      >
        {EASING_OPTIONS.filter(opt => opt.value !== "custom").map((opt) => (
          <EasingButton
            key={opt.value}
            easingType={opt.value}
            label={opt.label}
            selected={opt.value === value}
            easingFn={easingFunctions[opt.value]}
            onClick={() => { onChange(opt.value); setShowEditor(false); }}
          />
        ))}

        {/* Custom bezier cell */}
        <EasingButton
          easingType="custom"
          label="Custom"
          selected={customSelected}
          easingFn={customEasingFn}
          onClick={handleCustomClick}
        />
      </div>

      {/* Inline cubic bezier editor */}
      {customSelected && showEditor && onCustomBezierChange && (
        <div
          className="mt-2 p-2 rounded-md"
          style={{
            background: "var(--aw-surface)",
            border: "1px solid var(--aw-border)",
          }}
        >
          <CubicBezierEditor
            value={customBezierValues}
            onChange={onCustomBezierChange}
          />
        </div>
      )}
    </div>
  );
}

export function AnimateProperties() {
  const {
    objectMapRef,
    selectedTrack,
    selectedKeyframe,
    selectedKeyframeIndex,
    setSelectedKeyframeIndex,
    currentFrame,
    addKeyframeAtCurrentFrame,
    handleDeleteKeyframe,
    handleEasingChange,
    handlePropertyEasingChange,
    updateKeyframeCustomBezier,
    updateObjectProperty,
    selectedKeyframes,
    deleteSelectedKeyframes,
    copySelectedKeyframes,
    pasteKeyframes,
    clipboard,
  } = useAnimation();

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: "var(--aw-surface)", backdropFilter: "var(--aw-glass-blur)", WebkitBackdropFilter: "var(--aw-glass-blur)" }}
    >
      {/* Header */}
      <div
        className="px-3 py-2.5 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--aw-border)" }}
      >
        <Layers className="h-3 w-3" style={{ color: "var(--aw-text-3)" }} />
        <span className="text-[12px] font-semibold tracking-[0.1em] uppercase" style={{ color: "var(--aw-text-3)" }}>
          Properties
        </span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarColor: "rgba(139,92,246,0.12) transparent", scrollbarWidth: "thin" }}>
        {selectedTrack ? (
          <div>
            {/* Object header */}
            <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--aw-border)" }}>
              <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--aw-text)" }}>
                {selectedTrack.objectName}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                  style={{ background: "var(--aw-accent-dim)", color: "var(--aw-accent)" }}
                >
                  {selectedTrack.objectType}
                </span>
                <span className="text-[12px] flex items-center gap-1" style={{ color: "var(--aw-text-3)" }}>
                  <Diamond className="h-2.5 w-2.5" />
                  {selectedTrack.keyframes.length}
                </span>
              </div>
            </div>

            {/* Transform */}
            {(() => {
              const obj = objectMapRef.current.get(selectedTrack.objectId);
              if (!obj) return null;
              return (
                <div className="px-1 py-2" style={{ borderBottom: "1px solid var(--aw-border)" }}>
                  <div className="px-2 mb-1">
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase" style={{ color: "var(--aw-text-3)" }}>
                      Transform
                    </span>
                  </div>
                  <PropRow icon={Move} label="X" value={`${Math.round(obj.left ?? 0)}`} property="left" dragSensitivity={1} onCommit={updateObjectProperty} keyframeStatus={getKeyframeStatus(selectedTrack, "left", currentFrame)} />
                  <PropRow icon={Move} label="Y" value={`${Math.round(obj.top ?? 0)}`} property="top" dragSensitivity={1} onCommit={updateObjectProperty} keyframeStatus={getKeyframeStatus(selectedTrack, "top", currentFrame)} />
                  <PropRow icon={Scaling} label="Scale X" value={(obj.scaleX ?? 1).toFixed(2)} property="scaleX" dragSensitivity={0.01} onCommit={updateObjectProperty} keyframeStatus={getKeyframeStatus(selectedTrack, "scaleX", currentFrame)} />
                  <PropRow icon={Scaling} label="Scale Y" value={(obj.scaleY ?? 1).toFixed(2)} property="scaleY" dragSensitivity={0.01} onCommit={updateObjectProperty} keyframeStatus={getKeyframeStatus(selectedTrack, "scaleY", currentFrame)} />
                  <PropRow icon={RotateCw} label="Rotation" value={`${Math.round(obj.angle ?? 0)}\u00B0`} property="angle" suffix="\u00B0" dragSensitivity={1} onCommit={updateObjectProperty} keyframeStatus={getKeyframeStatus(selectedTrack, "angle", currentFrame)} />
                  <PropRow icon={Blend} label="Opacity" value={`${((obj.opacity ?? 1) * 100).toFixed(0)}%`} property="opacity" suffix="%" scale={100} dragSensitivity={1} onCommit={updateObjectProperty} keyframeStatus={getKeyframeStatus(selectedTrack, "opacity", currentFrame)} />

                  {typeof obj.fill === "string" && obj.fill && (
                    <ColorRow label="Fill" color={obj.fill} property="fill" onCommit={updateObjectProperty} />
                  )}
                  {typeof obj.stroke === "string" && obj.stroke && (
                    <ColorRow label="Stroke" color={obj.stroke} property="stroke" onCommit={updateObjectProperty} />
                  )}
                </div>
              );
            })()}

            {/* Selected keyframe details */}
            {selectedKeyframe && selectedKeyframeIndex !== null && (
              <div className="px-3 py-3 space-y-2.5" style={{ borderBottom: "1px solid var(--aw-border)" }}>
                <div className="flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3" style={{ color: "var(--aw-accent)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--aw-text)" }}>
                    Frame {selectedKeyframe.frame}
                  </span>
                </div>

                <div>
                  <label
                    className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-1.5 block"
                    style={{ color: "var(--aw-text-3)" }}
                  >
                    Easing Curve
                  </label>
                  <EasingCurveGrid
                    value={selectedKeyframe.easing}
                    onChange={(easing) =>
                      handleEasingChange(
                        selectedTrack.objectId,
                        selectedKeyframeIndex,
                        easing
                      )
                    }
                    customBezier={selectedKeyframe.customBezier}
                    onCustomBezierChange={(bezier) =>
                      updateKeyframeCustomBezier(
                        selectedTrack.objectId,
                        selectedKeyframeIndex,
                        bezier
                      )
                    }
                  />
                </div>

                {/* Per-property easing overrides */}
                {selectedKeyframe.propertyEasings && Object.keys(selectedKeyframe.propertyEasings).length > 0 && (
                  <div>
                    <label
                      className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-1 block"
                      style={{ color: "var(--aw-text-3)" }}
                    >
                      Property Overrides
                    </label>
                    <div className="space-y-1">
                      {Object.entries(selectedKeyframe.propertyEasings).map(([prop, easing]) => (
                        <div key={prop} className="flex items-center gap-1.5">
                          <span className="text-[12px] w-14 truncate" style={{ color: "var(--aw-text-3)" }}>
                            {prop}
                          </span>
                          <Select
                            value={easing}
                            onValueChange={(val) =>
                              handlePropertyEasingChange(
                                selectedTrack.objectId,
                                selectedKeyframeIndex,
                                prop as keyof AnimatableProps,
                                val as EasingType
                              )
                            }
                          >
                            <SelectTrigger className="h-6 text-[12px] flex-1 rounded" style={{ background: "var(--aw-bg)", border: "1px solid var(--aw-border)", color: "var(--aw-text-2)" }}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EASING_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add per-property override */}
                <PropertyEasingAdder
                  trackId={selectedTrack.objectId}
                  keyframeIndex={selectedKeyframeIndex}
                  currentEasing={selectedKeyframe.easing}
                  existingOverrides={selectedKeyframe.propertyEasings}
                  onAdd={handlePropertyEasingChange}
                />

                <button
                  className="w-full h-7 rounded-md text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-25"
                  style={{ color: "#ef4444", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}
                  onClick={() => {
                    handleDeleteKeyframe(selectedTrack.objectId, selectedKeyframeIndex);
                    setSelectedKeyframeIndex(null);
                  }}
                  disabled={selectedTrack.keyframes.length <= 1}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Keyframe
                </button>
              </div>
            )}

            {/* Multi-select actions */}
            {selectedKeyframes.length > 1 && (
              <div className="px-3 py-2.5 space-y-1.5" style={{ borderBottom: "1px solid var(--aw-border)" }}>
                <div className="flex items-center gap-1.5">
                  <Diamond className="h-3 w-3" style={{ color: "var(--aw-accent)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--aw-text)" }}>
                    {selectedKeyframes.length} keyframes selected
                  </span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--aw-text-3)" }}>
                  Alt+Arrow to move &middot; Shift for ×10
                </p>
                <div className="flex gap-1.5">
                  <button
                    className="flex-1 h-7 rounded-md text-[12px] font-medium flex items-center justify-center gap-1 transition-colors"
                    style={{ color: "var(--aw-accent)", background: "var(--aw-accent-dim)", border: "1px solid rgba(139,92,246,0.15)" }}
                    onClick={copySelectedKeyframes}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--aw-accent-dim)"; }}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                  <button
                    className="flex-1 h-7 rounded-md text-[12px] font-medium flex items-center justify-center gap-1 transition-colors"
                    style={{ color: "#ef4444", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}
                    onClick={deleteSelectedKeyframes}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Clipboard paste */}
            {clipboard.length > 0 && (
              <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--aw-border)" }}>
                <button
                  className="w-full h-7 rounded-md text-[12px] font-medium flex items-center justify-center gap-1 transition-colors"
                  style={{ color: "var(--aw-text-2)", background: "rgba(139,92,246,0.06)", border: "1px solid var(--aw-border)" }}
                  onClick={pasteKeyframes}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.06)"; }}
                >
                  <ClipboardPaste className="h-3 w-3" />
                  Paste {clipboard.length} keyframe(s) at frame {currentFrame}
                </button>
              </div>
            )}

            {/* Add keyframe CTA */}
            <div className="px-3 py-3">
              <button
                className="w-full h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                style={{
                  background: "var(--aw-accent-dim)",
                  color: "var(--aw-accent)",
                  border: "1px solid rgba(139,92,246,0.18)",
                }}
                onClick={addKeyframeAtCurrentFrame}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(139,92,246,0.18)";
                  e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--aw-accent-dim)";
                  e.currentTarget.style.borderColor = "rgba(139,92,246,0.18)";
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Keyframe at Frame {currentFrame}
              </button>
              <p className="text-[11px] text-center mt-1.5" style={{ color: "var(--aw-text-3)" }}>
                Press <kbd className="px-1 py-px rounded text-[10px]" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid var(--aw-border)" }}>K</kbd> to add keyframe
              </p>
            </div>

            {/* Animation presets */}
            <AnimatePresets />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-52 px-6 text-center">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "rgba(139,92,246,0.04)", border: "1px dashed var(--aw-border-strong)" }}
            >
              <Layers className="h-5 w-5" style={{ color: "var(--aw-text-3)" }} />
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--aw-text-3)" }}>
              Select an object on the canvas or a track below
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
