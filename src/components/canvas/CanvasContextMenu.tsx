import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { LockIcon } from "@phosphor-icons/react";
import { FabricObject } from "fabric";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Clipboard,
  Copy,
  Eye,
  EyeOff,
  Files,
  Group,
  MousePointerClick,
  Redo2,
  Scissors,
  Settings,
  Trash2,
  Undo2,
  Ungroup,
  Unlock,
  Wand2,
  PackagePlus,
  Palette,
  Sparkles,
} from "lucide-react";
import { isIconGroup } from "@/lib/stylePresetExtractor";

interface CanvasContextMenuProps {
  children: React.ReactNode;
  selectedObject: FabricObject | null;
  hasClipboard: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasHiddenObjects: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLock: () => void;
  onHide: () => void;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onSelectAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onShowAllHidden: () => void;
  onOpenProperties: () => void;
  onCustomizeWithAI: () => void;
  onSaveAsGroupIcon: () => void;
  onSaveAsLinePreset?: () => void;
  onRecolor?: () => void;
  onRemixWithAI?: () => void;
}

export const CanvasContextMenu = ({
  children,
  selectedObject,
  hasClipboard,
  canUndo,
  canRedo,
  hasHiddenObjects,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDelete,
  onLock,
  onHide,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onGroup,
  onUngroup,
  onSelectAll,
  onUndo,
  onRedo,
  onShowAllHidden,
  onOpenProperties,
  onCustomizeWithAI,
  onSaveAsGroupIcon,
  onSaveAsLinePreset,
  onRecolor,
  onRemixWithAI,
}: CanvasContextMenuProps) => {
  const hasSelection = !!selectedObject;
  // Determine if multiple objects are selected without relying on private Fabric internals
  const selectionCount = (() => {
    const anyObj = selectedObject as any;
    if (!anyObj) return 0;
    if (anyObj.type === "activeSelection") {
      if (typeof anyObj.size === "function") return anyObj.size();
      if (typeof anyObj.getObjects === "function")
        return (anyObj.getObjects() || []).length;
      if (Array.isArray(anyObj._objects)) return anyObj._objects.length; // fallback
      return 0;
    }
    return 1;
  })();
  const isMultipleSelection = selectionCount > 1;
  const isGroup = (selectedObject as any)?.type === "group";
  const isLocked =
    (selectedObject as any)?.lockMovementX ||
    (selectedObject as any)?.lockMovementY;
  const isTextObject =
    (selectedObject as any)?.type === "textbox" ||
    (selectedObject as any)?.type === "i-text" ||
    (selectedObject as any)?.type === "text";
  const isImageObject = selectedObject?.type === "image";
  const isIconObject = selectedObject ? isIconGroup(selectedObject) : false;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild={false}
        className="w-full h-full"
      >
        <div className="w-full h-full">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {hasSelection ? (
          // Menu when object is selected
          <>
            <ContextMenuItem onClick={onCopy}>
              <Copy className="mr-2 h-4 w-4" />
              <span>Copy</span>
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={onCut}>
              <Scissors className="mr-2 h-4 w-4" />
              <span>Cut</span>
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
            {hasClipboard && (
              <ContextMenuItem onClick={onPaste}>
                <Clipboard className="mr-2 h-4 w-4" />
                <span>Paste</span>
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={onDuplicate}>
              <Files className="mr-2 h-4 w-4" />
              <span>Duplicate</span>
              <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
              <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={onLock}>
              {isLocked ? (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  <span>Unlock</span>
                </>
              ) : (
                <>
                  <LockIcon className="mr-2 h-4 w-4" />
                  <span>Lock</span>
                </>
              )}
              <ContextMenuShortcut>⌘⇧L</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={onHide}>
              <EyeOff className="mr-2 h-4 w-4" />
              <span>Hide</span>
              <ContextMenuShortcut>H</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={onBringToFront}>
              <ChevronsUp className="mr-2 h-4 w-4" />
              <span>Bring to Front</span>
              <ContextMenuShortcut>⌘⇧]</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={onBringForward}>
              <ArrowUp className="mr-2 h-4 w-4" />
              <span>Bring Forward</span>
              <ContextMenuShortcut>⌘]</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={onSendBackward}>
              <ArrowDown className="mr-2 h-4 w-4" />
              <span>Send Backward</span>
              <ContextMenuShortcut>⌘[</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={onSendToBack}>
              <ChevronsDown className="mr-2 h-4 w-4" />
              <span>Send to Back</span>
              <ContextMenuShortcut>⌘⇧[</ContextMenuShortcut>
            </ContextMenuItem>

            {(isMultipleSelection || isGroup) && (
              <>
                <ContextMenuSeparator />
                {isMultipleSelection && (
                  <ContextMenuItem onClick={onGroup}>
                    <Group className="mr-2 h-4 w-4" />
                    <span>Group</span>
                    <ContextMenuShortcut>⌘G</ContextMenuShortcut>
                  </ContextMenuItem>
                )}
                {isGroup && (
                  <ContextMenuItem onClick={onUngroup}>
                    <Ungroup className="mr-2 h-4 w-4" />
                    <span>Ungroup</span>
                    <ContextMenuShortcut>⌘⇧G</ContextMenuShortcut>
                  </ContextMenuItem>
                )}
              </>
            )}

            <ContextMenuSeparator />

            <ContextMenuItem onClick={onOpenProperties}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Properties</span>
            </ContextMenuItem>

            {isIconObject && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={onCustomizeWithAI}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  <span>Customize with AI</span>
                </ContextMenuItem>
                {onRemixWithAI && (
                  <ContextMenuItem onClick={onRemixWithAI}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span>Remix with AI</span>
                  </ContextMenuItem>
                )}
                {onRecolor && (
                  <ContextMenuItem onClick={onRecolor}>
                    <Palette className="mr-2 h-4 w-4" />
                    <span>Recolor (no AI)</span>
                  </ContextMenuItem>
                )}
              </>
            )}
            {!isIconObject && (isImageObject || isGroup) && onRecolor && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={onRecolor}>
                  <Palette className="mr-2 h-4 w-4" />
                  <span>Recolor (no AI)</span>
                </ContextMenuItem>
              </>
            )}

            {(isMultipleSelection || isGroup) && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={onSaveAsGroupIcon}>
                  <PackagePlus className="mr-2 h-4 w-4" />
                  <span>Save as Group Icon</span>
                </ContextMenuItem>
              </>
            )}

            {onSaveAsLinePreset && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={onSaveAsLinePreset}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Save as Line Preset</span>
                </ContextMenuItem>
              </>
            )}
          </>
        ) : (
          // Menu when canvas is empty (no selection)
          <>
            {hasClipboard && (
              <ContextMenuItem onClick={onPaste}>
                <Clipboard className="mr-2 h-4 w-4" />
                <span>Paste</span>
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={onSelectAll}>
              <MousePointerClick className="mr-2 h-4 w-4" />
              <span>Select All</span>
              <ContextMenuShortcut>⌘A</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            {canUndo && (
              <ContextMenuItem onClick={onUndo}>
                <Undo2 className="mr-2 h-4 w-4" />
                <span>Undo</span>
                <ContextMenuShortcut>⌘Z</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {canRedo && (
              <ContextMenuItem onClick={onRedo}>
                <Redo2 className="mr-2 h-4 w-4" />
                <span>Redo</span>
                <ContextMenuShortcut>⌘⇧Z</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            {hasHiddenObjects && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={onShowAllHidden}>
                  <Eye className="mr-2 h-4 w-4" />
                  <span>Show All Hidden Objects</span>
                  <ContextMenuShortcut>⌘H</ContextMenuShortcut>
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
