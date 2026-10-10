import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvas } from "@/contexts/CanvasContext";
import { useRecentlyUsedTools } from "@/hooks/useRecentlyUsedTools";
import { CanvasEditorTestIds, ChartTestIds, CanvasEditorTestIds as TestIds } from "@/lib/test-ids";
import { ChartBarIcon, CursorIcon, EraserIcon, PenNibIcon, ScribbleIcon, WavesIcon, StackSimple, Dna } from "@phosphor-icons/react";
import { ChevronDown, ChevronUp, Beaker, MessageSquare, FlaskConical, Table2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnnotationToolsDropdown } from "./AnnotationToolsDropdown";
import { CurvedLineTool } from "./CurvedLineTool";
import { ImageDropdown } from "./ImageDropdown";
import { useImagePlaceholder } from "./ImagePlaceholderTool";
import { MembraneBrushIconSelector } from "./MembraneBrushIconSelector";
import { OrthogonalLineTool } from "./OrthogonalLineTool";
import { ParenthesisBracketsDropdown } from "./ParenthesisBracketsDropdown";
import { ShapesDropdown } from "./ShapesDropdown";
import { ArcLineTool } from "./ArcLineTool";
import { StraightLineTool } from "./StraightLineTool";
import { TextToolsDropdown } from "./TextToolsDropdown";

interface ToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  isLocked?: boolean;
  onPdbOpen?: () => void;
}

