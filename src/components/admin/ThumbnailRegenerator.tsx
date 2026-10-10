import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { generateProjectThumbnail } from "@/lib/thumbnailGenerator";
import { batchRegenerateThumbnails } from "@/lib/thumbnailUtils";

interface ProjectStats {
  total: number;
  withThumbnails: number;
  withoutThumbnails: number;
}

export const ThumbnailRegenerator = () => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [stats, setStats] = useState<ProjectStats>({
    total: 0,
    withThumbnails: 0,
    withoutThumbnails: 0,
  });
  const [progress, setProgress] = useState(0);
  const [currentProject, setCurrentProject] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      // Get total public projects
      const { count: totalCount } = await supabase
        .from('canvas_projects')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true);

      // Get projects with thumbnails
      const { count: withThumbnailsCount } = await supabase
        .from('canvas_projects')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .not('thumbnail_url', 'is', null);

      setStats({
        total: totalCount || 0,
        withThumbnails: withThumbnailsCount || 0,
        withoutThumbnails: (totalCount || 0) - (withThumbnailsCount || 0),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load statistics');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleRegenerateThumbnails = async () => {
    setIsRegenerating(true);
    setProgress(0);
    setResult(null);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('You must be logged in');
        return;
      }

      // Fetch all public projects missing thumbnails
      const { data: projects, error } = await supabase
        .from('canvas_projects')
        .select('id, canvas_data, canvas_width, canvas_height, user_id')
        .eq('is_public', true)
        .is('thumbnail_url', null);

      if (error) throw error;

      if (!projects || projects.length === 0) {
        toast.info('No projects need thumbnail generation');
        setIsRegenerating(false);
        return;
      }

      setTotalProjects(projects.length);

      // Use batch regeneration utility with progress tracking
      const result = await batchRegenerateThumbnails(
        projects,
        (current, total) => {
          setCurrentProject(current);
          setProgress((current / total) * 100);
        }
      );

      setResult(result);
      toast.success(`Generated ${result.success} thumbnails`);
      
      // Reload stats
      await loadStats();
    } catch (error) {
      console.error('Error regenerating thumbnails:', error);
      toast.error('Failed to regenerate thumbnails');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImagePlus className="h-5 w-5" />
              Project Thumbnail Regenerator
            </CardTitle>
            <CardDescription>
              Generate thumbnails for existing public projects that don't have them
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={loadStats}
            disabled={loadingStats || isRegenerating}
          >
            <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRegenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Generating thumbnails...</span>
              <span>{currentProject} / {totalProjects}</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {result && (
          <Alert>
            <AlertDescription>
              <strong>Batch Complete:</strong> {result.success} thumbnails generated successfully
              {result.failed > 0 && `, ${result.failed} failed`}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Public Projects</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold text-green-600">{stats.withThumbnails}</div>
            <div className="text-sm text-muted-foreground">With Thumbnails</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.withoutThumbnails}</div>
            <div className="text-sm text-muted-foreground">Missing Thumbnails</div>
          </div>
        </div>

        <Button
          onClick={handleRegenerateThumbnails}
          disabled={isRegenerating || stats.withoutThumbnails === 0 || loadingStats}
          className="w-full"
        >
          {isRegenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Generating {currentProject} / {totalProjects}
            </>
          ) : (
            <>
              <ImagePlus className="mr-2 h-4 w-4" />
              Generate Missing Thumbnails ({stats.withoutThumbnails})
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          This will process all public projects that don't have thumbnails. Projects with corrupt canvas data will be skipped.
        </p>
      </CardContent>
    </Card>
  );
};
