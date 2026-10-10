import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useCanvas } from "@/contexts/CanvasContext";
import { useState, useEffect } from "react";
import { ShadowConfig, SHADOW_PRESETS } from "@/types/effects";
import { Separator } from "@/components/ui/separator";
import { ColorPickerInput } from "@/components/ColorPicker/ColorPickerInput";

export const EffectsPanel = () => {
  const { selectedObject, canvas, applyShadow, clearEffects, addToRecentColors } = useCanvas();

  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [blur, setBlur] = useState(10);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(4);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [opacity, setOpacity] = useState(0.3);

  // Track object modifications to force UI sync
  const [modificationCounter, setModificationCounter] = useState(0);

  // Listen for object:modified events to sync UI
  useEffect(() => {
    if (!canvas) return;

    const handleObjectModified = () => {
      setModificationCounter(prev => prev + 1);
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('object:modified', handleObjectModified);
    };
  }, [canvas]);

  useEffect(() => {
    if (selectedObject) {
      const shadow = (selectedObject as any).shadow;
      if (shadow) {
        setShadowEnabled(true);
        setBlur(shadow.blur || 10);
        setOffsetX(shadow.offsetX || 0);
        setOffsetY(shadow.offsetY || 4);

        // Extract color and opacity from shadow.color (which may include alpha)
        let color = shadow.color || '#000000';
        let extractedOpacity = 0.3;

        // Handle hex with alpha (#RRGGBBAA)
        if (color.length === 9 && color.startsWith('#')) {
          const alphaHex = color.substring(7, 9);
          extractedOpacity = parseInt(alphaHex, 16) / 255;
          color = color.substring(0, 7); // Base color without alpha
        }

        setShadowColor(color);
        setOpacity(shadow.opacity !== undefined ? shadow.opacity : extractedOpacity);
      } else {
        setShadowEnabled(false);
      }
    }
  }, [selectedObject, modificationCounter]);

  const handleApply = () => {
    const config: ShadowConfig = {
      enabled: shadowEnabled,
      blur,
      offsetX,
      offsetY,
      color: shadowColor,
      opacity
    };
    applyShadow(config);
    if (shadowEnabled) {
      addToRecentColors(shadowColor);
    }
  };

  const handlePresetApply = (preset: typeof SHADOW_PRESETS[0]) => {
    setShadowEnabled(true);
    setBlur(preset.blur);
    setOffsetX(preset.offsetX);
    setOffsetY(preset.offsetY);
    setShadowColor(preset.color);
    setOpacity(preset.opacity);
    
    // Auto-apply preset
    setTimeout(() => {
      applyShadow({
        enabled: true,
        blur: preset.blur,
        offsetX: preset.offsetX,
        offsetY: preset.offsetY,
        color: preset.color,
        opacity: preset.opacity
      });
    }, 0);
  };

  const handleClearAll = () => {
    setShadowEnabled(false);
    clearEffects();
  };

  return (
    <div className="space-y-3">
      {/* Drop Shadow */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Checkbox 
            id="shadow" 
            checked={shadowEnabled}
            onCheckedChange={(checked) => setShadowEnabled(checked as boolean)}
            disabled={!selectedObject}
          />
          <Label htmlFor="shadow" className="font-semibold text-xs">Drop Shadow</Label>
        </div>

        {shadowEnabled && (
          <>
            <div className="pl-6 space-y-3">
              {/* Color */}
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <ColorPickerInput
                  value={shadowColor}
                  onChange={(color) => {
                    setShadowColor(color);
                    addToRecentColors(color);
                  }}
                  disabled={!selectedObject}
                  showPresets={true}
                  showHexInput={true}
                />
              </div>

              {/* Blur */}
              <div className="space-y-1.5">
                <Label className="text-xs">Blur</Label>
                <div className="flex gap-2 items-center">
                  <Slider 
                    value={[blur]} 
                    min={0} 
                    max={50} 
                    step={1}
                    onValueChange={([v]) => setBlur(v)}
                    disabled={!selectedObject}
                    className="flex-1"
                  />
                  <Input 
                    type="number" 
                    value={blur}
                    onChange={(e) => setBlur(Number(e.target.value))}
                    className="h-7 w-16 text-xs"
                    disabled={!selectedObject}
                    min={0}
                    max={50}
                  />
                </div>
              </div>

              {/* Offset X */}
              <div className="space-y-1.5">
                <Label className="text-xs">Offset X</Label>
                <div className="flex gap-2 items-center">
                  <Slider 
                    value={[offsetX]} 
                    min={-50} 
                    max={50} 
                    step={1}
                    onValueChange={([v]) => setOffsetX(v)}
                    disabled={!selectedObject}
                    className="flex-1"
                  />
                  <Input 
                    type="number" 
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.target.value))}
                    className="h-7 w-16 text-xs"
                    disabled={!selectedObject}
                    min={-50}
                    max={50}
                  />
                </div>
              </div>

              {/* Offset Y */}
              <div className="space-y-1.5">
                <Label className="text-xs">Offset Y</Label>
                <div className="flex gap-2 items-center">
                  <Slider 
                    value={[offsetY]} 
                    min={-50} 
                    max={50} 
                    step={1}
                    onValueChange={([v]) => setOffsetY(v)}
                    disabled={!selectedObject}
                    className="flex-1"
                  />
                  <Input 
                    type="number" 
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                    className="h-7 w-16 text-xs"
                    disabled={!selectedObject}
                    min={-50}
                    max={50}
                  />
                </div>
              </div>

              {/* Opacity */}
              <div className="space-y-1.5">
                <Label className="text-xs">Opacity</Label>
                <Slider 
                  value={[opacity * 100]} 
                  min={0} 
                  max={100} 
                  step={1}
                  onValueChange={([v]) => setOpacity(v / 100)}
                  disabled={!selectedObject}
                />
                <p className="text-xs text-muted-foreground text-right">{(opacity * 100).toFixed(0)}%</p>
              </div>
            </div>

            {/* Apply Button */}
            <Button
              onClick={handleApply}
              className="w-full h-8 text-xs"
              disabled={!selectedObject}
            >
              Apply Shadow
            </Button>

            <Separator />

            {/* Presets */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Shadow Presets</Label>
              <div className="grid grid-cols-2 gap-2">
                {SHADOW_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetApply(preset)}
                    disabled={!selectedObject}
                    className="h-auto flex-col items-center p-3 hover:border-primary"
                  >
                    <div 
                      className="w-12 h-12 bg-primary rounded mb-2"
                      style={{
                        boxShadow: `${preset.offsetX}px ${preset.offsetY}px ${preset.blur}px ${preset.color}${Math.round(preset.opacity * 255).toString(16).padStart(2, '0')}`
                      }}
                    />
                    <span className="text-xs font-medium">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Clear All Effects */}
      <Button
        onClick={handleClearAll}
        variant="outline"
        className="w-full h-8 text-xs"
        disabled={!selectedObject}
      >
        Clear All Effects
      </Button>
    </div>
  );
};
