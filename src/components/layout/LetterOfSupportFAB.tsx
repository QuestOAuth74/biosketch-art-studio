import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Heart } from "lucide-react";

const fabStyles = `
  @keyframes los-pulse-heart {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.4); opacity: 1; }
  }
  @keyframes los-float-heart {
    0% { transform: translateY(0) scale(1); opacity: 0.6; }
    50% { transform: translateY(-8px) scale(1.1); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 0.6; }
  }
  .los-heart-1 { animation: los-pulse-heart 2s ease-in-out infinite; }
  .los-heart-2 { animation: los-float-heart 2.5s ease-in-out infinite 0.3s; }
  .los-heart-3 { animation: los-float-heart 3s ease-in-out infinite 0.8s; }
`;

export const LetterOfSupportFAB = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on the survey page itself
  if (location.pathname === "/survey") return null;

  // Don't render after user dismissed for this session
  if (dismissed) return null;

  const handleYes = () => {
    setShowPrompt(false);
    navigate("/survey");
  };

  const handleNo = () => {
    setShowPrompt(false);
    setShowThanks(true);
    setTimeout(() => {
      setShowThanks(false);
    }, 2000);
  };

  return (
    <>
      <style>{fabStyles}</style>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Prompt dialog */}
        {showPrompt && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-200 bg-card border-2 border-border/60 rounded-xl shadow-2xl p-5 w-72">
            <div className="flex items-start gap-3">
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-3">
                <p className="text-sm text-foreground leading-relaxed">
                  Would you like to complete a letter of support for <span className="font-semibold">BioSketch.Art</span>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleYes}
                    className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Yes
                  </button>
                  <button
                    onClick={handleNo}
                    className="px-4 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    No thanks
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Thanks message */}
        {showThanks && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-200 bg-card border border-border/60 rounded-xl shadow-lg px-4 py-3">
            <p className="text-sm text-muted-foreground">Thanks for stopping by!</p>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => {
            if (showThanks) return;
            setShowPrompt(!showPrompt);
          }}
          className="relative group h-14 w-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 flex items-center justify-center"
          aria-label="Letter of Support"
        >
          <Heart className="h-6 w-6 fill-white" />

          {/* Pulsating hearts */}
          <Heart className="los-heart-1 absolute -top-1 -right-1 h-3 w-3 text-rose-400 fill-rose-400" />
          <Heart className="los-heart-2 absolute -top-2 left-0 h-2.5 w-2.5 text-rose-300 fill-rose-300" />
          <Heart className="los-heart-3 absolute -bottom-1 -left-1 h-2 w-2 text-rose-400 fill-rose-400" />
        </button>
      </div>
    </>
  );
};
