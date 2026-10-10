import { describe, it, expect } from 'vitest';
import {
  distributeHorizontally,
  distributeVertically,
  matchWidth,
  matchHeight,
  type BoundingBox,
} from '@/lib/alignmentUtils';

describe('Alignment and Distribution', () => {
  describe('distributeHorizontally', () => {
    it('should calculate correct x positions for equal horizontal spacing', () => {
      const objects: BoundingBox[] = [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 100, y: 0, width: 50, height: 50 },
        { x: 200, y: 0, width: 50, height: 50 },
      ];

      const distributed = distributeHorizontally(objects);

      // Objects should be evenly spaced
      // Gap between first and second should equal gap between second and third
      const gap1 = distributed[1].x - (distributed[0].x + distributed[0].width);
      const gap2 = distributed[2].x - (distributed[1].x + distributed[1].width);

      expect(gap1).toBeCloseTo(gap2, 1);

      // First and last objects should remain in same position
      expect(distributed[0].x).toBe(objects[0].x);
      expect(distributed[2].x).toBe(objects[2].x);
    });

    it('should handle objects of different widths', () => {
      const objects: BoundingBox[] = [
        { x: 0, y: 0, width: 30, height: 50 },
        { x: 100, y: 0, width: 80, height: 50 },
        { x: 250, y: 0, width: 40, height: 50 },
      ];

      const distributed = distributeHorizontally(objects);

      // Verify spacing is equal
      const gap1 = distributed[1].x - (distributed[0].x + distributed[0].width);
      const gap2 = distributed[2].x - (distributed[1].x + distributed[1].width);

      expect(gap1).toBeCloseTo(gap2, 1);
    });
  });

  describe('distributeVertically', () => {
    it('should calculate correct y positions for equal vertical spacing', () => {
      const objects: BoundingBox[] = [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 0, y: 100, width: 50, height: 50 },
        { x: 0, y: 200, width: 50, height: 50 },
      ];

      const distributed = distributeVertically(objects);

      // Objects should be evenly spaced
      const gap1 = distributed[1].y - (distributed[0].y + distributed[0].height);
      const gap2 = distributed[2].y - (distributed[1].y + distributed[1].height);

      expect(gap1).toBeCloseTo(gap2, 1);

      // First and last objects should remain in same position
      expect(distributed[0].y).toBe(objects[0].y);
      expect(distributed[2].y).toBe(objects[2].y);
    });

    it('should handle objects of different heights', () => {
      const objects: BoundingBox[] = [
        { x: 0, y: 0, width: 50, height: 30 },
        { x: 0, y: 80, width: 50, height: 70 },
        { x: 0, y: 200, width: 50, height: 40 },
      ];

      const distributed = distributeVertically(objects);

      // Verify spacing is equal
      const gap1 = distributed[1].y - (distributed[0].y + distributed[0].height);
      const gap2 = distributed[2].y - (distributed[1].y + distributed[1].height);

      expect(gap1).toBeCloseTo(gap2, 1);
    });
  });

  describe('matchWidth', () => {
    it('should calculate correct dimensions for matching width', () => {
      const objects: BoundingBox[] = [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 100, y: 0, width: 80, height: 60 },
        { x: 200, y: 0, width: 30, height: 40 },
      ];

      const targetWidth = 100;
      const matched = matchWidth(objects, targetWidth);

      // All objects should now have the target width
      matched.forEach((obj) => {
        expect(obj.width).toBe(targetWidth);
      });

      // Heights should remain unchanged
      expect(matched[0].height).toBe(objects[0].height);
      expect(matched[1].height).toBe(objects[1].height);
      expect(matched[2].height).toBe(objects[2].height);

      // Positions should remain unchanged
      expect(matched[0].x).toBe(objects[0].x);
      expect(matched[1].x).toBe(objects[1].x);
      expect(matched[2].x).toBe(objects[2].x);
    });
  });

  describe('matchHeight', () => {
    it('should calculate correct dimensions for matching height', () => {
      const objects: BoundingBox[] = [
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 100, y: 0, width: 80, height: 70 },
        { x: 200, y: 0, width: 30, height: 40 },
      ];

      const targetHeight = 90;
      const matched = matchHeight(objects, targetHeight);

      // All objects should now have the target height
      matched.forEach((obj) => {
        expect(obj.height).toBe(targetHeight);
      });

      // Widths should remain unchanged
      expect(matched[0].width).toBe(objects[0].width);
      expect(matched[1].width).toBe(objects[1].width);
      expect(matched[2].width).toBe(objects[2].width);

      // Positions should remain unchanged
      expect(matched[0].y).toBe(objects[0].y);
      expect(matched[1].y).toBe(objects[1].y);
      expect(matched[2].y).toBe(objects[2].y);
    });
  });
});
