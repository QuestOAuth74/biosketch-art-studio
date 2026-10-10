import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AboutDialog = ({ open, onOpenChange }: AboutDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>About BioSketch</DialogTitle>
          <DialogDescription>
            A free community-led project for scientists
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          <p>
            BioSketch is a free community-led project providing open access to scientific
            illustration tools without a paywall — empowering researchers worldwide,
            including those in underserved regions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
