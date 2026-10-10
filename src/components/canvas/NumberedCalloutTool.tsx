import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NumberCircleOneIcon } from "@phosphor-icons/react";
import { AnnotationTestIds } from "@/lib/test-ids";

interface NumberedCalloutToolProps {
  onToolChange: (tool: string) => void;
  activeTool: string;
}

export function NumberedCalloutTool({ onToolChange, activeTool }: NumberedCalloutToolProps) {
  const isActive = activeTool === "numbered-callout";

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
          onClick={() => onToolChange("numbered-callout")}
          className={isActive ? toolButtonActive : toolButtonInactive}
          data-testid={AnnotationTestIds.CALLOUT_TOOL}
        >
          <NumberCircleOneIcon
            style={{ width: 18, height: 18 }}
            weight={isActive ? "duotone" : "bold"}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs font-medium">
        Numbered Callout
      </TooltipContent>
    </Tooltip>
  );
}
