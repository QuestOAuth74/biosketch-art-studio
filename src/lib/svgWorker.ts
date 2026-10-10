// Web Worker for SVG parsing to prevent main thread blocking
// Note: Fabric.js cannot run in Web Worker, so we only validate and preprocess SVG here

const MAX_SVG_SIZE = 1024 * 1024; // 1MB limit
const MAX_COMPLEXITY_SCORE = 1000;

interface SVGParseMessage {
  type: 'parse';
  svgContent: string;
  id: string;
}

interface SVGParseResult {
  type: 'success';
  id: string;
  data: {
    svgContent: string;
    complexity: number;
    simplified: boolean;
    warnings?: string[];
  };
}

// Calculate SVG complexity score
function calculateComplexity(svgContent: string): number {
  let score = 0;
  
  // Count elements that add complexity
  score += (svgContent.match(/<path/g) || []).length * 5;
  score += (svgContent.match(/<polygon/g) || []).length * 3;
  score += (svgContent.match(/<circle/g) || []).length * 1;
  score += (svgContent.match(/<rect/g) || []).length * 1;
  score += (svgContent.match(/<text/g) || []).length * 2;
  score += (svgContent.match(/transform=/g) || []).length * 2;
  score += (svgContent.match(/filter=/g) || []).length * 10;
  
  return score;
}

// Simplify complex SVG by removing unnecessary attributes
function simplifySVG(svgContent: string): string {
  // Find all IDs that are referenced by url() - these must be preserved
  const referencedIds = new Set<string>();
  const urlMatches = svgContent.matchAll(/url\(#([^)]+)\)/g);
  for (const match of urlMatches) {
    referencedIds.add(match[1]);
  }

  // Only remove IDs that are not referenced
  let simplified = svgContent;
  if (referencedIds.size > 0) {
    // Keep IDs that are referenced (for gradients, filters, masks, etc.)
    simplified = simplified.replace(/id="([^"]*)"/g, (match, id) => {
      return referencedIds.has(id) ? match : '';
    });
  } else {
    // No references found, safe to remove all IDs
    simplified = simplified.replace(/id="[^"]*"/g, '');
  }

  return simplified
    // Note: CSS classes are preserved - they often define fill colors
    .replace(/style="[^"]*opacity:\s*0[^"]*"/g, 'style="display:none"') // Hide invisible elements
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

self.onmessage = async (e: MessageEvent<SVGParseMessage>) => {
  const { type, svgContent, id } = e.data;
  
  if (type !== 'parse') return;
  
  try {
    const warnings: string[] = [];
    
    // Check size - WARN but don't block
    if (svgContent.length > MAX_SVG_SIZE) {
      warnings.push(`Very large SVG (${(svgContent.length / 1024).toFixed(0)}KB). Performance may be affected.`);
    } else if (svgContent.length > MAX_SVG_SIZE / 2) {
      warnings.push(`Large SVG (${(svgContent.length / 1024).toFixed(0)}KB). Processing may take a moment.`);
    }
    
    // Check complexity - WARN but don't block
    const complexity = calculateComplexity(svgContent);
    if (complexity > MAX_COMPLEXITY_SCORE) {
      warnings.push(`Very complex SVG (score: ${complexity}). Applying aggressive simplification.`);
    }
    
    // Apply simplification only for very large/complex SVGs (raised threshold to preserve detail)
    const shouldSimplify = complexity > 800 || svgContent.length > MAX_SVG_SIZE;
    const processedSvg = shouldSimplify ? simplifySVG(svgContent) : svgContent;
    
    // ALWAYS return success with warnings
    const result: SVGParseResult = {
      type: 'success',
      id,
      data: {
        svgContent: processedSvg,
        complexity,
        simplified: shouldSimplify,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    };
    
    self.postMessage(result);
  } catch (error) {
    // Even on error, try to return the original SVG with a warning
    const result: SVGParseResult = {
      type: 'success',
      id,
      data: {
        svgContent: svgContent,
        complexity: 0,
        simplified: false,
        warnings: [error instanceof Error ? error.message : 'Failed to process SVG - using original']
      }
    };
    self.postMessage(result);
  }
};
