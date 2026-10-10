import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArcLineToolProps {
  onArcSelect: (tool: string) => void;
  activeTool: string;
}

const ARC_OPTIONS = [
  {
    id: "arc-quarter",
    label: "Quarter Circle (90°)",
    preview: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M 3 15 A 12 12 0 0 1 15 3" />
      </svg>
    ),
  },
  {
    id: "arc-half",
    label: "Half Circle (180°)",
    preview: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M 12 3 A 6 6 0 0 0 12 15" />
      </svg>
    ),
  },
  {
    id: "arc-three-quarter",
    label: "Three-Quarter Circle (270°)",
    preview: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M 15 9 A 6 6 0 1 0 9 3" />
      </svg>
    ),
  },
] as const;

export const ArcLineTool = ({ onArcSelect, activeTool }: ArcLineToolProps) => {
  const isActive = ARC_OPTIONS.some((opt) => activeTool === opt.id);

  const toolButtonBase = "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={isActive ? toolButtonActive : toolButtonInactive}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M 3 15 A 12 12 0 0 1 15 3" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-52">
        {ARC_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => onArcSelect(opt.id)}
            className={`flex items-center gap-2.5 cursor-pointer ${
              activeTool === opt.id ? "bg-primary/10 text-primary" : ""
            }`}
          >
            {opt.preview}
            <span className="text-xs">{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
