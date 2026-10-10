import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FabricObject } from "fabric";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface SizeSectionProps {
  selectedObject: FabricObject | null;
  size: { width: number; height: number };
  onSizeChange: (dimension: "width" | "height", value: number) => void;
  stickyOffset?: number;
}

/**
 * Size controls with collapsible header
 */
export const SizeSection = ({
  selectedObject,
  size,
  onSizeChange,
  stickyOffset = 0,
}: SizeSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-size'] ?? true);

  return (
    <div id="section-size" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-size')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Size
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
              <Label className="text-xs">Width</Label>
              <Input
                type="number"
                value={size.width}
                onChange={(e) => onSizeChange("width", Number(e.target.value))}
                disabled={!selectedObject || selectedObject.lockScalingX}
                className="h-8 text-xs"
                data-testid={CanvasEditorTestIds.OBJECT_WIDTH_INPUT}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Height</Label>
              <Input
                type="number"
                value={size.height}
                onChange={(e) => onSizeChange("height", Number(e.target.value))}
                disabled={!selectedObject || selectedObject.lockScalingY}
                className="h-8 text-xs"
                data-testid={CanvasEditorTestIds.OBJECT_HEIGHT_INPUT}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
