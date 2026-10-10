import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Share2, Gift, ArrowRight, Zap, Loader2, UserCircle, ShoppingBag } from 'lucide-react';
import { useAIGenerationUsage } from '@/hooks/useAIGenerationUsage';
import { useGenerationBalance } from '@/hooks/useGenerationBalance';
import { PurchaseCreditsDialog } from '@/components/credits/PurchaseCreditsDialog';
import { useNavigate } from 'react-router-dom';

export function AIGenerationQuotaCard() {
  const { usage, isLoading } = useAIGenerationUsage();
  // New credit system — authoritative balance (grant + purchased).
  const { data: balance } = useGenerationBalance();
  const [showPurchase, setShowPurchase] = useState(false);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="group/ai rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-5 transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover/ai:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI Generations</h3>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
          </div>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        </div>
      </div>
    );
  }

  // Admin — unlimited
  if (usage?.isAdmin) {
    return (
      <div className="group/ai rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-5 transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover/ai:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">AI Generation</h3>
                <p className="text-xs text-muted-foreground">Admin privileges</p>
              </div>
            </div>
            <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-dashed border text-xs">Unlimited</Badge>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Admin access to AI icon generation
          </p>
        </div>
      </div>
    );
  }

  // Premium users
  if (usage?.hasPremium) {
    // Prefer the new balance for the primary numeric display; fall back to
    // the legacy usage numbers while the balance query is loading.
    const totalAvailable = balance?.total_available ?? usage.remaining ?? 0;
    const monthlyGrant = balance?.monthly_grant ?? usage.limit ?? 0;
    const grantUsed = balance?.grant_used ?? usage.used ?? 0;
    const purchased = balance?.purchased ?? 0;
    const progressValue = monthlyGrant ? (grantUsed / monthlyGrant) * 100 : 0;

    return (
      <div className="group/ai rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-5 transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover/ai:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">AI Generations</h3>
                <p className="text-xs text-muted-foreground">Monthly quota</p>
              </div>
            </div>
            <Badge
              variant={totalAvailable > 0 ? 'default' : 'destructive'}
              className="text-xs border-dashed border"
            >
              {totalAvailable} available
            </Badge>
          </div>

          {/* Progress — tracks the monthly grant window */}
          {monthlyGrant > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">{grantUsed} of {monthlyGrant} grant used</span>
                <span className="text-xs font-medium">{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>
          )}

          {/* Stats — grant vs purchased breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border-2 border-dashed border-border/60 bg-background/60">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Free (grant)</span>
              </div>
              <div className="text-xl font-semibold">{balance?.grant_remaining ?? Math.max(0, monthlyGrant - grantUsed)}</div>
            </div>
            <div className="p-3 rounded-xl border-2 border-dashed border-border/60 bg-background/60">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Purchased</span>
              </div>
              <div className="text-xl font-semibold">{purchased}</div>
            </div>
          </div>

          {/* Buy generations CTA — always available for premium users */}
          <Button
            onClick={() => setShowPurchase(true)}
            size="sm"
            variant="outline"
            className="w-full border-dashed active:scale-[0.98]"
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            Buy generations
          </Button>

          {/* Info */}
          <div className="p-3 rounded-xl border-2 border-dashed border-violet-500/20 bg-violet-500/5">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Premium Unlocked</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {usage.limit} AI generation{(usage.limit ?? 0) !== 1 ? 's' : ''} per month (Icons, Figures, PowerPoint). Resets on the 1st.
                </p>
              </div>
            </div>
          </div>

          {/* Profile bonus info */}
          {(usage.profileBonus ?? 0) < 3 && (
            <div className="p-3 rounded-xl border-2 border-dashed border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-start gap-2.5">
                <UserCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Earn {3 - (usage.profileBonus ?? 0)} more credit{3 - (usage.profileBonus ?? 0) !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete your profile (photo, bio, quote) for +1 AI credit each.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/profile')}
                size="sm"
                variant="outline"
                className="w-full mt-2 border-dashed active:scale-[0.98]"
              >
                Complete Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Warning if truly exhausted (grant + purchased both empty) */}
          {totalAvailable === 0 && (
            <div className="p-3 rounded-xl border-2 border-dashed border-destructive/30 bg-destructive/5">
              <p className="text-sm text-destructive font-medium">Out of generations</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buy credits to keep generating, or wait for your monthly grant to refresh.
              </p>
            </div>
          )}
        </div>
        <PurchaseCreditsDialog open={showPurchase} onOpenChange={setShowPurchase} />
      </div>
    );
  }

  // Non-premium — user hasn't unlocked the monthly grant yet, but may have
  // purchased credits. We hide the "share to unlock" only if they already
  // have purchased credits to spend.
  const approvedCount = usage?.approvedCount ?? 0;
  const needsApproved = usage?.needsApproved ?? 3;
  const purchased = balance?.purchased ?? 0;
  const hasPurchased = purchased > 0;

  return (
    <div className="group/ai rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-5 transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-0 group-hover/ai:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI Generations</h3>
              <p className="text-xs text-muted-foreground">
                {hasPurchased ? 'Purchased credits' : 'Premium feature'}
              </p>
            </div>
          </div>
          <Badge
            variant={hasPurchased ? 'default' : 'secondary'}
            className="text-xs border-dashed border"
          >
            {hasPurchased ? `${balance?.total_available ?? 0} available` : 'Locked'}
          </Badge>
        </div>

        {/* Progress toward the monthly-grant unlock (still valid even when
            the user has purchased credits — they still don't have a grant). */}
        {!hasPurchased && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-xs">Progress to grant unlock</span>
              <span className="text-xs font-medium">{approvedCount}/3</span>
            </div>
            <Progress value={(approvedCount / 3) * 100} className="h-1.5" />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border-2 border-dashed border-border/60 bg-background/60">
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Approved</span>
            </div>
            <div className="text-xl font-semibold">{approvedCount}</div>
          </div>
          <div className="p-3 rounded-xl border-2 border-dashed border-border/60 bg-background/60">
            <div className="flex items-center gap-2 mb-1">
              {hasPurchased ? (
                <>
                  <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Purchased</span>
                </>
              ) : (
                <>
                  <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Needed</span>
                </>
              )}
            </div>
            <div className="text-xl font-semibold">{hasPurchased ? purchased : needsApproved}</div>
          </div>
        </div>

        {/* Unlock CTA — hidden when the user already has purchased credits. */}
        {!hasPurchased && (
          <div className="p-3 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
            <div className="flex items-start gap-2.5 mb-2">
              <Gift className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Unlock AI Features</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Share {needsApproved} more project{needsApproved !== 1 ? 's' : ''} to unlock 20 AI generations per month
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/projects')}
              size="sm"
              className="w-full mt-1 active:scale-[0.98]"
            >
              Go to My Projects
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Buy generations — always offered */}
        <Button
          onClick={() => setShowPurchase(true)}
          size="sm"
          variant="outline"
          className="w-full border-dashed active:scale-[0.98]"
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Buy generations
        </Button>

        {/* Profile bonus hint */}
        {(usage?.profileBonus ?? 0) < 3 && (
          <div className="p-3 rounded-xl border-2 border-dashed border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-start gap-2.5">
              <UserCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Complete your profile (photo, bio, quote) to earn +{3 - (usage?.profileBonus ?? 0)} bonus credit{3 - (usage?.profileBonus ?? 0) !== 1 ? 's' : ''} when unlocked.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <PurchaseCreditsDialog open={showPurchase} onOpenChange={setShowPurchase} />
    </div>
  );
}
