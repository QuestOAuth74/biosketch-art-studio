import { describe, it, expect } from 'vitest';
import { Circle, Rect, Polygon } from 'fabric';

describe('Crop Calculations', () => {
  describe('Polygon Crop Path', () => {
    it('should produce valid clipPath from polygon points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ];

      const clipPath = new Polygon(points, {
        originX: 'left',
        originY: 'top',
        absolutePositioned: false
      });

      expect(clipPath).toBeDefined();
      expect(clipPath.points).toHaveLength(4);
      expect(clipPath.originX).toBe('left');
      expect(clipPath.originY).toBe('top');
    });
  });

  describe('Aspect Ratio Lock - Circle', () => {
    it('should maintain perfect 1:1 aspect ratio during resize', () => {
      const cropRect = {
        left: 100,
        top: 100,
        width: 200,
        height: 150 // Not 1:1 initially
      };

      // Simulate aspect lock for circle
      const size = Math.min(cropRect.width, cropRect.height);
      const lockedRect = {
        ...cropRect,
        width: size,
        height: size
      };

      expect(lockedRect.width).toBe(lockedRect.height);
      expect(lockedRect.width).toBe(150);
      expect(lockedRect.height).toBe(150);

      // Test during corner resize
      const resizeRect = {
        left: 100,
        top: 100,
        width: 200,
        height: 200
      };

      const deltaX = 50;
      const deltaY = 30;

      // For 1:1 lock, use minimum delta
      const newSize = Math.min(resizeRect.width + deltaX, resizeRect.height + deltaY);
      const resizedRect = {
        left: resizeRect.left,
        top: resizeRect.top,
        width: newSize,
        height: newSize
      };

      expect(resizedRect.width).toBe(resizedRect.height);
      expect(resizedRect.width).toBe(230); // Min of 250 and 230
    });
  });

  describe('Aspect Ratio Lock - Square', () => {
    it('should maintain perfect 1:1 aspect ratio during resize', () => {
      const cropRect = {
        left: 50,
        top: 50,
        width: 300,
        height: 300
      };

      expect(cropRect.width).toBe(cropRect.height);

      // Test resize from corner
      const initialRect = {
        left: 100,
        top: 100,
        width: 200,
        height: 200
      };

      const deltaX = -50;
      const deltaY = -30;

      const newWidth = initialRect.width - deltaX;
      const newHeight = initialRect.height - deltaY;
      const size = Math.min(newWidth, newHeight);

      const resizedRect = {
        left: initialRect.left + initialRect.width - size,
        top: initialRect.top + initialRect.height - size,
        width: size,
        height: size
      };

      expect(resizedRect.width).toBe(resizedRect.height);
      expect(resizedRect.width).toBe(230);
    });
  });
});
