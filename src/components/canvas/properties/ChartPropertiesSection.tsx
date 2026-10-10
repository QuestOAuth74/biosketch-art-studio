import { Canvas, FabricObject } from "fabric";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ChartBarIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { getChartConfig, isChart, ChartConfig, ChartTool } from "@/lib/chartTool";
import { ChartDataSubsection } from "./chart/ChartDataSubsection";
import { ChartTypeSubsection } from "./chart/ChartTypeSubsection";
import { ChartStyleSubsection } from "./chart/ChartStyleSubsection";
import { useState } from "react";

interface ChartPropertiesSectionProps {
  selectedObject: FabricObject | null;
  canvas: Canvas | null;
}

/**
 * Section for chart specific properties
 * Contains three subsections: Data, Type, and Style
 */
export const ChartPropertiesSection = ({
  selectedObject,
  canvas,
}: ChartPropertiesSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-chart'] ?? false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  if (!selectedObject || !canvas) return null;

  const chartConfig = getChartConfig(selectedObject);
  if (!chartConfig) return null;

  const handleConfigUpdate = async (updates: Partial<ChartConfig>) => {
    // Get the current active object from canvas to ensure we have the latest reference
    const currentChart = canvas.getActiveObject();
    if (!currentChart || !isChart(currentChart)) return;

    const currentConfig = getChartConfig(currentChart);
    if (!currentConfig) return;

    const newConfig = { ...currentConfig, ...updates };
    await ChartTool.updateChart(currentChart as any, canvas, newConfig);
  };

  const addToRecentColors = (color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 8);
    });
  };

  return (
    <div id="section-chart" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-chart')}
      >
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Chart
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
            {/* Data Subsection */}
            <ChartDataSubsection
              config={chartConfig}
              onUpdate={(data) => handleConfigUpdate({ data })}
            />

            {/* Type Subsection */}
            <ChartTypeSubsection
              config={chartConfig}
              onUpdate={(updates) => handleConfigUpdate(updates)}
              recentColors={recentColors}
              addToRecentColors={addToRecentColors}
            />

            {/* Style Subsection */}
            <ChartStyleSubsection
              config={chartConfig}
              onUpdate={(style) => handleConfigUpdate({ style })}
              onConfigUpdate={handleConfigUpdate}
              recentColors={recentColors}
              addToRecentColors={addToRecentColors}
            />
          </div>
        </div>
      )}
    </div>
  );
};
