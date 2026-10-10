import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Copy, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  user_id: string;
  canvas_width: number;
  canvas_height: number;
  updated_at: string;
  profiles: {
    full_name: string | null;
  } | null;
}

export function FeaturedProjectShowcase() {
  const [project, setProject] = useState<CommunityProject | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadFeaturedProject = async () => {
      try {
        const { data: projects, error } = await supabase
          .from('canvas_projects')
          .select('id, title, description, keywords, thumbnail_url, thumbnail_updated_at, view_count, cloned_count, user_id, canvas_width, canvas_height, updated_at')
          .eq('is_public', true)
          .eq('approval_status', 'approved')
          .not('thumbnail_url', 'is', null)
          .limit(100);

        if (error) throw error;
        
        if (projects && projects.length > 0) {
          const randomProjectData = projects[Math.floor(Math.random() * projects.length)];
          
          const { data: profile } = await supabase
            .from('public_profiles')
            .select('full_name')
            .eq('id', randomProjectData.user_id)
            .single();

          setProject({
            ...randomProjectData,
            profiles: profile || null,
          });
        }
      } catch (error) {
        console.error('Error loading featured project:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedProject();
  }, []);

  if (loading || !project) return null;

  return (
    <Card className="w-full h-full paper-shadow border-2 border-[hsl(var(--pencil-gray))] bg-[hsl(var(--cream))] overflow-hidden -rotate-1 hover:rotate-0 transition-transform duration-300">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--ink-blue))] animate-pulse" />
          <Badge 
            variant="secondary" 
            className="text-xs font-medium tracking-wide uppercase bg-[hsl(var(--highlighter-yellow))]/30 text-[hsl(var(--ink-blue))] border-2 border-[hsl(var(--pencil-gray))] font-source-serif"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Featured Project
          </Badge>
        </div>

        <h3 className="text-2xl font-bold mb-2 text-[hsl(var(--ink-blue))] line-clamp-2 handwritten">
          {project.title || 'Untitled Project'}
        </h3>

        {project.description && (
          <p className="text-sm text-[hsl(var(--pencil-gray))] mb-4 line-clamp-3 font-source-serif">
            {project.description}
          </p>
        )}

        {/* Thumbnail - polaroid style */}
        <div className="relative aspect-video w-full rounded-lg overflow-hidden paper-shadow border-2 border-[hsl(var(--pencil-gray))] bg-white mb-4 flex-shrink-0 p-2 rotate-1">
          <div className="w-full h-full rounded border border-[hsl(var(--pencil-gray))]/30">
            <ProjectThumbnail
              project={project}
              alt={project.title || 'Project thumbnail'}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Keywords */}
        {project.keywords && project.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {project.keywords.slice(0, 4).map((keyword, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs font-normal bg-[hsl(var(--highlighter-yellow))]/20 border border-[hsl(var(--pencil-gray))] font-source-serif"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-4">
          {/* Creator & Stats */}
          <div className="flex items-center justify-between pt-3 border-t-2 border-dashed border-[hsl(var(--pencil-gray))]">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--highlighter-yellow))]/30 flex items-center justify-center text-[hsl(var(--ink-blue))] font-medium text-xs border-2 border-[hsl(var(--pencil-gray))] handwritten">
                {project.profiles?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-[hsl(var(--pencil-gray))]/70 uppercase tracking-wider font-source-serif">By</span>
                <span className="font-medium text-[hsl(var(--ink-blue))] text-sm font-source-serif">
                  {project.profiles?.full_name || 'Anonymous'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-[hsl(var(--pencil-gray))]">
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 opacity-60" />
                <span className="font-medium font-source-serif">{project.view_count}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Copy className="h-4 w-4 opacity-60" />
                <span className="font-medium font-source-serif">{project.cloned_count}</span>
              </div>
            </div>
          </div>

          <Button
            variant="pencil"
            className="w-full group"
            onClick={() => navigate('/community')}
          >
            Explore Community
            <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
