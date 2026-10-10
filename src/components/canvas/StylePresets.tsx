import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, MoreVertical, Trash2, RefreshCw } from "lucide-react";
import { useCanvas } from "@/contexts/CanvasContext";
import { toast } from "sonner";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import { Textbox, FabricObject, ActiveSelection, Image as FabricImage, Shadow } from "fabric";
import { getBaseFontName, getCanvasFontFamily } from "@/lib/fontLoader";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { useStylePresets } from "@/hooks/useStylePresets";
import { detectPresetType, extractStyleProperties } from "@/lib/stylePresetExtractor";
import { StylePreset } from "@/types/stylePresets";
import { applyImageFilters as applyImageFiltersUtil } from "@/lib/imageFilters";
import { SCIENTIFIC_COLOR_MAPS } from "@/lib/scientificColorMaps";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HardcodedStylePreset {
  name: string;
  icon?: React.ReactNode;
  properties: any;
}

const TEXT_PRESETS: HardcodedStylePreset[] = [
  {
    name: "Heading 1",
    properties: { fontFamily: "Inter", fontSize: 48, fontWeight: "bold", fill: "#000000" }
  },
  {
    name: "Heading 2",
    properties: { fontFamily: "Inter", fontSize: 36, fontWeight: "bold", fill: "#000000" }
  },
  {
    name: "Heading 3",
    properties: { fontFamily: "Inter", fontSize: 24, fontWeight: "600", fill: "#374151" }
  },
  {
    name: "Body",
    properties: { fontFamily: "Inter", fontSize: 16, fontWeight: "normal", fill: "#000000" }
  },
  {
    name: "Caption",
    properties: { fontFamily: "Inter", fontSize: 12, fontWeight: "normal", fill: "#6b7280" }
  },
];

const SHAPE_PRESETS: HardcodedStylePreset[] = [
  {
    name: "Primary",
    icon: <div className="w-5 h-5 rounded" style={{ backgroundColor: "#3b82f6" }} />,
    properties: { fill: "#3b82f6" }
  },
  {
    name: "Secondary",
    icon: <div className="w-5 h-5 rounded" style={{ backgroundColor: "#ffffff", border: "2px solid #d1d5db" }} />,
    properties: { fill: "#ffffff", stroke: "#d1d5db", strokeWidth: 2 }
  },
  {
    name: "Accent",
    icon: <div className="w-5 h-5 rounded" style={{ backgroundColor: "#0D9488" }} />,
    properties: { fill: "#0D9488" }
  },
  {
    name: "Outline",
    icon: <div className="w-5 h-5 rounded" style={{ border: "2px solid #000000" }} />,
    properties: { fill: "transparent", stroke: "#000000", strokeWidth: 2 }
  },
  {
    name: "Dashed",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" className="rounded">
        <rect x="1" y="1" width="18" height="18" fill="transparent" stroke="#000000" strokeWidth="2" strokeDasharray="4,2" />
      </svg>
    ),
    properties: { fill: "transparent", stroke: "#000000", strokeWidth: 2, strokeDashArray: [5, 5] }
  },
];

const LINE_PRESETS: HardcodedStylePreset[] = [
  {
    name: "Solid",
    icon: (
      <svg width="24" height="4" viewBox="0 0 24 4">
        <line x1="0" y1="2" x2="24" y2="2" stroke="#000000" strokeWidth="2" />
      </svg>
    ),
    properties: { stroke: "#000000", strokeWidth: 2 }
  },
  {
    name: "Dashed",
    icon: (
      <svg width="24" height="4" viewBox="0 0 24 4">
        <line x1="0" y1="2" x2="24" y2="2" stroke="#000000" strokeWidth="2" strokeDasharray="5,3" />
      </svg>
    ),
    properties: { stroke: "#000000", strokeWidth: 2, strokeDashArray: [10, 5] }
  },
  {
    name: "Dotted",
    icon: (
      <svg width="24" height="4" viewBox="0 0 24 4">
        <line x1="0" y1="2" x2="24" y2="2" stroke="#000000" strokeWidth="2" strokeDasharray="1,3" />
      </svg>
    ),
    properties: { stroke: "#000000", strokeWidth: 2, strokeDashArray: [2, 4] }
  },
  {
    name: "Thick",
    icon: (
      <svg width="24" height="6" viewBox="0 0 24 6">
        <line x1="0" y1="3" x2="24" y2="3" stroke="#000000" strokeWidth="4" />
      </svg>
    ),
    properties: { stroke: "#000000", strokeWidth: 4 }
  },
  {
    name: "Thin",
    icon: (
      <svg width="24" height="2" viewBox="0 0 24 2">
        <line x1="0" y1="1" x2="24" y2="1" stroke="#6b7280" strokeWidth="1" />
      </svg>
    ),
    properties: { stroke: "#6b7280", strokeWidth: 1 }
  },
];

const IMAGE_PRESETS: HardcodedStylePreset[] = [
  {
    name: "Vivid",
    icon: (
      <div className="w-5 h-5 bg-gradient-to-br from-orange-400 to-pink-500 rounded" />
    ),
    properties: {
      imageFilters: {
        brightness: 10,
        contrast: 20,
        saturation: 30
      }
    }
  },
  {
    name: "Faded",
    icon: (
      <div className="w-5 h-5 bg-gradient-to-br from-gray-300 to-gray-400 rounded" />
    ),
    properties: {
      imageFilters: {
        brightness: 5,
        contrast: -15,
        saturation: -20
      }
    }
  },
  {
    name: "High Contrast",
    icon: (
      <div className="w-5 h-5 bg-gradient-to-r from-black to-white rounded" />
    ),
    properties: {
      imageFilters: {
        contrast: 50
      }
    }
  },
  {
    name: "Vintage",
    icon: (
      <div className="w-5 h-5 bg-gradient-to-br from-amber-200 to-amber-600 rounded" />
    ),
    properties: {
      imageFilters: {
        brightness: -5,
        contrast: 10,
        saturation: -10,
        sepia: true
      }
    }
  },
  {
    name: "B&W",
    icon: (
      <div className="w-5 h-5 bg-gradient-to-r from-gray-800 to-gray-200 rounded" />
    ),
    properties: {
      imageFilters: {
        grayscale: true
      }
    }
  },
];

