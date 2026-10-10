import { Canvas, Circle, Path, Polygon, Line as FabricLine, Point, Group, util } from "fabric";
import { LineEndpointType } from "@/types/effects";
import { attachStraightLineTransformSync } from "./straightLineTool";
import { attachCurvedLineTransformSync } from "./curvedLineTool";

interface EndpointOptions {
  x: number;
  y: number;
  angle: number; // Angle in degrees for endpoint direction
  strokeWidth: number;
  strokeColor: string;
  type: LineEndpointType;
  isStartMarker?: boolean; // Whether this is a start marker (affects hollow marker positioning)
}

/**
 * Create an arrow endpoint marker
 */
function createArrowEndpoint(options: EndpointOptions): Polygon {
  const size = Math.max(options.strokeWidth * 3, 10);

  const points = [
    { x: 0, y: 0 },
    { x: -size, y: -size / 2 },
    { x: -size, y: size / 2 },
  ];

  return new Polygon(points, {
    fill: options.strokeColor,
    stroke: options.strokeColor,
    strokeWidth: 0,
    left: options.x,
    top: options.y,
    angle: options.angle,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  } as any);
}

/**
 * Create a circle (hollow) endpoint marker
 */
function createCircleHollowEndpoint(options: EndpointOptions): Circle {
  const radius = Math.max(options.strokeWidth * 2, 6);

  // Offset hollow marker so edge aligns with endpoint, not center
  // Angle already points in correct direction (backward for start, forward for end)
  const angleRad = options.angle * Math.PI / 180;
  const offsetX = Math.cos(angleRad) * radius;
  const offsetY = Math.sin(angleRad) * radius;

  const circle = new Circle({
    radius: radius,
    fill: 'transparent',
    stroke: options.strokeColor,
    strokeWidth: Math.max(options.strokeWidth * 0.5, 1),
    left: options.x + offsetX,
    top: options.y + offsetY,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  } as any);
  (circle as any)._hollowOffset = radius;
  return circle;
}

/**
 * Create a circle (filled) endpoint marker
 */
function createCircleFilledEndpoint(options: EndpointOptions): Circle {
  const radius = Math.max(options.strokeWidth * 2, 6);

  return new Circle({
    radius: radius,
    fill: options.strokeColor,
    stroke: options.strokeColor,
    strokeWidth: 0,
    left: options.x,
    top: options.y,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  } as any);
}

/**
 * Create a dot endpoint marker
 */
function createDotEndpoint(options: EndpointOptions): Circle {
  const radius = Math.max(options.strokeWidth * 1.5, 4);

  return new Circle({
    radius: radius,
    fill: options.strokeColor,
    stroke: options.strokeColor,
    strokeWidth: 0,
    left: options.x,
    top: options.y,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  } as any);
}

/**
 * Create a diamond (hollow) endpoint marker
 */
function createDiamondHollowEndpoint(options: EndpointOptions): Polygon {
  const size = Math.max(options.strokeWidth * 2.5, 8);

  const points = [
    { x: 0, y: -size },
    { x: size, y: 0 },
    { x: 0, y: size },
    { x: -size, y: 0 },
  ];

  // Offset hollow marker so edge aligns with endpoint, not center
  // Angle already points in correct direction (backward for start, forward for end)
  const angleRad = options.angle * Math.PI / 180;
  const offsetX = Math.cos(angleRad) * size;
  const offsetY = Math.sin(angleRad) * size;

  const diamond = new Polygon(points, {
    fill: 'transparent',
    stroke: options.strokeColor,
    strokeWidth: Math.max(options.strokeWidth * 0.5, 1),
    left: options.x + offsetX,
    top: options.y + offsetY,
    angle: options.angle,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  } as any);
  (diamond as any)._hollowOffset = size;
  return diamond;
}

/**
 * Create a diamond (filled) endpoint marker
 */
function createDiamondFilledEndpoint(options: EndpointOptions): Polygon {
  const size = Math.max(options.strokeWidth * 2.5, 8);

  const points = [
    { x: 0, y: -size },
    { x: size, y: 0 },
    { x: 0, y: size },
    { x: -size, y: 0 },
  ];

  return new Polygon(points, {
    fill: options.strokeColor,
    stroke: options.strokeColor,
    strokeWidth: 0,
    left: options.x,
    top: options.y,
    angle: options.angle,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  } as any);
}

