import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useCanvas } from "@/contexts/CanvasContext";

interface ImageEditOverlayProps {
  onDone: () => void;
  onCancel: () => void;
}

export const ImageEditOverlay = ({ onDone, onCancel }: ImageEditOverlayProps) => {
  const handleDone = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDone();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  };

  return (
    <>
      {/* Action buttons - fully interactive */}
      <div className="fixed top-4 left-4 flex gap-2 z-[101] pointer-events-auto">
        <Button onClick={handleDone} size="sm" className="bg-primary hover:bg-primary/90 shadow-lg">
          <Check className="h-4 w-4 mr-1" />
          Done
        </Button>
        <Button onClick={handleCancel} size="sm" variant="outline" className="bg-white hover:bg-gray-100 shadow-lg">
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>

      {/* Instruction text */}
      <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-md shadow-lg pointer-events-none z-[101]">
        <p className="text-sm font-semibold">
          Edit Image Position
        </p>
        <p className="text-xs mt-1 opacity-90">
          Move and scale the image within the mask
        </p>
        <p className="text-xs mt-1 opacity-90">
          Press <kbd className="px-1 py-0.5 bg-white/20 border border-white/30 rounded text-xs">Escape</kbd> to exit
        </p>
      </div>
    </>
  );
};
