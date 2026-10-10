import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CSVPreviewDialog } from './CSVPreviewDialog';
import { ColumnMappingDialog, ColumnMapping } from './ColumnMappingDialog';
import { useIconTags } from '@/hooks/useIconTags';
import type { CSVImportPreview } from '@/types/tags';
import { AdminTestIds } from '@/lib/test-ids';

export function TagCSVImport() {
  const [csvText, setCsvText] = useState<string>('');
  const [columns, setColumns] = useState<string[]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [previewData, setPreviewData] = useState<CSVImportPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { batchUpdateIconTags } = useIconTags();

  const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      rows.push(row);
    }

    return { headers, rows };
  };

  const extractTagsFromMapping = (row: Record<string, string>, mapping: ColumnMapping): string[] => {
    const tags: string[] = [];

    if (mapping.tag1Column && row[mapping.tag1Column]) {
      tags.push(row[mapping.tag1Column].trim().toLowerCase());
    }
    if (mapping.tag2Column && row[mapping.tag2Column]) {
      tags.push(row[mapping.tag2Column].trim().toLowerCase());
    }
    if (mapping.tag3Column && row[mapping.tag3Column]) {
      tags.push(row[mapping.tag3Column].trim().toLowerCase());
    }

    return tags.filter(t => t.length > 0).slice(0, 3);
  };

  const validateAndPreview = async (mapping: ColumnMapping) => {
    setIsValidating(true);
    try {
      const { headers, rows } = parseCSV(csvText);

      if (rows.length === 0) {
        toast.error('No data rows found in CSV');
        return;
      }

      // Fetch all icons to match (paginate to handle >1000 icons)
      // Only fetch id/name/tags here — thumbnails are fetched later for matched rows only
      let allIcons: Array<{ id: string; name: string; tags: string[] | null }> = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: icons, error } = await supabase
          .from('icons')
          .select('id, name, tags')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          toast.error('Failed to fetch icons');
          return;
        }

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

      const icons = allIcons;

    // Create lookup map for ID matching
    const iconByIdMap = new Map(icons?.map(icon => [icon.id, icon]) || []);

    // For name matching, keep as array to handle duplicates
    // (Map would only keep last icon with duplicate names)
    const iconsList = icons || [];

    const preview: CSVImportPreview[] = [];

    for (const row of rows) {
      let icon = null;
      let iconId = '';
      let matchMethod = '';

      // Try ID matching first if ID column is mapped
      if (mapping.idColumn && row[mapping.idColumn]) {
        iconId = row[mapping.idColumn];
        icon = iconByIdMap.get(iconId);
        matchMethod = 'ID';
      }

      // Try name matching if no ID match and name column is mapped
      if (!icon && mapping.nameColumn && row[mapping.nameColumn]) {
        const iconName = row[mapping.nameColumn].toLowerCase().trim();
        // Use find() to get first match (handles duplicate names better than Map)
        icon = iconsList.find(i => i.name.toLowerCase() === iconName) || null;
        iconId = icon?.id || '';
        matchMethod = 'Name';
      }

      const newTags = extractTagsFromMapping(row, mapping);

      if (!icon) {
        const identifier = mapping.idColumn && row[mapping.idColumn]
          ? row[mapping.idColumn]
          : row[mapping.nameColumn || ''] || 'Unknown';

        preview.push({
          status: 'error',
          iconId: iconId || identifier,
          iconName: identifier,
          thumbnail: null,
          currentTags: [],
          newTags,
          error: `Icon not found (tried matching by ${matchMethod || 'ID/Name'})`
        });
        continue;
      }

      const currentTags = (icon.tags as string[]) || [];

      // Validate tags
      if (newTags.length > 3) {
        preview.push({
          status: 'error',
          iconId: icon.id,
          iconName: icon.name,
          thumbnail: null,
          currentTags,
          newTags: newTags.slice(0, 3),
          error: 'Too many tags (max 3), only first 3 will be used'
        });
        continue;
      }

      // Check if tags are different
      const tagsChanged = JSON.stringify(currentTags.sort()) !== JSON.stringify(newTags.sort());

      preview.push({
        status: tagsChanged ? 'valid' : 'no-change',
        iconId: icon.id,
        iconName: icon.name,
        thumbnail: null,
        currentTags,
        newTags
      });
    }

      // Fetch thumbnails only for matched rows
      const matchedIds = preview
        .filter(row => row.iconId && row.status !== 'error')
        .map(row => row.iconId);

      if (matchedIds.length > 0) {
        const { data: thumbRows } = await supabase
          .from('icons')
          .select('id, thumbnail')
          .in('id', matchedIds);

        if (thumbRows) {
          const thumbMap = new Map(thumbRows.map(r => [r.id, r.thumbnail]));
          for (const row of preview) {
            row.thumbnail = thumbMap.get(row.iconId) ?? null;
          }
        }
      }

      setPreviewData(preview);
      setShowMapping(false);
      setShowPreview(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;

      if (!text || text.trim().length === 0) {
        toast.error('CSV file is empty');
        return;
      }

      const { headers, rows } = parseCSV(text);

      if (headers.length === 0) {
        toast.error('CSV has no headers');
        return;
      }

      if (rows.length === 0) {
        toast.error('CSV has no data rows');
        return;
      }

      // Store CSV and show column mapping dialog
      setCsvText(text);
      setColumns(headers);
      setShowMapping(true);
    };

    reader.onerror = () => {
      toast.error('Failed to read CSV file');
    };

    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    const validUpdates = previewData
      .filter(row => row.status === 'valid')
      .map(row => ({
        id: row.iconId,
        tags: row.newTags
      }));

    if (validUpdates.length === 0) {
      setShowPreview(false);
      return;
    }

    batchUpdateIconTags(validUpdates);
    setShowPreview(false);
    setPreviewData([]);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        className="gap-2"
        data-testid={AdminTestIds.CSV_IMPORT_BUTTON}
      >
        <Upload className="h-4 w-4" />
        Import Tags CSV
      </Button>

      <ColumnMappingDialog
        open={showMapping}
        onOpenChange={setShowMapping}
        columns={columns}
        onConfirm={validateAndPreview}
        isLoading={isValidating}
      />

      <CSVPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        previewData={previewData}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