/**
 * Create an inhibitor bar endpoint marker
 */
function createInhibitorBarEndpoint(options: EndpointOptions): FabricLine {
  const height = Math.max(options.strokeWidth * 4, 12);

  return new FabricLine([0, -height / 2, 0, height / 2], {
    stroke: options.strokeColor,
    strokeWidth: Math.max(options.strokeWidth * 1.5, 2),
    left: options.x,
    top: options.y,
    angle: options.angle,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  } as any);
}

/**
 * Create a right-angle (open chevron) endpoint marker
 */
function createRightAngleEndpoint(options: EndpointOptions): Path {
  const size = Math.max(options.strokeWidth * 3, 10);

  // Two lines meeting at the apex, arms spread outward/forward.
  // A phantom M command at (-size, 0) balances the bounding box so its
  // center sits exactly on the apex vertex at (0, 0).
  const d = `M ${-size} 0 M ${size} ${-size} L 0 0 L ${size} ${size}`;

  // Offset the chevron outward so the line's stroke edge meets the apex
  // flush instead of overflowing into the V opening.
  const offset = options.strokeWidth * 0.5;
  const angleRad = options.angle * Math.PI / 180;
  const offsetX = Math.cos(angleRad) * offset;
  const offsetY = Math.sin(angleRad) * offset;

  const marker = new Path(d, {
    fill: 'transparent',
    stroke: options.strokeColor,
    strokeWidth: Math.max(options.strokeWidth * 0.8, 1.5),
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    left: options.x + offsetX,
    top: options.y + offsetY,
    angle: options.angle,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  } as any);
  (marker as any)._hollowOffset = offset;
  return marker;
}

/**
 * Create an endpoint marker based on type
 */
export function createEndpointMarker(options: EndpointOptions): any | null {
  switch (options.type) {
    case 'none':
      return null;
    case 'arrow':
    case 'back-arrow':
      return createArrowEndpoint(options);
    case 'circle-hollow':
    case 'circle':
      return createCircleHollowEndpoint(options);
    case 'circle-filled':
      return createCircleFilledEndpoint(options);
    case 'dot':
      return createDotEndpoint(options);
    case 'diamond-hollow':
    case 'diamond':
      return createDiamondHollowEndpoint(options);
    case 'diamond-filled':
    case 'block':
      return createDiamondFilledEndpoint(options);
    case 'inhibitor-bar':
    case 'bar':
      return createInhibitorBarEndpoint(options);
    case 'right-angle':
      return createRightAngleEndpoint(options);
    default:
      return null;
  }
}

/**
 * Calculate angle between two points in degrees
 */
function calculateAngle(x1: number, y1: number, x2: number, y2: number): number {
  const radians = Math.atan2(y2 - y1, x2 - x1);
  return (radians * 180) / Math.PI;
}

/**
 * Calculate tangent angles at the start and end of a line
 * Returns angles in degrees pointing away from the line center
 */
