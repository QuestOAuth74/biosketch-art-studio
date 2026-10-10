/**
 * SVG Processing Utilities
 * Validates, cleans, and optimizes SVG content for icon usage
 */

export interface SVGValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates SVG content for icon usage
 * Checks for embedded rasters, basic structure, and XML validity
 */
export function validateSVG(svgContent: string): SVGValidationResult {
  const errors: string[] = [];
  
  // Check for embedded raster images (not true vector)
  if (svgContent.includes('<image')) {
    errors.push('Contains embedded raster image - not pure vector');
  }
  
  // Check for basic SVG structure
  if (!svgContent.includes('<svg')) {
    errors.push('Missing SVG root element');
  }
  
  // Check for closing tag
  if (!svgContent.includes('</svg>')) {
    errors.push('Missing SVG closing tag');
  }
  
  // Parse and validate XML
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      errors.push('Invalid SVG syntax - XML parse error');
    }
  } catch (e) {
    errors.push('Failed to parse SVG as XML');
  }
  
  // Check for minimum content (should have paths, shapes, or text)
  const hasContent = svgContent.match(/<(path|rect|circle|ellipse|polygon|polyline|line|text|g)\s/);
  if (!hasContent) {
    errors.push('SVG appears empty - no drawable elements found');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Cleans up SVG content by removing unnecessary attributes and normalizing structure.
 * Preserves IDs that are referenced by url(#...) or href="#..." elsewhere in the SVG,
 * since stripping those breaks gradients, clip-paths, masks, and filters.
 */
export function cleanupSVG(svgContent: string): string {
  let cleaned = svgContent.trim();

  // Ensure viewBox exists (standardize to 512x512 for icons)
  if (!cleaned.includes('viewBox')) {
    cleaned = cleaned.replace(
      /<svg([^>]*)>/,
      '<svg$1 viewBox="0 0 512 512">'
    );
  }

  // Remove markdown code fences if present
  cleaned = cleaned.replace(/```svg?\n?/g, '').replace(/```\n?/g, '');

  // Collect all IDs that are referenced via url(#id) or href="#id" or xlink:href="#id"
  const referencedIds = new Set<string>();
  const urlRefs = cleaned.matchAll(/url\(#([^)]+)\)/g);
  for (const m of urlRefs) referencedIds.add(m[1]);
  const hrefRefs = cleaned.matchAll(/(?:xlink:)?href="#([^"]+)"/g);
  for (const m of hrefRefs) referencedIds.add(m[1]);

  // Remove only unreferenced id attributes (decorative IDs from editors)
  cleaned = cleaned.replace(/\sid="([^"]*)"/g, (match, id) => {
    return referencedIds.has(id) ? match : '';
  });

  // Remove empty class attributes
  cleaned = cleaned.replace(/\sclass=""/g, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Optimizes SVG for icon usage by ensuring proper dimensions and structure
 */
export function optimizeSVGForIcon(svgContent: string): string {
  let optimized = svgContent;
  
  // Add xmlns if missing (required for standalone SVG)
  if (!optimized.includes('xmlns=')) {
    optimized = optimized.replace(
      /<svg/,
      '<svg xmlns="http://www.w3.org/2000/svg"'
    );
  }
  
  // Ensure consistent dimensions (512x512 for icon library)
  optimized = optimized
    .replace(/width="[^"]*"/g, 'width="512"')
    .replace(/height="[^"]*"/g, 'height="512"');
  
  // If no width/height attributes, add them
  if (!optimized.includes('width=')) {
    optimized = optimized.replace(
      /<svg([^>]*)/,
      '<svg$1 width="512" height="512"'
    );
  }

  // Ensure geometric precision for crisp curves at any scale
  if (!optimized.includes('shape-rendering')) {
    optimized = optimized.replace(
      /<svg/,
      '<svg shape-rendering="geometricPrecision"'
    );
  }

  return optimized;
}

/**
 * Extracts SVG content from AI response that might include markdown or extra text
 */
export function extractSVG(content: string): string | null {
  // Try to match SVG tags
  const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    return svgMatch[0];
  }
  
  // No SVG found
  return null;
}

/**
 * Complete SVG processing pipeline: extract, clean, validate, and optimize
 */
export function processSVG(rawContent: string): { success: boolean; svg?: string; error?: string } {
  // Extract SVG from potential markdown/text wrapper
  const extracted = extractSVG(rawContent);
  if (!extracted) {
    return { success: false, error: 'No SVG content found in response' };
  }

  // Clean up the SVG
  const cleaned = cleanupSVG(extracted);

  // Validate
  const validation = validateSVG(cleaned);
  if (!validation.valid) {
    return {
      success: false,
      error: `SVG validation failed: ${validation.errors.join(', ')}`
    };
  }

  // Optimize for icon usage
  const optimized = optimizeSVGForIcon(cleaned);

  return { success: true, svg: optimized };
}

/**
 * Sanitize SVG to ensure proper rendering
 * Adds default fill attribute when missing, replaces currentColor references
 * @param svgString Raw SVG string
 * @returns Sanitized SVG string
 */
export function sanitizeSVG(svgString: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');

    if (!svg) {
      return svgString;
    }

    // Default fill color for icons
    const DEFAULT_FILL = '#000000';
    const DEFAULT_STROKE = 'none';

    // Get root fill/stroke to use as fallback
    let rootFill = svg.getAttribute('fill') || DEFAULT_FILL;
    let rootStroke = svg.getAttribute('stroke') || DEFAULT_STROKE;

    // Replace currentColor in root
    if (rootFill === 'currentColor') {
      rootFill = DEFAULT_FILL;
      svg.setAttribute('fill', rootFill);
    }
    if (rootStroke === 'currentColor') {
      rootStroke = DEFAULT_STROKE;
      svg.setAttribute('stroke', rootStroke);
    }

    // Elements that can have fill/stroke attributes
    const fillableElements = svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line, text, g');

    fillableElements.forEach((element) => {
      const el = element as SVGElement;

      // Handle fill attribute
      let fill = el.getAttribute('fill');
      const hasFillNone = fill === 'none';

      if (!fill && !hasFillNone) {
        // No fill specified - check if parent has fill
        let parentFill = rootFill;
        let parent = el.parentElement;
        while (parent && parent !== svg) {
          const pFill = parent.getAttribute('fill');
          if (pFill && pFill !== 'currentColor') {
            parentFill = pFill;
            break;
          }
          parent = parent.parentElement;
        }

        // Only set default fill if element is a shape (not a group)
        if (el.tagName.toLowerCase() !== 'g') {
          el.setAttribute('fill', parentFill);
        }
      } else if (fill === 'currentColor') {
        // Replace currentColor with default or inherited color
        el.setAttribute('fill', rootFill);
      } else if (fill && fill.includes('currentColor')) {
        // Handle currentColor in gradients or other contexts
        el.setAttribute('fill', fill.replace(/currentColor/g, rootFill));
      }

      // Handle stroke attribute
      let stroke = el.getAttribute('stroke');
      if (stroke === 'currentColor') {
        el.setAttribute('stroke', rootStroke);
      } else if (stroke && stroke.includes('currentColor')) {
        el.setAttribute('stroke', stroke.replace(/currentColor/g, rootStroke));
      }

      // Handle fill and stroke in style attribute
      const style = el.getAttribute('style');
      if (style) {
        let newStyle = style;

        // Replace currentColor in fill style
        if (newStyle.includes('fill:currentColor') || newStyle.includes('fill: currentColor')) {
          newStyle = newStyle.replace(/fill:\s*currentColor/g, `fill:${rootFill}`);
        }

        // Replace currentColor in stroke style
        if (newStyle.includes('stroke:currentColor') || newStyle.includes('stroke: currentColor')) {
          newStyle = newStyle.replace(/stroke:\s*currentColor/g, `stroke:${rootStroke}`);
        }

        // Add default fill if missing in style and no fill attribute
        if (!newStyle.includes('fill:') && !newStyle.includes('fill ') && !el.hasAttribute('fill') && el.tagName.toLowerCase() !== 'g') {
          newStyle += `;fill:${rootFill}`;
        }

        if (newStyle !== style) {
          el.setAttribute('style', newStyle);
        }
      }
    });

    // Handle stops in gradients (they also can have currentColor)
    const stops = svg.querySelectorAll('stop');
    stops.forEach((stop) => {
      const stopColor = stop.getAttribute('stop-color');
      if (stopColor === 'currentColor') {
        stop.setAttribute('stop-color', rootFill);
      }
    });

    // Serialize back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  } catch (error) {
    console.error('Error sanitizing SVG:', error);
    // Return original if sanitization fails
    return svgString;
  }
}

