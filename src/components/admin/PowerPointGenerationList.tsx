import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { PowerPointGeneration } from '@/types/powerpoint';
import { usePowerPointGenerations } from '@/hooks/usePowerPointGenerations';
import { format } from 'date-fns';

export const PowerPointGenerationList = () => {
  const { generations, isLoading, deleteGeneration, downloadGeneration } = usePowerPointGenerations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!generations || generations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No presentations generated yet
      </div>
    );
  }

  const getStatusBadge = (status: PowerPointGeneration['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Original File</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {generations.map((generation) => (
            <TableRow key={generation.id}>
              <TableCell className="font-medium">
                {generation.original_filename}
              </TableCell>
              <TableCell className="capitalize">
                {generation.template_name.replace(/-/g, ' ')}
              </TableCell>
              <TableCell>{getStatusBadge(generation.status)}</TableCell>
              <TableCell>
                {format(new Date(generation.created_at), 'MMM d, yyyy HH:mm')}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {generation.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadGeneration(generation)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteGeneration.mutate(generation.id)}
                    disabled={deleteGeneration.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
