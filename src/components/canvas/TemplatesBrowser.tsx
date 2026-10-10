import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectThumbnail } from "@/components/projects/ProjectThumbnail";
import {
  Search,
  Globe,
  FolderOpen,
  Paintbrush,
  Replace,
  Layers,
  Eye,
  Copy,
  FileText,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplatesBrowserTestIds } from "@/lib/test-ids";

interface ProjectItem {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  thumbnail_updated_at?: string | null;
  view_count: number;
  cloned_count: number;
  like_count: number;
  keywords: string[] | null;
  user_id: string;
  canvas_width: number;
  canvas_height: number;
  updated_at: string;
  is_public?: boolean;
}

const TEMPLATE_FIELDS =
  "id, name, title, description, thumbnail_url, thumbnail_updated_at, view_count, cloned_count, like_count, keywords, user_id, canvas_width, canvas_height, updated_at";

type SortOption = "popular" | "recent" | "cloned";
type SubTab = "community" | "brushes" | "my-projects";

interface TemplatesBrowserProps {
  onImport: (projectId: string, mode: "replace" | "overlay") => Promise<void>;
}

export const TemplatesBrowser = ({ onImport }: TemplatesBrowserProps) => {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("community");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  const sortColumn = sortBy === "recent" ? "created_at" : sortBy === "cloned" ? "cloned_count" : "view_count";

  // Community templates — cached 5 min
  const { data: communityProjects = [], isLoading: communityLoading } = useQuery({
    queryKey: ["templates", "community", sortBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canvas_projects")
        .select(TEMPLATE_FIELDS)
        .eq("is_public", true)
        .eq("approval_status", "approved")
        .neq("is_brush", true)
        .order(sortColumn, { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ProjectItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Brush templates — cached 5 min
  const { data: brushProjects = [], isLoading: brushesLoading } = useQuery({
    queryKey: ["templates", "brushes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canvas_projects")
        .select(TEMPLATE_FIELDS)
        .eq("is_public", true)
        .eq("approval_status", "approved")
        .eq("is_brush", true)
        .order("name", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data || []) as ProjectItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // My projects — cached 2 min
  const { data: myProjects = [], isLoading: myLoading } = useQuery({
    queryKey: ["templates", "my-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("canvas_projects")
        .select(TEMPLATE_FIELDS + ", is_public")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectItem[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const projects =
    subTab === "community"
      ? communityProjects
      : subTab === "brushes"
        ? brushProjects
        : myProjects;

  const isLoading =
    subTab === "community"
      ? communityLoading
      : subTab === "brushes"
        ? brushesLoading
        : myLoading;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  const handleImport = async (projectId: string, mode: "replace" | "overlay") => {
    setImportingId(projectId);
    setOpenPopoverId(null);
    try {
      await onImport(projectId, mode);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white" data-testid={TemplatesBrowserTestIds.PANEL}>
      {/* Sub-tab toggle */}
      <div className="flex border-b border-border/40 px-2 pt-2">
        <button
          data-testid={TemplatesBrowserTestIds.COMMUNITY_TAB}
          onClick={() => setSubTab("community")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-t-md transition-colors",
            subTab === "community"
              ? "bg-white text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Globe className="h-3 w-3" />
          Community
        </button>
        <button
          data-testid={TemplatesBrowserTestIds.BRUSHES_TAB}
          onClick={() => setSubTab("brushes")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-t-md transition-colors",
            subTab === "brushes"
              ? "bg-white text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Paintbrush className="h-3 w-3" />
          Brushes
        </button>
        <button
          data-testid={TemplatesBrowserTestIds.MY_PROJECTS_TAB}
          onClick={() => setSubTab("my-projects")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-t-md transition-colors",
            subTab === "my-projects"
              ? "bg-white text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FolderOpen className="h-3 w-3" />
          My Projects
        </button>
      </div>

      {/* Search + Sort */}
      <div className="px-2 py-2 space-y-1.5 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            data-testid={TemplatesBrowserTestIds.SEARCH_INPUT}
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        {subTab === "community" && (
          <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
            <SelectTrigger data-testid={TemplatesBrowserTestIds.SORT_SELECT} className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="cloned">Most Cloned</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Project grid */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2" data-testid={TemplatesBrowserTestIds.LOADING_SKELETON}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="aspect-video w-full rounded" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((project) => {
                const displayName = project.title || project.name;
                const isImporting = importingId === project.id;

                return (
                  <Popover
                    key={project.id}
                    open={openPopoverId === project.id}
                    onOpenChange={(open) =>
                      setOpenPopoverId(open ? project.id : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <div
                        data-testid={TemplatesBrowserTestIds.PROJECT_CARD}
                        className={cn(
                          "group cursor-pointer rounded-md border border-border/40 overflow-hidden transition-all hover:border-primary/50 hover:shadow-sm",
                          isImporting && "opacity-50 pointer-events-none"
                        )}
                      >
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <ProjectThumbnail
                            project={project}
                            alt={displayName}
                            className="w-full h-full object-cover"
                            autoRegenerate={false}
                          />
                          {isImporting && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Loader2 className="h-4 w-4 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        <div className="px-1.5 py-1">
                          <p className="text-[10px] font-medium leading-tight line-clamp-2">
                            {displayName}
                          </p>
                          {subTab !== "brushes" && (
                            <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                              <span className="flex items-center gap-0.5">
                                <Eye className="h-2.5 w-2.5" />
                                {project.view_count}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Copy className="h-2.5 w-2.5" />
                                {project.cloned_count}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      side="right"
                      align="start"
                      className="w-44 p-1.5"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-medium px-1 pb-1 border-b truncate">
                          {displayName}
                        </p>
                        <button
                          data-testid={TemplatesBrowserTestIds.REPLACE_BUTTON}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
                          onClick={() => handleImport(project.id, "replace")}
                        >
                          <Replace className="h-3.5 w-3.5" />
                          Replace Canvas
                        </button>
                        <button
                          data-testid={TemplatesBrowserTestIds.ADD_TO_CANVAS_BUTTON}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
                          onClick={() => handleImport(project.id, "overlay")}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Add to Canvas
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center" data-testid={TemplatesBrowserTestIds.EMPTY_STATE}>
              <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                {subTab === "community"
                  ? "No community templates found"
                  : subTab === "brushes"
                    ? "No brushes available"
                    : "No projects yet"}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
