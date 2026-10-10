import { useState, useRef, useCallback, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Palette, Beaker, BookOpen, Eye, Sparkles, Pipette } from "lucide-react";
import { toast } from "sonner";
import {
  allScientificPalettes,
  hexToHsl,
  hslToHex,
  getComplementary,
  getTriadic,
  getAnalogous,
  getSplitComplementary,
  ColorPalette
} from "@/lib/colorPalettes";

interface AdvancedColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  recentColors?: string[];
  showOpacity?: boolean;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
}

export const AdvancedColorPicker = ({
  value,
  onChange,
  recentColors = [],
  showOpacity = false,
  opacity = 100,
  onOpacityChange
}: AdvancedColorPickerProps) => {
  const [hsl, setHsl] = useState(() => hexToHsl(value));
  const [inputMode, setInputMode] = useState<"hex" | "rgb" | "hsl">("hex");
  const [hexInput, setHexInput] = useState(value);
  const satBrightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [isDraggingSatBright, setIsDraggingSatBright] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const [isEyedropperSupported] = useState(() => 'EyeDropper' in window);

  // Eyedropper handler
  const handleEyedropper = async () => {
    if (!('EyeDropper' in window)) {
      toast.error("Eyedropper not supported in this browser");
      return;
    }
    
    try {
      // @ts-ignore - EyeDropper API types
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      const sampledColor = result.sRGBHex;
      onChange(sampledColor);
      setHexInput(sampledColor);
      setHsl(hexToHsl(sampledColor));
      toast.success(`Sampled: ${sampledColor}`);
    } catch (e) {
      // User cancelled or error
    }
  };
  useEffect(() => {
    const newHsl = hexToHsl(value);
    setHsl(newHsl);
    setHexInput(value);
  }, [value]);

  const updateColor = useCallback((h: number, s: number, l: number) => {
    setHsl({ h, s, l });
    const hex = hslToHex(h, s, l);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleSatBrightMouseDown = (e: React.MouseEvent) => {
    setIsDraggingSatBright(true);
    handleSatBrightMove(e);
  };

  const handleSatBrightMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!satBrightRef.current) return;
    const rect = satBrightRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    // x = saturation (0-100), y = lightness (100-0, inverted)
    const s = x * 100;
    const l = (1 - y) * 50 + (1 - x) * (1 - y) * 50; // Approximate HSL lightness
    updateColor(hsl.h, s, Math.max(0, Math.min(100, l)));
  }, [hsl.h, updateColor]);

  const handleHueMouseDown = (e: React.MouseEvent) => {
    setIsDraggingHue(true);
    handleHueMove(e);
  };

  const handleHueMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    updateColor(x * 360, hsl.s, hsl.l);
  }, [hsl.s, hsl.l, updateColor]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSatBright) handleSatBrightMove(e);
      if (isDraggingHue) handleHueMove(e);
    };
    const handleMouseUp = () => {
      setIsDraggingSatBright(false);
      setIsDraggingHue(false);
    };

    if (isDraggingSatBright || isDraggingHue) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSatBright, isDraggingHue, handleSatBrightMove, handleHueMove]);

  const handleHexInputChange = (hex: string) => {
    setHexInput(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      const newHsl = hexToHsl(hex);
      setHsl(newHsl);
      onChange(hex);
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const rgb = hexToRgb(value);

  const renderPaletteSection = (title: string, icon: React.ReactNode, palettes: ColorPalette[]) => (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 px-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded transition-colors">
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-1">
        {palettes.map((palette) => (
          <div key={palette.name} className="space-y-1">
            <p className="text-[10px] text-muted-foreground px-1">{palette.name}</p>
            <div className="flex flex-wrap gap-1">
              {palette.colors.map((color, idx) => (
                <button
                  key={`${palette.name}-${idx}`}
                  onClick={() => onChange(color)}
                  className="w-5 h-5 rounded-sm border border-border/50 hover:scale-110 transition-transform shadow-sm"
                  style={{ backgroundColor: color }}
                  title={`${color} - ${palette.description}`}
                />
              ))}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );

  const complementary = getComplementary(value);
  const triadic = getTriadic(value);
  const analogous = getAnalogous(value);
  const splitComp = getSplitComplementary(value);

  return (
    <div className="space-y-3">
      {/* Saturation-Brightness Area */}
      <div
        ref={satBrightRef}
        className="relative w-full h-32 rounded-lg cursor-crosshair overflow-hidden border border-border/50"
        style={{
          background: `
            linear-gradient(to bottom, transparent, black),
            linear-gradient(to right, white, hsl(${hsl.h}, 100%, 50%))
          `
        }}
        onMouseDown={handleSatBrightMouseDown}
      >
        <div
          className="absolute w-4 h-4 border-2 border-white rounded-full shadow-md pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${hsl.s}%`,
            top: `${100 - hsl.l}%`,
            backgroundColor: value
          }}
        />
      </div>

      {/* Hue Slider */}
      <div
        ref={hueRef}
        className="relative w-full h-4 rounded-full cursor-pointer overflow-hidden"
        style={{
          background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
        }}
        onMouseDown={handleHueMouseDown}
      >
        <div
          className="absolute w-4 h-4 border-2 border-white rounded-full shadow-md pointer-events-none transform -translate-x-1/2"
          style={{
            left: `${(hsl.h / 360) * 100}%`,
            top: 0,
            backgroundColor: `hsl(${hsl.h}, 100%, 50%)`
          }}
        />
      </div>

      {/* Opacity Slider */}
      {showOpacity && onOpacityChange && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground">Opacity</Label>
            <span className="text-[10px] text-muted-foreground">{opacity}%</span>
          </div>
          <div
            className="relative w-full h-3 rounded-full cursor-pointer overflow-hidden"
            style={{
              background: `linear-gradient(to right, transparent, ${value}), 
                repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 8px 8px`
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onOpacityChange(Math.round(x * 100));
            }}
          >
            <div
              className="absolute w-3 h-3 border-2 border-white rounded-full shadow-md pointer-events-none transform -translate-x-1/2"
              style={{ left: `${opacity}%`, top: 0 }}
            />
          </div>
        </div>
      )}

      {/* Color Preview & Input */}
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-lg border border-border shadow-inner"
          style={{ backgroundColor: value }}
        />
        
        {/* Eyedropper Button */}
        {isEyedropperSupported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleEyedropper}
              >
                <Pipette className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="text-xs">Pick color from screen</span>
            </TooltipContent>
          </Tooltip>
        )}
        
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as typeof inputMode)} className="flex-1">
          <TabsList className="h-6 p-0.5 w-full">
            <TabsTrigger value="hex" className="text-[10px] h-5 flex-1">HEX</TabsTrigger>
            <TabsTrigger value="rgb" className="text-[10px] h-5 flex-1">RGB</TabsTrigger>
            <TabsTrigger value="hsl" className="text-[10px] h-5 flex-1">HSL</TabsTrigger>
          </TabsList>
          <TabsContent value="hex" className="mt-1.5">
            <Input
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              className="h-7 text-xs font-mono"
              placeholder="#000000"
            />
          </TabsContent>
          <TabsContent value="rgb" className="mt-1.5">
            <div className="flex gap-1">
              <Input
                type="number"
                min={0}
                max={255}
                value={rgb.r}
                onChange={(e) => onChange(rgbToHex(Number(e.target.value), rgb.g, rgb.b))}
                className="h-7 text-xs w-14 px-1.5"
                placeholder="R"
              />
              <Input
                type="number"
                min={0}
                max={255}
                value={rgb.g}
                onChange={(e) => onChange(rgbToHex(rgb.r, Number(e.target.value), rgb.b))}
                className="h-7 text-xs w-14 px-1.5"
                placeholder="G"
              />
              <Input
                type="number"
                min={0}
                max={255}
                value={rgb.b}
                onChange={(e) => onChange(rgbToHex(rgb.r, rgb.g, Number(e.target.value)))}
                className="h-7 text-xs w-14 px-1.5"
                placeholder="B"
              />
            </div>
          </TabsContent>
          <TabsContent value="hsl" className="mt-1.5">
            <div className="flex gap-1">
              <Input
                type="number"
                min={0}
                max={360}
                value={Math.round(hsl.h)}
                onChange={(e) => updateColor(Number(e.target.value), hsl.s, hsl.l)}
                className="h-7 text-xs w-14 px-1.5"
                placeholder="H"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={Math.round(hsl.s)}
                onChange={(e) => updateColor(hsl.h, Number(e.target.value), hsl.l)}
                className="h-7 text-xs w-14 px-1.5"
                placeholder="S"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={Math.round(hsl.l)}
                onChange={(e) => updateColor(hsl.h, hsl.s, Number(e.target.value))}
                className="h-7 text-xs w-14 px-1.5"
                placeholder="L"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Color Harmonies */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 px-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded transition-colors">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Color Harmonies
          </span>
          <ChevronDown className="h-3 w-3" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-1 px-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Complementary</p>
              <div className="flex gap-1">
                <button
                  onClick={() => onChange(value)}
                  className="w-6 h-6 rounded border border-border/50 hover:scale-110 transition-transform"
                  style={{ backgroundColor: value }}
                />
                <button
                  onClick={() => onChange(complementary)}
                  className="w-6 h-6 rounded border border-border/50 hover:scale-110 transition-transform"
                  style={{ backgroundColor: complementary }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Triadic</p>
              <div className="flex gap-1">
                {triadic.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => onChange(c)}
                    className="w-6 h-6 rounded border border-border/50 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Analogous</p>
              <div className="flex gap-1">
                {analogous.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => onChange(c)}
                    className="w-6 h-6 rounded border border-border/50 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Split Comp.</p>
              <div className="flex gap-1">
                {splitComp.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => onChange(c)}
                    className="w-6 h-6 rounded border border-border/50 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Scientific Palettes */}
      <ScrollArea className="h-48">
        <div className="space-y-1">
          {renderPaletteSection("Colorblind Safe", <Eye className="h-3 w-3" />, allScientificPalettes.colorblindSafe)}
          {renderPaletteSection("Cell Signaling", <Beaker className="h-3 w-3" />, allScientificPalettes.cellSignaling)}
          {renderPaletteSection("Publication", <BookOpen className="h-3 w-3" />, allScientificPalettes.publication)}
          {renderPaletteSection("Sequential", <Palette className="h-3 w-3" />, allScientificPalettes.sequential)}
        </div>
      </ScrollArea>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Recent</Label>
          <div className="flex gap-1 flex-wrap">
            {recentColors.slice(0, 12).map((color, idx) => (
              <button
                key={`${color}-${idx}`}
                onClick={() => onChange(color)}
                className="w-5 h-5 rounded-sm border border-border/50 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
