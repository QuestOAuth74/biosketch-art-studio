/**
 * Gradient Map Filter for Fabric.js
 * Maps grayscale intensity values to a color gradient
 * Used for scientific visualization and false color imaging
 */

import { filters } from 'fabric';
import { ColorMapDefinition, interpolateColorMap } from '../scientificColorMaps';

export interface GradientMapFilterOptions {
  colorMap: ColorMapDefinition;
  intensity?: number; // 0-1, blend with original
}

/**
 * Custom Fabric.js filter that applies a gradient map to an image
 * Converts grayscale intensity to colors from a scientific color map
 */
export class GradientMapFilter extends filters.BaseFilter {
  type = 'GradientMap';
  colorMap: ColorMapDefinition;
  intensity: number;

  constructor(options: GradientMapFilterOptions) {
    super();
    this.colorMap = options.colorMap;
    this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
  }

  /**
   * WebGL fragment shader - required for WebGL rendering
   */
  getFragmentSource(): string {
    // Simple pass-through shader that will be handled by applyToWebGL
    return `
      precision highp float;
      uniform sampler2D uTexture;
      varying vec2 vTexCoord;
      void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      }
    `;
  }

  /**
   * Override WebGL application to fallback to 2D
   */
  applyToWebGL(options: any): void {
    // Don't use WebGL - force 2D rendering
    this.applyTo2d(options);
  }

  /**
   * Apply the filter to image data (2D canvas implementation)
   */
  applyTo2d(options: any): void {
    const imageData = options.imageData;
    const data = imageData.data;
    const len = data.length;
    // Pre-compute color lookup table for performance (256 intensity levels)
    const lut = this.buildLookupTable();

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Calculate grayscale intensity using luminance formula
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      // Look up mapped color
      const mappedColor = lut[gray];

      // Blend with original based on intensity
      if (this.intensity < 1.0) {
        data[i] = Math.round(r * (1 - this.intensity) + mappedColor.r * this.intensity);
        data[i + 1] = Math.round(g * (1 - this.intensity) + mappedColor.g * this.intensity);
        data[i + 2] = Math.round(b * (1 - this.intensity) + mappedColor.b * this.intensity);
      } else {
        data[i] = mappedColor.r;
        data[i + 1] = mappedColor.g;
        data[i + 2] = mappedColor.b;
      }

      // Preserve alpha channel
      data[i + 3] = a;
    }
  }

  /**
   * Build a lookup table for fast color mapping
   * Maps 0-255 intensity values to RGB colors
   */
  private buildLookupTable(): Array<{ r: number; g: number; b: number }> {
    const lut = new Array(256);

    for (let i = 0; i < 256; i++) {
      const normalizedValue = i / 255;
      const hexColor = interpolateColorMap(this.colorMap, normalizedValue);

      // Convert hex to RGB
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);

      lut[i] = { r, g, b };
    }

    return lut;
  }

  /**
   * Convert filter to object for serialization
   */
  toObject(): any {
    return {
      type: this.type,
      colorMap: this.colorMap,
      intensity: this.intensity
    };
  }

  /**
   * Check if this filter is neutral (has no effect)
   */
  isNeutralState(): boolean {
    return false; // Color maps always have an effect
  }
}
