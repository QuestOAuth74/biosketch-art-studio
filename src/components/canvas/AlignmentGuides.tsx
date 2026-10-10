import { useCanvas } from "@/contexts/CanvasContext";
import { FabricObject, Line } from "fabric";
import { useEffect, useRef } from "react";

export const useAlignmentGuides = () => {
  const { canvas } = useCanvas();
  const guideLinesRef = useRef<Line[]>([]);
  const snapThreshold = 5;

  useEffect(() => {
    if (!canvas) return;

    const clearGuides = () => {
      guideLinesRef.current.forEach((line) => {
        canvas.remove(line);
      });
      guideLinesRef.current = [];
      canvas.requestRenderAll();
    };

    const showAlignmentGuides = (movingObj: FabricObject) => {
      clearGuides();

      // Don't show guides for anchor handles, control handles, or handle lines
      if ((movingObj as any).isAnchorHandle ||
          (movingObj as any).isControlHandle ||
          (movingObj as any).isHandleLine) {
        return;
      }

      // Count icons on canvas (not all objects)
      const MAX_ICONS_FOR_GUIDES = 250;
      const iconCount = canvas
        .getObjects()
        .filter((obj: any) => obj.isLibraryIcon || obj.iconId).length;

      // Disable guides if too many icons
      if (iconCount > MAX_ICONS_FOR_GUIDES) {
        return;
      }

      const allObjects = canvas
        .getObjects()
        .filter(
          (obj) =>
            obj !== movingObj &&
            obj.visible &&
            !(obj as any).isGridLine &&
            !(obj as any).isRuler &&
            !(obj as any).isGuideLine &&
            !(obj as any).isAnchorHandle &&
            !(obj as any).isControlHandle &&
            !(obj as any).isHandleLine,
        );

      const movingBounds = movingObj.getBoundingRect();
      const movingCenterX = movingBounds.left + movingBounds.width / 2;
      const movingCenterY = movingBounds.top + movingBounds.height / 2;
      const movingRight = movingBounds.left + movingBounds.width;
      const movingBottom = movingBounds.top + movingBounds.height;

      // Collect all potential alignments with distances
      interface AlignmentCandidate {
        distance: number;
        coords: [number, number, number, number];
        priority: number; // 1 = center, 2 = edge
      }

      const alignments: AlignmentCandidate[] = [];

      allObjects.forEach((target) => {
        const targetBounds = target.getBoundingRect();
        const targetCenterX = targetBounds.left + targetBounds.width / 2;
        const targetCenterY = targetBounds.top + targetBounds.height / 2;
        const targetRight = targetBounds.left + targetBounds.width;
        const targetBottom = targetBounds.top + targetBounds.height;

        // Center alignments (priority 1)
        const centerXDist = Math.abs(movingCenterX - targetCenterX);
        if (centerXDist < snapThreshold) {
          alignments.push({
            distance: centerXDist,
            coords: [targetCenterX, 0, targetCenterX, canvas.height || 0],
            priority: 1,
          });
        }

        const centerYDist = Math.abs(movingCenterY - targetCenterY);
        if (centerYDist < snapThreshold) {
          alignments.push({
            distance: centerYDist,
            coords: [0, targetCenterY, canvas.width || 0, targetCenterY],
            priority: 1,
          });
        }

        // Edge alignments (priority 2)
        const leftDist = Math.abs(movingBounds.left - targetBounds.left);
        if (leftDist < snapThreshold) {
          alignments.push({
            distance: leftDist,
            coords: [
              targetBounds.left,
              0,
              targetBounds.left,
              canvas.height || 0,
            ],
            priority: 2,
          });
        }

        const rightDist = Math.abs(movingRight - targetRight);
        if (rightDist < snapThreshold) {
          alignments.push({
            distance: rightDist,
            coords: [targetRight, 0, targetRight, canvas.height || 0],
            priority: 2,
          });
        }

        const topDist = Math.abs(movingBounds.top - targetBounds.top);
        if (topDist < snapThreshold) {
          alignments.push({
            distance: topDist,
            coords: [0, targetBounds.top, canvas.width || 0, targetBounds.top],
            priority: 2,
          });
        }

        const bottomDist = Math.abs(movingBottom - targetBottom);
        if (bottomDist < snapThreshold) {
          alignments.push({
            distance: bottomDist,
            coords: [0, targetBottom, canvas.width || 0, targetBottom],
            priority: 2,
          });
        }
      });

      // Sort by priority (center first), then by distance (closest first)
      alignments.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.distance - b.distance;
      });

      // Limit to 6 lines total
      const MAX_ALIGNMENT_LINES = 6;
      const selectedAlignments = alignments.slice(0, MAX_ALIGNMENT_LINES);

      // Create guide lines for selected alignments
      selectedAlignments.forEach((alignment) => {
        const line = createGuideLine(alignment.coords);
        guideLinesRef.current.push(line);
        canvas.add(line);
      });

      movingObj.setCoords();
      canvas.requestRenderAll();
    };

    const createGuideLine = (
      coords: [number, number, number, number],
    ): Line => {
      const line = new Line(coords, {
        stroke: "#FF00FF",
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      (line as any).isGuideLine = true;
      return line;
    };

    canvas.on("object:moving", (e) => {
      if (e.target) {
        showAlignmentGuides(e.target);
      }
    });

    canvas.on("object:modified", clearGuides);
    canvas.on("selection:cleared", clearGuides);
    canvas.on("selection:updated", clearGuides);

    return () => {
      clearGuides();
      canvas.off("object:moving");
      canvas.off("object:modified");
      canvas.off("selection:cleared");
      canvas.off("selection:updated");
    };
  }, [canvas]);
};

export const AlignmentGuides = () => {
  useAlignmentGuides();
  return null;
};
