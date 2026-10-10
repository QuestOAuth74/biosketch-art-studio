import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BracketsSquareIcon } from "@phosphor-icons/react";

interface BracketToolProps {
  onToolChange: (tool: string) => void;
  activeTool: string;
}

export function BracketTool({ onToolChange, activeTool }: BracketToolProps) {
  const isActive = activeTool === "bracket";

  const toolButtonActive =
    "h-8 w-8 flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors";
  const toolButtonInactive =
    "h-8 w-8 flex items-center justify-center rounded text-blue-700 hover:bg-blue-100 transition-colors";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToolChange("bracket")}
          className={isActive ? toolButtonActive : toolButtonInactive}
        >
          <BracketsSquareIcon
            style={{ width: 18, height: 18 }}
            weight={isActive ? "duotone" : "bold"}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs font-medium">
        Bracket
      </TooltipContent>
    </Tooltip>
  );
}
