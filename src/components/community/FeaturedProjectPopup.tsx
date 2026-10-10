import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Copy, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProjectThumbnail } from "@/components/projects/ProjectThumbnail";

interface CommunityProject {
  id: string;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  thumbnail_url: string | null;
  thumbnail_updated_at: string | null;
  view_count: number;
  cloned_count: number;
  canvas_width: number;
  canvas_height: number;
  paper_size: string;
  updated_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface FeaturedProjectPopupProps {
  onViewProject: (project: CommunityProject) => void;
}

export function FeaturedProjectPopup({ onViewProject }: FeaturedProjectPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [project, setProject] = useState<CommunityProject | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadFeaturedProject = async () => {
      try {
        setLoading(true);
        // Optimized: exclude canvas_data for popup preview (reduces query from 1-3MB to ~15KB)
        const { data: projects, error } = await supabase
          .from('canvas_projects')
          .select(`
            id,
            title,
            description,
            keywords,
            thumbnail_url,
            thumbnail_updated_at,
            view_count,
            cloned_count,
            canvas_width,
            canvas_height,
            paper_size,
            updated_at,
            user_id
          `)
          .eq('is_public', true)
          .eq('approval_status', 'approved')
          .not('thumbnail_url', 'is', null)
          .limit(100);

        if (error) {
          console.error('Error fetching projects:', error);
          throw error;
        }
        
        if (projects && projects.length > 0) {
          // Select random project from results
          const randomProjectData = projects[Math.floor(Math.random() * projects.length)];
          
          // Fetch creator profile separately with error handling
          const { data: profile, error: profileError } = await supabase
            .from('public_profiles')
            .select('full_name, avatar_url')
            .eq('id', randomProjectData.user_id)
            .single();

          if (profileError) {
            console.warn('Could not fetch profile:', profileError);
            // Continue anyway with null profile
          }

          const projectData = {
            ...randomProjectData,
            profiles: profile || null,
          };
          setProject(projectData);
          setIsOpen(true);
        } else {
        }
      } catch (error) {
        console.error('Error loading featured project:', error);
        // Don't show popup if there's an error
      } finally {
        setLoading(false);
      }
    };

    // Check if popup was already shown today
    const lastDismissed = localStorage.getItem('biosketch_featured_popup_dismissed');
    const shouldShow = !lastDismissed || 
      (Date.now() - new Date(lastDismissed).getTime() > 24 * 60 * 60 * 1000);

    if (shouldShow) {
      const timer = setTimeout(() => {
        loadFeaturedProject();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('biosketch_featured_popup_dismissed', new Date().toISOString());
  };

  const handleViewProject = () => {
    if (project) {
      handleClose();
      onViewProject(project);
    }
  };

  if (!project || loading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl border-[3px] border-foreground bg-background grid-background neo-shadow-xl relative overflow-hidden stable-dialog">
        <DialogHeader className="space-y-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <Badge 
              variant="secondary" 
              className="text-xs font-medium tracking-wide uppercase bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
            >
              Featured Illustration
            </Badge>
          </div>
          <DialogTitle className="text-3xl font-semibold tracking-tight text-foreground leading-tight">
            {project.title || 'Untitled Project'}
          </DialogTitle>
          {project.description && (
            <DialogDescription className="text-base leading-relaxed text-muted-foreground/80">
              {project.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Thumbnail - Full Canvas View */}
          <div className="relative w-full rounded-lg overflow-hidden shadow-xl ring-1 ring-border/20 bg-muted/30 flex items-center justify-center max-h-[50vh]">
            <ProjectThumbnail
              project={project}
              alt={project.title || 'Project thumbnail'}
              className="max-w-full max-h-[50vh] w-auto h-auto object-contain"
            />
          </div>

          {/* Creator & Stats */}
          <div className="flex items-center justify-between pt-2 pb-1 border-t border-border/30">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-medium text-sm border border-primary/20">
                {project.profiles?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">Created by</span>
                <span className="font-medium text-foreground text-sm">
                  {project.profiles?.full_name || 'Anonymous'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-5 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 opacity-60" />
                <span className="font-medium">{project.view_count}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Copy className="h-4 w-4 opacity-60" />
                <span className="font-medium">{project.cloned_count}</span>
              </div>
            </div>
          </div>

          {/* Keywords */}
          {project.keywords && project.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {project.keywords.slice(0, 5).map((keyword, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs font-normal bg-muted/40 hover:bg-muted/60 border-border/30 transition-colors"
                >
                  {keyword}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-2 border-t border-border/30">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-border/40 hover:bg-muted/50 transition-colors"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleViewProject}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            View Full Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
