import { useCallback, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MousePointer2, Type, Square, Circle, Minus, PenTool, Eraser, ImageIcon,
  ChevronDown, Triangle, Spline, Star, Hexagon, Diamond, ArrowRight, ArrowLeft,
  ArrowUp, ArrowDown, MoveRight, CornerDownRight, Pen, Pentagon, RectangleHorizontal,
  Pilcrow, Hash, Maximize2, BarChart3, Table2, Crosshair, MessageSquare,
  Wrench, Dna, Waves, Undo2, Redo2, FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCanvas } from '@/contexts/CanvasContext';
import { LinesDropdown } from '@/components/canvas/LinesDropdown';
import { restoreObjectCustomProps } from '@/lib/canvasPostProcessing';
import { applyEndpointMarkers, attachMarkerSyncForLine } from '@/lib/lineEndpointRenderer';

interface SimpleToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
}

interface ToolItem {
  id: string;
  label: string;
  icon: any;
  shortcut?: string;
}

interface ToolGroup {
  id: string;
  label: string;
  icon: any;
  items: ToolItem[];
}

const SHAPES_GROUP: ToolGroup = {
  id: 'shapes',
  label: 'Shapes',
  icon: Square,
  items: [
    { id: 'rectangle', label: 'Rectangle', icon: Square, shortcut: 'R' },
    { id: 'rounded-rect', label: 'Rounded Rectangle', icon: RectangleHorizontal },
    { id: 'circle', label: 'Circle', icon: Circle, shortcut: 'C' },
    { id: 'ellipse', label: 'Ellipse', icon: Circle },
    { id: 'triangle', label: 'Triangle', icon: Triangle },
    { id: 'star', label: 'Star', icon: Star },
    { id: 'hexagon', label: 'Hexagon', icon: Hexagon },
    { id: 'rhombus', label: 'Diamond', icon: Diamond },
    { id: 'pentagon', label: 'Pentagon', icon: Pentagon },
    { id: 'arrow-right', label: 'Arrow Right', icon: ArrowRight },
    { id: 'arrow-left', label: 'Arrow Left', icon: ArrowLeft },
    { id: 'arrow-up', label: 'Arrow Up', icon: ArrowUp },
    { id: 'arrow-down', label: 'Arrow Down', icon: ArrowDown },
  ],
};

const LINES_GROUP: ToolGroup = {
  id: 'lines',
  label: 'Lines',
  icon: Minus,
  items: [
    { id: 'straight-line', label: 'Straight Line', icon: Minus, shortcut: 'L' },
    { id: 'straight-line-arrow', label: 'Arrow Line', icon: MoveRight },
    { id: 'curved-line', label: 'Curved Line', icon: Spline },
    { id: 'orthogonal-line', label: 'Orthogonal Line', icon: CornerDownRight },
    { id: 'freeform-line', label: 'Freeform Line', icon: Pen },
  ],
};

const ANNOTATE_GROUP: ToolGroup = {
  id: 'annotate',
  label: 'Annotate',
  icon: MessageSquare,
  items: [
    { id: 'leader-line', label: 'Leader Line', icon: Pilcrow },
    { id: 'bracket', label: 'Bracket', icon: Maximize2 },
    { id: 'numbered-callout', label: 'Numbered Callout', icon: Hash },
    { id: 'zoom-callout-dotted', label: 'Zoom Callout', icon: Crosshair },
  ],
};

const DRAW_GROUP: ToolGroup = {
  id: 'draw',
  label: 'Draw',
  icon: PenTool,
  items: [
    { id: 'pen', label: 'Pen', icon: PenTool, shortcut: 'P' },
    { id: 'custom-polygon', label: 'Polygon', icon: Pentagon },
    { id: 'eraser', label: 'Eraser', icon: Eraser, shortcut: 'E' },
  ],
};

const INSERT_GROUP: ToolGroup = {
  id: 'insert',
  label: 'Insert',
  icon: ImageIcon,
  items: [
    { id: 'image', label: 'Image', icon: ImageIcon, shortcut: 'I' },
    { id: 'chart', label: 'Chart', icon: BarChart3 },
    { id: 'table', label: 'Table', icon: Table2 },
  ],
};

