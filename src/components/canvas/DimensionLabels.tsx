import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas, FabricObject, Text, Rect, Group } from "fabric";
import { useCanvas } from "@/contexts/CanvasContext";

export const useDimensionLabels = () => {
  const { canvas } = useCanvas();
  const labelGroupRef = useRef<Group | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const clearLabel = () => {
      if (labelGroupRef.current) {
        canvas.remove(labelGroupRef.current);
        labelGroupRef.current = null;
        canvas.requestRenderAll();
      }
    };

    const createDimensionLabel = (obj: FabricObject, type: 'position' | 'size'): Group => {
      const bounds = obj.getBoundingRect();
      let labelText = '';
      let left = bounds.left;
      let top = bounds.top;

      if (type === 'position') {
        // Show X, Y coordinates
        labelText = `X: ${Math.round(bounds.left)}, Y: ${Math.round(bounds.top)}`;
        // Position above the object (will be shifted by half its height later)
        left = bounds.left;
        top = bounds.top;
      } else {
        // Show W × H dimensions
        labelText = `${Math.round(bounds.width)} × ${Math.round(bounds.height)}`;
        // Position below-right of the object
        left = bounds.left + bounds.width;
        top = bounds.top + bounds.height + 10;
      }

      const text = new Text(labelText, {
        fontSize: 11,
        fill: '#FFFFFF',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 600,
        left: 0,
        top: 0,
      });

      const padding = 8;
      const background = new Rect({
        width: (text.width || 0) + padding * 2,
        height: (text.height || 0) + padding * 2,
        fill: '#1F2937',
        rx: 4,
        ry: 4,
        left: 0,
        top: 0,
      });

      // Position text with padding offset
      text.set({
        left: padding,
        top: padding,
      });

      const group = new Group([background, text], {
        left,
        top,
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });

      // For position labels, shift up by the group's height plus extra spacing
      if (type === 'position') {
        group.set({
          top: top - (group.height || 0) - 10,
        });
      }

      (group as any).isDimensionLabel = true;
      (group as any).isGuideLine = true;

      return group;
    };

    const showDimensionLabel = (obj: FabricObject, type: 'position' | 'size') => {
      clearLabel();
      const label = createDimensionLabel(obj, type);
      labelGroupRef.current = label;
      canvas.add(label);
      canvas.requestRenderAll();
    };

    // Show position during move
    const handleMoving = (e: any) => {
      if (e.target) {
        showDimensionLabel(e.target, 'position');
      }
    };

    // Show size during scaling/resizing
    const handleScaling = (e: any) => {
      if (e.target) {
        showDimensionLabel(e.target, 'size');
      }
    };

    canvas.on('object:moving', handleMoving);
    canvas.on('object:scaling', handleScaling);
    canvas.on('object:rotating', handleScaling); // Also show dimensions during rotation
    canvas.on('object:modified', clearLabel);
    canvas.on('selection:cleared', clearLabel);
    canvas.on('selection:updated', clearLabel);

    return () => {
      clearLabel();
      canvas.off('object:moving', handleMoving);
      canvas.off('object:scaling', handleScaling);
      canvas.off('object:rotating', handleScaling);
      canvas.off('object:modified');
      canvas.off('selection:cleared');
      canvas.off('selection:updated');
    };
  }, [canvas]);
};

export const DimensionLabels = () => {
  useDimensionLabels();
  return null;
};
