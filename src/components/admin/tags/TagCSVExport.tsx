import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { exportIconTagsToCSV } from '@/lib/csvExport';
import { toast } from 'sonner';
import { AdminTestIds } from '@/lib/test-ids';

export function TagCSVExport() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch all icons with tags (paginate to handle >1000 icons)
      let allIcons: Array<{ id: string; name: string; category: string; tags: string[] | null }> = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: icons, error } = await supabase
          .from('icons')
          .select('id, name, category, tags')
          .order('name')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (!icons || icons.length === 0) {
          hasMore = false;
        } else {
          allIcons = allIcons.concat(icons);
          if (icons.length < pageSize) {
            hasMore = false;
          }
          page++;
        }
      }

      if (allIcons.length === 0) {
        toast.warning('No icons found to export');
        return;
      }

      // Export to CSV
      exportIconTagsToCSV(allIcons);
      toast.success(`Successfully exported ${allIcons.length} icons with tags`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export tags');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      className="gap-2"
      data-testid={AdminTestIds.CSV_EXPORT_BUTTON}
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Export Tags CSV
        </>
      )}
    </Button>
  );
}
