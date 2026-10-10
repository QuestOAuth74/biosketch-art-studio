import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SidebarMember {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'member';
}

export interface SidebarComment {
  id: string;
  content: string;
  authorName: string;
  authorAvatar: string | null;
  projectName: string;
  createdAt: string;
}

export interface SidebarActivity {
  id: string;
  type: 'upload' | 'share';
  name: string;
  actorName: string;
  actorAvatar: string | null;
  createdAt: string;
}

export interface SocialSidebarData {
  members: SidebarMember[];
  admins: SidebarMember[];
  recentComments: SidebarComment[];
  recentActivity: SidebarActivity[];
  activityDates: Date[];
  loading: boolean;
}

export function useSocialSidebarData(
  context: 'groups' | 'pages',
  userId: string | null
): SocialSidebarData {
  const [members, setMembers] = useState<SidebarMember[]>([]);
  const [admins, setAdmins] = useState<SidebarMember[]>([]);
  const [recentComments, setRecentComments] = useState<SidebarComment[]>([]);
  const [recentActivity, setRecentActivity] = useState<SidebarActivity[]>([]);
  const [activityDates, setActivityDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);

      try {
        // 1. Get user's group IDs
        const { data: myGroups } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', userId);

        const groupIds = myGroups?.map((g: any) => g.group_id) ?? [];

        // 2. Fetch members across all user's groups
        let allMembers: SidebarMember[] = [];
        if (groupIds.length > 0) {
          const { data: memberData } = await supabase
            .from('group_members')
            .select('user_id, role, profiles(full_name, avatar_url)')
            .in('group_id', groupIds);

          if (memberData) {
            const seen = new Set<string>();
            const roleWeight: Record<string, number> = { owner: 3, admin: 2, member: 1 };
            const memberMap = new Map<string, SidebarMember>();

            for (const m of memberData as any[]) {
              const profile = m.profiles;
              if (!profile) continue;
              const existing = memberMap.get(m.user_id);
              if (!existing || roleWeight[m.role] > roleWeight[existing.role]) {
                memberMap.set(m.user_id, {
                  userId: m.user_id,
                  fullName: profile.full_name || 'Unknown',
                  avatarUrl: profile.avatar_url,
                  role: m.role,
                });
              }
            }
            allMembers = Array.from(memberMap.values());
          }
        }

        // 3. Get accessible project IDs
        const { data: ownProjects } = await supabase
          .from('canvas_projects')
          .select('id')
          .eq('user_id', userId);

        const { data: collabProjects } = await supabase
          .from('project_collaborators')
          .select('project_id')
          .eq('user_id', userId)
          .not('accepted_at', 'is', null);

        let groupProjectIds: string[] = [];
        if (groupIds.length > 0) {
          const { data: gpa } = await supabase
            .from('project_group_access')
            .select('project_id')
            .in('group_id', groupIds);
          groupProjectIds = gpa?.map((p: any) => p.project_id) ?? [];
        }

        const allProjectIds = [
          ...new Set([
            ...(ownProjects?.map((p: any) => p.id) ?? []),
            ...(collabProjects?.map((p: any) => p.project_id) ?? []),
            ...groupProjectIds,
          ]),
        ];

        // 4. Fetch recent comments
        let comments: SidebarComment[] = [];
        if (allProjectIds.length > 0) {
          const { data: commentData } = await supabase
            .from('canvas_comments')
            .select('id, content, created_at, profiles:author_id(full_name, avatar_url), canvas_projects:project_id(name)')
            .in('project_id', allProjectIds)
            .is('parent_id', null)
            .order('created_at', { ascending: false })
            .limit(10);

          if (commentData) {
            comments = (commentData as any[]).map((c) => ({
              id: c.id,
              content: c.content,
              authorName: c.profiles?.full_name || 'Unknown',
              authorAvatar: c.profiles?.avatar_url || null,
              projectName: c.canvas_projects?.name || 'Untitled',
              createdAt: c.created_at,
            }));
          }
        }

        // 5. Fetch recent activity (project updates + shares)
        let activities: SidebarActivity[] = [];
        if (allProjectIds.length > 0) {
          const { data: recentProjects } = await supabase
            .from('canvas_projects')
            .select('id, name, updated_at, user_id, profiles:user_id(full_name, avatar_url)')
            .in('id', allProjectIds)
            .order('updated_at', { ascending: false })
            .limit(5);

          if (recentProjects) {
            for (const p of recentProjects as any[]) {
              activities.push({
                id: `upload-${p.id}`,
                type: 'upload',
                name: p.name || 'Untitled',
                actorName: p.profiles?.full_name || 'Unknown',
                actorAvatar: p.profiles?.avatar_url || null,
                createdAt: p.updated_at,
              });
            }
          }
        }

        if (groupIds.length > 0) {
          const { data: recentShares } = await supabase
            .from('project_group_access')
            .select('id, granted_at, granted_by, canvas_projects:project_id(name), profiles:granted_by(full_name, avatar_url)')
            .in('group_id', groupIds)
            .order('granted_at', { ascending: false })
            .limit(5);

          if (recentShares) {
            for (const s of recentShares as any[]) {
              activities.push({
                id: `share-${s.id}`,
                type: 'share',
                name: s.canvas_projects?.name || 'Untitled',
                actorName: s.profiles?.full_name || 'Unknown',
                actorAvatar: s.profiles?.avatar_url || null,
                createdAt: s.granted_at,
              });
            }
          }
        }

        // Sort by date, take top 8
        activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        activities = activities.slice(0, 8);

        // 6. Collect activity dates for calendar
        const dateSet = new Set<string>();
        for (const c of comments) dateSet.add(new Date(c.createdAt).toDateString());
        for (const a of activities) dateSet.add(new Date(a.createdAt).toDateString());
        const dates = Array.from(dateSet).map((d) => new Date(d));

        if (!cancelled) {
          setMembers(allMembers);
          setAdmins(allMembers.filter((m) => m.role === 'owner' || m.role === 'admin'));
          setRecentComments(comments);
          setRecentActivity(activities);
          setActivityDates(dates);
          setLoading(false);
        }
      } catch (err) {
        console.error('SocialSidebar fetch error:', err);
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [userId, context]);

  return { members, admins, recentComments, recentActivity, activityDates, loading };
}
