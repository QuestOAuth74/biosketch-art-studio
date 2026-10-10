import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricObject, Line } from "fabric";
import { useCanvas } from "@/contexts/CanvasContext";

interface SpacingLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export const useSpacingGuides = () => {
  const { canvas } = useCanvas();
  const guideLinesRef = useRef<Line[]>([]);
  const [labels, setLabels] = useState<SpacingLabel[]>([]);
  const distanceThreshold = 200; // Don't show guides for objects farther than this

  useEffect(() => {
    if (!canvas) return;

    const clearGuides = () => {
      guideLinesRef.current.forEach(line => {
        canvas.remove(line);
      });
      guideLinesRef.current = [];
      setLabels([]);
      canvas.requestRenderAll();
    };

    const showSpacingGuides = (movingObj: FabricObject) => {
      clearGuides();

      // Don't show guides for anchor handles, control handles, or handle lines
      if ((movingObj as any).isAnchorHandle ||
          (movingObj as any).isControlHandle ||
          (movingObj as any).isHandleLine) {
        return;
      }

      // Count icons on canvas (not all objects)
      const MAX_ICONS_FOR_GUIDES = 100;
      const iconCount = canvas.getObjects().filter((obj: any) =>
        obj.isLibraryIcon || obj.iconId
      ).length;

      // Disable guides if too many icons
      if (iconCount > MAX_ICONS_FOR_GUIDES) {
        return;
      }

      // Filter out non-relevant objects
      const allObjects = canvas.getObjects().filter(
        obj => obj !== movingObj &&
        obj.visible &&
        !(obj as any).isGridLine &&
        !(obj as any).isRuler &&
        !(obj as any).isGuideLine &&
        !(obj as any).isSpacingGuide &&
        !(obj as any).isAnchorHandle &&
        !(obj as any).isControlHandle &&
        !(obj as any).isHandleLine
      );

      if (allObjects.length === 0) return;

      const movingBounds = movingObj.getBoundingRect();
      const movingRight = movingBounds.left + movingBounds.width;
      const movingBottom = movingBounds.top + movingBounds.height;
      const movingCenterX = movingBounds.left + movingBounds.width / 2;
      const movingCenterY = movingBounds.top + movingBounds.height / 2;

      interface SpacingGuideInfo {
        distance: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        isSuggestion?: boolean;
        matchingGaps?: ExistingGapInfo[];
      }

      interface ExistingGapInfo {
        distance: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }

      // Separate guides by actual direction (left, right, top, bottom)
      const leftGuides: SpacingGuideInfo[] = [];
      const rightGuides: SpacingGuideInfo[] = [];
      const topGuides: SpacingGuideInfo[] = [];
      const bottomGuides: SpacingGuideInfo[] = [];
      const existingHorizontalGaps: ExistingGapInfo[] = [];
      const existingVerticalGaps: ExistingGapInfo[] = [];

      // First pass: collect all existing gaps between static objects with their positions
      for (let i = 0; i < allObjects.length; i++) {
        for (let j = i + 1; j < allObjects.length; j++) {
          const obj1 = allObjects[i].getBoundingRect();
          const obj2 = allObjects[j].getBoundingRect();

          const obj1Right = obj1.left + obj1.width;
          const obj1Bottom = obj1.top + obj1.height;
          const obj2Right = obj2.left + obj2.width;
          const obj2Bottom = obj2.top + obj2.height;

          // Check vertical overlap for horizontal gaps
          const verticalOverlap = !(obj1Bottom < obj2.top || obj1.top > obj2Bottom);
          if (verticalOverlap) {
            if (obj2.left > obj1Right) {
              const centerY = Math.max(obj1.top, obj2.top) +
                            (Math.min(obj1Bottom, obj2Bottom) - Math.max(obj1.top, obj2.top)) / 2;
              existingHorizontalGaps.push({
                distance: obj2.left - obj1Right,
                x1: obj1Right,
                y1: centerY,
                x2: obj2.left,
                y2: centerY
              });
            } else if (obj1.left > obj2Right) {
              const centerY = Math.max(obj1.top, obj2.top) +
                            (Math.min(obj1Bottom, obj2Bottom) - Math.max(obj1.top, obj2.top)) / 2;
              existingHorizontalGaps.push({
                distance: obj1.left - obj2Right,
                x1: obj2Right,
                y1: centerY,
                x2: obj1.left,
                y2: centerY
              });
            }
          }

          // Check horizontal overlap for vertical gaps
          const horizontalOverlap = !(obj1Right < obj2.left || obj1.left > obj2Right);
          if (horizontalOverlap) {
            if (obj2.top > obj1Bottom) {
              const centerX = Math.max(obj1.left, obj2.left) +
                            (Math.min(obj1Right, obj2Right) - Math.max(obj1.left, obj2.left)) / 2;
              existingVerticalGaps.push({
                distance: obj2.top - obj1Bottom,
                x1: centerX,
                y1: obj1Bottom,
                x2: centerX,
                y2: obj2.top
              });
            } else if (obj1.top > obj2Bottom) {
              const centerX = Math.max(obj1.left, obj2.left) +
                            (Math.min(obj1Right, obj2Right) - Math.max(obj1.left, obj2.left)) / 2;
              existingVerticalGaps.push({
                distance: obj1.top - obj2Bottom,
                x1: centerX,
                y1: obj2Bottom,
                x2: centerX,
                y2: obj1.top
              });
            }
          }
        }
      }

      // Helper function to find all matching gaps (for display - exact match only)
      const findMatchingGaps = (newGap: number, existingGaps: ExistingGapInfo[], threshold = 0.5): ExistingGapInfo[] => {
        return existingGaps.filter(gap => Math.abs(newGap - gap.distance) <= threshold);
      };

      // Calculate spacing to nearby objects
      allObjects.forEach(target => {
        const targetBounds = target.getBoundingRect();
        const targetRight = targetBounds.left + targetBounds.width;
        const targetBottom = targetBounds.top + targetBounds.height;

        // Check for vertical overlap (for horizontal spacing)
        const verticalOverlap = !(
          movingBottom < targetBounds.top ||
          movingBounds.top > targetBottom
        );

        if (verticalOverlap) {
          // Object to the right
          if (targetBounds.left > movingRight) {
            const gap = targetBounds.left - movingRight;
            if (gap <= distanceThreshold) {
              const centerY = Math.max(movingBounds.top, targetBounds.top) +
                            (Math.min(movingBottom, targetBottom) - Math.max(movingBounds.top, targetBounds.top)) / 2;
              const matchingGaps = findMatchingGaps(gap, existingHorizontalGaps);
              rightGuides.push({
                distance: gap,
                x1: movingRight,
                y1: centerY,
                x2: targetBounds.left,
                y2: centerY,
                isSuggestion: matchingGaps.length > 0,
                matchingGaps: matchingGaps
              });
            }
          }
          // Object to the left
          else if (targetRight < movingBounds.left) {
            const gap = movingBounds.left - targetRight;
            if (gap <= distanceThreshold) {
              const centerY = Math.max(movingBounds.top, targetBounds.top) +
                            (Math.min(movingBottom, targetBottom) - Math.max(movingBounds.top, targetBounds.top)) / 2;
              const matchingGaps = findMatchingGaps(gap, existingHorizontalGaps);
              leftGuides.push({
                distance: gap,
                x1: targetRight,
                y1: centerY,
                x2: movingBounds.left,
                y2: centerY,
                isSuggestion: matchingGaps.length > 0,
                matchingGaps: matchingGaps
              });
            }
          }
        }

        // Check for horizontal overlap (for vertical spacing)
        const horizontalOverlap = !(
          movingRight < targetBounds.left ||
          movingBounds.left > targetRight
        );

        if (horizontalOverlap) {
          // Object below
          if (targetBounds.top > movingBottom) {
            const gap = targetBounds.top - movingBottom;
            if (gap <= distanceThreshold) {
              const centerX = Math.max(movingBounds.left, targetBounds.left) +
                            (Math.min(movingRight, targetRight) - Math.max(movingBounds.left, targetBounds.left)) / 2;
              const matchingGaps = findMatchingGaps(gap, existingVerticalGaps);
              bottomGuides.push({
                distance: gap,
                x1: centerX,
                y1: movingBottom,
                x2: centerX,
                y2: targetBounds.top,
                isSuggestion: matchingGaps.length > 0,
                matchingGaps: matchingGaps
              });
            }
          }
          // Object above
          else if (targetBottom < movingBounds.top) {
            const gap = movingBounds.top - targetBottom;
            if (gap <= distanceThreshold) {
              const centerX = Math.max(movingBounds.left, targetBounds.left) +
                            (Math.min(movingRight, targetRight) - Math.max(movingBounds.left, targetBounds.left)) / 2;
              const matchingGaps = findMatchingGaps(gap, existingVerticalGaps);
              topGuides.push({
                distance: gap,
                x1: centerX,
                y1: targetBottom,
                x2: centerX,
                y2: movingBounds.top,
                isSuggestion: matchingGaps.length > 0,
                matchingGaps: matchingGaps
              });
            }
          }
        }
      });

      // Sort each direction and keep only the closest
      leftGuides.sort((a, b) => a.distance - b.distance);
      rightGuides.sort((a, b) => a.distance - b.distance);
      topGuides.sort((a, b) => a.distance - b.distance);
      bottomGuides.sort((a, b) => a.distance - b.distance);

      // Collect the closest guide from each direction
      const allDirectionalGuides = [
        ...leftGuides.slice(0, 1),
        ...rightGuides.slice(0, 1),
        ...topGuides.slice(0, 1),
        ...bottomGuides.slice(0, 1)
      ];

      const newLabels: SpacingLabel[] = [];

      // Helper function to create guide and its label
      const createGuideWithLabel = (guide: SpacingGuideInfo, directionId: string) => {
        const line = createSpacingGuideLine(guide.x1, guide.y1, guide.x2, guide.y2, guide.isSuggestion);
        guideLinesRef.current.push(line);
        canvas.add(line);

        // Create label data for HTML rendering
        const midX = (guide.x1 + guide.x2) / 2;
        const midY = (guide.y1 + guide.y2) / 2;
        const color = guide.isSuggestion ? '#EC4899' : '#3B82F6';
        newLabels.push({
          id: directionId,
          text: Math.round(guide.distance).toString(),
          x: midX,
          y: midY,
          color
        });

        // If this is a suggestion, show matching gaps (limit to 2 closest)
        if (guide.isSuggestion && guide.matchingGaps) {
          const MAX_MATCHING_GAPS = 2;

          // Sort matching gaps by distance to get closest ones
          const sortedGaps = [...guide.matchingGaps].sort((a, b) => {
            // Calculate distance from moving object to gap
            const distA = Math.hypot(
              (a.x1 + a.x2) / 2 - movingCenterX,
              (a.y1 + a.y2) / 2 - movingCenterY
            );
            const distB = Math.hypot(
              (b.x1 + b.x2) / 2 - movingCenterX,
              (b.y1 + b.y2) / 2 - movingCenterY
            );
            return distA - distB;
          });

          sortedGaps.slice(0, MAX_MATCHING_GAPS).forEach((matchGap, matchIndex) => {
            const matchLine = createSpacingGuideLine(matchGap.x1, matchGap.y1, matchGap.x2, matchGap.y2, true);
            guideLinesRef.current.push(matchLine);
            canvas.add(matchLine);

            const matchMidX = (matchGap.x1 + matchGap.x2) / 2;
            const matchMidY = (matchGap.y1 + matchGap.y2) / 2;
            newLabels.push({
              id: `${directionId}-match-${matchIndex}`,
              text: Math.round(matchGap.distance).toString(),
              x: matchMidX,
              y: matchMidY,
              color: '#EC4899'
            });
          });
        }
      };

      // Create guides for each direction
      allDirectionalGuides.forEach((guide, index) => {
        const directionNames = ['left', 'right', 'top', 'bottom'];
        createGuideWithLabel(guide, directionNames[index] || `dir-${index}`);
      });

      setLabels(newLabels);
      movingObj.setCoords();
      canvas.requestRenderAll();
    };

    const createSpacingGuideLine = (x1: number, y1: number, x2: number, y2: number, isSuggestion?: boolean): Line => {
      // Use pink/magenta for smart suggestions, blue for regular spacing guides
      const color = isSuggestion ? '#EC4899' : '#3B82F6'; // Pink-500 for suggestions, Blue-500 for regular

      const line = new Line([x1, y1, x2, y2], {
        stroke: color,
        strokeWidth: isSuggestion ? 1.5 : 1,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      (line as any).isSpacingGuide = true;
      (line as any).isGuideLine = true; // Also mark as guide line for filtering
      return line;
    };

    // Throttle spacing guides to improve performance and prevent memory buildup
    let throttleTimer: NodeJS.Timeout | null = null;
    let lastUpdate = 0;
    const THROTTLE_DELAY = 50; // Update every 50ms max

    canvas.on('object:moving', (e) => {
      if (e.target) {
        const now = Date.now();

        // Clear any pending timer
        if (throttleTimer) {
          clearTimeout(throttleTimer);
        }

        // If enough time has passed since last update, run immediately
        if (now - lastUpdate >= THROTTLE_DELAY) {
          showSpacingGuides(e.target);
          lastUpdate = now;
        } else {
          // Otherwise, schedule an update
          throttleTimer = setTimeout(() => {
            showSpacingGuides(e.target!);
            lastUpdate = Date.now();
            throttleTimer = null;
          }, THROTTLE_DELAY - (now - lastUpdate));
        }
      }
    });

    canvas.on('object:modified', clearGuides);
    canvas.on('selection:cleared', clearGuides);
    canvas.on('selection:updated', clearGuides);

    return () => {
      clearGuides();
      canvas.off('object:moving');
      canvas.off('object:modified');
      canvas.off('selection:cleared');
      canvas.off('selection:updated');
    };
  }, [canvas]);

  return labels;
};

export const SpacingGuides = () => {
  const labels = useSpacingGuides();
  const { canvas, zoom } = useCanvas();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!canvas || !overlayRef.current) return;

    const updateOffset = () => {
      const canvasElement = canvas.getElement();
      const overlayElement = overlayRef.current;

      if (canvasElement && overlayElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        const overlayRect = overlayElement.getBoundingClientRect();

        // getBoundingClientRect() returns viewport-relative coordinates
        // which already account for scroll, so we just need the difference
        setCanvasOffset({
          left: canvasRect.left - overlayRect.left,
          top: canvasRect.top - overlayRect.top,
        });
      }
    };

    updateOffset();

    // Find scroll container and listen to its scroll events
    const overlayElement = overlayRef.current;
    let scrollContainer = overlayElement?.parentElement;
    while (scrollContainer) {
      const hasScrollableContent =
        scrollContainer.scrollHeight > scrollContainer.clientHeight ||
        scrollContainer.scrollWidth > scrollContainer.clientWidth;

      const hasOverflowStyle =
        window.getComputedStyle(scrollContainer).overflow !== 'visible' ||
        window.getComputedStyle(scrollContainer).overflowX !== 'visible' ||
        window.getComputedStyle(scrollContainer).overflowY !== 'visible';

      if (hasScrollableContent && hasOverflowStyle) {
        break;
      }
      scrollContainer = scrollContainer.parentElement;
    }

    window.addEventListener('resize', updateOffset);
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updateOffset);
    }

    return () => {
      window.removeEventListener('resize', updateOffset);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', updateOffset);
      }
    };
  }, [canvas, zoom]);

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-50">
      {labels.map(label => {
        // Apply zoom factor to canvas coordinates to get screen position
        const zoomFactor = zoom / 100;
        const screenX = label.x * zoomFactor;
        const screenY = label.y * zoomFactor;

        return (
          <div
            key={label.id}
            className="absolute"
            style={{
              left: `${screenX + canvasOffset.left}px`,
              top: `${screenY + canvasOffset.top}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="px-1.5 py-0.5 rounded font-semibold text-xs whitespace-nowrap"
              style={{
                backgroundColor: '#FFFFFF',
                color: label.color,
                border: `1.5px solid ${label.color}`,
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {label.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};
