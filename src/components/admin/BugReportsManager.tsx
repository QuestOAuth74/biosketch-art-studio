import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, User, Check, ChevronLeft, ChevronRight, Globe, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Profile {
  full_name: string | null;
  email: string | null;
}

interface BugReport {
  id: string;
  user_id: string;
  description: string;
  browser: string | null;
  page_url: string | null;
  created_at: string;
  is_viewed?: boolean;
  profile?: Profile | null;
}

export const BugReportsManager = () => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrowser, setFilterBrowser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reports, filterBrowser, filterStatus]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('bug_reports' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rawReports = (data as BugReport[]) || [];

      // Fetch user profiles
      const userIds = [...new Set(rawReports.filter(r => r.user_id).map(r => r.user_id))];

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const profileMap = new Map<string, Profile>();
        (profiles || []).forEach((p: any) => {
          profileMap.set(p.id, { full_name: p.full_name, email: p.email });
        });

        rawReports.forEach(r => {
          if (r.user_id) {
            r.profile = profileMap.get(r.user_id) || null;
          }
        });
      }

      setReports(rawReports);
    } catch (error) {
      console.error('Error fetching bug reports:', error);
      toast.error('Failed to load bug reports');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];

    if (filterBrowser !== 'all') {
      filtered = filtered.filter(r => r.browser === filterBrowser);
    }

    if (filterStatus === 'new') {
      filtered = filtered.filter(r => !r.is_viewed);
    } else if (filterStatus === 'viewed') {
      filtered = filtered.filter(r => r.is_viewed);
    }

    setFilteredReports(filtered);
    setCurrentPage(1);
  };

  const markAllAsViewed = async () => {
    try {
      const { error } = await supabase
        .from('bug_reports' as any)
        .update({ is_viewed: true })
        .eq('is_viewed', false);

      if (error) throw error;

      toast.success('All bug reports marked as viewed');
      fetchReports();
    } catch (error) {
      console.error('Error marking reports as viewed:', error);
      toast.error('Failed to mark reports as viewed');
    }
  };

  const deleteReport = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bug_reports' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Bug report deleted');
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  const getStatistics = () => {
    const total = reports.length;
    const unviewed = reports.filter(r => !r.is_viewed).length;
    const browsers = reports.reduce((acc, r) => {
      const b = r.browser || 'Unknown';
      acc[b] = (acc[b] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topBrowser = Object.entries(browsers).sort((a, b) => b[1] - a[1])[0];

    return { total, unviewed, topBrowser };
  };

  const stats = getStatistics();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bug Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading bug reports...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Reports</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-red-600 dark:text-red-400" />
              Unreviewed
            </CardDescription>
            <CardTitle className="text-3xl text-red-600 dark:text-red-400">
              {stats.unviewed}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Top Browser
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats.topBrowser ? stats.topBrowser[0] : '—'}
              {stats.topBrowser && (
                <span className="text-lg ml-2 text-muted-foreground">({stats.topBrowser[1]})</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div>
              <CardTitle>Bug Report Details</CardTitle>
              <CardDescription>All user-submitted bug reports</CardDescription>
            </div>
            <Button
              onClick={markAllAsViewed}
              variant="outline"
              size="sm"
              disabled={stats.unviewed === 0}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark All as Viewed
            </Button>
          </div>

          <div className="flex gap-4 pt-4">
            <Select value={filterBrowser} onValueChange={setFilterBrowser}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by browser" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Browsers</SelectItem>
                <SelectItem value="Chrome">Chrome</SelectItem>
                <SelectItem value="Firefox">Firefox</SelectItem>
                <SelectItem value="Safari">Safari</SelectItem>
                <SelectItem value="Edge">Edge</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No bug reports found</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports
                      .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                      .map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(report.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate max-w-[160px]">
                                {report.profile?.full_name || 'Unknown'}
                              </span>
                            </div>
                            {report.profile?.email && (
                              <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={report.profile.email}>
                                {report.profile.email}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.browser || 'Unknown'}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {report.page_url ? (
                            <span className="text-xs text-muted-foreground truncate block" title={report.page_url}>
                              {report.page_url.replace(/^https?:\/\/[^/]+/, '')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {report.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          {!report.is_viewed ? (
                            <Badge variant="secondary" className="text-xs">New</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Viewed</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteReport(report.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {Math.ceil(filteredReports.length / PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredReports.length)} of {filteredReports.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {currentPage} of {Math.ceil(filteredReports.length / PAGE_SIZE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= Math.ceil(filteredReports.length / PAGE_SIZE)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
