import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wand2, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IconNameFix {
  id: string;
  oldName: string;
  newName: string;
  category: string;
}

export const IconNameCleaner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [fixes, setFixes] = useState<IconNameFix[]>([]);
  const [stats, setStats] = useState({ total: 0, corrupted: 0 });

  const cleanIconName = (name: string, svgContent: string): string => {
    // Pattern 1: Remove CSS class definitions
    let cleaned = name.replace(/\.cls-\d+\s*\{[^}]*\}/gi, '');
    cleaned = cleaned.replace(/\{[^}]*\}/g, ''); // Remove any remaining CSS blocks
    
    // Pattern 2: Remove upload metadata (e.g., "10_wDT1GQ3d8PCBt5ojQqQqvC_1760821060631_na1fn_...")
    cleaned = cleaned.replace(/^\d+_[a-zA-Z0-9]+_\d+_[a-zA-Z0-9]+_/, '');
    
    // Pattern 3: Try to decode Base64 encoded paths
    if (cleaned.includes('_L2hvbWU') || cleaned.includes('_na1fn_')) {
      const base64Match = cleaned.match(/_(L2[a-zA-Z0-9+/=]+)/);
      if (base64Match) {
        try {
          const decoded = atob(base64Match[1]);
          // Extract filename from path (e.g., "/home/ubuntu/Downloads/HumanUpperRespiratoryTract0001-grey")
          const pathParts = decoded.split('/');
          const filename = pathParts[pathParts.length - 1];
          cleaned = filename || cleaned;
        } catch (e) {
          console.warn('Failed to decode base64:', e);
        }
      }
    }
    
    // Pattern 4: Try to extract name from SVG metadata
    try {
      const titleMatch = svgContent.match(/<title[^>]*>(.*?)<\/title>/i);
      const descMatch = svgContent.match(/<desc[^>]*>(.*?)<\/desc>/i);
      
      if (titleMatch && titleMatch[1] && titleMatch[1].length < 100) {
        cleaned = titleMatch[1].trim();
      } else if (descMatch && descMatch[1] && descMatch[1].length < 100) {
        cleaned = descMatch[1].trim();
      }
    } catch (e) {
      console.warn('Failed to extract SVG metadata:', e);
    }
    
    // Pattern 5: Convert camelCase/PascalCase to readable text
    cleaned = cleaned
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    
    // Pattern 6: Clean up common patterns
    cleaned = cleaned
      .replace(/[-_]+/g, ' ')
      .replace(/\d{4,}/g, '') // Remove long numbers
      .replace(/grey|gray$/i, '') // Remove color suffixes
      .replace(/\s+/g, ' ')
      .trim();
    
    // Pattern 7: Capitalize words properly
    cleaned = cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Ensure name is not empty and has reasonable length
    if (!cleaned || cleaned.length < 2) {
      cleaned = 'Unnamed Icon';
    }
    
    return cleaned.substring(0, 100);
  };

  const scanForCorruptedNames = async () => {
    setIsScanning(true);
    setFixes([]);
    
    try {
      // Fetch all icons
      const { data: icons, error } = await supabase
        .from('icons')
        .select('id, name, category, svg_content')
        .order('name');
      
      if (error) throw error;
      
      if (!icons) {
        toast.error("No icons found");
        return;
      }
      
      const potentialFixes: IconNameFix[] = [];
      
      // Identify corrupted names (containing encoded data, upload metadata, or CSS definitions)
      for (const icon of icons) {
        const isCorrupted = 
          icon.name.includes('_na1fn_') ||
          icon.name.includes('_L2hvbWU') ||
          /^\d+_[a-zA-Z0-9]+_\d+_[a-zA-Z0-9]+_/.test(icon.name) ||
          icon.name.length > 80 ||
          // CSS class definitions
          /\.cls-\d+/i.test(icon.name) ||
          /\{\s*fill:/i.test(icon.name) ||
          /\{\s*stroke:/i.test(icon.name) ||
          /fill:\s*#[a-f0-9]{3,6}/i.test(icon.name) ||
          /stroke:\s*#[a-f0-9]{3,6}/i.test(icon.name);
        
        if (isCorrupted) {
          const cleanedName = cleanIconName(icon.name, icon.svg_content);
          
          // Only add if the cleaned name is actually different
          if (cleanedName !== icon.name) {
            potentialFixes.push({
              id: icon.id,
              oldName: icon.name,
              newName: cleanedName,
              category: icon.category
            });
          }
        }
      }
      
      setFixes(potentialFixes);
      setStats({
        total: icons.length,
        corrupted: potentialFixes.length
      });
      
      if (potentialFixes.length === 0) {
        toast.success("No corrupted icon names found!");
      } else {
        toast.success(`Found ${potentialFixes.length} icons that need cleaning`);
      }
    } catch (error) {
      console.error('Error scanning icons:', error);
      toast.error("Failed to scan icons");
    } finally {
      setIsScanning(false);
    }
  };

  const applyNameCleaning = async () => {
    if (fixes.length === 0) return;
    
    const confirmMessage = `Apply name cleaning to ${fixes.length} icon${fixes.length > 1 ? 's' : ''}?`;
    if (!window.confirm(confirmMessage)) return;
    
    setIsCleaning(true);
    
    try {
      const updatePromises = fixes.map(fix =>
        supabase
          .from('icons')
          .update({ name: fix.newName })
          .eq('id', fix.id)
      );
      
      const results = await Promise.allSettled(updatePromises);
      const failures = results.filter(r => r.status === 'rejected').length;
      const successes = fixes.length - failures;
      
      if (failures > 0) {
        toast.error(`Cleaned ${successes} names, ${failures} failed`);
      } else {
        toast.success(`Successfully cleaned ${successes} icon name${successes > 1 ? 's' : ''}!`);
      }
      
      // Clear fixes after applying
      setFixes([]);
      setStats({ ...stats, corrupted: 0 });
    } catch (error) {
      console.error('Error cleaning names:', error);
      toast.error("Failed to clean icon names");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Icon Name Cleaner</CardTitle>
        <CardDescription>
          Scan for and clean corrupted icon names containing upload metadata or encoded paths
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scan Button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={scanForCorruptedNames}
            disabled={isScanning}
            className="gap-2"
          >
            <Wand2 className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan for Corrupted Names'}
          </Button>
          
          {stats.total > 0 && (
            <div className="text-sm text-muted-foreground">
              Scanned {stats.total} icons • Found {stats.corrupted} corrupted
            </div>
          )}
        </div>

        {/* Results */}
        {fixes.length > 0 && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found {fixes.length} icon{fixes.length > 1 ? 's' : ''} with corrupted names. 
                Review the changes below and click "Apply Cleaning" to update.
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-3">
                {fixes.map((fix, index) => (
                  <div 
                    key={fix.id} 
                    className="p-3 border rounded-lg bg-muted/30 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground mb-1">
                          #{index + 1} • {fix.category}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="font-medium text-destructive">Old:</span>{' '}
                            <span className="font-mono text-xs break-all">{fix.oldName}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-green-600 dark:text-green-400">New:</span>{' '}
                            <span className="font-medium">{fix.newName}</span>
                          </div>
                        </div>
                      </div>
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button
              onClick={applyNameCleaning}
              disabled={isCleaning}
              className="w-full gap-2"
              size="lg"
            >
              <Wand2 className={`h-4 w-4 ${isCleaning ? 'animate-spin' : ''}`} />
              {isCleaning ? 'Applying...' : `Apply Cleaning to ${fixes.length} Icon${fixes.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        )}

        {fixes.length === 0 && stats.total > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All icon names are clean! No corrupted names detected.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};