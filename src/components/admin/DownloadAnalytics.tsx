import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2,
  Download,
  Users,
  FolderOpen,
  Globe,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';

interface DownloadRecord {
  user_id: string;
  project_id: string;
  download_format: string;
  downloaded_at: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  original_project_id: string | null;
  user_id: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface UserDownloadSummary {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalDownloads: number;
  communityDownloads: number;
  personalDownloads: number;
}

type SortField = 'name' | 'total' | 'community' | 'personal';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

export function DownloadAnalytics() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Fetch all downloads
  const { data: downloads, isLoading: downloadsLoading } = useQuery({
    queryKey: ['admin-downloads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_downloads')
        .select('user_id, project_id, download_format, downloaded_at')
        .order('downloaded_at', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return data as DownloadRecord[];
    },
  });

  // Fetch project info to determine community vs personal
  const projectIds = [...new Set(downloads?.map(d => d.project_id) || [])];
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['admin-download-projects', projectIds.join(',')],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const all: ProjectInfo[] = [];
      for (let i = 0; i < projectIds.length; i += 100) {
        const batch = projectIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from('canvas_projects')
          .select('id, name, original_project_id, user_id')
          .in('id', batch);
        if (error) throw error;
        all.push(...(data as ProjectInfo[]));
      }
      return all;
    },
    enabled: projectIds.length > 0,
  });

  // Fetch user profiles
  const userIds = [...new Set(downloads?.map(d => d.user_id) || [])];
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['admin-download-profiles', userIds.join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const all: UserProfile[] = [];
      for (let i = 0; i < userIds.length; i += 100) {
        const batch = userIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', batch);
        if (error) throw error;
        all.push(...(data as UserProfile[]));
      }
      return all;
    },
    enabled: userIds.length > 0,
  });

  const isLoading = downloadsLoading || projectsLoading || profilesLoading;

  // Build lookup maps and aggregate
  const allUsers = useMemo(() => {
    if (!downloads) return [];

    const projectMap = new Map<string, ProjectInfo>();
    projects?.forEach(p => projectMap.set(p.id, p));

    const profileMap = new Map<string, UserProfile>();
    profiles?.forEach(p => profileMap.set(p.id, p));

    const summaryMap = new Map<string, UserDownloadSummary>();
    downloads.forEach(d => {
      let s = summaryMap.get(d.user_id);
      if (!s) {
        const profile = profileMap.get(d.user_id);
        s = {
          userId: d.user_id,
          name: profile?.full_name || 'Unknown User',
          avatarUrl: profile?.avatar_url || null,
          totalDownloads: 0,
          communityDownloads: 0,
          personalDownloads: 0,
        };
        summaryMap.set(d.user_id, s);
      }
      s.totalDownloads++;
      const project = projectMap.get(d.project_id);
      if (project && project.original_project_id) {
        s.communityDownloads++;
      } else {
        s.personalDownloads++;
      }
    });

    return [...summaryMap.values()];
  }, [downloads, projects, profiles]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = allUsers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'total': cmp = a.totalDownloads - b.totalDownloads; break;
        case 'community': cmp = a.communityDownloads - b.communityDownloads; break;
        case 'personal': cmp = a.personalDownloads - b.personalDownloads; break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [allUsers, search, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageUsers = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Summary stats (from ALL users, not just filtered)
  const totalDownloads = downloads?.length || 0;
  const totalCommunity = allUsers.reduce((s, u) => s + u.communityDownloads, 0);
  const totalPersonal = allUsers.reduce((s, u) => s + u.personalDownloads, 0);
  const uniqueUsers = allUsers.length;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'desc'
      ? <ArrowDown className="h-3 w-3" />
      : <ArrowUp className="h-3 w-3" />;
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Download, value: totalDownloads, label: 'Total Downloads', bg: 'bg-blue-50', fg: 'text-blue-600' },
          { icon: Users, value: uniqueUsers, label: 'Unique Users', bg: 'bg-emerald-50', fg: 'text-emerald-600' },
          { icon: Globe, value: totalCommunity, label: 'Community', bg: 'bg-purple-50', fg: 'text-purple-600' },
          { icon: FolderOpen, value: totalPersonal, label: 'Personal', bg: 'bg-amber-50', fg: 'text-amber-600' },
        ].map(({ icon: Icon, value, label, bg, fg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-md ${bg} ${fg}`}><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-xl font-semibold leading-none">{value.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {/* Search bar */}
          <div className="p-3 border-b">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              {search ? 'No users match your search' : 'No download data yet'}
            </p>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left font-medium text-muted-foreground px-3 py-2 w-10">#</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">
                        <button onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-foreground">
                          User <SortIcon field="name" />
                        </button>
                      </th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">
                        <button onClick={() => toggleSort('total')} className="inline-flex items-center gap-1 hover:text-foreground">
                          Total <SortIcon field="total" />
                        </button>
                      </th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">
                        <button onClick={() => toggleSort('community')} className="inline-flex items-center gap-1 hover:text-foreground">
                          Community <SortIcon field="community" />
                        </button>
                      </th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">
                        <button onClick={() => toggleSort('personal')} className="inline-flex items-center gap-1 hover:text-foreground">
                          Personal <SortIcon field="personal" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageUsers.map((user, i) => (
                      <tr key={user.userId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {currentPage * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={user.avatarUrl || undefined} />
                              <AvatarFallback className="text-[9px] bg-primary/10 font-medium">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium truncate max-w-[220px]">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex items-center justify-center min-w-[32px] rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                            {user.totalDownloads}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {user.communityDownloads > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[32px] rounded-full bg-purple-50 text-purple-700 px-2 py-0.5 font-mono text-xs font-semibold">
                              {user.communityDownloads}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {user.personalDownloads > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[32px] rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 font-mono text-xs font-semibold">
                              {user.personalDownloads}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/10 text-xs text-muted-foreground">
                <span>
                  {filtered.length} user{filtered.length !== 1 ? 's' : ''}
                  {search && ` matching "${search}"`}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 font-medium">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
