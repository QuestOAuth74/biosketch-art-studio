import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FabricObject } from "fabric";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface PositionSectionProps {
  selectedObject: FabricObject | null;
  position: { x: number; y: number };
  onPositionChange: (axis: "x" | "y", value: number) => void;
  stickyOffset?: number;
}

/**
 * Position controls with collapsible header
 */
export const PositionSection = ({
  selectedObject,
  position,
  onPositionChange,
  stickyOffset = 0,
}: PositionSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-position'] ?? true);

  return (
    <div id="section-position" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-position')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Position
        </h3>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">X</Label>
              <Input
                type="number"
                value={position.x}
                onChange={(e) => onPositionChange("x", Number(e.target.value))}
                disabled={!selectedObject}
                className="h-8 text-xs"
                data-testid={CanvasEditorTestIds.OBJECT_X_INPUT}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Y</Label>
              <Input
                type="number"
                value={position.y}
                onChange={(e) => onPositionChange("y", Number(e.target.value))}
                disabled={!selectedObject}
                className="h-8 text-xs"
                data-testid={CanvasEditorTestIds.OBJECT_Y_INPUT}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
