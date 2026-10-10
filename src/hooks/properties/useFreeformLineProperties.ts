import { useState, useEffect, useCallback } from "react";
import { Canvas, Path, FabricObject, Circle, Polygon } from "fabric";
import { useDebouncedCallback } from "use-debounce";
import { beautifyPath, extractPathPoints } from "@/lib/pathSmoothing";
import { pointsToLinearPath } from "@/lib/pathSmoothing";

/**
 * Hook to manage freeform line properties (color, thickness, markers, smoothing)
 */
export const useFreeformLineProperties = (
  selectedObject: any,
  canvas: Canvas | null,
  addToRecentColors: (color: string) => void
) => {
  const [freeformLineColor, setFreeformLineColor] = useState("#000000");
  const [freeformLineThickness, setFreeformLineThickness] = useState(2);
  const [freeformStartMarker, setFreeformStartMarker] = useState<
    "none" | "dot" | "arrow"
  >("none");
  const [freeformEndMarker, setFreeformEndMarker] = useState<
    "none" | "dot" | "arrow"
  >("none");
  const [smoothingStrength, setSmoothingStrength] = useState(50);

  // Helper function to calculate angle from path endpoints
  const getPathEndpointAngle = (path: Path, isStart: boolean): number => {
    const pathData = path.path as any[];
    if (!pathData || pathData.length < 2) return 0;

    let x1, y1, x2, y2;

    if (isStart) {
      const firstCmd = pathData[0];
      const secondCmd = pathData[1];
      x1 = firstCmd[1];
      y1 = firstCmd[2];
      if (secondCmd[0] === "Q") {
        x2 = secondCmd[1];
        y2 = secondCmd[2];
      } else {
        x2 = secondCmd[1];
        y2 = secondCmd[2];
      }
    } else {
      const lastCmd = pathData[pathData.length - 1];
      const prevCmd = pathData[pathData.length - 2];
      if (lastCmd[0] === "Q") {
        x2 = lastCmd[3];
        y2 = lastCmd[4];
        x1 = lastCmd[1];
        y1 = lastCmd[2];
      } else {
        x2 = lastCmd[1];
        y2 = lastCmd[2];
        x1 = prevCmd[prevCmd.length - 2];
        y1 = prevCmd[prevCmd.length - 1];
      }
    }

    return Math.atan2(y2 - y1, x2 - x1);
  };

  // Helper function to get path endpoints
  const getPathEndpoints = (
    path: Path
  ): { start: { x: number; y: number }; end: { x: number; y: number } } => {
    const pathData = path.path as any[];
    if (!pathData || pathData.length === 0) {
      return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
    }

    const firstCmd = pathData[0];
    const lastCmd = pathData[pathData.length - 1];

    const start = { x: firstCmd[1], y: firstCmd[2] };
    const end =
      lastCmd[0] === "Q"
        ? { x: lastCmd[3], y: lastCmd[4] }
        : { x: lastCmd[1], y: lastCmd[2] };

    return { start, end };
  };

  // Update freeform line with markers
  const updateFreeformLineMarkers = (
    path: Path,
    startMarker: "none" | "dot" | "arrow",
    endMarker: "none" | "dot" | "arrow",
    color: string,
    thickness: number
  ) => {
    if (!canvas) return;

    // Store marker info on path
    (path as any).startMarker = startMarker;
    (path as any).endMarker = endMarker;
    (path as any).lineThickness = thickness;

    // Remove existing markers
    const existingGroup = canvas
      .getObjects()
      .find(
        (obj) => (obj as any).isMarkerGroup && (obj as any).pathId === path
      );
    if (existingGroup) {
      canvas.remove(existingGroup);
    }

    // Don't create markers if both are "none"
    if (startMarker === "none" && endMarker === "none") {
      canvas.requestRenderAll();
      return;
    }

    const endpoints = getPathEndpoints(path);
    const markers: FabricObject[] = [];

    // Create start marker
    if (startMarker === "dot") {
      const dot = new Circle({
        radius: thickness * 2,
        fill: color,
        left: endpoints.start.x,
        top: endpoints.start.y,
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
      });
      markers.push(dot);
    } else if (startMarker === "arrow") {
      const angle = getPathEndpointAngle(path, true);
      const arrowSize = thickness * 3;
      const arrow = new Polygon(
        [
          { x: -arrowSize, y: -arrowSize / 2 },
          { x: 0, y: 0 },
          { x: -arrowSize, y: arrowSize / 2 },
        ],
        {
          fill: color,
          left: endpoints.start.x,
          top: endpoints.start.y,
          angle: (angle * 180) / Math.PI,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        }
      );
      markers.push(arrow);
    }

    // Create end marker
    if (endMarker === "dot") {
      const dot = new Circle({
        radius: thickness * 2,
        fill: color,
        left: endpoints.end.x,
        top: endpoints.end.y,
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
      });
      markers.push(dot);
    } else if (endMarker === "arrow") {
      const angle = getPathEndpointAngle(path, false);
      const arrowSize = thickness * 3;
      const arrow = new Polygon(
        [
          { x: 0, y: 0 },
          { x: -arrowSize, y: -arrowSize / 2 },
          { x: -arrowSize, y: arrowSize / 2 },
        ],
        {
          fill: color,
          left: endpoints.end.x,
          top: endpoints.end.y,
          angle: (angle * 180) / Math.PI,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        }
      );
      markers.push(arrow);
    }

    // Group markers
    if (markers.length > 0) {
      const group = new fabric.Group(markers, {
        selectable: false,
        evented: false,
      });
      (group as any).isMarkerGroup = true;
      (group as any).pathId = path;
      canvas.add(group);
      canvas.sendObjectToBack(group);
    }

    canvas.requestRenderAll();
  };

  // Update freeform line properties when selected object changes
  useEffect(() => {
    if (selectedObject && (selectedObject as any).isFreeformLine) {
      const pathObj = selectedObject as Path;
      setFreeformLineColor((pathObj.stroke as string) || "#000000");
      setFreeformLineThickness((pathObj.strokeWidth as number) || 2);
      setFreeformStartMarker((pathObj as any).startMarker || "none");
      setFreeformEndMarker((pathObj as any).endMarker || "none");
      setSmoothingStrength((pathObj as any).currentSmoothingStrength ?? 0);
    }
  }, [selectedObject]);

  const handleFreeformLineColorChange = (color: string) => {
    setFreeformLineColor(color);
    addToRecentColors(color);
    if (canvas && selectedObject && (selectedObject as any).isFreeformLine) {
      const pathObj = selectedObject as Path;
      pathObj.set({ stroke: color });
      updateFreeformLineMarkers(
        pathObj,
        freeformStartMarker,
        freeformEndMarker,
        color,
        freeformLineThickness
      );
      canvas.requestRenderAll();
    }
  };

  const handleFreeformLineThicknessChange = (value: number[]) => {
    const thickness = value[0];
    setFreeformLineThickness(thickness);
    if (canvas && selectedObject && (selectedObject as any).isFreeformLine) {
      const pathObj = selectedObject as Path;
      pathObj.set({ strokeWidth: thickness });
      updateFreeformLineMarkers(
        pathObj,
        freeformStartMarker,
        freeformEndMarker,
        freeformLineColor,
        thickness
      );
      canvas.requestRenderAll();
    }
  };

  const handleFreeformStartMarkerChange = (
    marker: "none" | "dot" | "arrow"
  ) => {
    setFreeformStartMarker(marker);
    if (canvas && selectedObject && (selectedObject as any).isFreeformLine) {
      const pathObj = selectedObject as Path;
      updateFreeformLineMarkers(
        pathObj,
        marker,
        freeformEndMarker,
        freeformLineColor,
        freeformLineThickness
      );
    }
  };

  const handleFreeformEndMarkerChange = (marker: "none" | "dot" | "arrow") => {
    setFreeformEndMarker(marker);
    if (canvas && selectedObject && (selectedObject as any).isFreeformLine) {
      const pathObj = selectedObject as Path;
      updateFreeformLineMarkers(
        pathObj,
        freeformStartMarker,
        marker,
        freeformLineColor,
        freeformLineThickness
      );
    }
  };

  const applySmoothing = useCallback(
    (strength: number) => {
      if (
        !canvas ||
        !selectedObject ||
        !(selectedObject as any).isFreeformLine
      ) {
        return;
      }

      const pathObj = selectedObject as Path;
      let originalPoints = (pathObj as any).originalFreeformPoints;

      // If no original points, extract from current path as fallback
      if (!originalPoints || originalPoints.length === 0) {
        const extractedPoints = extractPathPoints(pathObj);
        (pathObj as any).originalFreeformPoints = extractedPoints;
        (pathObj as any).currentSmoothingStrength = 50; // Assume medium smoothing
        originalPoints = extractedPoints;
      }

      try {
        // Apply smoothing to ORIGINAL points
        let newPathData;
        if (strength === 0) {
          // 0% = raw original path with no smoothing
          newPathData = pointsToLinearPath(originalPoints);
        } else {
          // 1-100% = apply beautification algorithm
          newPathData = beautifyPath(originalPoints, strength);
        }

        // Update path
        pathObj.path = newPathData as any;
        pathObj.setCoords();
        pathObj.dirty = true;

        // Store current smoothing strength
        (pathObj as any).currentSmoothingStrength = strength;

        // Update markers (they depend on path endpoints)
        updateFreeformLineMarkers(
          pathObj,
          freeformStartMarker,
          freeformEndMarker,
          freeformLineColor,
          freeformLineThickness
        );

        canvas.requestRenderAll();
      } catch (error) {
        console.error("Failed to apply smoothing:", error);
      }
    },
    [
      canvas,
      selectedObject,
      freeformStartMarker,
      freeformEndMarker,
      freeformLineColor,
      freeformLineThickness,
    ]
  );

  const debouncedApplySmoothing = useDebouncedCallback(applySmoothing, 500);

  const handleSmoothingStrengthChange = useCallback(
    (strength: number) => {
      setSmoothingStrength(strength);
      debouncedApplySmoothing(strength);
    },
    [debouncedApplySmoothing]
  );

  return {
    freeformLineColor,
    freeformLineThickness,
    freeformStartMarker,
    freeformEndMarker,
    smoothingStrength,
    setFreeformLineColor,
    setFreeformLineThickness,
    setFreeformStartMarker,
    setFreeformEndMarker,
    setSmoothingStrength,
    handleFreeformLineColorChange,
    handleFreeformLineThicknessChange,
    handleFreeformStartMarkerChange,
    handleFreeformEndMarkerChange,
    handleSmoothingStrengthChange,
  };
};
