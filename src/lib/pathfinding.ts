import { Canvas, FabricObject } from "fabric";
import { ConnectionPoint } from "@/types/effects";
import { BezierPoint } from "@/types/bezier";
import { v4 as uuidv4 } from "uuid";

interface Point {
  x: number;
  y: number;
}

interface GridNode {
  x: number;
  y: number;
  walkable: boolean;
  g: number; // Cost from start
  h: number; // Heuristic cost to end
  f: number; // Total cost (g + h)
  parent: GridNode | null;
}

/**
 * Get all obstacle rectangles on the canvas
 * Excludes lines, connection points, and temp objects
 */
function getObstacles(canvas: Canvas, excludeLineId?: string, excludeObjectIds?: string[]): Array<{ left: number; top: number; width: number; height: number }> {
  const obstacles: Array<{ left: number; top: number; width: number; height: number }> = [];

  canvas.forEachObject((obj) => {
    const objData = obj as any;

    // Skip temporary objects, connection points, lines, grid/ruler elements
    if (
      objData.isTemp ||
      objData.isConnectionPoint ||
      objData.isControlHandle ||
      objData.isAnchorHandle ||
      objData.isEndpointMarker ||
      objData.isHandleLine ||
      objData.isGridLine ||
      objData.isRuler ||
      obj.type === 'line' ||
      obj.type === 'path' ||
      objData.isFreeformLine ||
      objData.isBezierPath
    ) {
      return;
    }

    // Skip the line we're routing (if provided)
    if (excludeLineId && objData.id === excludeLineId) {
      return;
    }

    // Skip objects we're connecting to (if provided)
    if (excludeObjectIds && excludeObjectIds.includes(objData.id)) {
      return;
    }

    // Skip connector lines unless they're attached to objects
    if (objData.isConnector || objData.isCurvedLine || objData.isOrthogonalLine || objData.isStraightLine) {
      return;
    }

    const bounds = obj.getBoundingRect();
    obstacles.push({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  });

  return obstacles;
}

/**
 * Check if a point intersects with any obstacle
 */
function isPointInObstacle(x: number, y: number, obstacles: Array<{ left: number; top: number; width: number; height: number }>, padding: number = 10): boolean {
  return obstacles.some(obstacle => {
    return (
      x >= obstacle.left - padding &&
      x <= obstacle.left + obstacle.width + padding &&
      y >= obstacle.top - padding &&
      y <= obstacle.top + obstacle.height + padding
    );
  });
}

/**
 * Create a grid for pathfinding
 */
function createGrid(
  canvasWidth: number,
  canvasHeight: number,
  gridSize: number,
  obstacles: Array<{ left: number; top: number; width: number; height: number }>
): GridNode[][] {
  const cols = Math.ceil(canvasWidth / gridSize);
  const rows = Math.ceil(canvasHeight / gridSize);
  const grid: GridNode[][] = [];

  for (let i = 0; i < rows; i++) {
    grid[i] = [];
    for (let j = 0; j < cols; j++) {
      const x = j * gridSize;
      const y = i * gridSize;
      const walkable = !isPointInObstacle(x, y, obstacles);

      grid[i][j] = {
        x: j,
        y: i,
        walkable,
        g: 0,
        h: 0,
        f: 0,
        parent: null,
      };
    }
  }

  return grid;
}

/**
 * Calculate heuristic (Manhattan distance for orthogonal movement)
 */
function heuristic(a: GridNode, b: GridNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Get neighbors of a node (4-directional: up, right, down, left)
 */
function getNeighbors(grid: GridNode[][], node: GridNode): GridNode[] {
  const neighbors: GridNode[] = [];
  const { x, y } = node;

  // Up
  if (y > 0) neighbors.push(grid[y - 1][x]);
  // Right
  if (x < grid[0].length - 1) neighbors.push(grid[y][x + 1]);
  // Down
  if (y < grid.length - 1) neighbors.push(grid[y + 1][x]);
  // Left
  if (x > 0) neighbors.push(grid[y][x - 1]);

  return neighbors.filter(n => n.walkable);
}

/**
 * A* pathfinding algorithm
 */
function findPath(grid: GridNode[][], start: GridNode, end: GridNode): GridNode[] | null {
  const openList: GridNode[] = [start];
  const closedList: Set<GridNode> = new Set();

  start.g = 0;
  start.h = heuristic(start, end);
  start.f = start.h;

  while (openList.length > 0) {
    // Get node with lowest f score
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;

    // Found the end
    if (current.x === end.x && current.y === end.y) {
      const path: GridNode[] = [];
      let temp: GridNode | null = current;
      while (temp) {
        path.unshift(temp);
        temp = temp.parent;
      }
      return path;
    }

    closedList.add(current);

    const neighbors = getNeighbors(grid, current);
    for (const neighbor of neighbors) {
      if (closedList.has(neighbor)) continue;

      const tentativeG = current.g + 1;

      if (!openList.includes(neighbor)) {
        openList.push(neighbor);
      } else if (tentativeG >= neighbor.g) {
        continue;
      }

      neighbor.g = tentativeG;
      neighbor.h = heuristic(neighbor, end);
      neighbor.f = neighbor.g + neighbor.h;
      neighbor.parent = current;
    }
  }

  // No path found
  return null;
}

/**
 * Convert grid coordinates to canvas coordinates
 */
function gridToCanvas(gridX: number, gridY: number, gridSize: number): Point {
  return {
    x: gridX * gridSize,
    y: gridY * gridSize,
  };
}

/**
 * Convert canvas coordinates to grid coordinates
 */
function canvasToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
  return {
    x: Math.floor(x / gridSize),
    y: Math.floor(y / gridSize),
  };
}

/**
 * Simplify path by removing unnecessary waypoints
 * (removes intermediate points that are in a straight line)
 */
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;

  const simplified: Point[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const current = path[i];
    const next = path[i + 1];

    // Check if current point is necessary
    // If prev, current, and next are collinear, skip current
    const isHorizontal = prev.y === current.y && current.y === next.y;
    const isVertical = prev.x === current.x && current.x === next.x;

    if (!isHorizontal && !isVertical) {
      simplified.push(current);
    }
  }

  simplified.push(path[path.length - 1]);
  return simplified;
}

/**
 * Check whether a straight line segment between p1 and p2 is clear of obstacles.
 * Samples points along the segment at ~10px intervals.
 */
function isSegmentClear(
  p1: Point,
  p2: Point,
  obstacles: Array<{ left: number; top: number; width: number; height: number }>,
  padding: number = 10
): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return true;

  const samples = Math.max(10, Math.ceil(dist / 10));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = p1.x + dx * t;
    const y = p1.y + dy * t;
    if (isPointInObstacle(x, y, obstacles, padding)) return false;
  }
  return true;
}

