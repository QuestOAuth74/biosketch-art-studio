import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScribbleIcon } from "@phosphor-icons/react";
import { useCanvas } from "@/contexts/CanvasContext";
import {
  IntersectionBehavior,
  DEFAULT_INTERSECTION_CONFIG,
  LineIntersectionConfig,
} from "@/types/effects";
import { LineIntersectionRenderer } from "@/lib/lineIntersectionRenderer";
import { Path } from "fabric";
import { useEffect, useState } from "react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";

export const LineIntersectionPanel = () => {
  const { selectedObject, canvas } = useCanvas();
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-intersection-style'] ?? true);
  const [localConfig, setLocalConfig] = useState<LineIntersectionConfig>(DEFAULT_INTERSECTION_CONFIG);

  // Sync local state when selectedObject changes - MUST be before any early returns
  useEffect(() => {
    if (selectedObject) {
      const storedConfig = (selectedObject as any).intersectionConfig || DEFAULT_INTERSECTION_CONFIG;
      setLocalConfig(storedConfig);
    }
  }, [selectedObject]);
  // Only show for line/path objects
  if (!selectedObject) return null;

  // Check if it's any type of line or path
  const isLine =
    (selectedObject as any).isStraightLine ||
    (selectedObject as any).isCurvedLine ||
    (selectedObject as any).isOrthogonalLine ||
    (selectedObject as any).isBezierPath ||
    (selectedObject as any).isFreeformLine ||
    selectedObject instanceof Path;

  if (!isLine) return null;

  // Get the actual path object (could be the object itself or mainPath for groups)
  let pathObject: Path | null = null;
  if (selectedObject instanceof Path) {
    pathObject = selectedObject;
  } else if ((selectedObject as any).mainPath instanceof Path) {
    pathObject = (selectedObject as any).mainPath;
  } else if ((selectedObject as any).getObjects) {
    // For groups, try to find the first Path object
    const objects = (selectedObject as any).getObjects();
    pathObject = objects.find((obj: any) => obj instanceof Path) || null;
  }

  // Only show if we have a valid path
  if (!pathObject) {
    return null;
  }

  const intersectionCount = (selectedObject as any).intersectionCount || 0;
  const applyBehavior = (newConfig: LineIntersectionConfig) => {
    if (!canvas || !pathObject) {
      return;
    }

    // Update local state
    setLocalConfig(newConfig);

    // Store on object
    (selectedObject as any).intersectionConfig = newConfig;
    // Trigger re-render with new behavior using the actual path object
    const renderer = new LineIntersectionRenderer(
      pathObject,
      newConfig
    );
    renderer.render();
    (selectedObject as any).intersectionCount = renderer.getIntersectionCount();

    canvas.requestRenderAll();
  };

  const handleBehaviorChange = (behavior: IntersectionBehavior) => {
    const newConfig = { ...localConfig, behavior };
    applyBehavior(newConfig);
  };

  const handleArcRadiusChange = (value: number[]) => {
    const newConfig = { ...localConfig, arcRadius: value[0] };
    applyBehavior(newConfig);
  };

  const handleGapSizeChange = (value: number[]) => {
    const newConfig = { ...localConfig, gapSize: value[0] };
    applyBehavior(newConfig);
  };

  const handleBridgeWidthChange = (value: number[]) => {
    const newConfig = { ...localConfig, bridgeWidth: value[0] };
    applyBehavior(newConfig);
  };

  return (
    <div id="section-intersection-style" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-intersection-style')}
      >
        <div className="flex items-center gap-2 flex-1">
          <ScribbleIcon className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Intersection Style
            </h3>
            {intersectionCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {intersectionCount} crossing{intersectionCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
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
            {/* Behavior Selection */}
            <div className="space-y-3">
              <RadioGroup
                value={localConfig.behavior}
                onValueChange={(value) => {
                  handleBehaviorChange(value as IntersectionBehavior);
                }}
                className="space-y-1"
              >
                <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="cross" id="cross" />
                  <Label
                    htmlFor="cross"
                    className="text-xs cursor-pointer flex-1"
                  >
                    <div className="font-medium">Cross (Default)</div>
                    <div className="text-muted-foreground">
                      Lines cross normally
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="arc" id="arc" />
                  <Label htmlFor="arc" className="text-xs cursor-pointer flex-1">
                    <div className="font-medium">Arc (Jump)</div>
                    <div className="text-muted-foreground">
                      Draw arc over crossing
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="gap" id="gap" />
                  <Label htmlFor="gap" className="text-xs cursor-pointer flex-1">
                    <div className="font-medium">Gap (Break)</div>
                    <div className="text-muted-foreground">
                      Break line at crossing
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="bridge" id="bridge" />
                  <Label
                    htmlFor="bridge"
                    className="text-xs cursor-pointer flex-1"
                  >
                    <div className="font-medium">Bridge (Over/Under)</div>
                    <div className="text-muted-foreground">
                      One line appears over the other
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Arc-specific controls */}
            {localConfig.behavior === "arc" && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Arc Radius</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {localConfig.arcRadius || 8}px
                  </span>
                </div>
                <Slider
                  value={[localConfig.arcRadius || 8]}
                  onValueChange={handleArcRadiusChange}
                  min={4}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground">
                  Height of the jump arc
                </p>
              </div>
            )}

            {/* Gap-specific controls */}
            {localConfig.behavior === "gap" && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Gap Size</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {localConfig.gapSize || 10}px
                  </span>
                </div>
                <Slider
                  value={[localConfig.gapSize || 10]}
                  onValueChange={handleGapSizeChange}
                  min={4}
                  max={24}
                  step={2}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground">
                  Size of the break at crossing
                </p>
              </div>
            )}

            {/* Bridge-specific controls */}
            {localConfig.behavior === "bridge" && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Bridge Width</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {localConfig.bridgeWidth ||
                      ((selectedObject as any).strokeWidth || 2) + 4}
                    px
                  </span>
                </div>
                <Slider
                  value={[
                    localConfig.bridgeWidth ||
                      ((selectedObject as any).strokeWidth || 2) + 4,
                  ]}
                  onValueChange={handleBridgeWidthChange}
                  min={2}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground">
                  Width of the white outline creating depth
                </p>
              </div>
            )}
          </div>
      </div>
      )}
    </div>
  );
};
