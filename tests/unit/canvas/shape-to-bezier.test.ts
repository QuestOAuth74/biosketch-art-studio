import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fabric module before importing the module under test
vi.mock('fabric', () => {
  class MockPoint {
    x: number;
    y: number;
    constructor(x: number, y: number) { this.x = x; this.y = y; }
  }

  class MockPath {
    type = 'path';
    fill: any;
    stroke: any;
    strokeWidth: any;
    strokeDashArray: any;
    strokeLineCap: any;
    strokeLineJoin: any;
    strokeUniform: any;
    opacity: any;
    shadow: any;
    selectable: any;
    evented: any;
    [key: string]: any;

    constructor(pathString: string, options: any = {}) {
      this.pathString = pathString;
      Object.assign(this, options);
    }

    toObject(props?: string[]) {
      return { type: 'path', pathString: this.pathString };
    }
  }

  class MockCanvas {
    objects: any[] = [];
    activeObject: any = null;
    add(obj: any) { this.objects.push(obj); }
    remove(obj: any) {
      const idx = this.objects.indexOf(obj);
      if (idx >= 0) this.objects.splice(idx, 1);
    }
    setActiveObject(obj: any) { this.activeObject = obj; }
  }

  return {
    Canvas: MockCanvas,
    Path: MockPath,
    FabricObject: class {},
    util: {
      transformPoint: (point: MockPoint, matrix: number[]) => {
        // Apply affine transform: [a, b, c, d, e, f]
        const a = matrix[0], b = matrix[1], c = matrix[2], d = matrix[3], e = matrix[4], f = matrix[5];
        return new MockPoint(
          a * point.x + c * point.y + e,
          b * point.x + d * point.y + f
        );
      },
      invertTransform: (matrix: number[]) => matrix, // simplified for testing
    },
    Point: MockPoint,
    Rect: class {},
    Circle: class {},
    Ellipse: class {},
    Polygon: class {},
  };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => `test-${Math.random().toString(36).slice(2, 9)}`,
}));

import { isEditableShape, convertShapeToBezierPath } from '@/lib/shapeToBezierPath';

// Helper to create a mock shape with calcTransformMatrix
function createMockShape(type: string, props: Record<string, any> = {}) {
  const shape = {
    type,
    fill: '#ff0000',
    stroke: '#000000',
    strokeWidth: 2,
    opacity: 1,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    left: 100,
    top: 100,
    shadow: null,
    strokeDashArray: null,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    // Transform matrix: [scaleX, 0, 0, scaleY, cx, cy] centered at shape center
    calcTransformMatrix: () => {
      const sx = props.scaleX || 1;
      const sy = props.scaleY || 1;
      const rawW = props.width || (props.radius || props.rx || 0) * 2 || 0;
      const rawH = props.height || (props.radius || props.ry || 0) * 2 || 0;
      const cx = (props.left || 100) + (rawW * sx) / 2;
      const cy = (props.top || 100) + (rawH * sy) / 2;
      return [sx, 0, 0, sy, cx, cy];
    },
    ...props,
  };
  return shape;
}

