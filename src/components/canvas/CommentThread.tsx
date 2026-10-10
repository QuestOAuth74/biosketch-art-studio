import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, X, CheckCircle, Circle, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface CommentEntry {
  id: string;
  author_id: string;
  content: string;
  resolved: boolean;
  parent_id: string | null;
  created_at: string;
  authorName: string;
  authorAvatar: string | null;
}

interface CommentThreadProps {
  topLevelCommentId: string;
  projectId: string;
  projectOwnerId: string;
  onClose: () => void;
  onThreadDeleted?: (commentId: string) => void;
  onCommentNotification?: (commentId: string, isReply: boolean) => void;
}

export function CommentThread({
  topLevelCommentId,
  projectId,
  projectOwnerId,
  onClose,
  onThreadDeleted,
  onCommentNotification,
}: CommentThreadProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CommentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Track which delete confirmation popover is open.
  // '__thread__' = the thread-level delete in the header; any other string = an entry id.
  const [deletePopoverOpen, setDeletePopoverOpen] = useState<string | null>(null);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('canvas_comments')
      .select('id, author_id, content, resolved, parent_id, created_at')
      .or(`id.eq.${topLevelCommentId},parent_id.eq.${topLevelCommentId}`)
      .order('created_at', { ascending: true });

    if (!data) return;

    const authorIds = [...new Set(data.map((c) => c.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', authorIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

    setEntries(
      data.map((c) => {
        const profile = profileMap.get(c.author_id);
        return {
          ...c,
          authorName: profile?.full_name ?? 'Unknown',
          authorAvatar: profile?.avatar_url ?? null,
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comment-thread:${topLevelCommentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'canvas_comments',
        filter: `parent_id=eq.${topLevelCommentId}`,
      }, () => { fetchComments(); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'canvas_comments',
        filter: `id=eq.${topLevelCommentId}`,
      }, () => { fetchComments(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [topLevelCommentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReply = async () => {
    if (!replyText.trim() || !user) return;
    setSubmitting(true);

    const { data: reply, error } = await supabase
      .from('canvas_comments')
      .insert({
        project_id: projectId,
        parent_id: topLevelCommentId,
        author_id: user.id,
        content: replyText.trim(),
      })
      .select('id')
      .single();

    setSubmitting(false);
    if (error) { toast.error('Failed to post reply'); return; }
    setReplyText('');
    fetchComments();
    if (reply) onCommentNotification?.(reply.id, true);
  };

  const handleResolve = async (resolved: boolean) => {
    const { error } = await supabase
      .from('canvas_comments')
      .update({
        resolved,
        resolved_by: resolved ? user?.id : null,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq('id', topLevelCommentId);

    if (error) { toast.error('Failed to update comment'); return; }
    fetchComments();
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from('canvas_comments')
      .delete()
      .eq('id', commentId);

    if (error) { toast.error('Failed to delete comment'); return; }

    if (commentId === topLevelCommentId) {
      onThreadDeleted?.(topLevelCommentId);
      onClose();
    } else {
      // If this was the last reply, auto-delete the whole thread so the pin is removed.
      const remainingReplies = entries.filter(
        (e) => e.parent_id === topLevelCommentId && e.id !== commentId,
      );
      const topLevelEntry = entries.find((e) => e.id === topLevelCommentId);
      if (remainingReplies.length === 0 && topLevelEntry && canDelete(topLevelEntry)) {
        const { error: e2 } = await supabase
          .from('canvas_comments')
          .delete()
          .eq('id', topLevelCommentId);
        if (!e2) {
          onThreadDeleted?.(topLevelCommentId);
          onClose();
          return;
        }
      }
      fetchComments();
    }
  };

  const topLevel = entries.find((e) => e.id === topLevelCommentId);
  const canDelete = (entry: CommentEntry) =>
    user?.id === entry.author_id || user?.id === projectOwnerId;
  const canResolve = () =>
    user?.id === topLevel?.author_id || user?.id === projectOwnerId;
  const canDeleteThread = () => !!topLevel && canDelete(topLevel);

  return (
    <div
      className="bg-background border border-border rounded-xl shadow-xl w-80 flex flex-col max-h-[480px]"
      data-testid="canvas-comment-thread"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Comment Thread</span>
          {topLevel?.resolved && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-300">
              Resolved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canResolve() && topLevel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleResolve(!topLevel.resolved)}
              title={topLevel.resolved ? 'Unresolve' : 'Resolve'}
              data-testid="comment-resolve-button"
            >
              {topLevel.resolved
                ? <Circle className="h-4 w-4 text-muted-foreground" />
                : <CheckCircle className="h-4 w-4 text-green-600" />}
            </Button>
          )}
          {canDeleteThread() && (
            <Popover
              open={deletePopoverOpen === '__thread__'}
              onOpenChange={(o) => setDeletePopoverOpen(o ? '__thread__' : null)}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Delete thread"
                  data-testid="comment-delete-thread-button"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" side="bottom" align="end">
                <p className="text-xs text-muted-foreground mb-2">Delete this thread?</p>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs w-full"
                  onClick={() => {
                    setDeletePopoverOpen(null);
                    handleDelete(topLevelCommentId);
                  }}
                >
                  Confirm delete
                </Button>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={cn('flex gap-2 group', entry.parent_id && 'ml-4 pl-4 border-l border-border')}>
              <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                {entry.authorAvatar && <AvatarImage src={entry.authorAvatar} />}
                <AvatarFallback className="text-xs">{entry.authorName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-semibold truncate">{entry.authorName}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {canDelete(entry) && (
                    <Popover
                      open={deletePopoverOpen === entry.id}
                      onOpenChange={(o) => setDeletePopoverOpen(o ? entry.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" side="bottom" align="end">
                        <p className="text-xs text-muted-foreground mb-2">Delete this comment?</p>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs w-full"
                          onClick={() => {
                            setDeletePopoverOpen(null);
                            handleDelete(entry.id);
                          }}
                        >
                          Confirm delete
                        </Button>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
                  {entry.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            placeholder="Reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply();
            }}
            className="text-sm min-h-[52px] resize-none flex-1"
            maxLength={2000}
            data-testid="comment-reply-input"
          />
          <Button
            size="icon"
            className="flex-shrink-0 self-end h-8 w-8"
            onClick={handleReply}
            disabled={submitting || !replyText.trim()}
            data-testid="comment-reply-submit"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
