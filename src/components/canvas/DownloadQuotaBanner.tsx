import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Gift, Share2, Download, Sparkles } from 'lucide-react';

interface DownloadQuotaBannerProps {
  quota: {
    downloadsUsed: number;
    sharedProjects: number;
    hasUnlimited: boolean;
    remainingDownloads: number | null;
    canDownload: boolean;
    projectsUntilUnlimited: number;
  };
  showSharePrompt?: boolean;
}

export function DownloadQuotaBanner({ quota, showSharePrompt = true }: DownloadQuotaBannerProps) {
  // If unlimited access is unlocked
  if (quota.hasUnlimited) {
    return (
      <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="font-semibold text-primary">
              Unlimited Downloads Unlocked!
            </p>
            <p className="text-sm text-muted-foreground">
              Thank you for sharing {quota.sharedProjects} project{quota.sharedProjects !== 1 ? 's' : ''} with the community
            </p>
          </div>
        </div>
      </div>
    );
  }

  const progressValue = (quota.downloadsUsed / 3) * 100;
  const remaining = quota.remainingDownloads ?? 0;
  
  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-slate-600" />
          <span className="font-medium text-slate-900">Community Downloads</span>
        </div>
        <Badge variant={quota.canDownload ? 'default' : 'destructive'}>
          {remaining} remaining
        </Badge>
      </div>
      
      <Progress value={progressValue} className="h-2" />
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{quota.downloadsUsed} of 3 free downloads used</span>
        <span className="flex items-center gap-1">
          <Share2 className="h-3 w-3" />
          {quota.sharedProjects} shared
        </span>
      </div>
      
      {!quota.canDownload && showSharePrompt && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Gift className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">
                Unlock Unlimited Downloads!
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Share {quota.projectsUntilUnlimited} more project{quota.projectsUntilUnlimited !== 1 ? 's' : ''} with the community to unlock unlimited downloads forever.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {quota.canDownload && quota.projectsUntilUnlimited > 0 && showSharePrompt && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Gift className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              <span className="font-medium">Tip:</span> Share {quota.projectsUntilUnlimited} project{quota.projectsUntilUnlimited !== 1 ? 's' : ''} to unlock unlimited downloads!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
