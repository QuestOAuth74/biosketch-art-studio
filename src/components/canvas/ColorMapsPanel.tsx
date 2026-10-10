import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { useCanvas } from "@/contexts/CanvasContext";
import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { SCIENTIFIC_COLOR_MAPS, getColorMapsByCategory, ColorMapDefinition } from "@/lib/scientificColorMaps";
import { ColorMapPreview } from "./ColorMapPreview";
import { FabricImage } from "fabric";
import { useDebouncedCallback } from "use-debounce";

export const ColorMapsPanel = () => {
  const { selectedObject, canvas, saveState } = useCanvas();
  const [selectedColorMap, setSelectedColorMap] = useState<string>('none');
  const [intensity, setIntensity] = useState(100);

  // Load current color map when selection changes
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'image' || selectedObject instanceof FabricImage)) {
      const imageObj = selectedObject as any;
      const colorMapConfig = imageObj.colorMapConfig;

      if (colorMapConfig) {
        setSelectedColorMap(colorMapConfig.mapName);
        setIntensity(colorMapConfig.intensity * 100);
      } else {
        setSelectedColorMap('none');
        setIntensity(100);
      }
    }
  }, [selectedObject]);

  const handleColorMapChange = (value: string) => {
    setSelectedColorMap(value);

    if (!canvas || !selectedObject || (selectedObject.type !== 'image' && !(selectedObject instanceof FabricImage))) {
      return;
    }

    const imageObj = selectedObject as any;

    if (value === 'none') {
      // Remove color map - restore original image
      if (imageObj.originalImageSrc) {
        const originalImg = new Image();
        originalImg.crossOrigin = 'anonymous';
        originalImg.onload = () => {
          imageObj.setElement(originalImg);
          imageObj.dirty = true;
          if (imageObj.clipPath) imageObj.clipPath.dirty = true;
          if (imageObj.group) (imageObj.group as any).dirty = true;
          imageObj.setCoords();
          canvas.requestRenderAll();
          canvas.fire('object:modified', { target: imageObj });
          saveState();
        };
        originalImg.src = imageObj.originalImageSrc;
        delete imageObj.colorMapConfig;
        delete imageObj.originalImageSrc;
      } else {
        // No original stored, just remove filters
        if (imageObj.filters) {
          imageObj.filters = imageObj.filters.filter((f: any) => f.type !== 'GradientMap');
          imageObj.applyFilters();
        }
        delete imageObj.colorMapConfig;
        canvas.requestRenderAll();
        canvas.fire('object:modified', { target: imageObj });
        saveState();
      }
      return;
    }

    // Apply color map
    const colorMap = SCIENTIFIC_COLOR_MAPS[value];
    if (!colorMap) return;
    // Bypass Fabric.js filter system - apply color map directly using canvas
    const applyColorMapDirectly = async () => {
      try {
        // Store original image source if not already stored
        if (!imageObj.originalImageSrc) {
          const currentElement = imageObj.getElement();
          imageObj.originalImageSrc = currentElement.src;
        }

        // Always process from the original image, not the current modified one
        const originalImg = new Image();
        originalImg.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          originalImg.onload = () => resolve();
          originalImg.onerror = () => reject(new Error('Failed to load original image'));
          originalImg.src = imageObj.originalImageSrc;
        });
        // Create an offscreen canvas to process the image
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = originalImg.width;
        offscreenCanvas.height = originalImg.height;
        const ctx = offscreenCanvas.getContext('2d');

        if (!ctx) return;

        // Draw the original image
        ctx.drawImage(originalImg, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        const data = imageData.data;

        // Build color lookup table
        const lut = new Array(256);
        for (let i = 0; i < 256; i++) {
          const normalizedValue = i / 255;
          const hexColor = interpolateColorMap(colorMap, normalizedValue);
          const r = parseInt(hexColor.slice(1, 3), 16);
          const g = parseInt(hexColor.slice(3, 5), 16);
          const b = parseInt(hexColor.slice(5, 7), 16);
          lut[i] = { r, g, b };
        }

        // Apply color map
        const intensityValue = intensity / 100;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          const mappedColor = lut[gray];

          if (intensityValue < 1.0) {
            data[i] = Math.round(r * (1 - intensityValue) + mappedColor.r * intensityValue);
            data[i + 1] = Math.round(g * (1 - intensityValue) + mappedColor.g * intensityValue);
            data[i + 2] = Math.round(b * (1 - intensityValue) + mappedColor.b * intensityValue);
          } else {
            data[i] = mappedColor.r;
            data[i + 1] = mappedColor.g;
            data[i + 2] = mappedColor.b;
          }
        }

        // Put the modified data back
        ctx.putImageData(imageData, 0, 0);

        // Convert canvas to image and update Fabric object
        const newDataURL = offscreenCanvas.toDataURL();
        const newImg = new Image();
        newImg.crossOrigin = 'anonymous';

        newImg.onload = () => {
          // Store original properties before updating
          const props = {
            left: imageObj.left,
            top: imageObj.top,
            scaleX: imageObj.scaleX,
            scaleY: imageObj.scaleY,
            angle: imageObj.angle,
            flipX: imageObj.flipX,
            flipY: imageObj.flipY,
            opacity: imageObj.opacity,
            filters: imageObj.filters,
            clipPath: imageObj.clipPath,
            strokeWidth: imageObj.strokeWidth,
            stroke: imageObj.stroke
          };
          try {
            // Use setElement() instead of setSrc() - more reliable
            imageObj.setElement(newImg);

            // Restore all properties
            imageObj.set(props);

            // Explicitly invalidate cache (required when clipPath/crop is present)
            imageObj.dirty = true;
            if (imageObj.clipPath) imageObj.clipPath.dirty = true;
            if (imageObj.group) (imageObj.group as any).dirty = true;

            // Update coordinates
            imageObj.setCoords();
            // Render and save
            canvas.requestRenderAll();
            canvas.fire('object:modified', { target: imageObj });
            saveState();
          } catch (error) {
            console.error('[ColorMap] Error setting element:', error);
          }
        };

        newImg.onerror = (error) => {
          console.error('[ColorMap] Image failed to load:', error);
        };
        newImg.src = newDataURL;
      } catch (error) {
        console.error('[ColorMap] Error applying color map:', error);
        console.error('[ColorMap] Error stack:', error);
      }
    };

    // Helper function to interpolate colors (copied from scientificColorMaps.ts)
    const interpolateColorMap = (colorMap: any, value: number): string => {
      const colors = colorMap.colors;
      const clamped = Math.max(0, Math.min(1, value));
      if (clamped === 0) return colors[0];
      if (clamped === 1) return colors[colors.length - 1];
      const scaledValue = clamped * (colors.length - 1);
      const lowerIndex = Math.floor(scaledValue);
      const upperIndex = Math.ceil(scaledValue);
      const t = scaledValue - lowerIndex;
      return blendColors(colors[lowerIndex], colors[upperIndex], t);
    };

    const blendColors = (color1: string, color2: string, t: number): string => {
      const r1 = parseInt(color1.slice(1, 3), 16);
      const g1 = parseInt(color1.slice(3, 5), 16);
      const b1 = parseInt(color1.slice(5, 7), 16);
      const r2 = parseInt(color2.slice(1, 3), 16);
      const g2 = parseInt(color2.slice(3, 5), 16);
      const b2 = parseInt(color2.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    applyColorMapDirectly();

    // Store config
    imageObj.colorMapConfig = {
      mapName: value,
      intensity: intensity / 100
    };
  };

  // Debounced color map application - waits 500ms after intensity slider stops changing
  const debouncedApplyColorMap = useDebouncedCallback(
    (colorMapName: string) => {
      handleColorMapChange(colorMapName);
    },
    500
  );

  const handleIntensityChange = (value: number) => {
    // Update intensity state immediately for responsive UI
    setIntensity(value);

    if (!canvas || !selectedObject || selectedColorMap === 'none') return;

    // Apply the color map with debouncing - waits 500ms after slider stops
    debouncedApplyColorMap(selectedColorMap);
  };

  const isDisabled = !selectedObject;
  const sequentialMaps = getColorMapsByCategory('sequential');
  const divergingMaps = getColorMapsByCategory('diverging');
  const categoricalMaps = getColorMapsByCategory('categorical');

  return (
    <div className="space-y-3">
      {/* Color Map Selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Color Map</Label>
        <Select value={selectedColorMap} onValueChange={handleColorMapChange} disabled={isDisabled}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select color map" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <Separator className="my-1" />

            {/* Sequential Color Maps */}
            <SelectGroup>
              <SelectLabel>Sequential</SelectLabel>
              {sequentialMaps.map((map) => {
                const mapKey = Object.keys(SCIENTIFIC_COLOR_MAPS).find(
                  key => SCIENTIFIC_COLOR_MAPS[key] === map
                );
                if (!mapKey) return null;

                return (
                  <SelectItem key={mapKey} value={mapKey}>
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1">{map.name}</div>
                      <div className="w-20">
                        <ColorMapPreview colorMap={map} height={12} />
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>

            <Separator className="my-1" />

            {/* Diverging Color Maps */}
            <SelectGroup>
              <SelectLabel>Diverging</SelectLabel>
              {divergingMaps.map((map) => {
                const mapKey = Object.keys(SCIENTIFIC_COLOR_MAPS).find(
                  key => SCIENTIFIC_COLOR_MAPS[key] === map
                );
                if (!mapKey) return null;

                return (
                  <SelectItem key={mapKey} value={mapKey}>
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1">{map.name}</div>
                      <div className="w-20">
                        <ColorMapPreview colorMap={map} height={12} />
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>

            <Separator className="my-1" />

            {/* Categorical Color Maps */}
            <SelectGroup>
              <SelectLabel>Categorical</SelectLabel>
              {categoricalMaps.map((map) => {
                const mapKey = Object.keys(SCIENTIFIC_COLOR_MAPS).find(
                  key => SCIENTIFIC_COLOR_MAPS[key] === map
                );
                if (!mapKey) return null;

                return (
                  <SelectItem key={mapKey} value={mapKey}>
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1">{map.name}</div>
                      <div className="w-20">
                        <ColorMapPreview colorMap={map} height={12} />
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Show description when a color map is selected */}
        {selectedColorMap !== 'none' && SCIENTIFIC_COLOR_MAPS[selectedColorMap] && (
          <p className="text-xs text-muted-foreground mt-1">
            {SCIENTIFIC_COLOR_MAPS[selectedColorMap].description}
          </p>
        )}
      </div>

      {/* Intensity Slider */}
      {selectedColorMap !== 'none' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Intensity: {intensity}%</Label>
            <Slider
              value={[intensity]}
              onValueChange={([v]) => handleIntensityChange(v)}
              min={0}
              max={100}
              step={1}
              disabled={isDisabled}
              className="w-full"
            />
          </div>

          {/* Large Preview */}
          {SCIENTIFIC_COLOR_MAPS[selectedColorMap] && (
            <div className="space-y-1">
              <Label className="text-xs">Preview</Label>
              <ColorMapPreview
                colorMap={SCIENTIFIC_COLOR_MAPS[selectedColorMap]}
                height={30}
                className="border"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
