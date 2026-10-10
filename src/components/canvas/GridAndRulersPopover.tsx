import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GridFourIcon } from "@phosphor-icons/react";
import { useGridAndRulerStore } from "@/stores/gridAndRulerStore";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const GridAndRulersPopover = () => {
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

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-blue-200/60 transition-colors"
              data-testid={CanvasEditorTestIds.GRID_AND_RULERS_BUTTON}
            >
              <GridFourIcon style={{ width: 18, height: 18 }} weight="bold" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Grid & Rulers</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80 bg-[#f0f9ff]" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Grid & Rulers</h4>
            <p className="text-xs text-muted-foreground">Configure grid and ruler settings</p>
          </div>

          <div className="space-y-4">
            {/* Show Grid */}
            <div className="flex items-center justify-between">
              <Label htmlFor="show-grid" className="text-sm">Show Grid</Label>
              <Switch
                id="show-grid"
                checked={gridEnabled}
                onCheckedChange={setGridEnabled}
                data-testid={CanvasEditorTestIds.GRID_TOGGLE}
              />
            </div>

            {/* Grid Pattern - CONDITIONAL (only when grid enabled) */}
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

            {/* Grid Size - ALWAYS VISIBLE (moved outside conditional) */}
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

            {/* Snap to Grid - ALWAYS VISIBLE (moved outside conditional) */}
            <div className="flex items-center justify-between">
              <Label htmlFor="snap-grid" className="text-sm">Snap to Grid</Label>
              <Switch
                id="snap-grid"
                checked={snapToGrid}
                onCheckedChange={setSnapToGrid}
                data-testid={CanvasEditorTestIds.SNAP_TO_GRID_TOGGLE}
              />
            </div>

            {/* Show Rulers */}
            <div className="flex items-center justify-between">
              <Label htmlFor="show-rulers" className="text-sm">Show Rulers</Label>
              <Switch
                id="show-rulers"
                checked={rulersEnabled}
                onCheckedChange={setRulersEnabled}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
