import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollableContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: string[];
  onConfirm: (mapping: ColumnMapping) => void;
  isLoading?: boolean;
}

export interface ColumnMapping {
  idColumn: string | null;
  nameColumn: string | null;
  tag1Column: string | null;
  tag2Column: string | null;
  tag3Column: string | null;
}

export function ColumnMappingDialog({
  open,
  onOpenChange,
  columns,
  onConfirm,
  isLoading
}: ColumnMappingDialogProps) {
  const [mapping, setMapping] = useState<ColumnMapping>({
    idColumn: null,
    nameColumn: null,
    tag1Column: null,
    tag2Column: null,
    tag3Column: null
  });

  // Auto-suggest column mappings based on column names
  useEffect(() => {
    if (open && columns.length > 0) {
      const suggested = suggestColumnMapping(columns);
      setMapping(suggested);
    }
  }, [open, columns]);

  const suggestColumnMapping = (cols: string[]): ColumnMapping => {
    const normalizedCols = cols.map(c => c.toLowerCase().trim());

    const findColumn = (patterns: string[]): string | null => {
      for (const pattern of patterns) {
        const index = normalizedCols.findIndex(c =>
          c === pattern || c.includes(pattern)
        );
        if (index !== -1) return cols[index];
      }
      return null;
    };

    return {
      idColumn: findColumn(['id', 'icon_id', 'iconid', 'uuid']),
      nameColumn: findColumn(['name', 'originalname', 'original_name', 'icon_name', 'iconname']),
      tag1Column: findColumn(['tag1', 'tag 1', 'tag_1', 'alternative1', 'alternative 1', 'alternative_1']),
      tag2Column: findColumn(['tag2', 'tag 2', 'tag_2', 'alternative2', 'alternative 2', 'alternative_2']),
      tag3Column: findColumn(['tag3', 'tag 3', 'tag_3', 'alternative3', 'alternative 3', 'alternative_3'])
    };
  };

  const isValid = () => {
    // Either ID or Name must be provided
    const hasIdentifier = mapping.idColumn || mapping.nameColumn;
    // At least one tag column must be provided
    const hasTags = mapping.tag1Column || mapping.tag2Column || mapping.tag3Column;
    return hasIdentifier && hasTags;
  };

  const handleConfirm = () => {
    if (isValid()) {
      onConfirm(mapping);
    }
  };

  const getAvailableColumns = (currentField?: string | null): string[] => {
    const usedColumns = Object.values(mapping).filter(v => v && v !== currentField);
    return columns.filter(col => !usedColumns.includes(col));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Map CSV Columns</DialogTitle>
          <DialogDescription>
            Map your CSV columns to the required fields. Either ID or Name is required to identify icons.
          </DialogDescription>
        </DialogHeader>

        <DialogScrollableContent className="space-y-6">
          {/* Identifier Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Icon Identifier (at least one required)</h3>

            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="id-column">ID Column (UUID)</Label>
                <Select
                  value={mapping.idColumn || 'none'}
                  onValueChange={(value) =>
                    setMapping({ ...mapping, idColumn: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger id="id-column">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {getAvailableColumns(mapping.idColumn).map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name-column">Name Column</Label>
                <Select
                  value={mapping.nameColumn || 'none'}
                  onValueChange={(value) =>
                    setMapping({ ...mapping, nameColumn: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger id="name-column">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {getAvailableColumns(mapping.nameColumn).map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Tag Columns (at least one required)</h3>

            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="tag1-column">Tag 1 Column</Label>
                <Select
                  value={mapping.tag1Column || 'none'}
                  onValueChange={(value) =>
                    setMapping({ ...mapping, tag1Column: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger id="tag1-column">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {getAvailableColumns(mapping.tag1Column).map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tag2-column">Tag 2 Column</Label>
                <Select
                  value={mapping.tag2Column || 'none'}
                  onValueChange={(value) =>
                    setMapping({ ...mapping, tag2Column: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger id="tag2-column">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {getAvailableColumns(mapping.tag2Column).map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tag3-column">Tag 3 Column</Label>
                <Select
                  value={mapping.tag3Column || 'none'}
                  onValueChange={(value) =>
                    setMapping({ ...mapping, tag3Column: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger id="tag3-column">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {getAvailableColumns(mapping.tag3Column).map(col => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Validation Alert */}
          {!isValid() && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {!mapping.idColumn && !mapping.nameColumn &&
                  'Please select either an ID or Name column to identify icons.'
                }
                {(mapping.idColumn || mapping.nameColumn) &&
                 !mapping.tag1Column && !mapping.tag2Column && !mapping.tag3Column &&
                  'Please select at least one tag column.'
                }
              </AlertDescription>
            </Alert>
          )}
        </DialogScrollableContent>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Continue to Preview'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
