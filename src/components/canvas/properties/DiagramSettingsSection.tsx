import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { PAPER_SIZES, getPaperSize } from "@/types/paperSizes";
import { ChevronDown, ChevronRight, Grid3x3, Ruler, Palette } from "lucide-react";
import { CustomDimensionInputs } from "./CustomDimensionInputs";
import { Unit, toPixels } from "@/lib/unitConversion";
import { toast } from "sonner";
import { CanvasSizeTestIds } from "@/lib/test-ids";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { useGridAndRulerStore } from "@/stores/gridAndRulerStore";
import { ColorPickerInput } from "@/components/ColorPicker/ColorPickerInput";

interface DiagramSettingsSectionProps {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  backgroundGradient: boolean;
  setBackgroundGradient: (enabled: boolean) => void;
  gradientStartColor: string;
  setGradientStartColor: (color: string) => void;
  gradientEndColor: string;
  setGradientEndColor: (color: string) => void;
  gradientType: 'linear' | 'radial';
  setGradientType: (type: 'linear' | 'radial') => void;
  gradientAngle: number;
  setGradientAngle: (angle: number) => void;
  gradientCenterX: number;
  setGradientCenterX: (x: number) => void;
  gradientCenterY: number;
  setGradientCenterY: (y: number) => void;
  gradientRadius: number;
  setGradientRadius: (radius: number) => void;
  paperSize: string;
  setPaperSize: (size: string) => void;
  canvasDimensions: { width: number; height: number };
  setCanvasDimensions: (dimensions: { width: number; height: number }) => void;
  customDimensions: { width: number; height: number; unit: Unit };
  setCustomDimensions: (dims: { width: number; height: number; unit: Unit }) => void;
  showBgColor: boolean;
  setShowBgColor: (show: boolean) => void;
}