function calculateLineTangentAngles(obj: any, endpoints: { start: Point; end: Point }): {
  startAngle: number;
  endAngle: number;
} {
  // For straight lines, use simple angle between endpoints
  if (obj.isStraightLine) {
    return {
      startAngle: calculateAngle(endpoints.end.x, endpoints.end.y, endpoints.start.x, endpoints.start.y),
      endAngle: calculateAngle(endpoints.start.x, endpoints.start.y, endpoints.end.x, endpoints.end.y),
    };
  }

  // For curved lines (quadratic bezier), calculate tangent from control point
  if (obj.isCurvedLine && obj.curvedLineControlPoint) {
    const cp = obj.curvedLineControlPoint;

    // Tangent at start (t=0): direction from start toward control point
    const startAngle = calculateAngle(cp.x, cp.y, endpoints.start.x, endpoints.start.y);

    // Tangent at end (t=1): direction from control point toward end
    const endAngle = calculateAngle(cp.x, cp.y, endpoints.end.x, endpoints.end.y);

    return { startAngle, endAngle };
  }

  // For bezier paths, extract control points from path data
  if (obj.isBezierPath && obj.path) {
    const pathData = obj.path;

    if (pathData.length >= 2) {
      const firstCmd = pathData[0]; // M command
      const secondCmd = pathData[1]; // Should be C (cubic bezier)

      let startAngle: number;
      let endAngle: number;

      if (secondCmd[0] === 'C') {
        // Cubic bezier: C cp1x cp1y cp2x cp2y x y
        // Transform control points to world coordinates
        const matrix = obj.calcTransformMatrix();
        const pathOffset = obj.pathOffset || { x: 0, y: 0 };

        // First control point (for start tangent)
        const localCp1 = {
          x: secondCmd[1] - pathOffset.x,
          y: secondCmd[2] - pathOffset.y,
        };
        const worldCp1 = util.transformPoint(new Point(localCp1.x, localCp1.y), matrix);

        // Last command for end tangent
        const lastCmd = pathData[pathData.length - 1];
        let worldCp2: Point;

        if (lastCmd[0] === 'C') {
          // Second-to-last control point
          const localCp2 = {
            x: lastCmd[3] - pathOffset.x,
            y: lastCmd[4] - pathOffset.y,
          };
          worldCp2 = util.transformPoint(new Point(localCp2.x, localCp2.y), matrix);
        } else {
          // Fallback to simple angle
          worldCp2 = endpoints.start;
        }

        // Tangent at start: from first control point toward start
        startAngle = calculateAngle(worldCp1.x, worldCp1.y, endpoints.start.x, endpoints.start.y);

        // Tangent at end: from second control point toward end
        endAngle = calculateAngle(worldCp2.x, worldCp2.y, endpoints.end.x, endpoints.end.y);

        return { startAngle, endAngle };
      } else if (secondCmd[0] === 'Q') {
        // Quadratic bezier: Q cpx cpy x y
        const matrix = obj.calcTransformMatrix();
        const pathOffset = obj.pathOffset || { x: 0, y: 0 };

        const localCp = {
          x: secondCmd[1] - pathOffset.x,
          y: secondCmd[2] - pathOffset.y,
        };
        const worldCp = util.transformPoint(new Point(localCp.x, localCp.y), matrix);

        startAngle = calculateAngle(worldCp.x, worldCp.y, endpoints.start.x, endpoints.start.y);
        endAngle = calculateAngle(worldCp.x, worldCp.y, endpoints.end.x, endpoints.end.y);

        return { startAngle, endAngle };
      }
    }
  }

  // For orthogonal lines, extract tangent from actual path data (not waypoints)
  // because waypoints are just control points, not the actual rendered segments
  if (obj.isOrthogonalLine && obj.path) {
    const pathData = obj.path;

    if (pathData.length >= 2) {
      const matrix = obj.calcTransformMatrix();
      const pathOffset = obj.pathOffset || { x: 0, y: 0 };

      // Get first segment (M to first L)
      const firstCmd = pathData[0]; // M command
      const secondCmd = pathData[1]; // L command (first segment)

      if (secondCmd && secondCmd[0] === 'L') {
        // Transform start and second point to world coordinates
        const localStart = { x: firstCmd[1] - pathOffset.x, y: firstCmd[2] - pathOffset.y };
        const localSecond = { x: secondCmd[1] - pathOffset.x, y: secondCmd[2] - pathOffset.y };

        const worldStart = util.transformPoint(new Point(localStart.x, localStart.y), matrix);
        const worldSecond = util.transformPoint(new Point(localSecond.x, localSecond.y), matrix);

        // Start angle: from second point to start (pointing away from line)
        const startAngle = calculateAngle(worldSecond.x, worldSecond.y, worldStart.x, worldStart.y);

        // Get last segment (second-to-last L to last point)
        const lastCmd = pathData[pathData.length - 1];
        const secondLastCmd = pathData.length > 2 ? pathData[pathData.length - 2] : firstCmd;

        let endAngle: number;

        if (lastCmd[0] === 'L' && secondLastCmd) {
          // Transform second-to-last and last point to world coordinates
          const localSecondLast = {
            x: (secondLastCmd[1] || firstCmd[1]) - pathOffset.x,
            y: (secondLastCmd[2] || firstCmd[2]) - pathOffset.y
          };
          const localLast = { x: lastCmd[1] - pathOffset.x, y: lastCmd[2] - pathOffset.y };

          const worldSecondLast = util.transformPoint(new Point(localSecondLast.x, localSecondLast.y), matrix);
          const worldLast = util.transformPoint(new Point(localLast.x, localLast.y), matrix);

          // End angle: from second-to-last to last (pointing away from line)
          endAngle = calculateAngle(worldSecondLast.x, worldSecondLast.y, worldLast.x, worldLast.y);
        } else {
          // Fallback to simple angle
          endAngle = calculateAngle(worldSecond.x, worldSecond.y, endpoints.end.x, endpoints.end.y);
        }

        return { startAngle, endAngle };
      }
    }
  }

  // For arc paths, compute tangent by sampling the SVG path near each endpoint.
  // This avoids all the error-prone geometric center calculations.
  if (obj.isArcPath && obj.path) {
    try {
      // Rebuild the SVG path string from Fabric's parsed path array
      const pathStr = obj.path.map((cmd: any[]) => cmd.join(' ')).join(' ');

      // Create a temporary SVG path element to use getPointAtLength()
      const svgNs = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNs, 'svg');
      const pathEl = document.createElementNS(svgNs, 'path');
      pathEl.setAttribute('d', pathStr);
      svg.appendChild(pathEl);
      document.body.appendChild(svg);

      const totalLen = pathEl.getTotalLength();
      const delta = Math.min(1, totalLen * 0.01); // sample 1% in from each end

      // Sample near start: direction of travel = from t=0 toward t=delta
      const pStart = pathEl.getPointAtLength(0);
      const pStartNear = pathEl.getPointAtLength(delta);

      // Sample near end: direction of travel = from t=(total-delta) toward t=total
      const pEndNear = pathEl.getPointAtLength(totalLen - delta);
      const pEnd = pathEl.getPointAtLength(totalLen);

      document.body.removeChild(svg);

      // Convert local tangent directions to world coordinates
      const matrix = obj.calcTransformMatrix();
      const pathOffset = obj.pathOffset || { x: 0, y: 0 };

      const toWorld = (p: DOMPoint) =>
        util.transformPoint(new Point(p.x - pathOffset.x, p.y - pathOffset.y), matrix);

      const wStart = toWorld(pStart);
      const wStartNear = toWorld(pStartNear);
      const wEndNear = toWorld(pEndNear);
      const wEnd = toWorld(pEnd);

      // Travel direction at start (from start toward interior of arc)
      const startTravel = Math.atan2(wStartNear.y - wStart.y, wStartNear.x - wStart.x) * 180 / Math.PI;
      // Travel direction at end (from interior toward end)
      const endTravel = Math.atan2(wEnd.y - wEndNear.y, wEnd.x - wEndNear.x) * 180 / Math.PI;

      return {
        startAngle: startTravel + 180, // marker points away from arc
        endAngle: endTravel,            // marker points along travel
      };
    } catch (e) {
      // Fall through to default if DOM sampling fails
    }
  }

  // Fallback: use simple angle between endpoints
  return {
    startAngle: calculateAngle(endpoints.end.x, endpoints.end.y, endpoints.start.x, endpoints.start.y),
    endAngle: calculateAngle(endpoints.start.x, endpoints.start.y, endpoints.end.x, endpoints.end.y),
  };
}