/**
 * Greedy waypoint shortcutting: replace multiple consecutive waypoints with a
 * direct segment whenever the straight line is obstacle-free.
 * This converts a many-point orthogonal path to the minimum number of anchor
 * points needed to route around obstacles.
 */
function shortcutWaypoints(
  waypoints: Point[],
  obstacles: Array<{ left: number; top: number; width: number; height: number }>,
  padding: number = 10
): Point[] {
  if (waypoints.length <= 2) return waypoints;

  const result: Point[] = [waypoints[0]];
  let current = 0;

  while (current < waypoints.length - 1) {
    // Find the furthest point reachable in a straight line from the current position
    let furthest = current + 1;
    for (let j = waypoints.length - 1; j > current + 1; j--) {
      if (isSegmentClear(waypoints[current], waypoints[j], obstacles, padding)) {
        furthest = j;
        break;
      }
    }
    result.push(waypoints[furthest]);
    current = furthest;
  }

  return result;
}

/**
 * Find an orthogonal path from start to end, avoiding obstacles
 */
export function findOrthogonalPath(
  canvas: Canvas,
  startPoint: Point,
  endPoint: Point,
  excludeLineId?: string,
  excludeObjectIds?: string[],
  gridSize: number = 20
): Point[] {
  const obstacles = getObstacles(canvas, excludeLineId, excludeObjectIds);

  // If start or end is in an obstacle, do a direct path
  if (
    isPointInObstacle(startPoint.x, startPoint.y, obstacles, 0) ||
    isPointInObstacle(endPoint.x, endPoint.y, obstacles, 0)
  ) {
    return [startPoint, endPoint];
  }

  const canvasWidth = canvas.width || 1000;
  const canvasHeight = canvas.height || 1000;

  const grid = createGrid(canvasWidth, canvasHeight, gridSize, obstacles);

  const startGrid = canvasToGrid(startPoint.x, startPoint.y, gridSize);
  const endGrid = canvasToGrid(endPoint.x, endPoint.y, gridSize);

  // Ensure start and end are within grid bounds
  if (
    startGrid.y < 0 || startGrid.y >= grid.length ||
    startGrid.x < 0 || startGrid.x >= grid[0].length ||
    endGrid.y < 0 || endGrid.y >= grid.length ||
    endGrid.x < 0 || endGrid.x >= grid[0].length
  ) {
    return [startPoint, endPoint];
  }

  const startNode = grid[startGrid.y][startGrid.x];
  const endNode = grid[endGrid.y][endGrid.x];

  // If start or end node is not walkable, find nearest walkable node
  if (!startNode.walkable) {
    // Find nearest walkable node
    let found = false;
    for (let radius = 1; radius < 10 && !found; radius++) {
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          const ny = startGrid.y + dy;
          const nx = startGrid.x + dx;
          if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
            if (grid[ny][nx].walkable) {
              startNode.walkable = true;
              found = true;
            }
          }
        }
      }
    }
  }

  if (!endNode.walkable) {
    let found = false;
    for (let radius = 1; radius < 10 && !found; radius++) {
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          const ny = endGrid.y + dy;
          const nx = endGrid.x + dx;
          if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
            if (grid[ny][nx].walkable) {
              endNode.walkable = true;
              found = true;
            }
          }
        }
      }
    }
  }

  const path = findPath(grid, startNode, endNode);

  if (!path) {
    // No path found, return direct line
    return [startPoint, endPoint];
  }

  // Convert grid path to canvas coordinates
  const canvasPath = path.map(node => gridToCanvas(node.x, node.y, gridSize));

  // Replace first and last points with exact start/end points
  canvasPath[0] = startPoint;
  canvasPath[canvasPath.length - 1] = endPoint;

  // Simplify the path
  const simplifiedPath = simplifyPath(canvasPath);
  return simplifiedPath;
}

