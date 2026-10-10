import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef, useCallback } from 'react';

export interface CommentPinData {
  id: string;
  canvas_x: number;
  canvas_y: number;
  content: string;
  resolved: boolean;
  replyCount: number;
  authorName: string;
}

interface CommentPinProps {
  comment: CommentPinData;
  screenX: number;
  screenY: number;
  isActive?: boolean;
  isRead?: boolean;
  onClick: () => void;
  onDrag?: (id: string, newCanvasX: number, newCanvasY: number) => void;
  onDragEnd?: (id: string, newCanvasX: number, newCanvasY: number) => void;
}

/**
 * A clickable pin that appears on the canvas at a comment's (x, y) position.
 * Supports click to open and drag to reposition.
 */
export function CommentPin({ comment, screenX, screenY, isActive, isRead, onClick, onDrag, onDragEnd }: CommentPinProps) {
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    originCanvasX: number;
    originCanvasY: number;
    dragged: boolean;
  } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return; // left button only
    dragState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      originCanvasX: comment.canvas_x,
      originCanvasY: comment.canvas_y,
      dragged: false,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [comment.canvas_x, comment.canvas_y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startMouseX;
    const dy = e.clientY - ds.startMouseY;
    // Require a minimum drag distance to distinguish from clicks
    if (!ds.dragged && Math.abs(dx) + Math.abs(dy) < 4) return;
    ds.dragged = true;

    // Convert screen delta to canvas delta using the fabric viewport transform
    const fc = (window as any).fabricCanvas;
    const vpt: number[] = fc?.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const newCanvasX = ds.originCanvasX + dx / vpt[0];
    const newCanvasY = ds.originCanvasY + dy / vpt[3];
    onDrag?.(comment.id, newCanvasX, newCanvasY);
  }, [comment.id, onDrag]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    dragState.current = null;
    if (!ds) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (!ds.dragged) {
      // No drag occurred — treat as click
      onClick();
    } else {
      // Persist final position
      const fc = (window as any).fabricCanvas;
      const vpt: number[] = fc?.viewportTransform ?? [1, 0, 0, 1, 0, 0];
      const dx = e.clientX - ds.startMouseX;
      const dy = e.clientY - ds.startMouseY;
      const newCanvasX = ds.originCanvasX + dx / vpt[0];
      const newCanvasY = ds.originCanvasY + dy / vpt[3];
      onDragEnd?.(comment.id, newCanvasX, newCanvasY);
    }
  }, [onClick, comment.id, onDragEnd]);

  return (
    <button
      className={cn(
        'absolute flex items-center justify-center rounded-full border-2 cursor-pointer focus:outline-none hover:scale-110 transition-transform',
        comment.resolved
          ? 'bg-muted border-muted-foreground/40 text-muted-foreground w-7 h-7'
          : 'bg-primary border-primary-foreground text-primary-foreground w-8 h-8 shadow-md',
        isActive && 'ring-2 ring-offset-2 ring-primary scale-125',
      )}
      style={{
        left: screenX - 16,
        top: screenY - 16,
        zIndex: 100,
        transition: dragState.current?.dragged ? 'none' : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title={comment.authorName}
      data-testid="canvas-comment-pin"
    >
      <MessageSquare className="h-4 w-4" />
      {comment.replyCount > 0 && !isRead && (
        <span
          className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[14px] h-[14px] px-0.5"
        >
          {comment.replyCount > 9 ? '9+' : comment.replyCount}
        </span>
      )}
    </button>
  );
}