/**
 * Get start and end points from a path or line object in world coordinates
 */
export function getLineEndpoints(obj: any): { start: Point; end: Point } | null {
  // For straight lines, use stored world coordinates if available
  if (obj.isStraightLine && obj.straightLineStart && obj.straightLineEnd) {
    return {
      start: new Point(obj.straightLineStart.x, obj.straightLineStart.y),
      end: new Point(obj.straightLineEnd.x, obj.straightLineEnd.y),
    };
  }

  // For curved lines, use stored world coordinates if available
  if (obj.isCurvedLine && obj.curvedLineStart && obj.curvedLineEnd) {
    return {
      start: new Point(obj.curvedLineStart.x, obj.curvedLineStart.y),
      end: new Point(obj.curvedLineEnd.x, obj.curvedLineEnd.y),
    };
  }

  // For group objects (orthogonal/bezier lines with embedded markers),
  // find the Path child inside the group and extract endpoints from it.
  if (obj.type === 'group' && (obj.isOrthogonalLine || obj.isBezierPath)) {
    const pathChild = (obj._objects || obj.getObjects?.() || [])
      .find((child: any) => child.type === 'path' && child.path);
    if (pathChild) {
      const pathData = pathChild.path;
      if (pathData.length >= 2) {
        const firstCmd = pathData[0];
        const localStart = new Point(firstCmd[1], firstCmd[2]);
        const lastCmd = pathData[pathData.length - 1];
        const localEnd = new Point(
          lastCmd[lastCmd.length - 2],
          lastCmd[lastCmd.length - 1]
        );

        // Transform child-local coords through the child's own matrix,
        // then through the group's matrix to get world coords.
        const childMatrix = pathChild.calcTransformMatrix();
        const groupMatrix = obj.calcTransformMatrix();

        const pathOffset = pathChild.pathOffset || { x: 0, y: 0 };
        const objLocalStart = { x: localStart.x - pathOffset.x, y: localStart.y - pathOffset.y };
        const objLocalEnd = { x: localEnd.x - pathOffset.x, y: localEnd.y - pathOffset.y };

        // Use the child's full transform (which already includes the group transform)
        const worldStart = util.transformPoint(new Point(objLocalStart.x, objLocalStart.y), childMatrix);
        const worldEnd = util.transformPoint(new Point(objLocalEnd.x, objLocalEnd.y), childMatrix);

        return { start: worldStart, end: worldEnd };
      }
    }
  }

  // For path objects, extract from path data and transform to world coords
  if (obj.type === 'path' && obj.path) {
    const pathData = obj.path;
    if (pathData.length < 2) {
      return null;
    }

    // First point (local coordinates)
    const firstCmd = pathData[0];
    const localStart = new Point(firstCmd[1], firstCmd[2]);

    // Last point (local coordinates)
    const lastCmd = pathData[pathData.length - 1];
    const localEnd = new Point(
      lastCmd[lastCmd.length - 2],
      lastCmd[lastCmd.length - 1]
    );

    // Transform to world coordinates
    const matrix = obj.calcTransformMatrix();

    // Account for pathOffset
    const pathOffset = obj.pathOffset || { x: 0, y: 0 };
    const objectLocalStart = {
      x: localStart.x - pathOffset.x,
      y: localStart.y - pathOffset.y,
    };
    const objectLocalEnd = {
      x: localEnd.x - pathOffset.x,
      y: localEnd.y - pathOffset.y,
    };

    const worldStart = util.transformPoint(new Point(objectLocalStart.x, objectLocalStart.y), matrix);
    const worldEnd = util.transformPoint(new Point(objectLocalEnd.x, objectLocalEnd.y), matrix);

    return {
      start: worldStart,
      end: worldEnd,
    };
  } else if (obj.type === 'line') {
    return {
      start: new Point(obj.x1, obj.y1),
      end: new Point(obj.x2, obj.y2),
    };
  }

  return null;
}

