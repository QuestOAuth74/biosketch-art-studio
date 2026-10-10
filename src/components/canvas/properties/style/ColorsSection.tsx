import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Canvas, FabricObject } from "fabric";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { ColorPickerSection } from "../ColorPickerSection";

interface ColorsSectionProps {
  selectedObject: FabricObject | null;
  canvas: Canvas | null;
  recentColors: string[];
  addToRecentColors: (color: string) => void;
  stickyOffset?: number;
}

/**
 * Colors section for Style tab
 * No accordion per guidelines (primary controls, always visible)
 */
export const ColorsSection = ({
  selectedObject,
  canvas,
  recentColors,
  addToRecentColors,
  stickyOffset = 0,
}: ColorsSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-colors'] ?? true);
  const [fill, setFill] = useState("#3b82f6");
  const [fillEnabled, setFillEnabled] = useState(true);
  const [stroke, setStroke] = useState("#000000");
  const [strokeEnabled, setStrokeEnabled] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(100);
  const [opacityBeforeDrag, setOpacityBeforeDrag] = useState<number | null>(null);
  const [strokeWidthBeforeDrag, setStrokeWidthBeforeDrag] = useState<number | null>(null);

  const PRESET_COLORS = [
    { color: "#3b82f6", label: "Blue" },
    { color: "#10b981", label: "Emerald" },
    { color: "#f59e0b", label: "Amber" },
    { color: "#ef4444", label: "Red" },
    { color: "#8b5cf6", label: "Violet" },
    { color: "#ec4899", label: "Pink" },
  ];

  // Helper to detect if object is a shape-with-text group
  const isShapeWithTextGroup = (obj: any): boolean => {
    if (obj.type !== "group") return false;
    const objects = obj.getObjects();
    return (
      (objects.length === 2 &&
        (objects[0].type === "circle" || objects[0].type === "rect") &&
        objects[1].type === "textbox") ||
      (objects.length === 3 &&
        objects[0].type === "rect" &&
        objects[1].type === "textbox" &&
        objects[2].type === "textbox")
    );
  };

  // Helper to get the shape from a group
  const getShapeFromGroup = (obj: any) => {
    if (isShapeWithTextGroup(obj)) {
      return obj.getObjects()[0]; // First object is the shape
    }
    return obj; // Return the object itself if not a group
  };

  useEffect(() => {
    if (selectedObject) {
      const targetShape = getShapeFromGroup(selectedObject);
      setFill((targetShape.fill as string) || "#3b82f6");
      setStroke((targetShape.stroke as string) || "#000000");
      setStrokeWidth(targetShape.strokeWidth || 2);
      setOpacity((selectedObject.opacity || 1) * 100);
      setFillEnabled(!!targetShape.fill);
      setStrokeEnabled(!!targetShape.stroke);
    }
  }, [selectedObject]);

  const handleFillChange = (color: string) => {
    if (!selectedObject || !canvas) return;
    setFill(color);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ fill: fillEnabled ? color : "" });
    canvas.requestRenderAll();
    addToRecentColors(color);
    // Fire object:modified to trigger history save
    canvas.fire("object:modified", { target: selectedObject });
  };

  const handleFillToggle = (enabled: boolean) => {
    if (!selectedObject || !canvas) return;
    setFillEnabled(enabled);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ fill: enabled ? fill : "" });
    canvas.requestRenderAll();
    // Fire object:modified to trigger history save
    canvas.fire("object:modified", { target: selectedObject });
  };

  const handleStrokeChange = (color: string) => {
    if (!selectedObject || !canvas) return;
    setStroke(color);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ stroke: strokeEnabled ? color : "" });
    canvas.requestRenderAll();
    addToRecentColors(color);
    // Fire object:modified to trigger history save
    canvas.fire("object:modified", { target: selectedObject });
  };

  const handleStrokeToggle = (enabled: boolean) => {
    if (!selectedObject || !canvas) return;
    setStrokeEnabled(enabled);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ stroke: enabled ? stroke : "" });
    canvas.requestRenderAll();
    // Fire object:modified to trigger history save
    canvas.fire("object:modified", { target: selectedObject });
  };

  const handleStrokeWidthChange = (width: number) => {
    if (!selectedObject || !canvas) return;

    // Track initial width on first change
    if (strokeWidthBeforeDrag === null) {
      setStrokeWidthBeforeDrag(strokeWidth);
    }

    // Update visual only, don't save to history during drag
    setStrokeWidth(width);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ strokeWidth: width });
    canvas.requestRenderAll();
  };

  const handleStrokeWidthCommit = (value: number[]) => {
    if (!selectedObject || !canvas) return;

    // Only save if width actually changed
    if (strokeWidthBeforeDrag !== null && strokeWidthBeforeDrag !== value[0]) {
      // Fire object:modified to save final state once
      canvas.fire("object:modified", { target: selectedObject });
    }

    // Reset drag tracking
    setStrokeWidthBeforeDrag(null);
  };

  const handleOpacityChange = (value: number[]) => {
    if (!selectedObject || !canvas) return;
    const newOpacity = value[0];

    // Track initial opacity on first change
    if (opacityBeforeDrag === null) {
      setOpacityBeforeDrag(opacity);
    }

    // Update visual only, don't save to history during drag
    setOpacity(newOpacity);
    selectedObject.set({ opacity: newOpacity / 100 });
    selectedObject.setCoords();
    canvas.requestRenderAll();
  };

  const handleOpacityCommit = (value: number[]) => {
    if (!selectedObject || !canvas) return;

    // Only save if opacity actually changed
    if (opacityBeforeDrag !== null && opacityBeforeDrag !== value[0]) {
      // Fire object:modified to save final state once
      canvas.fire("object:modified", { target: selectedObject });
    }

    // Reset drag tracking
    setOpacityBeforeDrag(null);
  };

  return (
    <div id="section-colors" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-colors')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Colors
        </h3>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="space-y-3 px-3 pb-3 pt-3 overflow-hidden">
          {/* Fill */}
          <div className="space-y-1.5 w-full">
            <div className="flex items-center gap-2">
              <Checkbox
                id="fill"
                checked={fillEnabled}
                onCheckedChange={handleFillToggle}
                disabled={!selectedObject}
              />
              <Label htmlFor="fill" className="font-semibold text-xs">
                Fill
              </Label>
            </div>
            {fillEnabled && selectedObject && (
              <div className="pl-6 w-full overflow-hidden space-y-2">
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map(({ color, label }) => (
                    <button
                      key={`fill-${color}`}
                      title={label}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${fill === color ? 'border-slate-800 ring-1 ring-slate-400' : 'border-slate-300'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleFillChange(color)}
                    />
                  ))}
                </div>
                <ColorPickerSection
                  label="Fill Color"
                  value={fill}
                  onChange={handleFillChange}
                  recentColors={recentColors}
                  showOpacity={false}
                />
              </div>
            )}
          </div>

          {/* Stroke */}
          <div className="space-y-1.5 w-full">
            <div className="flex items-center gap-2">
              <Checkbox
                id="stroke"
                checked={strokeEnabled}
                onCheckedChange={handleStrokeToggle}
                disabled={!selectedObject}
              />
              <Label htmlFor="stroke" className="font-semibold text-xs">
                Stroke
              </Label>
            </div>
            {strokeEnabled && selectedObject && (
              <div className="space-y-2 pl-6 w-full overflow-hidden">
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map(({ color, label }) => (
                    <button
                      key={`stroke-${color}`}
                      title={label}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${stroke === color ? 'border-slate-800 ring-1 ring-slate-400' : 'border-slate-300'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleStrokeChange(color)}
                    />
                  ))}
                </div>
                <ColorPickerSection
                  label="Stroke Color"
                  value={stroke}
                  onChange={handleStrokeChange}
                  recentColors={recentColors}
                  showOpacity={false}
                />
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground">
                    Width: {strokeWidth}px
                  </Label>
                  <Slider
                    value={[strokeWidth]}
                    onValueChange={([value]) => handleStrokeWidthChange(value)}
                    onValueCommit={handleStrokeWidthCommit}
                    min={0}
                    max={20}
                    step={0.5}
                    disabled={!selectedObject}
                    className="mt-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Opacity */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-xs">
              Opacity: {opacity}%
            </Label>
            <Slider
              value={[opacity]}
              onValueChange={handleOpacityChange}
              onValueCommit={handleOpacityCommit}
              min={0}
              max={100}
              step={1}
              disabled={!selectedObject}
            />
          </div>
        </div>
      )}
    </div>
  );
};
