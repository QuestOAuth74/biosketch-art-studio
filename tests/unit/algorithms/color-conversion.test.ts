import { describe, it, expect } from 'vitest';
import {
  rgbToCMYK,
  hexToRGB,
  cmykToRGB,
  type RGBColor,
  type CMYKColor,
} from '@/lib/colorUtils';

describe('Color Conversion', () => {
  describe('rgbToCMYK', () => {
    it('should convert RGB to CMYK correctly for black', () => {
      const black: RGBColor = { r: 0, g: 0, b: 0 };

      const cmyk = rgbToCMYK(black);

      expect(cmyk.c).toBe(0);
      expect(cmyk.m).toBe(0);
      expect(cmyk.y).toBe(0);
      expect(cmyk.k).toBe(100);
    });

    it('should convert RGB to CMYK correctly for white', () => {
      const white: RGBColor = { r: 255, g: 255, b: 255 };

      const cmyk = rgbToCMYK(white);

      expect(cmyk.c).toBe(0);
      expect(cmyk.m).toBe(0);
      expect(cmyk.y).toBe(0);
      expect(cmyk.k).toBe(0);
    });

    it('should convert RGB to CMYK correctly for pure red', () => {
      const red: RGBColor = { r: 255, g: 0, b: 0 };

      const cmyk = rgbToCMYK(red);

      expect(cmyk.c).toBe(0);
      expect(cmyk.m).toBeCloseTo(100, 0);
      expect(cmyk.y).toBeCloseTo(100, 0);
      expect(cmyk.k).toBe(0);
    });

    it('should convert RGB to CMYK correctly for cyan', () => {
      const cyan: RGBColor = { r: 0, g: 255, b: 255 };

      const cmyk = rgbToCMYK(cyan);

      expect(cmyk.c).toBeCloseTo(100, 0);
      expect(cmyk.m).toBe(0);
      expect(cmyk.y).toBe(0);
      expect(cmyk.k).toBe(0);
    });

    it('should produce CMYK values in valid range (0-100)', () => {
      const colors: RGBColor[] = [
        { r: 128, g: 64, b: 192 },
        { r: 200, g: 150, b: 100 },
        { r: 50, g: 100, b: 150 },
      ];

      colors.forEach((color) => {
        const cmyk = rgbToCMYK(color);

        expect(cmyk.c).toBeGreaterThanOrEqual(0);
        expect(cmyk.c).toBeLessThanOrEqual(100);
        expect(cmyk.m).toBeGreaterThanOrEqual(0);
        expect(cmyk.m).toBeLessThanOrEqual(100);
        expect(cmyk.y).toBeGreaterThanOrEqual(0);
        expect(cmyk.y).toBeLessThanOrEqual(100);
        expect(cmyk.k).toBeGreaterThanOrEqual(0);
        expect(cmyk.k).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('hexToRGB', () => {
    it('should convert hex to RGB correctly', () => {
      const hex = '#ff0000';

      const rgb = hexToRGB(hex);

      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('should handle hex without # prefix', () => {
      const hex = 'ff0000';

      const rgb = hexToRGB(hex);

      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('should handle 3-digit hex shorthand', () => {
      const hex = '#f0a';

      const rgb = hexToRGB(hex);

      // #f0a expands to #ff00aa
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(170);
    });

    it('should convert common colors correctly', () => {
      const tests = [
        { hex: '#000000', expected: { r: 0, g: 0, b: 0 } },
        { hex: '#ffffff', expected: { r: 255, g: 255, b: 255 } },
        { hex: '#00ff00', expected: { r: 0, g: 255, b: 0 } },
        { hex: '#0000ff', expected: { r: 0, g: 0, b: 255 } },
      ];

      tests.forEach(({ hex, expected }) => {
        const rgb = hexToRGB(hex);
        expect(rgb).toEqual(expected);
      });
    });
  });

  describe('cmykToRGB', () => {
    it('should convert CMYK to RGB correctly for black', () => {
      const black: CMYKColor = { c: 0, m: 0, y: 0, k: 100 };

      const rgb = cmykToRGB(black);

      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('should convert CMYK to RGB correctly for white', () => {
      const white: CMYKColor = { c: 0, m: 0, y: 0, k: 0 };

      const rgb = cmykToRGB(white);

      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(255);
      expect(rgb.b).toBe(255);
    });

    it('should convert CMYK to RGB correctly for cyan', () => {
      const cyan: CMYKColor = { c: 100, m: 0, y: 0, k: 0 };

      const rgb = cmykToRGB(cyan);

      expect(rgb.r).toBe(0);
      expect(rgb.g).toBeCloseTo(255, 0);
      expect(rgb.b).toBeCloseTo(255, 0);
    });

    it('should produce RGB values in valid range (0-255)', () => {
      const colors: CMYKColor[] = [
        { c: 50, m: 25, y: 75, k: 10 },
        { c: 80, m: 60, y: 40, k: 20 },
        { c: 20, m: 80, y: 60, k: 5 },
      ];

      colors.forEach((color) => {
        const rgb = cmykToRGB(color);

        expect(rgb.r).toBeGreaterThanOrEqual(0);
        expect(rgb.r).toBeLessThanOrEqual(255);
        expect(rgb.g).toBeGreaterThanOrEqual(0);
        expect(rgb.g).toBeLessThanOrEqual(255);
        expect(rgb.b).toBeGreaterThanOrEqual(0);
        expect(rgb.b).toBeLessThanOrEqual(255);
      });
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain color accuracy through RGB -> CMYK -> RGB conversion', () => {
      const originalColors: RGBColor[] = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 128, g: 128, b: 128 },
      ];

      originalColors.forEach((original) => {
        const cmyk = rgbToCMYK(original);
        const roundTrip = cmykToRGB(cmyk);

        // Colors should be very close (within a few units due to rounding)
        expect(roundTrip.r).toBeCloseTo(original.r, -1); // Within ~10 units
        expect(roundTrip.g).toBeCloseTo(original.g, -1);
        expect(roundTrip.b).toBeCloseTo(original.b, -1);
      });
    });

    it('should handle edge cases in round-trip conversion', () => {
      const edgeCases: RGBColor[] = [
        { r: 0, g: 0, b: 0 }, // Black
        { r: 255, g: 255, b: 255 }, // White
        { r: 1, g: 1, b: 1 }, // Near black
        { r: 254, g: 254, b: 254 }, // Near white
      ];

      edgeCases.forEach((original) => {
        const cmyk = rgbToCMYK(original);
        const roundTrip = cmykToRGB(cmyk);

        expect(roundTrip.r).toBeCloseTo(original.r, -1);
        expect(roundTrip.g).toBeCloseTo(original.g, -1);
        expect(roundTrip.b).toBeCloseTo(original.b, -1);
      });
    });
  });
});