/**
 * Apply endpoint markers to a line object
 */
export function applyEndpointMarkers(
  canvas: Canvas,
  lineObj: any,
  startType: LineEndpointType,
  endType: LineEndpointType
): void {
  if (!canvas || !lineObj) {
    return;
  }

  // Remove existing endpoint markers
  removeEndpointMarkers(canvas, lineObj);

  // Get line endpoints
  const endpoints = getLineEndpoints(lineObj);

  if (!endpoints) {
    return;
  }

  const strokeWidth = lineObj.strokeWidth || 2;
  // Use gradientOriginalStroke when gradient is active (stroke is 'transparent')
  const strokeColor =
    (lineObj.gradientOriginalStroke as string | undefined) ||
    (typeof lineObj.stroke === 'string' && lineObj.stroke !== 'transparent' ? lineObj.stroke : null) ||
    '#000000';

  // Calculate tangent angles at endpoints based on line type
  const { startAngle, endAngle } = calculateLineTangentAngles(lineObj, endpoints);

  // Create and add start marker
  if (startType !== 'none') {
    const startMarker = createEndpointMarker({
      x: endpoints.start.x,
      y: endpoints.start.y,
      angle: startAngle,
      strokeWidth,
      strokeColor,
      type: startType,
    });

    if (startMarker) {
      (startMarker as any).isEndpointMarker = true;
      (startMarker as any).lineId = (lineObj as any).id || lineObj;
      canvas.add(startMarker);
      // Store reference on line so syncMarkers can move it on drag
      lineObj.startMarker = startMarker;
    }
  } else {
    lineObj.startMarker = null;
  }

  // Create and add end marker
  if (endType !== 'none') {
    const endMarker = createEndpointMarker({
      x: endpoints.end.x,
      y: endpoints.end.y,
      angle: endAngle,
      strokeWidth,
      strokeColor,
      type: endType,
    });

    if (endMarker) {
      (endMarker as any).isEndpointMarker = true;
      (endMarker as any).lineId = (lineObj as any).id || lineObj;
      canvas.add(endMarker);
      // Store reference on line so syncMarkers can move it on drag
      lineObj.endMarker = endMarker;
    }
  } else {
    lineObj.endMarker = null;
  }

  canvas.requestRenderAll();
}