/**
 * Find the minimum waypoints needed to route a bezier line from start to end
 * while avoiding obstacles.
 *
 * Unlike findOrthogonalPath (which returns an axis-aligned path for orthogonal
 * lines), this function then shortcut-reduces the result so the bezier only
 * uses as many anchor points as strictly needed.  Straight-line shortcuts are
 * allowed because bezier segments are not constrained to be axis-aligned.
 */
export function findMinimalBezierWaypoints(
  canvas: Canvas,
  startPoint: Point,
  endPoint: Point,
  excludeLineId?: string,
  excludeObjectIds?: string[],
  gridSize: number = 20
): Point[] {
  // Run A* to get a safe orthogonal route
  const orthogonalPath = findOrthogonalPath(canvas, startPoint, endPoint, excludeLineId, excludeObjectIds, gridSize);

  if (orthogonalPath.length <= 2) {
    return orthogonalPath; // Already minimal
  }

  // Get obstacles (same set used by A*) for shortcut testing
  const obstacles = getObstacles(canvas, excludeLineId, excludeObjectIds);

  // Shortcut: replace multi-segment detours with direct lines where possible
  return shortcutWaypoints(orthogonalPath, obstacles);
}

/**
 * Convert A* orthogonal waypoints to smooth bezier anchor points.
 * Uses segment-direction tangents (not Catmull-Rom) so that orthogonal
 * corners get properly rounded rather than creating loops or bumps.
 * @param cornerRadius How far from the corner the control points are placed (px)
 */
