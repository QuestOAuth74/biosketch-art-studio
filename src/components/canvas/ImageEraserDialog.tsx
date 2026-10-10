import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageEraserTool } from "./ImageEraserTool";
import { FabricImage } from "fabric";

interface ImageEraserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: FabricImage | null;
  onComplete: (newImageDataUrl: string) => void;
}

export const ImageEraserDialog = ({
  open,
  onOpenChange,
  image,
  onComplete,
}: ImageEraserDialogProps) => {
  if (!image) return null;

  const handleComplete = (dataUrl: string) => {
    onComplete(dataUrl);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manual Background Eraser</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <ImageEraserTool
            image={image}
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
