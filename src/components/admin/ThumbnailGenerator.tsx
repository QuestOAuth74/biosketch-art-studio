import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageDown, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface IconStats {
  total: number;
  withThumbnails: number;
  withoutThumbnails: number;
}

export const ThumbnailGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ processed: number; failed: number; total: number } | null>(null);
  const [stats, setStats] = useState<IconStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      // Get total count
      const { count: totalCount, error: totalError } = await supabase
        .from('icons')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Get count with valid thumbnails (not null AND not empty)
      const { count: withThumbnailsCount, error: withThumbnailsError } = await supabase
        .from('icons')
        .select('*', { count: 'exact', head: true })
        .not('thumbnail', 'is', null)
        .neq('thumbnail', '');

      if (withThumbnailsError) throw withThumbnailsError;

      setStats({
        total: totalCount || 0,
        withThumbnails: withThumbnailsCount || 0,
        withoutThumbnails: (totalCount || 0) - (withThumbnailsCount || 0)
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error("Failed to load thumbnail statistics");
    } finally {
      setLoadingStats(false);
    }
  };

  const handleGenerateThumbnails = async () => {
    setIsGenerating(true);
    setResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("You must be logged in");
        return;
      }

      toast.info("Generating thumbnails... Processing up to 50 icons.");

      const { data, error } = await supabase.functions.invoke('generate-thumbnails', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error(`Failed to generate thumbnails: ${error.message}`);
        return;
      }

      setResult(data);
      
      // Reload stats after processing
      await loadStats();
      
      if (data.processed > 0) {
        toast.success(`Successfully generated ${data.processed} thumbnails!`);
        
        // If there are more to process, suggest running again
        if (data.total === 50 && data.failed === 0) {
          toast.info("Click again to process the next batch.");
        }
        
        // Notify icon library to refresh
        window.dispatchEvent(new Event('thumbnailsGenerated'));
      } else {
        toast.info("All icons already have thumbnails");
      }
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      toast.error("Failed to generate thumbnails");
    } finally {
      setIsGenerating(false);
    }
  };

  const progressPercentage = stats ? (stats.withThumbnails / stats.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Thumbnail Generation</CardTitle>
            <CardDescription>
              Optimize icons for faster loading with lightweight thumbnails (~5-10KB)
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadStats}
            disabled={loadingStats}
            title="Refresh statistics"
          >
            <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Processing Progress</span>
            <span className="text-muted-foreground">
              {loadingStats ? (
                <Loader2 className="h-3 w-3 animate-spin inline" />
              ) : stats ? (
                `${stats.withThumbnails} / ${stats.total} icons`
              ) : (
                '—'
              )}
            </span>
          </div>
          
          <Progress value={progressPercentage} className="h-2" />
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-muted rounded p-2 text-center">
              <div className="font-semibold text-lg">{stats?.total || 0}</div>
              <div className="text-muted-foreground">Total Icons</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-center">
              <div className="font-semibold text-lg text-green-600 dark:text-green-400">
                {stats?.withThumbnails || 0}
              </div>
              <div className="text-muted-foreground">Processed</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2 text-center">
              <div className="font-semibold text-lg text-orange-600 dark:text-orange-400">
                {stats?.withoutThumbnails || 0}
              </div>
              <div className="text-muted-foreground">Remaining</div>
            </div>
          </div>
        </div>

        {/* Last Run Result */}
        {result && (
          <Alert>
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <p><strong>Last batch:</strong> {result.processed} generated, {result.failed} failed</p>
                {result.total === 50 && result.failed === 0 && stats && stats.withoutThumbnails > 0 && (
                  <p className="text-muted-foreground">
                    {stats.withoutThumbnails} more icons remaining. Click to continue.
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Action Button */}
        <Button 
          onClick={handleGenerateThumbnails} 
          className="w-full" 
          disabled={isGenerating || loadingStats || (stats?.withoutThumbnails === 0)}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing Batch...
            </>
          ) : stats?.withoutThumbnails === 0 ? (
            <>
              <ImageDown className="h-4 w-4 mr-2" />
              All Icons Processed
            </>
          ) : (
            <>
              <ImageDown className="h-4 w-4 mr-2" />
              Process {Math.min(50, stats?.withoutThumbnails || 0)} Icons
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground text-center">
          Processes up to 50 icons per batch. New uploads automatically generate thumbnails.
        </p>
      </CardContent>
    </Card>
  );
};
