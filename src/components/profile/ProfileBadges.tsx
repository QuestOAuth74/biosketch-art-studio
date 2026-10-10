import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const BADGE_BUCKET = 'badges folder';

interface ProfileBadgesProps {
  avatarUrl: string;
  bio: string;
  quote: string;
  totalProjects: number;
  publicProjects: number;
  totalViews: number;
  totalLikes: number;
  totalClones: number;
  totalCollaborations: number;
  earnedOnly?: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  image: string; // filename inside the BADGE_BUCKET storage bucket
  earned: boolean;
  color: string; // tailwind color name
  tier?: 'bronze' | 'silver' | 'gold';
}

export function ProfileBadges({
  avatarUrl,
  bio,
  quote,
  totalProjects,
  publicProjects,
  totalViews,
  totalLikes,
  totalClones,
  totalCollaborations,
  earnedOnly = false,
}: ProfileBadgesProps) {

  const badges: Badge[] = [
    // ── Profile completion ──
    {
      id: 'selfie',
      name: 'Say Cheese',
      description: 'Uploaded a profile photo',
      image: '01-say-cheese.png',
      earned: !!avatarUrl,
      color: 'sky',
    },
    {
      id: 'storyteller',
      name: 'Storyteller',
      description: 'Added an author bio',
      image: '02-storyteller.png',
      earned: !!bio && bio.length >= 10,
      color: 'indigo',
    },
    {
      id: 'quotable',
      name: 'Quotable',
      description: 'Added a profile quote',
      image: '03-quotable.png',
      earned: !!quote && quote.length >= 5,
      color: 'pink',
    },

    // ── Shared projects ──
    {
      id: 'first-share',
      name: 'First Share',
      description: 'Shared 1 project with the community',
      image: '04-first-share.png',
      earned: publicProjects >= 1,
      color: 'emerald',
    },
    {
      id: 'contributor',
      name: 'Contributor',
      description: 'Shared 3 projects with the community',
      image: '05-contributor.png',
      earned: publicProjects >= 3,
      color: 'amber',
      tier: 'bronze',
    },
    {
      id: 'prolific',
      name: 'Prolific',
      description: 'Shared 10 projects with the community',
      image: '06-prolific.png',
      earned: publicProjects >= 10,
      color: 'yellow',
      tier: 'gold',
    },

    // ── Project creation ──
    {
      id: 'creator',
      name: 'Creator',
      description: 'Created 5 projects',
      image: '07-creator.png',
      earned: totalProjects >= 5,
      color: 'blue',
    },
    {
      id: 'architect',
      name: 'Architect',
      description: 'Created 20 projects',
      image: '08-architect.png',
      earned: totalProjects >= 20,
      color: 'violet',
      tier: 'silver',
    },

    // ── Views (community reach) ──
    {
      id: 'noticed',
      name: 'Getting Noticed',
      description: 'Projects viewed 10 times',
      image: '09-getting-noticed.png',
      earned: totalViews >= 10,
      color: 'teal',
    },
    {
      id: 'spotlight',
      name: 'In the Spotlight',
      description: 'Projects viewed 100 times',
      image: '10-in-the-spotlight.png',
      earned: totalViews >= 100,
      color: 'amber',
      tier: 'silver',
    },
    {
      id: 'viral',
      name: 'Viral',
      description: 'Projects viewed 1,000 times',
      image: '11-viral.png',
      earned: totalViews >= 1000,
      color: 'orange',
      tier: 'gold',
    },

    // ── Likes (community appreciation) ──
    {
      id: 'liked',
      name: 'First Like',
      description: 'Received 1 like on your projects',
      image: '12-first-like.png',
      earned: totalLikes >= 1,
      color: 'rose',
    },
    {
      id: 'popular',
      name: 'Popular',
      description: 'Received 10 likes',
      image: '13-popular.png',
      earned: totalLikes >= 10,
      color: 'rose',
      tier: 'bronze',
    },
    {
      id: 'beloved',
      name: 'Community Favorite',
      description: 'Received 50 likes',
      image: '14-community-favorite.png',
      earned: totalLikes >= 50,
      color: 'rose',
      tier: 'gold',
    },

    // ── Clones (impact) ──
    {
      id: 'cloned',
      name: 'Inspiring',
      description: 'Someone cloned your project',
      image: '15-inspiring.png',
      earned: totalClones >= 1,
      color: 'cyan',
    },
    {
      id: 'influential',
      name: 'Influential',
      description: '10 projects cloned from yours',
      image: '16-influential.png',
      earned: totalClones >= 10,
      color: 'cyan',
      tier: 'silver',
    },

    // ── Collaboration ──
    {
      id: 'team-player',
      name: 'Team Player',
      description: 'Joined a collaboration',
      image: '17-team-player.png',
      earned: totalCollaborations >= 1,
      color: 'violet',
    },
    {
      id: 'collaborator',
      name: 'Power Collaborator',
      description: 'Part of 5 collaborations',
      image: '18-power-collaborator.png',
      earned: totalCollaborations >= 5,
      color: 'violet',
      tier: 'silver',
    },

    // ── Overall milestones ──
    {
      id: 'rising-star',
      name: 'Rising Star',
      description: 'Total impact score of 50+ (views + likes + clones)',
      image: '19-rising-star.png',
      earned: (totalViews + totalLikes + totalClones) >= 50,
      color: 'amber',
      tier: 'silver',
    },
    {
      id: 'legend',
      name: 'Legend',
      description: 'Total impact score of 500+',
      image: '20-legend.png',
      earned: (totalViews + totalLikes + totalClones) >= 500,
      color: 'yellow',
      tier: 'gold',
    },
  ];

  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);

  const tierRing = (tier?: string) => {
    if (tier === 'gold') return 'ring-2 ring-yellow-400/60';
    if (tier === 'silver') return 'ring-2 ring-slate-300/60';
    if (tier === 'bronze') return 'ring-2 ring-amber-600/40';
    return '';
  };

  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    sky:     { bg: 'bg-sky-50 dark:bg-sky-950/30',       text: 'text-sky-600 dark:text-sky-400',       iconBg: 'bg-sky-500/15' },
    indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-500/15' },
    pink:    { bg: 'bg-pink-50 dark:bg-pink-950/30',     text: 'text-pink-600 dark:text-pink-400',     iconBg: 'bg-pink-500/15' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/15' },
    amber:   { bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-600 dark:text-amber-400',   iconBg: 'bg-amber-500/15' },
    yellow:  { bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-600 dark:text-yellow-400', iconBg: 'bg-yellow-500/15' },
    blue:    { bg: 'bg-blue-50 dark:bg-blue-950/30',     text: 'text-blue-600 dark:text-blue-400',     iconBg: 'bg-blue-500/15' },
    violet:  { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-500/15' },
    teal:    { bg: 'bg-teal-50 dark:bg-teal-950/30',     text: 'text-teal-600 dark:text-teal-400',     iconBg: 'bg-teal-500/15' },
    orange:  { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-500/15' },
    rose:    { bg: 'bg-rose-50 dark:bg-rose-950/30',     text: 'text-rose-600 dark:text-rose-400',     iconBg: 'bg-rose-500/15' },
    cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-950/30',     text: 'text-cyan-600 dark:text-cyan-400',     iconBg: 'bg-cyan-500/15' },
  };

  const renderBadge = (badge: Badge, locked = false) => {
    const colors = colorMap[badge.color] || colorMap.blue;
    const { data: { publicUrl } } = supabase.storage.from(BADGE_BUCKET).getPublicUrl(badge.image);

    return (
      <TooltipProvider key={badge.id} delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-default",
                locked
                  ? "bg-muted/40 opacity-40 grayscale"
                  : cn(colors.bg, "hover:shadow-md hover:scale-[1.08]", tierRing(badge.tier))
              )}
            >
              <img
                src={publicUrl}
                alt={badge.name}
                width={40}
                height={40}
                loading="lazy"
                className="object-contain"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px]">
            <p className="font-semibold text-sm">{badge.name}</p>
            <p className="text-xs text-muted-foreground">{badge.description}</p>
            {badge.tier && (
              <p className="text-[10px] font-medium mt-1 capitalize">
                {badge.tier === 'gold' ? '🥇' : badge.tier === 'silver' ? '🥈' : '🥉'} {badge.tier} tier
              </p>
            )}
            {locked && <p className="text-[10px] text-muted-foreground mt-1 italic">Not yet earned</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // In earnedOnly mode, hide if no badges earned
  if (earnedOnly && earnedBadges.length === 0) return null;

  // Cap display to 2 rows worth of badges (cols vary by context)
  const COLS = 5;
  const MAX_DISPLAY = COLS * 2;

  const displayEarned = earnedBadges.slice(0, MAX_DISPLAY);
  const remainingSlots = MAX_DISPLAY - displayEarned.length;
  const displayLocked = earnedOnly ? [] : lockedBadges.slice(0, Math.max(0, remainingSlots));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-amber-500 rounded-full" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Badges
          </h3>
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {earnedOnly ? `${earnedBadges.length} earned` : `${earnedBadges.length}/${badges.length}`}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-3 justify-items-center">
        {displayEarned.map(b => renderBadge(b))}
        {displayLocked.map(b => renderBadge(b, true))}
      </div>
    </div>
  );
}
