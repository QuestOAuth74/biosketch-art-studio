import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Canvas, Group, Path, util } from "fabric";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BracketsSquareIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface BracketPropertiesSectionProps {
  selectedObject: any;
  canvas: Canvas | null;
  bracketSize: number;
  bracketGap: number;
  setBracketSize: (size: number) => void;
  setBracketGap: (gap: number) => void;
  stickyOffset?: number;
}

/**
 * Bracket properties section
 * Controls for bracket size and depth (gap)
 * No accordion per guidelines (consolidate related properties, make always visible)
 */
export const BracketPropertiesSection = ({
  selectedObject,
  canvas,
  bracketSize,
  bracketGap,
  setBracketSize,
  setBracketGap,
  stickyOffset = 0,
}: BracketPropertiesSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-bracket'] ?? true);

  const handleSizeChange = (value: number[]) => {
    const newSize = value[0];
    setBracketSize(newSize);
    const group = selectedObject as Group;
    const orientation = (group as any).bracketOrientation;
    const gap = (group as any).bracketGap || 15;

    // Store new size
    (group as any).bracketSize = newSize;

    // Get stored local coordinates
    const localBracketCenter = (group as any).bracketLocalCenter;
    const localLabelEdge = (group as any).labelLocalEdge;

    if (localBracketCenter && localLabelEdge) {
      // Recalculate bracket connection point
      const bracketConnectionPoint = {
        ...localBracketCenter,
      };
      if (orientation === "right") {
        bracketConnectionPoint.x = localBracketCenter.x - gap;
      } else if (orientation === "left") {
        bracketConnectionPoint.x = localBracketCenter.x + gap;
      } else if (orientation === "bottom") {
        bracketConnectionPoint.y = localBracketCenter.y - gap;
      } else {
        bracketConnectionPoint.y = localBracketCenter.y + gap;
      }

      // Update line path
      const linePath = group.getObjects()[1] as Path;
      if (linePath) {
        const linePathData = `M ${localLabelEdge.x} ${localLabelEdge.y} L ${bracketConnectionPoint.x} ${bracketConnectionPoint.y}`;
        linePath.set({
          path: util.makePathSimpler(util.parsePath(linePathData) as any),
        });
      }

      // Update bracket path
      const bracketPath = group.getObjects()[0] as Path;
      if (bracketPath) {
        const halfSize = newSize / 2;
        const center = localBracketCenter;

        let bracketPathData: string;
        if (orientation === "right") {
          bracketPathData = `M ${center.x} ${center.y - halfSize}
                      L ${center.x - gap} ${center.y - halfSize}
                      L ${center.x - gap} ${center.y + halfSize}
                      L ${center.x} ${center.y + halfSize}`;
        } else if (orientation === "left") {
          bracketPathData = `M ${center.x} ${center.y - halfSize}
                      L ${center.x + gap} ${center.y - halfSize}
                      L ${center.x + gap} ${center.y + halfSize}
                      L ${center.x} ${center.y + halfSize}`;
        } else if (orientation === "bottom") {
          bracketPathData = `M ${center.x - halfSize} ${center.y}
                      L ${center.x - halfSize} ${center.y - gap}
                      L ${center.x + halfSize} ${center.y - gap}
                      L ${center.x + halfSize} ${center.y}`;
        } else {
          bracketPathData = `M ${center.x - halfSize} ${center.y}
                      L ${center.x - halfSize} ${center.y + gap}
                      L ${center.x + halfSize} ${center.y + gap}
                      L ${center.x + halfSize} ${center.y}`;
        }

        bracketPath.set({
          path: util.makePathSimpler(util.parsePath(bracketPathData) as any),
        });
      }

      // Don't recalculate group dimensions - keep the large fixed size to prevent clipping
      group.dirty = true;
      group.setCoords();
      canvas?.requestRenderAll();
    }
  };

  const handleGapChange = (value: number[]) => {
    const newGap = value[0];
    setBracketGap(newGap);
    const group = selectedObject as Group;
    const orientation = (group as any).bracketOrientation;
    const size = (group as any).bracketSize || 60;

    // Store new gap
    (group as any).bracketGap = newGap;

    // Get stored local coordinates
    const localBracketCenter = (group as any).bracketLocalCenter;
    const localLabelEdge = (group as any).labelLocalEdge;

    if (localBracketCenter && localLabelEdge) {
      // Recalculate bracket connection point with new gap
      const bracketConnectionPoint = {
        ...localBracketCenter,
      };
      if (orientation === "right") {
        bracketConnectionPoint.x = localBracketCenter.x - newGap;
      } else if (orientation === "left") {
        bracketConnectionPoint.x = localBracketCenter.x + newGap;
      } else if (orientation === "bottom") {
        bracketConnectionPoint.y = localBracketCenter.y - newGap;
      } else {
        bracketConnectionPoint.y = localBracketCenter.y + newGap;
      }

      // Update line path
      const linePath = group.getObjects()[1] as Path;
      if (linePath) {
        const linePathData = `M ${localLabelEdge.x} ${localLabelEdge.y} L ${bracketConnectionPoint.x} ${bracketConnectionPoint.y}`;
        linePath.set({
          path: util.makePathSimpler(util.parsePath(linePathData) as any),
        });
      }

      // Update bracket path with new gap
      const bracketPath = group.getObjects()[0] as Path;
      if (bracketPath) {
        const halfSize = size / 2;
        const center = localBracketCenter;

        let bracketPathData: string;
        if (orientation === "right") {
          bracketPathData = `M ${center.x} ${center.y - halfSize}
                      L ${center.x - newGap} ${center.y - halfSize}
                      L ${center.x - newGap} ${center.y + halfSize}
                      L ${center.x} ${center.y + halfSize}`;
        } else if (orientation === "left") {
          bracketPathData = `M ${center.x} ${center.y - halfSize}
                      L ${center.x + newGap} ${center.y - halfSize}
                      L ${center.x + newGap} ${center.y + halfSize}
                      L ${center.x} ${center.y + halfSize}`;
        } else if (orientation === "bottom") {
          bracketPathData = `M ${center.x - halfSize} ${center.y}
                      L ${center.x - halfSize} ${center.y - newGap}
                      L ${center.x + halfSize} ${center.y - newGap}
                      L ${center.x + halfSize} ${center.y}`;
        } else {
          bracketPathData = `M ${center.x - halfSize} ${center.y}
                      L ${center.x - halfSize} ${center.y + newGap}
                      L ${center.x + halfSize} ${center.y + newGap}
                      L ${center.x + halfSize} ${center.y}`;
        }

        bracketPath.set({
          path: util.makePathSimpler(util.parsePath(bracketPathData) as any),
        });
      }

      // Don't recalculate group dimensions - keep the large fixed size to prevent clipping
      group.dirty = true;
      group.setCoords();
      canvas?.requestRenderAll();
    }
  };

  return (
    <div id="section-bracket" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-bracket')}
      >
        <div className="flex items-center gap-2">
          <BracketsSquareIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Bracket
          </h3>
        </div>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Size (Height/Width)</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {bracketSize}px
                </span>
              </div>
              <Slider
                value={[bracketSize]}
                onValueChange={handleSizeChange}
                min={20}
                max={200}
                step={5}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Depth</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {bracketGap}px
                </span>
              </div>
              <Slider
                value={[bracketGap]}
                onValueChange={handleGapChange}
                min={5}
                max={50}
                step={5}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
