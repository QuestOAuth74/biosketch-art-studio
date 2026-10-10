import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCanvas } from "@/contexts/CanvasContext";
import { ShapeWithPorts, ArrowMarkerType, LineStyle, RoutingStyle } from "@/types/connector";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FlowArrowIcon } from "@phosphor-icons/react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { Group, Path } from "fabric";

const THICKNESS_PRESETS = [
  { label: 'Thin', value: 1 },
  { label: 'Medium', value: 2 },
  { label: 'Thick', value: 4 },
  { label: 'Extra Thick', value: 6 },
];

// Standard markers
const STANDARD_MARKERS: { value: ArrowMarkerType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'open-arrow', label: 'Open Arrow' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'circle', label: 'Circle' },
  { value: 'block', label: 'Block' },
  { value: 'tee', label: 'T-bar' },
];

// Biological pathway markers
const BIOLOGICAL_MARKERS: { value: ArrowMarkerType; label: string; description: string }[] = [
  { value: 'inhibition', label: 'Inhibition', description: 'Blocks/inhibits target' },
  { value: 'activation', label: 'Activation', description: 'Activates target' },
  { value: 'phosphorylation', label: 'Phosphorylation', description: 'Adds phosphate group' },
  { value: 'binding', label: 'Binding', description: 'Complex formation' },
  { value: 'catalysis', label: 'Catalysis', description: 'Enzyme activity' },
  { value: 'stimulation', label: 'Stimulation', description: 'Positive regulation' },
];

// Helper function to get stroke dash array based on line style
function getStrokeDashArray(lineStyle: LineStyle): number[] | undefined {
  switch (lineStyle) {
    case 'dashed':
      return [10, 5];
    case 'dotted':
      return [2, 3];
    case 'dash-dot':
      return [10, 5, 2, 5];
    default:
      return undefined;
  }
}

export const LinePropertiesPanel = () => {
  const { selectedObject, canvas } = useCanvas();
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-line-properties'] ?? true);

  if (!selectedObject || !(selectedObject as ShapeWithPorts).isConnector) {
    return null;
  }

  const connector = selectedObject as ShapeWithPorts;
  const data = connector.connectorData;

  if (!data) return null;

  const handleStartMarkerChange = (value: ArrowMarkerType) => {
    if (!data || !canvas) return;

    // Update data
    data.startMarker = value;

    // Just render - the connector system will handle it on next update
    canvas.requestRenderAll();
  };

  const handleEndMarkerChange = (value: ArrowMarkerType) => {
    if (!data || !canvas) return;

    // Update data
    data.endMarker = value;

    // Just render - the connector system will handle it on next update
    canvas.requestRenderAll();
  };

  const handleLineStyleChange = (value: LineStyle) => {
    if (!data || !canvas) return;

    // Update data
    data.lineStyle = value;

    // Get group and path
    const group = connector as Group;
    const objects = group.getObjects();
    const path = objects[0] as Path;

    if (path) {
      // Update path stroke dash array
      path.set({ strokeDashArray: getStrokeDashArray(value) } as any);
      canvas.requestRenderAll();
    }
  };

  const handleRoutingStyleChange = (value: RoutingStyle) => {
    if (!data || !canvas) return;

    // Update data
    data.routingStyle = value;

    // Just render - the connector system will handle it on next update
    canvas.requestRenderAll();
  };

  const handleStrokeWidthChange = (value: number[]) => {
    if (!data || !canvas) return;

    // Update data
    data.strokeWidth = value[0];

    // Get group and path
    const group = connector as Group;
    const objects = group.getObjects();
    const path = objects[0] as Path;

    if (path) {
      // Update path stroke width
      path.set({ strokeWidth: value[0] } as any);
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: connector });
    }
  };

  return (
    <div id="section-line-properties" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-line-properties')}
      >
        <div className="flex items-center gap-2">
          <FlowArrowIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Connector Line
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
          <div className="space-y-3">
          <div>
            <Label className="text-xs">Start Marker</Label>
            <Select value={data.startMarker} onValueChange={handleStartMarkerChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground">Standard</SelectLabel>
                  {STANDARD_MARKERS.map(marker => (
                    <SelectItem key={marker.value} value={marker.value}>{marker.label}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground">Biological Pathway</SelectLabel>
                  {BIOLOGICAL_MARKERS.map(marker => (
                    <SelectItem key={marker.value} value={marker.value}>
                      <span className="flex items-center gap-2">
                        {marker.label}
                        <span className="text-[10px] text-muted-foreground">({marker.description})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">End Marker</Label>
            <Select value={data.endMarker} onValueChange={handleEndMarkerChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground">Standard</SelectLabel>
                  {STANDARD_MARKERS.map(marker => (
                    <SelectItem key={marker.value} value={marker.value}>{marker.label}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground">Biological Pathway</SelectLabel>
                  {BIOLOGICAL_MARKERS.map(marker => (
                    <SelectItem key={marker.value} value={marker.value}>
                      <span className="flex items-center gap-2">
                        {marker.label}
                        <span className="text-[10px] text-muted-foreground">({marker.description})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div>
            <Label className="text-xs">Line Style</Label>
            <Select value={data.lineStyle} onValueChange={handleLineStyleChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
                <SelectItem value="dash-dot">Dash-Dot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Routing Style</Label>
            <Select value={data.routingStyle} onValueChange={handleRoutingStyleChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="straight">Straight</SelectItem>
                <SelectItem value="curved">Curved</SelectItem>
                <SelectItem value="orthogonal">Orthogonal (90°)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div>
            <Label className="text-xs mb-2 block">Stroke Width: {data.strokeWidth}px</Label>
            
            {/* Quick Preset Buttons */}
            <div className="flex gap-1 mb-3">
              {THICKNESS_PRESETS.map((preset) => (
                <Tooltip key={preset.value}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={data.strokeWidth === preset.value ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-8 px-2"
                      onClick={() => handleStrokeWidthChange([preset.value])}
                    >
                      <div 
                        className="w-full rounded-full bg-current"
                        style={{ height: `${Math.min(preset.value * 1.5, 6)}px` }}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{preset.label} ({preset.value}px)</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            
            <Slider
              value={[data.strokeWidth]}
              onValueChange={handleStrokeWidthChange}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