export function waypointsToSmoothBezierPoints(waypoints: Point[], cornerRadius: number = 20): BezierPoint[] {
  const points: BezierPoint[] = waypoints.map(p => ({
    x: p.x,
    y: p.y,
    type: 'smooth' as const,
    id: uuidv4(),
  }));

  if (points.length < 2) return points;

  // Helper: unit vector from a to b
  function unit(ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  // Interior points: use bisector of incoming + outgoing for colinear (smooth) handles.
  // Both control points lie on the same axis through the anchor → true smooth curve,
  // no hard corners even at 90° turns.
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const incoming = unit(prev.x, prev.y, curr.x, curr.y);
    const outgoing = unit(curr.x, curr.y, next.x, next.y);

    const len1 = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
    const len2 = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);

    const r = Math.min(cornerRadius, len1 / 2, len2 / 2);

    // Bisector of the two segment directions: colinear handles → smooth joint
    const bx = incoming.x + outgoing.x;
    const by = incoming.y + outgoing.y;
    const bLen = Math.sqrt(bx * bx + by * by);
    // Fall back to incoming direction if vectors cancel (near-180° U-turn)
    const tangent = bLen < 0.01 ? incoming : { x: bx / bLen, y: by / bLen };

    curr.controlPoint1 = { x: curr.x - tangent.x * r, y: curr.y - tangent.y * r };
    curr.controlPoint2 = { x: curr.x + tangent.x * r, y: curr.y + tangent.y * r };
  }

  // First point: outgoing control point along the first segment
  const first = points[0];
  const second = points[1];
  const outDir = unit(first.x, first.y, second.x, second.y);
  const firstLen = Math.sqrt((second.x - first.x) ** 2 + (second.y - first.y) ** 2);
  const r0 = Math.min(cornerRadius, firstLen / 2);
  first.controlPoint2 = { x: first.x + outDir.x * r0, y: first.y + outDir.y * r0 };

  // Last point: incoming control point along the last segment
  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  const inDir = unit(beforeLast.x, beforeLast.y, last.x, last.y);
  const lastLen = Math.sqrt((last.x - beforeLast.x) ** 2 + (last.y - beforeLast.y) ** 2);
  const rN = Math.min(cornerRadius, lastLen / 2);
  last.controlPoint1 = { x: last.x - inDir.x * rN, y: last.y - inDir.y * rN };

  return points;
}

/**
 * Find a bezier path from start to end, avoiding obstacles
 * This creates control points that route around obstacles
 */
export function findBezierPath(
  canvas: Canvas,
  startPoint: Point,
  endPoint: Point,
  excludeLineId?: string
): Point[] {
  // For bezier, we'll use orthogonal pathfinding to get waypoints,
  // then convert them to bezier control points
  const orthogonalPath = findOrthogonalPath(canvas, startPoint, endPoint, excludeLineId);

  if (orthogonalPath.length <= 2) {
    // Not enough points for bezier, return as-is
    return orthogonalPath;
  }

  // Convert orthogonal waypoints to bezier control points
  // For each segment, add control points that smooth the corners
  const bezierPath: Point[] = [startPoint];

  for (let i = 1; i < orthogonalPath.length - 1; i++) {
    const prev = orthogonalPath[i - 1];
    const current = orthogonalPath[i];
    const next = orthogonalPath[i + 1];

    // Add control points around the corner
    const offset = 20; // Distance from corner for control points

    // Control point before corner
    const dx1 = current.x - prev.x;
    const dy1 = current.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    if (len1 > 0) {
      const cp1 = {
        x: current.x - (dx1 / len1) * offset,
        y: current.y - (dy1 / len1) * offset,
      };
      bezierPath.push(cp1);
    }

    // The corner point itself
    bezierPath.push(current);

    // Control point after corner
    const dx2 = next.x - current.x;
    const dy2 = next.y - current.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len2 > 0) {
      const cp2 = {
        x: current.x + (dx2 / len2) * offset,
        y: current.y + (dy2 / len2) * offset,
      };
      bezierPath.push(cp2);
    }
  }

  bezierPath.push(endPoint);
  return bezierPath;
}

/**
 * Update path when obstacles move (for dynamic rerouting)
 */
export function updatePathOnObstacleMove(
  canvas: Canvas,
  line: FabricObject,
  startConnectionPoint?: ConnectionPoint,
  endConnectionPoint?: ConnectionPoint
): void {
  const lineData = line as any;

  // Only update if line has connection points and auto-pathfinding is enabled
  if (!lineData.autoPathfindingEnabled || !startConnectionPoint || !endConnectionPoint) {
    return;
  }

  // Recalculate path
  const lineType = lineData.lineType || 'straight';
  let newPath: Point[];

  if (lineType === 'orthogonal') {
    newPath = findOrthogonalPath(canvas, startConnectionPoint, endConnectionPoint, lineData.id);
  } else if (lineType === 'bezier') {
    newPath = findBezierPath(canvas, startConnectionPoint, endConnectionPoint, lineData.id);
  } else {
    // For straight and curved, just update endpoints
    return;
  }

  // Update line geometry with new path
  // This would need to be implemented based on the specific line type
  // For now, store the new path on the line object
  lineData.computedPath = newPath;
}
