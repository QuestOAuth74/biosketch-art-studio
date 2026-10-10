import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Copy } from "lucide-react";
import { ProjectThumbnail } from "@/components/projects/ProjectThumbnail";

interface CommunityTemplateCardProps {
  project: {
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
  };
  onClick: () => void;
  disabled?: boolean;
}

export const CommunityTemplateCard = ({
  project,
  onClick,
  disabled = false,
}: CommunityTemplateCardProps) => {
  const displayName = project.title || project.name;
  const creatorInitial = displayName.charAt(0).toUpperCase();

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] overflow-hidden"
      onClick={onClick}
      style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        <ProjectThumbnail
          project={project}
          alt={displayName}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          autoRegenerate={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-medium">
            Use Template
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm line-clamp-1 mb-1">{displayName}</h3>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">{creatorInitial}</span>
          </div>
          <span className="text-xs text-muted-foreground truncate">Community Template</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{project.view_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <Copy className="h-3 w-3" />
            <span>{project.cloned_count}</span>
          </div>
        </div>

        {project.keywords && project.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.keywords.slice(0, 3).map((keyword, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-2 py-0">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
