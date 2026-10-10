import { Button } from "@/components/ui/button";
import { GitBranch } from "lucide-react";

interface OrthogonalLineToolProps {
  onLineSelect: (lineType: string) => void;
  activeTool?: string;
}

export const OrthogonalLineTool = ({ onLineSelect, activeTool }: OrthogonalLineToolProps) => {
  const isOrthogonalLineActive = activeTool === 'orthogonal-line' || activeTool?.startsWith('orthogonal-line');

  const toolButtonBase = "w-8 h-8 flex-shrink-0 rounded-md transition-all duration-150 hover:scale-105";
  const toolButtonActive = `${toolButtonBase} bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
  const toolButtonInactive = `${toolButtonBase} text-muted-foreground hover:text-foreground hover:bg-blue-200/60 hover:shadow-sm`;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onLineSelect('orthogonal-line')}
      className={isOrthogonalLineActive ? toolButtonActive : toolButtonInactive}
    >
      <GitBranch style={{ width: 18, height: 18 }} strokeWidth={2.5} />
    </Button>
  );
};
