import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Share2, Sparkles, Gift, ArrowRight, Loader2 } from 'lucide-react';
import { useCommunityDownloads } from '@/hooks/useCommunityDownloads';
import { useNavigate } from 'react-router-dom';

export function DownloadQuotaCard() {
  const { quota, isLoading } = useCommunityDownloads();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="group/dl rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-5 transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover/dl:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Download Quota</h3>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
          </div>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Unlimited access
  if (quota.hasUnlimited) {
    return (
      <div className="group/dl rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-5 transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 group-hover/dl:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Download Access</h3>
                <p className="text-xs text-muted-foreground">Community rewards</p>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary border-dashed border text-xs">Unlimited</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border-2 border-dashed border-border/60 bg-background/60">
              <div className="flex items-center gap-2 mb-1">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Downloaded</span>
              </div>
              <div className="text-xl font-semibold">{quota.downloadsUsed}</div>
            </div>
            <div className="p-3 rounded-xl border-2 border-dashed border-border/60 bg-background/60">
              <div className="flex items-center gap-2 mb-1">
                <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Shared</span>
              </div>
              <div className="text-xl font-semibold">{quota.sharedProjects}</div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Thank you for sharing {quota.sharedProjects} project{quota.sharedProjects !== 1 ? 's' : ''}!
          </p>
        </div>
      </div>
    );
  }

  // Free tier with quota
  const progressValue = (quota.downloadsUsed / 3) * 100;
  const remaining = quota.remainingDownloads ?? 0;

  return (
    <div className="group/dl rounded-xl border-2 border-dashed border-border/60 bg-card/60 p-5 transition-all duration-300 hover:shadow-lg hover:border-border relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-0 group-hover/dl:opacity-[0.015] transition-opacity duration-500 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Download Quota</h3>
              <p className="text-xs text-muted-foreground">Community downloads</p>
            </div>
          </div>
          <Badge
            variant={quota.canDownload ? 'default' : 'destructive'}
            className="text-xs border-dashed border"
          >
            {remaining} left
          </Badge>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs">{quota.downloadsUsed} of 3 used</span>
            <span className="text-xs font-medium">{Math.round(progressValue)}%</span>
          </div>
          <Progress value={progressValue} className="h-1.5" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border-2 border-dashed border-border/60 bg-background/60">
            <div className="flex items-center gap-2 mb-1">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Downloaded</span>
            </div>
            <div className="text-xl font-semibold">{quota.downloadsUsed}</div>
          </div>
          <div className="p-3 rounded-xl border-2 border-dashed border-border/60 bg-background/60">
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Shared</span>
            </div>
            <div className="text-xl font-semibold">{quota.sharedProjects}</div>
          </div>
        </div>

        {/* Unlock CTA */}
        <div className="p-3 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
          <div className="flex items-start gap-2.5 mb-2">
            <Gift className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Unlock Unlimited</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share {quota.projectsUntilUnlimited} more project{quota.projectsUntilUnlimited !== 1 ? 's' : ''} to unlock unlimited downloads
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

        {/* Warning if exhausted */}
        {!quota.canDownload && (
          <div className="p-3 rounded-xl border-2 border-dashed border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive font-medium">Download limit reached</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share public projects to continue downloading
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
