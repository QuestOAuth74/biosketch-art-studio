import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartConfig, ChartStyleConfig, DoseResponseConfig, DEFAULT_DOSE_RESPONSE_CONFIG } from "@/lib/chartTool";
import { ColorPickerSection } from "../ColorPickerSection";
import { ChartTestIds } from "@/lib/test-ids";

const GOOGLE_FONTS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
  { value: "Raleway", label: "Raleway" },
  { value: "Ubuntu", label: "Ubuntu" },
  { value: "Oswald", label: "Oswald" },
  { value: "Merriweather", label: "Merriweather (Serif)" },
  { value: "Playfair Display", label: "Playfair Display (Serif)" },
  { value: "Crimson Text", label: "Crimson Text (Serif)" },
  { value: "Source Sans 3", label: "Source Sans 3" },
  { value: "Arial", label: "Arial (System)" },
  { value: "Helvetica", label: "Helvetica (System)" },
  { value: "Georgia", label: "Georgia (System)" },
  { value: "Times New Roman", label: "Times New Roman (System)" },
];

interface ChartStyleSubsectionProps {
  config: ChartConfig;
  onUpdate: (style: ChartStyleConfig) => void;
  onConfigUpdate?: (updates: Partial<ChartConfig>) => void;
  recentColors: string[];
  addToRecentColors: (color: string) => void;
}

