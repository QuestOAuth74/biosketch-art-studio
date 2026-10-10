import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, X, MessageSquare, CheckCircle, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'unresolved' | 'resolved';

interface SidebarComment {
  id: string;
  canvas_x: number;
  canvas_y: number;
  content: string;
  resolved: boolean;
  created_at: string;
  replyCount: number;
  authorName: string;
  authorAvatar: string | null;
}

interface CommentSidebarProps {
  projectId: string;
  onClose: () => void;
  onSelectComment: (commentId: string, canvasX: number, canvasY: number) => void;
}

export function CommentSidebar({ projectId, onClose, onSelectComment }: CommentSidebarProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [comments, setComments] = useState<SidebarComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('canvas_comments')
      .select('id, canvas_x, canvas_y, content, resolved, created_at, author_id')
      .eq('project_id', projectId)
      .is('parent_id', null)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    // Fetch reply counts
    const ids = data.map((c) => c.id);
    const { data: replyCounts } = await supabase
      .from('canvas_comments')
      .select('parent_id')
      .in('parent_id', ids);

    const countMap = new Map<string, number>();
    replyCounts?.forEach((r) => {
      countMap.set(r.parent_id!, (countMap.get(r.parent_id!) ?? 0) + 1);
    });

    // Fetch author profiles
    const authorIds = [...new Set(data.map((c) => c.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', authorIds);
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

    setComments(
      data.map((c) => {
        const profile = profileMap.get(c.author_id);
        return {
          id: c.id,
          canvas_x: c.canvas_x ?? 0,
          canvas_y: c.canvas_y ?? 0,
          content: c.content,
          resolved: c.resolved,
          created_at: c.created_at,
          replyCount: countMap.get(c.id) ?? 0,
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
      .channel(`comments-sidebar:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'canvas_comments',
        filter: `project_id=eq.${projectId}`,
      }, () => { fetchComments(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchComments]);

  const filtered = comments.filter((c) => {
    if (filter === 'resolved') return c.resolved;
    if (filter === 'unresolved') return !c.resolved;
    return true;
  });

  return (
    <div
      className="flex flex-col h-full bg-background border-l border-border w-72"
      data-testid="canvas-comment-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Comments</span>
          {comments.length > 0 && (
            <Badge variant="secondary" className="text-xs">{comments.length}</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border">
        {(['all', 'unresolved', 'resolved'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 py-2 text-xs font-medium capitalize transition-colors',
              filter === f
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            data-testid={`comment-filter-${f}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Comment list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No {filter === 'all' ? '' : filter} comments yet
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filtered.map((c) => (
              <button
                key={c.id}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                onClick={() => onSelectComment(c.id, c.canvas_x, c.canvas_y)}
                data-testid="comment-sidebar-item"
              >
                <div className="flex items-start gap-2">
                  <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                    {c.authorAvatar && <AvatarImage src={c.authorAvatar} />}
                    <AvatarFallback className="text-[9px]">{c.authorName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-xs font-medium truncate">{c.authorName}</span>
                      {c.resolved
                        ? <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                        : <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      }
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{c.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                      {c.replyCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {c.replyCount} repl{c.replyCount !== 1 ? 'ies' : 'y'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
