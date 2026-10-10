import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PurchaseCreditsDialog } from "./PurchaseCreditsDialog";
import { Share2, ShoppingBag, ArrowRight, Sparkles } from "lucide-react";

interface InsufficientGenerationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shown when a user hits 0 AI generations and the edge function
 * returns INSUFFICIENT_CREDITS. Explains the two active earning paths
 * side-by-side:
 *   (a) share 3 approved projects to the community → unlocks a
 *       20 + 10 × extras per-30-day-window tier
 *   (b) buy an AI add-on starting at $5
 *
 * Previous copy promised "free monthly generations" that no longer
 * exist — that policy ended with migration 20261004120000. The current
 * rule: no free starting credits for new users; credits are earned or
 * purchased. Referral bonus credits (profiles.bonus_credits) still
 * apply but are small-cap and not mentioned here to keep the paywall
 * focused on the two primary paths.
 */
export function InsufficientGenerationsDialog({
  open,
  onOpenChange,
}: InsufficientGenerationsDialogProps) {
  const navigate = useNavigate();
  const [showPurchase, setShowPurchase] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold tracking-tight">
              You need AI credits to continue
            </DialogTitle>
            <DialogDescription className="text-center">
              Pick one of two ways to unlock generations — share your work
              with the community, or buy an AI add-on.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* Share path */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                navigate("/profile");
              }}
              className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
                <Share2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Share 3 approved projects</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Publish a public project. Once 3 are approved, you unlock
                  20+ generations per 30-day window.
                </p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Open your projects
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            {/* Buy path */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setShowPurchase(true);
              }}
              className="group flex flex-col items-start gap-2 rounded-lg border border-primary/40 bg-primary/5 p-4 text-left transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Buy AI credits</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  One-time packs from $5 (50 generations) up to $20 (280
                  generations). Credits never expire.
                </p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
                See credit packs
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>

          <DialogFooter className="mt-2 sm:justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PurchaseCreditsDialog open={showPurchase} onOpenChange={setShowPurchase} />
    </>
  );
}
