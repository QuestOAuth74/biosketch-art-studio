import { Canvas, PencilBrush, Path, FabricObject, Group, util } from "fabric";

/**
 * EraserBrush - Custom brush for erasing with visual feedback
 * Extends PencilBrush but converts strokes to object-level clipPaths
 */
export class EraserBrush extends PencilBrush {
  constructor(canvas: Canvas) {
    super(canvas);
    // Red semi-transparent for better visibility while erasing
    this.color = "rgba(255, 0, 0, 0.3)";
    this.width = 20;
  }
}

/**
 * Find all objects that intersect with the given eraser path
 * Uses bounding box intersection as a fast first pass
 */
export function findObjectsIntersectingPath(
  canvas: Canvas,
  eraserPath: Path
): FabricObject[] {
  if (!eraserPath) return [];

  const eraserBounds = eraserPath.getBoundingRect();
  const intersectingObjects: FabricObject[] = [];

  canvas.getObjects().forEach((obj) => {
    // Skip the eraser path itself and non-erasable objects
    if (obj === eraserPath) return;
    if ((obj as any).isGridLine || (obj as any).isRuler) return;
    if ((obj as any).isGuideLine || (obj as any).isHandleLine) return;
    if ((obj as any).isPreviewLine || (obj as any).isPortIndicator) return;
    if ((obj as any).isFeedback || (obj as any).isControlHandle) return;

    // Check bounding box intersection
    const objBounds = obj.getBoundingRect();

    const intersects =
      eraserBounds.left < objBounds.left + objBounds.width &&
      eraserBounds.left + eraserBounds.width > objBounds.left &&
      eraserBounds.top < objBounds.top + objBounds.height &&
      eraserBounds.top + eraserBounds.height > objBounds.top;

    if (intersects) {
      intersectingObjects.push(obj);
    }
  });

  return intersectingObjects;
}

/**
 * Transform a path from canvas coordinates to object-local coordinates
 * This is critical for making the clipPath move with the object
 */
function transformPathToObjectSpace(
  path: Path,
  targetObject: FabricObject
): Path {
  // Clone the path to avoid modifying the original
  const clonedPath = util.object.clone(path) as Path;

  // Get object's transform matrix
  const objectMatrix = targetObject.calcTransformMatrix();
  const invertedMatrix = util.invertTransform(objectMatrix);

  // Transform each point in the path to object-local space
  if (clonedPath.path) {
    const transformedPath = clonedPath.path.map((segment) => {
      const newSegment = [...segment];

      // Transform coordinate pairs (x,y) using the inverted matrix
      for (let i = 1; i < segment.length; i += 2) {
        if (typeof segment[i] === "number" && typeof segment[i + 1] === "number") {
          const point = util.transformPoint(
            { x: segment[i] as number, y: segment[i + 1] as number },
            invertedMatrix
          );
          newSegment[i] = point.x;
          newSegment[i + 1] = point.y;
        }
      }

      return newSegment;
    });

    clonedPath.path = transformedPath as any;
  }

  // Reset path's position since it's now in object space
  clonedPath.left = 0;
  clonedPath.top = 0;
  clonedPath.setCoords();

  return clonedPath;
}

/**
 * Attach an eraser path to a target object as a clipPath
 * Converts the eraser stroke to object-local coordinates
 */
export function attachEraserToObject(
  eraserPath: Path,
  targetObject: FabricObject,
  canvas: Canvas
): void {
  try {
    // Transform eraser path to object-local coordinates
    const localEraserPath = transformPathToObjectSpace(eraserPath, targetObject);

    // Set composite operation to erase
    localEraserPath.globalCompositeOperation = "destination-out";
    localEraserPath.fill = undefined;
    localEraserPath.stroke = undefined;

    // Handle existing clipPath
    if (targetObject.clipPath) {
      // If object already has a clipPath, we need to merge them
      // Use a Group to hold multiple clipPaths
      const existingClipPath = targetObject.clipPath;

      let clipGroup: Group;

      // Check if existing clipPath is already a Group
      if (existingClipPath instanceof Group) {
        // Add to existing group
        clipGroup = existingClipPath;
        clipGroup.addWithUpdate(localEraserPath);
      } else {
        // Create new group with both clipPaths
        clipGroup = new Group([existingClipPath, localEraserPath], {
          left: 0,
          top: 0,
        });
      }

      targetObject.clipPath = clipGroup;
    } else {
      // No existing clipPath, just assign the eraser path
      targetObject.clipPath = localEraserPath;
    }

    // Ensure clipPath uses relative positioning (moves with object)
    if (targetObject.clipPath) {
      (targetObject.clipPath as any).absolutePositioned = false;
    }

    // Mark object as dirty to force re-render
    targetObject.dirty = true;
  } catch (error) {
    console.error("Error attaching eraser to object:", error);
  }
}
