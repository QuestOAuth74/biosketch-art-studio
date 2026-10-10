import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Sparkles, TrendingUp, Users, Calendar, Wand2, FlaskConical, FileText, Image, ChevronLeft, ChevronRight, GitBranch, Search } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface UsageRecord {
  id: string;
  user_id: string;
  generated_at: string;
  month_year: string;
  prompt: string | null;
  style: string | null;
  generation_type: string | null;
  /** 'grant' | 'purchased' | null (null = legacy row, pre-ledger). */
  credit_source: string | null;
  /** Timestamp if the generation was later refunded; null otherwise. */
  refunded_at: string | null;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  'icon': { label: 'Icon Generation', icon: Image, color: 'text-blue-600' },
  'icon-customize': { label: 'Icon Customizer', icon: Wand2, color: 'text-violet-600' },
  'figure': { label: 'Figure Generation', icon: FlaskConical, color: 'text-emerald-600' },
  'powerpoint': { label: 'PowerPoint', icon: FileText, color: 'text-amber-600' },
  'powerpoint_full': { label: 'PowerPoint Full', icon: FileText, color: 'text-amber-600' },
  'reference-image': { label: 'Reference Image', icon: Image, color: 'text-cyan-600' },
  'diagram': { label: 'AI Diagram', icon: GitBranch, color: 'text-pink-600' },
  'ai-illustrator': { label: 'AI Illustrator', icon: Sparkles, color: 'text-indigo-600' },
};

function getTypeInfo(type: string | null) {
  if (!type) return { label: 'Icon Generation', icon: Image, color: 'text-blue-600' };
  return TYPE_LABELS[type] || { label: type, icon: Sparkles, color: 'text-muted-foreground' };
}

/**
 * Small chip that shows where a generation drew its credit from.
 * Refunded state (any credit_source) takes priority over the pool label.
 */
function CreditSourceChip({ source, refundedAt }: { source: string | null; refundedAt: string | null }) {
  if (refundedAt) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
        Refunded
      </span>
    );
  }
  if (source === 'purchased') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
        Purchased
      </span>
    );
  }
  if (source === 'grant') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
        Grant
      </span>
    );
  }
  // Legacy row from ai_generation_usage / diagram_generations — no credit_source.
  return <span className="text-[10px] text-muted-foreground">—</span>;
}

