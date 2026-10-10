import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCanvas } from "@/contexts/CanvasContext";
import { Textbox } from "fabric";
import { getCanvasFontFamily } from "@/lib/fontLoader";
import { toast } from "sonner";
import { ColorPickerInput } from "@/components/ColorPicker/ColorPickerInput";

interface PanelLabelToolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LabelPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
type LabelStyle = "circle" | "square" | "none";

export const PanelLabelTool = ({ open, onOpenChange }: PanelLabelToolProps) => {
  const { canvas, selectedObject } = useCanvas();
  const [startLetter, setStartLetter] = useState("A");
  const [count, setCount] = useState(1);
  const [position, setPosition] = useState<LabelPosition>("top-left");
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [textColor, setTextColor] = useState("#000000");
  const [bgStyle, setBgStyle] = useState<LabelStyle>("circle");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [offsetX, setOffsetX] = useState(20);
  const [offsetY, setOffsetY] = useState(20);

  const addPanelLabel = (letter: string, index: number) => {
    if (!canvas) return;

    const label = new Textbox(letter, {
      fontSize,
      fontFamily: getCanvasFontFamily(fontFamily),
      fill: textColor,
      fontWeight: "bold",
      textAlign: "center",
      originX: "center",
      originY: "center",
    });

    // Calculate position
    let x = 0, y = 0;
    
    if (selectedObject && !selectedObject.isType("activeSelection")) {
      const obj = selectedObject;
      const objLeft = obj.left || 0;
      const objTop = obj.top || 0;
      const objWidth = (obj.width || 0) * (obj.scaleX || 1);
      const objHeight = (obj.height || 0) * (obj.scaleY || 1);

      switch (position) {
        case "top-left":
          x = objLeft - offsetX;
          y = objTop - offsetY;
          break;
        case "top-right":
          x = objLeft + objWidth + offsetX;
          y = objTop - offsetY;
          break;
        case "bottom-left":
          x = objLeft - offsetX;
          y = objTop + objHeight + offsetY;
          break;
        case "bottom-right":
          x = objLeft + objWidth + offsetX;
          y = objTop + objHeight + offsetY;
          break;
        case "center":
          x = objLeft + objWidth / 2;
          y = objTop + objHeight / 2;
          break;
      }
    } else {
      // Use canvas positioning
      const canvasWidth = canvas.width || 800;
      const canvasHeight = canvas.height || 600;
      const spacing = 100;

      switch (position) {
        case "top-left":
          x = offsetX + (index * spacing);
          y = offsetY;
          break;
        case "top-right":
          x = canvasWidth - offsetX - (index * spacing);
          y = offsetY;
          break;
        case "bottom-left":
          x = offsetX + (index * spacing);
          y = canvasHeight - offsetY;
          break;
        case "bottom-right":
          x = canvasWidth - offsetX - (index * spacing);
          y = canvasHeight - offsetY;
          break;
        case "center":
          x = canvasWidth / 2 + (index * spacing);
          y = canvasHeight / 2;
          break;
      }
    }

    label.set({ left: x, top: y });

    // Add background shape if needed
    if (bgStyle !== "none") {
      const padding = 8;
      const bgSize = fontSize + padding * 2;

      if (bgStyle === "circle") {
        const { Circle } = require("fabric");
        const circle = new Circle({
          radius: bgSize / 2,
          fill: bgColor,
          stroke: textColor,
          strokeWidth: 2,
          left: x,
          top: y,
          originX: "center",
          originY: "center",
        });
        canvas.add(circle);
      } else if (bgStyle === "square") {
        const { Rect } = require("fabric");
        const rect = new Rect({
          width: bgSize,
          height: bgSize,
          fill: bgColor,
          stroke: textColor,
          strokeWidth: 2,
          left: x,
          top: y,
          originX: "center",
          originY: "center",
          rx: 4,
          ry: 4,
        });
        canvas.add(rect);
      }
    }

    canvas.add(label);
    canvas.requestRenderAll();
  };

  const handleAddLabels = () => {
    if (!canvas) return;

    const startCharCode = startLetter.toUpperCase().charCodeAt(0);
    
    for (let i = 0; i < count; i++) {
      const letter = String.fromCharCode(startCharCode + i);
      addPanelLabel(letter, i);
    }

    toast.success(`Added ${count} panel label${count > 1 ? 's' : ''}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Figure Panel Labels</DialogTitle>
          <DialogDescription>
            Add automatic A, B, C, D labels for multi-panel scientific figures
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-letter">Start Letter</Label>
              <Input
                id="start-letter"
                value={startLetter}
                onChange={(e) => setStartLetter(e.target.value.slice(0, 1))}
                maxLength={1}
                placeholder="A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count">Number of Labels</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={26}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Select value={position} onValueChange={(v) => setPosition(v as LabelPosition)}>
              <SelectTrigger id="position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="center">Center</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="offset-x">Offset X</Label>
              <Input
                id="offset-x"
                type="number"
                value={offsetX}
                onChange={(e) => setOffsetX(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offset-y">Offset Y</Label>
              <Input
                id="offset-y"
                type="number"
                value={offsetY}
                onChange={(e) => setOffsetY(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="font-family">Font Family</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger id="font-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial">Arial</SelectItem>
                <SelectItem value="Helvetica">Helvetica</SelectItem>
                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                <SelectItem value="Georgia">Georgia</SelectItem>
                <SelectItem value="Verdana">Verdana</SelectItem>
                <SelectItem value="Inter">Inter</SelectItem>
                <SelectItem value="STIX Two Text">STIX Two Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="font-size">Font Size</Label>
            <Input
              id="font-size"
              type="number"
              min={8}
              max={72}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value) || 24)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="text-color">Text Color</Label>
            <ColorPickerInput
              value={textColor}
              onChange={setTextColor}
              showPresets={true}
              showHexInput={true}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="bg-style">Background Style</Label>
            <Select value={bgStyle} onValueChange={(v) => setBgStyle(v as LabelStyle)}>
              <SelectTrigger id="bg-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="square">Square</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {bgStyle !== "none" && (
            <div className="space-y-2">
              <Label htmlFor="bg-color">Background Color</Label>
              <ColorPickerInput
                value={bgColor}
                onChange={setBgColor}
                showPresets={true}
                showHexInput={true}
              />
            </div>
          )}

          <Button onClick={handleAddLabels} className="w-full">
            Add Labels
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
