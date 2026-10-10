/**
 * Image filter utilities for Fabric.js
 * Provides filter creation and application for images
 */

import { filters, FabricImage } from 'fabric';
import { ImageFilterConfig } from '@/types/effects';
import { GradientMapFilter } from './filters/GradientMapFilter';
import { ColorMapDefinition } from './scientificColorMaps';

/**
 * Filter matrix type for image filters
 */
export interface FilterMatrix {
  type: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

/**
 * Create a brightness filter for Fabric.js
 * @param brightness Brightness value (-1 to 1 for direct use, or -100 to 100 if > 1 or < -1)
 * @returns Fabric.js brightness filter
 */
export function createBrightnessFilter(brightness: number) {
  // Auto-detect if value needs normalization (> 1 or < -1 means it's in -100..100 range)
  const normalizedValue = Math.abs(brightness) > 1
    ? Math.max(-1, Math.min(1, brightness / 100))
    : brightness;

  return new filters.Brightness({
    brightness: normalizedValue
  });
}

/**
 * Create a contrast filter for Fabric.js
 * @param contrast Contrast value (-1 to 1 for direct use, or -100 to 100 if > 1 or < -1)
 * @returns Fabric.js contrast filter
 */
export function createContrastFilter(contrast: number) {
  // Auto-detect if value needs normalization (> 1 or < -1 means it's in -100..100 range)
  const normalizedValue = Math.abs(contrast) > 1
    ? Math.max(-1, Math.min(1, contrast / 100))
    : contrast;

  return new filters.Contrast({
    contrast: normalizedValue
  });
}

/**
 * Create a saturation filter for Fabric.js
 * @param saturation Saturation value (-1 to 1 for direct use, or -100 to 100 if > 1 or < -1)
 * @returns Fabric.js saturation filter
 */
export function createSaturationFilter(saturation: number) {
  // Auto-detect if value needs normalization
  // Values > 1 are allowed for oversaturation, so only normalize if it looks like -100..100 range
  const normalizedValue = Math.abs(saturation) > 10
    ? Math.max(-1, Math.min(1, saturation / 100))
    : saturation;

  return new filters.Saturation({
    saturation: normalizedValue
  });
}

/**
 * Create a grayscale filter for Fabric.js
 * @returns Fabric.js grayscale filter
 */
export function createGrayscaleFilter() {
  return new filters.Grayscale();
}

/**
 * Create a sepia filter for Fabric.js using ColorMatrix
 * @returns Fabric.js sepia filter
 */
export function createSepiaFilter() {
  // Use ColorMatrix with standard sepia coefficients
  return new filters.ColorMatrix({
    matrix: [
      0.393, 0.769, 0.189, 0, 0,
      0.349, 0.686, 0.168, 0, 0,
      0.272, 0.534, 0.131, 0, 0,
      0, 0, 0, 1, 0
    ]
  });
}

/**
 * Apply all filters to a Fabric image based on configuration
 * @param imageObj The Fabric image object
 * @param config Filter configuration
 */
export function applyImageFilters(
  imageObj: FabricImage,
  config: ImageFilterConfig
): void {
  // Clear existing filters except BlendColor (used for toning)
  const existingFilters = imageObj.filters || [];
  const toneFilter = existingFilters.find((f: any) => f.type === 'BlendColor');

  imageObj.filters = [];

  // Re-add tone filter if it existed
  if (toneFilter) {
    imageObj.filters.push(toneFilter);
  }

  // Apply adjustment filters in order (if non-zero)
  if (config.brightness !== 0) {
    imageObj.filters.push(createBrightnessFilter(config.brightness));
  }

  if (config.contrast !== 0) {
    imageObj.filters.push(createContrastFilter(config.contrast));
  }

  if (config.saturation !== 0) {
    imageObj.filters.push(createSaturationFilter(config.saturation));
  }

  // Apply effect filters (grayscale/sepia are mutually exclusive)
  if (config.grayscale) {
    imageObj.filters.push(createGrayscaleFilter());
  } else if (config.sepia) {
    imageObj.filters.push(createSepiaFilter());
  }

  // Apply all filters to the image
  imageObj.applyFilters();
}

/**
 * Create a gradient map filter for scientific visualization
 * @param colorMap Color map definition
 * @param intensity Blend intensity (0-1)
 * @returns GradientMapFilter instance
 */
export function createColorMapFilter(colorMap: ColorMapDefinition, intensity: number = 1.0): GradientMapFilter {
  return new GradientMapFilter({
    colorMap,
    intensity: Math.max(0, Math.min(1, intensity))
  });
}

/**
 * Apply a color map to an image
 * @param imageObj The Fabric image object
 * @param colorMap Color map definition
 * @param intensity Blend intensity (0-1)
 * @param preserveExisting Whether to preserve existing filters
 */
export function applyColorMap(
  imageObj: FabricImage,
  colorMap: ColorMapDefinition,
  intensity: number = 1.0,
  preserveExisting: boolean = true
): void {
  const existingFilters = imageObj.filters || [];

  if (!preserveExisting) {
    imageObj.filters = [];
  } else {
    // Keep existing filters except old color maps
    imageObj.filters = existingFilters.filter((f: any) => f.type !== 'GradientMap');
  }

  // Add the color map filter
  const colorMapFilter = createColorMapFilter(colorMap, intensity);
  imageObj.filters.push(colorMapFilter);

  // Apply all filters
  imageObj.applyFilters();
}

/**
 * Remove color map from an image
 * @param imageObj The Fabric image object
 */
export function removeColorMap(imageObj: FabricImage): void {
  if (!imageObj.filters) return;

  // Remove all GradientMap filters
  imageObj.filters = imageObj.filters.filter((f: any) => f.type !== 'GradientMap');
  imageObj.applyFilters();
}