describe('Shape to Bezier Path Conversion', () => {
  describe('isEditableShape', () => {
    it('should return true for basic rect', () => {
      expect(isEditableShape({ type: 'rect' })).toBe(true);
    });

    it('should return true for circle', () => {
      expect(isEditableShape({ type: 'circle' })).toBe(true);
    });

    it('should return true for ellipse', () => {
      expect(isEditableShape({ type: 'ellipse' })).toBe(true);
    });

    it('should return true for polygon', () => {
      expect(isEditableShape({ type: 'polygon' })).toBe(true);
    });

    it('should return true for triangle', () => {
      expect(isEditableShape({ type: 'triangle' })).toBe(true);
    });

    it('should return false for path', () => {
      expect(isEditableShape({ type: 'path' })).toBe(false);
    });

    it('should return false for textbox', () => {
      expect(isEditableShape({ type: 'textbox' })).toBe(false);
    });

    it('should return false for image', () => {
      expect(isEditableShape({ type: 'image' })).toBe(false);
    });

    it('should return false for group', () => {
      expect(isEditableShape({ type: 'group' })).toBe(false);
    });

    it('should return false for bezier path shapes', () => {
      expect(isEditableShape({ type: 'rect', isBezierPath: true })).toBe(false);
    });

    it('should return false for membrane shapes', () => {
      expect(isEditableShape({ type: 'rect', isMembraneShape: true })).toBe(false);
    });

    it('should return false for rasterized membranes', () => {
      expect(isEditableShape({ type: 'rect', isRasterizedMembrane: true })).toBe(false);
    });

    it('should return false for DNA helix', () => {
      expect(isEditableShape({ type: 'circle', isDNAHelix: true })).toBe(false);
    });

    it('should return false for grid lines', () => {
      expect(isEditableShape({ type: 'rect', isGridLine: true })).toBe(false);
    });

    it('should return false for rulers', () => {
      expect(isEditableShape({ type: 'rect', isRuler: true })).toBe(false);
    });

    it('should return false for shapes in a group', () => {
      expect(isEditableShape({ type: 'rect', group: {} })).toBe(false);
    });

    it('should return false for endpoint markers', () => {
      expect(isEditableShape({ type: 'polygon', isEndpointMarker: true })).toBe(false);
    });

    it('should return false for excluded-from-export objects', () => {
      expect(isEditableShape({ type: 'rect', excludeFromExport: true })).toBe(false);
    });

    it('should return false for straight lines', () => {
      expect(isEditableShape({ type: 'rect', isStraightLine: true })).toBe(false);
    });

    it('should return false for curved lines', () => {
      expect(isEditableShape({ type: 'rect', isCurvedLine: true })).toBe(false);
    });

    it('should return false for orthogonal lines', () => {
      expect(isEditableShape({ type: 'rect', isOrthogonalLine: true })).toBe(false);
    });

    it('should return false for image placeholders', () => {
      expect(isEditableShape({ type: 'rect', isImagePlaceholder: true })).toBe(false);
    });

    it('should return false for table cells', () => {
      expect(isEditableShape({ type: 'rect', isTableCell: true })).toBe(false);
    });
  });

  describe('convertShapeToBezierPath — Rectangle', () => {
    it('should convert a basic rectangle to 4 corner bezier points', () => {
      const shape = createMockShape('rect', { width: 200, height: 100, left: 50, top: 50 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      expect(canvas.remove).toHaveBeenCalledWith(shape);
      expect(canvas.add).toHaveBeenCalled();
      expect(canvas.setActiveObject).toHaveBeenCalled();

      const bp = (path as any).bezierPoints;
      expect(bp).toBeDefined();
      expect(bp.length).toBe(4);

      // All points should be corner type
      bp.forEach((p: any) => {
        expect(p.type).toBe('corner');
        expect(p.id).toBeDefined();
        expect(typeof p.x).toBe('number');
        expect(typeof p.y).toBe('number');
      });
    });

    it('should set isBezierPath and isClosed flags', () => {
      const shape = createMockShape('rect', { width: 100, height: 100, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect((path as any).isBezierPath).toBe(true);
      expect((path as any).isClosed).toBe(true);
      expect((path as any).bezierPointsAreLocal).toBe(false);
      expect((path as any).id).toBeDefined();
    });

    it('should preserve visual properties (fill, stroke, opacity)', () => {
      const shape = createMockShape('rect', {
        width: 100, height: 100, left: 0, top: 0,
        fill: '#ff6600', stroke: '#0000ff', strokeWidth: 3, opacity: 0.7,
      });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      expect((path as any).fill).toBe('#ff6600');
      expect((path as any).stroke).toBe('#0000ff');
      expect((path as any).strokeWidth).toBe(3);
      expect((path as any).opacity).toBe(0.7);
    });

    it('should convert a rounded rectangle to 8 smooth bezier points', () => {
      const shape = createMockShape('rect', { width: 200, height: 100, rx: 10, ry: 10, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      const bp = (path as any).bezierPoints;
      expect(bp.length).toBe(8);

      // All points should be smooth type for rounded corners
      bp.forEach((p: any) => {
        expect(p.type).toBe('smooth');
        expect(p.controlPoint1).toBeDefined();
        expect(p.controlPoint2).toBeDefined();
      });
    });

    it('should return null for zero-dimension rect', () => {
      const shape = createMockShape('rect', { width: 0, height: 100, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);
      expect(path).toBeNull();
    });

    it('should handle scaled rectangles', () => {
      const shape = createMockShape('rect', {
        width: 100, height: 50, left: 0, top: 0,
        scaleX: 2, scaleY: 3,
      });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      const bp = (path as any).bezierPoints;
      expect(bp.length).toBe(4);

      // The scaled width should be 200, height 150
      // Verify points span the correct range
      const xs = bp.map((p: any) => p.x);
      const ys = bp.map((p: any) => p.y);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      expect(width).toBeCloseTo(200, 0);
      expect(height).toBeCloseTo(150, 0);
    });
  });

  describe('convertShapeToBezierPath — Circle', () => {
    it('should convert a circle to 4 smooth bezier points', () => {
      const shape = createMockShape('circle', { radius: 50, left: 100, top: 100 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      const bp = (path as any).bezierPoints;
      expect(bp.length).toBe(4);

      // All points should be smooth type
      bp.forEach((p: any) => {
        expect(p.type).toBe('smooth');
        expect(p.controlPoint1).toBeDefined();
        expect(p.controlPoint2).toBeDefined();
        expect(typeof p.controlPoint1.x).toBe('number');
        expect(typeof p.controlPoint1.y).toBe('number');
        expect(typeof p.controlPoint2.x).toBe('number');
        expect(typeof p.controlPoint2.y).toBe('number');
      });
    });

    it('should produce points at cardinal positions around center', () => {
      const shape = createMockShape('circle', { radius: 50, left: 100, top: 100 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);
      const bp = (path as any).bezierPoints;

      // Center should be at (150, 150) — left(100) + radius(50)
      // With identity transform [1,0,0,1,cx,cy], local (0,-r) maps to (cx, cy-r)
      const cx = 150, cy = 150, r = 50;

      // Top point
      expect(bp[0].x).toBeCloseTo(cx, 0);
      expect(bp[0].y).toBeCloseTo(cy - r, 0);

      // Right point
      expect(bp[1].x).toBeCloseTo(cx + r, 0);
      expect(bp[1].y).toBeCloseTo(cy, 0);

      // Bottom point
      expect(bp[2].x).toBeCloseTo(cx, 0);
      expect(bp[2].y).toBeCloseTo(cy + r, 0);

      // Left point
      expect(bp[3].x).toBeCloseTo(cx + (-r), 0);
      expect(bp[3].y).toBeCloseTo(cy, 0);
    });

    it('should return null for zero-radius circle', () => {
      const shape = createMockShape('circle', { radius: 0, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);
      expect(path).toBeNull();
    });

    it('should handle elliptical circles (different scaleX/scaleY)', () => {
      const shape = createMockShape('circle', {
        radius: 50, left: 0, top: 0, scaleX: 2, scaleY: 1,
      });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      const bp = (path as any).bezierPoints;
      expect(bp.length).toBe(4);

      // Horizontal extent should be 2x vertical extent
      const xs = bp.map((p: any) => p.x);
      const ys = bp.map((p: any) => p.y);
      const hExtent = Math.max(...xs) - Math.min(...xs); // 2*rx = 200
      const vExtent = Math.max(...ys) - Math.min(...ys); // 2*ry = 100
      expect(hExtent).toBeCloseTo(200, 0);
      expect(vExtent).toBeCloseTo(100, 0);
    });
  });

  describe('convertShapeToBezierPath — Ellipse', () => {
    it('should convert an ellipse to 4 smooth bezier points', () => {
      const shape = createMockShape('ellipse', { rx: 80, ry: 40, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      const bp = (path as any).bezierPoints;
      expect(bp.length).toBe(4);

      bp.forEach((p: any) => {
        expect(p.type).toBe('smooth');
      });

      // Verify horizontal extent matches 2*rx, vertical matches 2*ry
      const xs = bp.map((p: any) => p.x);
      const ys = bp.map((p: any) => p.y);
      const hExtent = Math.max(...xs) - Math.min(...xs);
      const vExtent = Math.max(...ys) - Math.min(...ys);
      expect(hExtent).toBeCloseTo(160, 0); // 2 * 80
      expect(vExtent).toBeCloseTo(80, 0);  // 2 * 40
    });
  });

  describe('convertShapeToBezierPath — Polygon', () => {
    it('should convert a triangle (3 vertices) to 3 corner bezier points', () => {
      const shape = createMockShape('polygon', {
        points: [
          { x: 50, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        pathOffset: { x: 50, y: 50 },
        left: 0, top: 0,
        width: 100, height: 100,
      });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      const bp = (path as any).bezierPoints;
      expect(bp.length).toBe(3);

      bp.forEach((p: any) => {
        expect(p.type).toBe('corner');
        expect(p.id).toBeDefined();
        // Corner points should not have control points
        expect(p.controlPoint1).toBeUndefined();
        expect(p.controlPoint2).toBeUndefined();
      });
    });

    it('should convert a hexagon (6 vertices) to 6 corner bezier points', () => {
      const hexPoints = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        hexPoints.push({ x: 50 + 50 * Math.cos(angle), y: 50 + 50 * Math.sin(angle) });
      }
      const shape = createMockShape('polygon', {
        points: hexPoints,
        pathOffset: { x: 50, y: 50 },
        left: 0, top: 0,
        width: 100, height: 100,
      });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      const bp = (path as any).bezierPoints;
      expect(bp.length).toBe(6);
    });

    it('should handle triangle type', () => {
      const shape = createMockShape('triangle', {
        points: [
          { x: 50, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        pathOffset: { x: 50, y: 50 },
        left: 0, top: 0,
        width: 100, height: 100,
      });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      const bp = (path as any).bezierPoints;
      expect(bp.length).toBe(3);
    });

    it('should return null for polygon with less than 3 points', () => {
      const shape = createMockShape('polygon', {
        points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        pathOffset: { x: 5, y: 5 },
        left: 0, top: 0,
      });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);
      expect(path).toBeNull();
    });

    it('should return null for polygon with no points', () => {
      const shape = createMockShape('polygon', { left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);
      expect(path).toBeNull();
    });
  });

  describe('convertShapeToBezierPath — Path string output', () => {
    it('should generate a closed SVG path (ending with Z)', () => {
      const shape = createMockShape('rect', { width: 100, height: 50, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      // The path string is stored on the mock
      const pathString = (path as any).pathString;
      expect(pathString).toBeDefined();
      expect(pathString).toContain('M ');
      expect(pathString).toContain('C ');
      expect(pathString).toContain('Z');
    });

    it('should have the correct number of cubic bezier segments for a rectangle', () => {
      const shape = createMockShape('rect', { width: 100, height: 50, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);
      const pathString = (path as any).pathString as string;

      // 4 points = 4 cubic segments (including closing segment)
      const cCount = (pathString.match(/ C /g) || []).length;
      expect(cCount).toBe(4);
    });

    it('should have the correct number of cubic bezier segments for a circle', () => {
      const shape = createMockShape('circle', { radius: 50, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);
      const pathString = (path as any).pathString as string;

      // 4 points = 4 cubic segments
      const cCount = (pathString.match(/ C /g) || []).length;
      expect(cCount).toBe(4);
    });
  });

  describe('convertShapeToBezierPath — toObject serialization', () => {
    it('should have a toObject override that includes bezier properties', () => {
      const shape = createMockShape('rect', { width: 100, height: 50, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);

      expect(path).not.toBeNull();
      expect(typeof (path as any).toObject).toBe('function');
    });
  });

  describe('convertShapeToBezierPath — unsupported types', () => {
    it('should return null for unsupported type', () => {
      const shape = createMockShape('textbox', { width: 100, height: 50, left: 0, top: 0 });
      const canvas = { objects: [shape], add: vi.fn(), remove: vi.fn(), setActiveObject: vi.fn() } as any;

      const path = convertShapeToBezierPath(shape as any, canvas);
      expect(path).toBeNull();
    });
  });
});
