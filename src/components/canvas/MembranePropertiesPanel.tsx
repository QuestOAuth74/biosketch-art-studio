import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUp, ArrowRight, ArrowDown, ArrowLeft, ChevronDown, ChevronRight, ChevronLeft, Search } from "lucide-react";
import { WavesIcon } from "@phosphor-icons/react";
import { Group, util, Point as FabricPoint, loadSVGFromString } from "fabric";
import { useCanvas } from "@/contexts/CanvasContext";
import { toast } from "sonner";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { MembraneEditState } from "@/lib/membraneEditMode";
import { MembranePathTool } from "@/lib/membranePathTool";
import { BezierPoint } from "@/types/bezier";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { sanitizeSVG } from "@/lib/utils";

interface MembranePropertiesPanelProps {
  membrane: Group;
}

export const MembranePropertiesPanel = ({ membrane }: MembranePropertiesPanelProps) => {
  const {
    canvas,
    isMembraneEditMode,
    membraneEditModeRef,
  } = useCanvas();
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const isCollapsed = useSectionCollapseStore((state) => state.sections['section-membrane'] ?? true);

  // Get current membrane options
  const membraneOptions = (membrane as any).membraneOptions || {
    iconSize: 40,
    spacing: 0,
    rotateToPath: true,
    doubleSided: true,
    orientationOffset: 270,
  };

  const [iconSize, setIconSize] = useState(membraneOptions.iconSize);
  const [spacing, setSpacing] = useState(membraneOptions.spacing);
  const [rotateToPath, setRotateToPath] = useState(membraneOptions.rotateToPath);
  const [doubleSided, setDoubleSided] = useState(membraneOptions.doubleSided);
  const [orientationOffset, setOrientationOffset] = useState(membraneOptions.orientationOffset);

  const iconCount = membrane?._objects?.length || 0;

  // Icon replacement selector state
  const [iconSearchQuery, setIconSearchQuery] = useState("");
  const [membraneOnlyFilter, setMembraneOnlyFilter] = useState(true);
  const [selectedReplacementIcon, setSelectedReplacementIcon] = useState<string | null>(null);
  const [iconPage, setIconPage] = useState(0);
  const [loadedReplacementIcons, setLoadedReplacementIcons] = useState<any[]>([]);
  const [totalIconCount, setTotalIconCount] = useState(0);

  const ICONS_PER_PAGE = 20;

  // Fetch icons for replacement with pagination
  const { data: iconPageData, isLoading: isLoadingIcons } = useQuery({
    queryKey: ['membrane-replacement-icons', iconSearchQuery, membraneOnlyFilter, iconPage],
    queryFn: async () => {
      // Build count query
      let countQuery = supabase
        .from('icons')
        .select('id', { count: 'exact', head: true });

      // Build data query
      let dataQuery = supabase
        .from('icons')
        .select('id, name, thumbnail, svg_content, category');

      // Apply filters to both queries
      if (membraneOnlyFilter) {
        countQuery = countQuery.eq('is_membrane_icon', true);
        dataQuery = dataQuery.eq('is_membrane_icon', true);
      }

      if (iconSearchQuery.trim()) {
        countQuery = countQuery.ilike('name', `%${iconSearchQuery.trim()}%`);
        dataQuery = dataQuery.ilike('name', `%${iconSearchQuery.trim()}%`);
      }

      // Get total count (only on first page)
      if (iconPage === 0) {
        const { count } = await countQuery;
        setTotalIconCount(count || 0);
      }

      // Get paginated data
      const offset = iconPage * ICONS_PER_PAGE;
      const { data, error } = await dataQuery
        .order('name')
        .range(offset, offset + ICONS_PER_PAGE - 1);

      if (error) throw error;
      return data || [];
    },
  });

  // Handle new page data - replace icons for true pagination
  useEffect(() => {
    if (iconPageData !== undefined) {
      setLoadedReplacementIcons(iconPageData || []);
    }
  }, [iconPageData, iconPage]);

  // Reset page and count when filters change
  useEffect(() => {
    setIconPage(0);
    setTotalIconCount(0);
  }, [iconSearchQuery, membraneOnlyFilter]);

  // Pagination helpers
  const getTotalPages = () => Math.ceil(totalIconCount / ICONS_PER_PAGE);
  const hasNextPage = () => iconPage < getTotalPages() - 1;
  const hasPreviousPage = () => iconPage > 0;
  const goToNextPage = () => { if (hasNextPage()) setIconPage(prev => prev + 1); };
  const goToPreviousPage = () => { if (hasPreviousPage()) setIconPage(prev => prev - 1); };

  // Render pagination controls
  const renderPaginationControls = () => {
    const totalPages = getTotalPages();
    if (totalPages <= 1 || totalIconCount === 0) return null;

    return (
      <div className="flex items-center justify-center gap-2 px-2 pb-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousPage}
          disabled={!hasPreviousPage() || isLoadingIcons}
          className="h-7 w-7 p-0"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-xs text-foreground font-medium px-2 min-w-[65px] text-center">
          {iconPage + 1} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={goToNextPage}
          disabled={!hasNextPage() || isLoadingIcons}
          className="h-7 w-7 p-0"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  // Update state when membrane changes
  useEffect(() => {
    setIconSize(membraneOptions.iconSize);
    setSpacing(membraneOptions.spacing);
    setRotateToPath(membraneOptions.rotateToPath);
    setDoubleSided(membraneOptions.doubleSided);
    setOrientationOffset(membraneOptions.orientationOffset);

    // Ensure the membrane group doesn't clip its children
    if (membrane) {
      membrane.set({
        objectCaching: false,
        subTargetCheck: true,
        interactive: true,
      });
      canvas?.requestRenderAll();
    }
  }, [membrane, membrane?._objects?.length, canvas]);


  const handleRegenerateMembrane = async () => {
    if (!canvas) return;

    try {
      // Check if any property that requires full regeneration has changed
      const spacingChanged = spacing !== membraneOptions.spacing;
      const rotateToPathChanged = rotateToPath !== membraneOptions.rotateToPath;
      const doubleSidedChanged = doubleSided !== membraneOptions.doubleSided;
      const iconSizeChanged = iconSize !== membraneOptions.iconSize;
      const orientationOffsetChanged = orientationOffset !== membraneOptions.orientationOffset;

      const needsRegeneration = spacingChanged || rotateToPathChanged || doubleSidedChanged || iconSizeChanged || orientationOffsetChanged;

      // Check if icon replacement is requested
      const iconReplacement = selectedReplacementIcon !== null;
      let replacementIconId = "";
      let replacementIconName = "";

      if (iconReplacement) {
        // Get the replacement icon metadata (icon-by-reference)
        const replacementIcon = loadedReplacementIcons.find(icon => icon.id === selectedReplacementIcon);
        if (replacementIcon?.id) {
          replacementIconId = replacementIcon.id;
          replacementIconName = replacementIcon.name || '';
        } else {
          toast.error("Cannot replace: icon not found");
          return;
        }
      }

      if (needsRegeneration) {
        // Spacing changed - regenerate all icons with new spacing
        // Update membrane options with all new values (and new icon if replacing)
        (membrane as any).membraneOptions = {
          ...membraneOptions,
          iconSize,
          spacing,
          orientationOffset,
          rotateToPath,
          doubleSided,
          ...(iconReplacement && {
            iconId: replacementIconId,
            iconName: replacementIconName,
            iconSVG: undefined  // Clear legacy SVG when using icon-by-reference
          }),
        };

        // Get the stored bezier points in relative space
        const relativeWorldBezierPoints = (membrane as any).worldBezierPoints;
        if (!relativeWorldBezierPoints) {
          toast.error("Cannot regenerate: path data not found");
          return;
        }

        // Transform relative bezier points back to absolute world coordinates
        // Handle rasterized membranes which have display scaling (0.5)
        const isRasterized = (membrane as any).isRasterizedMembrane;
        let transformMatrix;

        if (isRasterized) {
          // Use original scales instead of display scales
          const bounds = membrane.getBoundingRect();
          const centerX = bounds.left + bounds.width / 2;
          const centerY = bounds.top + bounds.height / 2;
          const scaleX = (membrane as any).originalScaleX || 1;
          const scaleY = (membrane as any).originalScaleY || 1;
          const angle = (membrane as any).angle || 0;
          const cos = Math.cos(angle * Math.PI / 180);
          const sin = Math.sin(angle * Math.PI / 180);

          transformMatrix = [
            cos * scaleX,
            sin * scaleX,
            -sin * scaleY,
            cos * scaleY,
            centerX,
            centerY
          ];
        } else {
          transformMatrix = membrane.calcTransformMatrix();
        }

        const absoluteWorldBezierPoints = relativeWorldBezierPoints.map((point: any) => {
          const absoluteAnchor = util.transformPoint(
            new FabricPoint(point.x, point.y),
            transformMatrix
          );

          const absolutePoint: any = {
            x: absoluteAnchor.x,
            y: absoluteAnchor.y,
            type: point.type,
            id: point.id,
          };

          if (point.controlPoint1) {
            const absoluteCp1 = util.transformPoint(
              new FabricPoint(point.controlPoint1.x, point.controlPoint1.y),
              transformMatrix
            );
            absolutePoint.controlPoint1 = { x: absoluteCp1.x, y: absoluteCp1.y };
          }

          if (point.controlPoint2) {
            const absoluteCp2 = util.transformPoint(
              new FabricPoint(point.controlPoint2.x, point.controlPoint2.y),
              transformMatrix
            );
            absolutePoint.controlPoint2 = { x: absoluteCp2.x, y: absoluteCp2.y };
          }

          return absolutePoint;
        });

        // Regenerate icons with new spacing
        const newMembrane = await MembranePathTool.regenerateIcons(
          canvas,
          membrane,
          absoluteWorldBezierPoints
        );

        // Count icons in the regenerated membrane
        const newIconCount = (newMembrane as any).vectorObjects?.objects?.length || 0;

        canvas.requestRenderAll();
        canvas.fire('object:modified', { target: newMembrane });

        const regenerateMessage = iconReplacement
          ? `Regenerated membrane with ${newIconCount} icons using new icon!`
          : `Regenerated membrane with ${newIconCount} icons!`;
        toast.success(regenerateMessage);

        // Clear replacement icon selection after successful replacement
        if (iconReplacement) {
          setSelectedReplacementIcon(null);
        }
      } else if (iconReplacement) {
        // Icon replacement without spacing change - use regenerateIcons for proper positioning
        // Update membrane options with new icon (icon-by-reference)
        (membrane as any).membraneOptions = {
          ...membraneOptions,
          iconSize,
          spacing,
          orientationOffset,
          rotateToPath,
          doubleSided,
          iconId: replacementIconId,
          iconName: replacementIconName,
          iconSVG: undefined,  // Clear legacy SVG when using icon-by-reference
        };

        // Get the stored bezier points in relative space
        const relativeWorldBezierPoints = (membrane as any).worldBezierPoints;
        if (!relativeWorldBezierPoints) {
          toast.error("Cannot regenerate: path data not found");
          return;
        }

        // Transform relative bezier points back to absolute world coordinates
        // Handle rasterized membranes which have display scaling (0.5)
        const isRasterized = (membrane as any).isRasterizedMembrane;
        let transformMatrix;

        if (isRasterized) {
          // Use original scales instead of display scales
          const bounds = membrane.getBoundingRect();
          const centerX = bounds.left + bounds.width / 2;
          const centerY = bounds.top + bounds.height / 2;
          const scaleX = (membrane as any).originalScaleX || 1;
          const scaleY = (membrane as any).originalScaleY || 1;
          const angle = (membrane as any).angle || 0;
          const cos = Math.cos(angle * Math.PI / 180);
          const sin = Math.sin(angle * Math.PI / 180);

          transformMatrix = [
            cos * scaleX,
            sin * scaleX,
            -sin * scaleY,
            cos * scaleY,
            centerX,
            centerY
          ];
        } else {
          transformMatrix = membrane.calcTransformMatrix();
        }

        const absoluteWorldBezierPoints = relativeWorldBezierPoints.map((point: any) => {
          const absoluteAnchor = util.transformPoint(
            new FabricPoint(point.x, point.y),
            transformMatrix
          );

          const absolutePoint: any = {
            x: absoluteAnchor.x,
            y: absoluteAnchor.y,
            type: point.type,
            id: point.id,
          };

          if (point.controlPoint1) {
            const absoluteCp1 = util.transformPoint(
              new FabricPoint(point.controlPoint1.x, point.controlPoint1.y),
              transformMatrix
            );
            absolutePoint.controlPoint1 = { x: absoluteCp1.x, y: absoluteCp1.y };
          }

          if (point.controlPoint2) {
            const absoluteCp2 = util.transformPoint(
              new FabricPoint(point.controlPoint2.x, point.controlPoint2.y),
              transformMatrix
            );
            absolutePoint.controlPoint2 = { x: absoluteCp2.x, y: absoluteCp2.y };
          }

          return absolutePoint;
        });

        // Regenerate icons with new icon using MembranePathTool
        const newMembrane = await MembranePathTool.regenerateIcons(
          canvas,
          membrane,
          absoluteWorldBezierPoints
        );

        canvas.requestRenderAll();
        canvas.fire('object:modified', { target: newMembrane });

        toast.success(`Replaced ${iconCount} icon${iconCount !== 1 ? 's' : ''}!`);
        setSelectedReplacementIcon(null);
      } else {
        // Nothing changed — nothing to apply
        toast.info("No changes to apply");
      }
    } catch (error) {
      console.error("Error updating membrane icons:", error);
      toast.error("Failed to update membrane icons");
    }
  };



  return (
    <div id="section-membrane" className="relative">
      {/* Collapsible Header */}
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-membrane')}
      >
        <div className="flex items-center gap-2">
          <WavesIcon className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">
            Membrane
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
            {/* Membrane Icon Selector */}
      <div className="space-y-2 pt-3 border-t">
        <Label className="text-sm font-semibold">Membrane Icon</Label>

        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search icons..."
            value={iconSearchQuery}
            onChange={(e) => setIconSearchQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Category Badges */}
        <div className="flex flex-wrap gap-2">
          {['Phospholipid', 'pump', 'receptor', 'channel'].map((category) => {
            const isActive = iconSearchQuery === category;
            return (
              <Badge
                key={category}
                variant={isActive ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setIconSearchQuery(isActive ? "" : category)}
              >
                {category}
              </Badge>
            );
          })}
        </div>

        {/* Membrane Only Checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={membraneOnlyFilter}
            onCheckedChange={(checked) => setMembraneOnlyFilter(checked as boolean)}
            id="membrane-only"
          />
          <Label htmlFor="membrane-only" className="text-xs cursor-pointer">
            membrane only
          </Label>
        </div>

        {/* Icon Grid */}
        <ScrollArea className="h-32 border rounded-md">
          <div className="grid grid-cols-4 gap-2 p-2">
            {isLoadingIcons && iconPage === 0 ? (
              // Loading state on first page
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square border rounded bg-muted animate-pulse" />
              ))
            ) : (
              loadedReplacementIcons.map((icon) => (
                <div
                  key={icon.id}
                  className={`aspect-square border rounded p-2 flex items-center justify-center cursor-pointer transition-all ${
                    selectedReplacementIcon === icon.id
                      ? 'border-primary border-2 bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedReplacementIcon(icon.id === selectedReplacementIcon ? null : icon.id)}
                  title={icon.name}
                >
                  {icon.thumbnail ? (
                    icon.thumbnail.startsWith('data:image/png') ? (
                      <img
                        src={icon.thumbnail}
                        alt={icon.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{ __html: sanitizeSVG(icon.thumbnail) }}
                        className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
                      />
                    )
                  ) : (
                    <div className="text-xs text-muted-foreground text-center">No preview</div>
                  )}
                </div>
              ))
            )}
          </div>

          {renderPaginationControls()}
        </ScrollArea>

        {selectedReplacementIcon && (
          <p className="text-xs text-muted-foreground">
            Selected: {loadedReplacementIcons.find(i => i.id === selectedReplacementIcon)?.name}
          </p>
        )}
      </div>

      {/* Icon Size */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <Label className="text-sm">Icon Size</Label>
          <span className="text-sm text-muted-foreground">{iconSize}px</span>
        </div>
        <Slider
          value={[iconSize]}
          onValueChange={(v) => setIconSize(v[0])}
          min={20}
          max={100}
          step={5}
        />
      </div>

      {/* Spacing */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <Label className="text-sm">Spacing</Label>
          <span className="text-sm text-muted-foreground">
            {spacing}px {spacing === 0 && "(touching)"}
          </span>
        </div>
        <Slider
          value={[spacing]}
          onValueChange={(v) => setSpacing(v[0])}
          min={0}
          max={50}
          step={5}
        />
      </div>

      {/* Orientation */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-sm">Icon Orientation</Label>
          <span className="text-sm text-muted-foreground">{orientationOffset}°</span>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          <Button 
            variant={orientationOffset === 0 ? "default" : "outline"} 
            size="sm"
            onClick={() => setOrientationOffset(0)}
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button 
            variant={orientationOffset === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setOrientationOffset(90)}
          >
            <ArrowRight className="h-3 w-3" />
          </Button>
          <Button 
            variant={orientationOffset === 180 ? "default" : "outline"}
            size="sm"
            onClick={() => setOrientationOffset(180)}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button 
            variant={orientationOffset === 270 ? "default" : "outline"}
            size="sm"
            onClick={() => setOrientationOffset(270)}
          >
            <ArrowLeft className="h-3 w-3" />
          </Button>
        </div>

        <Slider
          value={[orientationOffset]}
          onValueChange={(v) => setOrientationOffset(v[0])}
          min={0}
          max={360}
          step={15}
        />
      </div>

      {/* Switches */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Rotate to follow path</Label>
          <Switch
            checked={rotateToPath}
            onCheckedChange={setRotateToPath}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm">Double-sided (bilayer)</Label>
          <Switch
            checked={doubleSided}
            onCheckedChange={setDoubleSided}
          />
        </div>
      </div>

            {/* Apply Button */}
            <Button
              onClick={handleRegenerateMembrane}
              className="w-full"
            >
              {selectedReplacementIcon
                ? 'Replace All Icons'
                : 'Apply Changes'
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
