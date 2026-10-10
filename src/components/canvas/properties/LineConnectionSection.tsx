import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

interface LineConnectionSectionProps {
  smartConnectorsEnabled: boolean;
  autoPathfindingEnabled: boolean;
  onSmartConnectorsChange: (enabled: boolean) => void;
  onAutoPathfindingChange: (enabled: boolean) => void;
  // Per-line settings (when a line is selected)
  selectedLineAutoPathfinding?: boolean;
  selectedLineHasAttachments?: boolean;
  onSelectedLineAutoPathfindingChange?: (enabled: boolean) => void;
  isLineSelected?: boolean;
}

/**
 * Section for line connection controls (smart connectors, pathfinding)
 */
export const LineConnectionSection = ({
  smartConnectorsEnabled,
  autoPathfindingEnabled,
  onSmartConnectorsChange,
  onAutoPathfindingChange,
  selectedLineAutoPathfinding,
  selectedLineHasAttachments,
  onSelectedLineAutoPathfindingChange,
  isLineSelected,
}: LineConnectionSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-line-connection'] ?? false);

  // Use per-line settings if a line is selected, otherwise use global settings
  const effectiveAutoPathfinding = isLineSelected && selectedLineAutoPathfinding !== undefined
    ? selectedLineAutoPathfinding
    : autoPathfindingEnabled;

  const handleAutoPathfindingChange = (enabled: boolean) => {

    if (isLineSelected && onSelectedLineAutoPathfindingChange) {
      onSelectedLineAutoPathfindingChange(enabled);
    } else {
      onAutoPathfindingChange(enabled);
    }
  };

  return (
    <div id="section-line-connection" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-line-connection')}
      >
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Line Connection
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
            {/* Smart Connectors Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Smart Connection</Label>
                <p className="text-[10px] text-muted-foreground">
                  Snap to connection points on objects
                </p>
              </div>
              <Switch
                checked={smartConnectorsEnabled}
                onCheckedChange={onSmartConnectorsChange}
              />
            </div>

            {/* Automatic Pathfinding Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Automatic Pathfinding</Label>
                <p className="text-[10px] text-muted-foreground">
                  Route lines around obstacles automatically
                </p>
              </div>
              <Switch
                checked={effectiveAutoPathfinding}
                onCheckedChange={handleAutoPathfindingChange}
                disabled={!smartConnectorsEnabled}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
