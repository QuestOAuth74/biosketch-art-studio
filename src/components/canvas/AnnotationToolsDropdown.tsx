import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NumberCircleOneIcon, ArrowBendRightDownIcon, BracketsSquareIcon, ChatsCircleIcon } from "@phosphor-icons/react";
import { ZoomIn } from "lucide-react";
import { AnnotationTestIds } from "@/lib/test-ids";

interface AnnotationToolsDropdownProps {
  onToolChange: (tool: string) => void;
  activeTool: string;
}

export const AnnotationToolsDropdown = ({
  onToolChange,
  activeTool,
}: AnnotationToolsDropdownProps) => {
  const isAnnotationToolActive =
    activeTool === "numbered-callout" ||
    activeTool === "leader-line" ||
    activeTool === "bracket" ||
    activeTool?.startsWith("zoom-callout-");

  const toolButtonBase = "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={isAnnotationToolActive ? toolButtonActive : toolButtonInactive}
          data-testid={AnnotationTestIds.DROPDOWN_TRIGGER}
        >
          <ChatsCircleIcon
            style={{ width: 18, height: 18 }}
            weight={isAnnotationToolActive ? "duotone" : "bold"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" className="w-56">
        <DropdownMenuLabel>Annotations</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onToolChange("numbered-callout")}
          data-testid={AnnotationTestIds.CALLOUT_TOOL}
        >
          <NumberCircleOneIcon style={{ width: 18, height: 18 }} weight="regular" className="mr-2" />
          <span>Numbered Callout</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onToolChange("leader-line")}
          data-testid={AnnotationTestIds.LEADER_LINE_TOOL}
        >
          <ArrowBendRightDownIcon style={{ width: 18, height: 18 }} weight="regular" className="mr-2" />
          <span>Leader Line</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToolChange("bracket")}>
          <BracketsSquareIcon style={{ width: 18, height: 18 }} weight="regular" className="mr-2" />
          <span>Bracket</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Zoom Callouts</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onToolChange("zoom-callout-dotted")}>
          <ZoomIn className="mr-2 h-[20px] w-[20px]" />
          <span>Dotted Lines Callout</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToolChange("zoom-callout-trapezoid")}>
          <ZoomIn className="mr-2 h-[20px] w-[20px]" />
          <span>Trapezoid Callout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