/**
 * Remove endpoint markers for a specific line
 */
export function removeEndpointMarkers(canvas: Canvas, lineObj: any): void {
  if (!canvas || !lineObj) return;

  const lineId = (lineObj as any).id || lineObj;
  const toRemove: any[] = [];

  canvas.forEachObject((obj) => {
    if ((obj as any).isEndpointMarker && (obj as any).lineId === lineId) {
      toRemove.push(obj);
    }
  });

  toRemove.forEach((obj) => canvas.remove(obj));

  // Also remove old-style markers stored directly on the line object
  if (lineObj.startMarker) {
    canvas.remove(lineObj.startMarker);
    lineObj.startMarker = null;
  }
  if (lineObj.endMarker) {
    canvas.remove(lineObj.endMarker);
    lineObj.endMarker = null;
  }
}

/**
 * Update endpoint markers when line is modified
 */
export function updateEndpointMarkers(
  canvas: Canvas,
  lineObj: any,
  startType: LineEndpointType,
  endType: LineEndpointType
): void {
  applyEndpointMarkers(canvas, lineObj, startType, endType);
}

/**
 * Attach a lightweight transform sync to a line object so its endpoint markers
 * reposition whenever the line is moved, scaled, or rotated.
 * Used for line types that don't have their own dedicated reconnect function
 * (orthogonal lines, bezier paths). Straight and curved lines use their own
 * attachStraightLineTransformSync / attachCurvedLineTransformSync instead.
 */
export function attachGenericMarkerSync(canvas: Canvas, lineObj: any): void {
  // Remove any previously attached generic sync to avoid double-firing
  if (lineObj._genericMarkerSyncHandler) {
    lineObj.off('moving', lineObj._genericMarkerSyncHandler);
    lineObj.off('rotating', lineObj._genericMarkerSyncHandler);
    lineObj.off('scaling', lineObj._genericMarkerSyncHandler);
    lineObj.off('modified', lineObj._genericMarkerSyncHandler);
  }

  const syncPositions = () => {
    const startMarker = lineObj.startMarker;
    const endMarker = lineObj.endMarker;
    if (!startMarker && !endMarker) return;

    const endpoints = getLineEndpoints(lineObj);
    if (!endpoints) return;

    // Use gradientOriginalStroke when gradient is active (stroke is 'transparent')
    const strokeColor =
      (lineObj.gradientOriginalStroke as string | undefined) ||
      (typeof lineObj.stroke === 'string' && lineObj.stroke !== 'transparent' ? lineObj.stroke : null) ||
      '#000000';
    const { startAngle, endAngle } = calculateLineTangentAngles(lineObj, endpoints);

    if (startMarker) {
      let leftPos = endpoints.start.x;
      let topPos = endpoints.start.y;
      // Apply hollow marker offset so edge aligns with endpoint
      const startOffset = (startMarker as any)._hollowOffset;
      if (startOffset) {
        const rad = startAngle * Math.PI / 180;
        leftPos += Math.cos(rad) * startOffset;
        topPos += Math.sin(rad) * startOffset;
      }
      const updates: Record<string, unknown> = {
        left: leftPos,
        top: topPos,
        angle: startAngle,
        stroke: strokeColor,
      };
      // Only update fill for filled markers — hollow markers use 'transparent'
      if (startMarker.fill !== 'transparent') {
        updates.fill = strokeColor;
      }
      startMarker.set(updates);
      startMarker.setCoords();
    }

    if (endMarker) {
      let leftPos = endpoints.end.x;
      let topPos = endpoints.end.y;
      // Apply hollow marker offset so edge aligns with endpoint
      const endOffset = (endMarker as any)._hollowOffset;
      if (endOffset) {
        const rad = endAngle * Math.PI / 180;
        leftPos += Math.cos(rad) * endOffset;
        topPos += Math.sin(rad) * endOffset;
      }
      const updates: Record<string, unknown> = {
        left: leftPos,
        top: topPos,
        angle: endAngle,
        stroke: strokeColor,
      };
      if (endMarker.fill !== 'transparent') {
        updates.fill = strokeColor;
      }
      endMarker.set(updates);
      endMarker.setCoords();
    }

    canvas.requestRenderAll();
  };

  // Store reference for future cleanup
  lineObj._genericMarkerSyncHandler = syncPositions;

  lineObj.on('moving', syncPositions);
  lineObj.on('rotating', syncPositions);
  lineObj.on('scaling', syncPositions);
  lineObj.on('modified', syncPositions);

  // Initial sync
  syncPositions();
}

