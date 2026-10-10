import { Button } from "@/components/ui/button";
import { Download, Eraser, Sparkles } from "lucide-react";

interface CanvasToolbarProps {
  onClear: () => void;
  onExport: () => void;
  onAIIconGenerator?: () => void;
}

export const CanvasToolbar = ({
  onClear,
  onExport,
  onAIIconGenerator,
}: CanvasToolbarProps) => {
  return (
    <div className="flex gap-2">
      {onAIIconGenerator && (
        <Button
          variant="outline"
          onClick={onAIIconGenerator}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI Icon
        </Button>
      )}
      <Button
        variant="outline"
        onClick={onClear}
      >
        <Eraser className="h-5 w-5" />
        Clear Canvas
      </Button>
      <Button onClick={onExport}>
        <Download className="h-4 w-4 mr-2" />
        Export Image
      </Button>
    </div>
  );
};