export const Toolbar = ({ activeTool, onToolChange, isLocked, onPdbOpen }: ToolbarProps) => {
  const { canvas, saveState } = useCanvas();
  const { recentTools, addRecentTool } = useRecentlyUsedTools();
  const { addImagePlaceholder } = useImagePlaceholder();
  const [membraneBrushOpen, setMembraneBrushOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const tools = [
    {
      id: "select",
      Icon: CursorIcon,
      label: "Select and Transform",
      shortcut: "1",
      testId: CanvasEditorTestIds.SELECT_TOOL,
    },
    {
      id: "eraser",
      Icon: EraserIcon,
      label: "Eraser",
      shortcut: "E",
      testId: undefined,
    },
  ];

  // Check scroll position and update chevron visibility
  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;
      setShowScrollUp(scrollTop > 0);
      setShowScrollDown(scrollTop + clientHeight < scrollHeight - 1);
    }
  };

  // Track tool usage
  useEffect(() => {
    if (activeTool && activeTool !== "select") {
      addRecentTool(activeTool);
    }
  }, [activeTool, addRecentTool]);

  // Set up scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener("scroll", checkScroll);
      // Also check on resize
      const resizeObserver = new ResizeObserver(checkScroll);
      resizeObserver.observe(container);

      return () => {
        container.removeEventListener("scroll", checkScroll);
        resizeObserver.disconnect();
      };
    }
  }, []);

  const handleToolChange = (toolId: string) => {
    onToolChange(toolId);
  };

  const scrollUp = () => {
    scrollContainerRef.current?.scrollBy({ top: -100, behavior: "smooth" });
  };

  const scrollDown = () => {
    scrollContainerRef.current?.scrollBy({ top: 100, behavior: "smooth" });
  };

  const startScrolling = (direction: "up" | "down") => {
    // Clear any existing interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    // Scroll immediately
    if (direction === "up") {
      scrollContainerRef.current?.scrollBy({ top: -5, behavior: "auto" });
    } else {
      scrollContainerRef.current?.scrollBy({ top: 5, behavior: "auto" });
    }

    // Continue scrolling while hovering
    scrollIntervalRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        const scrollAmount = direction === "up" ? -5 : 5;
        scrollContainerRef.current.scrollBy({
          top: scrollAmount,
          behavior: "auto",
        });
      }
    }, 20);
  };

  const stopScrolling = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  const add100TestIcons = async () => {
    if (!canvas) return;

    try {
      const { data: icons, error } = await supabase
        .from("icons")
        .select("id, svg_content")
        .not("svg_content", "is", null)
        .limit(200);

      if (error) throw error;
      if (!icons || icons.length === 0) {
        toast.error("No icons found in library");
        return;
      }

      // Filter out any icons without svg_content (extra safety)
      const validIcons = icons.filter(icon => icon.svg_content && icon.svg_content.trim().length > 0);

      if (validIcons.length === 0) {
        toast.error("No valid icons found in library");
        return;
      }

      // Shuffle and take 100
      const shuffled = [...validIcons].sort(() => Math.random() - 0.5);
      const selectedIcons = shuffled.slice(0, Math.min(100, shuffled.length));

      toast.info(`Adding ${selectedIcons.length} test icons...`);

      // Disable rendering during batch operation
      canvas.renderOnAddRemove = false;

      // Add icons - just dispatch the same event as IconLibrary does
      selectedIcons.forEach((icon) => {
        window.dispatchEvent(
          new CustomEvent("addIconToCanvas", {
            detail: {
              svgData: icon.svg_content,
              iconId: icon.id
            },
          })
        );
      });

      // Re-enable rendering and render once
      setTimeout(() => {
        canvas.renderOnAddRemove = true;
        canvas.requestRenderAll();
        // Save state after adding all icons
        saveState();
        toast.success(`Added ${selectedIcons.length} test icons`);
      }, 100);
    } catch (error) {
      console.error("Error adding test icons:", error);
      toast.error("Failed to add test icons");
    }
  };

  const toolButtonBase =
    "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <div className={`h-full flex flex-col bg-blue-100/60 border-r border-blue-200/80 min-h-0 w-fit relative${isLocked ? ' pointer-events-none opacity-40 select-none' : ''}`}>
      {/* Scroll Up Button */}
      {showScrollUp && (
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center bg-gradient-to-b from-blue-100/90 to-transparent pt-1 pb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={scrollUp}
            onMouseEnter={() => startScrolling("up")}
            onMouseLeave={stopScrolling}
            className="h-6 w-8 rounded-md bg-blue-100/80 hover:bg-blue-200/80 text-muted-foreground hover:text-foreground shadow-sm"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex flex-col items-center gap-1 py-2 px-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Draw Section */}
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToolChange(tool.id)}
                className={
                  activeTool === tool.id ? toolButtonActive : toolButtonInactive
                }
                data-testid={tool.testId}
              >
                <tool.Icon
                  style={{
                    width: 18,
                    height: 18,
                  }}
                  weight={"bold"}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="flex items-center gap-2"
            >
              <span className="text-xs font-medium">{tool.label}</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border shadow-sm">
                {tool.shortcut}
              </kbd>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Freehand */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleToolChange("freeform-line")}
              className={
                activeTool === "freeform-line" ? toolButtonActive : toolButtonInactive
              }
            >
              <ScribbleIcon style={{ width: 18, height: 18 }} weight={"bold"} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span className="text-xs font-medium">Freeform Curved Line</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border shadow-sm">F</kbd>
          </TooltipContent>
        </Tooltip>

        {/* Line Tools */}
        <div className="w-full px-1"><hr className="border-blue-300" /></div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div data-onboarding="lines-section">
              <StraightLineTool
                onLineSelect={onToolChange}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">
            Straight Line
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <CurvedLineTool
                onLineSelect={handleToolChange}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">
            Curved Line
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleToolChange("pen")}
              className={
                activeTool === "pen" ? toolButtonActive : toolButtonInactive
              }
            >
              <PenNibIcon style={{ width: 18, height: 18 }} weight={"bold"} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span className="text-xs font-medium">Draw Bezier Curves</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border shadow-sm">B</kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <OrthogonalLineTool
                onLineSelect={handleToolChange}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">
            Orthogonal Line
          </TooltipContent>
        </Tooltip>

        {/* Arc Line Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ArcLineTool
                onArcSelect={handleToolChange}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">
            Arc Lines
          </TooltipContent>
        </Tooltip>

        <div className="w-full px-1"><hr className="border-blue-300" /></div>

        {/* Text Tools */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <TextToolsDropdown
                onToolChange={handleToolChange}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Text Tools
          </TooltipContent>
        </Tooltip>

        {/* Image */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ImageDropdown
                onToolChange={handleToolChange}
                onImagePlaceholder={() => {
                  addImagePlaceholder();
                  onToolChange("select");
                }}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Insert Image
          </TooltipContent>
        </Tooltip>

        {/* Shapes Section */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div data-onboarding="shapes-dropdown">
              <ShapesDropdown
                onShapeSelect={onToolChange}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Shapes
          </TooltipContent>
        </Tooltip>

        {/* Parenthesis and Brackets */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <ParenthesisBracketsDropdown
                onShapeSelect={handleToolChange}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Parenthesis and Brackets
          </TooltipContent>
        </Tooltip>

        {/* Annotations Section */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <AnnotationToolsDropdown
                onToolChange={onToolChange}
                activeTool={activeTool}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Annotation Tools
          </TooltipContent>
        </Tooltip>

        {/* Membrane Path Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToolChange("membrane-path")}
              className={
                activeTool === "membrane-path"
                  ? toolButtonActive
                  : toolButtonInactive
              }
            >
              <WavesIcon
                style={{ width: 18, height: 18 }}
                weight={
                  activeTool === "membrane-path" ? "duotone" : "bold"
                }
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Membrane Path Tool
          </TooltipContent>
        </Tooltip>

        {/* Triple Membrane Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToolChange("triple-membrane")}
              className={
                activeTool === "triple-membrane"
                  ? toolButtonActive
                  : toolButtonInactive
              }
            >
              <StackSimple
                style={{ width: 18, height: 18 }}
                weight={
                  activeTool === "triple-membrane" ? "duotone" : "bold"
                }
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Triple Membrane
          </TooltipContent>
        </Tooltip>

        {/* DNA Helix Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToolChange("dna-helix")}
              className={
                activeTool === "dna-helix"
                  ? toolButtonActive
                  : toolButtonInactive
              }
            >
              <Dna
                style={{ width: 18, height: 18 }}
                weight={
                  activeTool === "dna-helix" ? "duotone" : "bold"
                }
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            DNA Helix
          </TooltipContent>
        </Tooltip>

        {/* Chart Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToolChange("chart")}
              className={
                activeTool === "chart"
                  ? toolButtonActive
                  : toolButtonInactive
              }
              data-testid={ChartTestIds.CHART_TOOL}
            >
              <ChartBarIcon
                style={{ width: 18, height: 18 }}
                weight={
                  activeTool === "chart" ? "duotone" : "bold"
                }
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Insert Chart
          </TooltipContent>
        </Tooltip>

        {/* Table Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToolChange("table")}
              className={
                activeTool === "table"
                  ? toolButtonActive
                  : toolButtonInactive
              }
            >
              <Table2
                style={{ width: 18, height: 18 }}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            Insert Table
          </TooltipContent>
        </Tooltip>

        {/* PDB Structure Viewer */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPdbOpen?.()}
              className={toolButtonInactive}
            >
              <FlaskConical style={{ width: 18, height: 18 }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs font-medium"
          >
            PDB Structure
          </TooltipContent>
        </Tooltip>

        {/* Comment Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToolChange("comment")}
              className={
                activeTool === "comment"
                  ? toolButtonActive
                  : toolButtonInactive
              }
              data-testid={TestIds.COMMENT_TOOL}
            >
              <MessageSquare style={{ width: 18, height: 18 }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="flex items-center gap-2"
          >
            <span className="text-xs font-medium">Add Comment</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border shadow-sm">C</kbd>
          </TooltipContent>
        </Tooltip>

      </div>

      {/* Scroll Down Button */}
      {showScrollDown && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center bg-gradient-to-t from-blue-100/90 to-transparent pb-1 pt-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={scrollDown}
            onMouseEnter={() => startScrolling("down")}
            onMouseLeave={stopScrolling}
            className="h-6 w-8 rounded-md bg-blue-100/80 hover:bg-blue-200/80 text-muted-foreground hover:text-foreground shadow-sm"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <MembraneBrushIconSelector
        open={membraneBrushOpen}
        onOpenChange={setMembraneBrushOpen}
        onStart={(iconId, iconName, options) => {
          onToolChange(
            `membrane-brush:${JSON.stringify({ iconId, iconName, ...options })}`
          );
        }}
      />
    </div>
  );
};
