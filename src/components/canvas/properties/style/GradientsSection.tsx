import { GradientPanel } from "../../GradientPanel";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface GradientsSectionProps {
  stickyOffset?: number;
}

/**
 * Gradients section with collapsible header
 */
export const GradientsSection = ({ stickyOffset = 0 }: GradientsSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-gradients'] ?? true);

  return (
    <div id="section-gradients" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-gradients')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Gradients
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
          <GradientPanel />
        </div>
      )}
    </div>
  );
};
