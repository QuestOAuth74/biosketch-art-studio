/**
 * Color conversion utilities
 * Supports RGB, CMYK, and hex color conversions
 */

export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface CMYKColor {
  c: number; // 0-100
  m: number; // 0-100
  y: number; // 0-100
  k: number; // 0-100
}

/**
 * Convert RGB color to CMYK
 * @param rgb RGB color object
 * @returns CMYK color object
 */
export function rgbToCMYK(rgb: RGBColor): CMYKColor {
  // Normalize RGB to 0-1 range
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  // Calculate K (black)
  const k = 1 - Math.max(r, g, b);

  // Handle pure black case
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  // Calculate CMY
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);

  // Convert to 0-100 percentage
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100)
  };
}

/**
 * Convert hex color string to RGB
 * @param hex Hex color string (e.g., "#FF0000" or "FF0000" or "#F00")
 * @returns RGB color object
 */
export function hexToRGB(hex: string): RGBColor {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Handle 3-digit shorthand
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return { r, g, b };
}

/**
 * Convert CMYK color to RGB
 * @param cmyk CMYK color object
 * @returns RGB color object
 */
export function cmykToRGB(cmyk: CMYKColor): RGBColor {
  // Normalize to 0-1
  const c = cmyk.c / 100;
  const m = cmyk.m / 100;
  const y = cmyk.y / 100;
  const k = cmyk.k / 100;

  // Convert to RGB
  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b)
  };
}
