import { useState, useEffect } from "react";
import { X, Lightbulb, Keyboard, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIPS = [
  {
    icon: Keyboard,
    category: "Shortcuts",
    tip: "Press Ctrl+Z to undo, Ctrl+Y to redo",
  },
  {
    icon: Zap,
    category: "Quick Actions",
    tip: "Press T for text, R for rectangle, C for circle",
  },
  {
    icon: Keyboard,
    category: "Selection",
    tip: "Hold Shift to select multiple objects",
  },
  {
    icon: Zap,
    category: "Precision",
    tip: "Hold Shift while dragging to constrain movement",
  },
  {
    icon: Keyboard,
    category: "Speed",
    tip: "Press Ctrl+D to duplicate selected objects",
  },
];

const TIP_BANNER_KEY = 'canvas_tip_banner_dismissed';

export const TipBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    // Check if user has dismissed the banner before
    const dismissed = localStorage.getItem(TIP_BANNER_KEY);
    if (!dismissed) {
      // Show banner after a short delay to not overwhelm first-time users
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Rotate tips every 5 seconds
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(TIP_BANNER_KEY, 'true');
  };

  if (!isVisible) return null;

  const currentTip = TIPS[currentTipIndex];
  const Icon = currentTip.icon;

  return (
    <div
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-50",
        "bg-gradient-to-r from-[hsl(var(--canvas-accent-primary))] to-[hsl(var(--canvas-accent-secondary))]",
        "text-white rounded-lg shadow-2xl",
        "max-w-2xl w-full mx-4",
        "animate-in fade-in duration-500"
      )}
    >
      <div className="relative p-4 pr-12">
        {/* Dismiss Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="absolute top-2 right-2 h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Content */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <span>Pro Tip</span>
              <span className="text-xs font-normal bg-white/20 px-2 py-0.5 rounded-full">
                {currentTip.category}
              </span>
            </h3>
            <p className="text-sm text-white/95 mb-3">
              {currentTip.tip}
            </p>
            
            {/* Progress Dots */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {TIPS.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTipIndex(index)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      index === currentTipIndex 
                        ? "w-6 bg-white" 
                        : "w-1.5 bg-white/40 hover:bg-white/60"
                    )}
                    aria-label={`Go to tip ${index + 1}`}
                  />
                ))}
              </div>
              
              <span className="text-xs text-white/70 ml-auto">
                {currentTipIndex + 1} of {TIPS.length}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-white/10 flex-shrink-0">
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/80">
          <span>Press ? for all keyboard shortcuts</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-7 text-xs text-white/80 hover:text-white hover:bg-white/10"
          >
            Got it, don't show again
          </Button>
        </div>
      </div>
    </div>
  );
};
