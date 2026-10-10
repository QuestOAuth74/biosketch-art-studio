import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollableContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Minus, Loader2 } from 'lucide-react';
import { useIconTags } from '@/hooks/useIconTags';
import type { CSVImportPreview } from '@/types/tags';

interface CSVPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: CSVImportPreview[];
  onConfirm: () => void;
}

type FilterType = 'all' | 'valid' | 'error' | 'no-change';

export function CSVPreviewDialog({
  open,
  onOpenChange,
  previewData,
  onConfirm
}: CSVPreviewDialogProps) {
  const { isUpdating } = useIconTags();
  const [filter, setFilter] = useState<FilterType>('all');

  const validCount = previewData.filter(row => row.status === 'valid').length;
  const errorCount = previewData.filter(row => row.status === 'error').length;
  const noChangeCount = previewData.filter(row => row.status === 'no-change').length;
  const totalRows = previewData.length;

  const filteredData = previewData.filter(row => {
    if (filter === 'all') return true;
    return row.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'no-change':
        return <Minus className="h-5 w-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'border-l-4 border-l-green-500 bg-green-50/50';
      case 'error':
        return 'border-l-4 border-l-red-500 bg-red-50/50';
      case 'no-change':
        return 'border-l-4 border-l-gray-300 bg-gray-50/50';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Preview CSV Import</DialogTitle>
          <DialogDescription>
            Review changes before applying. Click on the summary cards to filter.
          </DialogDescription>
        </DialogHeader>

        <DialogScrollableContent className="space-y-4">
          {/* Summary stats - now clickable filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`border rounded-lg p-3 text-left transition-all hover:shadow-md ${
                filter === 'all' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
            >
              <p className="text-lg font-bold">{totalRows}</p>
              <p className="text-xs text-muted-foreground">Total Rows</p>
            </button>
            <button
              onClick={() => setFilter('valid')}
              className={`border rounded-lg p-3 text-left transition-all hover:shadow-md ${
                filter === 'valid' ? 'ring-2 ring-green-500 bg-green-50' : 'border-green-500'
              }`}
            >
              <p className="text-lg font-bold text-green-600">{validCount}</p>
              <p className="text-xs text-muted-foreground">Valid Updates</p>
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`border rounded-lg p-3 text-left transition-all hover:shadow-md ${
                filter === 'error' ? 'ring-2 ring-red-500 bg-red-50' : 'border-red-500'
              }`}
            >
              <p className="text-lg font-bold text-red-600">{errorCount}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </button>
            <button
              onClick={() => setFilter('no-change')}
              className={`border rounded-lg p-3 text-left transition-all hover:shadow-md ${
                filter === 'no-change' ? 'ring-2 ring-gray-500 bg-gray-50' : 'border-gray-400'
              }`}
            >
              <p className="text-lg font-bold text-gray-600">{noChangeCount}</p>
              <p className="text-xs text-muted-foreground">Unchanged</p>
            </button>
          </div>

          {/* Preview items list */}
          <div className="space-y-3">
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items to display for this filter
              </div>
            ) : (
              filteredData.map((row, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 ${getStatusColor(row.status)}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(row.status)}
                    </div>

                    {/* Icon info */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Icon name/ID and thumbnail */}
                      <div className="flex items-center gap-3">
                        {row.thumbnail && (
                          <img
                            src={row.thumbnail}
                            alt={row.iconName}
                            className="w-12 h-12 object-contain border rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{row.iconName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            ID: {row.iconId}
                          </p>
                        </div>
                      </div>

                      {/* Current tags */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Current Tags:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {row.currentTags.length > 0 ? (
                            row.currentTags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No tags</span>
                          )}
                        </div>
                      </div>

                      {/* New tags */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          New Tags:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {row.newTags.length > 0 ? (
                            row.newTags.map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No tags</span>
                          )}
                        </div>
                      </div>

                      {/* Error message */}
                      {row.error && (
                        <div className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded p-2">
                          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <p className="text-xs">{row.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogScrollableContent>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isUpdating || validCount === 0}>
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${validCount} Update${validCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
