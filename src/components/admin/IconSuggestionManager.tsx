import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Eye, Clock, User, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecentProject {
  id: string;
  name: string;
}

interface IconSuggestion {
  id: string;
  user_id: string;
  category: string;
  icon_names: string;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  submitter?: { email: string; full_name: string | null; field_of_study: string | null } | null;
  recent_projects?: RecentProject[];
}

export const IconSuggestionManager = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<IconSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSuggestion, setSelectedSuggestion] = useState<IconSuggestion | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      // Try with submitter join first (includes field_of_study)
      const { data, error } = await supabase
        .from('icon_suggestions' as any)
        .select(`
          *,
          submitter:profiles!icon_suggestions_user_id_fkey(email, full_name, field_of_study)
        `)
        .order('created_at', { ascending: false });

      let results: IconSuggestion[];

      if (error && error.message.includes('relationship')) {
        // Fallback without join
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('icon_suggestions' as any)
          .select('*')
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        results = (fallbackData || []) as IconSuggestion[];
      } else if (error) {
        throw error;
      } else {
        results = (data || []) as IconSuggestion[];
      }

      // Fetch recent projects for each user
      const userIds = [...new Set(results.map(s => s.user_id))];
      if (userIds.length > 0) {
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
            list.push({ id: p.id, name: p.name });
          }
          projectMap.set(p.user_id, list);
        });

        results.forEach(s => {
          s.recent_projects = projectMap.get(s.user_id) || [];
        });
      }

      setSuggestions(results);
    } catch (error: any) {
      console.error('Error fetching icon suggestions:', error);
      toast.error('Failed to load icon suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchSuggestions();
    }
  }, [authLoading, isAdmin, fetchSuggestions]);

  const handleMarkReviewed = async (id: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('icon_suggestions' as any)
        .update({
          status: 'reviewed',
          admin_notes: adminNotes || null,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Suggestion marked as reviewed');
      fetchSuggestions();
      setSelectedSuggestion(null);
      setAdminNotes('');
    } catch (error: any) {
      console.error('Error updating suggestion:', error);
      toast.error('Failed to update suggestion');
    } finally {
      setProcessing(false);
    }
  };

  const handleDismiss = async (id: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('icon_suggestions' as any)
        .update({
          status: 'dismissed',
          admin_notes: adminNotes || null,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Suggestion dismissed');
      fetchSuggestions();
      setSelectedSuggestion(null);
      setAdminNotes('');
    } catch (error: any) {
      console.error('Error dismissing suggestion:', error);
      toast.error('Failed to dismiss suggestion');
    } finally {
      setProcessing(false);
    }
  };

  const filteredSuggestions = suggestions.filter(s => s.status === activeTab);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'reviewed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Reviewed</Badge>;
      case 'dismissed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Dismissed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Icon Suggestions</h2>
          <p className="text-muted-foreground">Review icon suggestions from users</p>
        </div>
        <Button
          onClick={() => fetchSuggestions()}
          variant="outline"
          disabled={loading || authLoading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({suggestions.filter(s => s.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="reviewed">
            Reviewed ({suggestions.filter(s => s.status === 'reviewed').length})
          </TabsTrigger>
          <TabsTrigger value="dismissed">
            Dismissed ({suggestions.filter(s => s.status === 'dismissed').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {(loading || authLoading) ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {authLoading ? 'Verifying admin access...' : 'Loading suggestions...'}
              </p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No {activeTab} suggestions</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuggestions.map((suggestion) => (
                <Card key={suggestion.id} className="p-6">
                  <div className="flex flex-col gap-3">
                    {/* Category */}
                    <div className="flex items-start justify-between">
                      <Badge variant="outline">{suggestion.category}</Badge>
                      {getStatusBadge(suggestion.status)}
                    </div>

                    {/* Icon Names */}
                    <div>
                      <p className="text-sm font-medium mb-1">Requested Icons:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4">
                        {suggestion.icon_names}
                      </p>
                    </div>

                    {/* User Info */}
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p className="flex items-center gap-1 font-medium text-foreground">
                        <User className="h-3 w-3" />
                        {(suggestion.submitter as any)?.full_name || 'Unknown'}
                      </p>
                      {(suggestion.submitter as any)?.email && (
                        <p className="truncate" title={(suggestion.submitter as any).email}>
                          {(suggestion.submitter as any).email}
                        </p>
                      )}
                      {(suggestion.submitter as any)?.field_of_study && (
                        <p className="italic">{(suggestion.submitter as any).field_of_study}</p>
                      )}
                      <p>{new Date(suggestion.created_at).toLocaleDateString()}</p>
                    </div>

                    {/* Recent Projects */}
                    {suggestion.recent_projects && suggestion.recent_projects.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Recent Projects:</p>
                        {suggestion.recent_projects.map((project) => (
                          <a
                            key={project.id}
                            href={`/canvas/${project.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                            title={project.name}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {project.name}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSuggestion(suggestion);
                          setAdminNotes(suggestion.admin_notes || '');
                        }}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                      {suggestion.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleMarkReviewed(suggestion.id)}
                            disabled={processing}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reviewed
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDismiss(suggestion.id)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={!!selectedSuggestion} onOpenChange={() => setSelectedSuggestion(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Icon Suggestion Details</DialogTitle>
            <DialogDescription>Review the icon suggestion from a user</DialogDescription>
          </DialogHeader>

          {selectedSuggestion && (
            <div className="space-y-6">
              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <p>{selectedSuggestion.category}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  {getStatusBadge(selectedSuggestion.status)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Submitter</p>
                  <p className="text-sm font-medium">{(selectedSuggestion.submitter as any)?.full_name || 'Unknown'}</p>
                  {(selectedSuggestion.submitter as any)?.email && (
                    <p className="text-xs text-muted-foreground">{(selectedSuggestion.submitter as any).email}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                  <p className="text-sm">{new Date(selectedSuggestion.created_at).toLocaleString()}</p>
                </div>
                {(selectedSuggestion.submitter as any)?.field_of_study && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Specialty</p>
                    <p className="text-sm">{(selectedSuggestion.submitter as any).field_of_study}</p>
                  </div>
                )}
                {selectedSuggestion.recent_projects && selectedSuggestion.recent_projects.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Recent Projects</p>
                    <div className="space-y-1 mt-1">
                      {selectedSuggestion.recent_projects.map((project) => (
                        <a
                          key={project.id}
                          href={`/canvas/${project.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {project.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Requested Icons */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Requested Icons</p>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm whitespace-pre-line">{selectedSuggestion.icon_names}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedSuggestion.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">User Notes</p>
                  <p className="text-sm">{selectedSuggestion.notes}</p>
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <Label htmlFor="suggestion-admin-notes">Admin Notes (Optional)</Label>
                <Textarea
                  id="suggestion-admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Private notes for your records..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              {selectedSuggestion.status === 'pending' && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedSuggestion(null)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDismiss(selectedSuggestion.id)}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Dismiss
                  </Button>
                  <Button
                    onClick={() => handleMarkReviewed(selectedSuggestion.id)}
                    disabled={processing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Reviewed
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
