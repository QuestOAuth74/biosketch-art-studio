import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Canvas, Group } from "fabric";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ArrowBendRightDownIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface LeaderLinePropertiesSectionProps {
  selectedObject: any;
  canvas: Canvas | null;
  showLeaderLineArrow: boolean;
  setShowLeaderLineArrow: (show: boolean) => void;
  stickyOffset?: number;
}

/**
 * Leader line properties section with collapsible header
 */
export const LeaderLinePropertiesSection = ({
  selectedObject,
  canvas,
  showLeaderLineArrow,
  setShowLeaderLineArrow,
  stickyOffset = 0,
}: LeaderLinePropertiesSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-leader-line'] ?? true);

  return (
    <div id="section-leader-line" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-leader-line')}
      >
        <div className="flex items-center gap-2">
          <ArrowBendRightDownIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Leader Line
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
          <div className="flex items-center justify-between">
        <Label className="text-xs">Show Arrow</Label>
        <Checkbox
          checked={showLeaderLineArrow}
          onCheckedChange={(checked) => {
            if (!canvas) return;

            setShowLeaderLineArrow(checked as boolean);
            const group = selectedObject as Group;
            const objects = group.getObjects();

            // Arrow is always the second element (index 1)
            if (objects.length > 1) {
              const arrow = objects[1];
              arrow.set({
                visible: checked as boolean,
              });
              group.dirty = true;
              group.setCoords();
              canvas.requestRenderAll();
            }
          }}
        />
          </div>
        </div>
      )}
    </div>
  );
};