const TEXTBOX_PRESETS: HardcodedStylePreset[] = [
  {
    name: "Basic Box",
    properties: {
      textboxBorderColor: "#000000",
      textboxBorderWidth: 2,
      textboxBackgroundColor: "#ffffff",
      textboxPadding: 10,
      fontFamily: "Inter",
      fontSize: 16,
      fill: "#000000"  // Text color
    }
  },
  {
    name: "Rounded Box",
    properties: {
      textboxBorderColor: "#3b82f6",
      textboxBorderWidth: 2,
      textboxBackgroundColor: "#eff6ff",
      textboxPadding: 12,
      fontFamily: "Inter",
      fontSize: 14,
      fill: "#1e40af"  // Blue text color
    }
  },
  {
    name: "Callout Style",
    properties: {
      textboxBorderColor: "#f59e0b",
      textboxBorderWidth: 3,
      textboxBackgroundColor: "#fffbeb",
      textboxPadding: 15,
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: "600",
      fill: "#92400e"  // Brown text color
    }
  },
];

export const StylePresets = () => {
  const { canvas, selectedObject, applyGradient, applyShadow } = useCanvas();
  const { presets, loading, createPreset, deletePreset, updatePreset, markPresetUsed } = useStylePresets();
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-quick-styles'] ?? true);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<StylePreset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper to check if it's a shape-text group
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

  // ===== SPECIALIZED PROPERTY APPLICATION HELPERS =====

  /**
   * Apply color map directly using canvas (bypasses Fabric filter system)
   * Same approach as ColorMapsPanel
   */
  const applyColorMapDirectly = async (imageObj: FabricImage, mapName: string, intensity: number) => {
    if (mapName === 'none') {
      // Restore original image
      if ((imageObj as any).originalImageSrc) {
        const newImg = new Image();
        await new Promise<void>((resolve) => {
          newImg.onload = () => {
            imageObj.setElement(newImg);
            imageObj.dirty = true;
            if (imageObj.clipPath) (imageObj.clipPath as any).dirty = true;
            if (imageObj.group) (imageObj.group as any).dirty = true;
            if (canvas) canvas.requestRenderAll();
            resolve();
          };
          newImg.src = (imageObj as any).originalImageSrc;
        });
      }
      return;
    }

    const colorMap = SCIENTIFIC_COLOR_MAPS[mapName];
    if (!colorMap) {
      console.error('[StylePresets] Color map not found:', mapName);
      return;
    }

    // Store original image source
    if (!(imageObj as any).originalImageSrc) {
      const currentElement = imageObj.getElement();
      (imageObj as any).originalImageSrc = currentElement.src;
    }

    // Load original image
    const originalImg = new Image();
    await new Promise<void>((resolve, reject) => {
      originalImg.onload = () => resolve();
      originalImg.onerror = () => reject(new Error('Failed to load image'));
      originalImg.src = (imageObj as any).originalImageSrc;
    });

    // Create offscreen canvas
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = originalImg.width;
    offscreenCanvas.height = originalImg.height;
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return;

    // Draw original image
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
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const mappedColor = lut[gray];

      if (intensity < 1.0) {
        data[i] = Math.round(r * (1 - intensity) + mappedColor.r * intensity);
        data[i + 1] = Math.round(g * (1 - intensity) + mappedColor.g * intensity);
        data[i + 2] = Math.round(b * (1 - intensity) + mappedColor.b * intensity);
      } else {
        data[i] = mappedColor.r;
        data[i + 1] = mappedColor.g;
        data[i + 2] = mappedColor.b;
      }
    }

    // Put modified data back
    ctx.putImageData(imageData, 0, 0);

    // Convert to data URL and update image
    const newDataURL = offscreenCanvas.toDataURL();
    const newImg = new Image();

    await new Promise<void>((resolve) => {
      newImg.onload = () => {
        // Store properties
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

        // Replace element
        imageObj.setElement(newImg);
        imageObj.set(props);
        imageObj.setCoords();
        imageObj.dirty = true;
        if (imageObj.clipPath) (imageObj.clipPath as any).dirty = true;
        if (imageObj.group) (imageObj.group as any).dirty = true;

        if (canvas) canvas.requestRenderAll();
        resolve();
      };
      newImg.src = newDataURL;
    });
  };

  // Helper for color map interpolation
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

  /**
   * Apply TextBox-specific properties
   */
  const applyTextBoxPreset = (obj: any, props: any) => {
    const objects = obj.getObjects();

    // Get the frame (Rect) and inner textbox
    const frame = objects.find((o: any) => o.type === 'rect');
    const textbox = objects.find((o: any) => o.type === 'textbox');

    if (textbox) {
      // Apply text styling to inner textbox
      const textProps: any = {};
      if (props.fontFamily) textProps.fontFamily = getCanvasFontFamily(getBaseFontName(props.fontFamily));
      if (props.fontSize !== undefined) textProps.fontSize = props.fontSize;
      if (props.fontWeight !== undefined) textProps.fontWeight = props.fontWeight;
      if (props.fontStyle !== undefined) textProps.fontStyle = props.fontStyle;
      if (props.textAlign !== undefined) textProps.textAlign = props.textAlign;
      if (props.underline !== undefined) textProps.underline = props.underline;
      if (props.overline !== undefined) textProps.overline = props.overline;
      if (props.linethrough !== undefined) textProps.linethrough = props.linethrough;
      if (props.lineHeight !== undefined) textProps.lineHeight = props.lineHeight;
      if (props.charSpacing !== undefined) textProps.charSpacing = props.charSpacing;
      if (props.fill) textProps.fill = props.fill;

      textbox.set(textProps);
    }

    // Apply visual properties to frame (Rect)
    if (frame) {
      const frameProps: any = {};
      if (props.textboxBackgroundColor !== undefined) frameProps.fill = props.textboxBackgroundColor;
      if (props.textboxBorderColor !== undefined) frameProps.stroke = props.textboxBorderColor;
      if (props.textboxBorderWidth !== undefined) frameProps.strokeWidth = props.textboxBorderWidth;

      frame.set(frameProps);
    }

    // Apply textbox-specific properties to group data
    const textBoxData = (obj as any).textBoxData || {};
    if (props.textboxWidth !== undefined) textBoxData.width = props.textboxWidth;
    if (props.textboxHeight !== undefined) textBoxData.height = props.textboxHeight;
    if (props.textboxPadding !== undefined) textBoxData.padding = props.textboxPadding;
    if (props.textboxBackgroundColor !== undefined) textBoxData.backgroundColor = props.textboxBackgroundColor;
    if (props.textboxBorderColor !== undefined) textBoxData.borderColor = props.textboxBorderColor;
    if (props.textboxBorderWidth !== undefined) textBoxData.borderWidth = props.textboxBorderWidth;
    (obj as any).textBoxData = textBoxData;
  };

  /**
   * Apply image properties (filters, color maps, tones)
   */
  const applyImagePreset = async (obj: any, props: any) => {
    const imageObj = obj as FabricImage;
    // Apply image filters (or clear if not in preset)
    if (props.imageFilters !== undefined) {
      if (props.imageFilters === null) {
        // Clear all filters (except tone/color map)
        const existingFilters = imageObj.filters || [];
        const toneFilter = existingFilters.find((f: any) => f?.type === 'BlendColor');
        const colorMapFilter = existingFilters.find((f: any) => f?.type === 'GradientMap');

        imageObj.filters = [];
        if (toneFilter) imageObj.filters.push(toneFilter);
        if (colorMapFilter) imageObj.filters.push(colorMapFilter);
        imageObj.applyFilters();
      } else {
        // Apply filters configuration using existing utility
        const filterConfig = {
          brightness: props.imageFilters.brightness ?? 0,
          contrast: props.imageFilters.contrast ?? 0,
          saturation: props.imageFilters.saturation ?? 0,
          grayscale: props.imageFilters.grayscale ?? false,
          sepia: props.imageFilters.sepia ?? false
        };
        applyImageFiltersUtil(imageObj, filterConfig);
      }
    } else {
      // Preset doesn't specify filters - clear them (except tone/color map)
      const existingFilters = imageObj.filters || [];
      const toneFilter = existingFilters.find((f: any) => f?.type === 'BlendColor');
      const colorMapFilter = existingFilters.find((f: any) => f?.type === 'GradientMap');

      imageObj.filters = [];
      if (toneFilter) imageObj.filters.push(toneFilter);
      if (colorMapFilter) imageObj.filters.push(colorMapFilter);
      imageObj.applyFilters();
    }

    // Apply color map (or clear if not in preset)
    if (props.colorMap !== undefined) {
      if (props.colorMap === null) {
        // Remove color map - use direct canvas approach
        await applyColorMapDirectly(imageObj, 'none', 1.0);
        delete (imageObj as any).colorMapConfig;
      } else {
        // Look up the color map definition (try lowercase key)
        const mapKey = props.colorMap.mapName.toLowerCase();
        const colorMapDef = SCIENTIFIC_COLOR_MAPS[mapKey] || SCIENTIFIC_COLOR_MAPS[props.colorMap.mapName];
        if (colorMapDef) {
          // Use direct canvas approach (same as ColorMapsPanel)
          await applyColorMapDirectly(imageObj, mapKey, props.colorMap.intensity);
          (imageObj as any).colorMapConfig = props.colorMap;
        } else {
          console.error(`[StylePresets] Color map not found: ${props.colorMap.mapName}`);
          throw new Error(`Color map "${props.colorMap.mapName}" not found`);
        }
      }
    } else {
      // Preset doesn't specify color map - clear it
      await applyColorMapDirectly(imageObj, 'none', 1.0);
      delete (imageObj as any).colorMapConfig;
    }

    // Apply tone (or clear if not in preset)
    if (props.imageTone !== undefined) {
      if (props.imageTone === null) {
        // Remove tone filter
        imageObj.filters = imageObj.filters?.filter((f: any) => f?.type !== 'BlendColor') || [];
        imageObj.applyFilters();
      } else {
        // Apply tone by adding a BlendColor filter
        // First, remove existing tone filter
        imageObj.filters = imageObj.filters?.filter((f: any) => f?.type !== 'BlendColor') || [];

        // Create and add tone filter using Fabric's BlendColor filter
        const { filters } = await import('fabric');
        const toneFilter = new filters.BlendColor({
          color: props.imageTone.color,
          mode: 'tint',
          alpha: props.imageTone.opacity
        });

        imageObj.filters.push(toneFilter);
        imageObj.applyFilters();
      }
    } else {
      // Preset doesn't specify tone - clear it
      imageObj.filters = imageObj.filters?.filter((f: any) => f?.type !== 'BlendColor') || [];
      imageObj.applyFilters();
    }

    // Render the canvas after applying changes
    if (canvas) {
      canvas.requestRenderAll();
    }
  };

  /**
   * Apply icon tone properties
   * Uses the same logic as useIconToneManagement hook
   */
  const applyIconPreset = async (obj: any, props: any) => {
    if (props.iconTone !== undefined) {
      if (props.iconTone === null) {
        // Remove icon tone - same as handleRemoveIconTone in hook
        if ((obj as any).originalColors) {
          const originalColors = (obj as any).originalColors as Map<string, any>;
          const restoreColors = (o: any, path: string = '') => {
            if (o.type === 'group') {
              o.getObjects().forEach((child: any, idx: number) => restoreColors(child, `${path}/${idx}`));
            } else {
              const stored = originalColors.get(path);
              if (stored) {
                o.set({ fill: stored.fill, stroke: stored.stroke });
              }
            }
          };
          obj.getObjects().forEach((child: any, idx: number) => restoreColors(child, `/${idx}`));
          delete (obj as any).originalColors;
        }

        // Delete the properties set by the hook
        delete (obj as any).iconToneColor;
        delete (obj as any).iconToneIntensity;
        delete (obj as any).iconToneHue;
      } else {
        // Apply icon tone - same as handleIconToneChange in hook
        const color = props.iconTone.customColor || '#3b82f6';
        const intensity = props.iconTone.intensity !== undefined ? props.iconTone.intensity : 0.2;
        // Helper to convert hex to HSL (from the hook)
        const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
          const r = parseInt(hex.slice(1, 3), 16) / 255;
          const g = parseInt(hex.slice(3, 5), 16) / 255;
          const b = parseInt(hex.slice(5, 7), 16) / 255;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h = 0, s = 0, l = (max + min) / 2;

          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
              case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
              case g: h = ((b - r) / d + 2) / 6; break;
              case b: h = ((r - g) / d + 4) / 6; break;
            }
          }

          return { h: h * 360, s: s * 100, l: l * 100 };
        };

        const { h } = hexToHSL(color);

        // Store tone properties on the object (same as hook)
        (obj as any).iconToneColor = color;
        (obj as any).iconToneIntensity = intensity;
        (obj as any).iconToneHue = h;
        // Store original colors if not already stored
        if (!(obj as any).originalColors) {
          const originalColors = new Map();
          const storeColors = (o: any, path: string = '') => {
            if (o.type === 'group') {
              o.getObjects().forEach((child: any, idx: number) => storeColors(child, `${path}/${idx}`));
            } else {
              originalColors.set(path, { fill: o.fill, stroke: o.stroke });
            }
          };
          storeColors(obj);
          (obj as any).originalColors = originalColors;
        }

        const originalColors = (obj as any).originalColors as Map<string, { fill: any; stroke: any }>;

        // Blend color helper (same as hook)
        const blendColor = (originalColor: string, tintColor: string, intensity: number): string => {
          if (!originalColor || originalColor === 'transparent' || originalColor === 'none') {
            return originalColor;
          }
          if (originalColor.startsWith('#')) {
            const orig = parseInt(originalColor.slice(1), 16);
            const tint = parseInt(tintColor.slice(1), 16);
            const origR = (orig >> 16) & 0xff;
            const origG = (orig >> 8) & 0xff;
            const origB = orig & 0xff;
            const tintR = (tint >> 16) & 0xff;
            const tintG = (tint >> 8) & 0xff;
            const tintB = tint & 0xff;
            const newR = Math.round(origR * (1 - intensity) + tintR * intensity);
            const newG = Math.round(origG * (1 - intensity) + tintG * intensity);
            const newB = Math.round(origB * (1 - intensity) + tintB * intensity);
            return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
          }
          return originalColor;
        };

        // Apply tint to all objects using ORIGINAL colors (same as hook)
        const applyTintToObject = (o: any, path: string = '') => {
          if (o.type === 'group') {
            o.getObjects().forEach((child: any, idx: number) => applyTintToObject(child, `${path}/${idx}`));
          } else {
            const stored = originalColors.get(path);
            if (stored) {
              if (stored.fill && typeof stored.fill === 'string' && stored.fill !== 'transparent' && stored.fill !== 'none') {
                const blended = blendColor(stored.fill, color, intensity);
                o.set({ fill: blended });
              }
              if (stored.stroke && typeof stored.stroke === 'string' && stored.stroke !== 'transparent' && stored.stroke !== 'none') {
                const blended = blendColor(stored.stroke, color, intensity);
                o.set({ stroke: blended });
              }
            }
          }
        };

        obj.getObjects().forEach((child: any, idx: number) => applyTintToObject(child, `/${idx}`));
      }
    } else {
      // Preset doesn't specify tone - clear it (complete replacement behavior)
      if ((obj as any).originalColors) {
        const originalColors = (obj as any).originalColors as Map<string, any>;
        const restoreColors = (o: any, path: string = '') => {
          if (o.type === 'group') {
            o.getObjects().forEach((child: any, idx: number) => restoreColors(child, `${path}/${idx}`));
          } else {
            const stored = originalColors.get(path);
            if (stored) {
              o.set({ fill: stored.fill, stroke: stored.stroke });
            }
          }
        };
        obj.getObjects().forEach((child: any, idx: number) => restoreColors(child, `/${idx}`));
        delete (obj as any).originalColors;
      }

      delete (obj as any).iconToneColor;
      delete (obj as any).iconToneIntensity;
      delete (obj as any).iconToneHue;
    }
  };

  /**
   * Apply membrane properties
   */
  const applyMembranePreset = (obj: any, props: any) => {
    const membraneData = (obj as any).membraneData || {};

    if (props.membraneIconId !== undefined) membraneData.iconId = props.membraneIconId;
    if (props.membraneIconSize !== undefined) membraneData.iconSize = props.membraneIconSize;
    if (props.membraneSpacing !== undefined) membraneData.spacing = props.membraneSpacing;
    if (props.membraneOrientation !== undefined) membraneData.orientation = props.membraneOrientation;
    if (props.membraneRotateToPath !== undefined) membraneData.rotateToPath = props.membraneRotateToPath;
    if (props.membraneDoubleSided !== undefined) membraneData.doubleSided = props.membraneDoubleSided;

    (obj as any).membraneData = membraneData;
    // TODO: Trigger membrane regeneration with new settings
  };

  /**
   * Apply bracket properties
   */
  const applyBracketPreset = (obj: any, props: any) => {
    // Apply bracket-specific properties (stored directly on the group object)
    if (props.bracketSize !== undefined) {
      (obj as any).bracketSize = props.bracketSize;
    }
    if (props.bracketDepth !== undefined) {
      (obj as any).bracketGap = props.bracketDepth; // Map bracketDepth back to bracketGap
    }

    // Apply font properties to the text object inside the bracket
    if (obj.type === 'group') {
      const objects = obj.getObjects();
      const textObj = objects.find((o: any) => o.type === 'text' || o.type === 'textbox');
      if (textObj) {
        const textProps: any = {};
        if (props.fontFamily) textProps.fontFamily = getCanvasFontFamily(getBaseFontName(props.fontFamily));
        if (props.fontSize !== undefined) textProps.fontSize = props.fontSize;
        if (props.fontWeight !== undefined) textProps.fontWeight = props.fontWeight;
        if (props.fontStyle !== undefined) textProps.fontStyle = props.fontStyle;
        if (props.fill) textProps.fill = props.fill;
        textObj.set(textProps);
      }
    }

    // Trigger bracket regeneration by firing the 'modified' event
    // The attachBracketTransformSync listener will regenerate the bracket path
    obj.fire('modified');

    // Also update canvas
    if (canvas) {
      obj.setCoords();
      canvas.requestRenderAll();
    }
  };

  /**
   * Apply leader line properties
   */
  const applyLeaderLinePreset = (obj: any, props: any) => {
    // Apply arrow visibility (arrow is second element in group)
    if (obj.type === 'group' && props.showArrow !== undefined) {
      const objects = obj.getObjects();
      const arrow = objects[1];

      if (arrow) {
        arrow.set({ visible: props.showArrow });
      }
    }

    // Apply font properties to the label (fourth element in group)
    if (obj.type === 'group') {
      const objects = obj.getObjects();
      const label = objects[3];
      if (label) {
        const textProps: any = {};
        if (props.fontFamily) textProps.fontFamily = getCanvasFontFamily(getBaseFontName(props.fontFamily));
        if (props.fontSize !== undefined) textProps.fontSize = props.fontSize;
        if (props.fontWeight !== undefined) textProps.fontWeight = props.fontWeight;
        if (props.fontStyle !== undefined) textProps.fontStyle = props.fontStyle;
        if (props.fill) textProps.fill = props.fill;
        label.set(textProps);
      }
    }

    // Update the leader line
    if (canvas) {
      obj.dirty = true;
      obj.setCoords();
      canvas.requestRenderAll();
    }
  };

  /**
   * Apply callout properties
   * NOTE: Shadow is handled by universal shadow application to the group
   */
  const applyCalloutPreset = (obj: any, props: any) => {
    // Callout structure: [Circle, NumberText]
    if (obj.type === 'group') {
      const objects = obj.getObjects();
      const circle = objects[0]; // Circle
      const numberText = objects[1]; // Number text

      // Apply circle properties (fill, stroke)
      if (circle) {
        const circleProps: any = {};
        if (props.fill !== undefined) circleProps.fill = props.fill; // Circle fill color
        if (props.stroke !== undefined) circleProps.stroke = props.stroke; // Circle border color
        if (props.strokeWidth !== undefined) circleProps.strokeWidth = props.strokeWidth;
        circle.set(circleProps);
      }

      // Apply font properties to number text
      if (numberText) {
        const textProps: any = {};
        if (props.fontFamily) textProps.fontFamily = getCanvasFontFamily(getBaseFontName(props.fontFamily));
        if (props.fontSize !== undefined) textProps.fontSize = props.fontSize;
        if (props.fontWeight !== undefined) textProps.fontWeight = props.fontWeight;
        if (props.fontStyle !== undefined) textProps.fontStyle = props.fontStyle;
        // Apply text color separately from circle fill
        if (props.textFill !== undefined) textProps.fill = props.textFill;
        numberText.set(textProps);
      }
    }

    // Update the callout
    if (canvas) {
      obj.dirty = true;
      obj.setCoords();
      canvas.requestRenderAll();
    }
  };

  /**
   * Apply advanced line properties
   */
  const applyLineAdvancedPreset = (obj: any, props: any) => {
    if (props.smoothingStrength !== undefined) {
      (obj as any).smoothingStrength = props.smoothingStrength;
      // TODO: Trigger line regeneration with new smoothing
    }

    if (props.lineGradient !== undefined) {
      (obj as any).lineGradient = props.lineGradient;
      // TODO: Apply line gradient
    }

    if (props.lineIntersection !== undefined) {
      (obj as any).lineIntersection = props.lineIntersection;
      // TODO: Apply line intersection style
    }
  };

  // Apply preset to a single object
  const applyPresetToObject = async (obj: FabricObject, preset: StylePreset | HardcodedStylePreset) => {
    const props = preset.properties;
    // Handle shape-text groups
    const targetObj = isShapeWithTextGroup(obj)
      ? (obj as any).getObjects()[0]
      : obj;
    // Detect object type early for conditional property application
    const objType = detectPresetType(obj);
    const isTextBoxType = objType === 'textbox';

    // Apply basic properties (explicitly clear absent properties)
    const basicProps: any = {};

    // Helper to check if property has a value (not undefined and not null)
    const hasValue = (val: any) => val !== undefined && val !== null && val !== '';

    // Colors and fill - if not in preset or explicitly undefined/null, clear them
    // Skip for textbox types - applyTextBoxPreset will handle fill (text color) correctly
    if (!isTextBoxType) {
      if (hasValue(props.fill)) {
        basicProps.fill = props.fill;
      } else if (!props.gradient) {
        // Only clear fill if there's also no gradient
        basicProps.fill = '';
      }
    }

    // Stroke properties - clear if not in preset or explicitly null/undefined
    // Skip for textbox types - textboxBorderColor handles border color
    if (!isTextBoxType) {
      if (hasValue(props.stroke)) {
        basicProps.stroke = props.stroke;
      } else {
        basicProps.stroke = '';
      }
    }

    if (props.strokeWidth !== undefined && props.strokeWidth !== null) {
      basicProps.strokeWidth = props.strokeWidth;
    } else {
      basicProps.strokeWidth = 0;
    }

    if (hasValue(props.strokeDashArray)) {
      basicProps.strokeDashArray = props.strokeDashArray;
    } else {
      basicProps.strokeDashArray = null;
    }

    // Opacity - keep if not specified (optional property)
    if (props.opacity !== undefined && props.opacity !== null) {
      basicProps.opacity = props.opacity;
    }

    // Text properties - clear if not in preset and object is text
    if (targetObj.type === 'textbox') {
      if (hasValue(props.fontFamily)) {
        const canvasFont = getCanvasFontFamily(getBaseFontName(props.fontFamily));
        basicProps.fontFamily = canvasFont;
      }
      if (hasValue(props.fontSize)) basicProps.fontSize = props.fontSize;
      if (hasValue(props.fontWeight)) basicProps.fontWeight = props.fontWeight;
      if (hasValue(props.fontStyle)) basicProps.fontStyle = props.fontStyle;
      if (hasValue(props.textAlign)) basicProps.textAlign = props.textAlign;

      // Text decorations - clear if not in preset
      basicProps.underline = props.underline === true;
      basicProps.overline = props.overline === true;
      basicProps.linethrough = props.linethrough === true;
    }

    // Line properties - clear if not in preset and object is line
    const isLineObject = targetObj.type === 'path' || targetObj.type === 'line' ||
                        (targetObj as any).isFreeformLine || (targetObj as any).isConnector;
    if (isLineObject) {
      (targetObj as any).startMarker = hasValue(props.startMarker) ? props.startMarker : undefined;
      (targetObj as any).endMarker = hasValue(props.endMarker) ? props.endMarker : undefined;
      (targetObj as any).lineStyle = hasValue(props.lineStyle) ? props.lineStyle : 'solid';
    }

    targetObj.set(basicProps);

    // Apply gradient if present, otherwise ensure it's cleared
    if (props.gradient && canvas) {
      applyGradient(props.gradient, props.gradientTarget || 'fill');
    } else if (hasValue(props.fill) && typeof props.fill === 'string') {
      // If solid fill is specified, ensure gradient is cleared
      targetObj.set({ fill: props.fill });
    }

    // Apply or clear shadow
    // NOTE: Complete replacement behavior - if shadow not in preset, we clear it
    if (props.shadow !== undefined && props.shadow !== null) {
      // Create and apply shadow directly to targetObj
      if (props.shadow.enabled) {
        const shadow = new Shadow({
          color: props.shadow.color,
          blur: props.shadow.blur,
          offsetX: props.shadow.offsetX,
          offsetY: props.shadow.offsetY,
        });
        // Manually set opacity by manipulating the color with alpha
        const hexOpacity = Math.round(props.shadow.opacity * 255).toString(16).padStart(2, '0');
        shadow.color = props.shadow.color + hexOpacity;

        targetObj.set('shadow', shadow);
      } else {
        targetObj.set('shadow', null);
      }
    } else {
      // Preset doesn't specify shadow - clear existing shadow (complete replacement)
      targetObj.set({ shadow: null });
    }

    // ===== APPLY TYPE-SPECIFIC PROPERTIES =====

    // TextBox properties
    if (objType === 'textbox') {
      applyTextBoxPreset(obj, props);
    }

    // Image properties
    if (objType === 'image') {
      await applyImagePreset(obj, props);
    }

    // Icon properties
    if (objType === 'icon') {
      await applyIconPreset(obj, props);
    }

    // Membrane properties
    if (objType === 'membrane') {
      applyMembranePreset(obj, props);
    }

    // Bracket properties
    if (objType === 'bracket') {
      applyBracketPreset(obj, props);
    }

    // Leader line properties
    if (objType === 'leader-line') {
      applyLeaderLinePreset(obj, props);
    }

    // Callout properties
    if (objType === 'callout') {
      applyCalloutPreset(obj, props);
    }

    // Advanced line properties
    if (objType === 'line') {
      applyLineAdvancedPreset(obj, props);
    }
  };

  // Apply preset to selected object(s)
  const applyPreset = async (preset: StylePreset | HardcodedStylePreset) => {
    if (!canvas || !selectedObject) {
      toast.error("Please select an object first");
      return;
    }

    try {
      // Handle ActiveSelection (bulk apply)
      if (selectedObject.type === 'activeSelection') {
        const selection = selectedObject as ActiveSelection;
        const objects = selection.getObjects();

        // Apply to all objects sequentially
        for (const obj of objects) {
          await applyPresetToObject(obj, preset);
          obj.setCoords();
        }

        // Fire object:modified event to trigger UI sync
        canvas.fire('object:modified', { target: selectedObject });
        canvas.requestRenderAll();
        toast.success(`Applied "${preset.name}" to ${objects.length} objects`);
      } else {
        // Single object
        await applyPresetToObject(selectedObject, preset);

        // Fire object:modified event to trigger UI sync
        selectedObject.setCoords();
        canvas.fire('object:modified', { target: selectedObject });
        canvas.requestRenderAll();

        toast.success(`Applied "${preset.name}" style`);
      }

      // Mark preset as used (if it has an ID)
      if ('id' in preset && preset.id) {
        markPresetUsed(preset.id);
      }
    } catch (error) {
      console.error("Error applying preset:", error);
      toast.error("Failed to apply style");
    }
  };

  // Save current selection as preset
  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    if (!selectedObject) {
      toast.error('Please select an object first');
      return;
    }

    try {
      const type = detectPresetType(selectedObject);
      const properties = extractStyleProperties(selectedObject);
      const result = await createPreset({
        name: presetName,
        type,
        properties
      });

      if (result) {
        setShowSaveDialog(false);
        setPresetName('');
      }
    } catch (error) {
      console.error('[StylePresets] Error saving preset:', error);
      toast.error(`Failed to save preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Show delete confirmation dialog
  const handleDeleteClick = (preset: StylePreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetToDelete(preset);
    setShowDeleteDialog(true);
  };

  // Confirm and delete preset
  const handleConfirmDelete = async () => {
    if (!presetToDelete?.id) return;

    try {
      setIsDeleting(true);
      await deletePreset(presetToDelete.id);
      toast.success(`Preset "${presetToDelete.name}" deleted`);
    } catch (error) {
      console.error('[StylePresets] Error deleting preset:', error);
      toast.error('Failed to delete preset');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setPresetToDelete(null);
    }
  };

  // Update preset with current object styling
  const handleUpdatePreset = async (preset: StylePreset, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!selectedObject) {
      toast.error('Please select an object first');
      return;
    }

    if (!preset.id) {
      toast.error('Cannot update built-in preset');
      return;
    }

    try {
      // Extract current object properties
      const type = detectPresetType(selectedObject);
      const properties = extractStyleProperties(selectedObject);

      // Verify the types match
      if (type !== preset.type) {
        toast.error(`Type mismatch: preset is "${preset.type}" but selected object is "${type}"`);
        return;
      }
      // Update the preset
      await updatePreset(preset.id, { properties });

      toast.success(`Preset "${preset.name}" updated`);
    } catch (error) {
      console.error('[StylePresets] Error updating preset:', error);
      toast.error('Failed to update preset');
    }
  };

  // Generate preview icon for custom presets
  const generatePreviewIcon = (preset: StylePreset) => {
    const props = preset.properties;

    // Shape preview
    if (preset.type === 'shape') {
      const style: React.CSSProperties = {
        width: '20px',
        height: '20px',
        borderRadius: '2px',
        backgroundColor: typeof props.fill === 'string' ? props.fill : 'transparent',
        border: props.stroke ? `${Math.min(props.strokeWidth || 2, 2)}px ${props.strokeDashArray ? 'dashed' : 'solid'} ${props.stroke}` : 'none',
        opacity: props.opacity || 1,
      };
      return <div style={style} />;
    }

    // Line preview
    if (preset.type === 'line') {
      const strokeWidth = Math.min(props.strokeWidth || 2, 3);
      const dashArray = props.strokeDashArray ? `${props.strokeDashArray[0]},${props.strokeDashArray[1]}` : undefined;
      return (
        <svg width="24" height="4" viewBox="0 0 24 4">
          <line
            x1="0"
            y1="2"
            x2="24"
            y2="2"
            stroke={props.stroke || '#000000'}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            opacity={props.opacity || 1}
          />
        </svg>
      );
    }

    // TextBox preview - show miniature textbox with border
    if (preset.type === 'textbox') {
      const style: React.CSSProperties = {
        width: '20px',
        height: '20px',
        borderRadius: '2px',
        backgroundColor: props.textboxBackgroundColor || 'transparent',
        border: props.textboxBorderColor ? `${Math.min(props.textboxBorderWidth || 1, 2)}px solid ${props.textboxBorderColor}` : '1px solid #ccc',
        opacity: props.opacity || 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '8px',
        color: typeof props.fill === 'string' ? props.fill : '#000000'
      };
      return <div style={style}>T</div>;
    }

    // Image preview - show image icon with filter indicator
    if (preset.type === 'image') {
      const hasFilters = props.imageFilters && Object.keys(props.imageFilters).length > 0;
      const hasColorMap = !!props.colorMap;
      const hasTone = !!props.imageTone;

      return (
        <div className="w-5 h-5 bg-slate-200 rounded flex items-center justify-center relative">
          <span className="text-[10px]">🖼</span>
          {(hasFilters || hasColorMap || hasTone) && (
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 rounded-full border border-white" />
          )}
        </div>
      );
    }

    // Icon preview - show icon symbol with tone color
    if (preset.type === 'icon') {
      const toneColor = props.iconTone?.customColor || '#000000';
      return (
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ color: toneColor }}>
          ⭐
        </div>
      );
    }

    // Membrane preview
    if (preset.type === 'membrane') {
      return <div className="w-5 h-5 text-[10px]">⚬⚬⚬</div>;
    }

    // Bracket preview
    if (preset.type === 'bracket') {
      return <div className="w-5 h-5 text-[12px]">[ ]</div>;
    }

    // Leader line preview
    if (preset.type === 'leader-line') {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20">
          <line x1="2" y1="10" x2="14" y2="10" stroke="#000" strokeWidth="1" />
          {props.showArrow && <polygon points="14,10 12,9 12,11" fill="#000" />}
        </svg>
      );
    }

    // Callout preview
    if (preset.type === 'callout') {
      return <div className="w-5 h-5 text-[10px] border border-slate-400 rounded flex items-center justify-center">💬</div>;
    }

    // Text presets don't need an icon
    return null;
  };

  // Get text style for displaying preset names
  const getTextStyle = (preset: StylePreset | HardcodedStylePreset) => {
    // Apply text styling for text and textbox presets
    if (presetType !== 'text' && presetType !== 'textbox') {
      return {};
    }

    // For hardcoded presets
    if (!('id' in preset) || !preset.id) {
      switch (preset.name) {
        case "Heading 1":
          return { fontWeight: "bold", fontSize: "15px" };
        case "Heading 2":
          return { fontWeight: "bold", fontSize: "14px" };
        case "Heading 3":
          return { fontWeight: "600", fontSize: "13px", color: "#374151" };
        case "Body":
          return { fontWeight: "normal", fontSize: "12px" };
        case "Caption":
          return { fontWeight: "normal", fontSize: "11px", color: "#6b7280" };
        default:
          return {};
      }
    }

    // For custom text presets, apply their actual styling
    const props = preset.properties;
    const style: React.CSSProperties = {};

    if (props.fontSize) style.fontSize = `${Math.min(props.fontSize / 3, 15)}px`; // Scale down for preview
    if (props.fontWeight) style.fontWeight = props.fontWeight;
    if (props.fontStyle) style.fontStyle = props.fontStyle;
    if (typeof props.fill === 'string') style.color = props.fill;
    if (props.underline) style.textDecoration = 'underline';
    if (props.linethrough) style.textDecoration = (style.textDecoration || '') + ' line-through';

    return style;
  };

  const getPresetType = () => {
    if (!selectedObject) return null;
    return detectPresetType(selectedObject);
  };

  const presetType = getPresetType();

  // Get hardcoded presets for current type
  const hardcodedPresets =
    presetType === 'text' ? TEXT_PRESETS :
    presetType === 'line' ? LINE_PRESETS :
    presetType === 'shape' ? SHAPE_PRESETS :
    presetType === 'image' ? IMAGE_PRESETS :
    presetType === 'textbox' ? TEXTBOX_PRESETS :
    [];

  // Combine user presets with hardcoded presets
  const userPresetsForType = presets.filter(p => p.type === presetType);
  const allPresets = [...userPresetsForType, ...hardcodedPresets];

  // Show Quick Styles for all supported object types
  if (!selectedObject) {
    return null;
  }

  return (
    <div className="relative" data-testid={CanvasEditorTestIds.STYLE_PRESETS_SECTION}>
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-quick-styles')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Quick Styles
        </h3>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3">
          <div className="flex flex-col gap-1.5">
            {/* Add New Button - at the top */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              className="flex items-center gap-2 justify-start h-auto py-2 w-full border-dashed border-primary text-primary hover:border-solid hover:bg-primary/5"
              data-testid={CanvasEditorTestIds.STYLE_PRESETS_SAVE_BUTTON}
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs">Save current style</span>
            </Button>

            {/* Preset Buttons */}
            {allPresets.map((preset) => {
              const isUserPreset = 'id' in preset && preset.id;
              const presetKey = isUserPreset ? preset.id : `hardcoded-${preset.name}`;
              const presetIcon = isUserPreset ? generatePreviewIcon(preset as StylePreset) : preset.icon;

              return (
                <div key={presetKey} className="relative group">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-2 justify-start h-auto py-2 w-full"
                    data-testid={CanvasEditorTestIds.STYLE_PRESETS_PRESET_BUTTON}
                  >
                    {presetIcon && (
                      <div className="flex items-center justify-center shrink-0">
                        {presetIcon}
                      </div>
                    )}
                    <span className="text-xs truncate" style={getTextStyle(preset)}>
                      {preset.name}
                    </span>
                  </Button>

                  {/* Actions menu for user presets */}
                  {isUserPreset && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 bg-white hover:bg-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => handleUpdatePreset(preset as StylePreset, e)}
                            className="cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3 mr-2" />
                            Update
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteClick(preset as StylePreset, e)}
                            className="cursor-pointer text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {loading && (
            <div className="text-center text-xs text-slate-500 mt-2">
              Loading presets...
            </div>
          )}
        </div>
      )}

      {/* Save Preset Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent data-testid={CanvasEditorTestIds.STYLE_PRESETS_SAVE_DIALOG}>
          <DialogHeader>
            <DialogTitle>Save Style Preset</DialogTitle>
            <DialogDescription>
              Save the current object's styling as a reusable preset.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                placeholder="e.g., Main Figure Style"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSavePreset();
                  }
                }}
                data-testid={CanvasEditorTestIds.STYLE_PRESETS_NAME_INPUT}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} data-testid={CanvasEditorTestIds.STYLE_PRESETS_SAVE_DIALOG_BUTTON}>
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{presetToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
