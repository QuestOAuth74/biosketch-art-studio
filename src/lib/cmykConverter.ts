/**
 * CMYK Converter for SVG Processing
 * Converts RGB colors in SVG to CMYK for print-ready PDFs
 */

import { hexToRGB, rgbToCMYK, cmykToRGB, CMYKColor, RGBColor } from './colorUtils';

/**
 * Extracts all color values from SVG element and its children
 */
export function extractColorsFromSVG(svgElement: SVGElement): Set<string> {
  const colors = new Set<string>();

  const traverse = (element: Element) => {
    // Check fill attribute
    const fill = element.getAttribute('fill');
    if (fill && fill !== 'none' && !fill.startsWith('url(')) {
      colors.add(fill);
    }

    // Check stroke attribute
    const stroke = element.getAttribute('stroke');
    if (stroke && stroke !== 'none' && !stroke.startsWith('url(')) {
      colors.add(stroke);
    }

    // Check style attribute
    const style = element.getAttribute('style');
    if (style) {
      const fillMatch = style.match(/fill:\s*([^;]+)/);
      const strokeMatch = style.match(/stroke:\s*([^;]+)/);
      if (fillMatch && fillMatch[1] !== 'none') colors.add(fillMatch[1].trim());
      if (strokeMatch && strokeMatch[1] !== 'none') colors.add(strokeMatch[1].trim());
    }

    // Recurse through children
    Array.from(element.children).forEach(traverse);
  };

  traverse(svgElement);
  return colors;
}

/**
 * Converts SVG colors from RGB to CMYK
 * Adds CMYK data as data-cmyk-* attributes for reference
 * Returns a Map of RGB -> CMYK for reference
 */
export function convertSVGToCMYK(svgElement: SVGElement): Map<string, CMYKColor> {
  const colorMap = new Map<string, CMYKColor>();

  const processElement = (element: Element) => {
    const processColorAttribute = (attrName: 'fill' | 'stroke' | 'flood-color' | 'stop-color') => {
      const color = element.getAttribute(attrName);
      if (!color || color === 'none' || color.startsWith('url(')) return;

      try {
        // Parse color (assuming hex format for now)
        let rgb: RGBColor;
        if (color.startsWith('#')) {
          rgb = hexToRGB(color);
        } else if (color.startsWith('rgb(')) {
          // Parse rgb() format
          const matches = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (matches) {
            rgb = { r: parseInt(matches[1]), g: parseInt(matches[2]), b: parseInt(matches[3]) };
          } else {
            return;
          }
        } else {
          // Skip named colors for now
          return;
        }

        const cmyk = rgbToCMYK(rgb);
        colorMap.set(color, cmyk);

        // Add CMYK data as metadata attribute
        element.setAttribute(`data-cmyk-${attrName}`,
          `${cmyk.c},${cmyk.m},${cmyk.y},${cmyk.k}`);
      } catch (err) {
        console.warn(`Failed to convert color ${color}:`, err);
      }
    };

    // Process direct color attributes
    processColorAttribute('fill');
    processColorAttribute('stroke');
    processColorAttribute('flood-color');
    processColorAttribute('stop-color');

    // Process style attribute
    const style = element.getAttribute('style');
    if (style) {
      // For complex style parsing, we'd need a full CSS parser
      // For now, this is a simplified approach
      // In production, you might want to use a library for this
    }

    // Recurse through children
    Array.from(element.children).forEach(processElement);
  };

  // Convert gradient stops
  const gradients = svgElement.querySelectorAll('linearGradient, radialGradient');
  gradients.forEach(gradient => {
    const stops = gradient.querySelectorAll('stop');
    stops.forEach(stop => {
      const color = stop.getAttribute('stop-color');
      if (color && color !== 'none') {
        try {
          const rgb = hexToRGB(color);
          const cmyk = rgbToCMYK(rgb);
          colorMap.set(color, cmyk);
          stop.setAttribute('data-cmyk-stop-color',
            `${cmyk.c},${cmyk.m},${cmyk.y},${cmyk.k}`);
        } catch (err) {
          console.warn(`Failed to convert gradient stop color ${color}:`, err);
        }
      }
    });
  });

  // Convert filter colors (for shadows, etc.)
  const filters = svgElement.querySelectorAll('filter');
  filters.forEach(filter => {
    const floods = filter.querySelectorAll('feFlood');
    floods.forEach(flood => {
      const color = flood.getAttribute('flood-color');
      if (color && color !== 'none') {
        try {
          const rgb = hexToRGB(color);
          const cmyk = rgbToCMYK(rgb);
          colorMap.set(color, cmyk);
          flood.setAttribute('data-cmyk-flood-color',
            `${cmyk.c},${cmyk.m},${cmyk.y},${cmyk.k}`);
        } catch (err) {
          console.warn(`Failed to convert flood color ${color}:`, err);
        }
      }
    });
  });

  // Process all other elements
  processElement(svgElement);

  return colorMap;
}

