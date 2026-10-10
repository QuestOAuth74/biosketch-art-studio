import { Button } from "@/components/ui/button";
import { FabricObject } from "fabric";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface LayerOrderSectionProps {
  selectedObject: FabricObject | null;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  stickyOffset?: number;
}

/**
 * Layer order controls with collapsible header
 */
export const LayerOrderSection = ({
  selectedObject,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  stickyOffset = 0,
}: LayerOrderSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-layer-order'] ?? true);

  return (
    <div id="section-layer-order" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-layer-order')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Layer Order
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onBringForward}
            disabled={!selectedObject}
          >
            Bring Forward
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onSendBackward}
            disabled={!selectedObject}
          >
            Send Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onBringToFront}
            disabled={!selectedObject}
          >
            To Front
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onSendToBack}
            disabled={!selectedObject}
          >
            To Back
          </Button>
        </div>
        </div>
      )}
    </div>
  );
};
