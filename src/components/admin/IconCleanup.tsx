import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Trash2, RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProblematicIcon {
  id: string;
  name: string;
  category: string;
  svg_content: string;
  thumbnail: string | null;
  issue: string;
  thumbnailSize?: number;
}

export const IconCleanup = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [problematicIcons, setProblematicIcons] = useState<ProblematicIcon[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const scanForIssues = async () => {
    setIsScanning(true);
    try {
      // OPTIMIZATION: First pass - check name/thumbnail issues without loading svg_content
      const { data: icons, error } = await supabase
        .from('icons')
        .select('id, name, category, thumbnail');

      if (error) throw error;

      const issues: ProblematicIcon[] = [];

      icons?.forEach((icon) => {
        // Check for malformed names (URL encoded or very long)
        if (icon.name.includes('%') || icon.name.length > 100) {
          issues.push({
            ...icon,
            svg_content: '', // Will be loaded on-demand if needed for regeneration
            issue: 'Malformed name (URL encoded or too long)'
          });
        }

        // Check for oversized thumbnails
        const thumbnailSize = icon.thumbnail ? new Blob([icon.thumbnail]).size : 0;
        if (thumbnailSize > 100000) {
          issues.push({
            ...icon,
            svg_content: '', // Will be loaded on-demand if needed for regeneration
            issue: `Oversized thumbnail (${(thumbnailSize / 1024).toFixed(1)} KB)`,
            thumbnailSize
          });
        }

        // Check for missing thumbnails
        if (!icon.thumbnail) {
          issues.push({
            ...icon,
            svg_content: '', // Will be loaded on-demand if needed for regeneration
            issue: 'Missing thumbnail'
          });
        }
      });

      // OPTIMIZATION: Second pass - only fetch svg_content for SVG validation check
      // Note: This check is optional and can be skipped to reduce I/O
      const { data: svgIcons, error: svgError } = await supabase
        .from('icons')
        .select('id, name, category, thumbnail, svg_content')
        .limit(100); // Limit to first 100 for performance

      if (!svgError && svgIcons) {
        svgIcons.forEach((icon) => {
          // Check for invalid SVG content
          if (!icon.svg_content.includes('<svg') || !icon.svg_content.includes('</svg>')) {
            issues.push({
              ...icon,
              issue: 'Invalid SVG content'
            });
          }
        });
      }

      setProblematicIcons(issues);
      toast.success(`Scan complete: Found ${issues.length} issues`);
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Failed to scan icons');
    } finally {
      setIsScanning(false);
    }
  };

  const deleteIcon = async (id: string) => {
    const { error } = await supabase
      .from('icons')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete icon');
    } else {
      toast.success('Icon deleted');
      setProblematicIcons(prev => prev.filter(icon => icon.id !== id));
    }
  };

  const regenerateThumbnail = async (icon: ProblematicIcon) => {
    try {
      // Fetch svg_content on-demand if not already loaded
      let svgContent = icon.svg_content;
      if (!svgContent) {
        const { data, error: fetchError } = await supabase
          .from('icons')
          .select('svg_content')
          .eq('id', icon.id)
          .single();

        if (fetchError || !data?.svg_content) {
          toast.error('Failed to fetch icon data');
          return;
        }
        svgContent = data.svg_content;
      }

      const thumbnail = generateOptimizedThumbnail(svgContent);

      const { error } = await supabase
        .from('icons')
        .update({ thumbnail })
        .eq('id', icon.id);

      if (error) throw error;

      toast.success('Thumbnail regenerated');
      setProblematicIcons(prev => prev.filter(i => i.id !== icon.id));
    } catch (error) {
      console.error('Regeneration error:', error);
      toast.error('Failed to regenerate thumbnail');
    }
  };

  const batchDelete = async () => {
    if (!confirm(`Delete all ${problematicIcons.length} problematic icons?`)) return;

    setIsProcessing(true);
    let deleted = 0;

    for (const icon of problematicIcons) {
      const { error } = await supabase
        .from('icons')
        .delete()
        .eq('id', icon.id);

      if (!error) deleted++;
    }

    toast.success(`Deleted ${deleted} icons`);
    setProblematicIcons([]);
    setIsProcessing(false);
  };

  const batchRegenerate = async () => {
    if (!confirm(`Regenerate thumbnails for all ${problematicIcons.length} icons?`)) return;

    setIsProcessing(true);
    let regenerated = 0;

    for (const icon of problematicIcons) {
      try {
        // Fetch svg_content on-demand if not already loaded
        let svgContent = icon.svg_content;
        if (!svgContent) {
          const { data, error: fetchError } = await supabase
            .from('icons')
            .select('svg_content')
            .eq('id', icon.id)
            .single();

          if (fetchError || !data?.svg_content) {
            console.error('Failed to fetch svg_content for:', icon.name);
            continue;
          }
          svgContent = data.svg_content;
        }

        const thumbnail = generateOptimizedThumbnail(svgContent);

        const { error } = await supabase
          .from('icons')
          .update({ thumbnail })
          .eq('id', icon.id);

        if (!error) regenerated++;
      } catch (error) {
        console.error('Error regenerating:', icon.name, error);
      }
    }

    toast.success(`Regenerated ${regenerated} thumbnails`);
    setProblematicIcons([]);
    setIsProcessing(false);
  };

  const generateOptimizedThumbnail = (svgContent: string): string => {
    try {
      let optimized = svgContent
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
        .replace(/<title>[\s\S]*?<\/title>/gi, '')
        .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
        .replace(/<defs>[\s\S]*?<\/defs>/gi, '')
        .trim();

      const viewBoxMatch = optimized.match(/viewBox=["']([^"']*)["']/);
      const widthMatch = optimized.match(/width=["']([^"']*)["']/);
      const heightMatch = optimized.match(/height=["']([^"']*)["']/);

      if (!viewBoxMatch && widthMatch && heightMatch) {
        const width = parseFloat(widthMatch[1]);
        const height = parseFloat(heightMatch[1]);
        if (!isNaN(width) && !isNaN(height)) {
          optimized = optimized.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
        }
      }

      optimized = optimized
        .replace(/\s+id=["'][^"']*["']/g, '')
        .replace(/\s+class=["'][^"']*["']/g, '')
        .replace(/\s+style=["'][^"']*["']/g, '')
        .replace(/\s+data-[^=]*=["'][^"']*["']/g, '');

      optimized = optimized.replace(/(\d+\.\d{2,})/g, (match) => parseFloat(match).toFixed(1));
      optimized = optimized.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

      if (optimized.length > 50000) {
        optimized = optimized
          .replace(/\s+fill=["'][^"']*["']/g, '')
          .replace(/\s+stroke=["'][^"']*["']/g, '');
        optimized = optimized.replace(/(\d+\.\d+)/g, (match) => Math.round(parseFloat(match)).toString());
      }

      return optimized;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return svgContent;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Icon Cleanup Tool</CardTitle>
        <CardDescription>
          Scan for and fix problematic icons (malformed names, oversized thumbnails, invalid SVGs)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={scanForIssues} 
          disabled={isScanning}
          className="w-full"
        >
          <Search className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Scan for Issues'}
        </Button>

        {problematicIcons.length > 0 && (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found {problematicIcons.length} problematic icons
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                onClick={batchRegenerate}
                disabled={isProcessing}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate All
              </Button>
              <Button 
                onClick={batchDelete}
                disabled={isProcessing}
                variant="destructive"
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {problematicIcons.map((icon) => (
                <div key={icon.id} className="border border-border rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{icon.name}</p>
                    <p className="text-xs text-muted-foreground">{icon.category}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">{icon.issue}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => regenerateThumbnail(icon)}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteIcon(icon.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