export const ChartStyleSubsection = ({
  config,
  onUpdate,
  onConfigUpdate,
  recentColors,
  addToRecentColors
}: ChartStyleSubsectionProps) => {
  const { style, columnMapping } = config;
  const isDoseResponse = config.type === 'dose-response';
  const drConfig = config.doseResponseConfig || DEFAULT_DOSE_RESPONSE_CONFIG;

  if (!style || !columnMapping) return null;

  const handleStyleChange = (updates: Partial<ChartStyleConfig>) => {
    onUpdate({ ...style, ...updates });
  };

  const handleSeriesColorChange = (seriesIndex: number, color: string) => {
    const newColors = [...style.seriesColors];
    newColors[seriesIndex] = color;
    handleStyleChange({ seriesColors: newColors });
  };

  return (
    <div className="space-y-3">
      <div className="border-t border-slate-200 pt-3">
        <Label className="text-xs font-semibold">Style & Appearance</Label>
      </div>

      {/* Font Family */}
      <div className="space-y-1.5">
        <Label className="text-xs">Font Family</Label>
        <Select value={style.fontFamily} onValueChange={(value) => handleStyleChange({ fontFamily: value })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {GOOGLE_FONTS.map((font) => (
              <SelectItem
                key={font.value}
                value={font.value}
                className="text-xs"
                style={{ fontFamily: font.value }}
              >
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label className="text-xs">Chart Title</Label>
        <Input
          value={style.title}
          onChange={(e) => handleStyleChange({ title: e.target.value })}
          className="h-8 text-xs"
          data-testid={ChartTestIds.TITLE_INPUT}
        />
        {/* Title Font Size */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Title Size</Label>
            <span className="text-xs text-muted-foreground font-mono">{style.titleFontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <Slider
              value={[style.titleFontSize]}
              onValueChange={([value]) => handleStyleChange({ titleFontSize: value })}
              min={8}
              max={48}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={style.titleFontSize}
              onChange={(e) => handleStyleChange({ titleFontSize: parseInt(e.target.value) || 16 })}
              className="h-8 w-16 text-xs"
              min="8"
              max="48"
            />
          </div>
        </div>
      </div>

      {/* Axis Labels */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">X-Axis Label</Label>
            <Input
              value={style.xAxisLabel}
              onChange={(e) => handleStyleChange({ xAxisLabel: e.target.value })}
              className="h-8 text-xs"
              data-testid={ChartTestIds.X_AXIS_LABEL_INPUT}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Y-Axis Label</Label>
            <Input
              value={style.yAxisLabel}
              onChange={(e) => handleStyleChange({ yAxisLabel: e.target.value })}
              className="h-8 text-xs"
              data-testid={ChartTestIds.Y_AXIS_LABEL_INPUT}
            />
          </div>
        </div>

        {/* Axis Labels Font Size - single control for both */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Axis Labels Size</Label>
            <span className="text-xs text-muted-foreground font-mono">{style.xAxisLabelFontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <Slider
              value={[style.xAxisLabelFontSize]}
              onValueChange={([value]) => handleStyleChange({
                xAxisLabelFontSize: value,
                yAxisLabelFontSize: value
              })}
              min={8}
              max={32}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={style.xAxisLabelFontSize}
              onChange={(e) => {
                const size = parseInt(e.target.value) || 12;
                handleStyleChange({
                  xAxisLabelFontSize: size,
                  yAxisLabelFontSize: size
                });
              }}
              className="h-8 w-16 text-xs"
              min="8"
              max="32"
            />
          </div>
        </div>
      </div>

      {/* Series Colors */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold">Series Colors</Label>
        {columnMapping.yAxes.map((yIndex, seriesIndex) => {
          const seriesName = config.data.headers[yIndex] || `Series ${seriesIndex + 1}`;
          const color = style.seriesColors[seriesIndex] || '#3B82F6';

          return (
            <ColorPickerSection
              key={seriesIndex}
              label={seriesName}
              value={color}
              onChange={(newColor) => {
                handleSeriesColorChange(seriesIndex, newColor);
                addToRecentColors(newColor);
              }}
              recentColors={recentColors}
              data-testid={`${ChartTestIds.SERIES_COLOR_PICKER}-${seriesIndex}`}
            />
          );
        })}
      </div>

      {/* Dose-Response Options */}
      {isDoseResponse && onConfigUpdate && (
        <div className="space-y-3">
          <div className="border-t border-slate-200 pt-3">
            <Label className="text-xs font-semibold">Dose-Response Options</Label>
          </div>

          {/* Dot Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Dot Size</Label>
              <span className="text-xs text-muted-foreground font-mono">{drConfig.dotSize}px</span>
            </div>
            <Slider
              value={[drConfig.dotSize]}
              onValueChange={([value]) =>
                onConfigUpdate({ doseResponseConfig: { ...drConfig, dotSize: value } })
              }
              min={3}
              max={16}
              step={1}
            />
          </div>

          {/* Curve Color */}
          <ColorPickerSection
            label="Curve Color"
            value={drConfig.curveColor}
            onChange={(color) => {
              onConfigUpdate({ doseResponseConfig: { ...drConfig, curveColor: color } });
              addToRecentColors(color);
            }}
            recentColors={recentColors}
          />

          {/* Curve Width */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Curve Width</Label>
              <span className="text-xs text-muted-foreground font-mono">{drConfig.curveWidth}px</span>
            </div>
            <Slider
              value={[drConfig.curveWidth]}
              onValueChange={([value]) =>
                onConfigUpdate({ doseResponseConfig: { ...drConfig, curveWidth: value } })
              }
              min={1}
              max={6}
              step={0.5}
            />
          </div>

          {/* Log Scale Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="log-scale"
              checked={drConfig.logScale}
              onCheckedChange={(checked) =>
                onConfigUpdate({ doseResponseConfig: { ...drConfig, logScale: checked as boolean } })
              }
            />
            <label htmlFor="log-scale" className="text-xs font-medium leading-none cursor-pointer">
              Log scale X-axis
            </label>
          </div>

          {/* Show EC50 Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-ec50"
              checked={drConfig.showEC50}
              onCheckedChange={(checked) =>
                onConfigUpdate({ doseResponseConfig: { ...drConfig, showEC50: checked as boolean } })
              }
            />
            <label htmlFor="show-ec50" className="text-xs font-medium leading-none cursor-pointer">
              Show EC50 annotation
            </label>
          </div>
        </div>
      )}

      {/* Background Color */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="transparent-background"
            checked={style.transparentBackground ?? false}
            onCheckedChange={(checked) => handleStyleChange({ transparentBackground: checked as boolean })}
          />
          <label
            htmlFor="transparent-background"
            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Transparent background
          </label>
        </div>

        {!style.transparentBackground && (
          <ColorPickerSection
            label="Background Color"
            value={style.backgroundColor}
            onChange={(color) => {
              handleStyleChange({ backgroundColor: color });
              addToRecentColors(color);
            }}
            recentColors={recentColors}
          />
        )}
      </div>

      {/* Show Legend */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="show-legend"
            checked={style.showLegend}
            onCheckedChange={(checked) => handleStyleChange({ showLegend: checked as boolean })}
            data-testid={ChartTestIds.SHOW_LEGEND_CHECKBOX}
          />
          <label
            htmlFor="show-legend"
            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Show Legend
          </label>
        </div>

        {/* Legend Font Size - only show when legend is enabled */}
        {style.showLegend && (
          <div className="space-y-1.5 ml-6">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Legend Size</Label>
              <span className="text-xs text-muted-foreground font-mono">{style.legendFontSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <Slider
                value={[style.legendFontSize]}
                onValueChange={([value]) => handleStyleChange({ legendFontSize: value })}
                min={6}
                max={24}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={style.legendFontSize}
                onChange={(e) => handleStyleChange({ legendFontSize: parseInt(e.target.value) || 10 })}
                className="h-8 w-16 text-xs"
                min="6"
                max="24"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
