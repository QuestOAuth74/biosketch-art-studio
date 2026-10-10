import { useState } from 'react';
import { Sparkles, Wand2, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useGenerationBalance } from '@/hooks/useGenerationBalance';
import { PremiumFeaturesPopover } from '@/components/canvas/PremiumFeaturesPopover';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SimpleAIBarProps {
  onAIIconClick: () => void;
  onAIDiagramClick: () => void;
}

interface AIFeature {
  id: string;
  label: string;
  icon: any;
  onClick: () => void;
  iconClass: string;
  hoverShadow: string;
}

export function SimpleAIBar({ onAIIconClick, onAIDiagramClick }: SimpleAIBarProps) {
  const { isAdmin } = useAuth();
  const { hasAccess, isLoading } = useFeatureAccess();
  const { data: balance } = useGenerationBalance();
  const navigate = useNavigate();
  const [popoverOpen, setPopoverOpen] = useState<string | null>(null);

  // Unlocked if the user has legacy premium access OR any AI generation credits.
  const hasCreditsOrAccess = hasAccess || (balance ? balance.total_available > 0 : false);
  const isLocked = !isAdmin && !hasCreditsOrAccess && !isLoading;

  const features: AIFeature[] = [
    {
      id: 'ai-icon',
      label: 'AI Icon Generator',
      icon: Sparkles,
      onClick: onAIIconClick,
      iconClass: 'text-violet-600',
      hoverShadow: 'hover:shadow-[0_4px_14px_-4px_rgba(139,92,246,0.35)]',
    },
    {
      id: 'ai-diagram',
      label: 'AI Diagram Generator',
      icon: Wand2,
      onClick: onAIDiagramClick,
      iconClass: 'text-emerald-600',
      hoverShadow: 'hover:shadow-[0_4px_14px_-4px_rgba(16,185,129,0.35)]',
    },
  ];

  const handleShareFromPopover = () => {
    setPopoverOpen(null);
    navigate('/projects');
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-1 rounded-xl px-1 transition-all",
        isLocked ? "border border-dashed border-slate-300/60 dark:border-slate-700/60 bg-slate-50/40 dark:bg-slate-900/30" : ""
      )}
    >
      {isLocked && (
        <Lock
          className="absolute -top-2 -left-2 h-4 w-4 text-slate-500 bg-card rounded-full p-0.5 z-10 border border-slate-200 dark:border-slate-700"
          strokeWidth={2.5}
        />
      )}

      {features.map((feature) => {
        const Icon = feature.icon;
        const button = (
          <button
            onClick={isLocked ? undefined : feature.onClick}
            disabled={isLoading}
            aria-disabled={isLocked}
            className={cn(
              "h-8 px-3 flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all",
              isLocked
                ? "text-muted-foreground opacity-60 cursor-pointer hover:opacity-80"
                : `text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 hover:-translate-y-0.5 ${feature.hoverShadow}`
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className={cn("h-3.5 w-3.5", !isLocked && feature.iconClass)} />
            )}
            <span>{feature.label.replace('AI ', '')}</span>
          </button>
        );

        return isLocked ? (
          <PremiumFeaturesPopover
            key={feature.id}
            open={popoverOpen === feature.id}
            onOpenChange={(open) => setPopoverOpen(open ? feature.id : null)}
            onShareClick={handleShareFromPopover}
            featureType="ai-icon"
            side="bottom"
          >
            {button}
          </PremiumFeaturesPopover>
        ) : (
          <span key={feature.id}>{button}</span>
        );
      })}
    </div>
  );
}
