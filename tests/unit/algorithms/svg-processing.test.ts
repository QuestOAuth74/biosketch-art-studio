/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSVG, calculateSVGComplexity, minifySVG } from '@/lib/svgProcessor';

describe('SVG Processing', () => {
  describe('sanitizeSVG', () => {
    it('should add default fill attribute when missing', () => {
      const svgWithoutFill = '<svg><path d="M10 10 L20 20"/></svg>';

      const sanitized = sanitizeSVG(svgWithoutFill);

      // Should add default fill attribute to path elements
      expect(sanitized).toContain('fill=');
      // Default fill should be black or currentColor
      expect(sanitized).toMatch(/fill="(#000000|black|currentColor)"/);
    });

    it('should replace currentColor references with explicit color values', () => {
      const svgWithCurrentColor = '<svg><path d="M10 10" fill="currentColor"/></svg>';

      const sanitized = sanitizeSVG(svgWithCurrentColor);

      // Should replace currentColor with explicit color (e.g., black)
      expect(sanitized).not.toContain('currentColor');
      expect(sanitized).toMatch(/fill="(#000000|black)"/);
    });

    it('should preserve existing fill colors', () => {
      const svgWithColor = '<svg><path d="M10 10" fill="#ff0000"/></svg>';

      const sanitized = sanitizeSVG(svgWithColor);

      // Should preserve the red fill
      expect(sanitized).toContain('fill="#ff0000"');
    });

    it('should handle multiple elements', () => {
      const svgMultiple = `<svg>
        <path d="M10 10" fill="currentColor"/>
        <circle cx="50" cy="50" r="20"/>
        <rect x="0" y="0" width="100" height="100" fill="blue"/>
      </svg>`;

      const sanitized = sanitizeSVG(svgMultiple);

      // Should replace currentColor in path
      expect(sanitized).not.toContain('currentColor');
      // Should add fill to circle
      expect(sanitized).toMatch(/<circle[^>]+fill=/);
      // Should preserve blue fill on rect
      expect(sanitized).toContain('fill="blue"');
    });
  });

  describe('calculateSVGComplexity', () => {
    it('should calculate complexity score correctly for simple SVG', () => {
      const simpleSVG = '<svg><circle cx="50" cy="50" r="20"/></svg>';

      const complexity = calculateSVGComplexity(simpleSVG);

      // Simple SVG should have low complexity
      expect(complexity).toBeGreaterThanOrEqual(0);
      expect(complexity).toBeLessThan(30);
    });

    it('should calculate higher complexity for SVG with many elements', () => {
      const complexSVG = `<svg>
        <path d="M10 10 C 20 20, 40 20, 50 10"/>
        <path d="M60 10 L 70 20 L 80 10"/>
        <circle cx="100" cy="50" r="10"/>
        <rect x="120" y="40" width="20" height="20"/>
        <ellipse cx="160" cy="50" rx="15" ry="10"/>
        <polygon points="200,10 220,50 180,50"/>
        <g>
          <path d="M250 10 Q 260 50 270 10"/>
          <path d="M280 10 Q 290 50 300 10"/>
        </g>
      </svg>`;

      const complexity = calculateSVGComplexity(complexSVG);

      // Complex SVG should have higher complexity
      expect(complexity).toBeGreaterThan(30);
      expect(complexity).toBeLessThanOrEqual(100);
    });

    it('should consider path complexity in score', () => {
      const simplePath = '<svg><path d="M10 10 L20 20"/></svg>';
      const complexPath = '<svg><path d="M10 10 C 20 20, 40 20, 50 10 Q 60 30 70 10 S 80 20 90 10"/></svg>';

      const simpleComplexity = calculateSVGComplexity(simplePath);
      const complexComplexity = calculateSVGComplexity(complexPath);

      // Complex path should have higher complexity than simple path
      expect(complexComplexity).toBeGreaterThan(simpleComplexity);
    });

    it('should return score within valid range (0-100)', () => {
      const emptySVG = '<svg></svg>';
      const hugeSVG = '<svg>' + '<circle cx="50" cy="50" r="20"/>'.repeat(100) + '</svg>';

      const emptyComplexity = calculateSVGComplexity(emptySVG);
      const hugeComplexity = calculateSVGComplexity(hugeSVG);

      // All scores should be within 0-100 range
      expect(emptyComplexity).toBeGreaterThanOrEqual(0);
      expect(emptyComplexity).toBeLessThanOrEqual(100);
      expect(hugeComplexity).toBeGreaterThanOrEqual(0);
      expect(hugeComplexity).toBeLessThanOrEqual(100);
    });
  });

  describe('minifySVG', () => {
    it('should reduce file size by removing whitespace', () => {
      const svgWithWhitespace = `<svg>
        <path d="M 10 10 L 20 20" />
        <circle cx="50" cy="50" r="20" />
      </svg>`;

      const minified = minifySVG(svgWithWhitespace);

      // Minified version should be shorter
      expect(minified.length).toBeLessThan(svgWithWhitespace.length);

      // Should still be valid SVG
      expect(minified).toContain('<svg>');
      expect(minified).toContain('</svg>');
      expect(minified).toContain('<path');
      expect(minified).toContain('<circle');
    });

    it('should remove comments', () => {
      const svgWithComments = `<svg>
        <!-- This is a comment -->
        <path d="M10 10"/>
        <!-- Another comment -->
      </svg>`;

      const minified = minifySVG(svgWithComments);

      // Should not contain comments
      expect(minified).not.toContain('<!--');
      expect(minified).not.toContain('-->');
      expect(minified).not.toContain('This is a comment');

      // Should still contain the path
      expect(minified).toContain('<path');
    });

    it('should preserve essential attributes and structure', () => {
      const svgOriginal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M10 10 L20 20" fill="#ff0000" stroke="#000000" stroke-width="2"/>
      </svg>`;

      const minified = minifySVG(svgOriginal);

      // Should preserve xmlns
      expect(minified).toContain('xmlns=');

      // Should preserve viewBox
      expect(minified).toContain('viewBox=');

      // Should preserve path attributes
      expect(minified).toContain('d="M10 10 L20 20"');
      expect(minified).toContain('fill="#ff0000"');
      expect(minified).toContain('stroke="#000000"');
      expect(minified).toContain('stroke-width="2"');
    });

    it('should handle already minified SVG', () => {
      const alreadyMinified = '<svg><path d="M10 10"/></svg>';

      const minified = minifySVG(alreadyMinified);

      // Should not corrupt already minified SVG
      expect(minified).toContain('<svg>');
      expect(minified).toContain('</svg>');
      expect(minified).toContain('<path d="M10 10"');

      // Length should be similar (or same)
      expect(minified.length).toBeLessThanOrEqual(alreadyMinified.length + 5);
    });
  });
});
