import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ProjectCard } from "./ProjectCard";
import { ProjectPreviewModal } from "./ProjectPreviewModal";

interface Project {
  id: string;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  updated_at: string;
  thumbnail_url: string | null;
  view_count: number;
  cloned_count: number;
  canvas_width: number;
  canvas_height: number;
  paper_size: string | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  like_count?: number;
}

export const CommunityCarousel = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      // Fetch projects
      const { data: projectsData, error } = await supabase
        .from("canvas_projects")
        .select("*")
        .eq("is_public", true)
        .eq("approval_status", "approved")
        .order("updated_at", { ascending: false })
        .limit(3);

      if (error) throw error;

      if (projectsData) {
        // Fetch like counts
        const { data: likesData } = await supabase
          .from("project_likes")
          .select("project_id");

        const likesMap = new Map<string, number>();
        likesData?.forEach((like) => {
          likesMap.set(like.project_id, (likesMap.get(like.project_id) || 0) + 1);
        });

        // Fetch profiles
        const userIds = [...new Set(projectsData.map((p) => p.user_id))];
        const { data: profilesData } = await supabase
          .from("public_profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

        const projectsWithData = projectsData.map((project) => ({
          ...project,
          profiles: profilesMap.get(project.user_id) || null,
          like_count: likesMap.get(project.id) || 0,
        }));

        setProjects(projectsWithData);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (project: Project) => {
    setSelectedProject(project);
    setIsPreviewOpen(true);
  };

  const handleLikeChange = () => {
    // Refresh projects to get updated like count
    loadProjects();
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          See what others are creating
        </h2>
        <p className="text-muted-foreground text-lg">
          Explore templates from the community
        </p>
      </div>

      <Carousel
        plugins={[
          Autoplay({
            delay: 4000,
            stopOnInteraction: true,
          }),
        ]}
        opts={{
          loop: true,
          align: "start",
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {projects.map((project) => (
            <CarouselItem
              key={project.id}
              className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3"
            >
              <ProjectCard
                project={project}
                onPreview={() => handlePreview(project)}
                onLikeChange={handleLikeChange}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>

      <div className="text-center">
        <Button
          onClick={() => navigate("/community")}
          size="lg"
          className="group"
        >
          View More Templates
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>

      {selectedProject && (
        <ProjectPreviewModal
          project={selectedProject}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setSelectedProject(null);
          }}
        />
      )}
    </div>
  );
};
