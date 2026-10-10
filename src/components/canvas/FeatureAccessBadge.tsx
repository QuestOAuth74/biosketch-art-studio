import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const FeatureAccessBadge = () => {
  const { hasAccess, approvedCount, remaining, isLoading } = useFeatureAccess();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 glass-effect rounded-md">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (hasAccess) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="default" className="gap-1.5 cursor-pointer">
            <Unlock className="h-3 w-3" />
            Premium Unlocked
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Premium Features Unlocked</p>
          <p className="text-xs text-muted-foreground mt-1">
            You have {approvedCount} approved community contributions
          </p>
          <p className="text-xs text-muted-foreground">
            ✓ AI Figure Generator<br />
            ✓ PowerPoint Maker
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8"
          onClick={() => navigate('/projects')}
        >
          <Lock className="h-3 w-3" />
          <span className="text-xs">
            {approvedCount}/3 Projects
          </span>
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">Unlock Premium Features</p>
        <p className="text-xs text-muted-foreground mt-1">
          Share {remaining} more approved project{remaining !== 1 ? 's' : ''} to the community to unlock:
        </p>
        <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <li>🎨 AI Figure Generator</li>
          <li>📊 PowerPoint Maker</li>
        </ul>
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs font-medium">How to unlock:</p>
          <ol className="text-xs text-muted-foreground mt-1 space-y-0.5 list-decimal list-inside">
            <li>Create a project</li>
            <li>Click "Share to Community"</li>
            <li>Get admin approval</li>
          </ol>
        </div>
        <p className="text-xs text-primary mt-2">Click to view and share your projects</p>
      </TooltipContent>
    </Tooltip>
  );
};
