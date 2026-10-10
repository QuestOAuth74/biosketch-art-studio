import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LightbulbIcon,
  CursorIcon,
  PenNibIcon,
  SquareIcon,
  TextTIcon,
  ImageIcon,
  EraserIcon,
  LineSegmentIcon,
  HandGrabbingIcon,
  ScribbleIcon,
  WavesIcon,
  CommandIcon,
} from "@phosphor-icons/react";
import { useCanvas } from "@/contexts/CanvasContext";
import { IconProps } from "@phosphor-icons/react";

interface BottomBarProps {
  activeTool: string;
  hasSelection: boolean;
}

type PhosphorIcon = React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;

const TOOL_INFO: Record<string, { 
  name: string; 
  hint: string; 
  shortcut?: string;
  icon: PhosphorIcon;
}> = {
  select: { 
    name: "Select", 
    hint: "Click objects to select. Drag to move. Hold Shift for multi-select.", 
    shortcut: "1",
    icon: CursorIcon 
  },
  pen: { 
    name: "Pen", 
    hint: "Click to place points. Press Enter to finish the path.", 
    shortcut: "B",
    icon: PenNibIcon 
  },
  "freeform-line": { 
    name: "Freeform Line", 
    hint: "Click and drag to draw a curved line. Release to finish.", 
    shortcut: "F",
    icon: ScribbleIcon 
  },
  rectangle: { 
    name: "Rectangle", 
    hint: "Click and drag to create. Hold Shift for a square.", 
    shortcut: "3",
    icon: SquareIcon 
  },
  circle: { 
    name: "Circle", 
    hint: "Click and drag to create. Hold Shift for a perfect circle.", 
    shortcut: "4",
    icon: SquareIcon 
  },
  triangle: { 
    name: "Triangle", 
    hint: "Click and drag to create a triangle.",
    icon: SquareIcon 
  },
  text: { 
    name: "Text", 
    hint: "Click anywhere on the canvas to add text.", 
    shortcut: "T",
    icon: TextTIcon 
  },
  image: { 
    name: "Image", 
    hint: "Click to upload an image from your device.", 
    shortcut: "8",
    icon: ImageIcon 
  },
  eraser: { 
    name: "Eraser", 
    hint: "Click on any object to remove it from the canvas.", 
    shortcut: "9",
    icon: EraserIcon 
  },
  "straight-line": { 
    name: "Line", 
    hint: "Click start and end points. Press Esc to cancel.", 
    shortcut: "5",
    icon: LineSegmentIcon 
  },
  "orthogonal-line": { 
    name: "Orthogonal Line", 
    hint: "Draw lines with 90° bends for clean connections.",
    icon: LineSegmentIcon 
  },
  "curved-line": { 
    name: "Curved Line", 
    hint: "Create smooth curves. Drag the green handle to adjust.",
    icon: ScribbleIcon 
  },
  connector: { 
    name: "Connector", 
    hint: "Click on objects to connect them with smart routing.",
    icon: HandGrabbingIcon 
  },
  crop: { 
    name: "Crop", 
    hint: "Drag the corners to crop the selected image.",
    icon: ImageIcon 
  },
  "membrane-brush": { 
    name: "Membrane Brush", 
    hint: "Draw to place icons along a path. Great for membranes!",
    icon: WavesIcon 
  },
};

export const BottomBar = ({ activeTool, hasSelection }: BottomBarProps) => {
  const { canvas, selectedObject } = useCanvas();
  
  // Get tool info, handling membrane-brush prefix
  const toolKey = activeTool.startsWith("membrane-brush") ? "membrane-brush" : activeTool;
  const toolInfo = TOOL_INFO[toolKey] || { 
    name: "Select", 
    hint: "Select a tool from the left toolbar to get started.",
    icon: CursorIcon,
    shortcut: undefined
  };
  
  // Get selection info
  const getSelectionInfo = () => {
    if (!selectedObject) return null;
    
    if (selectedObject.type === 'activeSelection') {
      const selection = selectedObject as any;
      const count = selection._objects?.length || 0;
      return `${count} objects selected`;
    }
    
    const typeLabels: Record<string, string> = {
      'rect': 'Rectangle',
      'circle': 'Circle',
      'ellipse': 'Ellipse',
      'triangle': 'Triangle',
      'polygon': 'Polygon',
      'textbox': 'Text',
      'text': 'Text',
      'i-text': 'Text',
      'image': 'Image',
      'group': 'Group',
      'path': 'Path',
      'line': 'Line',
    };
    
    return typeLabels[selectedObject.type || ''] || 'Object';
  };
  
  const selectionInfo = getSelectionInfo();
  const objectCount = canvas?.getObjects().filter(obj => 
    !(obj as any).isGridLine && !(obj as any).isRuler
  ).length || 0;
  
  const ToolIcon = toolInfo.icon;

  return (
    <div className="h-11 bg-background/95 backdrop-blur-sm border-t border-border/60 shadow-sm flex items-center px-4 gap-4 justify-between">
      {/* Left: Object count */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted/60">
          {objectCount} objects
        </Badge>
      </div>

      {/* Center: Active Tool & Hint */}
      <div className="flex items-center gap-3 flex-1 justify-center">
        {/* Active Tool Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20 transition-all duration-200">
          <div className="flex items-center justify-center w-6 h-6 bg-primary/20 rounded-md">
            <ToolIcon size={16} weight="duotone" className="text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground leading-tight">{toolInfo.name}</span>
            {toolInfo.shortcut && (
              <span className="text-[10px] text-muted-foreground leading-tight">Press {toolInfo.shortcut}</span>
            )}
          </div>
        </div>
        
        {/* Hint */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-lg border border-border/40 max-w-md">
          <LightbulbIcon size={16} weight="duotone" className="text-amber-500 flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{toolInfo.hint}</span>
        </div>
      </div>

      {/* Right: Selection info & Status */}
      <div className="flex items-center gap-3">
        {/* Selection indicator */}
        {selectionInfo && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 rounded-md border border-blue-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-600">{selectionInfo}</span>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground">
          <CommandIcon size={14} weight="regular" />
          <span>K for commands</span>
        </div>
      </div>
    </div>
  );
};
