import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, User, UserX, Check, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Profile {
  full_name: string | null;
  email: string | null;
  field_of_study: string | null;
}

interface RecentProject {
  id: string;
  name: string;
  updated_at: string;
}

interface Feedback {
  id: string;
  user_id: string | null;
  rating: 'thumbs_up' | 'thumbs_down';
  page: string;
  user_agent: string | null;
  created_at: string;
  comment: string | null;
  is_viewed: boolean;
  profile?: Profile | null;
  recent_projects?: RecentProject[];
}

export const ToolFeedbackManager = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [feedbacks, filterRating, filterUser]);

  const fetchFeedbacks = async () => {
    try {
      // Fetch feedback entries
      const { data, error } = await supabase
        .from('tool_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rawFeedbacks = (data as Feedback[]) || [];

      // Collect unique user IDs for profile + project lookup
      const userIds = [...new Set(rawFeedbacks.filter(f => f.user_id).map(f => f.user_id!))];

      if (userIds.length > 0) {
        // Fetch profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, field_of_study')
          .in('id', userIds);

        const profileMap = new Map<string, Profile>();
        (profiles || []).forEach((p: any) => {
          profileMap.set(p.id, { full_name: p.full_name, email: p.email, field_of_study: p.field_of_study });
        });

        // Fetch up to 3 recent projects per user
        const { data: projects } = await supabase
          .from('canvas_projects')
          .select('id, user_id, name, updated_at')
          .in('user_id', userIds)
          .order('updated_at', { ascending: false })
          .limit(userIds.length * 3);

        const projectMap = new Map<string, RecentProject[]>();
        (projects || []).forEach((p: any) => {
          const list = projectMap.get(p.user_id) || [];
          if (list.length < 3) {
            list.push({ id: p.id, name: p.name, updated_at: p.updated_at });
          }
          projectMap.set(p.user_id, list);
        });

        // Attach profile and projects to each feedback
        rawFeedbacks.forEach(f => {
          if (f.user_id) {
            f.profile = profileMap.get(f.user_id) || null;
            f.recent_projects = projectMap.get(f.user_id) || [];
          }
        });
      }

      setFeedbacks(rawFeedbacks);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...feedbacks];

    if (filterRating !== 'all') {
      filtered = filtered.filter(f => f.rating === filterRating);
    }

    if (filterUser === 'logged_in') {
      filtered = filtered.filter(f => f.user_id !== null);
    } else if (filterUser === 'anonymous') {
      filtered = filtered.filter(f => f.user_id === null);
    }

    setFilteredFeedbacks(filtered);
    setCurrentPage(1);
  };

  const markAllAsViewed = async () => {
    try {
      const { error } = await supabase
        .from('tool_feedback')
        .update({ is_viewed: true })
        .eq('is_viewed', false);

      if (error) throw error;

      toast.success('All feedback marked as viewed');
      fetchFeedbacks();
    } catch (error) {
      console.error('Error marking feedback as viewed:', error);
      toast.error('Failed to mark all feedback as viewed');
    }
  };

  const getStatistics = () => {
    const total = feedbacks.length;
    const thumbsUp = feedbacks.filter(f => f.rating === 'thumbs_up').length;
    const thumbsDown = feedbacks.filter(f => f.rating === 'thumbs_down').length;
    const thumbsUpPercent = total > 0 ? ((thumbsUp / total) * 100).toFixed(1) : '0';
    const thumbsDownPercent = total > 0 ? ((thumbsDown / total) * 100).toFixed(1) : '0';

    return { total, thumbsUp, thumbsDown, thumbsUpPercent, thumbsDownPercent };
  };

  const stats = getStatistics();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tool Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading feedback...</p>
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
            <CardDescription>Total Ratings</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              Positive
            </CardDescription>
            <CardTitle className="text-3xl text-green-600 dark:text-green-400">
              {stats.thumbsUp}
              <span className="text-lg ml-2 text-muted-foreground">({stats.thumbsUpPercent}%)</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              Negative
            </CardDescription>
            <CardTitle className="text-3xl text-red-600 dark:text-red-400">
              {stats.thumbsDown}
              <span className="text-lg ml-2 text-muted-foreground">({stats.thumbsDownPercent}%)</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div>
              <CardTitle>Feedback Details</CardTitle>
              <CardDescription>All user feedback submissions</CardDescription>
            </div>
            <Button
              onClick={markAllAsViewed}
              variant="outline"
              size="sm"
              disabled={feedbacks.filter(f => !f.is_viewed).length === 0}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark All as Viewed
            </Button>
          </div>

          <div className="flex gap-4 pt-4">
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="thumbs_up">Thumbs Up</SelectItem>
                <SelectItem value="thumbs_down">Thumbs Down</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="logged_in">Logged In</SelectItem>
                <SelectItem value="anonymous">Anonymous</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredFeedbacks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No feedback found</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead>Recent Projects</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedbacks
                      .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                      .map((feedback) => (
                      <TableRow key={feedback.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(feedback.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {feedback.rating === 'thumbs_up' ? (
                            <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              Positive
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400">
                              <ThumbsDown className="h-3 w-3 mr-1" />
                              Negative
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {feedback.user_id ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium truncate max-w-[160px]">
                                  {feedback.profile?.full_name || 'Unknown'}
                                </span>
                              </div>
                              {feedback.profile?.email && (
                                <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={feedback.profile.email}>
                                  {feedback.profile.email}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline">
                              <UserX className="h-3 w-3 mr-1" />
                              Anonymous
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {feedback.profile?.field_of_study ? (
                            <span className="text-sm">{feedback.profile.field_of_study}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {feedback.recent_projects && feedback.recent_projects.length > 0 ? (
                            <div className="space-y-1">
                              {feedback.recent_projects.map((project) => (
                                <a
                                  key={project.id}
                                  href={`/canvas/${project.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-[150px]"
                                  title={project.name}
                                >
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                  {project.name}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{feedback.page}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          {feedback.comment ? (
                            <p className="text-sm text-foreground line-clamp-2" title={feedback.comment}>
                              {feedback.comment}
                            </p>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">No comment</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!feedback.is_viewed && (
                            <Badge variant="secondary" className="text-xs">New</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {Math.ceil(filteredFeedbacks.length / PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredFeedbacks.length)} of {filteredFeedbacks.length}
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
                      Page {currentPage} of {Math.ceil(filteredFeedbacks.length / PAGE_SIZE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= Math.ceil(filteredFeedbacks.length / PAGE_SIZE)}
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