/**
 * Detects if an RGB color is out of CMYK gamut
 * Returns true if the color doesn't convert well to CMYK
 */
export function detectOutOfGamut(rgb: RGBColor): boolean {
  const cmyk = rgbToCMYK(rgb);

  // Check total ink coverage (common limit is 320%)
  const totalInk = cmyk.c + cmyk.m + cmyk.y + cmyk.k;
  if (totalInk > 320) return true;

  // Check for very bright colors that don't convert well
  // Bright red
  if (rgb.r > 240 && rgb.g < 20 && rgb.b < 20) return true;
  // Bright green
  if (rgb.r < 20 && rgb.g > 240 && rgb.b < 20) return true;
  // Bright blue
  if (rgb.r < 20 && rgb.g < 20 && rgb.b > 240) return true;

  return false;
}

/**
 * Adjusts out-of-gamut RGB colors to bring them into printable range
 * Applies gamut mapping to clamp total ink coverage
 */
export function clampToGamut(rgb: RGBColor): RGBColor {
  const cmyk = rgbToCMYK(rgb);

  // Check if total ink coverage exceeds 320% (common limit)
  const totalInk = cmyk.c + cmyk.m + cmyk.y + cmyk.k;
  if (totalInk > 320) {
    // Scale down proportionally
    const scale = 320 / totalInk;
    return {
      r: Math.round(rgb.r * scale),
      g: Math.round(rgb.g * scale),
      b: Math.round(rgb.b * scale)
    };
  }

  return rgb;
}

/**
 * Validates SVG for CMYK conversion compatibility
 * Returns a list of warnings about potential conversion issues
 */
export function validateSVGForCMYK(svgElement: SVGElement): string[] {
  const warnings: string[] = [];

  // Check for out-of-gamut colors
  const colors = extractColorsFromSVG(svgElement);
  const outOfGamut: string[] = [];

  colors.forEach(colorStr => {
    try {
      if (colorStr.startsWith('#')) {
        const rgb = hexToRGB(colorStr);
        if (detectOutOfGamut(rgb)) {
          outOfGamut.push(colorStr);
        }
      }
    } catch {
      // Ignore parsing errors
    }
  });

  if (outOfGamut.length > 0) {
    warnings.push(`${outOfGamut.length} color(s) may not reproduce accurately in CMYK`);
  }

  // Check for complex filters
  const filters = svgElement.querySelectorAll('filter');
  const complexFilters = Array.from(filters).filter(f =>
    f.querySelectorAll('feComponentTransfer, feConvolveMatrix, feDisplacementMap').length > 0
  );

  if (complexFilters.length > 0) {
    warnings.push('Some advanced filters may not render correctly in CMYK mode');
  }

  // Check for blend modes (not well supported in CMYK)
  const blendModes = svgElement.querySelectorAll('[style*="mix-blend-mode"]');
  if (blendModes.length > 0) {
    warnings.push('Blend modes have limited support in CMYK PDFs');
  }

  return warnings;
}

/**
 * Actually converts SVG colors to CMYK-simulated RGB
 * This modifies the SVG in-place to show how colors will look when printed in CMYK
 * @param svgElement The SVG element to convert
 * @returns Map of original RGB colors to their CMYK equivalents
 */