const TOOL_GROUPS = [SHAPES_GROUP, LINES_GROUP, ANNOTATE_GROUP, DRAW_GROUP, INSERT_GROUP];

// Advanced tools from the full editor not in the main groups
const ADVANCED_TOOLS: ToolGroup = {
  id: 'advanced',
  label: 'More Tools',
  icon: Wrench,
  items: [
    { id: 'chart', label: 'Insert Chart', icon: BarChart3 },
    { id: 'table', label: 'Insert Table', icon: Table2 },
    { id: 'pdb-structure', label: 'PDB Structure', icon: FlaskConical },
    { id: 'membrane-path', label: 'Membrane Path', icon: Waves },
    { id: 'triple-membrane', label: 'Triple Membrane', icon: Waves },
    { id: 'dna-helix', label: 'DNA Helix', icon: Dna },
  ],
};

// Collect all tool IDs per group for active state detection
const groupToolIds: Record<string, string[]> = {};
TOOL_GROUPS.forEach(g => { groupToolIds[g.id] = g.items.map(i => i.id); });
groupToolIds[ADVANCED_TOOLS.id] = ADVANCED_TOOLS.items.map(i => i.id);

export function SimpleToolbar({ activeTool, onToolChange }: SimpleToolbarProps) {
  const { canvas, undo, redo, saveState } = useCanvas();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useState<Record<string, ToolItem>>({});

  // Place a line preset on the canvas (mirrors handleLinePresetSelect from Canvas.tsx)
  const handleLinePresetSelect = useCallback(async (preset: any) => {
    if (!canvas) return;
    try {
      const json = preset.fabric_json;
      const { util } = await import('fabric');

      const [obj] = await new Promise<any[]>((resolve, reject) => {
        try {
          const maybe = (util as any).enlivenObjects([json], (objects: any[]) => resolve(objects));
          if (maybe && typeof (maybe as any).then === 'function') {
            (maybe as Promise<any[]>).then(resolve).catch(reject);
          }
        } catch (e) { reject(e); }
      });

      if (!obj) return;

      const restoreRecursive = (o: any, d: any) => {
        restoreObjectCustomProps(o, d);
        if (o.type === 'group' && o._objects && d.objects) {
          o._objects.forEach((child: any, i: number) => {
            if (d.objects[i]) restoreRecursive(child, d.objects[i]);
          });
        }
      };
      restoreRecursive(obj, json);

      // Force strokeUniform on all stroked objects so lines don't thicken when scaled
      const forceStrokeUniform = (o: any) => {
        if (o.stroke != null) {
          o.set({ strokeUniform: true });
        }
        if (o.type === 'group' && o._objects) {
          o._objects.forEach(forceStrokeUniform);
        }
      };
      forceStrokeUniform(obj);

      const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      const cx = (canvas.width! / 2 - vpt[4]) / vpt[0];
      const cy = (canvas.height! / 2 - vpt[5]) / vpt[3];
      obj.set({ left: cx - (obj.width || 50) / 2, top: cy - (obj.height || 50) / 2 });
      obj.setCoords();

      canvas.add(obj);
      canvas.setActiveObject(obj);

      // Reapply endpoint markers from saved marker types so inhibitors,
      // arrows etc. follow the actual path tangent (not the saved snapshot
      // angle that may be wrong for arc paths / curved lines).
      const startType = (obj as any).startMarkerType || 'none';
      const endType = (obj as any).endMarkerType || 'none';
      if (startType !== 'none' || endType !== 'none') {
        // Saved curved line presets are Path objects without curvedLineControlPoint
        // and without isArcPath, which causes calculateLineTangentAngles to fall
        // through to a straight-line fallback. Force isArcPath on any Path object
        // with markers so the path-sampling tangent code runs and the inhibitor
        // bar / arrow gets the correct perpendicular orientation.
        if ((obj as any).type === 'path' && (obj as any).path) {
          (obj as any).isArcPath = true;
        }
        applyEndpointMarkers(canvas, obj, startType, endType);
        attachMarkerSyncForLine(canvas, obj);
      }

      canvas.fire('object:modified', { target: obj });
      obj.fire('modified');
      canvas.requestRenderAll();
      saveState();
    } catch (e) {
      console.error('Failed to place line preset:', e);
    }
  }, [canvas, saveState]);

  const handleGroupItemClick = (groupId: string, item: ToolItem) => {
    onToolChange(item.id);
    setLastUsed(prev => ({ ...prev, [groupId]: item }));
    setOpenGroup(null);
  };

  const isGroupActive = (groupId: string) => groupToolIds[groupId]?.includes(activeTool);

  const getGroupIcon = (group: ToolGroup) => {
    const activeItem = group.items.find(i => i.id === activeTool);
    if (activeItem) return activeItem.icon;
    return lastUsed[group.id]?.icon || group.icon;
  };

  const renderGroupButton = (group: ToolGroup, align: "center" | "start" | "end" = "center") => {
    const GroupIcon = getGroupIcon(group);
    const active = isGroupActive(group.id);
    const isAdvanced = group.id === 'advanced';

    return (
      <Popover
        key={group.id}
        open={openGroup === group.id}
        onOpenChange={(open) => setOpenGroup(open ? group.id : null)}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "h-9 pl-2 pr-1.5 flex items-center gap-0.5 rounded-xl transition-all duration-200",
                  active
                    ? "glass-active-tool"
                    : isAdvanced
                      ? "text-muted-foreground hover:bg-gradient-to-br hover:from-amber-500/15 hover:to-orange-500/15 hover:text-amber-700 dark:hover:text-amber-300"
                      : "glass-hover-tool text-muted-foreground"
                )}
              >
                <GroupIcon className="h-4 w-4" />
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{group.label}</TooltipContent>
        </Tooltip>

        <PopoverContent className={cn("p-1.5 glass-surface-strong rounded-2xl border-0", isAdvanced ? "w-60" : "w-52")} align={align}>
          <div className="px-2 py-1.5 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{group.label}</p>
          </div>
          <ScrollArea className={isAdvanced ? "max-h-[320px]" : ""}>
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleGroupItemClick(group.id, item)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all",
                  activeTool === item.id
                    ? "bg-slate-900 dark:bg-slate-700 text-white font-semibold"
                    : "text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md font-mono",
                    activeTool === item.id ? "bg-white/20 text-white" : "text-muted-foreground bg-slate-100 dark:bg-slate-800"
                  )}>{item.shortcut}</span>
                )}
              </button>
            ))}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="h-12 glass-surface flex items-center justify-center gap-1 px-3 shrink-0 relative z-20 rounded-none border-x-0 border-t-0">
      {/* Undo / Redo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={undo}
            className="glass-hover-tool h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground transition-all duration-200"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Undo <span className="text-muted-foreground">(Ctrl+Z)</span></TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={redo}
            className="glass-hover-tool h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground transition-all duration-200"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Redo <span className="text-muted-foreground">(Ctrl+Shift+Z)</span></TooltipContent>
      </Tooltip>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      {/* Select */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToolChange('select')}
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-200",
              activeTool === 'select'
                ? "glass-active-tool"
                : "glass-hover-tool text-muted-foreground"
            )}
          >
            <MousePointer2 className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Select <span className="text-muted-foreground">(V)</span></TooltipContent>
      </Tooltip>

      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

      {/* Tool groups */}
      {TOOL_GROUPS.map((group) => renderGroupButton(group))}

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Text - standalone */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToolChange('text')}
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-200",
              activeTool === 'text'
                ? "glass-active-tool"
                : "glass-hover-tool text-muted-foreground"
            )}
          >
            <Type className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Text <span className="text-muted-foreground">(T)</span></TooltipContent>
      </Tooltip>

      {/* Line presets dropdown */}
      <LinesDropdown onPresetSelect={handleLinePresetSelect} />

      {/* Advanced tools dropdown */}
      {renderGroupButton(ADVANCED_TOOLS, "end")}
    </div>
  );
}
