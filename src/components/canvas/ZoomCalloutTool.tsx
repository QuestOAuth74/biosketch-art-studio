import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ZoomIn } from "lucide-react";

interface ZoomCalloutToolProps {
  onCalloutSelect: (type: string) => void;
  activeTool?: string;
}

export const ZoomCalloutTool = ({ onCalloutSelect, activeTool }: ZoomCalloutToolProps) => {
  const isActive = activeTool?.startsWith('zoom-callout-');

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
          <ZoomIn style={{ width: 18, height: 18 }} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-card z-50" side="right">
        <DropdownMenuLabel>Zoom Callouts</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onCalloutSelect("zoom-callout-dotted")}>
            <ZoomIn className="mr-2 h-4 w-4" />
            <span>Dotted Lines Callout</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCalloutSelect("zoom-callout-trapezoid")}>
            <ZoomIn className="mr-2 h-4 w-4" />
            <span>Trapezoid Callout</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
