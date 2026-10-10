import { useEffect } from "react";
import { Canvas } from "fabric";
import { toast } from "sonner";

export function useTableTool(
  canvas: Canvas | null,
  activeTool: string,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void
) {
  // Table tool — click to place
  useEffect(() => {
    if (!canvas || activeTool !== "table") return;

    const handleCanvasClick = async (e: any) => {
      const pointer = canvas.getPointer(e.e);
      try {
        const { TableTool } = await import('@/lib/tableTool');
        const tableGroup = TableTool.createDefaultTable(pointer.x, pointer.y);
        canvas.add(tableGroup);
        canvas.setActiveObject(tableGroup);
        canvas.requestRenderAll();
        saveState();
        onToolChange?.("select");
        toast.success("Table added! Configure it in the Properties Panel.");
      } catch (error) {
        console.error("Error creating table:", error);
        toast.error("Failed to create table");
      }
    };

    canvas.on("mouse:down", handleCanvasClick);
    return () => { canvas.off("mouse:down", handleCanvasClick); };
  }, [canvas, activeTool, onToolChange, saveState]);
}
