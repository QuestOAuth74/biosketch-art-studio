import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, Palette, Ban } from "lucide-react";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { LineEndpointType, CornerStyle } from "@/types/effects";
import { cn } from "@/lib/utils";

const THICKNESS_PRESETS = [
  { label: 'Hairline', value: 1 },
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 3 },
  { label: 'Thick', value: 5 },
  { label: 'Extra Thick', value: 8 },
];

interface LineStyleSectionProps {
  lineType: 'straight' | 'curved' | 'orthogonal' | 'bezier';
  startEndpoint: LineEndpointType;
  endEndpoint: LineEndpointType;
  strokeWidth: number;
  dashPattern: 'solid' | 'dashed' | 'dotted' | 'custom';
  customDashArray?: number[];
  cornerStyle: CornerStyle;
  anchorPointCount?: number;
  onLineTypeChange: (type: 'straight' | 'curved' | 'orthogonal' | 'bezier') => void;
  onStartEndpointChange: (type: LineEndpointType) => void;
  onEndEndpointChange: (type: LineEndpointType) => void;
  onStrokeWidthChange: (value: number[]) => void;
  onDashPatternChange: (pattern: 'solid' | 'dashed' | 'dotted' | 'custom') => void;
  onCustomDashArrayChange?: (array: number[]) => void;
  onCornerStyleChange: (style: CornerStyle) => void;
}

/**
 * Renders a visual preview of an endpoint type (marker only, no line)
 */
