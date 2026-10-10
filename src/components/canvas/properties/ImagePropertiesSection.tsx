import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CropIcon, ImageIcon, MagicWand, Eraser } from "@phosphor-icons/react";
import { ChevronDown, ChevronRight, Square, Circle, Pentagon, RectangleHorizontal, Loader2 } from "lucide-react";
import { ColorPickerSection } from "./ColorPickerSection";
import { ImageFiltersPanel } from "../ImageFiltersPanel";
import { ColorMapsPanel } from "../ColorMapsPanel";
import { useSectionCollapseStore } from "@/stores/sectionCollapseStore";
import { CropMode } from "@/types/effects";
import { FabricImage } from "fabric";
import { CropTestIds } from "@/lib/test-ids";

interface ImagePropertiesSectionProps {
  imageToneColor: string;
  imageToneOpacity: number;
  handleImageToneChange: (color: string, opacity?: number) => void;
  handleImageToneOpacityChange: (opacity: number) => void;
  handleRemoveImageTone: () => void;
  setCropMode: (mode: CropMode) => void;
  setShowImageEraser: (show: boolean) => void;
  onAutoRemoveBackground?: () => void;
  isRemovingBackground?: boolean;
  selectedObject?: FabricImage | null;
  resetCrop?: () => void;
  stickyOffset?: number;
}

/**
 * Helper function to check if an image has a crop applied
 */
function hasCrop(imageObj: any): boolean {
  return !!(imageObj.clipPath) || !!(imageObj.cropConfig);
}

/**
 * Image properties section with collapsible headers
 */
