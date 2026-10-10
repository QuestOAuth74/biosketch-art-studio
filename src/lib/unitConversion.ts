/**
 * Unit Conversion Utilities for Canvas Dimensions
 * Converts between pixels, inches, centimeters, and millimeters
 */

// DPI constants matching existing paper sizes (from paperSizes.ts)
export const DPI_PRINT = 300; // High-quality print DPI
export const MM_PER_INCH = 25.4;
export const CM_PER_INCH = 2.54;

export type Unit = 'px' | 'in' | 'cm' | 'mm' | 'inches';

/**
 * Convert any unit to pixels (using 300 DPI for consistency)
 */
export function toPixels(value: number, unit: Unit): number {
  switch (unit) {
    case 'px':
      return Math.round(value);
    case 'in':
      return Math.round(value * DPI_PRINT);
    case 'cm':
      return Math.round((value / CM_PER_INCH) * DPI_PRINT);
    case 'mm':
      return Math.round((value / MM_PER_INCH) * DPI_PRINT);
  }
}

/**
 * Convert pixels to any unit
 */
export function fromPixels(pixels: number, unit: Unit): number {
  switch (unit) {
    case 'px':
      return Math.round(pixels);
    case 'in':
      // 2 decimal places for inches
      return Math.round((pixels / DPI_PRINT) * 100) / 100;
    case 'cm':
      // 1 decimal place for centimeters
      return Math.round((pixels / DPI_PRINT) * CM_PER_INCH * 10) / 10;
    case 'mm':
      // Whole numbers for millimeters
      return Math.round((pixels / DPI_PRINT) * MM_PER_INCH);
  }
}

/**
 * Convert between any two units
 */
export function convertUnit(value: number, fromUnit: Unit, toUnit: Unit): number {
  if (fromUnit === toUnit) return value;
  const pixels = toPixels(value, fromUnit);
  return fromPixels(pixels, toUnit);
}

/**
 * Dimension limits for each unit to prevent unreasonable canvas sizes
 */
export const DIMENSION_LIMITS = {
  px: { min: 100, max: 20000 },
  in: { min: 0.33, max: 66.67 },   // ~100px - 20000px at 300 DPI
  cm: { min: 0.85, max: 169.33 },  // Equivalent in cm
  mm: { min: 8.5, max: 1693.33 }   // Equivalent in mm
};

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate dimension value for a given unit
 */
export function validateDimension(value: number, unit: Unit): ValidationResult {
  const limits = DIMENSION_LIMITS[unit];

  if (isNaN(value) || value <= 0) {
    return { valid: false, error: 'Please enter a valid positive number' };
  }

  if (value < limits.min) {
    return { valid: false, error: `Minimum ${limits.min}${unit}` };
  }

  if (value > limits.max) {
    return { valid: false, error: `Maximum ${limits.max}${unit}` };
  }

  return { valid: true };
}

/**
 * Format dimension value with appropriate precision for the unit
 */
export function formatDimension(value: number, unit: Unit): string {
  switch (unit) {
    case 'px':
    case 'mm':
      return Math.round(value).toString();
    case 'in':
      return (Math.round(value * 100) / 100).toFixed(2);
    case 'cm':
      return (Math.round(value * 10) / 10).toFixed(1);
  }
}

/**
 * Get step size for input increments based on unit
 */
export function getStepSize(unit: Unit): number {
  switch (unit) {
    case 'px':
      return 10;
    case 'in':
      return 0.1;
    case 'cm':
      return 0.5;
    case 'mm':
      return 1;
  }
}

/**
 * Get display name for unit
 */
export function getUnitDisplay(unit: Unit): string {
  switch (unit) {
    case 'px':
      return 'Pixels';
    case 'in':
    case 'inches':
      return 'Inches';
    case 'cm':
      return 'Centimeters';
    case 'mm':
      return 'Millimeters';
  }
}

/**
 * Convert inches to pixels
 * @param inches Value in inches
 * @param dpi Dots per inch (default: 300)
 * @returns Value in pixels
 */
export function inchesToPixels(inches: number, dpi: number = DPI_PRINT): number {
  return inches * dpi;
}

/**
 * Convert pixels to inches
 * @param pixels Value in pixels
 * @param dpi Dots per inch (default: 300)
 * @returns Value in inches
 */
export function pixelsToInches(pixels: number, dpi: number = DPI_PRINT): number {
  return pixels / dpi;
}

/**
 * Convert centimeters to pixels
 * @param cm Value in centimeters
 * @param dpi Dots per inch (default: 300)
 * @returns Value in pixels
 */
export function cmToPixels(cm: number, dpi: number = DPI_PRINT): number {
  return (cm / CM_PER_INCH) * dpi;
}

/**
 * Convert pixels to centimeters
 * @param pixels Value in pixels
 * @param dpi Dots per inch (default: 300)
 * @returns Value in centimeters
 */
export function pixelsToCm(pixels: number, dpi: number = DPI_PRINT): number {
  return (pixels / dpi) * CM_PER_INCH;
}

/**
 * Convert inches to centimeters
 * @param inches Value in inches
 * @returns Value in centimeters
 */
export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

/**
 * Convert centimeters to inches
 * @param cm Value in centimeters
 * @returns Value in inches
 */
export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

/**
 * Convert between any two units (with optional DPI for pixel conversions)
 * @param value Value to convert
 * @param fromUnit Source unit
 * @param toUnit Target unit
 * @param dpi Dots per inch for pixel conversions (default: 300)
 * @returns Converted value
 */
export function convertUnits(value: number, fromUnit: Unit, toUnit: Unit, dpi: number = DPI_PRINT): number {
  // Normalize 'inches' to 'in'
  const normalizedFrom = fromUnit === 'inches' ? 'in' : fromUnit;
  const normalizedTo = toUnit === 'inches' ? 'in' : toUnit;

  // If same unit, return as is
  if (normalizedFrom === normalizedTo) {
    return value;
  }

  // Convert to pixels first (as intermediate step)
  let pixels: number;
  switch (normalizedFrom) {
    case 'px':
      pixels = value;
      break;
    case 'in':
      pixels = inchesToPixels(value, dpi);
      break;
    case 'cm':
      pixels = cmToPixels(value, dpi);
      break;
    case 'mm':
      pixels = (value / MM_PER_INCH) * dpi;
      break;
  }

  // Convert from pixels to target unit
  switch (normalizedTo) {
    case 'px':
      return pixels;
    case 'in':
      return pixelsToInches(pixels, dpi);
    case 'cm':
      return pixelsToCm(pixels, dpi);
    case 'mm':
      return (pixels / dpi) * MM_PER_INCH;
  }
}