const EndpointPreview = ({ type, isStart = false, size = 'medium' }: { type: LineEndpointType; isStart?: boolean; size?: 'small' | 'medium' }) => {
  const renderEndpoint = () => {
    const rotation = isStart ? 0 : 180; // Flip: start faces left, end faces right
    const viewBoxSize = 40;
    const center = viewBoxSize / 2;
    const markerSize = 19; // fills most of the smaller viewBox

    switch (type) {
      case 'none':
        return (
          <Ban className="w-full h-full text-muted-foreground/50" />
        );
      case 'arrow':
        return (
          <svg className="w-full h-full" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} preserveAspectRatio="xMidYMid meet">
            <path
              d={`M${center} ${center} L${center + markerSize * 1.1} ${center - markerSize * 0.9} L${center + markerSize * 1.1} ${center + markerSize * 0.9} Z`}
              fill="currentColor"
              transform={`rotate(${rotation}, ${center}, ${center})`}
            />
          </svg>
        );
      case 'circle-hollow':
        return (
          <svg className="w-full h-full" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} preserveAspectRatio="xMidYMid meet">
            <circle cx={center} cy={center} r={markerSize} fill="none" stroke="currentColor" strokeWidth={markerSize * 0.2} />
          </svg>
        );
      case 'circle-filled':
        return (
          <svg className="w-full h-full" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} preserveAspectRatio="xMidYMid meet">
            <circle cx={center} cy={center} r={markerSize} fill="currentColor" />
          </svg>
        );
      case 'dot':
        return (
          <svg className="w-full h-full" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} preserveAspectRatio="xMidYMid meet">
            <circle cx={center} cy={center} r={markerSize * 0.7} fill="currentColor" />
          </svg>
        );
      case 'diamond-hollow':
        return (
          <svg className="w-full h-full" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} preserveAspectRatio="xMidYMid meet">
            <path
              d={`M${center} ${center - markerSize} L${center + markerSize} ${center} L${center} ${center + markerSize} L${center - markerSize} ${center} Z`}
              fill="none"
              stroke="currentColor"
              strokeWidth={markerSize * 0.2}
            />
          </svg>
        );
      case 'diamond-filled':
        return (
          <svg className="w-full h-full" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} preserveAspectRatio="xMidYMid meet">
            <path
              d={`M${center} ${center - markerSize} L${center + markerSize} ${center} L${center} ${center + markerSize} L${center - markerSize} ${center} Z`}
              fill="currentColor"
            />
          </svg>
        );
      case 'inhibitor-bar':
        return (
          <svg className="w-full h-full" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} preserveAspectRatio="xMidYMid meet">
            <line
              x1={center}
              y1={center - markerSize * 1.2}
              x2={center}
              y2={center + markerSize * 1.2}
              stroke="currentColor"
              strokeWidth={markerSize * 0.35}
            />
          </svg>
        );
      case 'right-angle':
        return (
          <svg className="w-full h-full" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} preserveAspectRatio="xMidYMid meet">
            <path
              d={`M${center - markerSize} ${center - markerSize} L${center} ${center} L${center - markerSize} ${center + markerSize}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={markerSize * 0.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`rotate(${rotation}, ${center}, ${center})`}
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center text-foreground w-full h-full">
      {renderEndpoint()}
    </div>
  );
};

/**
 * Renders a visual preview of a dash pattern
 */
const DashPatternPreview = ({ pattern, size = 'medium' }: { pattern: 'solid' | 'dashed' | 'dotted' | 'custom'; size?: 'small' | 'medium' }) => {
  const viewBoxWidth = 300;
  const viewBoxHeight = 40;
  const strokeWidth = size === 'small' ? 3 : 8; // Thinner line
  const margin = 30; // Padding on each side

  const dashArray = size === 'small'
    ? { dashed: "20 10", dotted: "4 7", custom: "18 6 4 6" }
    : { dashed: "10 5", dotted: "2 4", custom: "8 3 2 3" };

  switch (pattern) {
    case 'solid':
      return (
        <svg className="w-full h-full block" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <line x1={margin} y1={viewBoxHeight/2} x2={viewBoxWidth - margin} y2={viewBoxHeight/2} stroke="currentColor" strokeWidth={strokeWidth} />
        </svg>
      );
    case 'dashed':
      return (
        <svg className="w-full h-full block" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <line x1={margin} y1={viewBoxHeight/2} x2={viewBoxWidth - margin} y2={viewBoxHeight/2} stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={dashArray.dashed} />
        </svg>
      );
    case 'dotted':
      return (
        <svg className="w-full h-full block" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <line x1={margin} y1={viewBoxHeight/2} x2={viewBoxWidth - margin} y2={viewBoxHeight/2} stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={dashArray.dotted} strokeLinecap="round" />
        </svg>
      );
    case 'custom':
      return (
        <svg className="w-full h-full block" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <line x1={margin} y1={viewBoxHeight/2} x2={viewBoxWidth - margin} y2={viewBoxHeight/2} stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={dashArray.custom} />
        </svg>
      );
    default:
      return null;
  }
};

const ENDPOINT_OPTIONS: { value: LineEndpointType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'circle-hollow', label: 'Circle (Hollow)' },
  { value: 'circle-filled', label: 'Circle (Filled)' },
  { value: 'dot', label: 'Dot' },
  { value: 'diamond-hollow', label: 'Diamond (Hollow)' },
  { value: 'diamond-filled', label: 'Diamond (Filled)' },
  { value: 'inhibitor-bar', label: 'Inhibitor Bar' },
  { value: 'right-angle', label: 'Right Angle' },
];

const DASH_PATTERN_OPTIONS: { value: 'solid' | 'dashed' | 'dotted' | 'custom'; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

/**
 * Section for line styling controls
 */
export const LineStyleSection = ({
  lineType,
  startEndpoint,
  endEndpoint,
  strokeWidth,
  dashPattern,
  customDashArray,
  cornerStyle,
  anchorPointCount = 2,
  onLineTypeChange,
  onStartEndpointChange,
  onEndEndpointChange,
  onStrokeWidthChange,
  onDashPatternChange,
  onCustomDashArrayChange,
  onCornerStyleChange,
}: LineStyleSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-line-style'] ?? false);

  // Determine which line types are available based on anchor point count
  const canConvertToStraightOrCurved = anchorPointCount === 2;

  return (
    <div id="section-line-style" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-line-style')}
      >
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Line Style
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
            {/* Line Type Selector */}
            <div>
              <Label className="text-xs font-medium">Line Type</Label>
              <Select value={lineType} onValueChange={onLineTypeChange}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight" disabled={!canConvertToStraightOrCurved}>
                    Straight {!canConvertToStraightOrCurved && '(2 points only)'}
                  </SelectItem>
                  <SelectItem value="curved" disabled={!canConvertToStraightOrCurved}>
                    Curved {!canConvertToStraightOrCurved && '(2 points only)'}
                  </SelectItem>
                  <SelectItem value="orthogonal">Orthogonal (90°)</SelectItem>
                  <SelectItem value="bezier">Bezier</SelectItem>
                </SelectContent>
              </Select>
              {!canConvertToStraightOrCurved && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Lines with 3+ anchor points can only be converted to Orthogonal or Bezier
                </p>
              )}
            </div>

            <Separator />

            {/* Visual Line Representation with Popovers */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Line Appearance</Label>
              <div className="flex items-stretch gap-0 border border-slate-200 rounded-md overflow-hidden">
                {/* Start Endpoint Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex-1 h-12 rounded-none border-r border-slate-200 hover:bg-slate-100 p-0 min-h-0"
                    >
                      <EndpointPreview type={startEndpoint} isStart={true} size="small" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground mb-2 px-2">Start Point</div>
                      {ENDPOINT_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          variant={startEndpoint === option.value ? "secondary" : "ghost"}
                          className="w-full justify-start h-10 px-2"
                          onClick={() => onStartEndpointChange(option.value)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="flex-shrink-0">
                              <EndpointPreview type={option.value} isStart={true} size="small" />
                            </div>
                            <span className="text-xs">{option.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Line Style (Dash Pattern) Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex-[2] h-12 rounded-none border-r border-slate-200 hover:bg-slate-100 p-0 min-h-0"
                    >
                      <DashPatternPreview pattern={dashPattern} size="small" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="center">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground mb-2 px-2">Line Style</div>
                      {DASH_PATTERN_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          variant={dashPattern === option.value ? "secondary" : "ghost"}
                          className="w-full justify-start h-10 px-2"
                          onClick={() => onDashPatternChange(option.value)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="flex-shrink-0">
                              <DashPatternPreview pattern={option.value} size="small" />
                            </div>
                            <span className="text-xs">{option.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* End Endpoint Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex-1 h-12 rounded-none hover:bg-slate-100 p-0 min-h-0"
                    >
                      <EndpointPreview type={endEndpoint} isStart={false} size="small" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground mb-2 px-2">End Point</div>
                      {ENDPOINT_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          variant={endEndpoint === option.value ? "secondary" : "ghost"}
                          className="w-full justify-start h-10 px-2"
                          onClick={() => onEndEndpointChange(option.value)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="flex-shrink-0">
                              <EndpointPreview type={option.value} isStart={false} size="small" />
                            </div>
                            <span className="text-xs">{option.label}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            {/* Line Weight */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium">Line Weight</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {strokeWidth}px
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-1 mb-3">
                {THICKNESS_PRESETS.map((preset) => (
                  <Tooltip key={preset.value}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={strokeWidth === preset.value ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-8 px-1"
                        onClick={() => onStrokeWidthChange([preset.value])}
                      >
                        <div
                          className="w-full rounded-full bg-current"
                          style={{ height: `${Math.min(preset.value * 1.5, 8)}px` }}
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
                value={[strokeWidth]}
                onValueChange={onStrokeWidthChange}
                min={1}
                max={20}
                step={1}
                className="w-full"
              />
            </div>

            {/* Corner Style - Only for orthogonal lines */}
            {lineType === 'orthogonal' && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs font-medium">Corner Style</Label>
                  <Select value={cornerStyle || 'sharp'} onValueChange={onCornerStyleChange}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue>
                        {cornerStyle === 'rounded' ? 'Rounded' : cornerStyle === 'beveled' ? 'Beveled' : 'Sharp (90°)'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sharp">Sharp (90°)</SelectItem>
                      <SelectItem value="rounded">Rounded</SelectItem>
                      <SelectItem value="beveled">Beveled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
