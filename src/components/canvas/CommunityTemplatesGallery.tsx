import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Sparkles, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CommunityTemplateCard } from "./CommunityTemplateCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CommunityProject {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  view_count: number;
  cloned_count: number;
  like_count: number;
  keywords: string[] | null;
  user_id: string;
}

interface CommunityTemplatesGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (projectId: string) => void;
  onBlankCanvas: () => void;
}

type SortOption = "popular" | "recent" | "cloned";

export const CommunityTemplatesGallery = ({
  open,
  onOpenChange,
  onSelectTemplate,
  onBlankCanvas,
}: CommunityTemplatesGalleryProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open, sortBy]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("canvas_projects")
        .select(
          `
          id,
          name,
          title,
          description,
          thumbnail_url,
          thumbnail_updated_at,
          view_count,
          cloned_count,
          like_count,
          keywords,
          user_id,
          canvas_width,
          canvas_height,
          updated_at
        `
        )
        .eq("is_public", true)
        .eq("approval_status", "approved");

      // Apply sorting
      switch (sortBy) {
        case "popular":
          query = query.order("view_count", { ascending: false });
          break;
        case "recent":
          query = query.order("created_at", { ascending: false });
          break;
        case "cloned":
          query = query.order("cloned_count", { ascending: false });
          break;
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching community templates:", error);
      toast.error("Failed to load community templates");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.title?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.keywords?.some((k) => k.toLowerCase().includes(query))
    );
  }, [projects, searchQuery]);

  const handleTemplateSelect = async (projectId: string) => {
    setIsCloning(true);
    try {
      const selectedProject = projects.find((p) => p.id === projectId);
      const newProjectName = selectedProject?.name
        ? `Copy of ${selectedProject.name}`
        : "Cloned Project";

      const { data, error } = await supabase.rpc("clone_project", {
        source_project_id: projectId,
        new_project_name: newProjectName,
      });

      if (error) throw error;

      toast.success("Template cloned successfully!");
      onSelectTemplate(data);
      onOpenChange(false);
    } catch (error) {
      console.error("Error cloning template:", error);
      toast.error("Failed to clone template");
    } finally {
      setIsCloning(false);
    }
  };

  const handleBlankCanvas = () => {
    onBlankCanvas();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl">Browse Community Templates</DialogTitle>
          </div>
          <DialogDescription>
            Start with a community-created template or build from scratch
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="cloned">Most Cloned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-6">
          <div className="py-4">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <CommunityTemplateCard
                    key={project.id}
                    project={project}
                    onClick={() => handleTemplateSelect(project.id)}
                    disabled={isCloning}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No templates found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Try adjusting your search or sorting
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCloning}>
            Cancel
          </Button>
          <Button onClick={handleBlankCanvas} className="gap-2" disabled={isCloning}>
            {isCloning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Start with Blank Canvas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
