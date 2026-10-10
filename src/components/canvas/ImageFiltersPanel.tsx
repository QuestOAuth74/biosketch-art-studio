import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useCanvas } from "@/contexts/CanvasContext";
import { useState, useEffect, useCallback } from "react";
import { ImageFilterConfig, DEFAULT_IMAGE_FILTER_CONFIG, IMAGE_FILTER_PRESETS } from "@/types/effects";
import { Separator } from "@/components/ui/separator";
import { useDebouncedCallback } from 'use-debounce';

export const ImageFiltersPanel = () => {
  const { selectedObject, applyImageFilters, getImageFilters, clearImageFilters } = useCanvas();

  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [grayscale, setGrayscale] = useState(false);
  const [sepia, setSepia] = useState(false);

  // Load filters when selection changes
  useEffect(() => {
    if (selectedObject) {
      const filters = getImageFilters();
      if (filters) {
        setBrightness(filters.brightness);
        setContrast(filters.contrast);
        setSaturation(filters.saturation);
        setGrayscale(filters.grayscale);
        setSepia(filters.sepia);
      } else {
        // Reset to defaults if no filters
        setBrightness(0);
        setContrast(0);
        setSaturation(0);
        setGrayscale(false);
        setSepia(false);
      }
    }
  }, [selectedObject, getImageFilters]);

  // Debounced apply function for real-time updates
  const debouncedApply = useDebouncedCallback((config: ImageFilterConfig) => {
    applyImageFilters(config);
  }, 300);

  // Apply filters when any value changes
  const applyCurrentFilters = useCallback((overrides: Partial<ImageFilterConfig> = {}) => {
    const config: ImageFilterConfig = {
      brightness,
      contrast,
      saturation,
      grayscale,
      sepia,
      ...overrides,
    };
    debouncedApply(config);
  }, [brightness, contrast, saturation, grayscale, sepia, debouncedApply]);

  const handleBrightnessChange = (value: number) => {
    setBrightness(value);
    applyCurrentFilters({ brightness: value });
  };

  const handleContrastChange = (value: number) => {
    setContrast(value);
    applyCurrentFilters({ contrast: value });
  };

  const handleSaturationChange = (value: number) => {
    setSaturation(value);
    applyCurrentFilters({ saturation: value });
  };

  const handleGrayscaleChange = (checked: boolean) => {
    setGrayscale(checked);
    // If enabling grayscale, disable sepia
    const newSepia = checked ? false : sepia;
    setSepia(newSepia);
    applyCurrentFilters({ grayscale: checked, sepia: newSepia });
  };

  const handleSepiaChange = (checked: boolean) => {
    setSepia(checked);
    // If enabling sepia, disable grayscale
    const newGrayscale = checked ? false : grayscale;
    setGrayscale(newGrayscale);
    applyCurrentFilters({ sepia: checked, grayscale: newGrayscale });
  };

  const handlePresetApply = (preset: typeof IMAGE_FILTER_PRESETS[0]) => {
    setBrightness(preset.brightness);
    setContrast(preset.contrast);
    setSaturation(preset.saturation);
    setGrayscale(preset.grayscale);
    setSepia(preset.sepia);

    applyImageFilters({
      brightness: preset.brightness,
      contrast: preset.contrast,
      saturation: preset.saturation,
      grayscale: preset.grayscale,
      sepia: preset.sepia,
    });
  };

  const handleReset = () => {
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setGrayscale(false);
    setSepia(false);
    clearImageFilters();
  };

  const isDisabled = !selectedObject;

  return (
    <div className="space-y-3">
      {/* Brightness */}
      <div className="space-y-1.5">
        <Label className="text-xs">Brightness</Label>
        <div className="flex gap-2 items-center">
          <Slider
            value={[brightness]}
            min={-100}
            max={100}
            step={1}
            onValueChange={([v]) => handleBrightnessChange(v)}
            disabled={isDisabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={brightness}
            onChange={(e) => handleBrightnessChange(Number(e.target.value))}
            className="h-7 w-16 text-xs"
            disabled={isDisabled}
            min={-100}
            max={100}
          />
        </div>
      </div>

      {/* Contrast */}
      <div className="space-y-1.5">
        <Label className="text-xs">Contrast</Label>
        <div className="flex gap-2 items-center">
          <Slider
            value={[contrast]}
            min={-100}
            max={100}
            step={1}
            onValueChange={([v]) => handleContrastChange(v)}
            disabled={isDisabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={contrast}
            onChange={(e) => handleContrastChange(Number(e.target.value))}
            className="h-7 w-16 text-xs"
            disabled={isDisabled}
            min={-100}
            max={100}
          />
        </div>
      </div>

      {/* Saturation */}
      <div className="space-y-1.5">
        <Label className="text-xs">Saturation</Label>
        <div className="flex gap-2 items-center">
          <Slider
            value={[saturation]}
            min={-100}
            max={100}
            step={1}
            onValueChange={([v]) => handleSaturationChange(v)}
            disabled={isDisabled}
            className="flex-1"
          />
          <Input
            type="number"
            value={saturation}
            onChange={(e) => handleSaturationChange(Number(e.target.value))}
            className="h-7 w-16 text-xs"
            disabled={isDisabled}
            min={-100}
            max={100}
          />
        </div>
      </div>

      <Separator />

      {/* Grayscale & Sepia Toggles */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="grayscale"
            checked={grayscale}
            onCheckedChange={handleGrayscaleChange}
            disabled={isDisabled}
          />
          <Label htmlFor="grayscale" className="text-xs cursor-pointer">Grayscale</Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="sepia"
            checked={sepia}
            onCheckedChange={handleSepiaChange}
            disabled={isDisabled}
          />
          <Label htmlFor="sepia" className="text-xs cursor-pointer">Sepia</Label>
        </div>
      </div>

      <Separator />

      {/* Filter Presets */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Filter Presets</Label>
        <div className="grid grid-cols-2 gap-2">
          {IMAGE_FILTER_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              onClick={() => handlePresetApply(preset)}
              disabled={isDisabled}
              className="h-auto flex-col items-center p-2 hover:border-primary text-xs"
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Reset Button */}
      <Button
        onClick={handleReset}
        variant="outline"
        className="w-full h-8 text-xs"
        disabled={isDisabled}
      >
        Reset Filters
      </Button>
    </div>
  );
};
