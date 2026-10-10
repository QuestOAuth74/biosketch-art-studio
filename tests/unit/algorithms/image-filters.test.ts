import { describe, it, expect } from 'vitest';
import {
  createBrightnessFilter,
  createContrastFilter,
  createSaturationFilter,
  type FilterMatrix,
} from '@/lib/imageFilters';

describe('Image Filters', () => {
  describe('createBrightnessFilter', () => {
    it('should generate correct Fabric.js filter matrix for brightness', () => {
      const brightness = 0.3; // 30% brighter

      const filter = createBrightnessFilter(brightness);

      // Verify filter structure
      expect(filter).toHaveProperty('type');
      expect(filter.type).toBe('Brightness');
      expect(filter).toHaveProperty('brightness');
      expect(filter.brightness).toBe(brightness);
    });

    it('should handle negative brightness values (darker)', () => {
      const brightness = -0.4; // 40% darker

      const filter = createBrightnessFilter(brightness);

      expect(filter.type).toBe('Brightness');
      expect(filter.brightness).toBe(brightness);
      expect(filter.brightness).toBeLessThan(0);
    });

    it('should handle zero brightness (no change)', () => {
      const brightness = 0;

      const filter = createBrightnessFilter(brightness);

      expect(filter.type).toBe('Brightness');
      expect(filter.brightness).toBe(0);
    });
  });

  describe('createContrastFilter', () => {
    it('should generate correct Fabric.js filter matrix for contrast', () => {
      const contrast = 0.5; // 50% more contrast

      const filter = createContrastFilter(contrast);

      // Verify filter structure
      expect(filter).toHaveProperty('type');
      expect(filter.type).toBe('Contrast');
      expect(filter).toHaveProperty('contrast');
      expect(filter.contrast).toBe(contrast);
    });

    it('should handle negative contrast values (less contrast)', () => {
      const contrast = -0.3; // 30% less contrast

      const filter = createContrastFilter(contrast);

      expect(filter.type).toBe('Contrast');
      expect(filter.contrast).toBe(contrast);
      expect(filter.contrast).toBeLessThan(0);
    });

    it('should handle extreme contrast values', () => {
      const highContrast = 1.0; // Maximum contrast
      const lowContrast = -1.0; // Minimum contrast

      const filterHigh = createContrastFilter(highContrast);
      const filterLow = createContrastFilter(lowContrast);

      expect(filterHigh.contrast).toBe(1.0);
      expect(filterLow.contrast).toBe(-1.0);
    });
  });

  describe('createSaturationFilter', () => {
    it('should generate correct Fabric.js filter matrix for saturation', () => {
      const saturation = 0.6; // 60% more saturated

      const filter = createSaturationFilter(saturation);

      // Verify filter structure
      expect(filter).toHaveProperty('type');
      expect(filter.type).toBe('Saturation');
      expect(filter).toHaveProperty('saturation');
      expect(filter.saturation).toBe(saturation);
    });

    it('should handle desaturation (grayscale effect)', () => {
      const saturation = -1.0; // Complete desaturation (grayscale)

      const filter = createSaturationFilter(saturation);

      expect(filter.type).toBe('Saturation');
      expect(filter.saturation).toBe(-1.0);
    });

    it('should handle oversaturation', () => {
      const saturation = 2.0; // 200% saturation

      const filter = createSaturationFilter(saturation);

      expect(filter.type).toBe('Saturation');
      expect(filter.saturation).toBe(2.0);
    });
  });
});
