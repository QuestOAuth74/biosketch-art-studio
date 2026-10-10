import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useCanvas } from "@/contexts/CanvasContext";
import { FabricObject } from "fabric";
import { ColorPickerInput } from "@/components/ColorPicker/ColorPickerInput";

interface InlinePropertyPopoverProps {
  show: boolean;
  position: { x: number; y: number };
}

export const InlinePropertyPopover = ({ show, position }: InlinePropertyPopoverProps) => {
  const { selectedObject, canvas } = useCanvas();
  const [fill, setFill] = useState("#3b82f6");
  const [stroke, setStroke] = useState("#000000");
  const [opacity, setOpacity] = useState(100);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (selectedObject) {
      setFill((selectedObject.fill as string) || "#3b82f6");
      setStroke((selectedObject.stroke as string) || "#000000");
      setOpacity((selectedObject.opacity || 1) * 100);
      setWidth(Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1)));
      setHeight(Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1)));
    }
  }, [selectedObject]);

  if (!show || !selectedObject) return null;

  const handleFillChange = (color: string) => {
    if (!selectedObject) return;
    setFill(color);
    selectedObject.set({ fill: color });
    canvas?.requestRenderAll();
  };

  const handleStrokeChange = (color: string) => {
    if (!selectedObject) return;
    setStroke(color);
    selectedObject.set({ stroke: color });
    canvas?.requestRenderAll();
  };

  const handleOpacityChange = (value: number[]) => {
    if (!selectedObject) return;
    const newOpacity = value[0];
    setOpacity(newOpacity);
    selectedObject.set({ opacity: newOpacity / 100 });
    canvas?.requestRenderAll();
  };

  return (
    <div 
      className="absolute z-50 pointer-events-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="bg-background border rounded-lg shadow-lg p-3 space-y-2 w-64">
        <h4 className="text-sm font-semibold mb-2">Quick Properties</h4>
        
        <div className="space-y-2">
          <Label className="text-xs">Fill</Label>
          <ColorPickerInput
            value={fill}
            onChange={handleFillChange}
            showPresets={true}
            showHexInput={true}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Stroke</Label>
          <ColorPickerInput
            value={stroke}
            onChange={handleStrokeChange}
            showPresets={true}
            showHexInput={true}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Opacity: {opacity}%</Label>
          <Slider 
            value={[opacity]} 
            max={100} 
            step={1}
            onValueChange={handleOpacityChange}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Width</Label>
            <Input
              type="number"
              value={width}
              readOnly
              className="h-7 text-xs"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Height</Label>
            <Input
              type="number"
              value={height}
              readOnly
              className="h-7 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
