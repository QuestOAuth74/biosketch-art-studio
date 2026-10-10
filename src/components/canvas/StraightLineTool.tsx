import { Button } from "@/components/ui/button";
import { Minus } from "lucide-react";

interface StraightLineToolProps {
  onLineSelect: (lineType: string) => void;
  activeTool?: string;
}

export const StraightLineTool = ({ onLineSelect, activeTool }: StraightLineToolProps) => {
  const isStraightLineActive = activeTool === 'straight-line' || activeTool?.startsWith('straight-line');

  const toolButtonBase = "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onLineSelect('straight-line')}
      className={isStraightLineActive ? toolButtonActive : toolButtonInactive}
    >
      <Minus style={{ width: 18, height: 18 }} strokeWidth={2.5} />
    </Button>
  );
};
