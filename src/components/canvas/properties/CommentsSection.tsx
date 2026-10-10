import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, ChevronDown, ChevronRight, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSectionCollapseStore } from '@/stores/sectionCollapseStore';

type Filter = 'all' | 'unresolved' | 'resolved';

interface Comment {
  id: string;
  content: string;
  resolved: boolean;
  created_at: string;
  replyCount: number;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
}

interface CommentsSectionProps {
  projectId: string;
  projectOwnerId?: string;
  onSelectComment: (id: string) => void;
  showComments?: boolean;
  onToggleComments?: () => void;
}

export function CommentsSection({ projectId, projectOwnerId, onSelectComment, showComments = true, onToggleComments }: CommentsSectionProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const toggleSection = useSectionCollapseStore((s) => s.toggleSection);
  const collapsed = useSectionCollapseStore((s) => s.sections['section-comments'] ?? false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('canvas_comments')
      .select('id, content, resolved, created_at, author_id')
      .eq('project_id', projectId)
      .is('parent_id', null)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const ids = data.map((c) => c.id);
    const { data: replyCounts } = await supabase
      .from('canvas_comments')
      .select('parent_id')
      .in('parent_id', ids);

    const countMap = new Map<string, number>();
    replyCounts?.forEach((r) => {
      countMap.set(r.parent_id!, (countMap.get(r.parent_id!) ?? 0) + 1);
    });

    const authorIds = [...new Set(data.map((c) => c.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', authorIds);
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

    setComments(
      data.map((c) => {
        const profile = profileMap.get(c.author_id) as any;
        return {
          id: c.id,
          content: c.content,
          resolved: c.resolved,
          created_at: c.created_at,
          replyCount: countMap.get(c.id) ?? 0,
          authorId: c.author_id,
          authorName: profile?.full_name ?? 'Unknown',
          authorAvatar: profile?.avatar_url ?? null,
        };
      }),
    );
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-panel:${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'canvas_comments',
        filter: `project_id=eq.${projectId}`,
      }, () => fetchComments())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchComments]);

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase.from('canvas_comments').delete().eq('id', commentId);
    if (error) { toast.error('Failed to delete comment'); return; }
    fetchComments();
  };

  const canDelete = (authorId: string) =>
    !!user && (user.id === authorId || user.id === projectOwnerId);

  const filtered = comments.filter((c) => {
    if (filter === 'resolved') return c.resolved;
    if (filter === 'unresolved') return !c.resolved;
    return true;
  });

  return (
    <div id="section-comments" className="relative">
      <div
        className="bg-white border-b border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
        onClick={() => toggleSection('section-comments')}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">Comments</h3>
          {comments.length > 0 && (
            <span className="text-xs text-muted-foreground">({comments.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onToggleComments && (
            <Switch
              checked={showComments}
              onCheckedChange={onToggleComments}
              className="scale-75"
              title={showComments ? 'Hide comment pins' : 'Show comment pins'}
            />
          )}
          {collapsed
            ? <ChevronRight className="h-4 w-4 text-slate-600" />
            : <ChevronDown className="h-4 w-4 text-slate-600" />
          }
        </div>
      </div>

      {!collapsed && (
        <div className="px-3 pb-3 pt-3">
          <div className="space-y-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                No {filter === 'all' ? '' : filter} comments
              </p>
            ) : (
              <ScrollArea className="max-h-52">
                <div className="space-y-1.5 pr-1">
                  {filtered.map((c) => (
                    <div key={c.id} className="group relative rounded border border-slate-200 hover:bg-slate-50 transition-colors">
                      <button
                        className="w-full text-left p-2"
                        onClick={() => onSelectComment(c.id)}
                        data-testid="comment-panel-item"
                      >
                        <div className="flex items-start gap-1.5">
                          <Avatar className="h-5 w-5 flex-shrink-0 mt-0.5">
                            {c.authorAvatar && <AvatarImage src={c.authorAvatar} />}
                            <AvatarFallback className="text-[10px]">{c.authorName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-xs font-medium truncate">{c.authorName}</span>
                              {c.resolved
                                ? <CheckCircle className="h-2.5 w-2.5 text-green-600 flex-shrink-0" />
                                : <Circle className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                              }
                            </div>
                            <p className="text-xs text-foreground line-clamp-2">{c.content}</p>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                              </span>
                              {c.replyCount > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {c.replyCount} {c.replyCount === 1 ? 'reply' : 'replies'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                      {canDelete(c.authorId) && (
                        <Popover
                          open={deleteConfirmId === c.id}
                          onOpenChange={(o) => setDeleteConfirmId(o ? c.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                              title="Delete thread"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" side="left" align="start">
                            <p className="text-xs text-muted-foreground mb-2">Delete this thread?</p>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs w-full"
                              onClick={() => {
                                setDeleteConfirmId(null);
                                handleDelete(c.id);
                              }}
                            >
                              Confirm delete
                            </Button>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
