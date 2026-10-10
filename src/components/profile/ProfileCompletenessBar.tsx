import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Camera, FileText, Quote, Share2, Sparkles, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileCompletenessBarProps {
  avatarUrl: string;
  bio: string;
  quote: string;
  publicProjectCount: number;
}

interface CompletionStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  reward: string;
}

export function ProfileCompletenessBar({ avatarUrl, bio, quote, publicProjectCount }: ProfileCompletenessBarProps) {
  const steps: CompletionStep[] = [
    {
      id: 'avatar',
      label: 'Profile Image',
      description: 'Upload a profile photo',
      icon: Camera,
      completed: !!avatarUrl,
      reward: '+1 AI generation/mo',
    },
    {
      id: 'bio',
      label: 'Author Bio',
      description: 'Write a short bio about yourself',
      icon: FileText,
      completed: !!bio && bio.length >= 10,
      reward: '+1 AI generation/mo',
    },
    {
      id: 'quote',
      label: 'Profile Quote',
      description: 'Add an inspiring quote or motto',
      icon: Quote,
      completed: !!quote && quote.length >= 5,
      reward: '+1 AI generation/mo',
    },
    {
      id: 'share',
      label: 'Share 3 Projects',
      description: 'Share 3 approved projects to unlock AI',
      icon: Share2,
      completed: publicProjectCount >= 3,
      reward: '20 AI credits/month',
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const percentage = Math.round((completedCount / steps.length) * 100);

  // Don't show if everything is complete
  if (completedCount === steps.length) return null;

  return (
    <div className="bg-gradient-to-r from-primary/5 via-violet-500/5 to-primary/5 border border-primary/15 rounded-xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Complete Your Profile</h3>
            <p className="text-xs text-muted-foreground">Earn free AI credits by completing your profile</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-primary">{percentage}%</span>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Complete</p>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={percentage} className="h-2 mb-4" />

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-2.5 p-3 rounded-lg border transition-all",
                step.completed
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40"
                  : "bg-card border-border/50 hover:border-primary/30"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                step.completed
                  ? "bg-emerald-500/15"
                  : "bg-muted/50"
              )}>
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-medium",
                  step.completed ? "text-emerald-700 dark:text-emerald-400 line-through" : "text-foreground"
                )}>
                  {step.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {step.completed ? 'Completed' : step.description}
                </p>
                {!step.completed && (
                  <div className="flex items-center gap-1 mt-1">
                    <Gift className="h-3 w-3 text-violet-500" />
                    <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">{step.reward}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
