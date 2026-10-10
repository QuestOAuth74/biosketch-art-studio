import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ruler } from "lucide-react";
import { useCanvas } from "@/contexts/CanvasContext";
import { Group, Rect, Textbox } from "fabric";
import { getCanvasFontFamily } from "@/lib/fontLoader";
import { toast } from "sonner";
import { ColorPickerInput } from "@/components/ColorPicker/ColorPickerInput";

interface ScaleBarToolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNITS = [
  { label: "nm (nanometers)", value: "nm" },
  { label: "µm (micrometers)", value: "µm" },
  { label: "mm (millimeters)", value: "mm" },
  { label: "cm (centimeters)", value: "cm" },
  { label: "m (meters)", value: "m" },
  { label: "km (kilometers)", value: "km" },
];

const POSITIONS = [
  { label: "Bottom Left", value: "bottom-left" },
  { label: "Bottom Right", value: "bottom-right" },
  { label: "Top Left", value: "top-left" },
  { label: "Top Right", value: "top-right" },
];

const LABEL_POSITIONS = [
  { label: "Above", value: "above" },
  { label: "Below", value: "below" },
  { label: "Inline", value: "inline" },
];

const PRESETS = [
  { name: "100 µm (Cell Biology)", length: 100, unit: "µm" },
  { name: "500 nm (Subcellular)", length: 500, unit: "nm" },
  { name: "1 mm (Tissue)", length: 1, unit: "mm" },
  { name: "10 µm (High-Mag Histology)", length: 10, unit: "µm" },
  { name: "50 µm (Histology)", length: 50, unit: "µm" },
  { name: "200 µm (Low-Mag)", length: 200, unit: "µm" },
];

export const ScaleBarTool = ({ open, onOpenChange }: ScaleBarToolProps) => {
  const { canvas } = useCanvas();
  const [length, setLength] = useState(100);
  const [unit, setUnit] = useState("µm");
  const [position, setPosition] = useState("bottom-right");
  const [barColor, setBarColor] = useState("#000000");
  const [barThickness, setBarThickness] = useState(6);
  const [fontSize, setFontSize] = useState(14);
  const [labelPosition, setLabelPosition] = useState("above");
  const [showLabel, setShowLabel] = useState(true);
  const [padding, setPadding] = useState(40);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setLength(preset.length);
    setUnit(preset.unit);
  };

  const calculatePosition = (pos: string, barWidth: number, groupHeight: number) => {
    if (!canvas) return { x: 100, y: 100 };

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const pad = padding;

    switch (pos) {
      case "bottom-left":
        return { x: pad, y: canvasHeight - groupHeight - pad };
      case "bottom-right":
        return { x: canvasWidth - barWidth - pad, y: canvasHeight - groupHeight - pad };
      case "top-left":
        return { x: pad, y: pad };
      case "top-right":
        return { x: canvasWidth - barWidth - pad, y: pad };
      default:
        return { x: pad, y: canvasHeight - groupHeight - pad };
    }
  };

  const handleAddScaleBar = () => {
    if (!canvas) {
      toast.error("Canvas not ready");
      return;
    }

    // Calculate bar width (1px per unit for now, can be made adjustable)
    const barWidth = length * 2;
    const barHeight = barThickness;

    // Create the bar rectangle
    const bar = new Rect({
      width: barWidth,
      height: barHeight,
      fill: barColor,
      stroke: barColor,
      strokeWidth: 0,
      originX: "left",
      originY: "top",
    });

    const objects: any[] = [bar];
    let groupHeight = barHeight;

    // Create label text if enabled
    if (showLabel) {
      const labelText = `${length} ${unit}`;
      const label = new Textbox(labelText, {
        fontSize,
        fontFamily: getCanvasFontFamily("Inter"),
        fill: barColor,
        textAlign: "center",
        width: barWidth,
        originX: "left",
        originY: "top",
      });

      // Position label based on labelPosition
      if (labelPosition === "above") {
        label.set({ top: -(fontSize + 4), left: 0 });
        groupHeight += fontSize + 4;
      } else if (labelPosition === "below") {
        label.set({ top: barHeight + 4, left: 0 });
        groupHeight += fontSize + 4;
      } else {
        // inline - place text to the right of the bar
        label.set({ top: (barHeight - fontSize) / 2, left: barWidth + 8 });
      }

      objects.push(label);
    }

    // Create group
    const scaleBarGroup = new Group(objects, {
      selectable: true,
      hasControls: true,
      isScaleBar: true,
    } as any);

    // Calculate and set position
    const pos = calculatePosition(position, barWidth, groupHeight);
    scaleBarGroup.set({
      left: pos.x,
      top: pos.y,
    });

    canvas.add(scaleBarGroup);
    canvas.setActiveObject(scaleBarGroup);
    canvas.requestRenderAll();

    toast.success("Scale bar added to canvas");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Scale Bar</DialogTitle>
          <DialogDescription>
            Add a professional scale bar to your scientific figure
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Presets */}
          <div className="space-y-2">
            <Label>Quick Presets</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="justify-start text-xs"
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Length and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="length">Length</Label>
              <Input
                id="length"
                type="number"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                min={1}
                max={10000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[9999] bg-background">
                  {UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label htmlFor="position">Position on Canvas</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger id="position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999] bg-background">
                {POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bar Style */}
          <div className="space-y-2">
            <Label htmlFor="barColor">Bar Color</Label>
            <ColorPickerInput
              value={barColor}
              onChange={setBarColor}
              showPresets={true}
              showHexInput={true}
            />
          </div>

          <div className="space-y-2">
            <Label>Bar Thickness: {barThickness}px</Label>
            <Slider
              value={[barThickness]}
              onValueChange={([value]) => setBarThickness(value)}
              min={2}
              max={15}
              step={1}
            />
          </div>

          {/* Label Settings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Show Label</Label>
              <input
                type="checkbox"
                checked={showLabel}
                onChange={(e) => setShowLabel(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
            </div>
          </div>

          {showLabel && (
            <>
              <div className="space-y-2">
                <Label htmlFor="labelPosition">Label Position</Label>
                <Select value={labelPosition} onValueChange={setLabelPosition}>
                  <SelectTrigger id="labelPosition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[9999] bg-background">
                    {LABEL_POSITIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Font Size: {fontSize}px</Label>
                <Slider
                  value={[fontSize]}
                  onValueChange={([value]) => setFontSize(value)}
                  min={10}
                  max={24}
                  step={1}
                />
              </div>
            </>
          )}

          {/* Padding from edges */}
          <div className="space-y-2">
            <Label>Padding from Edge: {padding}px</Label>
            <Slider
              value={[padding]}
              onValueChange={([value]) => setPadding(value)}
              min={10}
              max={100}
              step={5}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddScaleBar}>
              <Ruler className="mr-2 h-4 w-4" />
              Add Scale Bar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
