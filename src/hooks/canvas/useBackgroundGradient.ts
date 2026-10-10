import { useEffect } from "react";
import { Gradient, type Canvas } from "fabric";

/**
 * Hook #6: Manages canvas background color and gradient.
 * Extracted from FabricCanvas.tsx lines 3269-3324.
 */
export function useBackgroundGradient(
  canvas: Canvas | null,
  backgroundColor: string,
  backgroundGradient: boolean,
  gradientStartColor: string,
  gradientEndColor: string,
  gradientType: 'linear' | 'radial',
  gradientAngle: number,
  gradientCenterX: number,
  gradientCenterY: number,
  gradientRadius: number,
) {
  useEffect(() => {
    if (!canvas) return;

    if (backgroundGradient) {
      const width = canvas.width || 1200;
      const height = canvas.height || 800;

      let coords: any;

      if (gradientType === 'linear') {
        const angleRad = (gradientAngle - 90) * (Math.PI / 180);
        const diagonal = Math.sqrt(width * width + height * height);

        const x1 = width / 2 - (Math.cos(angleRad) * diagonal) / 2;
        const y1 = height / 2 - (Math.sin(angleRad) * diagonal) / 2;
        const x2 = width / 2 + (Math.cos(angleRad) * diagonal) / 2;
        const y2 = height / 2 + (Math.sin(angleRad) * diagonal) / 2;

        coords = { x1, y1, x2, y2 };
      } else {
        const centerX = width * gradientCenterX;
        const centerY = height * gradientCenterY;
        const r2 = Math.max(width, height) * (gradientRadius / 100);

        coords = {
          x1: centerX, y1: centerY,
          x2: centerX, y2: centerY,
          r1: 0, r2,
        };
      }

      const gradient = new Gradient({
        type: gradientType,
        coords,
        colorStops: [
          { offset: 0, color: gradientStartColor },
          { offset: 1, color: gradientEndColor }
        ]
      });
      canvas.backgroundColor = gradient;
    } else {
      canvas.backgroundColor = backgroundColor;
    }

    canvas.requestRenderAll();
  }, [canvas, backgroundColor, backgroundGradient, gradientStartColor, gradientEndColor, gradientType, gradientAngle, gradientCenterX, gradientCenterY, gradientRadius]);
}