export const ImagePropertiesSection = ({
  imageToneColor,
  imageToneOpacity,
  handleImageToneChange,
  handleImageToneOpacityChange,
  handleRemoveImageTone,
  setCropMode,
  setShowImageEraser,
  onAutoRemoveBackground,
  isRemovingBackground = false,
  selectedObject,
  resetCrop,
  stickyOffset = 0,
}: ImagePropertiesSectionProps) => {
  const toggleSection = useSectionCollapseStore((state) => state.toggleSection);
  const cropCollapsed = useSectionCollapseStore((state) => state.sections['section-crop'] ?? true);
  const toneCollapsed = useSectionCollapseStore((state) => state.sections['section-image-tone'] ?? true);
  const bgRemovalCollapsed = useSectionCollapseStore((state) => state.sections['section-bg-removal'] ?? true);
  const filtersCollapsed = useSectionCollapseStore((state) => state.sections['section-image-filters'] ?? true);
  const colorMapsCollapsed = useSectionCollapseStore((state) => state.sections['section-color-maps'] ?? true);
  return (
    <>
      {/* Crop Section */}
      <div id="section-crop" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-crop')}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Crop
            </h3>
          </div>
          {cropCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>
        {!cropCollapsed && (
          <div className="px-3 pb-3 pt-3 space-y-2">
            {selectedObject && hasCrop(selectedObject) ? (
              // CROPPED: Show Edit & Reset buttons
              <>
                <Button
                  data-testid={CropTestIds.EDIT_CROP_BUTTON}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Restore previous crop mode or default to square
                    const cropConfig = (selectedObject as any).cropConfig;
                    const mode = cropConfig?.type || 'square';
                    setCropMode(mode as CropMode);
                  }}
                  className="w-full gap-2"
                >
                  <CropIcon style={{ width: 16, height: 16 }} weight="regular" />
                  Edit Crop
                </Button>
                <Button
                  data-testid={CropTestIds.RESET_CROP_BUTTON}
                  variant="outline"
                  size="sm"
                  onClick={resetCrop}
                  className="w-full gap-2"
                >
                  Reset to Original
                </Button>
              </>
            ) : (
              // UNCROPPED: Show 5 mode buttons
              <>
                <Button
                  data-testid={CropTestIds.CROP_RECTANGLE_BUTTON}
                  variant="outline"
                  size="sm"
                  onClick={() => setCropMode('rectangle')}
                  className="w-full gap-2"
                >
                  <RectangleHorizontal className="h-4 w-4" />
                  Rectangle
                </Button>
                <Button
                  data-testid={CropTestIds.CROP_SQUARE_BUTTON}
                  variant="outline"
                  size="sm"
                  onClick={() => setCropMode('square')}
                  className="w-full gap-2"
                >
                  <Square className="h-4 w-4" />
                  Square (1:1)
                </Button>
                <Button
                  data-testid={CropTestIds.CROP_ELLIPSE_BUTTON}
                  variant="outline"
                  size="sm"
                  onClick={() => setCropMode('ellipse')}
                  className="w-full gap-2"
                >
                  <Circle className="h-4 w-4" style={{ transform: 'scaleX(1.4)' }} />
                  Ellipse
                </Button>
                <Button
                  data-testid={CropTestIds.CROP_CIRCLE_BUTTON}
                  variant="outline"
                  size="sm"
                  onClick={() => setCropMode('circle')}
                  className="w-full gap-2"
                >
                  <Circle className="h-4 w-4" />
                  Circle (1:1)
                </Button>
                <Button
                  data-testid={CropTestIds.CROP_FREEFORM_BUTTON}
                  variant="outline"
                  size="sm"
                  onClick={() => setCropMode('freeform')}
                  className="w-full gap-2"
                >
                  <Pentagon className="h-4 w-4" />
                  Free-Form
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Image Tone Section */}
      <div id="section-image-tone" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-image-tone')}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Image Tone
            </h3>
          </div>
          {toneCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>
        {!toneCollapsed && (
          <div className="px-3 pb-3 pt-3 space-y-3">
          <ColorPickerSection
            label="Tone Color"
            value={imageToneColor}
            onChange={handleImageToneChange}
            recentColors={[]}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Tone Opacity</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {Math.round(imageToneOpacity * 100)}%
              </span>
            </div>
            <Slider
              value={[imageToneOpacity * 100]}
              onValueChange={([value]) =>
                handleImageToneOpacityChange(value / 100)
              }
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveImageTone}
            className="w-full text-xs h-9"
          >
            Remove Tone
          </Button>
          </div>
        )}
      </div>

      {/* Background Removal Section */}
      <div id="section-background-removal" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-bg-removal')}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Background Removal
            </h3>
          </div>
          {bgRemovalCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>
        {!bgRemovalCollapsed && (
          <div className="px-3 pb-3 pt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onAutoRemoveBackground}
                disabled={isRemovingBackground || !onAutoRemoveBackground}
                className="gap-1.5"
              >
                {isRemovingBackground ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MagicWand className="h-4 w-4" weight="duotone" />
                )}
                {isRemovingBackground ? "Removing..." : "Auto Remove"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImageEraser(true)}
                disabled={isRemovingBackground}
                className="gap-1.5"
              >
                <Eraser className="h-4 w-4" weight="duotone" />
                Manual Eraser
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              AI-powered one-click removal, or use the eraser brush for manual control.
            </p>
          </div>
        )}
      </div>

      {/* Image Filters Section */}
      <div id="section-image-filters" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-image-filters')}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Image Filters
            </h3>
          </div>
          {filtersCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>
        {!filtersCollapsed && (
          <div className="px-3 pb-3 pt-3">
            <ImageFiltersPanel />
          </div>
        )}
      </div>

      {/* Scientific Color Maps Section */}
      <div id="section-color-maps" className="relative">
        <div
          className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
          onClick={() => toggleSection('section-color-maps')}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Scientific Color Maps
            </h3>
          </div>
          {colorMapsCollapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-600" />
          )}
        </div>
        {!colorMapsCollapsed && (
          <div className="px-3 pb-3 pt-3">
            <ColorMapsPanel />
          </div>
        )}
      </div>
    </>
  );
};