export function applyCMYKConversion(svgElement: SVGElement): Map<string, CMYKColor> {
  const colorMap = new Map<string, CMYKColor>();

  /**
   * Convert a color string to CMYK-simulated RGB hex
   */
  const convertColor = (colorStr: string): string | null => {
    if (!colorStr || colorStr === 'none' || colorStr.startsWith('url(')) return null;

    try {
      let rgb: RGBColor;

      // Parse different color formats
      if (colorStr.startsWith('#')) {
        rgb = hexToRGB(colorStr);
      } else if (colorStr.startsWith('rgb(')) {
        const matches = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!matches) return null;
        rgb = {
          r: parseInt(matches[1]),
          g: parseInt(matches[2]),
          b: parseInt(matches[3])
        };
      } else {
        // Skip named colors for now
        return null;
      }

      // Convert RGB -> CMYK -> RGB to simulate print gamut
      const cmyk = rgbToCMYK(rgb);
      const printRGB = cmykToRGB(cmyk);

      colorMap.set(colorStr, cmyk);

      // Apply additional CMYK simulation: reduce vibrancy by 15%
      // This makes the CMYK effect more visible
      const adjustedRGB = {
        r: Math.round(printRGB.r * 0.85),
        g: Math.round(printRGB.g * 0.85),
        b: Math.round(printRGB.b * 0.85)
      };
      // Convert back to hex
      const r = adjustedRGB.r.toString(16).padStart(2, '0');
      const g = adjustedRGB.g.toString(16).padStart(2, '0');
      const b = adjustedRGB.b.toString(16).padStart(2, '0');

      return `#${r}${g}${b}`;
    } catch (err) {
      console.warn(`Failed to convert color ${colorStr}:`, err);
      return null;
    }
  };

  /**
   * Process an element and update its colors
   */
  const processElement = (element: Element) => {
    // Skip the background rect (width="100%" height="100%")
    const width = element.getAttribute('width');
    const height = element.getAttribute('height');
    const isBackground = element.tagName === 'rect' &&
                         width === '100%' &&
                         height === '100%';

    if (isBackground) {
      return; // Don't convert the canvas background
    }

    // Process fill
    const fill = element.getAttribute('fill');
    if (fill) {
      const newFill = convertColor(fill);
      if (newFill) element.setAttribute('fill', newFill);
    }

    // Process stroke
    const stroke = element.getAttribute('stroke');
    if (stroke) {
      const newStroke = convertColor(stroke);
      if (newStroke) element.setAttribute('stroke', newStroke);
    }

    // Process stop-color (for gradients)
    const stopColor = element.getAttribute('stop-color');
    if (stopColor) {
      const newColor = convertColor(stopColor);
      if (newColor) element.setAttribute('stop-color', newColor);
    }

    // Process flood-color (for filters)
    const floodColor = element.getAttribute('flood-color');
    if (floodColor) {
      const newColor = convertColor(floodColor);
      if (newColor) element.setAttribute('flood-color', newColor);
    }

    // Process style attribute
    const style = element.getAttribute('style');
    if (style) {
      let newStyle = style;

      // Update fill in style
      const fillMatch = style.match(/fill:\s*([^;]+)/);
      if (fillMatch && fillMatch[1] !== 'none') {
        const newFill = convertColor(fillMatch[1].trim());
        if (newFill) {
          newStyle = newStyle.replace(/fill:\s*[^;]+/, `fill: ${newFill}`);
        }
      }

      // Update stroke in style
      const strokeMatch = style.match(/stroke:\s*([^;]+)/);
      if (strokeMatch && strokeMatch[1] !== 'none') {
        const newStroke = convertColor(strokeMatch[1].trim());
        if (newStroke) {
          newStyle = newStyle.replace(/stroke:\s*[^;]+/, `stroke: ${newStroke}`);
        }
      }

      if (newStyle !== style) {
        element.setAttribute('style', newStyle);
      }
    }

    // Recurse through children
    Array.from(element.children).forEach(processElement);
  };

  // Process all elements
  processElement(svgElement);

  return colorMap;
}
