import { useEffect, useState } from "react";
import { Canvas as FabricCanvas, FabricObject, Path, Line, Circle } from "fabric";
import { useCanvas } from "@/contexts/CanvasContext";
import { ShapeWithPorts } from "@/types/connector";
import { addLineMiddleHandle } from "@/lib/advancedLineSystem";

export const LineEditingHandles = () => {
  const { canvas, selectedObject } = useCanvas();
  const [middleHandle, setMiddleHandle] = useState<Circle | null>(null);

  useEffect(() => {
    if (!canvas || !selectedObject) {
      // Clean up existing handle
      if (middleHandle) {
        canvas.remove(middleHandle);
        setMiddleHandle(null);
      }
      return;
    }

    // Check if selected object is a line/path
    const isLine = selectedObject instanceof Path || selectedObject instanceof Line;
    const isConnector = (selectedObject as ShapeWithPorts).isConnector;

    if (isLine && !isConnector) {
      // Add middle handle for reshaping
      const handle = addLineMiddleHandle(canvas, selectedObject, (x, y) => {
        // TODO: Add waypoint at this position
      });
      
      if (handle) {
        setMiddleHandle(handle);
      }
    } else {
      // Clean up handle if not a line
      if (middleHandle) {
        canvas.remove(middleHandle);
        setMiddleHandle(null);
      }
    }

    return () => {
      if (middleHandle && canvas) {
        canvas.remove(middleHandle);
      }
    };
  }, [canvas, selectedObject, middleHandle]);

  return null; // This component only manages handles, no render
};
