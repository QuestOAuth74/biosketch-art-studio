import { describe, it, expect } from 'vitest';
import { lineIntersection, type LineSegment, type Point } from '@/lib/lineIntersection';
import { createJumpArc } from '@/lib/jumpArcPath';
import { simplifyPath } from '@/lib/pathSimplification';
import { curveFitting, type BezierCurve } from '@/lib/curveFitting';

describe('Path Operations', () => {
  describe('lineIntersection', () => {
    it('should return correct crossing point for intersecting lines', () => {
      const line1: LineSegment = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const line2: LineSegment = { x1: 0, y1: 10, x2: 10, y2: 0 };

      const intersection = lineIntersection(line1, line2);

      expect(intersection).not.toBeNull();
      expect(intersection?.x).toBeCloseTo(5, 1);
      expect(intersection?.y).toBeCloseTo(5, 1);
    });

    it('should return null for parallel lines', () => {
      const line1: LineSegment = { x1: 0, y1: 0, x2: 10, y2: 0 };
      const line2: LineSegment = { x1: 0, y1: 5, x2: 10, y2: 5 };

      const intersection = lineIntersection(line1, line2);

      expect(intersection).toBeNull();
    });

    it('should return null for non-intersecting lines', () => {
      const line1: LineSegment = { x1: 0, y1: 0, x2: 5, y2: 5 };
      const line2: LineSegment = { x1: 10, y1: 10, x2: 15, y2: 15 };

      const intersection = lineIntersection(line1, line2);

      expect(intersection).toBeNull();
    });
  });

  describe('createJumpArc', () => {
    it('should produce valid SVG path string for jump arc', () => {
      const startPoint: Point = { x: 0, y: 10 };
      const endPoint: Point = { x: 20, y: 10 };
      const arcHeight = 5;

      const pathString = createJumpArc(startPoint, endPoint, arcHeight);

      // Verify it's a valid SVG path string
      expect(pathString).toMatch(/^M\s*[\d.]+\s*[\d.]+/); // Starts with M (moveto)
      expect(pathString).toContain('Q'); // Contains Q (quadratic curve) or C (cubic curve)

      // Verify the path starts and ends at correct points
      expect(pathString).toContain('M 0 10'); // Starts at startPoint
      expect(pathString).toMatch(/[\d.]+\s+10$/); // Ends at y=10 (endPoint.y)
    });

    it('should create higher arc for larger arcHeight values', () => {
      const startPoint: Point = { x: 0, y: 10 };
      const endPoint: Point = { x: 20, y: 10 };

      const arc5 = createJumpArc(startPoint, endPoint, 5);
      const arc10 = createJumpArc(startPoint, endPoint, 10);

      // Both should be valid paths
      expect(arc5).toMatch(/^M/);
      expect(arc10).toMatch(/^M/);

      // Arc with height 10 should have different control points than height 5
      expect(arc5).not.toBe(arc10);
    });
  });

  describe('simplifyPath', () => {
    it('should reduce point count within tolerance', () => {
      // Create a path with many points that are nearly collinear
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0.1 },
        { x: 2, y: 0.2 },
        { x: 3, y: 0.1 },
        { x: 4, y: 0 },
        { x: 5, y: 0.1 },
        { x: 6, y: 0.2 },
        { x: 7, y: 0.1 },
        { x: 8, y: 0 },
        { x: 9, y: 0.1 },
        { x: 10, y: 0 },
      ];

      const tolerance = 0.5;
      const simplified = simplifyPath(points, tolerance);

      // Simplified path should have fewer points
      expect(simplified.length).toBeLessThan(points.length);

      // Simplified path should still start and end at same points
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should preserve important points with tight tolerance', () => {
      // Create a path with a sharp turn
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 5 },
      ];

      const tolerance = 0.1;
      const simplified = simplifyPath(points, tolerance);

      // With tight tolerance, should preserve all key points
      expect(simplified.length).toBeGreaterThanOrEqual(3);

      // Should preserve start and end
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });
  });

  describe('curveFitting', () => {
    it('should return Bezier curves for freehand points', () => {
      // Create array of freehand points (simulating hand-drawn curve)
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: 8 },
        { x: 30, y: 10 },
        { x: 40, y: 11 },
        { x: 50, y: 10 },
        { x: 60, y: 8 },
        { x: 70, y: 5 },
        { x: 80, y: 0 },
      ];

      const tolerance = 2.0;
      const curves = curveFitting(points, tolerance);

      // Verify curves produced
      expect(curves.length).toBeGreaterThan(0);

      // Verify fewer control points than input points (smoothing)
      const totalControlPoints = curves.length * 2; // Each cubic bezier has 2 control points
      expect(totalControlPoints).toBeLessThan(points.length);

      // Verify first curve starts at first point
      expect(curves[0].start.x).toBeCloseTo(points[0].x, 1);
      expect(curves[0].start.y).toBeCloseTo(points[0].y, 1);

      // Verify last curve ends at last point
      const lastCurve = curves[curves.length - 1];
      expect(lastCurve.end.x).toBeCloseTo(points[points.length - 1].x, 1);
      expect(lastCurve.end.y).toBeCloseTo(points[points.length - 1].y, 1);
    });

    it('should produce smooth curves within tolerance', () => {
      // Create points that form a gentle arc
      const points: Point[] = Array.from({ length: 20 }, (_, i) => ({
        x: i * 5,
        y: Math.sin(i * 0.3) * 20 + 50,
      }));

      const tolerance = 1.0;
      const curves = curveFitting(points, tolerance);

      // Verify all original points are within tolerance of fitted curve
      points.forEach((point) => {
        // Calculate distance from point to nearest curve
        const minDistance = curves.reduce((min, curve) => {
          const dist = distanceToQuadraticBezier(point, curve);
          return Math.min(min, dist);
        }, Infinity);

        expect(minDistance).toBeLessThanOrEqual(tolerance);
      });
    });

    it('should handle straight line input', () => {
      // Create perfectly straight line
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 25, y: 0 },
        { x: 50, y: 0 },
        { x: 75, y: 0 },
        { x: 100, y: 0 },
      ];

      const curves = curveFitting(points, 1.0);

      // Should produce minimal curves (ideally 1 straight line)
      expect(curves.length).toBeLessThanOrEqual(2);
    });

    it('should handle sharp corners with tight tolerance', () => {
      // Create path with sharp turn
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 }, // Sharp 90° turn
        { x: 100, y: 50 },
      ];

      const tolerance = 0.5; // Tight tolerance
      const curves = curveFitting(points, tolerance);

      // Should preserve corner with more curves
      expect(curves.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// Helper function for testing
function distanceToQuadraticBezier(point: Point, curve: BezierCurve): number {
  // Simplified: sample curve at multiple points and find minimum distance
  let minDist = Infinity;
  for (let t = 0; t <= 1; t += 0.1) {
    const curvePoint = evaluateBezier(curve, t);
    const dist = Math.sqrt(
      Math.pow(point.x - curvePoint.x, 2) + Math.pow(point.y - curvePoint.y, 2)
    );
    minDist = Math.min(minDist, dist);
  }
  return minDist;
}

function evaluateBezier(curve: BezierCurve, t: number): Point {
  // Cubic Bezier evaluation: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
  const t1 = 1 - t;
  const t1_2 = t1 * t1;
  const t1_3 = t1_2 * t1;
  const t_2 = t * t;
  const t_3 = t_2 * t;

  return {
    x:
      t1_3 * curve.start.x +
      3 * t1_2 * t * curve.cp1.x +
      3 * t1 * t_2 * curve.cp2.x +
      t_3 * curve.end.x,
    y:
      t1_3 * curve.start.y +
      3 * t1_2 * t * curve.cp1.y +
      3 * t1 * t_2 * curve.cp2.y +
      t_3 * curve.end.y,
  };
}