/**
 * Attach the appropriate marker transform sync for any line type.
 * Routes to the dedicated sync for straight/curved lines, or
 * falls back to the generic sync for orthogonal/bezier lines.
 */
export function attachMarkerSyncForLine(canvas: Canvas, lineObj: any): void {
  if (!canvas || !lineObj) return;

  if (lineObj.isStraightLine) {
    attachStraightLineTransformSync(canvas, lineObj);
  } else if (lineObj.isCurvedLine) {
    attachCurvedLineTransformSync(canvas, lineObj);
  } else {
    attachGenericMarkerSync(canvas, lineObj);
  }
}

/**
 * Reconnect all endpoint markers after canvas state restore (load/undo/redo).
 * Removes any stray isEndpointMarker objects, clears stale refs on lines, then
 * recreates markers from each line's startMarkerType/endMarkerType properties,
 * and attaches transform sync for all line types.
 *
 * NOTE: For straight lines, reconnectStraightLines() must be called AFTER this
 * function to attach the full transform sync (which also handles control handles).
 * For curved lines, reconnectCurvedLines() must be called AFTER this function.
 * This function attaches a generic fallback sync for other line types.
 */
export function reconnectLineMarkers(canvas: Canvas): void {
  // 1. Remove all stray endpoint marker objects
  const toRemove: any[] = [];
  canvas.forEachObject((obj) => {
    if ((obj as any).isEndpointMarker) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach((obj) => canvas.remove(obj));

  // 2. Clear stale marker refs on all line objects so applyEndpointMarkers
  //    works with a clean slate (avoids calling canvas.remove on serialized JSON)
  canvas.forEachObject((obj: any) => {
    if (obj.isStraightLine || obj.isCurvedLine || obj.isBezierPath || obj.isOrthogonalLine || obj.isArcPath) {
      obj.startMarker = null;
      obj.endMarker = null;

      // For group-based lines (orthogonal/bezier created with markers),
      // strip embedded marker children — keep only the Path child.
      // Markers will be recreated as separate canvas objects in step 3.
      if (obj.type === 'group' && obj._objects) {
        const nonPathChildren = obj._objects.filter(
          (child: any) => child.type !== 'path'
        );
        nonPathChildren.forEach((child: any) => obj.remove(child));
      }
    }
  });

  // 3. Recreate markers for every line that has marker types set, and attach sync
  canvas.forEachObject((obj: any) => {
    const startType = (obj.startMarkerType || 'none') as LineEndpointType;
    const endType = (obj.endMarkerType || 'none') as LineEndpointType;
    if (startType !== 'none' || endType !== 'none') {
      applyEndpointMarkers(canvas, obj, startType, endType);
      // Attach generic sync for line types without a dedicated reconnect function.
      // Straight lines use attachStraightLineTransformSync (via reconnectStraightLines).
      // Curved lines use attachCurvedLineTransformSync (via reconnectCurvedLines).
      // Orthogonal and bezier lines get the generic fallback here.
      if (!obj.isStraightLine && !obj.isCurvedLine) {
        attachGenericMarkerSync(canvas, obj);
      }
    }
  });
}
