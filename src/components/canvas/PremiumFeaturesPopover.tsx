import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CanvasEditorTestIds } from "@/lib/test-ids";
import { FilePptIcon, ShareIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ClockAlert, Lock, Sparkles } from "lucide-react";
import { ReactNode } from "react";

interface PremiumFeaturesPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShareClick: () => void;
  children: ReactNode;
  featureType: "ai-icon" | "powerpoint";
  side?: "top" | "right" | "bottom" | "left";
}

export const PremiumFeaturesPopover = ({
  open,
  onOpenChange,
  onShareClick,
  children,
  featureType,
  side = "bottom",
}: PremiumFeaturesPopoverProps) => {
  const { user } = useAuth();

  // Count all public projects (regardless of approval status)
  const { data: publicProjectCount = 0 } = useQuery({
    queryKey: ["public-project-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from("canvas_projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_public", true);

      if (error) throw error;
      return count || 0;
    },
    enabled: open && !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Check if user has any pending projects
  const { data: hasPendingProjects } = useQuery({
    queryKey: ["pending-projects", user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from("canvas_projects")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_public", true)
        .eq("approval_status", "pending")
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    },
    enabled: open && !!user,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80"
        align="end"
        side={side}
        data-testid={CanvasEditorTestIds.PREMIUM_POPOVER}
      >
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h3 className="font-semibold text-base mb-2">Premium feature</h3>
          </div>

          {/* Feature Card - Full Width */}
          {featureType === "ai-icon" ? (
            <Card className="relative p-3 border-2 border-dashed border-primary bg-muted/20">
              <Lock
                className="absolute -top-3 -right-3 h-8 w-8 text-primary bg-white rounded-full p-1 z-10"
                strokeWidth={2}
              />
              <div className="flex items-start gap-3">
                <Sparkles
                  className="h-8 w-8 text-primary flex-shrink-0"
                  strokeWidth={2}
                />
                <div className="flex-1">
                  <h4 className="font-medium text-base">AI Icon Generator</h4>
                  <p className="text-sm font-medium leading-tight mt-1">
                    Generate custom scientific icons with AI
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="relative p-3 border-2 border-dashed border-primary bg-muted/20">
              <Lock
                className="absolute -top-3 -right-3 h-8 w-8 text-primary bg-white rounded-full p-1 z-10"
                strokeWidth={2}
              />
              <div className="flex items-start gap-3">
                <FilePptIcon
                  size={32}
                  weight="bold"
                  className="text-primary flex-shrink-0"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-base">PowerPoint Maker</h4>
                  <p className="text-sm font-medium leading-tight mt-1">
                    Convert Word documents to PowerPoint
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Unlock Instructions */}
          <div className="bg-primary/10 rounded-md p-3">
            <p className="text-sm text-center font-medium">
              Publish 3 projects to unlock
            </p>
          </div>

          {/* Progress Section */}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm" data-testid={CanvasEditorTestIds.PREMIUM_PROGRESS_TEXT}>
                <div className="flex items-center">
                  <span className="font-semibold text-primary">
                    Published Projects
                  </span>
                  {hasPendingProjects && (
                    <>
                      <ClockAlert className="size-4 ml-2 mr-0.5 text-gray-900" />
                      <span className="italic text-gray-600">
                        Pending approval
                      </span>
                    </>
                  )}
                </div>
                <span className="font-medium text-primary">
                  {publicProjectCount}/3
                </span>
              </div>
              <Progress
                value={(publicProjectCount / 3) * 100}
                className="h-3 bg-primary/5 border-2 border-primary [&>div]:bg-primary"
                data-testid={CanvasEditorTestIds.PREMIUM_PROGRESS_BAR}
              />
            </div>

            {/* Pending status badge */}
          </div>

          {/* Share Button */}
          <Button
            onClick={onShareClick}
            className="w-full flex items-center justify-center gap-2"
            size="sm"
            data-testid={CanvasEditorTestIds.PREMIUM_SHARE_BUTTON}
          >
            Publish a Project
            <ShareIcon
              size={16}
              weight="bold"
            />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
