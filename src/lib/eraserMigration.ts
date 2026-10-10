import { Canvas, Path } from "fabric";
import { findObjectsIntersectingPath, attachEraserToObject } from "./eraserTool";

/**
 * Detect and migrate old eraser paths from legacy implementation
 * Old implementation used globalCompositeOperation='destination-out' with isEraserPath flag
 * New implementation uses object-level clipPaths
 *
 * @param canvas - The Fabric.js canvas instance
 * @returns true if migration occurred, false otherwise
 */
export function migrateOldEraserPaths(canvas: Canvas): boolean {
  let migrated = false;
  const oldEraserPaths: Path[] = [];

  // Find all old eraser paths
  canvas.getObjects().forEach((obj) => {
    // Check for old eraser paths by isEraserPath flag or destination-out composite operation
    if (
      ((obj as any).isEraserPath || obj.globalCompositeOperation === "destination-out") &&
      obj instanceof Path
    ) {
      oldEraserPaths.push(obj);
    }
  });

  // No old eraser paths found - no migration needed
  if (oldEraserPaths.length === 0) {
    return false;
  }
  // For each old eraser path, convert it to object-level clipPaths
  oldEraserPaths.forEach((eraserPath) => {
    try {
      // Find objects that intersect with this eraser path
      const affectedObjects = findObjectsIntersectingPath(canvas, eraserPath);

      if (affectedObjects.length > 0) {
        // Apply eraser as clipPath to each affected object
        affectedObjects.forEach((obj) => {
          try {
            attachEraserToObject(eraserPath, obj, canvas);
            migrated = true;
          } catch (error) {
            console.error("Error attaching eraser to object during migration:", error);
          }
        });
      }

      // Remove the old eraser path from canvas
      canvas.remove(eraserPath);
    } catch (error) {
      console.error("Error processing old eraser path during migration:", error);
    }
  });

  // Re-render canvas after migration
  if (migrated) {
    canvas.requestRenderAll();
  }

  return migrated;
}
