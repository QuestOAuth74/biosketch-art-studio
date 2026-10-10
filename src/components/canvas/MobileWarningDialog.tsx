import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, AlertTriangle } from "lucide-react";

export function MobileWarningDialog() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show dialog when on mobile, hide when screen becomes larger
    setOpen(isMobile);
  }, [isMobile]);

  const handleReturnHome = () => {
    navigate("/");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md stable-dialog" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-4">
          <div className="flex justify-center gap-3 mb-2">
            <AlertTriangle className="w-16 h-16 text-destructive" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Desktop or Tablet Required
          </DialogTitle>
          <DialogDescription className="text-center space-y-4">
            <p className="text-base font-semibold text-foreground">
              Illustration tools are not designed for mobile devices.
            </p>
            
            <div className="text-left space-y-2 pt-2 bg-muted/50 p-4 rounded-lg">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Please access this feature from:
              </p>
              <ul className="space-y-1.5 text-sm list-disc list-inside ml-2">
                <li>Desktop computer</li>
                <li>Laptop</li>
                <li>Tablet device</li>
              </ul>
            </div>

            <p className="text-sm pt-2 text-muted-foreground">
              This ensures you have the best experience with full access to all tools and features.
            </p>
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <Button onClick={handleReturnHome} className="w-full" size="lg">
            Return to Homepage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
