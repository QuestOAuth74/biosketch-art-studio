import { FabricObject, Point, util } from "fabric";
import { CornerStyle } from "@/types/effects";
import { smoothOrthogonalPath, bevelOrthogonalPath, pointsToPath } from "./lineRouting";

/**
 * For groups (e.g. orthogonal lines with endpoint markers), return the path child.
 * Otherwise return the object itself.
 */
function getStrokeTarget(obj: FabricObject): FabricObject {
  if (obj.type === 'group') {
    const pathChild = (obj as any).getObjects?.().find((o: any) => o.type === 'path');
    if (pathChild) return pathChild;
  }
  return obj;
}

/**
 * Extract sharp corner points from a path that has ONLY M and L commands.
 * Only call this on a freshly-created sharp path.
 */
function extractSharpCornersFromML(pathData: any[]): Point[] {
  return pathData
    .filter((cmd: any) => cmd[0] === 'M' || cmd[0] === 'L')
    .map((cmd: any) => new Point(cmd[1] as number, cmd[2] as number));
}

/**
 * Get stroke dash array based on dash pattern type
 */
export function getDashArray(pattern: 'solid' | 'dashed' | 'dotted' | 'custom', customArray?: number[]): number[] | undefined {
  switch (pattern) {
    case 'solid':
      return undefined;
    case 'dashed':
      return [10, 5];
    case 'dotted':
      return [2, 3];
    case 'custom':
      return customArray || [10, 5];
    default:
      return undefined;
  }
}

/**
 * Apply stroke width to a line object
 */
export function applyStrokeWidth(obj: FabricObject, width: number): void {
  if (!obj) return;

  obj.set({ strokeWidth: width } as any);
  obj.setCoords();
}

/**
 * Apply dash pattern to a line object
 */
export function applyDashPattern(
  obj: FabricObject,
  pattern: 'solid' | 'dashed' | 'dotted' | 'custom',
  customArray?: number[]
): void {
  if (!obj) return;

  const dashArray = getDashArray(pattern, customArray);
  obj.set({ strokeDashArray: dashArray } as any);
  obj.setCoords();
}

/**
 * Apply corner style to an orthogonal line by regenerating its path geometry.
 * Always rebuilds from the cached sharp routing points so switching corner
 * types never degrades the line.
 *
 * The cache (_sharpRoutePoints) is populated on first call from the current
 * M/L-only path data (freshly created lines are always sharp).
 * It must be cleared whenever the route changes (e.g. after edit mode moves a waypoint).
 */
export function applyCornerStyle(obj: FabricObject, style: CornerStyle): void {
  if (!obj) return;

  const pathObj = getStrokeTarget(obj) as any;
  if (!pathObj?.path) return;

  const lineData = obj as any;

  // Populate cache from current path on first call.
  // At this point the path must be M/L-only (default for new orthogonal lines).
  if (!lineData._sharpRoutePoints || lineData._sharpRoutePoints.length < 2) {
    const extracted = extractSharpCornersFromML(pathObj.path);
    if (extracted.length < 2) return;
    lineData._sharpRoutePoints = extracted;
  }

  const sharpPoints: Point[] = lineData._sharpRoutePoints;

  const CORNER_SIZE = 10;
  let newPathData: string;
  switch (style) {
    case 'rounded':
      newPathData = smoothOrthogonalPath(sharpPoints, CORNER_SIZE);
      break;
    case 'beveled':
      newPathData = bevelOrthogonalPath(sharpPoints, CORNER_SIZE);
      break;
    case 'sharp':
    default:
      newPathData = pointsToPath(sharpPoints);
      break;
  }

  pathObj.set({ path: util.parsePath(newPathData), dirty: true });
  pathObj.setCoords();

  lineData.cornerStyle = style;

  // If obj is a group (orthogonal line with markers), mark it dirty so
  // Fabric invalidates the group's render cache and re-draws the path child.
  if (obj.type === 'group') {
    (obj as any).dirty = true;
  }
  obj.setCoords();
}

/**
 * Apply all line styles to an object
 */
export function applyLineStyles(
  obj: FabricObject,
  options: {
    strokeWidth?: number;
    dashPattern?: 'solid' | 'dashed' | 'dotted' | 'custom';
    customDashArray?: number[];
    cornerStyle?: CornerStyle;
  }
): void {
  if (!obj) return;

  if (options.strokeWidth !== undefined) {
    applyStrokeWidth(obj, options.strokeWidth);
  }

  if (options.dashPattern !== undefined) {
    applyDashPattern(obj, options.dashPattern, options.customDashArray);
  }

  if (options.cornerStyle !== undefined) {
    applyCornerStyle(obj, options.cornerStyle);
  }
}

/**
 * Get current line styles from an object.
 * For groups (orthogonal lines with markers), reads stroke properties from the path child.
 */
export function getLineStyles(obj: FabricObject): {
  strokeWidth: number;
  dashPattern: 'solid' | 'dashed' | 'dotted' | 'custom';
  customDashArray?: number[];
  cornerStyle: CornerStyle;
} {
  const target = getStrokeTarget(obj);
  const strokeWidth = (target as any).strokeWidth || (obj as any).strokeWidth || 2;
  const dashArray = (target as any).strokeDashArray ?? (obj as any).strokeDashArray;

  let dashPattern: 'solid' | 'dashed' | 'dotted' | 'custom' = 'solid';
  if (dashArray && dashArray.length > 0) {
    if (dashArray[0] === 2 && dashArray[1] === 3) {
      dashPattern = 'dotted';
    } else if (dashArray[0] === 10 && dashArray[1] === 5) {
      dashPattern = 'dashed';
    } else {
      dashPattern = 'custom';
    }
  }

  // cornerStyle is stored directly on the object when set via applyCornerStyle
  const cornerStyle: CornerStyle = (obj as any).cornerStyle || 'sharp';

  return {
    strokeWidth,
    dashPattern,
    customDashArray: dashPattern === 'custom' ? dashArray : undefined,
    cornerStyle,
  };
}