/**
 * Calculate SVG complexity score based on element count, path complexity, etc.
 * @param svgString SVG string
 * @returns Complexity score (0-100, higher = more complex)
 */
export function calculateSVGComplexity(svgString: string): number {
  try {
    let score = 0;

    // Count different types of elements (weight: 5 points per element, max 40)
    const elementTypes = ['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'text', 'g'];
    let elementCount = 0;

    elementTypes.forEach(tag => {
      const matches = svgString.match(new RegExp(`<${tag}[\\s>]`, 'gi'));
      elementCount += matches ? matches.length : 0;
    });

    score += Math.min(elementCount * 5, 40);

    // Count path commands for complexity (weight: based on command types)
    const pathMatches = svgString.match(/\sd="([^"]*)"/gi);
    if (pathMatches) {
      let pathComplexity = 0;

      pathMatches.forEach(pathAttr => {
        // Cubic bezier curves (C, S) - most complex
        const cubicMatches = pathAttr.match(/[CS]/gi);
        pathComplexity += (cubicMatches ? cubicMatches.length : 0) * 3;

        // Quadratic curves (Q, T) - moderately complex
        const quadMatches = pathAttr.match(/[QT]/gi);
        pathComplexity += (quadMatches ? quadMatches.length : 0) * 2;

        // Arcs (A) - complex
        const arcMatches = pathAttr.match(/[A]/gi);
        pathComplexity += (arcMatches ? arcMatches.length : 0) * 2.5;

        // Lines (L, H, V) - simple
        const lineMatches = pathAttr.match(/[LHV]/gi);
        pathComplexity += (lineMatches ? lineMatches.length : 0) * 0.5;
      });

      // Cap path complexity contribution at 40 points
      score += Math.min(pathComplexity, 40);
    }

    // Count groups (nested structures add complexity, max 10 points)
    const groupMatches = svgString.match(/<g[\s>]/gi);
    const groupCount = groupMatches ? groupMatches.length : 0;
    score += Math.min(groupCount * 2, 10);

    // Count transforms (add complexity, max 10 points)
    const transformMatches = svgString.match(/transform=/gi);
    const transformCount = transformMatches ? transformMatches.length : 0;
    score += Math.min(transformCount * 2, 10);

    // Normalize to 0-100 range
    return Math.min(Math.round(score), 100);
  } catch (error) {
    console.error('Error calculating SVG complexity:', error);
    return 0;
  }
}

