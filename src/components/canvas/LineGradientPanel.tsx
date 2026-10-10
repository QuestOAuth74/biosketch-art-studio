import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScribbleIcon } from "@phosphor-icons/react";
import { useCanvas } from "@/contexts/CanvasContext";
import { LineGradientConfig } from "@/types/effects";
import { ShapeWithPorts } from "@/types/connector";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { ColorPickerInput } from "@/components/ColorPicker/ColorPickerInput";
import * as SliderPrimitive from "@radix-ui/react-slider";

const GRADIENT_PRESETS: { [key: string]: Partial<LineGradientConfig> } = {
  'fade-out': {
    type: 'fade-out',
    gradientStart: 40,
    gradientEnd: 100,
    startOpacity: 1,
    endOpacity: 0,
  },
  'fade-in': {
    type: 'fade-in',
    gradientStart: 0,
    gradientEnd: 60,
    startOpacity: 0,
    endOpacity: 1,
  },
  'color-transition': {
    type: 'color-transition',
    gradientStart: 0,
    gradientEnd: 100,
    startOpacity: 1,
    endOpacity: 1,
  },
  'custom': {},
};

export const LineGradientPanel = () => {
  const { selectedObject, canvas, applyLineGradient, clearLineGradient } = useCanvas();
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-line-gradient'] ?? true);
  const [preset, setPreset] = useState<string>('fade-in');
  const [direction, setDirection] = useState<'along-path' | 'reverse'>('reverse');
  const [startColor, setStartColor] = useState('#3b82f6');
  const [endColor, setEndColor] = useState('#afb5c1');
  const [startOpacity, setStartOpacity] = useState(1);
  const [endOpacity, setEndOpacity] = useState(0);
  const [gradientStart, setGradientStart] = useState(0);
  const [gradientEnd, setGradientEnd] = useState(60);

  // Load existing gradient config or initialize from stroke color
  useEffect(() => {
    if (!selectedObject) return;

    let targetObj: any = selectedObject;
    if (selectedObject.type === 'group' && (selectedObject as any)._objects?.length) {
      const group = selectedObject as any;
      targetObj =
        group._objects.find((obj: any) => obj.type === 'path' || obj.type === 'line') ??
        group._objects[0];
    }

    const gradientConfig = targetObj?.gradientConfig;
    const strokeColor = typeof targetObj?.stroke === 'string' ? targetObj.stroke : undefined;

    if (gradientConfig) {
      setPreset(gradientConfig.type || 'fade-in');
      setDirection(gradientConfig.direction || 'reverse');
      setStartColor(gradientConfig.startColor || strokeColor || '#3b82f6');
      setEndColor(gradientConfig.endColor || strokeColor || '#afb5c1');
      setStartOpacity(typeof gradientConfig.startOpacity === 'number' ? gradientConfig.startOpacity : 1);
      setEndOpacity(typeof gradientConfig.endOpacity === 'number' ? gradientConfig.endOpacity : 0);
      // Handle both new (gradientStart/gradientEnd) and old (solidStartPercent/solidEndPercent) formats
      const gs = gradientConfig.gradientStart ?? gradientConfig.solidStartPercent ?? 0;
      const ge = gradientConfig.gradientEnd   ?? (100 - (gradientConfig.solidEndPercent ?? 0));
      setGradientStart(gs);
      setGradientEnd(ge);
    } else if (strokeColor) {
      setStartColor(strokeColor);
      // Keep endColor at its default blue so there's always a visible color transition
    }
  }, [selectedObject]);

  const connectorGroup =
    selectedObject?.type === 'group' && (selectedObject as any).connectorData;

  const isLineType =
    connectorGroup ||
    (selectedObject as ShapeWithPorts)?.isConnector ||
    (selectedObject as any)?.isBezierPath ||
    (selectedObject as any)?.isFreeformLine ||
    (selectedObject as any)?.isCurvedLine ||
    (selectedObject as any)?.isOrthogonalLine ||
    (selectedObject as any)?.isStraightLine ||
    selectedObject?.type === 'line';

  if (!selectedObject || !isLineType) {
    return null;
  }

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const presetConfig = GRADIENT_PRESETS[value];
    if (presetConfig) {
      if (presetConfig.gradientStart !== undefined) setGradientStart(presetConfig.gradientStart);
      if (presetConfig.gradientEnd   !== undefined) setGradientEnd(presetConfig.gradientEnd);
      if (presetConfig.startOpacity  !== undefined) setStartOpacity(presetConfig.startOpacity);
      if (presetConfig.endOpacity    !== undefined) setEndOpacity(presetConfig.endOpacity);
    }
  };

  const handleApplyGradient = () => {
    if (!canvas || !selectedObject) return;

    const config: LineGradientConfig = {
      type: preset as any,
      direction,
      gradientStart,
      gradientEnd,
      startColor,
      endColor,
      startOpacity,
      endOpacity,
      stops: [
        { color: startColor, offset: 0,                  opacity: startOpacity },
        { color: startColor, offset: gradientStart / 100, opacity: startOpacity },
        { color: endColor,   offset: gradientEnd / 100,   opacity: endOpacity  },
        { color: endColor,   offset: 1,                   opacity: endOpacity  },
      ],
    };

    applyLineGradient(config);
  };

  const handleClearGradient = () => {
    if (!canvas || !selectedObject) return;
    clearLineGradient();
  };

  // Build preview gradient using rgba
  const toRgba = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  };
  const previewGradient = `linear-gradient(90deg,
    ${toRgba(startColor, startOpacity)} 0%,
    ${toRgba(startColor, startOpacity)} ${gradientStart}%,
    ${toRgba(endColor, endOpacity)} ${gradientEnd}%,
    ${toRgba(endColor, endOpacity)} 100%
  )`;

  return (
    <div id="section-line-gradient" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-line-gradient')}
      >
        <div className="flex items-center gap-2">
          <ScribbleIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Line Gradient
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Preset</Label>
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade-out">Fade Out</SelectItem>
                <SelectItem value="fade-in">Fade In</SelectItem>
                <SelectItem value="color-transition">Color Transition</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="along-path">Along Path</SelectItem>
                <SelectItem value="reverse">Reverse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div>
            <ColorPickerInput
              label="Start Color"
              value={startColor}
              onChange={setStartColor}
              showPresets={true}
              showHexInput={true}
            />
          </div>

          <div>
            <Label className="text-xs mb-2 block">Start Opacity: {Math.round(startOpacity * 100)}%</Label>
            <Slider
              value={[startOpacity * 100]}
              onValueChange={(v) => setStartOpacity(v[0] / 100)}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          <Separator />

          <div>
            <ColorPickerInput
              label="End Color"
              value={endColor}
              onChange={setEndColor}
              showPresets={true}
              showHexInput={true}
            />
          </div>

          <div>
            <Label className="text-xs mb-2 block">End Opacity: {Math.round(endOpacity * 100)}%</Label>
            <Slider
              value={[endOpacity * 100]}
              onValueChange={(v) => setEndOpacity(v[0] / 100)}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          <Separator />

          <div>
            <Label className="text-xs mb-2 block">
              Transition Range: {gradientStart}% → {gradientEnd}%
            </Label>
            <SliderPrimitive.Root
              value={[gradientStart, gradientEnd]}
              onValueChange={([s, e]) => { setGradientStart(s); setGradientEnd(e); }}
              min={0}
              max={100}
              step={1}
              className="relative flex w-full touch-none select-none items-center h-5"
            >
              <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
                <SliderPrimitive.Range className="absolute h-full bg-primary" />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
              <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
            </SliderPrimitive.Root>
            <p className="text-[10px] text-muted-foreground mt-1">
              Region between handles is where the gradient transitions
            </p>
          </div>

          <Separator />

          {/* Preview */}
          <div>
            <Label className="text-xs mb-2 block">Preview</Label>
            <div
              className="h-8 rounded border"
              style={{ background: previewGradient }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleApplyGradient} size="sm" className="flex-1">
              Apply Gradient
            </Button>
            <Button onClick={handleClearGradient} variant="outline" size="sm" className="flex-1">
              Clear Gradient
            </Button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
