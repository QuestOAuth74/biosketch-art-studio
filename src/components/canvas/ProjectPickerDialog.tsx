import { ProjectThumbnail } from "@/components/projects/ProjectThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogScrollableContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Globe, Loader2, Lock, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CanvasEditorTestIds } from "@/lib/test-ids";

interface Project {
  id: string;
  name: string;
  updated_at: string;
  is_public?: boolean;
  approval_status?: string | null;
  thumbnail_url?: string | null;
  thumbnail_updated_at?: string | null;
  user_id: string;
  canvas_width: number;
  canvas_height: number;
}

interface ProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectSelect: (project: Project) => void;
  currentProjectId?: string | null;
}

export const ProjectPickerDialog = ({
  open,
  onOpenChange,
  onProjectSelect,
  currentProjectId,
}: ProjectPickerDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["user-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("canvas_projects")
        .select(
          "id, name, updated_at, is_public, approval_status, thumbnail_url, thumbnail_updated_at, user_id, canvas_width, canvas_height",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Project[];
    },
    enabled: open && !!user,
  });

  const getStatusBadge = (project: Project) => {
    if (!project.is_public) {
      return (
        <Badge
          variant="secondary"
          className="text-xs"
        >
          <Lock className="h-3 w-3 mr-1" />
          Private
        </Badge>
      );
    }

    if (project.approval_status === "approved") {
      return (
        <Badge
          variant="default"
          className="text-xs bg-green-600"
        >
          <Globe className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    }

    if (project.approval_status === "rejected") {
      return (
        <Badge
          variant="destructive"
          className="text-xs"
        >
          Rejected
        </Badge>
      );
    }

    // Pending or no status yet
    return (
      <Badge
        variant="secondary"
        className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      >
        Pending
      </Badge>
    );
  };

  const handleCreateNew = () => {
    onOpenChange(false);
    navigate("/projects");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-3xl" data-testid={CanvasEditorTestIds.PUBLISH_PROJECT_DIALOG}>
        <DialogHeader>
          <DialogTitle>Publish a Project</DialogTitle>
          <p>Select a project to publish to the community.</p>
        </DialogHeader>

        <DialogScrollableContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {projects.map((project) => {
                const isCurrentProject = currentProjectId === project.id;
                return (
                  <Card
                    key={project.id}
                    className={`cursor-pointer hover:border-primary transition-colors overflow-hidden group ${
                      isCurrentProject ? "border-2 border-blue-500" : ""
                    }`}
                    onClick={() => onProjectSelect(project)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      <ProjectThumbnail
                        project={project}
                        alt={project.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />

                      {/* Current Project Badge - Top Left */}
                      {isCurrentProject && (
                        <div className="absolute top-2 left-2">
                          <Badge className="text-xs bg-blue-500 hover:bg-blue-600">
                            Current project
                          </Badge>
                        </div>
                      )}

                      {/* Status Badge Overlay - Top Right */}
                      <div className="absolute top-2 right-2">
                        {getStatusBadge(project)}
                      </div>
                    </div>

                    {/* Project Info */}
                    <div className="p-3">
                      <h3 className="font-medium text-sm truncate">
                        {project.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">No projects yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create your first project to share with the community
                </p>
              </div>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Project
              </Button>
            </div>
          )}
        </DialogScrollableContent>
      </DialogContent>
    </Dialog>
  );
};
