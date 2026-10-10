import { useCanvas } from "@/contexts/CanvasContext";
import { TextFormattingPanel } from "./TextFormattingPanel";
import { LinePropertiesPanel } from "./LinePropertiesPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Copy, Trash2, GripVertical, Scissors, ClipboardPaste, Group, Ungroup, ArrowUpDown, ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown, FlipHorizontal2, FlipVertical2, RotateCw, Lock, Unlock, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { throttle } from "@/lib/performanceUtils";
import { BaseColorPicker } from "@/components/ColorPicker/BaseColorPicker";
import { toast } from "sonner";

export const ContextualToolbar = () => {
  const {
    selectedObject, canvas,
    cut, paste, hasClipboardContent,
    groupSelected, ungroupSelected,
    bringToFront, sendToBack, bringForward, sendBackward,
    flipHorizontal, flipVertical, toggleLockSelected,
    alignLeft, alignCenter, alignRight, alignTop, alignMiddle, alignBottom,
  } = useCanvas();
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState({ x: 0, y: 72 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(100);
  const [fillColor, setFillColor] = useState("#000000");
  const [strokeColor, setStrokeColor] = useState("#000000");

  // Track object modifications to force UI sync
  const [modificationCounter, setModificationCounter] = useState(0);

  // Listen for object:modified events to sync UI
  useEffect(() => {
    if (!canvas) return;

    const handleObjectModified = () => {
      setModificationCounter(prev => prev + 1);
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('object:modified', handleObjectModified);
    };
  }, [canvas]);

  // Discoverability — first time a real image lands on the canvas this session,
  // surface a single toast pointing to the AI wand so users know it exists.
  // Skip layers produced by the AI tool itself (isExtractedTextCover).
  useEffect(() => {
    if (!canvas) return;
    const HINT_KEY = "ai_tools_hint_shown";
    if (sessionStorage.getItem(HINT_KEY) === "1") return;

    const handleAdded = (e: { target?: { type?: string; isExtractedTextCover?: boolean } }) => {
      const t = e?.target;
      if (!t || t.type !== "image") return;
      if (t.isExtractedTextCover) return;
      sessionStorage.setItem(HINT_KEY, "1");
      toast.message("Tip: select this image to access AI tools", {
        description: "Use the ✦ wand in the toolbar to make any baked-in text editable.",
        duration: 7000,
      });
    };

    canvas.on("object:added", handleAdded as unknown as () => void);
    return () => {
      canvas.off("object:added", handleAdded as unknown as () => void);
    };
  }, [canvas]);

  // Sync colors and opacity with selected object
  useEffect(() => {
    if (selectedObject) {
      setOpacity((selectedObject.opacity || 1) * 100);
      setFillColor((selectedObject.fill as string) || "#000000");
      setStrokeColor((selectedObject.stroke as string) || "#000000");
    }
  }, [selectedObject, modificationCounter]);

  // Load saved position from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('contextualToolbarPosition');
    if (saved) {
      const savedPos = JSON.parse(saved);
      setPosition(savedPos);
    } else {
      // Default centered position
      const centerX = Math.max(0, window.innerWidth / 2 - 400);
      setPosition({ x: centerX, y: 72 });
    }
  }, []);

  // Handle dragging with performance optimization
  useEffect(() => {
    if (!isDragging) return;

    // Cache DOM measurements once when drag starts
    const toolbarWidth = toolbarRef.current?.offsetWidth || 800;
    const toolbarHeight = toolbarRef.current?.offsetHeight || 60;

    // Throttle to 16ms (~60fps)
    const handleMouseMove = throttle((e: MouseEvent) => {
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      // Constrain to viewport
      newX = Math.max(0, Math.min(newX, window.innerWidth - toolbarWidth));
      newY = Math.max(0, Math.min(newY, window.innerHeight - toolbarHeight));

      setPosition({ x: newX, y: newY });
    }, 16);

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('contextualToolbarPosition', JSON.stringify(position));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  // Compute derived values before hooks
  const objectType = selectedObject?.type;
  const isTextObject = objectType === "textbox" || objectType === "text";
  const isConnector = (selectedObject as any)?.data?.isConnector === true;
  const isShape = ["rect", "circle", "ellipse", "triangle", "polygon"].includes(objectType || "");
  const isGroup = objectType === "group" || objectType === "activeSelection";
  const isUserGroup = objectType === "group" && (selectedObject as any)?.isUserGroup;
  const isActiveSelection = objectType === "activeSelection";
  const canGroup = isActiveSelection;
  const canUngroup = isUserGroup;
  // Color is relevant for shapes, text, and lines — not images or groups
  const showColor = isShape || isTextObject || isConnector;
  const isLocked = (selectedObject as any)?.pinned || false;

  // Memoize child components to prevent re-renders during drag
  const textControls = useMemo(() => {
    if (!isTextObject) return null;
    return (
      <>
        <TextFormattingPanel />
        <Separator orientation="vertical" className="h-8" />
      </>
    );
  }, [isTextObject, selectedObject]);

  const lineControls = useMemo(() => {
    if (!isConnector) return null;
    return (
      <>
        <LinePropertiesPanel />
        <Separator orientation="vertical" className="h-8" />
      </>
    );
  }, [isConnector, selectedObject]);

  // Early returns after hooks
  if (!selectedObject) {
    return null;
  }

  // Don't show toolbar for control handles or guide lines
  if ((selectedObject as any).isControlHandle || (selectedObject as any).isHandleLine) {
    return null;
  }

  const handleDelete = () => {
    if (canvas && selectedObject) {
      canvas.remove(selectedObject);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  };

  const handleDuplicate = async () => {
    if (!canvas || !selectedObject) return;

    try {
      const cloned = await (selectedObject as any).clone();
      cloned.set({
        left: (selectedObject.left || 0) + 20,
        top: (selectedObject.top || 0) + 20,
      });

      // Preserve library icon metadata so clones get reference-based save/reload
      const src = selectedObject as any;
      if (src.iconId) cloned.iconId = src.iconId;
      if (src.isLibraryIcon) cloned.isLibraryIcon = true;
      if (src.iconToneColor) cloned.iconToneColor = src.iconToneColor;
      if (src.iconToneIntensity !== undefined) cloned.iconToneIntensity = src.iconToneIntensity;
      if (src.iconToneHue !== undefined) cloned.iconToneHue = src.iconToneHue;
      if (src.originalColors) cloned.originalColors = new Map(src.originalColors);

      // Await nested image decode to prevent ghost rendering
      const decodePromises: Promise<void>[] = [];
      const collectDecodes = (o: any) => {
        if ((o.type === 'image' || o.type === 'Image') && o._element?.decode) {
          decodePromises.push(
            (o._element as HTMLImageElement).decode().then(() => { o.dirty = true; }).catch(() => {})
          );
        }
        if (o._objects) {
          for (const child of o._objects) collectDecodes(child);
        }
      };
      collectDecodes(cloned);
      if (decodePromises.length > 0) {
        await Promise.all(decodePromises);
      }

      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
    } catch (error) {
      console.error('Failed to duplicate object:', error);
    }
  };

  const handleOpacityChange = (value: number[]) => {
    if (!selectedObject || !canvas) return;
    const newOpacity = value[0];
    setOpacity(newOpacity);
    selectedObject.set({ opacity: newOpacity / 100 });
    canvas.requestRenderAll();
  };

  const handleRotate90 = () => {
    if (!selectedObject || !canvas) return;
    // Rotate around the object's visual center to keep it in place
    const center = selectedObject.getCenterPoint();
    const newAngle = ((selectedObject.angle || 0) + 90) % 360;
    selectedObject.rotate(newAngle);
    selectedObject.setPositionByOrigin(center, 'center', 'center');
    selectedObject.setCoords();
    canvas.requestRenderAll();
  };

  // ── Shared JSX fragments ──────────────────────────────────────────────────

  const dragHandle = (
    <div
      className="drag-handle cursor-grab active:cursor-grabbing hover:bg-primary/10 rounded px-1 py-2 -ml-1 flex items-center transition-all duration-200"
      onMouseDown={handleMouseDown}
      title="Drag to reposition"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
    </div>
  );

  const colorControls = showColor ? (
    <>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-7 h-7 rounded-md border-2 border-border shadow-sm transition-all hover:scale-105 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ backgroundColor: fillColor }}
              aria-label="Fill color"
              title="Fill color"
            />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <BaseColorPicker
              value={fillColor}
              onChange={(color) => {
                if (!canvas) return;
                setFillColor(color);
                selectedObject.set({ fill: color });
                canvas.requestRenderAll();
              }}
              showOpacity={false}
              debounceMs={100}
            />
          </PopoverContent>
        </Popover>
        {isShape && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-7 h-7 rounded-md border-2 border-border shadow-sm transition-all hover:scale-105 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ backgroundColor: strokeColor }}
                aria-label="Stroke color"
                title="Stroke color"
              />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <BaseColorPicker
                value={strokeColor}
                onChange={(color) => {
                  if (!canvas) return;
                  setStrokeColor(color);
                  selectedObject.set({ stroke: color });
                  canvas.requestRenderAll();
                }}
                showOpacity={false}
                debounceMs={100}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      <Separator orientation="vertical" className="h-8" />
    </>
  ) : null;

  const commonControls = (
    <>
      {/* Opacity */}
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Opacity</Label>
        <Slider
          value={[opacity]}
          onValueChange={handleOpacityChange}
          max={100}
          min={0}
          step={1}
          className="w-24"
        />
        <span className="text-xs text-muted-foreground w-8">
          {Math.round(opacity)}%
        </span>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Arrange */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2" title="Arrange">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={bringToFront}>
            <ArrowUpToLine className="h-4 w-4 mr-2" />Bring to Front
          </DropdownMenuItem>
          <DropdownMenuItem onClick={bringForward}>
            <ArrowUp className="h-4 w-4 mr-2" />Bring Forward
          </DropdownMenuItem>
          <DropdownMenuItem onClick={sendBackward}>
            <ArrowDown className="h-4 w-4 mr-2" />Send Backward
          </DropdownMenuItem>
          <DropdownMenuItem onClick={sendToBack}>
            <ArrowDownToLine className="h-4 w-4 mr-2" />Send to Back
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Flip & Rotate */}
      <Button variant="ghost" size="sm" className="h-8 px-2" title="Flip Horizontal" onClick={flipHorizontal}>
        <FlipHorizontal2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 px-2" title="Flip Vertical" onClick={flipVertical}>
        <FlipVertical2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 px-2" title="Rotate 90°" onClick={handleRotate90}>
        <RotateCw className="h-4 w-4" />
      </Button>

      {/* Align — only for multi-selection */}
      {isActiveSelection && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Align">
              <AlignCenterVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={alignLeft}>
              <AlignStartVertical className="h-4 w-4 mr-2" />Align Left
            </DropdownMenuItem>
            <DropdownMenuItem onClick={alignCenter}>
              <AlignCenterVertical className="h-4 w-4 mr-2" />Align Center
            </DropdownMenuItem>
            <DropdownMenuItem onClick={alignRight}>
              <AlignEndVertical className="h-4 w-4 mr-2" />Align Right
            </DropdownMenuItem>
            <DropdownMenuItem onClick={alignTop}>
              <AlignStartHorizontal className="h-4 w-4 mr-2" />Align Top
            </DropdownMenuItem>
            <DropdownMenuItem onClick={alignMiddle}>
              <AlignCenterHorizontal className="h-4 w-4 mr-2" />Align Middle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={alignBottom}>
              <AlignEndHorizontal className="h-4 w-4 mr-2" />Align Bottom
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Separator orientation="vertical" className="h-8" />

      {/* Cut & Paste */}
      <Button variant="ghost" size="sm" className="h-8 px-2" title="Cut" onClick={cut}>
        <Scissors className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        title="Paste"
        onClick={paste}
        disabled={!hasClipboardContent}
      >
        <ClipboardPaste className="h-4 w-4" />
      </Button>

      {/* Group / Ungroup */}
      {canGroup && (
        <Button variant="ghost" size="sm" className="h-8 px-2" title="Group" onClick={groupSelected}>
          <Group className="h-4 w-4" />
        </Button>
      )}
      {canUngroup && (
        <Button variant="ghost" size="sm" className="h-8 px-2" title="Ungroup" onClick={ungroupSelected}>
          <Ungroup className="h-4 w-4" />
        </Button>
      )}

      {/* Lock / Unlock */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        title={isLocked ? "Unlock" : "Lock"}
        onClick={toggleLockSelected}
      >
        {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </Button>

      <Separator orientation="vertical" className="h-8" />

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDuplicate}
          className="h-8 px-2"
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-8 px-2 text-destructive hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const toolbarStyle = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    transition: isDragging ? 'none' : 'opacity 0.3s, box-shadow 0.3s',
    cursor: isDragging ? 'grabbing' : 'default',
    boxShadow: isDragging
      ? '0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.3)'
      : undefined,
    willChange: 'transform, opacity' as const,
  };

  // Two-row layout for text objects to prevent toolbar overflow
  if (isTextObject) {
    return (
      <>
        <div
          ref={toolbarRef}
          className="fixed z-40 glass-effect-premium rounded-lg shadow-lg hover:shadow-xl p-3 flex flex-col gap-2"
          style={toolbarStyle}
        >
          {/* Row 1: Drag handle + text formatting + color */}
          <div className="flex items-center gap-4">
            {dragHandle}
            <Separator orientation="vertical" className="h-8" />
            {textControls}
            {colorControls}
          </div>
          {/* Row 2: Common controls */}
          <div className="flex items-center gap-4">
            {commonControls}
          </div>
        </div>
      </>
    );
  }

  // Single-row layout for non-text objects
  return (
    <>
      <div
        ref={toolbarRef}
        className="fixed z-40 glass-effect-premium rounded-lg shadow-lg hover:shadow-xl p-3 flex items-center gap-4 max-w-5xl"
        style={toolbarStyle}
      >
        {dragHandle}
        <Separator orientation="vertical" className="h-8" />
        {lineControls}
        {colorControls}
        {commonControls}
      </div>
    </>
  );
};
