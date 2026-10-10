import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ArrowLeft, Loader2, Eye, User, Download, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { exportUsersToExcel } from "@/lib/excelExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { UserProjectsDialog } from "@/components/admin/UserProjectsDialog";
import { UserProfileDialog } from "@/components/admin/UserProfileDialog";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useUserAnalytics } from "@/hooks/useUserAnalytics";
import { useTopSearches, useClickHeatmap, useSessionStats, useTopTools } from "@/hooks/useEventAnalytics";
import { RetentionAnalytics } from "@/components/admin/RetentionAnalytics";
import { InactiveUserCleanup } from "@/components/admin/InactiveUserCleanup";
import { UserSegmentation } from "@/components/admin/UserSegmentation";

interface UserAnalytics {
  id: string;
  email: string;
  full_name: string;
  country: string | null;
  field_of_study: string | null;
  avatar_url: string | null;
  quote: string | null;
  created_at: string;
  last_login_at: string | null;
  project_count: number;
}

const HEATMAP_GRID = 20;

const BehaviorAnalytics = () => {
  const { data: topSearches, isLoading: loadingSearches } = useTopSearches();
  const { data: clicks, isLoading: loadingClicks } = useClickHeatmap();
  const { data: sessionStats, isLoading: loadingSessions } = useSessionStats();
  const { data: topTools, isLoading: loadingTools } = useTopTools();

  // Build heatmap grid from normalized click coordinates
  const heatmapGrid = useMemo(() => {
    if (!clicks || clicks.length === 0) return null;
    const grid: number[][] = Array.from({ length: HEATMAP_GRID }, () =>
      Array(HEATMAP_GRID).fill(0)
    );
    let max = 0;
    for (const c of clicks) {
      // Skip clicks with out-of-range normalized coordinates
      if (c.norm_x < 0 || c.norm_x > 1 || c.norm_y < 0 || c.norm_y > 1) continue;
      const col = Math.min(Math.floor(c.norm_x * HEATMAP_GRID), HEATMAP_GRID - 1);
      const row = Math.min(Math.floor(c.norm_y * HEATMAP_GRID), HEATMAP_GRID - 1);
      grid[row][col]++;
      if (grid[row][col] > max) max = grid[row][col];
    }
    return { grid, max };
  }, [clicks]);

  const cellColor = (count: number, max: number) => {
    if (max === 0 || count === 0) return "hsl(var(--muted) / 0.4)";
    const intensity = count / max;
    if (intensity > 0.7) return "hsl(0, 80%, 50%)";
    if (intensity > 0.4) return "hsl(30, 90%, 55%)";
    if (intensity > 0.15) return "hsl(50, 90%, 55%)";
    return "hsl(120, 50%, 70%)";
  };

  return (
    <div className="space-y-6 mb-8">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">🔬</span>
        <h2 className="text-xl font-bold">Behavior Analytics</h2>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              ⏱️ Session Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : sessionStats ? (
              <div className="space-y-1">
                <div className="text-3xl font-bold">{sessionStats.avg} min</div>
                <p className="text-xs text-muted-foreground">
                  Median: {sessionStats.median} min · {sessionStats.total_sessions} sessions
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              🔍 Total Searches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSearches ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : topSearches ? (
              <div className="space-y-1">
                <div className="text-3xl font-bold">
                  {topSearches.reduce((s, t) => s + t.count, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {topSearches.length} unique queries
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              🖱️ Canvas Clicks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClicks ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : clicks ? (
              <div className="text-3xl font-bold">{clicks.length}</div>
            ) : (
              <p className="text-muted-foreground text-sm">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Searches */}
        <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔍 Top Icon Searches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSearches ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : topSearches && topSearches.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSearches.slice(0, 10)} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="query" type="category" width={120} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "2px solid hsl(var(--foreground))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "count") return [value, "Searches"];
                        if (name === "avg_results") return [value, "Avg Results"];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No search data yet
              </div>
            )}
            {topSearches && topSearches.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Zero-result searches:</p>
                <div className="flex flex-wrap gap-1.5">
                  {topSearches
                    .filter((s) => s.avg_results === 0)
                    .slice(0, 10)
                    .map((s) => (
                      <Badge key={s.query} variant="destructive" className="text-xs">
                        {s.query} ({s.count})
                      </Badge>
                    ))}
                  {topSearches.filter((s) => s.avg_results === 0).length === 0 && (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Canvas Click Heatmap */}
        <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🖱️ Canvas Click Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClicks ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : heatmapGrid && heatmapGrid.max > 0 ? (
              <div className="flex flex-col items-center">
                <div
                  className="border border-border rounded overflow-hidden"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${HEATMAP_GRID}, 1fr)`,
                    width: "100%",
                    maxWidth: "400px",
                    aspectRatio: "3/2",
                  }}
                >
                  {heatmapGrid.grid.map((row, ri) =>
                    row.map((count, ci) => (
                      <div
                        key={`${ri}-${ci}`}
                        title={`${count} clicks`}
                        style={{
                          backgroundColor: cellColor(count, heatmapGrid.max),
                          transition: "background-color 0.2s",
                        }}
                      />
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span>Low</span>
                  {["hsl(120,50%,70%)", "hsl(50,90%,55%)", "hsl(30,90%,55%)", "hsl(0,80%,50%)"].map(
                    (c) => (
                      <div
                        key={c}
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: c }}
                      />
                    )
                  )}
                  <span>High</span>
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No click data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second row: Session Duration + Top Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Duration Distribution */}
        <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⏱️ Session Duration Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : sessionStats && sessionStats.buckets.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sessionStats.buckets}>
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "2px solid hsl(var(--foreground))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No session data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tools */}
        <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🛠️ Most Used Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTools ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : topTools && topTools.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topTools.slice(0, 10)} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="tool" type="category" width={130} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "2px solid hsl(var(--foreground))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(262, 83%, 58%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No tool usage data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Analytics = () => {
  const navigate = useNavigate();
  const [sortColumn, setSortColumn] = useState<keyof UserAnalytics>("project_count");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProjectsDialogOpen, setIsProjectsDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAnalytics | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Export filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterMinProjects, setFilterMinProjects] = useState('');
  const [filterMaxProjects, setFilterMaxProjects] = useState('');
  const [filterJoinFrom, setFilterJoinFrom] = useState('');
  const [filterJoinTo, setFilterJoinTo] = useState('');
  const [filterLoginFrom, setFilterLoginFrom] = useState('');
  const [filterLoginTo, setFilterLoginTo] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const hasActiveFilters = filterMinProjects || filterMaxProjects || filterJoinFrom || filterJoinTo || filterLoginFrom || filterLoginTo || filterLocation;

  const clearFilters = () => {
    setFilterMinProjects('');
    setFilterMaxProjects('');
    setFilterJoinFrom('');
    setFilterJoinTo('');
    setFilterLoginFrom('');
    setFilterLoginTo('');
    setFilterLocation('');
  };

  const handleFilteredExport = async () => {
    setIsExporting(true);
    try {
      // Fetch ALL users via the RPC with a large limit for export
      const { data: allUsers, error } = await supabase
        .rpc('get_user_analytics', { limit_count: 100000, offset_count: 0 });

      if (error) throw error;
      if (!allUsers || allUsers.length === 0) {
        toast.error('No users found');
        setIsExporting(false);
        return;
      }

      // Apply filters client-side
      let filtered = allUsers.map((row: any) => ({
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        country: row.country,
        field_of_study: row.field_of_study,
        created_at: row.created_at,
        last_login_at: row.last_login_at,
        project_count: Number(row.project_count),
      }));

      if (filterMinProjects) {
        filtered = filtered.filter((u: any) => u.project_count >= Number(filterMinProjects));
      }
      if (filterMaxProjects) {
        filtered = filtered.filter((u: any) => u.project_count <= Number(filterMaxProjects));
      }
      if (filterJoinFrom) {
        filtered = filtered.filter((u: any) => new Date(u.created_at) >= new Date(filterJoinFrom));
      }
      if (filterJoinTo) {
        filtered = filtered.filter((u: any) => new Date(u.created_at) <= new Date(filterJoinTo + 'T23:59:59'));
      }
      if (filterLoginFrom) {
        filtered = filtered.filter((u: any) => u.last_login_at && new Date(u.last_login_at) >= new Date(filterLoginFrom));
      }
      if (filterLoginTo) {
        filtered = filtered.filter((u: any) => u.last_login_at && new Date(u.last_login_at) <= new Date(filterLoginTo + 'T23:59:59'));
      }
      if (filterLocation) {
        filtered = filtered.filter((u: any) =>
          u.country && u.country.toLowerCase().includes(filterLocation.toLowerCase())
        );
      }

      if (filtered.length === 0) {
        toast.error('No users match the selected filters');
        setIsExporting(false);
        return;
      }

      exportUsersToExcel(filtered);
      toast.success('Filtered export successful', {
        description: `Exported ${filtered.length} users to Excel`,
      });
    } catch (error) {
      console.error('Filtered export error:', error);
      toast.error('Export failed', { description: 'Please try again.' });
    }
    setIsExporting(false);
  };

  // Use optimized hook with server-side aggregation and pagination
  // Replaces fetching ALL profiles + ALL projects with single RPC call
  const { data, isLoading } = useUserAnalytics(currentPage, ITEMS_PER_PAGE);
  const analyticsData = data?.users || [];
  const totalUsers = data?.totalCount || 0;

  const { data: userProjects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['user-projects', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const { data, error } = await supabase
        .from('canvas_projects')
        .select('id, name, title, created_at, updated_at, is_public, approval_status, view_count, cloned_count')
        .eq('user_id', selectedUserId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUserId && isProjectsDialogOpen
  });

  // Client-side sorting (data is already paginated from server)
  const sortedData = analyticsData ? [...analyticsData].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === null) return 1;
    if (bValue === null) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  }) : [];

  const handleSort = (column: keyof UserAnalytics) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
    setCurrentPage(1); // Reset to first page on sort
  };

  const handleExportToExcel = () => {
    if (!analyticsData) return;
    
    try {
      exportUsersToExcel(analyticsData);
      toast.success("Export successful", {
        description: `Exported ${analyticsData.length} users to Excel`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Export failed", {
        description: "Failed to export user data. Please try again.",
      });
    }
  };

  // Data is already paginated from server, just use sortedData directly
  const paginatedData = sortedData;
  const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE);

  // Calculate distribution data
  const { data: countryDistribution = [] } = useQuery({
    queryKey: ['analytics', 'country-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_country_distribution');
      if (error) throw error;
      const sorted = (data || []).map((r: any) => ({ country: r.country, count: Number(r.count) }));
      if (sorted.length > 10) {
        const top10 = sorted.slice(0, 10);
        const othersCount = sorted.slice(10).reduce((sum: number, item: any) => sum + item.count, 0);
        return [...top10, { country: 'Others', count: othersCount }];
      }
      return sorted;
    },
    staleTime: 60_000,
  });

  const { data: fieldDistribution = [] } = useQuery({
    queryKey: ['analytics', 'field-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_field_distribution');
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({ field: r.field, count: Number(r.count) }));
      const total = rows.reduce((s: number, r: any) => s + r.count, 0);
      return rows.map((r: any) => ({
        ...r,
        percentage: total > 0 ? ((r.count / total) * 100).toFixed(1) : '0',
      }));
    },
    staleTime: 60_000,
  });

  const CHART_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--accent))',
    'hsl(var(--destructive))',
    'hsl(142, 76%, 36%)',
    'hsl(262, 83%, 58%)',
    'hsl(346, 87%, 47%)',
    'hsl(39, 96%, 47%)',
  ];

  const totalProjects = analyticsData?.reduce((sum, user) => sum + user.project_count, 0) || 0;
  const avgProjects = totalUsers > 0 ? (totalProjects / totalUsers).toFixed(1) : "0";
  const mostActiveUser = analyticsData?.reduce((max, user) => 
    user.project_count > max.project_count ? user : max
  , { project_count: 0, full_name: "N/A" });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">📊</span>
            <div>
              <h1 className="text-2xl font-bold leading-tight">User Analytics</h1>
              <p className="text-xs text-muted-foreground leading-none">Real-time user & behavior insights</p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                👥 Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                📂 Total Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalProjects}</div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                📈 Avg Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgProjects}</div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                👑 Most Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">{mostActiveUser?.full_name}</div>
              <div className="text-xs text-muted-foreground">{mostActiveUser?.project_count} projects</div>
            </CardContent>
          </Card>
        </div>

        {/* Distribution Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Country Distribution */}
          <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🌍 Users by Country ({countryDistribution.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {countryDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countryDistribution} layout="vertical">
                      <XAxis type="number" />
                      <YAxis dataKey="country" type="category" width={120} />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '2px solid hsl(var(--foreground))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No country data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Field of Study Distribution */}
          <Card className="border border-border/50 bg-background/80 backdrop-blur-sm rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🎓 Users by Field of Study ({fieldDistribution.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {fieldDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fieldDistribution} layout="vertical">
                      <XAxis type="number" />
                      <YAxis dataKey="field" type="category" width={180} />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '2px solid hsl(var(--foreground))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No field of study data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Retention & Conversion */}
        <RetentionAnalytics />

        {/* User Segments */}
        <UserSegmentation />

        {/* Inactive User Cleanup */}
        <InactiveUserCleanup />

        {/* Behavior Analytics */}
        <BehaviorAnalytics />

        {/* Data Table */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">📋 User Details</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? 'Hide Filters' : 'Export Filters'}
                  {hasActiveFilters && <Badge variant="default" className="ml-1 text-[10px] px-1.5">Active</Badge>}
                </Button>
                <Button
                  onClick={handleExportToExcel}
                  disabled={!analyticsData || analyticsData.length === 0}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export All ({totalUsers})
                </Button>
              </div>
            </div>

            {showFilters && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Filter & Export</p>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                      <X className="h-3 w-3 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Project Count Range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Number of Projects</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filterMinProjects}
                        onChange={(e) => setFilterMinProjects(e.target.value)}
                        className="h-8 text-sm"
                        min={0}
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filterMaxProjects}
                        onChange={(e) => setFilterMaxProjects(e.target.value)}
                        className="h-8 text-sm"
                        min={0}
                      />
                    </div>
                  </div>

                  {/* Join Date Range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Join Date Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={filterJoinFrom}
                        onChange={(e) => setFilterJoinFrom(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={filterJoinTo}
                        onChange={(e) => setFilterJoinTo(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Last Login Date Range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Last Login Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={filterLoginFrom}
                        onChange={(e) => setFilterLoginFrom(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={filterLoginTo}
                        onChange={(e) => setFilterLoginTo(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Location (Country)</Label>
                    <Input
                      type="text"
                      placeholder="e.g. United States"
                      value={filterLocation}
                      onChange={(e) => setFilterLocation(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Filters apply to the exported file. Set your criteria then click export.
                  </p>
                  <Button
                    onClick={handleFilteredExport}
                    disabled={isExporting}
                    className="gap-2"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isExporting ? 'Exporting...' : 'Export Filtered'}
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:text-primary font-semibold"
                      onClick={() => handleSort('full_name')}
                    >
                      Name {sortColumn === 'full_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-primary font-semibold"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-primary font-semibold"
                      onClick={() => handleSort('country')}
                    >
                      Location {sortColumn === 'country' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-primary font-semibold text-center"
                      onClick={() => handleSort('project_count')}
                    >
                      Projects {sortColumn === 'project_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-primary font-semibold"
                      onClick={() => handleSort('created_at')}
                    >
                      Joined {sortColumn === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:text-primary font-semibold"
                      onClick={() => handleSort('last_login_at')}
                    >
                      Last Login {sortColumn === 'last_login_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((user) => (
                    <TableRow 
                      key={user.id}
                      className={
                        user.project_count >= 5 
                          ? 'bg-green-500/5 hover:bg-green-500/10' 
                          : user.project_count >= 1 
                          ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                          : 'hover:bg-muted/50'
                      }
                    >
                      <TableCell className="font-medium">
                        {user.full_name || 'No name'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {user.country || (
                          <span className="text-muted-foreground italic">No location set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {user.project_count}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.last_login_at 
                          ? format(new Date(user.last_login_at), 'MMM d, yyyy HH:mm')
                          : <span className="italic">Never</span>
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsProfileDialogOpen(true);
                            }}
                          >
                            <User className="h-4 w-4 mr-1" />
                            Profile
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setIsProjectsDialogOpen(true);
                            }}
                            disabled={user.project_count === 0}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Projects
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {(() => {
                      const getVisiblePages = (): (number | 'ellipsis')[] => {
                        if (totalPages <= 7) {
                          return Array.from({ length: totalPages }, (_, i) => i + 1);
                        }
                        
                        const pages: (number | 'ellipsis')[] = [];
                        
                        // Always show first 3
                        pages.push(1, 2, 3);
                        
                        // Add ellipsis if current is far from start
                        if (currentPage > 5) {
                          pages.push('ellipsis');
                        }
                        
                        // Pages around current (if not already included)
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          if (i > 3 && i < totalPages - 2 && !pages.includes(i)) {
                            pages.push(i);
                          }
                        }
                        
                        // Add ellipsis if current is far from end
                        if (currentPage < totalPages - 4) {
                          pages.push('ellipsis');
                        }
                        
                        // Always show last 3
                        for (let i = totalPages - 2; i <= totalPages; i++) {
                          if (!pages.includes(i)) {
                            pages.push(i);
                          }
                        }
                        
                        return pages;
                      };
                      
                      return getVisiblePages().map((page, index) => (
                        <PaginationItem key={`${page}-${index}`}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ));
                    })()}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Profile Dialog */}
        <UserProfileDialog
          isOpen={isProfileDialogOpen}
          onClose={() => {
            setIsProfileDialogOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onViewProjects={() => {
            setIsProfileDialogOpen(false);
            if (selectedUser) {
              setSelectedUserId(selectedUser.id);
              setIsProjectsDialogOpen(true);
            }
          }}
        />

        {/* User Projects Dialog */}
        <UserProjectsDialog
          isOpen={isProjectsDialogOpen}
          onClose={() => {
            setIsProjectsDialogOpen(false);
            setSelectedUserId(null);
          }}
          userId={selectedUserId}
          userProjects={userProjects || []}
          userName={sortedData.find(u => u.id === selectedUserId)?.full_name || 'User'}
          isLoading={isLoadingProjects}
        />
      </div>
    </div>
  );
};

export default Analytics;
