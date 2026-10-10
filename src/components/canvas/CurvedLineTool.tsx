import { Button } from "@/components/ui/button";
import { BezierCurveIcon } from "@phosphor-icons/react";

interface CurvedLineToolProps {
  onLineSelect: (lineType: string) => void;
  activeTool?: string;
}

export const CurvedLineTool = ({ onLineSelect, activeTool }: CurvedLineToolProps) => {
  const isActive = activeTool === 'curved-line' || activeTool?.startsWith("curved-line");

  const toolButtonBase = "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onLineSelect('curved-line')}
      className={isActive ? toolButtonActive : toolButtonInactive}
    >
      <BezierCurveIcon style={{ width: 18, height: 18, transform: "rotate(15deg)" }} weight={isActive ? "duotone" : "bold"} />
    </Button>
  );
};
