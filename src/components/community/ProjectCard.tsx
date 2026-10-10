import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Eye, Copy, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { VerifiedBadge } from './VerifiedBadge';
import { CommunityTestIds } from '@/lib/test-ids';
import { ProjectThumbnail } from '@/components/projects/ProjectThumbnail';

interface ProjectCardProps {
  project: {
    id: string;
    title: string | null;
    description: string | null;
    keywords: string[] | null;
    updated_at: string;
    thumbnail_url: string | null;
    thumbnail_updated_at?: string | null;
    view_count: number;
    cloned_count: number;
    like_count?: number;
    field_of_study?: string | null;
    user_id: string;
    canvas_width: number;
    canvas_height: number;
    profiles: {
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  onPreview: () => void;
  onLikeChange?: () => void;
  index?: number;
}

export function ProjectCard({ project, onPreview, onLikeChange, index = 0 }: ProjectCardProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(project.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const creatorName = project.profiles?.full_name || 'Anonymous';
  const initials = creatorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const { data: authorVerification } = useQuery({
    queryKey: ['author-verification', project.profiles],
    queryFn: async () => {
      if (!project.profiles) return null;
      const userId = (project as any).user_id;
      if (!userId) return null;

      const { data } = await supabase
        .rpc('get_user_premium_progress', { check_user_id: userId })
        .single();
      return data;
    },
    enabled: !!project.profiles,
  });

  const isVerified = authorVerification?.approved_count >= 3;

  useEffect(() => {
    if (user) {
      checkIfLiked();
    }
  }, [user, project.id]);

  const checkIfLiked = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('project_likes')
      .select('id')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    setIsLiked(!!data);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast.error('Please sign in to like projects');
      return;
    }

    if (isLiking) return;

    setIsLiking(true);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('project_likes')
          .delete()
          .eq('project_id', project.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
        toast.success('Removed from favorites');
      } else {
        const { error } = await supabase
          .from('project_likes')
          .insert({ project_id: project.id, user_id: user.id });

        if (error) throw error;

        setIsLiked(true);
        setLikeCount(prev => prev + 1);
        toast.success('Added to favorites');
      }

      if (onLikeChange) {
        onLikeChange();
      }
    } catch (error: any) {
      console.error('Like error:', error);
      toast.error('Failed to update like status');
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <div
      className={cn(
        "group overflow-hidden bg-card/60 rounded-xl border-2 border-dashed cursor-pointer animate-fade-in transition-all duration-300 hover:shadow-lg relative",
        isVerified
          ? "border-blue-500/30 hover:border-blue-500/50 shadow-sm shadow-blue-500/5"
          : "border-border/60 hover:border-border"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onPreview}
      data-testid={CommunityTestIds.PROJECT_CARD}
    >
      {/* Hover dot overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-0 group-hover:opacity-[0.015] transition-opacity duration-500 pointer-events-none z-[5]"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Thumbnail with avatar overlay */}
      <div className="relative overflow-hidden bg-muted/30 aspect-[3/2]">
        <ProjectThumbnail
          project={project}
          alt={project.title || 'Project thumbnail'}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          autoRegenerate={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Like button on thumbnail */}
        <div className={`absolute top-3 right-3 transition-opacity ${isLiked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            disabled={isLiking}
            className={`rounded-full h-9 w-9 p-0 shadow-lg backdrop-blur-sm transition-all ${isLiked ? 'bg-rose-500/90 hover:bg-rose-600 text-white' : 'bg-black/40 hover:bg-black/60 text-white'}`}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
          </Button>
        </div>

      </div>

      {/* Title & Description */}
      <div className="px-4 py-3 space-y-1">
        <h3 className="font-semibold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
          {project.title || 'Untitled'}
        </h3>
        {project.field_of_study && (
          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 border-dashed">
            {project.field_of_study}
          </Badge>
        )}
        <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
          {project.description || 'No description provided'}
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-around border-t border-dashed border-border/40 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          <span className="font-medium">{project.view_count.toLocaleString()}</span>
        </div>
        <div className="w-px h-3.5 bg-border/60" />
        <div className="flex items-center gap-1">
          <Copy className="h-3.5 w-3.5" />
          <span className="font-medium">{project.cloned_count.toLocaleString()}</span>
        </div>
        <div className="w-px h-3.5 bg-border/60" />
        <div className="flex items-center gap-1">
          <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span className="font-medium">{likeCount.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
