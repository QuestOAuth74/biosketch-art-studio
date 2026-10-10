import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsLeftRightIcon,
  LineSegmentIcon,
} from "@phosphor-icons/react";

interface LinesConnectorsDropdownProps {
  onShapeSelect: (shape: string) => void;
  activeTool?: string;
}

export const LinesConnectorsDropdown = ({
  onShapeSelect,
  activeTool,
}: LinesConnectorsDropdownProps) => {
  const lineTools = [
    "line",
    "line-arrow-right",
    "line-arrow-left",
    "line-arrow-both",
    "dashed-line",
    "dashed-line-arrow",
  ];
  const isActive = activeTool ? lineTools.includes(activeTool) : false;

  const toolButtonBase =
    "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
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
          <ArrowRightIcon
            style={{ width: 18, height: 18 }}
            weight={isActive ? "duotone" : "bold"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        className="w-56 bg-card z-50"
      >
        <DropdownMenuLabel>Lines and Connectors</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onShapeSelect("line")}>
          <LineSegmentIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Line</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("line-arrow-right")}>
          <ArrowRightIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Line Arrow →</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("line-arrow-left")}>
          <ArrowLeftIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Line Arrow ←</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("line-arrow-both")}>
          <ArrowsLeftRightIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Line Arrow ↔</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("dashed-line")}>
          <LineSegmentIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Dashed Line</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShapeSelect("dashed-line-arrow")}>
          <ArrowRightIcon
            style={{ width: 18, height: 18 }}
            weight="regular"
            className="mr-2"
          />
          <span>Dashed Arrow →</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
