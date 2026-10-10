import { useState, useEffect } from "react";
import { X, Paintbrush, RotateCcw } from "lucide-react";
import { Canvas as FabricCanvas, FabricImage, filters as fabricFilters } from "fabric";
import { toast } from "sonner";

interface RecolorDialogProps {
  open: boolean;
  onClose: () => void;
  canvas: FabricCanvas | null;
}

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F97316", // orange
  "#EF4444", // red
  "#A855F7", // purple
  "#EAB308", // yellow
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#475569", // slate
  "#000000", // black
];

const MODES: { id: "tint" | "multiply" | "screen" | "overlay"; label: string }[] = [
  { id: "tint", label: "Tint" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
];

// Recursively collect every Fabric Image inside a selection (group, activeSelection, or single image).
function collectImages(obj: any): FabricImage[] {
  if (!obj) return [];
  if (obj.type === "image") return [obj as FabricImage];
  const out: FabricImage[] = [];
  if (typeof obj.getObjects === "function") {
    for (const child of obj.getObjects()) out.push(...collectImages(child));
  }
  return out;
}

export function RecolorDialog({ open, onClose, canvas }: RecolorDialogProps) {
  const [color, setColor] = useState("#3B82F6");
  const [alpha, setAlpha] = useState(0.5);
  const [mode, setMode] = useState<"tint" | "multiply" | "screen" | "overlay">("tint");
  const [hue, setHue] = useState(0);

  useEffect(() => {
    if (!open) {
      setColor("#3B82F6");
      setAlpha(0.5);
      setMode("tint");
      setHue(0);
    }
  }, [open]);

  if (!open) return null;

  const applyFilters = (newAlpha = alpha, newColor = color, newMode = mode, newHue = hue) => {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    const images = collectImages(active);
    if (!images.length) {
      toast.error("Select an image-based icon to recolor");
      return;
    }

    images.forEach((img) => {
      const newFilters: any[] = [];
      // BlendColor for color tint/multiply/etc.
      if (newAlpha > 0) {
        newFilters.push(new fabricFilters.BlendColor({ color: newColor, mode: newMode, alpha: newAlpha }));
      }
      // HueRotation for hue shift.
      if (Math.abs(newHue) > 0.001) {
        // Fabric expects rotation in -1..1 range (= -180..180 degrees).
        newFilters.push(new fabricFilters.HueRotation({ rotation: newHue }));
      }
      img.filters = newFilters;
      img.applyFilters();
    });
    canvas.requestRenderAll();
  };

  const handleApply = () => {
    applyFilters();
    toast.success("Recolor applied");
    onClose();
  };

  const handleReset = () => {
    if (!canvas) return;
    const images = collectImages(canvas.getActiveObject());
    images.forEach((img) => {
      img.filters = [];
      img.applyFilters();
    });
    canvas.requestRenderAll();
    setAlpha(0);
    setHue(0);
    toast.success("Filters cleared");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Recolor</h2>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Adjusts the selected icon's color without re-generating. No AI credits used.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); applyFilters(alpha, c, mode, hue); }}
                  className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                    color === c ? "border-primary ring-2 ring-primary/20 scale-105" : "border-border/40 hover:scale-105"
                  }`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => { setColor(e.target.value); applyFilters(alpha, e.target.value, mode, hue); }}
                className="w-7 h-7 rounded-lg border-2 border-border/40 cursor-pointer"
                title="Custom color"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Intensity</label>
              <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(alpha * 100)}%</span>
            </div>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={alpha}
              onChange={(e) => { const v = Number(e.target.value); setAlpha(v); applyFilters(v, color, mode, hue); }}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blend mode</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); applyFilters(alpha, color, m.id, hue); }}
                  className={`text-[11px] py-1.5 rounded-lg border transition-colors ${
                    mode === m.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border/40 text-muted-foreground hover:border-border"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hue shift</label>
              <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(hue * 180)}°</span>
            </div>
            <input
              type="range"
              min={-1} max={1} step={0.01}
              value={hue}
              onChange={(e) => { const v = Number(e.target.value); setHue(v); applyFilters(alpha, color, mode, v); }}
              className="w-full accent-primary"
            />
          </div>

          <div className="flex justify-between gap-2 pt-2 border-t border-border/30">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
