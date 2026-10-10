import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useCanvas } from "@/contexts/CanvasContext";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import {
  Undo2, Redo2, Scissors, Copy, Clipboard, Trash2, Layers,
  ZoomIn, ZoomOut, Maximize, Grid3x3, Ruler, Magnet,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  ArrowUp, ArrowDown, MoveUp, MoveDown, Group, Ungroup,
  MousePointer, Type, Image, Square, Circle, Minus, Move, Eraser,
  FileImage, FileDown, Triangle, Pentagon, Hexagon, Star, Diamond,
  ArrowRight, ArrowLeft, ArrowUpIcon, ArrowDownIcon, FlipHorizontal, FlipVertical,
  RotateCw, RotateCcw, Lock, Unlock, Eye, EyeOff, Pin, PinOff
} from "lucide-react";
import { toast } from "sonner";
import Fuse from "fuse.js";
import { useCommandPaletteStore } from "@/stores/commandPaletteStore";
import { useGridAndRulerStore } from "@/stores/gridAndRulerStore";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToolChange?: (tool: string) => void;
}

export const CommandPalette = ({ open, onOpenChange, onToolChange }: CommandPaletteProps) => {
  const [search, setSearch] = useState("");
  const {
    canvas,
    undo, redo, cut, copy, paste, deleteSelected, selectAll,
    zoomIn, zoomOut, zoomToFit, resetZoom,
    alignLeft, alignCenter, alignRight, alignTop, alignMiddle, alignBottom,
    bringToFront, sendToBack, bringForward, sendBackward,
    groupSelected, ungroupSelected,
    flipHorizontal, flipVertical,
    exportAsPNG, exportAsJPG, exportAsPNGTransparent,
  } = useCanvas();

  const { recentCommands, commandUsage, addRecentCommand, trackCommandUsage } = useCommandPaletteStore();
  const {
    gridEnabled,
    setGridEnabled,
    rulersEnabled,
    setRulersEnabled,
    snapToGrid,
    setSnapToGrid
  } = useGridAndRulerStore();

  // One-time migration from old localStorage to Zustand store
  useEffect(() => {
    const oldUsageKey = 'command-palette-usage';
    const migrationKey = 'command-palette-migrated';

    // Only run migration once
    if (localStorage.getItem(migrationKey)) return;

    const oldUsage = localStorage.getItem(oldUsageKey);
    if (oldUsage) {
      try {
        const parsed = JSON.parse(oldUsage);
        // Migrate each command usage to the new store
        Object.entries(parsed).forEach(([id, data]: [string, any]) => {
          if (data.count && data.lastUsed) {
            // Set the usage data directly in the store
            useCommandPaletteStore.setState((state) => ({
              commandUsage: {
                ...state.commandUsage,
                [id]: { count: data.count, lastUsed: data.lastUsed }
              }
            }));
          }
        });

        // Mark migration as complete and remove old key
        localStorage.setItem(migrationKey, 'true');
        localStorage.removeItem(oldUsageKey);
      } catch (e) {
        console.error('Failed to migrate command palette data:', e);
      }
    } else {
      // No old data to migrate, just mark as migrated
      localStorage.setItem(migrationKey, 'true');
    }
  }, []);

  // Helper function to execute tool change commands
  const executeToolCommand = (id: string) => {
    switch (id) {
      case 'tool-select': onToolChange?.('select'); break;
      case 'tool-text': onToolChange?.('text'); break;
      case 'tool-image': onToolChange?.('image'); break;
      case 'tool-rectangle': onToolChange?.('rectangle'); break;
      case 'tool-circle': onToolChange?.('circle'); break;
      case 'tool-line': onToolChange?.('straight-line'); break;
      case 'tool-pen': onToolChange?.('pen'); break;
      case 'tool-eraser': onToolChange?.('eraser'); break;
      case 'tool-square': onToolChange?.('square'); break;
      case 'tool-triangle': onToolChange?.('triangle'); break;
      case 'tool-pentagon': onToolChange?.('pentagon'); break;
      case 'tool-hexagon': onToolChange?.('hexagon'); break;
      case 'tool-star': onToolChange?.('star'); break;
      case 'tool-diamond': onToolChange?.('rhombus'); break;
      case 'tool-line-arrow-right': onToolChange?.('line-arrow-right'); break;
      case 'tool-line-arrow-left': onToolChange?.('line-arrow-left'); break;
      case 'tool-line-arrow-both': onToolChange?.('line-arrow-both'); break;
      case 'tool-dashed-line': onToolChange?.('dashed-line'); break;
      case 'tool-dashed-line-arrow': onToolChange?.('dashed-line-arrow'); break;
      case 'tool-freeform-line': onToolChange?.('freeform-line'); break;
      case 'tool-curved-line': onToolChange?.('curved-line'); break;
      case 'tool-numbered-callout': onToolChange?.('numbered-callout'); break;
      case 'tool-leader-line': onToolChange?.('leader-line'); break;
      case 'tool-bracket': onToolChange?.('bracket'); break;
      case 'tool-zoom-callout-dotted': onToolChange?.('zoom-callout-dotted'); break;
      case 'tool-zoom-callout-trapezoid': onToolChange?.('zoom-callout-trapezoid'); break;
    }
  };

  const executeCommand = (id: string, label: string) => {
    // Add to recent commands and track usage in store
    addRecentCommand(id);
    trackCommandUsage(id);

    // For tool changes, close dialog first and delay execution
    const isToolCommand = id.startsWith('tool-');

    if (isToolCommand) {
      // Close dialog immediately
      onOpenChange(false);

      // Wait for dialog to fully close, then change tool and restore focus
      setTimeout(() => {
        // Execute the tool change
        executeToolCommand(id);

        // Show success message
        toast.success(label);

        // Restore focus to canvas
        if (canvas) {
          const canvasElement = canvas.getElement();
          const canvasContainer = canvasElement?.parentElement;
          if (canvasContainer) {
            canvasContainer.focus();
          }
        }
      }, 300);
      return;
    }

    // Execute the command
    switch (id) {
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'cut': cut(); break;
      case 'copy': copy(); break;
      case 'paste': paste(); break;
      case 'delete': deleteSelected(); break;
      case 'select-all': selectAll(); break;
      case 'zoom-in': zoomIn(); break;
      case 'zoom-out': zoomOut(); break;
      case 'zoom-fit': zoomToFit(); break;
      case 'zoom-reset': resetZoom(); break;
      case 'grid': setGridEnabled(!gridEnabled); break;
      case 'rulers': setRulersEnabled(!rulersEnabled); break;
      case 'snap-to-grid': setSnapToGrid(!snapToGrid); break;
      case 'align-left':
        // Check if text is selected - do text alignment, otherwise object alignment
        if (canvas) {
          const activeObjects = canvas.getActiveObjects();
          const hasTextSelection = activeObjects.length > 0 && activeObjects.every(
            (obj: any) => obj.type === "textbox" || obj.type === "i-text" || obj.type === "text"
          );
          if (hasTextSelection) {
            activeObjects.forEach((obj: any) => {
              if (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") {
                obj.set({ textAlign: 'left' });
              }
            });
            canvas.requestRenderAll();
          } else {
            alignLeft();
          }
        }
        break;
      case 'align-center':
        // Check if text is selected - do text alignment, otherwise object alignment
        if (canvas) {
          const activeObjects = canvas.getActiveObjects();
          const hasTextSelection = activeObjects.length > 0 && activeObjects.every(
            (obj: any) => obj.type === "textbox" || obj.type === "i-text" || obj.type === "text"
          );
          if (hasTextSelection) {
            activeObjects.forEach((obj: any) => {
              if (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") {
                obj.set({ textAlign: 'center' });
              }
            });
            canvas.requestRenderAll();
          } else {
            alignCenter();
          }
        }
        break;
      case 'align-right':
        // Check if text is selected - do text alignment, otherwise object alignment
        if (canvas) {
          const activeObjects = canvas.getActiveObjects();
          const hasTextSelection = activeObjects.length > 0 && activeObjects.every(
            (obj: any) => obj.type === "textbox" || obj.type === "i-text" || obj.type === "text"
          );
          if (hasTextSelection) {
            activeObjects.forEach((obj: any) => {
              if (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") {
                obj.set({ textAlign: 'right' });
              }
            });
            canvas.requestRenderAll();
          } else {
            alignRight();
          }
        }
        break;
      case 'align-top': alignTop(); break;
      case 'align-middle': alignMiddle(); break;
      case 'align-bottom': alignBottom(); break;
      case 'bring-front': bringToFront(); break;
      case 'send-back': sendToBack(); break;
      case 'bring-forward': bringForward(); break;
      case 'send-backward': sendBackward(); break;
      case 'group': groupSelected(); break;
      case 'ungroup': ungroupSelected(); break;
      case 'flip-horizontal': flipHorizontal?.(); break;
      case 'flip-vertical': flipVertical?.(); break;
      case 'rotate-cw':
        if (canvas) {
          const activeObjects = canvas.getActiveObjects();
          activeObjects.forEach((obj: any) => {
            obj.rotate((obj.angle || 0) + 90);
            obj.setCoords();
          });
          canvas.requestRenderAll();
        }
        break;
      case 'rotate-ccw':
        if (canvas) {
          const activeObjects = canvas.getActiveObjects();
          activeObjects.forEach((obj: any) => {
            obj.rotate((obj.angle || 0) - 90);
            obj.setCoords();
          });
          canvas.requestRenderAll();
        }
        break;
      case 'export-png': exportAsPNG(300); break;
      case 'export-jpg': exportAsJPG(300); break;
      case 'export-png-transparent': exportAsPNGTransparent(300); break;
    }

    toast.success(label);

    // Close dialog immediately, then ensure canvas gets focus after animation completes
    onOpenChange(false);

    // Wait for dialog close animation (200ms) before restoring focus
    // This ensures the dialog's focus trap and overlay are fully removed
    setTimeout(() => {
      // Remove focus from any dialog elements
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Try to focus the canvas for immediate interaction
      if (canvas) {
        const canvasElement = canvas.getElement();
        const canvasContainer = canvasElement?.parentElement;

        // Canvas elements need tabindex to be focusable
        if (canvasContainer) {
          canvasContainer.focus();
        } else {
          // Fallback: just ensure window has focus
          window.focus();
        }
      }
    }, 250);
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const commands = [
    // Edit
    { id: 'undo', label: 'Undo', icon: Undo2, shortcut: 'Ctrl+Z', category: 'Edit', keywords: ['undo', 'revert', 'back'] },
    { id: 'redo', label: 'Redo', icon: Redo2, shortcut: 'Ctrl+Shift+Z', category: 'Edit', keywords: ['redo', 'forward', 'repeat'] },
    { id: 'cut', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X', category: 'Edit', keywords: ['cut', 'remove', 'clipboard'] },
    { id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C', category: 'Edit', keywords: ['copy', 'duplicate', 'clipboard'] },
    { id: 'paste', label: 'Paste', icon: Clipboard, shortcut: 'Ctrl+V', category: 'Edit', keywords: ['paste', 'insert', 'clipboard'] },
    { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del', category: 'Edit', keywords: ['delete', 'remove', 'trash'] },
    { id: 'select-all', label: 'Select All', icon: Layers, shortcut: 'Ctrl+A', category: 'Edit', keywords: ['select', 'all', 'everything'] },

    // View
    { id: 'zoom-in', label: 'Zoom In', icon: ZoomIn, shortcut: 'Ctrl++', category: 'View', keywords: ['zoom', 'in', 'magnify', 'enlarge'] },
    { id: 'zoom-out', label: 'Zoom Out', icon: ZoomOut, shortcut: 'Ctrl+-', category: 'View', keywords: ['zoom', 'out', 'shrink', 'reduce'] },
    { id: 'zoom-fit', label: 'Zoom to Fit', icon: Maximize, shortcut: 'Ctrl+0', category: 'View', keywords: ['zoom', 'fit', 'screen', 'view'] },
    { id: 'zoom-reset', label: 'Reset Zoom', icon: ZoomOut, category: 'View', keywords: ['zoom', 'reset', '100%'] },
    { id: 'grid', label: 'Toggle Grid', icon: Grid3x3, category: 'View', keywords: ['grid', 'toggle', 'show', 'hide'] },
    { id: 'snap-to-grid', label: 'Snap to Grid', icon: Magnet, category: 'View', keywords: ['snap', 'grid', 'magnet', 'align'] },
    { id: 'rulers', label: 'Toggle Rulers', icon: Ruler, category: 'View', keywords: ['rulers', 'toggle', 'show', 'hide', 'guides'] },

    // Arrange
    { id: 'align-left', label: 'Align Left', icon: AlignLeft, category: 'Arrange', keywords: ['align', 'left', 'alignment'] },
    { id: 'align-center', label: 'Align Center', icon: AlignCenter, category: 'Arrange', keywords: ['align', 'center', 'middle', 'alignment'] },
    { id: 'align-right', label: 'Align Right', icon: AlignRight, category: 'Arrange', keywords: ['align', 'right', 'alignment'] },
    { id: 'align-top', label: 'Align Top', icon: AlignVerticalJustifyStart, category: 'Arrange', keywords: ['align', 'top', 'alignment'] },
    { id: 'align-middle', label: 'Align Middle', icon: AlignVerticalJustifyCenter, category: 'Arrange', keywords: ['align', 'middle', 'center', 'alignment'] },
    { id: 'align-bottom', label: 'Align Bottom', icon: AlignVerticalJustifyEnd, category: 'Arrange', keywords: ['align', 'bottom', 'alignment'] },
    { id: 'bring-front', label: 'Bring to Front', icon: ArrowUp, shortcut: 'Ctrl+Shift+]', category: 'Arrange', keywords: ['bring', 'front', 'layer', 'top'] },
    { id: 'send-back', label: 'Send to Back', icon: ArrowDown, shortcut: 'Ctrl+Shift+[', category: 'Arrange', keywords: ['send', 'back', 'layer', 'bottom'] },
    { id: 'bring-forward', label: 'Bring Forward', icon: MoveUp, shortcut: 'Ctrl+]', category: 'Arrange', keywords: ['bring', 'forward', 'layer', 'up'] },
    { id: 'send-backward', label: 'Send Backward', icon: MoveDown, shortcut: 'Ctrl+[', category: 'Arrange', keywords: ['send', 'backward', 'layer', 'down'] },

    // Transform
    { id: 'flip-horizontal', label: 'Flip Horizontal', icon: FlipHorizontal, shortcut: 'Ctrl+Shift+H', category: 'Transform', keywords: ['flip', 'horizontal', 'mirror'] },
    { id: 'flip-vertical', label: 'Flip Vertical', icon: FlipVertical, shortcut: 'Ctrl+Shift+V', category: 'Transform', keywords: ['flip', 'vertical', 'mirror'] },
    { id: 'rotate-cw', label: 'Rotate 90° Clockwise', icon: RotateCw, shortcut: 'Ctrl+R', category: 'Transform', keywords: ['rotate', 'clockwise', 'cw', 'turn'] },
    { id: 'rotate-ccw', label: 'Rotate 90° Counter-Clockwise', icon: RotateCcw, shortcut: 'Ctrl+Shift+R', category: 'Transform', keywords: ['rotate', 'counterclockwise', 'ccw', 'turn'] },

    // Group
    { id: 'group', label: 'Group Objects', icon: Group, shortcut: 'Ctrl+G', category: 'Group', keywords: ['group', 'combine'] },
    { id: 'ungroup', label: 'Ungroup Objects', icon: Ungroup, shortcut: 'Ctrl+Shift+G', category: 'Group', keywords: ['ungroup', 'separate', 'split'] },

    // Tools
    { id: 'tool-select', label: 'Select Tool', icon: MousePointer, shortcut: '1', category: 'Tools', keywords: ['select', 'pointer', 'cursor'] },
    { id: 'tool-text', label: 'Text Tool', icon: Type, shortcut: '2', category: 'Tools', keywords: ['text', 'type', 'label'] },
    { id: 'tool-rectangle', label: 'Rectangle Tool', icon: Square, shortcut: '3', category: 'Tools', keywords: ['rect', 'rectangle', 'box', 'square', 'shape'] },
    { id: 'tool-circle', label: 'Circle Tool', icon: Circle, shortcut: '4', category: 'Tools', keywords: ['circle', 'ellipse', 'oval', 'shape'] },
    { id: 'tool-line', label: 'Line Tool', icon: Minus, shortcut: '5', category: 'Tools', keywords: ['line', 'straight'] },
    { id: 'tool-pen', label: 'Pen Tool', icon: Move, shortcut: '7', category: 'Tools', keywords: ['pen', 'bezier', 'curve', 'path'] },
    { id: 'tool-image', label: 'Image Tool', icon: Image, shortcut: '8', category: 'Tools', keywords: ['image', 'picture', 'photo'] },
    { id: 'tool-eraser', label: 'Eraser Tool', icon: Eraser, shortcut: '9', category: 'Tools', keywords: ['eraser', 'erase', 'remove'] },

    // Shapes
    { id: 'tool-square', label: 'Square Tool', icon: Square, category: 'Shapes', keywords: ['square', 'shape', 'box'] },
    { id: 'tool-triangle', label: 'Triangle Tool', icon: Triangle, category: 'Shapes', keywords: ['triangle', 'shape', 'polygon'] },
    { id: 'tool-pentagon', label: 'Pentagon Tool', icon: Pentagon, category: 'Shapes', keywords: ['pentagon', 'shape', 'polygon'] },
    { id: 'tool-hexagon', label: 'Hexagon Tool', icon: Hexagon, category: 'Shapes', keywords: ['hexagon', 'shape', 'polygon'] },
    { id: 'tool-star', label: 'Star Tool', icon: Star, category: 'Shapes', keywords: ['star', 'shape'] },
    { id: 'tool-diamond', label: 'Diamond Tool', icon: Diamond, category: 'Shapes', keywords: ['diamond', 'rhombus', 'shape'] },

    // Lines & Connectors
    { id: 'tool-line-arrow-right', label: 'Line Arrow Right', icon: ArrowRight, category: 'Lines', keywords: ['line', 'arrow', 'right'] },
    { id: 'tool-line-arrow-left', label: 'Line Arrow Left', icon: ArrowLeft, category: 'Lines', keywords: ['line', 'arrow', 'left'] },
    { id: 'tool-line-arrow-both', label: 'Line Arrow Both', icon: Minus, category: 'Lines', keywords: ['line', 'arrow', 'both', 'double'] },
    { id: 'tool-dashed-line', label: 'Dashed Line', icon: Minus, category: 'Lines', keywords: ['line', 'dashed', 'dotted'] },
    { id: 'tool-dashed-line-arrow', label: 'Dashed Line Arrow', icon: ArrowRight, category: 'Lines', keywords: ['line', 'dashed', 'arrow'] },
    { id: 'tool-freeform-line', label: 'Freeform Line', icon: Move, shortcut: 'F', category: 'Lines', keywords: ['freeform', 'line', 'free', 'draw'] },
    { id: 'tool-curved-line', label: 'Curved Line', icon: Move, category: 'Lines', keywords: ['curved', 'line', 'curve'] },

    // Annotations
    { id: 'tool-numbered-callout', label: 'Numbered Callout', icon: Circle, category: 'Annotations', keywords: ['callout', 'numbered', 'annotation'] },
    { id: 'tool-leader-line', label: 'Leader Line', icon: ArrowRight, category: 'Annotations', keywords: ['leader', 'line', 'annotation'] },
    { id: 'tool-bracket', label: 'Bracket', icon: Square, category: 'Annotations', keywords: ['bracket', 'annotation'] },
    { id: 'tool-zoom-callout-dotted', label: 'Zoom Callout (Dotted)', icon: ZoomIn, category: 'Annotations', keywords: ['zoom', 'callout', 'dotted', 'annotation'] },
    { id: 'tool-zoom-callout-trapezoid', label: 'Zoom Callout (Trapezoid)', icon: ZoomIn, category: 'Annotations', keywords: ['zoom', 'callout', 'trapezoid', 'annotation'] },

    // Export
    { id: 'export-png', label: 'Export as PNG', icon: FileImage, category: 'Export', keywords: ['export', 'png', 'save', 'download'] },
    { id: 'export-jpg', label: 'Export as JPG', icon: FileDown, category: 'Export', keywords: ['export', 'jpg', 'jpeg', 'save', 'download'] },
    { id: 'export-png-transparent', label: 'Export as PNG (Transparent)', icon: FileImage, category: 'Export', keywords: ['export', 'png', 'transparent', 'save', 'download'] },
  ];

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => new Fuse(commands, {
    keys: ['label', 'category', 'keywords'],
    threshold: 0.3,
    ignoreLocation: true
  }), []);

  // Apply fuzzy search or show all commands
  const filteredCommands = search
    ? fuse.search(search).map(result => result.item)
    : commands;

  // Get frequently used commands
  const getFrequentCommands = useCallback(() => {
    return Object.entries(commandUsage)
      .filter(([_, data]) => data.count >= 3)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id]) => commands.find(cmd => cmd.id === id))
      .filter(Boolean);
  }, [commandUsage]);

  const categories = Array.from(new Set(filteredCommands.map(cmd => cmd.category)));
  const recentCommandsData = recentCommands
    .map(id => commands.find(cmd => cmd.id === id))
    .filter(Boolean) as typeof commands;
  const frequentCommandsData = getFrequentCommands() as typeof commands;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl" data-testid={CanvasEditorTestIds.COMMAND_PALETTE_DIALOG}>
        <Command className="rounded-lg border-none">
          <CommandInput
            placeholder="Search commands..."
            value={search}
            onValueChange={setSearch}
            data-testid={CanvasEditorTestIds.COMMAND_PALETTE_INPUT}
          />
          <CommandList>
            <CommandEmpty>No commands found.</CommandEmpty>

            {frequentCommandsData.length > 0 && search === "" && (
              <>
                <CommandGroup heading="Frequently Used">
                  {frequentCommandsData.map(cmd => {
                    const Icon = cmd.icon;
                    return (
                      <CommandItem
                        key={cmd.id}
                        onSelect={() => executeCommand(cmd.id, cmd.label)}
                        className="flex items-center justify-between py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{cmd.label}</span>
                        </div>
                        {cmd.shortcut && (
                          <kbd className="text-xs px-2 py-1 bg-muted rounded">{cmd.shortcut}</kbd>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {recentCommandsData.length > 0 && search === "" && (
              <>
                <CommandGroup heading="Recent" data-testid={CanvasEditorTestIds.COMMAND_PALETTE_RECENT_GROUP}>
                  {recentCommandsData.map(cmd => {
                    const Icon = cmd.icon;
                    return (
                      <CommandItem
                        key={cmd.id}
                        onSelect={() => executeCommand(cmd.id, cmd.label)}
                        className="flex items-center justify-between py-3"
                        data-testid={CanvasEditorTestIds.COMMAND_PALETTE_ITEM}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{cmd.label}</span>
                        </div>
                        {cmd.shortcut && (
                          <kbd className="text-xs px-2 py-1 bg-muted rounded">{cmd.shortcut}</kbd>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            
            {categories.map(category => (
              <CommandGroup key={category} heading={category}>
                {filteredCommands
                  .filter(cmd => cmd.category === category)
                  .map(cmd => {
                    const Icon = cmd.icon;
                    return (
                      <CommandItem
                        key={cmd.id}
                        onSelect={() => executeCommand(cmd.id, cmd.label)}
                        className="flex items-center justify-between py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{cmd.label}</span>
                        </div>
                        {cmd.shortcut && (
                          <kbd className="text-xs px-2 py-1 bg-muted rounded">{cmd.shortcut}</kbd>
                        )}
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
