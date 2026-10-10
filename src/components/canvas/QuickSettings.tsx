import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GearIcon } from "@phosphor-icons/react";
import { useCanvas } from "@/contexts/CanvasContext";
import { CanvasEditorTestIds } from "@/lib/test-ids";

export const QuickSettings = () => {
  const { 
    gridEnabled, 
    setGridEnabled, 
    rulersEnabled, 
    setRulersEnabled,
    snapToGrid,
    setSnapToGrid,
    gridSize,
    setGridSize,
    backgroundGradient,
    setBackgroundGradient,
    gridPattern,
    setGridPattern,
  } = useCanvas();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          data-testid={CanvasEditorTestIds.QUICK_SETTINGS_BUTTON}
        >
          <GearIcon style={{ width: 18, height: 18 }} weight="regular" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 bg-[#f0f9ff]" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Canvas Settings</h4>
            <p className="text-xs text-muted-foreground">Quick access to common settings</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="background-gradient" className="text-sm">Gradient Background</Label>
              <Switch 
                id="background-gradient"
                checked={backgroundGradient} 
                onCheckedChange={setBackgroundGradient} 
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="show-grid" className="text-sm">Show Grid</Label>
              <Switch
                id="show-grid"
                checked={gridEnabled}
                onCheckedChange={setGridEnabled}
                data-testid={CanvasEditorTestIds.GRID_TOGGLE}
              />
            </div>
            
            {gridEnabled && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label htmlFor="grid-pattern" className="text-sm">Grid Pattern</Label>
                <Select value={gridPattern} onValueChange={(value: 'lines' | 'dots' | 'isometric') => setGridPattern(value)}>
                  <SelectTrigger id="grid-pattern" className="h-8">
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
            
            <div className="flex items-center justify-between">
              <Label htmlFor="smart-guides" className="text-sm">Show Rulers</Label>
              <Switch 
                id="smart-guides"
                checked={rulersEnabled} 
                onCheckedChange={setRulersEnabled} 
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="snap-grid" className="text-sm">Snap to Grid</Label>
              <Switch
                id="snap-grid"
                checked={snapToGrid}
                onCheckedChange={setSnapToGrid}
                data-testid={CanvasEditorTestIds.SNAP_TO_GRID_TOGGLE}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="grid-size" className="text-sm">Grid Size</Label>
                <span className="text-xs text-muted-foreground">{gridSize}px</span>
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
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
