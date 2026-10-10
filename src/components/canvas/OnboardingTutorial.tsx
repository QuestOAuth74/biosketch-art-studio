import { useEffect, useState } from "react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useCanvas } from "@/contexts/CanvasContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  X, 
  ChevronRight, 
  Trophy, 
  Loader2,
  CheckCircle2,
  Lightbulb
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

export const OnboardingTutorial = () => {
  const { 
    isActive, 
    currentStep, 
    currentStepIndex,
    progress,
    completedSteps,
    nextStep, 
    skipOnboarding,
    completeCurrentStep,
    completeOnboarding
  } = useOnboarding();
  
  const { canvas } = useCanvas();
  const [isWaitingForAction, setIsWaitingForAction] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [lastObjectColor, setLastObjectColor] = useState<string>("");

  useEffect(() => {
    if (!isActive || !canvas || !currentStep) return;

    // Reset state when step changes
    setIsWaitingForAction(true);
    setShowHint(false);
    
    // Show hint after 10 seconds if user is stuck
    const hintTimer = setTimeout(() => {
      setShowHint(true);
    }, 10000);

    // Detect object added
    const handleObjectAdded = (e: any) => {
      const obj = e.target;
      
      if (currentStep.id === "add-rectangle" && obj.type === "rect") {
        setIsWaitingForAction(false);
        celebrateSuccess(currentStep.successMessage);
        completeCurrentStep({ type: "rect" });
      } else if (currentStep.id === "add-text" && obj.type === "textbox") {
        setIsWaitingForAction(false);
        celebrateSuccess(currentStep.successMessage);
        completeCurrentStep({ type: "textbox" });
      } else if (currentStep.id === "add-arrow" && (obj.type === "line" || obj.type === "path")) {
        setIsWaitingForAction(false);
        celebrateSuccess(currentStep.successMessage);
        completeCurrentStep({ hasArrow: true });
      }
    };

    // Detect object moved
    const handleObjectMoving = (e: any) => {
      if (currentStep.id === "drag-shape" && e.target.type === "rect") {
        setIsWaitingForAction(false);
        celebrateSuccess(currentStep.successMessage);
        completeCurrentStep({ moved: true });
      }
    };

    // Detect color change
    const handleObjectModified = (e: any) => {
      const obj = e.target;
      
      if (currentStep.id === "change-color" && obj.type === "rect") {
        const currentColor = obj.fill;
        
        // Check if color actually changed
        if (lastObjectColor && currentColor !== lastObjectColor) {
          setIsWaitingForAction(false);
          celebrateSuccess(currentStep.successMessage);
          completeCurrentStep({ colorChanged: true });
        }
        
        setLastObjectColor(currentColor);
      }
    };

    // Store initial color of selected object
    const storeInitialColor = () => {
      const activeObj = canvas.getActiveObject();
      if (activeObj && activeObj.type === "rect") {
        setLastObjectColor(activeObj.fill as string);
      }
    };

    canvas.on('object:added', handleObjectAdded);
    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:created', storeInitialColor);
    canvas.on('selection:updated', storeInitialColor);

    return () => {
      clearTimeout(hintTimer);
      canvas.off('object:added', handleObjectAdded);
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('selection:created', storeInitialColor);
      canvas.off('selection:updated', storeInitialColor);
    };
  }, [isActive, canvas, currentStep, completeCurrentStep, lastObjectColor]);

  const celebrateSuccess = (message: string) => {
    // Show success toast
    toast({
      title: "Step Completed! 🎉",
      description: message,
      duration: 2000,
    });

    // Fire confetti
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const handleManualNext = () => {
    if (currentStep?.id === "welcome" || currentStep?.id === "complete") {
      if (currentStep.id === "complete") {
        completeOnboarding();
      } else {
        nextStep();
      }
    }
  };

  if (!isActive || !currentStep) return null;

  const targetElement = document.querySelector(currentStep.target);
  const rect = targetElement?.getBoundingClientRect();

  // Calculate position based on target element
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (rect) {
    switch (currentStep.position) {
      case 'right':
        tooltipStyle = {
          ...tooltipStyle,
          left: rect.right + 20,
          top: rect.top + rect.height / 2,
          transform: 'translateY(-50%)',
        };
        break;
      case 'left':
        tooltipStyle = {
          ...tooltipStyle,
          right: window.innerWidth - rect.left + 20,
          top: rect.top + rect.height / 2,
          transform: 'translateY(-50%)',
        };
        break;
      case 'top':
        tooltipStyle = {
          ...tooltipStyle,
          left: rect.left + rect.width / 2,
          bottom: window.innerHeight - rect.top + 20,
          transform: 'translateX(-50%)',
        };
        break;
      case 'bottom':
        tooltipStyle = {
          ...tooltipStyle,
          left: rect.left + rect.width / 2,
          top: rect.bottom + 20,
          transform: 'translateX(-50%)',
        };
        break;
    }
  } else {
    // Fallback to center if target not found
    tooltipStyle = {
      ...tooltipStyle,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const isManualStep = currentStep.id === "welcome" || currentStep.id === "complete";

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
        style={{ pointerEvents: 'none' }}
      />

      {/* Tutorial Card */}
      <div style={tooltipStyle}>
        <Card className="w-[400px] shadow-2xl border-2 border-primary/20 animate-in fade-in zoom-in duration-300">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    Step {currentStepIndex + 1} of {7}
                  </Badge>
                  {!isManualStep && isWaitingForAction && (
                    <Badge variant="outline" className="text-xs animate-pulse">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Waiting for action
                    </Badge>
                  )}
                  {!isManualStep && !isWaitingForAction && (
                    <Badge variant="default" className="text-xs bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed!
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-semibold">{currentStep.title}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 -mt-2"
                onClick={skipOnboarding}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress Bar */}
            <Progress value={progress} className="mb-4 h-2" />

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-4">
              {currentStep.description}
            </p>

            {/* Action Description */}
            {!isManualStep && (
              <div className="bg-primary/5 rounded-lg p-3 mb-4 border border-primary/10">
                <div className="flex items-start gap-2">
                  <Trophy className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary">
                      {currentStep.actionDescription}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Hint */}
            {showHint && currentStep.hint && !isManualStep && (
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 mb-4 border border-amber-200 dark:border-amber-800 animate-in slide-in-from-top duration-300">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {currentStep.hint}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
              {isManualStep ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={skipOnboarding}
                  >
                    Skip Tutorial
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleManualNext}
                    className="gap-2"
                  >
                    {currentStep.id === "complete" ? "Finish" : "Get Started"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">
                    {isWaitingForAction ? "Perform the action to continue" : "Moving to next step..."}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipOnboarding}
                    className="text-xs"
                  >
                    Skip Tutorial
                  </Button>
                </>
              )}
            </div>

            {/* Progress Summary */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress: {progress}%</span>
                <span>{completedSteps.length} steps completed</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Highlight Target Element */}
      {targetElement && (
        <div
          className="fixed border-4 border-primary rounded-lg pointer-events-none z-[9997] animate-pulse"
          style={{
            left: rect!.left - 4,
            top: rect!.top - 4,
            width: rect!.width + 8,
            height: rect!.height + 8,
          }}
        />
      )}
    </>
  );
};