export function AIUsageAnalytics() {
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [logPage, setLogPage] = useState(0);
  const LOG_PER_PAGE = 20;
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(0);
  const USERS_PER_PAGE = 25;

  // Fetch all usage records in date range
  const { data: usageData, isLoading, error: queryError } = useQuery({
    queryKey: ['admin-ai-usage', dateFrom, dateTo],
    queryFn: async () => {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .rpc('get_admin_ai_usage', {
          _from_date: fromDate.toISOString(),
          _to_date: toDate.toISOString(),
        });

      if (error) {
        console.error('AI usage query error:', error);
        throw error;
      }
      console.log('AI usage query returned', data?.length, 'records');
      return (data || []) as UsageRecord[];
    },
  });

  // Debug: log query errors
  if (queryError) {
    console.error('AI usage query failed:', queryError);
  }

  // Fetch profiles for users in usage data
  const userIds = [...new Set(usageData?.map(r => r.user_id) || [])];
  const { data: profiles } = useQuery({
    queryKey: ['admin-ai-usage-profiles', userIds.join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', userIds);
      if (error) throw error;
      return (data || []) as UserProfile[];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // Lifetime set of user IDs that have EVER purchased AI credits (any time,
  // not just within the current date filter). Used by the "Paid?" badge on
  // the users table so admins can spot paying customers at a glance.
  const { data: purchaserIds } = useQuery({
    queryKey: ['admin-ai-lifetime-purchasers'],
    staleTime: 5 * 60 * 1000, // 5 min — rarely changes
    queryFn: async () => {
      // Cast: ai_credit_purchases isn't in the generated types.
      const { data, error } = await (supabase as any)
        .from('ai_credit_purchases')
        .select('user_id');
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.user_id as string));
    },
  });
  const purchaserSet = purchaserIds ?? new Set<string>();

  // Compute stats
  const totalGenerations = usageData?.length || 0;
  const uniqueUsers = new Set(usageData?.map(r => r.user_id)).size;

  // Generations by type
  const byType = new Map<string, number>();
  usageData?.forEach(r => {
    const key = r.generation_type || 'icon';
    byType.set(key, (byType.get(key) || 0) + 1);
  });

  // Per-user totals + per-type breakdown + last activity
  type UserAggregate = {
    userId: string;
    total: number;
    byType: Map<string, number>;
    lastSeen: string;
  };
  const userAggMap = new Map<string, UserAggregate>();
  usageData?.forEach(r => {
    const t = r.generation_type || 'icon';
    const existing = userAggMap.get(r.user_id);
    if (existing) {
      existing.total += 1;
      existing.byType.set(t, (existing.byType.get(t) || 0) + 1);
      if (r.generated_at > existing.lastSeen) existing.lastSeen = r.generated_at;
    } else {
      userAggMap.set(r.user_id, {
        userId: r.user_id,
        total: 1,
        byType: new Map([[t, 1]]),
        lastSeen: r.generated_at,
      });
    }
  });
  const allUsers = [...userAggMap.values()].sort((a, b) => b.total - a.total);

  // Apply search filter
  const filteredUsers = allUsers.filter(u => {
    if (!userSearch.trim()) return true;
    const profile = profileMap.get(u.userId);
    const q = userSearch.toLowerCase();
    return (
      (profile?.full_name || '').toLowerCase().includes(q) ||
      (profile?.email || '').toLowerCase().includes(q) ||
      u.userId.toLowerCase().includes(q)
    );
  });

  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const pagedUsers = filteredUsers.slice(userPage * USERS_PER_PAGE, (userPage + 1) * USERS_PER_PAGE);

  // Daily breakdown for sparkline-style display
  const dailyCounts = new Map<string, number>();
  usageData?.forEach(r => {
    const day = r.generated_at.slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
  });

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card className="border border-border/50">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-40 h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-40 h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
                  setDateTo(format(new Date(), 'yyyy-MM-dd'));
                  setLogPage(0);
                }}
              >
                7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                  setDateTo(format(new Date(), 'yyyy-MM-dd'));
                  setLogPage(0);
                }}
              >
                30 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
                  setDateTo(format(new Date(), 'yyyy-MM-dd'));
                  setLogPage(0);
                }}
              >
                90 days
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Generations</p>
                    <p className="text-3xl font-semibold">{totalGenerations}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Unique Users</p>
                    <p className="text-3xl font-semibold">{uniqueUsers}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Avg per User</p>
                    <p className="text-3xl font-semibold">
                      {uniqueUsers > 0 ? (totalGenerations / uniqueUsers).toFixed(1) : '0'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Generations by Type */}
          <Card className="border border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generations by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {[...byType.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const info = getTypeInfo(type);
                    const Icon = info.icon;
                    const pct = totalGenerations > 0 ? Math.round((count / totalGenerations) * 100) : 0;
                    return (
                      <div key={type} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/20 min-w-[180px]">
                        <Icon className={`h-5 w-5 ${info.color} shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{info.label}</p>
                          <p className="text-xs text-muted-foreground">{count} ({pct}%)</p>
                        </div>
                      </div>
                    );
                  })}
                {byType.size === 0 && (
                  <p className="text-sm text-muted-foreground">No generations in this period</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* All Users — full per-user breakdown */}
          <Card className="border border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">All AI Users</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} in selected range
                    {userSearch && ` (filtered from ${allUsers.length})`}
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or ID…"
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredUsers.length > 0 ? (
                <>
                  <div className="rounded-lg border border-border/40 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-10 text-xs">#</TableHead>
                          <TableHead className="text-xs">User</TableHead>
                          <TableHead className="text-xs w-20">Paid?</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs">Breakdown by tool</TableHead>
                          <TableHead className="text-xs hidden md:table-cell">Last activity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedUsers.map((u, idx) => {
                          const profile = profileMap.get(u.userId);
                          const name = profile?.full_name || 'Unknown User';
                          const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                          const rank = userPage * USERS_PER_PAGE + idx + 1;
                          const sortedTypes = [...u.byType.entries()].sort((a, b) => b[1] - a[1]);
                          return (
                            <TableRow key={u.userId} className="hover:bg-muted/20">
                              <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">
                                {rank}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={profile?.avatar_url || undefined} />
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{profile?.email || u.userId}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {purchaserSet.has(u.userId) ? (
                                  <Badge className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 hover:bg-violet-500/15">
                                    Purchased
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    Free grant
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="text-xs tabular-nums">{u.total}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {sortedTypes.map(([type, count]) => {
                                    const info = getTypeInfo(type);
                                    const Icon = info.icon;
                                    return (
                                      <span
                                        key={type}
                                        title={`${info.label}: ${count}`}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/40 border border-border/30 text-[10px] tabular-nums"
                                      >
                                        <Icon className={`h-3 w-3 ${info.color}`} />
                                        {count}
                                      </span>
                                    );
                                  })}
                                </div>
                              </TableCell>
                              <TableCell className="text-[11px] text-muted-foreground hidden md:table-cell">
                                {format(new Date(u.lastSeen), 'MMM d, HH:mm')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {userTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-3">
                      <p className="text-xs text-muted-foreground">
                        Page {userPage + 1} of {userTotalPages}
                      </p>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage(p => Math.max(0, p - 1))}
                          disabled={userPage === 0}
                          className="h-7 text-xs"
                        >
                          <ChevronLeft className="h-3 w-3 mr-1" />
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage(p => Math.min(userTotalPages - 1, p + 1))}
                          disabled={userPage >= userTotalPages - 1}
                          className="h-7 text-xs"
                        >
                          Next
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No usage in this period</p>
              )}
            </CardContent>
          </Card>

          {/* Daily Breakdown */}
          {dailyCounts.size > 0 && (
            <Card className="border border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Daily Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[...dailyCounts.entries()]
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([day, count]) => (
                      <div key={day} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/20 text-xs">
                        <span className="text-muted-foreground">{format(new Date(day), 'MMM d')}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Usage Log — Paginated */}
          <Card className="border border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generation Log ({totalGenerations})</CardTitle>
            </CardHeader>
            <CardContent>
              {usageData && usageData.length > 0 ? (
                <>
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">User</TableHead>
                          <TableHead className="w-[140px]">Type</TableHead>
                          <TableHead className="w-[100px]">Source</TableHead>
                          <TableHead>Prompt</TableHead>
                          <TableHead className="w-[80px]">Style</TableHead>
                          <TableHead className="w-[140px]">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usageData.slice(logPage * LOG_PER_PAGE, (logPage + 1) * LOG_PER_PAGE).map(record => {
                          const profile = profileMap.get(record.user_id);
                          const name = profile?.full_name || 'Unknown';
                          const typeInfo = getTypeInfo(record.generation_type);
                          const TypeIcon = typeInfo.icon;
                          return (
                            <TableRow key={record.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={profile?.avatar_url || undefined} />
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                      {name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm truncate max-w-[120px]">{name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <TypeIcon className={`h-3.5 w-3.5 ${typeInfo.color}`} />
                                  <span className="text-xs">{typeInfo.label}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <CreditSourceChip source={record.credit_source} refundedAt={record.refunded_at} />
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground truncate block max-w-[300px]">
                                  {record.prompt || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">{record.style || '—'}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(record.generated_at), 'MMM d, HH:mm')}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Pagination Controls */}
                  {usageData.length > LOG_PER_PAGE && (
                    <div className="flex items-center justify-between pt-4">
                      <span className="text-xs text-muted-foreground">
                        Showing {logPage * LOG_PER_PAGE + 1}–{Math.min((logPage + 1) * LOG_PER_PAGE, usageData.length)} of {usageData.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogPage(p => p - 1)}
                          disabled={logPage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">
                          {logPage + 1} / {Math.ceil(usageData.length / LOG_PER_PAGE)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogPage(p => p + 1)}
                          disabled={(logPage + 1) * LOG_PER_PAGE >= usageData.length}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No AI generations in this date range</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
