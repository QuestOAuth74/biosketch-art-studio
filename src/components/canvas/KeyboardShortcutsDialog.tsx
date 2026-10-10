import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Keyboard,
  MousePointer2,
  Clipboard,
  Move,
  Layers,
  Eye,
  ZoomIn,
  Type,
  Trash2,
  Command,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export const KeyboardShortcutsDialog = ({
  open,
  onOpenChange,
  trigger,
}: KeyboardShortcutsDialogProps) => {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl";

  const shortcuts: {
    category: string;
    icon: LucideIcon;
    items: { keys: string[]; description: string }[];
  }[] = [
    {
      category: "Basic Actions",
      icon: Command,
      items: [
        { keys: [`${modKey}`, "Z"], description: "Undo" },
        { keys: [`${modKey}`, "⇧", "Z"], description: "Redo" },
        { keys: [`${modKey}`, "S"], description: "Save project" },
        { keys: [`${modKey}`, "E"], description: "Export (300 DPI)" },
        { keys: [`${modKey}`, "K"], description: "Command Palette" },
        { keys: ["?"], description: "Show shortcuts" },
      ],
    },
    {
      category: "Clipboard",
      icon: Clipboard,
      items: [
        { keys: [`${modKey}`, "C"], description: "Copy" },
        { keys: [`${modKey}`, "X"], description: "Cut" },
        { keys: [`${modKey}`, "V"], description: "Paste" },
        { keys: [`${modKey}`, "⇧", "V"], description: "Paste in place" },
        { keys: [`${modKey}`, "D"], description: "Duplicate" },
        { keys: ["Alt", "Drag"], description: "Quick duplicate" },
      ],
    },
    {
      category: "Selection",
      icon: MousePointer2,
      items: [
        { keys: [`${modKey}`, "A"], description: "Select all" },
        { keys: [`${modKey}`, "⇧", "A"], description: "Deselect all" },
        { keys: ["Tab"], description: "Cycle objects" },
        { keys: ["⇧", "Tab"], description: "Cycle backwards" },
        { keys: ["Esc"], description: "Deselect" },
      ],
    },
    {
      category: "Arrange & Transform",
      icon: Layers,
      items: [
        { keys: [`${modKey}`, "⇧", "]"], description: "Bring to front" },
        { keys: [`${modKey}`, "]"], description: "Bring forward" },
        { keys: [`${modKey}`, "["], description: "Send backward" },
        { keys: [`${modKey}`, "⇧", "["], description: "Send to back" },
        { keys: [`${modKey}`, "R"], description: "Rotate 90° CW" },
        { keys: [`${modKey}`, "⇧", "R"], description: "Rotate 90° CCW" },
        { keys: [`${modKey}`, "⇧", "L"], description: "Lock / Unlock" },
        { keys: [`${modKey}`, "L"], description: "Pin / Unpin" },
        { keys: [`${modKey}`, "G"], description: "Group" },
        { keys: [`${modKey}`, "⇧", "G"], description: "Ungroup" },
      ],
    },
    {
      category: "Visibility",
      icon: Eye,
      items: [
        { keys: ["H"], description: "Hide selected" },
        { keys: [`${modKey}`, "H"], description: "Show all hidden" },
      ],
    },
    {
      category: "Movement",
      icon: Move,
      items: [
        { keys: ["↑ ↓ ← →"], description: "Nudge 1px" },
        { keys: ["⇧", "↑ ↓ ← →"], description: "Nudge 10px" },
      ],
    },
    {
      category: "Tools",
      icon: Type,
      items: [
        { keys: ["1"], description: "Select" },
        { keys: ["2"], description: "Text" },
        { keys: ["3"], description: "Rectangle" },
        { keys: ["4"], description: "Circle" },
        { keys: ["5"], description: "Line" },
        { keys: ["6"], description: "Arrow" },
        { keys: ["7"], description: "Pen" },
        { keys: ["8"], description: "Image" },
        { keys: ["9"], description: "Eraser" },
        { keys: ["C"], description: "Comment" },
      ],
    },
    {
      category: "View & Zoom",
      icon: ZoomIn,
      items: [
        { keys: [`${modKey}`, "="], description: "Zoom in" },
        { keys: [`${modKey}`, "-"], description: "Zoom out" },
        { keys: [`${modKey}`, "0"], description: "Fit to screen" },
        { keys: [`${modKey}`, "1"], description: "Zoom to 100%" },
        { keys: ["F11"], description: "Toggle fullscreen" },
        { keys: [`${modKey}`, "'"], description: "Toggle grid" },
        { keys: ["Alt", "R"], description: "Toggle rulers" },
        { keys: [`${modKey}`, "Scroll"], description: "Zoom with trackpad" },
      ],
    },
    {
      category: "Delete",
      icon: Trash2,
      items: [
        { keys: ["Del"], description: "Delete selected" },
        { keys: ["⌫"], description: "Delete selected" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Keyboard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Keyboard Shortcuts</DialogTitle>
              <DialogDescription className="text-sm">
                Speed up your workflow with these shortcuts
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[520px]">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-6">
            {shortcuts.map((section) => {
              const SectionIcon = section.icon;
              return (
                <div key={section.category} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1">
                    <SectionIcon className="h-3.5 w-3.5" />
                    {section.category}
                  </h3>
                  <div className="space-y-0.5">
                    {section.items.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors group"
                      >
                        <span className="text-[13px] text-foreground/80 group-hover:text-foreground transition-colors">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0 ml-3">
                          {shortcut.keys.map((key, keyIndex) => (
                            <div key={keyIndex} className="flex items-center gap-0.5">
                              <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 bg-muted/60 border border-border/80 rounded text-[11px] font-mono font-medium text-muted-foreground min-w-[1.5rem] text-center shadow-[0_1px_0_0] shadow-border/50">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-muted-foreground/40 text-[10px] mx-0.5">+</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
          <span>Hover over any tool to see its shortcut</span>
          <span>
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-muted border border-border/80 rounded text-[11px] font-mono shadow-[0_1px_0_0] shadow-border/50">
              ?
            </kbd>{" "}
            to reopen
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