export const DiagramSettingsSection = ({
  backgroundColor,
  setBackgroundColor,
  backgroundGradient,
  setBackgroundGradient,
  gradientStartColor,
  setGradientStartColor,
  gradientEndColor,
  setGradientEndColor,
  gradientType,
  setGradientType,
  gradientAngle,
  setGradientAngle,
  gradientCenterX,
  setGradientCenterX,
  gradientCenterY,
  setGradientCenterY,
  gradientRadius,
  setGradientRadius,
  paperSize,
  setPaperSize,
  canvasDimensions,
  setCanvasDimensions,
  customDimensions,
  setCustomDimensions,
  showBgColor,
  setShowBgColor,
}: DiagramSettingsSectionProps) => {
  // Grid and ruler state from zustand store
  const gridEnabled = useGridAndRulerStore((state) => state.gridEnabled);
  const setGridEnabled = useGridAndRulerStore((state) => state.setGridEnabled);
  const rulersEnabled = useGridAndRulerStore((state) => state.rulersEnabled);
  const setRulersEnabled = useGridAndRulerStore((state) => state.setRulersEnabled);
  const snapToGrid = useGridAndRulerStore((state) => state.snapToGrid);
  const setSnapToGrid = useGridAndRulerStore((state) => state.setSnapToGrid);
  const gridSize = useGridAndRulerStore((state) => state.gridSize);
  const setGridSize = useGridAndRulerStore((state) => state.setGridSize);
  const gridPattern = useGridAndRulerStore((state) => state.gridPattern);
  const setGridPattern = useGridAndRulerStore((state) => state.setGridPattern);

  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const viewCollapsed = useSectionCollapseStore((state) => state.sections['section-grid-rulers'] ?? true);
  const backgroundCollapsed = useSectionCollapseStore((state) => state.sections['section-background'] ?? true);
  const paperCollapsed = useSectionCollapseStore((state) => state.sections['section-paper-size'] ?? true);

  const handleCustomDimensionsChange = (dims: { width: number; height: number; unit: Unit }) => {
    setCustomDimensions(dims);

    // Convert to pixels
    const pixels = {
      width: toPixels(dims.width, dims.unit),
      height: toPixels(dims.height, dims.unit)
    };

    // Update canvas dimensions to the exact size requested
    setCanvasDimensions(pixels);
  };

  return (
    <>
      {/* Grid and Rulers Settings */}
      <div id="section-grid-rulers" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-grid-rulers')}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider">Grid and Rulers</h3>
          {viewCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>

        {!viewCollapsed && (
          <div className="px-3 pb-3 pt-3">
            <div className="space-y-3">
              {/* Show Grid */}
              <div className="flex items-center justify-between">
                <Label htmlFor="grid" className="text-xs cursor-pointer flex items-center gap-2">
                  <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />
                  Show Grid
                </Label>
                <Checkbox
                  id="grid"
                  checked={gridEnabled}
                  onCheckedChange={(checked) => setGridEnabled(checked as boolean)}
                />
              </div>

              {/* Grid Pattern - CONDITIONAL (only when grid is enabled) */}
              {gridEnabled && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="grid-pattern" className="text-xs">Grid Pattern</Label>
                  <Select value={gridPattern} onValueChange={(value: 'lines' | 'dots' | 'isometric') => setGridPattern(value)}>
                    <SelectTrigger id="grid-pattern" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lines">Lines</SelectItem>
                      <SelectItem value="dots">Dots</SelectItem>
                      <SelectItem value="isometric">Isometric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Grid Size - ALWAYS VISIBLE (moved outside conditional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="grid-size" className="text-xs">Grid Size</Label>
                  <span className="text-xs font-mono text-muted-foreground">{gridSize}px</span>
                </div>
                <Slider
                  id="grid-size"
                  value={[gridSize]}
                  onValueChange={([v]) => setGridSize(v)}
                  min={10}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Snap to Grid - ALWAYS VISIBLE (moved outside conditional) */}
              <div className="flex items-center justify-between">
                <Label htmlFor="snap-grid" className="text-xs">Snap to Grid</Label>
                <Checkbox
                  id="snap-grid"
                  checked={snapToGrid}
                  onCheckedChange={(checked) => setSnapToGrid(checked as boolean)}
                />
              </div>

              {/* Show Rulers */}
              <div className="flex items-center justify-between">
                <Label htmlFor="rulers" className="text-xs cursor-pointer flex items-center gap-2">
                  <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                  Show Rulers
                </Label>
                <Checkbox
                  id="rulers"
                  checked={rulersEnabled}
                  onCheckedChange={(checked) => setRulersEnabled(checked as boolean)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Background Settings */}
      <div id="section-background" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-background')}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider">Background</h3>
          {backgroundCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>

        {!backgroundCollapsed && (
          <div className="px-3 pb-3 pt-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded hover:bg-accent/30 transition-colors">
              <Label htmlFor="bg-color-toggle" className="text-xs cursor-pointer">Solid color</Label>
              <Checkbox
                id="bg-color-toggle"
                checked={showBgColor}
                onCheckedChange={(checked) => {
                  setShowBgColor(checked as boolean);
                  if (checked) setBackgroundGradient(false);
                }}
              />
            </div>
            {showBgColor && (
              <div className="p-2 bg-accent/20 rounded">
                <ColorPickerInput
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                  showPresets={true}
                  showHexInput={true}
                />
              </div>
            )}
            <div className="flex items-center justify-between p-2 rounded hover:bg-accent/30 transition-colors">
              <Label htmlFor="bg-gradient-toggle" className="text-xs cursor-pointer">Gradient</Label>
              <Checkbox
                id="bg-gradient-toggle"
                checked={backgroundGradient}
                onCheckedChange={(checked) => {
                  setBackgroundGradient(checked as boolean);
                  if (checked) setShowBgColor(false);
                }}
              />
            </div>
            {backgroundGradient && (
              <div className="space-y-3 pl-6">
                {/* Gradient Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Gradient Type</Label>
                  <Select value={gradientType} onValueChange={(value: 'linear' | 'radial') => setGradientType(value)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="radial">Radial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Linear Controls */}
                {gradientType === 'linear' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Angle</Label>
                    <div className="flex gap-2 items-center">
                      <Slider
                        value={[gradientAngle]}
                        min={0}
                        max={360}
                        step={1}
                        onValueChange={([v]) => setGradientAngle(v)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={gradientAngle}
                        onChange={(e) => setGradientAngle(Number(e.target.value))}
                        className="h-7 w-16 text-xs"
                        min={0}
                        max={360}
                      />
                    </div>
                  </div>
                )}

                {/* Radial Controls */}
                {gradientType === 'radial' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Center X</Label>
                      <Slider
                        value={[gradientCenterX * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([v]) => setGradientCenterX(v / 100)}
                      />
                      <p className="text-xs text-muted-foreground">{(gradientCenterX * 100).toFixed(0)}%</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Center Y</Label>
                      <Slider
                        value={[gradientCenterY * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={([v]) => setGradientCenterY(v / 100)}
                      />
                      <p className="text-xs text-muted-foreground">{(gradientCenterY * 100).toFixed(0)}%</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Radius</Label>
                      <div className="flex gap-2 items-center">
                        <Slider
                          value={[gradientRadius]}
                          min={10}
                          max={300}
                          step={1}
                          onValueChange={([v]) => setGradientRadius(v)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={gradientRadius}
                          onChange={(e) => setGradientRadius(Number(e.target.value))}
                          className="h-7 w-16 text-xs"
                        />
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Color Stops */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Color Stops</Label>

                  {/* Start Color */}
                  <div className="p-2 border border-border rounded-md space-y-2">
                    <ColorPickerInput
                      label="Start Color"
                      value={gradientStartColor}
                      onChange={setGradientStartColor}
                      showPresets={true}
                      showHexInput={true}
                    />
                    <div className="space-y-1">
                      <Label className="text-xs">Position: 0%</Label>
                    </div>
                  </div>

                  {/* End Color */}
                  <div className="p-2 border border-border rounded-md space-y-2">
                    <ColorPickerInput
                      label="End Color"
                      value={gradientEndColor}
                      onChange={setGradientEndColor}
                      showPresets={true}
                      showHexInput={true}
                    />
                    <div className="space-y-1">
                      <Label className="text-xs">Position: 100%</Label>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Preview</Label>
                  <div
                    className="h-16 rounded-md border border-border"
                    style={{
                      background: gradientType === 'linear'
                        ? `linear-gradient(${gradientAngle}deg, ${gradientStartColor} 0%, ${gradientEndColor} 100%)`
                        : `radial-gradient(circle at ${gradientCenterX * 100}% ${gradientCenterY * 100}%, ${gradientStartColor} 0%, ${gradientEndColor} ${gradientRadius}%)`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {/* Paper Size Settings */}
      <div id="section-paper-size" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-paper-size')}
          data-testid={CanvasSizeTestIds.SIZE_DIALOG_TRIGGER}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider">Paper Size</h3>
          {paperCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>

        {!paperCollapsed && (
          <div className="px-3 pb-3 pt-3">
          <div className="space-y-3">
            <Select value={paperSize} onValueChange={setPaperSize}>
              <SelectTrigger className="h-9 text-xs" data-testid={CanvasSizeTestIds.PAPER_SIZE_SELECT}>
                <SelectValue>
                  {getPaperSize(paperSize)?.name || 'Select size'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[min(400px,var(--radix-select-content-available-height))]" sideOffset={5}>
                {/* Custom Section */}
                {PAPER_SIZES.filter(s => s.category === 'custom').map((size) => (
                  <SelectItem key={size.id} value={size.id} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">{size.name}</span>
                      <span className="text-xs text-muted-foreground">{size.description}</span>
                    </div>
                  </SelectItem>
                ))}
                
                {/* Journal Figures Section */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-2">
                  📊 Journal Figures
                </div>
                {PAPER_SIZES.filter(s => s.category === 'journal').map((size) => (
                  <SelectItem key={size.id} value={size.id} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">{size.name}</span>
                      <span className="text-xs text-muted-foreground">{size.description}</span>
                    </div>
                  </SelectItem>
                ))}
                
                {/* Standard Paper Section */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-2">
                  📄 Standard Paper
                </div>
                {PAPER_SIZES.filter(s => s.category === 'paper').map((size) => (
                  <SelectItem key={size.id} value={size.id} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">{size.name}</span>
                      <span className="text-xs text-muted-foreground">{size.description}</span>
                    </div>
                  </SelectItem>
                ))}
                
                {/* Presentations Section */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-2">
                  🎬 Presentations
                </div>
                {PAPER_SIZES.filter(s => s.category === 'presentation').map((size) => (
                  <SelectItem key={size.id} value={size.id} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">{size.name}</span>
                      <span className="text-xs text-muted-foreground">{size.description}</span>
                    </div>
                  </SelectItem>
                ))}
                
                {/* Posters Section */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 mt-2">
                  📐 Posters
                </div>
                {PAPER_SIZES.filter(s => s.category === 'poster').map((size) => (
                  <SelectItem key={size.id} value={size.id} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">{size.name}</span>
                      <span className="text-xs text-muted-foreground">{size.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show custom dimension inputs when "Custom" paper size is selected */}
            {paperSize === 'custom' && (
              <CustomDimensionInputs
                customDimensions={customDimensions}
                onDimensionsChange={handleCustomDimensionsChange}
              />
            )}

            <div className="text-xs text-muted-foreground bg-accent/20 p-2 rounded">
              Canvas: {canvasDimensions.width} × {canvasDimensions.height}px
            </div>
          </div>
          </div>
        )}
      </div>
    </>
  );
};
