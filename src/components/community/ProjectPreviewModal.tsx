import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Eye, Copy, Loader2, Maximize2, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { ProjectThumbnail } from '@/components/projects/ProjectThumbnail';
import { ProjectComments } from './ProjectComments';

interface ProjectPreviewModalProps {
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
    canvas_width: number;
    canvas_height: number;
    paper_size: string;
    user_id: string;
    profiles: {
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectPreviewModal({ project, isOpen, onClose }: ProjectPreviewModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    if (isOpen && project) {
      supabase.rpc('increment_project_view_count', {
        project_id_param: project.id
      }).then(({ error }) => {
        if (error) console.error('Failed to increment view count:', error);
      });
    }
  }, [isOpen, project?.id]);

  if (!project || !isOpen) return null;

  const creatorName = project.profiles?.full_name || 'Anonymous';
  const initials = creatorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleCloneProject = async () => {
    if (!user) {
      toast.error('Sign in to use this template', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }
    setCloning(true);
    try {
      const { data, error } = await supabase.rpc('clone_project', {
        source_project_id: project.id,
        new_project_name: `Copy of ${project.title || project.id}`
      });

      if (error) throw error;

      toast.success('Project cloned to your workspace!');
      onClose();
      navigate(`/canvas/${data}`);
    } catch (error: any) {
      console.error('Error cloning project:', error);
      toast.error(error.message || 'Failed to clone project');
    } finally {
      setCloning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[94vh] overflow-hidden stable-dialog p-0 gap-0 bg-background border-0 shadow-2xl rounded-2xl">
        <div className="flex flex-col lg:flex-row max-h-[94vh]">
          {/* ─── Left column: Image + Action button ──────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col bg-gradient-to-b from-muted/10 via-background to-muted/5 border-b lg:border-b-0 lg:border-r border-border/30">
            {/* Preview area */}
            <div className="relative flex-1 min-h-[300px] flex items-center justify-center overflow-hidden p-6 lg:p-8">
              {/* Subtle radial spotlight */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(circle at 50% 35%, rgba(139,92,246,0.06) 0%, transparent 60%)" }}
              />
              <ProjectThumbnail
                project={project}
                alt={project.title || 'Project preview'}
                className="relative max-w-full max-h-[55vh] lg:max-h-[72vh] w-auto h-auto object-contain rounded-xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.25)] ring-1 ring-border/40"
                autoRegenerate={false}
              />
            </div>

            {/* Action bar pinned below the image */}
            <div className="px-6 lg:px-8 pb-6 pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Button
                onClick={handleCloneProject}
                disabled={cloning}
                className="flex-1 h-11 rounded-xl font-medium text-sm shadow-md"
                size="lg"
              >
                {cloning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cloning…
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Use This Template
                  </>
                )}
              </Button>
              <div className="flex items-center justify-center gap-3 sm:gap-4 px-3 sm:px-4 h-11 rounded-xl bg-muted/40 border border-border/40">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Views">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{project.view_count.toLocaleString()}</span>
                </span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Uses">
                  <Copy className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{project.cloned_count.toLocaleString()}</span>
                </span>
              </div>
            </div>
          </div>

          {/* ─── Right column: Details + Comments ──────────────────────── */}
          <div className="w-full lg:w-[400px] flex flex-col bg-background overflow-y-auto">
            <div className="p-6 space-y-5">
              {/* Title & Description */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                  {project.title || 'Untitled Project'}
                </h2>
                {project.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {project.description}
                  </p>
                )}
              </div>

              {/* Creator */}
              <button
                onClick={() => { onClose(); navigate(`/author/${project.user_id}`); }}
                className="w-full flex items-center gap-3 hover:bg-muted/40 rounded-xl p-2 -m-2 transition-colors group"
              >
                <Avatar className="h-9 w-9 ring-2 ring-primary/10">
                  <AvatarImage src={project.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-medium">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Created by</p>
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{creatorName}</p>
                </div>
              </button>

              {/* Keywords */}
              {project.keywords && project.keywords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {project.keywords.map((keyword, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-muted/50 hover:bg-muted text-muted-foreground text-xs px-2.5 py-0.5 rounded-full font-normal"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Project Details */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">Details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                    <Maximize2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">Canvas</p>
                      <p className="text-xs font-medium truncate">{project.canvas_width} × {project.canvas_height}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                    <Ruler className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">Paper</p>
                      <p className="text-xs font-medium truncate">{project.paper_size}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments */}
              <ProjectComments projectId={project.id} projectOwnerId={project.user_id} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
