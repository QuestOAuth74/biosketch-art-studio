import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useCanvas } from "@/contexts/CanvasContext";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GradientPanel } from "./GradientPanel";
import { EffectsPanel } from "./EffectsPanel";
import { ColorPickerInput } from "@/components/ColorPicker/ColorPickerInput";

// Preset color palette
const COLOR_PRESETS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

export const StylePanel = () => {
  const { selectedObject, canvas, recentColors, addToRecentColors } = useCanvas();

  const [fill, setFill] = useState("#3b82f6");
  const [fillEnabled, setFillEnabled] = useState(true);
  const [stroke, setStroke] = useState("#000000");
  const [strokeEnabled, setStrokeEnabled] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(100);
  const [opacityBeforeDrag, setOpacityBeforeDrag] = useState<number | null>(null);

  // Helper to detect if object is a shape-with-text group
  const isShapeWithTextGroup = (obj: any): boolean => {
    if (obj.type !== 'group') return false;
    const objects = obj.getObjects();
    return (objects.length === 2 &&
           (objects[0].type === 'circle' || objects[0].type === 'rect') &&
           objects[1].type === 'textbox') ||
           (objects.length === 3 &&
           objects[0].type === 'rect' &&
           objects[1].type === 'textbox' &&
           objects[2].type === 'textbox');
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
    targetShape.set({ fill: fillEnabled ? color : '' });
    canvas.requestRenderAll();
    addToRecentColors(color);
    // Fire object:modified to trigger history save
    canvas.fire('object:modified', { target: selectedObject });
  };

  const handleFillToggle = (enabled: boolean) => {
    if (!selectedObject || !canvas) return;
    setFillEnabled(enabled);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ fill: enabled ? fill : '' });
    canvas.requestRenderAll();
    // Fire object:modified to trigger history save
    canvas.fire('object:modified', { target: selectedObject });
  };

  const handleStrokeChange = (color: string) => {
    if (!selectedObject || !canvas) return;
    setStroke(color);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ stroke: strokeEnabled ? color : '' });
    canvas.requestRenderAll();
    addToRecentColors(color);
    // Fire object:modified to trigger history save
    canvas.fire('object:modified', { target: selectedObject });
  };

  const handleStrokeToggle = (enabled: boolean) => {
    if (!selectedObject || !canvas) return;
    setStrokeEnabled(enabled);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ stroke: enabled ? stroke : '' });
    canvas.requestRenderAll();
    // Fire object:modified to trigger history save
    canvas.fire('object:modified', { target: selectedObject });
  };

  const handleStrokeWidthChange = (width: number) => {
    if (!selectedObject || !canvas) return;
    setStrokeWidth(width);
    const targetShape = getShapeFromGroup(selectedObject);
    targetShape.set({ strokeWidth: width });
    canvas.requestRenderAll();
    // Fire object:modified to trigger history save
    canvas.fire('object:modified', { target: selectedObject });
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
      canvas.fire('object:modified', { target: selectedObject });
    }

    // Reset drag tracking
    setOpacityBeforeDrag(null);
  };

  return (
    <Tabs defaultValue="colors" className="w-full">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="colors">Colors</TabsTrigger>
        <TabsTrigger value="gradients">Gradients</TabsTrigger>
        <TabsTrigger value="effects">Effects</TabsTrigger>
      </TabsList>

      <TabsContent value="colors" className="space-y-3 mt-3">
        {/* Fill */}
        <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Checkbox 
            id="fill" 
            checked={fillEnabled}
            onCheckedChange={handleFillToggle}
            disabled={!selectedObject}
          />
          <Label htmlFor="fill" className="font-semibold text-xs">Fill</Label>
        </div>
        <div className="pl-6">
          <ColorPickerInput
            value={fill}
            onChange={(color) => {
              handleFillChange(color);
              addToRecentColors(color);
            }}
            disabled={!selectedObject || !fillEnabled}
            showPresets={true}
            showHexInput={true}
          />
        </div>
        
        {/* Recent Colors */}
        {recentColors.length > 0 && (
          <div className="pl-6 space-y-1">
            <Label className="text-xs text-muted-foreground">Recent</Label>
            <div className="flex gap-1 flex-wrap">
              {recentColors.map((color, idx) => (
                <Button
                  key={`${color}-${idx}`}
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 p-0 border-2 hover:scale-110 transition-transform"
                  style={{ 
                    backgroundColor: color,
                    borderColor: fill === color ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  }}
                  onClick={() => handleFillChange(color)}
                  disabled={!selectedObject || !fillEnabled}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Color Presets */}
        <div className="pl-6 space-y-1">
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="grid grid-cols-9 gap-1">
          {COLOR_PRESETS.map((color) => (
            <Button
              key={color}
              variant="outline"
              size="icon"
              className="h-6 w-6 p-0 border-2 hover:scale-110 transition-transform"
              style={{ 
                backgroundColor: color,
                borderColor: fill === color ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              }}
              onClick={() => handleFillChange(color)}
              disabled={!selectedObject || !fillEnabled}
              title={color}
            />
          ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Border */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Checkbox 
            id="border" 
            checked={strokeEnabled}
            onCheckedChange={handleStrokeToggle}
            disabled={!selectedObject}
          />
          <Label htmlFor="border" className="font-semibold text-xs">Border</Label>
        </div>
        <div className="pl-6">
          <ColorPickerInput
            value={stroke}
            onChange={(color) => {
              handleStrokeChange(color);
              addToRecentColors(color);
            }}
            disabled={!selectedObject || !strokeEnabled}
            showPresets={true}
            showHexInput={true}
          />
        </div>
        
        {/* Recent Colors for Border */}
        {recentColors.length > 0 && (
          <div className="pl-6 space-y-1">
            <Label className="text-xs text-muted-foreground">Recent</Label>
            <div className="flex gap-1 flex-wrap">
              {recentColors.map((color, idx) => (
                <Button
                  key={`stroke-${color}-${idx}`}
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 p-0 border-2 hover:scale-110 transition-transform"
                  style={{ 
                    backgroundColor: color,
                    borderColor: stroke === color ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  }}
                  onClick={() => handleStrokeChange(color)}
                  disabled={!selectedObject || !strokeEnabled}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Color Presets */}
        <div className="pl-6 space-y-1">
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="grid grid-cols-9 gap-1">
          {COLOR_PRESETS.map((color) => (
            <Button
              key={color}
              variant="outline"
              size="icon"
              className="h-6 w-6 p-0 border-2 hover:scale-110 transition-transform"
              style={{ 
                backgroundColor: color,
                borderColor: stroke === color ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              }}
              onClick={() => handleStrokeChange(color)}
              disabled={!selectedObject || !strokeEnabled}
            title={color}
            />
          ))}
          </div>
        </div>
        <div className="pl-6 space-y-1">
          <Label className="text-xs">Width</Label>
          <Input 
            type="number" 
            value={strokeWidth}
            onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
            disabled={!selectedObject || !strokeEnabled}
            className="h-7 text-xs" 
            min="0"
            step="1"
          />
        </div>
      </div>

      <Separator />

      {/* Opacity */}
      <div className="space-y-1.5">
        <Label className="font-semibold text-xs">Opacity</Label>
        <Slider
          value={[opacity]}
          max={100}
          step={1}
          onValueChange={handleOpacityChange}
          onValueCommit={handleOpacityCommit}
          disabled={!selectedObject}
        />
        <p className="text-xs text-muted-foreground text-right">{opacity}%</p>
      </div>
      </TabsContent>

      <TabsContent value="gradients" className="mt-3">
        <GradientPanel />
      </TabsContent>

      <TabsContent value="effects" className="mt-3">
        <EffectsPanel />
      </TabsContent>
    </Tabs>
  );
};
