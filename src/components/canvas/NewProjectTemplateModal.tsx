import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogScrollableContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Users, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CommunityTemplateCard } from "./CommunityTemplateCard";
import { Skeleton } from "@/components/ui/skeleton";


const PROJECTS_PER_PAGE = 8;

interface TemplateProject {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  thumbnail_updated_at?: string | null;
  view_count: number;
  cloned_count: number;
  keywords: string[] | null;
  user_id: string;
  canvas_width: number;
  canvas_height: number;
  updated_at: string;
}

interface NewProjectTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (newProjectId: string) => void;
  onBlankCanvas: () => void;
  userId: string | undefined;
}

export const NewProjectTemplateModal = ({
  open,
  onOpenChange,
  onSelectTemplate,
  onBlankCanvas,
  userId,
}: NewProjectTemplateModalProps) => {
  const [templates, setTemplates] = useState<TemplateProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloning, setIsCloning] = useState(false);
  const [fieldOfStudy, setFieldOfStudy] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isFieldMatch, setIsFieldMatch] = useState(false);
  const [projectPage, setProjectPage] = useState(0);

  // Reset page when modal opens
  useEffect(() => {
    if (open) {
      setProjectPage(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && userId) {
      fetchTemplates();
    }
  }, [open, userId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      let userField: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, field_of_study")
          .eq("id", userId)
          .single();
        userField = profile?.field_of_study || null;
        setFieldOfStudy(userField);
        const firstName = profile?.full_name?.split(" ")[0] || null;
        setUserName(firstName);
      }

      if (userField) {
        const { data: fieldTemplates, error } = await supabase
          .from("canvas_projects")
          .select(
            "id, name, title, description, thumbnail_url, thumbnail_updated_at, view_count, cloned_count, keywords, user_id, canvas_width, canvas_height, updated_at"
          )
          .eq("is_public", true)
          .eq("approval_status", "approved")
          .eq("field_of_study", userField)
          .order("cloned_count", { ascending: false })
          .limit(50);

        if (!error && fieldTemplates && fieldTemplates.length > 0) {
          setTemplates(fieldTemplates);
          setIsFieldMatch(true);
          setIsLoading(false);
          return;
        }
      }

      const { data: recentTemplates, error } = await supabase
        .from("canvas_projects")
        .select(
          "id, name, title, description, thumbnail_url, thumbnail_updated_at, view_count, cloned_count, keywords, user_id, canvas_width, canvas_height, updated_at"
        )
        .eq("is_public", true)
        .eq("approval_status", "approved")
        .order("cloned_count", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTemplates(recentTemplates || []);
      setIsFieldMatch(false);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = async (projectId: string) => {
    setIsCloning(true);
    try {
      const selectedProject = templates.find((p) => p.id === projectId);
      const newProjectName = selectedProject?.name
        ? `Copy of ${selectedProject.name}`
        : "New Project";

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

  const greeting = userName ? `Hello, ${userName}!` : "Hello!";
  const communitySubtitle = isFieldMatch && fieldOfStudy
    ? `Projects in ${fieldOfStudy}`
    : "Popular community projects";

  // Pagination for community projects
  const projectTotalPages = Math.ceil(templates.length / PROJECTS_PER_PAGE);
  const paginatedProjects = templates.slice(
    projectPage * PROJECTS_PER_PAGE,
    (projectPage + 1) * PROJECTS_PER_PAGE
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[85vh] border-0 p-0 overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
          boxShadow: '0 25px 60px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Header */}
        <div className="px-8 pt-7 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">{greeting}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground/80">
              Choose a starting point for your new project.
            </DialogDescription>
          </DialogHeader>

          {/* Blank canvas — primary action */}
          <div className="mt-4">
            <Button
              onClick={handleBlankCanvas}
              disabled={isCloning}
              className="w-full gap-2 h-11 rounded-xl text-sm font-semibold shadow-[0_0_20px_rgba(var(--primary-rgb,99,102,241),0.35)] hover:shadow-[0_0_30px_rgba(var(--primary-rgb,99,102,241),0.5)] transition-all animate-pulse-subtle"
              style={{
                boxShadow: '0 0 20px rgba(99,102,241,0.35), 0 0 60px rgba(99,102,241,0.1)',
              }}
            >
              {isCloning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Start with blank canvas
            </Button>
          </div>
        </div>

        <DialogScrollableContent>
          <div className="px-8 pb-6 min-h-[420px]">
            {/* Community projects */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-foreground">{communitySubtitle}</h3>
                </div>
                {projectTotalPages > 1 && (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md"
                      onClick={() => setProjectPage(p => Math.max(0, p - 1))}
                      disabled={projectPage === 0}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[11px] text-muted-foreground/70 min-w-[2.5rem] text-center tabular-nums">
                      {projectPage + 1} / {projectTotalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md"
                      onClick={() => setProjectPage(p => Math.min(projectTotalPages - 1, p + 1))}
                      disabled={projectPage >= projectTotalPages - 1}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Array.from({ length: PROJECTS_PER_PAGE }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                      <Skeleton className="h-3 w-2/3 rounded" />
                    </div>
                  ))}
                </div>
              ) : templates.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {paginatedProjects.map((project) => (
                    <CommunityTemplateCard
                      key={project.id}
                      project={project}
                      onClick={() => handleTemplateSelect(project.id)}
                      disabled={isCloning}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border/50 bg-muted/30">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground/60">
                    No community projects yet.
                  </p>
                </div>
              )}
            </div>

          </div>
        </DialogScrollableContent>

        {/* Divider line at bottom */}
        <div className="px-8 py-3 border-t border-border/30" />
      </DialogContent>
    </Dialog>
  );
};
