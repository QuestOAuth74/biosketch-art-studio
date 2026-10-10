import { Button } from "@/components/ui/button";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Canvas } from "fabric";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface AlignmentSectionProps {
  canvas: Canvas | null;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignMiddle: () => void;
  onAlignBottom: () => void;
  stickyOffset?: number;
}

/**
 * Alignment controls with collapsible header
 */
export const AlignmentSection = ({
  canvas,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  stickyOffset = 0,
}: AlignmentSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-alignment'] ?? true);
  const activeObjects = canvas?.getActiveObjects() || [];
  const canAlign = activeObjects.length >= 2;

  return (
    <div id="section-alignment" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-alignment')}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          Alignment
        </h3>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-3 space-y-3">
          {/* Horizontal alignment */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              Horizontal
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onAlignLeft}
                disabled={!canAlign}
              >
                <AlignLeft className="h-3.5 w-3.5 mr-1" />
                Left
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onAlignCenter}
                disabled={!canAlign}
              >
                <AlignCenter className="h-3.5 w-3.5 mr-1" />
                Center
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onAlignRight}
                disabled={!canAlign}
              >
                <AlignRight className="h-3.5 w-3.5 mr-1" />
                Right
              </Button>
            </div>
          </div>

          {/* Vertical alignment */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">Vertical</div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onAlignTop}
                disabled={!canAlign}
              >
                <AlignVerticalJustifyStart className="h-3.5 w-3.5 mr-1" />
                Top
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onAlignMiddle}
                disabled={!canAlign}
              >
                <AlignVerticalJustifyCenter className="h-3.5 w-3.5 mr-1" />
                Middle
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onAlignBottom}
                disabled={!canAlign}
              >
                <AlignVerticalJustifyEnd className="h-3.5 w-3.5 mr-1" />
                Bottom
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
