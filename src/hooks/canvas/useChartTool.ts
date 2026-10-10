import { useEffect } from "react";
import { Canvas } from "fabric";
import { toast } from "sonner";
import { ChartTool } from "@/lib/chartTool";

export function useChartTool(
  canvas: Canvas | null,
  activeTool: string,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void
) {
  // Chart Tool Handler - Click-based chart insertion
  useEffect(() => {
    if (!canvas || activeTool !== "chart") return;


    const handleCanvasClick = async (e: any) => {
      const pointer = canvas.getPointer(e.e);

      try {
        const chartGroup = await ChartTool.createPlaceholderChart(pointer.x, pointer.y);
        canvas.add(chartGroup);
        canvas.setActiveObject(chartGroup);
        canvas.requestRenderAll();
        saveState();
        onToolChange?.("select");
        toast.success("Chart added! Configure it in the Properties Panel.");
      } catch (error) {
        console.error("Error creating chart:", error);
        toast.error("Failed to create chart");
      }
    };

    canvas.on("mouse:down", handleCanvasClick);

    return () => {
      canvas.off("mouse:down", handleCanvasClick);
    };
  }, [canvas, activeTool, onToolChange, saveState]);
}
