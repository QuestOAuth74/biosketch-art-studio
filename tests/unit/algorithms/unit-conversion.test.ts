import { describe, it, expect } from 'vitest';
import {
  inchesToPixels,
  pixelsToInches,
  cmToPixels,
  pixelsToCm,
  inchesToCm,
  cmToInches,
  convertUnits,
  type Unit,
} from '@/lib/unitConversion';

describe('Unit Conversion', () => {
  describe('inchesToPixels and pixelsToInches', () => {
    it('should convert inches to pixels correctly at 300 DPI', () => {
      const inches = 1;
      const dpi = 300;

      const pixels = inchesToPixels(inches, dpi);

      expect(pixels).toBe(300);
    });

    it('should convert pixels to inches correctly at 300 DPI', () => {
      const pixels = 300;
      const dpi = 300;

      const inches = pixelsToInches(pixels, dpi);

      expect(inches).toBeCloseTo(1, 2);
    });

    it('should handle different DPI values', () => {
      const inches = 2;

      const pixels150 = inchesToPixels(inches, 150);
      const pixels300 = inchesToPixels(inches, 300);
      const pixels600 = inchesToPixels(inches, 600);

      expect(pixels150).toBe(300);
      expect(pixels300).toBe(600);
      expect(pixels600).toBe(1200);
    });

    it('should round-trip correctly', () => {
      const originalInches = 8.5;
      const dpi = 300;

      const pixels = inchesToPixels(originalInches, dpi);
      const roundTrip = pixelsToInches(pixels, dpi);

      expect(roundTrip).toBeCloseTo(originalInches, 2);
    });
  });

  describe('cmToPixels and pixelsToCm', () => {
    it('should convert cm to pixels correctly at 300 DPI', () => {
      const cm = 2.54; // 1 inch
      const dpi = 300;

      const pixels = cmToPixels(cm, dpi);

      // 2.54 cm = 1 inch = 300 pixels at 300 DPI
      expect(pixels).toBeCloseTo(300, 0);
    });

    it('should convert pixels to cm correctly at 300 DPI', () => {
      const pixels = 300;
      const dpi = 300;

      const cm = pixelsToCm(pixels, dpi);

      // 300 pixels at 300 DPI = 1 inch = 2.54 cm
      expect(cm).toBeCloseTo(2.54, 2);
    });

    it('should handle A4 dimensions (21 x 29.7 cm)', () => {
      const a4Width = 21; // cm
      const a4Height = 29.7; // cm
      const dpi = 300;

      const widthPx = cmToPixels(a4Width, dpi);
      const heightPx = cmToPixels(a4Height, dpi);

      // A4 at 300 DPI should be approximately 2480 x 3508 pixels
      expect(widthPx).toBeCloseTo(2480, -1); // Within ~10 pixels
      expect(heightPx).toBeCloseTo(3508, -1);
    });

    it('should round-trip correctly', () => {
      const originalCm = 21;
      const dpi = 300;

      const pixels = cmToPixels(originalCm, dpi);
      const roundTrip = pixelsToCm(pixels, dpi);

      expect(roundTrip).toBeCloseTo(originalCm, 2);
    });
  });

  describe('inchesToCm and cmToInches', () => {
    it('should convert inches to cm correctly', () => {
      const inches = 1;

      const cm = inchesToCm(inches);

      expect(cm).toBeCloseTo(2.54, 2);
    });

    it('should convert cm to inches correctly', () => {
      const cm = 2.54;

      const inches = cmToInches(cm);

      expect(inches).toBeCloseTo(1, 2);
    });

    it('should handle letter size (8.5 x 11 inches)', () => {
      const letterWidth = 8.5; // inches
      const letterHeight = 11; // inches

      const widthCm = inchesToCm(letterWidth);
      const heightCm = inchesToCm(letterHeight);

      expect(widthCm).toBeCloseTo(21.59, 1);
      expect(heightCm).toBeCloseTo(27.94, 1);
    });

    it('should round-trip correctly', () => {
      const originalInches = 8.5;

      const cm = inchesToCm(originalInches);
      const roundTrip = cmToInches(cm);

      expect(roundTrip).toBeCloseTo(originalInches, 2);
    });
  });

  describe('convertUnits', () => {
    it('should convert between all unit pairs correctly', () => {
      const value = 10;
      const dpi = 300;

      // Inches to pixels
      const inchesToPx = convertUnits(value, 'inches', 'px', dpi);
      expect(inchesToPx).toBeCloseTo(inchesToPixels(value, dpi), 1);

      // Inches to cm
      const inchesToCmResult = convertUnits(value, 'inches', 'cm');
      expect(inchesToCmResult).toBeCloseTo(inchesToCm(value), 1);

      // Cm to pixels
      const cmToPx = convertUnits(value, 'cm', 'px', dpi);
      expect(cmToPx).toBeCloseTo(cmToPixels(value, dpi), 1);

      // Cm to inches
      const cmToInchesResult = convertUnits(value, 'cm', 'inches');
      expect(cmToInchesResult).toBeCloseTo(cmToInches(value), 1);

      // Pixels to inches
      const pxToInches = convertUnits(value, 'px', 'inches', dpi);
      expect(pxToInches).toBeCloseTo(pixelsToInches(value, dpi), 1);

      // Pixels to cm
      const pxToCm = convertUnits(value, 'px', 'cm', dpi);
      expect(pxToCm).toBeCloseTo(pixelsToCm(value, dpi), 1);
    });

    it('should return same value when converting to same unit', () => {
      const value = 100;

      expect(convertUnits(value, 'inches', 'inches')).toBe(value);
      expect(convertUnits(value, 'cm', 'cm')).toBe(value);
      expect(convertUnits(value, 'px', 'px')).toBe(value);
    });

    it('should handle common paper sizes correctly', () => {
      const dpi = 300;

      // Letter size: 8.5 x 11 inches
      const letterWidthPx = convertUnits(8.5, 'inches', 'px', dpi);
      const letterHeightPx = convertUnits(11, 'inches', 'px', dpi);

      expect(letterWidthPx).toBe(2550);
      expect(letterHeightPx).toBe(3300);

      // A4 size: 21 x 29.7 cm
      const a4WidthPx = convertUnits(21, 'cm', 'px', dpi);
      const a4HeightPx = convertUnits(29.7, 'cm', 'px', dpi);

      expect(a4WidthPx).toBeCloseTo(2480, -1);
      expect(a4HeightPx).toBeCloseTo(3508, -1);
    });

    it('should maintain precision through multiple conversions', () => {
      const originalValue = 8.5;
      const dpi = 300;

      // Convert inches -> px -> cm -> inches
      const pixels = convertUnits(originalValue, 'inches', 'px', dpi);
      const cm = convertUnits(pixels, 'px', 'cm', dpi);
      const backToInches = convertUnits(cm, 'cm', 'inches');

      expect(backToInches).toBeCloseTo(originalValue, 1);
    });
  });

  describe('common paper sizes', () => {
    it('should convert Letter size dimensions correctly', () => {
      // Letter: 8.5" x 11"
      const dpi = 300;

      const widthPx = inchesToPixels(8.5, dpi);
      const heightPx = inchesToPixels(11, dpi);

      expect(widthPx).toBe(2550);
      expect(heightPx).toBe(3300);

      // Convert back
      const widthInches = pixelsToInches(widthPx, dpi);
      const heightInches = pixelsToInches(heightPx, dpi);

      expect(widthInches).toBeCloseTo(8.5, 2);
      expect(heightInches).toBeCloseTo(11, 2);
    });

    it('should convert A4 size dimensions correctly', () => {
      // A4: 21 cm x 29.7 cm
      const dpi = 300;

      const widthPx = cmToPixels(21, dpi);
      const heightPx = cmToPixels(29.7, dpi);

      expect(widthPx).toBeCloseTo(2480, -1);
      expect(heightPx).toBeCloseTo(3508, -1);

      // Convert back
      const widthCm = pixelsToCm(widthPx, dpi);
      const heightCm = pixelsToCm(heightPx, dpi);

      expect(widthCm).toBeCloseTo(21, 1);
      expect(heightCm).toBeCloseTo(29.7, 1);
    });

    it('should convert Tabloid size dimensions correctly', () => {
      // Tabloid: 11" x 17"
      const dpi = 300;

      const widthPx = inchesToPixels(11, dpi);
      const heightPx = inchesToPixels(17, dpi);

      expect(widthPx).toBe(3300);
      expect(heightPx).toBe(5100);

      // Convert back
      const widthInches = pixelsToInches(widthPx, dpi);
      const heightInches = pixelsToInches(heightPx, dpi);

      expect(widthInches).toBeCloseTo(11, 2);
      expect(heightInches).toBeCloseTo(17, 2);
    });
  });
});
