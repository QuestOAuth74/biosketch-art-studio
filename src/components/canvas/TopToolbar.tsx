import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvas } from "@/contexts/CanvasContext";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CaretDoubleDown,
  CaretDoubleUp,
  CaretDown,
  CaretUp,
  ClipboardText,
  Command,
  Copy,
  CornersOut,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Scissors,
  SelectionAll,
  SplitVertical,
  Stack,
  TextAlignCenter,
  TextAlignLeftIcon,
  TextAlignRight,
  UsersThree,
} from "@phosphor-icons/react";
import { GridAndRulersPopover } from "./GridAndRulersPopover";
import { ZoomControlPopover } from "./ZoomControlPopover";
import { PremiumFeaturesButtons } from "./PremiumFeaturesButtons";
import { LinesDropdown } from "./LinesDropdown";

interface TopToolbarProps {
  onExport: () => void;
  activeTool?: string;
  onToolChange?: (tool: string) => void;
  onAIIconClick?: () => void;
  onAIDiagramClick?: () => void;
  onPowerPointClick?: () => void;
  onShareClick?: () => void;
  onCollaborateClick?: () => void;
  hasProject?: boolean;
  onCommandPaletteToggle?: () => void;
  onLinePresetSelect?: (preset: any) => void;
}

export const TopToolbar = ({
  onExport,
  activeTool = "select",
  onToolChange,
  onAIIconClick,
  onAIDiagramClick,
  onPowerPointClick,
  onShareClick,
  onCollaborateClick,
  hasProject,
  onCommandPaletteToggle,
  onLinePresetSelect,
}: TopToolbarProps) => {
  const {
    canvas,
    selectedObject,
    undo,
    redo,
    cut,
    copy,
    paste,
    alignLeft,
    alignCenter,
    alignRight,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    groupSelected,
    ungroupSelected,
    zoomIn,
    zoomOut,
    zoomToFit,
    zoom,
    hasClipboardContent,
  } = useCanvas();

  // Helper function to get text object from selection
  const getTextObject = (obj: any): any | null => {
    if (obj?.type === "textbox") {
      return obj;
    }
    // Check if it's a group containing text
    if (obj?.type === "group") {
      const textObj = obj.getObjects().find((o: any) => o.type === "textbox");
      return textObj || null;
    }
    return null;
  };

  // Calculate disabled states
  const activeObjects = canvas?.getActiveObjects() || [];
  const hasSelection = activeObjects.length > 0;
  const hasMultipleSelection = activeObjects.length > 1;
  const hasTextSelection =
    hasSelection &&
    activeObjects.every(
      (obj) =>
        obj.type === "textbox" || obj.type === "i-text" || obj.type === "text"
    );

  // Ungroup only works when a single group is the active object
  const hasGroup = selectedObject?.type === "group";

  // Handle text alignment (for text objects)
  const handleTextAlign = (align: string) => {
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ textAlign: align as any });
      canvas.requestRenderAll();
    }
  };

  const toolButtonClass =
    "h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-blue-200/60 transition-colors";
  const activeToolButtonClass =
    "h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <div
      className="flex items-center gap-0.5 px-3 py-1 bg-blue-100/60 border-b border-blue-200/80 shadow-sm"
      data-onboarding="toolbar"
    >
      {/* Left spacer — centers the buttons */}
      <div className="flex-1" />

      {/* Edit Tools */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={toolButtonClass}
              onClick={undo}
              data-testid={CanvasEditorTestIds.UNDO_BUTTON}
            >
              <ArrowCounterClockwise
                style={{ width: 18, height: 18 }}
                weight="bold"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={toolButtonClass}
              onClick={redo}
              data-testid={CanvasEditorTestIds.REDO_BUTTON}
            >
              <ArrowClockwise
                style={{ width: 18, height: 18 }}
                weight="bold"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
        </Tooltip>
      </div>

      <Separator
        orientation="vertical"
        className="h-5 mx-1.5 bg-blue-200/70"
      />

      {/* Clipboard */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={cut}
                disabled={!hasSelection}
              >
                <Scissors
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Cut (⌘X)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={copy}
                disabled={!hasSelection}
              >
                <Copy
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Copy (⌘C)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={paste}
                disabled={!hasClipboardContent}
              >
                <ClipboardText
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Paste (⌘V)</TooltipContent>
        </Tooltip>
      </div>

      <Separator
        orientation="vertical"
        className="h-5 mx-1.5 bg-blue-200/70"
      />

      {/* Command Palette */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={toolButtonClass}
            onClick={onCommandPaletteToggle}
          >
            <Command
              style={{ width: 18, height: 18 }}
              weight="bold"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Command Palette (⌘K)</TooltipContent>
      </Tooltip>

      <Separator
        orientation="vertical"
        className="h-5 mx-1.5 bg-blue-200/70"
      />

      {/* Alignment */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={() => handleTextAlign("left")}
                disabled={!hasTextSelection}
              >
                <TextAlignLeftIcon
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Align Left</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={() => handleTextAlign("center")}
                disabled={!hasTextSelection}
              >
                <TextAlignCenter
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Align Center</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={() => handleTextAlign("right")}
                disabled={!hasTextSelection}
              >
                <TextAlignRight
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Align Right</TooltipContent>
        </Tooltip>
      </div>

      <Separator
        orientation="vertical"
        className="h-5 mx-1.5 bg-blue-200/70"
      />

      {/* Layer Controls - Arrange Menu */}
      <div className="flex items-center gap-0.5">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={toolButtonClass}
                    disabled={!hasSelection}
                  >
                    <Stack
                      style={{ width: 18, height: 18 }}
                      weight="bold"
                    />
                  </Button>
                </DropdownMenuTrigger>
              </span>
            </TooltipTrigger>
            <TooltipContent>Arrange</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            side="bottom"
            align="start"
            className="w-52"
          >
            <DropdownMenuItem onClick={bringToFront}>
              <CaretDoubleUp
                style={{ width: 18, height: 18 }}
                weight="bold"
                className="mr-2"
              />
              <span>Bring to Front</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘⇧]</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={bringForward}>
              <CaretUp
                style={{ width: 18, height: 18 }}
                weight="bold"
                className="mr-2"
              />
              <span>Bring Forward</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘]</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={sendBackward}>
              <CaretDown
                style={{ width: 18, height: 18 }}
                weight="bold"
                className="mr-2"
              />
              <span>Send Backward</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘[</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={sendToBack}>
              <CaretDoubleDown
                style={{ width: 18, height: 18 }}
                weight="bold"
                className="mr-2"
              />
              <span>Send to Back</span>
              <span className="ml-auto text-xs text-muted-foreground">⌘⇧[</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator
        orientation="vertical"
        className="h-5 mx-1.5 bg-blue-200/70"
      />

      {/* Grouping */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={groupSelected}
                disabled={!hasMultipleSelection}
                data-testid={CanvasEditorTestIds.GROUP_BUTTON}
              >
                <SelectionAll
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Group (⌘G)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={ungroupSelected}
                disabled={!hasGroup}
                data-testid={CanvasEditorTestIds.UNGROUP_BUTTON}
              >
                <SplitVertical
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Ungroup (⌘⇧G)</TooltipContent>
        </Tooltip>
      </div>

      <Separator
        orientation="vertical"
        className="h-5 mx-1.5 bg-blue-200/70"
      />

      <LinesDropdown onPresetSelect={onLinePresetSelect || (() => {})} />

      <Separator
        orientation="vertical"
        className="h-5 mx-1.5 bg-blue-200/70"
      />

      <PremiumFeaturesButtons
        onAIIconClick={onAIIconClick || (() => {})}
        onPowerPointClick={onPowerPointClick || (() => {})}
        onShareClick={onShareClick || (() => {})}
      />


      {/* Collaborate Button */}
      {hasProject && (
        <>
          <Separator
            orientation="vertical"
            className="h-5 mx-1.5 bg-blue-200/70"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={toolButtonClass}
                onClick={onCollaborateClick}
              >
                <UsersThree
                  style={{ width: 18, height: 18 }}
                  weight="bold"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Collaborate</TooltipContent>
          </Tooltip>
        </>
      )}



      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={zoomOut}
              data-testid={CanvasEditorTestIds.ZOOM_OUT_BUTTON}
            >
              <MagnifyingGlassMinus
                style={{ width: 18, height: 18 }}
                weight="bold"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <ZoomControlPopover />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={zoomIn}
              data-testid={CanvasEditorTestIds.ZOOM_IN_BUTTON}
            >
              <MagnifyingGlassPlus
                style={{ width: 18, height: 18 }}
                weight="bold"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={zoomToFit}
              data-testid={CanvasEditorTestIds.ZOOM_FIT_BUTTON}
            >
              <CornersOut
                style={{ width: 18, height: 18 }}
                weight="bold"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to Screen</TooltipContent>
        </Tooltip>

        <Separator
          orientation="vertical"
          className="h-5 mx-1.5 bg-blue-200/70"
        />

        <GridAndRulersPopover />
      </div>
    </div>
  );
};
