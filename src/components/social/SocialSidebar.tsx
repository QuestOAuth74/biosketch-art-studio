import { useAuth } from '@/contexts/AuthContext';
import { useSocialSidebarData } from '@/hooks/useSocialSidebarData';
import { SidebarMembersSection } from './SidebarMembersSection';
import { SidebarCalendarSection } from './SidebarCalendarSection';
import { SidebarCommentsSection } from './SidebarCommentsSection';
import { SidebarActivitySection } from './SidebarActivitySection';
import { SidebarQuote } from '@/components/sidebar/SidebarQuote';

interface SocialSidebarProps {
  context: 'groups' | 'pages';
}

export function SocialSidebar({ context }: SocialSidebarProps) {
  const { user } = useAuth();
  const { members, admins, recentComments, recentActivity, activityDates, loading } =
    useSocialSidebarData(context, user?.id ?? null);

  return (
    <aside className="hidden lg:block w-80 shrink-0 space-y-4 sticky top-20 self-start">
      <SidebarMembersSection members={members} admins={admins} loading={loading} />
      <SidebarCalendarSection activityDates={activityDates} loading={loading} />
      <SidebarCommentsSection comments={recentComments} loading={loading} />
      <SidebarActivitySection activity={recentActivity} loading={loading} />
      <SidebarQuote />
    </aside>
  );
}
