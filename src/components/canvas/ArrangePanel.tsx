import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  StretchHorizontal,
  StretchVertical,
  FlipHorizontal,
  FlipVertical,
  RotateCw
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCanvas } from "@/contexts/CanvasContext";
import { useEffect, useState } from "react";
import { CanvasEditorTestIds } from "@/lib/test-ids";

export const ArrangePanel = () => {
  const {
    canvas,
    selectedObject,
    distributeHorizontally,
    distributeVertically,
    distributionSpacing,
    setDistributionSpacing,
    matchWidth,
    matchHeight,
    flipHorizontal,
    flipVertical,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  } = useCanvas();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [rotation, setRotation] = useState(0);

  // Calculate enabled states based on selection
  const activeObjects = canvas?.getActiveObjects() || [];
  const canDistribute = activeObjects.length >= 3;
  const canMatch = activeObjects.length >= 2;

  useEffect(() => {
    if (selectedObject) {
      setPosition({ x: selectedObject.left || 0, y: selectedObject.top || 0 });
      setSize({ width: selectedObject.width || 0, height: selectedObject.height || 0 });
      setRotation(selectedObject.angle || 0);
    }
  }, [selectedObject]);

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    if (!selectedObject) return;
    if (axis === 'x') {
      selectedObject.set({ left: value });
      setPosition(prev => ({ ...prev, x: value }));
    } else {
      selectedObject.set({ top: value });
      setPosition(prev => ({ ...prev, y: value }));
    }
    selectedObject.canvas?.requestRenderAll();
  };

  const handleSizeChange = (dimension: 'width' | 'height', value: number) => {
    if (!selectedObject) return;

    // Calculate the scale factor based on the original dimensions
    const currentWidth = (selectedObject.width || 1) * (selectedObject.scaleX || 1);
    const currentHeight = (selectedObject.height || 1) * (selectedObject.scaleY || 1);

    if (dimension === 'width') {
      const scaleX = value / (selectedObject.width || 1);
      selectedObject.set({ scaleX });
    } else {
      const scaleY = value / (selectedObject.height || 1);
      selectedObject.set({ scaleY });
    }

    selectedObject.setCoords();
    setSize(prev => ({ ...prev, [dimension]: value }));
    selectedObject.canvas?.requestRenderAll();
  };

  const handleRotate = () => {
    if (!selectedObject) return;
    selectedObject.set({ angle: rotation });
    selectedObject.canvas?.requestRenderAll();
  };

  return (
    <div className="space-y-3">
      {/* Position */}
      <div className="space-y-1.5">
        <Label className="font-semibold text-xs">Position</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">X</Label>
            <Input
              type="number"
              value={position.x}
              onChange={(e) => handlePositionChange('x', Number(e.target.value))}
              disabled={!selectedObject}
              className="h-8 text-xs"
              data-testid={CanvasEditorTestIds.OBJECT_X_INPUT}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Y</Label>
            <Input
              type="number"
              value={position.y}
              onChange={(e) => handlePositionChange('y', Number(e.target.value))}
              disabled={!selectedObject}
              className="h-8 text-xs"
              data-testid={CanvasEditorTestIds.OBJECT_Y_INPUT}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Size */}
      <div className="space-y-1.5">
        <Label className="font-semibold text-xs">Size</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Width</Label>
            <Input
              type="number"
              value={size.width}
              onChange={(e) => handleSizeChange('width', Number(e.target.value))}
              disabled={!selectedObject || selectedObject.lockScalingX}
              className="h-8 text-xs"
              data-testid={CanvasEditorTestIds.OBJECT_WIDTH_INPUT}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height</Label>
            <Input
              type="number"
              value={size.height}
              onChange={(e) => handleSizeChange('height', Number(e.target.value))}
              disabled={!selectedObject || selectedObject.lockScalingY}
              className="h-8 text-xs"
              data-testid={CanvasEditorTestIds.OBJECT_HEIGHT_INPUT}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Distribute & Match */}
      <div className="space-y-1.5">
        <Label className="font-semibold text-xs">Distribute & Match</Label>

        {/* Distribute buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={distributeHorizontally}
                disabled={!canDistribute}
              >
                <AlignHorizontalSpaceBetween className="h-3.5 w-3.5 mr-1" />
                Dist H
              </Button>
            </TooltipTrigger>
            <TooltipContent>Distribute horizontally (⌘⇧H)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={distributeVertically}
                disabled={!canDistribute}
              >
                <AlignVerticalSpaceBetween className="h-3.5 w-3.5 mr-1" />
                Dist V
              </Button>
            </TooltipTrigger>
            <TooltipContent>Distribute vertically (⌘⌥V)</TooltipContent>
          </Tooltip>
        </div>

        {/* Match buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={matchWidth}
                disabled={!canMatch}
              >
                <StretchHorizontal className="h-3.5 w-3.5 mr-1" />
                Match W
              </Button>
            </TooltipTrigger>
            <TooltipContent>Match width (⌘⇧W)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={matchHeight}
                disabled={!canMatch}
              >
                <StretchVertical className="h-3.5 w-3.5 mr-1" />
                Match H
              </Button>
            </TooltipTrigger>
            <TooltipContent>Match height (⌘⇧E)</TooltipContent>
          </Tooltip>
        </div>

        {/* Spacing input */}
        <div className="space-y-1">
          <Label className="text-xs">Spacing</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              value={distributionSpacing}
              onChange={(e) => setDistributionSpacing(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="20"
              min="0"
              disabled={!canMatch}
              className="h-8 text-xs flex-1"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Set exact spacing for distribution
          </p>
        </div>
      </div>

      <Separator />

      {/* Flip & Rotate */}
      <div className="space-y-1.5">
        <Label className="font-semibold text-xs">Transform</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={flipHorizontal} disabled={!selectedObject}>
            <FlipHorizontal className="h-3.5 w-3.5 mr-1" />
            Flip H
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={flipVertical} disabled={!selectedObject}>
            <FlipVertical className="h-3.5 w-3.5 mr-1" />
            Flip V
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rotation</Label>
          <div className="flex gap-2">
            <Input 
              type="number" 
              value={rotation} 
              onChange={(e) => setRotation(Number(e.target.value))}
              disabled={!selectedObject}
              className="h-7 flex-1 text-xs" 
            />
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleRotate} disabled={!selectedObject}>
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Layer Order */}
      <div className="space-y-1.5">
        <Label className="font-semibold text-xs">Order</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bringForward} disabled={!selectedObject}>
            Bring Forward
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={sendBackward} disabled={!selectedObject}>
            Send Back
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bringToFront} disabled={!selectedObject}>
            To Front
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={sendToBack} disabled={!selectedObject}>
            To Back
          </Button>
        </div>
      </div>
    </div>
  );
};
