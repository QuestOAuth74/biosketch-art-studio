/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Canvas as FabricCanvas, Path } from 'fabric';
import { findOrthogonalPath } from '@/lib/pathfinding';
import { convertToCurvedLine, canConvertTo } from '@/lib/lineTypeConverter';
import { getLineEndpoints, applyEndpointMarkers } from '@/lib/lineEndpointRenderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock canvas whose forEachObject yields only the provided obstacle stubs. */
function makeMockCanvas(
  obstacles: Array<{ left: number; top: number; width: number; height: number }>,
  width = 1000,
  height = 1000,
): any {
  return {
    width,
    height,
    forEachObject(cb: (obj: any) => void) {
      obstacles.forEach(obs =>
        cb({ type: 'rect', getBoundingRect: () => obs }),
      );
    },
  };
}

/** Create a plain object that looks like a straight line to the line tools. */
function makeStraightLineObj(
  id: string,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): any {
  const pathData = `M ${sx} ${sy} L ${ex} ${ey}`;
  const linePath = new Path(pathData) as any;
  linePath.isStraightLine = true;
  linePath.id = id;
  linePath.straightLineStart = { x: sx, y: sy };
  linePath.straightLineEnd = { x: ex, y: ey };
  linePath.startMarkerType = 'none';
  linePath.endMarkerType = 'none';
  return linePath;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Line Tools', () => {
  let canvas: FabricCanvas;

  beforeEach(() => {
    const canvasEl = document.createElement('canvas');
    canvas = new FabricCanvas(canvasEl);
  });

  // -------------------------------------------------------------------------
  // Pathfinding Algorithm
  // -------------------------------------------------------------------------

  describe('Pathfinding Algorithm', () => {
    /**
     * Grid size is 20 px by default.  Using start/end that are multiples of 20
     * ensures the grid-cell coords round-trip cleanly, so every segment between
     * consecutive path points is guaranteed to be axis-aligned.
     *
     * Obstacle: left=140, top=100, width=100, height=200
     *   → with 10 px padding covers x: 130-250, y: 90-310
     *   → blocks grid cells x=7..12, y=4..15  (all on the y=10 row)
     *
     * A* must navigate above/below the obstacle and return an L-shaped or
     * U-shaped path with more than 2 waypoints.
     */
    it('calculates route that avoids obstacles using 90-degree segments', () => {
      const mockCanvas = makeMockCanvas(
        [{ left: 140, top: 100, width: 100, height: 200 }],
        600,
        600,
      );

      // Grid-aligned start (3,10) and end (20,10) – same row, obstacle in between
      const start = { x: 60, y: 200 };
      const end = { x: 400, y: 200 };

      const path = findOrthogonalPath(mockCanvas, start, end);

      // Must be more than two points – the path goes around the obstacle
      expect(path.length).toBeGreaterThan(2);

      // Preserves exact start and end
      expect(path[0]).toEqual(start);
      expect(path[path.length - 1]).toEqual(end);

      // Every segment must be strictly horizontal OR strictly vertical
      for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x;
        const dy = path[i].y - path[i - 1].y;
        expect(dx === 0 || dy === 0).toBe(true);
      }
    });

    /**
     * With no obstacles and grid-aligned horizontal endpoints, A* finds a
     * straight horizontal run.  simplifyPath() collapses all collinear
     * intermediate points leaving exactly two points.
     */
    it('returns direct orthogonal route when no obstacles present', () => {
      const mockCanvas = makeMockCanvas([], 1000, 1000);

      // Same-row, grid-aligned: (3,10) → (20,10)
      const start = { x: 60, y: 200 };
      const end = { x: 400, y: 200 };

      const path = findOrthogonalPath(mockCanvas, start, end);

      // Endpoints are preserved
      expect(path[0]).toEqual(start);
      expect(path[path.length - 1]).toEqual(end);

      // No obstacles → simplifies to the direct 2-point segment
      expect(path.length).toBe(2);

      // Still orthogonal
      for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x;
        const dy = path[i].y - path[i - 1].y;
        expect(dx === 0 || dy === 0).toBe(true);
      }
    });

    /**
     * When the start point falls inside an obstacle the function short-circuits
     * and returns the direct [start, end] fallback immediately.
     *
     * isPointInObstacle uses padding=0 for the early-exit check, so the
     * obstacle must cover the start point exactly (no padding needed).
     */
    it('returns fallback direct route when no valid path exists', () => {
      // Large obstacle that contains the start point (100, 100)
      const mockCanvas = makeMockCanvas(
        [{ left: 0, top: 0, width: 200, height: 200 }],
        1000,
        1000,
      );

      const start = { x: 100, y: 100 };
      const end = { x: 500, y: 300 };

      const path = findOrthogonalPath(mockCanvas, start, end);

      // Falls back to a direct two-point path
      expect(path).toEqual([start, end]);
    });
  });

  // -------------------------------------------------------------------------
  // Line Type Conversion
  // -------------------------------------------------------------------------

  describe('Line Type Conversion', () => {
    /**
     * A straight-line Path object with two anchor points should be convertible
     * to curved, orthogonal, and bezier types.  We test the actual curved
     * conversion end-to-end and verify canConvertTo() for all target types.
     */
    it('converts 2-anchor straight line to curved, orthogonal, or bezier', async () => {
      const linePath = makeStraightLineObj('line-conv', 100, 100, 300, 300);
      canvas.add(linePath);

      // Perform actual conversion to curved
      const curved = await convertToCurvedLine(canvas, linePath);

      expect(curved).not.toBeNull();
      expect((curved as any).isCurvedLine).toBe(true);
      expect((curved as any).curvedLineStart).toEqual({ x: 100, y: 100 });
      expect((curved as any).curvedLineEnd).toEqual({ x: 300, y: 300 });

      // canConvertTo() must report true for all supported target types
      const twoAnchorLine = makeStraightLineObj('line-check', 0, 0, 100, 100);
      expect(canConvertTo(twoAnchorLine, 'curved')).toBe(true);
      expect(canConvertTo(twoAnchorLine, 'orthogonal')).toBe(true);
      expect(canConvertTo(twoAnchorLine, 'bezier')).toBe(true);
    });

    /**
     * Attachment metadata (start/end smart-connector refs) must survive a
     * type conversion unchanged so that connection tracking stays intact.
     */
    it('maintains object attachments when converting between types', async () => {
      const linePath = makeStraightLineObj('line-attach', 100, 100, 300, 300);

      const startAttachment = { objectId: 'obj-a', connectionId: 'cp-a', position: 'right' };
      const endAttachment = { objectId: 'obj-b', connectionId: 'cp-b', position: 'left' };
      linePath.startAttachment = startAttachment;
      linePath.endAttachment = endAttachment;

      canvas.add(linePath);

      const curved = await convertToCurvedLine(canvas, linePath);

      expect(curved).not.toBeNull();
      // Attachments preserved
      expect((curved as any).startAttachment).toEqual(startAttachment);
      expect((curved as any).endAttachment).toEqual(endAttachment);
      // Identity preserved
      expect((curved as any).id).toBe('line-attach');
    });
  });

  // -------------------------------------------------------------------------
  // Endpoint Positioning
  // -------------------------------------------------------------------------

  describe('Endpoint Positioning', () => {
    /**
     * Straight line along the x-axis: (0,100) → (200,100).
     *
     * calculateLineTangentAngles uses calculateAngle(end, start) for the start
     * marker and calculateAngle(start, end) for the end marker:
     *   startAngle = atan2(100-100, 0-200) * 180/π  = atan2(0, -200) = 180°
     *   endAngle   = atan2(100-100, 200-0) * 180/π  = atan2(0,  200) =   0°
     */
    it('endpoints render with correct orientation on straight lines', () => {
      const lineObj: any = {
        isStraightLine: true,
        id: 'straight-ep',
        straightLineStart: { x: 0, y: 100 },
        straightLineEnd: { x: 200, y: 100 },
        stroke: '#000000',
        strokeWidth: 2,
      };

      applyEndpointMarkers(canvas, lineObj, 'arrow', 'arrow');

      expect(lineObj.startMarker).not.toBeNull();
      expect(lineObj.endMarker).not.toBeNull();

      // Start marker points left (away from end), end marker points right
      expect(lineObj.startMarker.angle).toBe(180);
      expect(lineObj.endMarker.angle).toBe(0);
    });

    /**
     * Curved line: start=(0,100), control=(100,0), end=(200,100).
     *
     * For curved lines the tangent is derived from the control point:
     *   startAngle = atan2(100-0, 0-100) * 180/π  = atan2(100,-100) = 135°
     *   endAngle   = atan2(100-0, 200-100) * 180/π = atan2(100, 100) =  45°
     */
    it('endpoints render with correct orientation on curved lines', () => {
      const lineObj: any = {
        isCurvedLine: true,
        id: 'curved-ep',
        curvedLineStart: { x: 0, y: 100 },
        curvedLineEnd: { x: 200, y: 100 },
        curvedLineControlPoint: { x: 100, y: 0 },
        stroke: '#000000',
        strokeWidth: 2,
      };

      applyEndpointMarkers(canvas, lineObj, 'arrow', 'arrow');

      expect(lineObj.startMarker).not.toBeNull();
      expect(lineObj.endMarker).not.toBeNull();

      // Tangent from control-point toward start / toward end
      expect(lineObj.startMarker.angle).toBeCloseTo(135, 1);
      expect(lineObj.endMarker.angle).toBeCloseTo(45, 1);
    });

    /**
     * L-shaped orthogonal path: M 0 100 L 200 100 L 200 300
     *   • First segment is horizontal (→)  → start marker points left
     *   • Last  segment is vertical   (↓)  → end   marker points down
     *
     * The key assertion is that start and end markers have DIFFERENT orientations,
     * which proves the renderer reads each segment's direction rather than using
     * the naive start-to-end angle (which would be the same for both).
     */
    it('endpoints render with correct orientation on orthogonal lines', () => {
      const linePath = new Path('M 0 100 L 200 100 L 200 300', {
        stroke: '#000000',
        strokeWidth: 2,
      } as any) as any;
      linePath.isOrthogonalLine = true;
      linePath.id = 'ortho-ep';

      canvas.add(linePath);

      // Endpoint extraction must succeed for a valid path object
      const endpoints = getLineEndpoints(linePath);
      expect(endpoints).not.toBeNull();

      // Apply markers
      applyEndpointMarkers(canvas, linePath, 'arrow', 'arrow');

      expect(linePath.startMarker).not.toBeNull();
      expect(linePath.endMarker).not.toBeNull();

      // Start marker (horizontal segment) and end marker (vertical segment)
      // must face different directions
      expect(linePath.startMarker.angle).not.toBe(linePath.endMarker.angle);
    });
  });
});
