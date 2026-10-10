import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanvas } from "@/contexts/CanvasContext";
import { useState, useEffect } from "react";
import { GradientConfig, GRADIENT_PRESETS, GradientStop } from "@/types/effects";
import { Plus, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ColorPickerInput } from "@/components/ColorPicker/ColorPickerInput";

export const GradientPanel = () => {
  const { selectedObject, applyGradient, clearGradient, addToRecentColors } = useCanvas();
  
  const [gradientType, setGradientType] = useState<'none' | 'linear' | 'radial'>('none');
  const [angle, setAngle] = useState(90);
  const [centerX, setCenterX] = useState(0.5);
  const [centerY, setCenterY] = useState(0.5);
  const [radius, setRadius] = useState(100);
  const [colorStops, setColorStops] = useState<GradientStop[]>([
    { color: '#3b82f6', offset: 0, opacity: 1 },
    { color: '#8b5cf6', offset: 1, opacity: 1 }
  ]);
  const [target, setTarget] = useState<'fill' | 'stroke'>('fill');

  useEffect(() => {
    if (selectedObject) {
      // Try to detect if object has gradient
      const fill = (selectedObject as any).fill;
      if (fill && typeof fill === 'object' && fill.type) {
        setGradientType(fill.type);
        if (fill.colorStops) {
          setColorStops(fill.colorStops.map((stop: any) => ({
            color: stop.color,
            offset: stop.offset,
            opacity: stop.opacity || 1
          })));
        }
      } else {
        setGradientType('none');
      }
    }
  }, [selectedObject]);

  const handleAddStop = () => {
    const newStop: GradientStop = {
      color: '#ffffff',
      offset: 0.5,
      opacity: 1
    };
    setColorStops([...colorStops, newStop].sort((a, b) => a.offset - b.offset));
  };

  const handleRemoveStop = (index: number) => {
    if (colorStops.length > 2) {
      setColorStops(colorStops.filter((_, i) => i !== index));
    }
  };

  const handleStopChange = (index: number, field: keyof GradientStop, value: any) => {
    const updated = [...colorStops];
    updated[index] = { ...updated[index], [field]: value };
    setColorStops(updated.sort((a, b) => a.offset - b.offset));
  };

  const handleApply = () => {
    if (gradientType === 'none') {
      clearGradient(target);
      return;
    }

    let config: GradientConfig;
    if (gradientType === 'linear') {
      config = {
        type: 'linear',
        angle,
        stops: colorStops
      };
    } else {
      config = {
        type: 'radial',
        centerX,
        centerY,
        radius,
        stops: colorStops
      };
    }

    applyGradient(config, target);
    colorStops.forEach(stop => addToRecentColors(stop.color));
  };

  const handlePresetApply = (preset: typeof GRADIENT_PRESETS[0]) => {
    setGradientType(preset.type);
    setColorStops(preset.stops);
    if (preset.type === 'linear') {
      setAngle(preset.angle);
    } else if (preset.type === 'radial') {
      setCenterX(preset.centerX);
      setCenterY(preset.centerY);
      setRadius(preset.radius);
    }
    
    // Auto-apply preset
    setTimeout(() => {
      const config: GradientConfig = preset.type === 'linear' 
        ? { type: 'linear', angle: preset.angle, stops: preset.stops }
        : { type: 'radial', centerX: preset.centerX, centerY: preset.centerY, radius: preset.radius, stops: preset.stops };
      applyGradient(config, target);
    }, 0);
  };

  // Generate gradient preview CSS
  const getPreviewStyle = () => {
    if (gradientType === 'none') return { background: '#f3f4f6' };
    
    if (gradientType === 'linear') {
      const stopsStr = colorStops
        .map(stop => `${stop.color} ${stop.offset * 100}%`)
        .join(', ');
      return { background: `linear-gradient(${angle}deg, ${stopsStr})` };
    } else {
      const stopsStr = colorStops
        .map(stop => `${stop.color} ${stop.offset * 100}%`)
        .join(', ');
      return { background: `radial-gradient(circle, ${stopsStr})` };
    }
  };

  return (
    <div className="space-y-3">
      {/* Gradient Type */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Gradient Type</Label>
        <Select value={gradientType} onValueChange={(v: any) => setGradientType(v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="linear">Linear</SelectItem>
            <SelectItem value="radial">Radial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Apply To */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Apply To</Label>
        <Select value={target} onValueChange={(v: any) => setTarget(v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fill">Fill</SelectItem>
            <SelectItem value="stroke">Stroke</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {gradientType !== 'none' && (
        <>
          <Separator />

          {/* Linear Controls */}
          {gradientType === 'linear' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Angle</Label>
              <div className="flex gap-2 items-center">
                <Slider 
                  value={[angle]} 
                  min={0} 
                  max={360} 
                  step={1}
                  onValueChange={([v]) => setAngle(v)}
                  className="flex-1"
                />
                <Input 
                  type="number" 
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                  className="h-7 w-16 text-xs"
                  min={0}
                  max={360}
                />
              </div>
            </div>
          )}

          {/* Radial Controls */}
          {gradientType === 'radial' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Center X</Label>
                <Slider 
                  value={[centerX * 100]} 
                  min={0} 
                  max={100} 
                  step={1}
                  onValueChange={([v]) => setCenterX(v / 100)}
                />
                <p className="text-xs text-muted-foreground">{(centerX * 100).toFixed(0)}%</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Center Y</Label>
                <Slider 
                  value={[centerY * 100]} 
                  min={0} 
                  max={100} 
                  step={1}
                  onValueChange={([v]) => setCenterY(v / 100)}
                />
                <p className="text-xs text-muted-foreground">{(centerY * 100).toFixed(0)}%</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Radius</Label>
                <div className="flex gap-2 items-center">
                  <Slider 
                    value={[radius]} 
                    min={10} 
                    max={300} 
                    step={1}
                    onValueChange={([v]) => setRadius(v)}
                    className="flex-1"
                  />
                  <Input 
                    type="number" 
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="h-7 w-16 text-xs"
                  />
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Color Stops */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Color Stops</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddStop}
                className="h-6 text-xs"
                disabled={!selectedObject}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {colorStops.map((stop, index) => (
                <div key={index} className="p-2 border border-border rounded-md space-y-2">
                  <div className="flex gap-2 items-center">
                    <ColorPickerInput
                      value={stop.color}
                      onChange={(color) => {
                        handleStopChange(index, 'color', color);
                        addToRecentColors(color);
                      }}
                      showPresets={true}
                      showHexInput={true}
                      className="flex-1"
                    />
                    {colorStops.length > 2 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveStop(index)}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Position: {(stop.offset * 100).toFixed(0)}%</Label>
                    <Slider 
                      value={[stop.offset * 100]} 
                      min={0} 
                      max={100} 
                      step={1}
                      onValueChange={([v]) => handleStopChange(index, 'offset', v / 100)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Preview</Label>
            <div 
              className="h-16 rounded-md border border-border"
              style={getPreviewStyle()}
            />
          </div>

          {/* Apply Button */}
          <Button
            onClick={handleApply}
            className="w-full h-8 text-xs"
            disabled={!selectedObject}
          >
            Apply Gradient
          </Button>

          <Separator />

          {/* Presets */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Presets</Label>
            <div className="grid grid-cols-2 gap-2">
              {GRADIENT_PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetApply(preset)}
                  disabled={!selectedObject}
                  className="h-auto flex-col items-start p-2 hover:border-primary"
                >
                  <div 
                    className="w-full h-8 rounded mb-1"
                    style={{
                      background: preset.type === 'linear'
                        ? `linear-gradient(${preset.angle}deg, ${preset.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`
                        : `radial-gradient(circle, ${preset.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`
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
  );
};