/**
 * Minify SVG by removing unnecessary whitespace, comments, etc.
 * @param svgString SVG string
 * @returns Minified SVG string
 */
export function minifySVG(svgString: string): string {
  try {
    let minified = svgString;

    // Remove XML declaration (not needed for embedded SVG and can cause parsing errors)
    minified = minified.replace(/<\?xml[^?]*\?>\s*/gi, '');

    // Debug logging
    if (minified.includes('<?xml')) {
      console.warn('⚠️ XML declaration still present after removal attempt');
    }

    // Remove XML comments
    minified = minified.replace(/<!--[\s\S]*?-->/g, '');

    // Remove metadata tags (common in exported SVGs)
    minified = minified.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');

    // Remove title tags (not needed for icons)
    minified = minified.replace(/<title[\s\S]*?<\/title>/gi, '');

    // Remove desc tags (descriptions not needed for icons)
    minified = minified.replace(/<desc[\s\S]*?<\/desc>/gi, '');

    // Remove editor-specific tags (Inkscape, Illustrator, etc.)
    minified = minified.replace(/<sodipodi:[^>]*>/gi, '');
    minified = minified.replace(/<inkscape:[^>]*>/gi, '');
    minified = minified.replace(/<i:[^>]*>/gi, '');

    // Remove unnecessary namespace declarations
    minified = minified.replace(/\s+xmlns:sodipodi="[^"]*"/gi, '');
    minified = minified.replace(/\s+xmlns:inkscape="[^"]*"/gi, '');
    minified = minified.replace(/\s+xmlns:i="[^"]*"/gi, '');  // Adobe Illustrator
    minified = minified.replace(/\s+xmlns:sketch="[^"]*"/gi, '');
    minified = minified.replace(/\s+xmlns:dc="[^"]*"/gi, '');
    minified = minified.replace(/\s+xmlns:cc="[^"]*"/gi, '');
    minified = minified.replace(/\s+xmlns:rdf="[^"]*"/gi, '');
    minified = minified.replace(/\s+xmlns:x="[^"]*"/gi, '');  // Adobe specific

    // Remove editor-specific attributes
    minified = minified.replace(/\s+sodipodi:[a-z-]+=["'][^"']*["']/gi, '');
    minified = minified.replace(/\s+inkscape:[a-z-]+=["'][^"']*["']/gi, '');
    minified = minified.replace(/\s+sketch:[a-z-]+=["'][^"']*["']/gi, '');
    minified = minified.replace(/\s+i:[a-z-]+=["'][^"']*["']/gi, '');  // Adobe Illustrator attributes

    // Simplify number precision (reduce decimal places to 4 — enough for smooth curves at any zoom)
    minified = minified.replace(/(\d+\.\d{5,})/g, (match) => {
      return parseFloat(match).toFixed(4);
    });

    // Remove trailing zeros after decimal point
    minified = minified.replace(/(\d+\.\d*?)0+(\D)/g, '$1$2');

    // Remove unnecessary decimal points (e.g., "1.0" -> "1")
    minified = minified.replace(/(\d+)\.0+(\D)/g, '$1$2');

    // Collapse multiple spaces into single space
    minified = minified.replace(/\s+/g, ' ');

    // Remove spaces around tag brackets and equals signs (but NOT quotes to preserve attribute spacing)
    minified = minified.replace(/\s*([<>])\s*/g, '$1');  // Only < and >
    minified = minified.replace(/\s*=\s*/g, '=');  // Only = signs

    // Remove space after opening tags and before closing tags
    minified = minified.replace(/>\s+</g, '><');

    // Trim leading/trailing whitespace
    minified = minified.trim();

    // Remove empty attributes
    minified = minified.replace(/\s+[a-z-]+=""\s*/gi, ' ');

    // Remove duplicate spaces that might have been created
    minified = minified.replace(/\s{2,}/g, ' ');

    // Debug logging - show first 200 chars of minified SVG

    return minified;
  } catch (error) {
    console.error('Error minifying SVG:', error);
    // Return original if minification fails
    return svgString;
  }
}
