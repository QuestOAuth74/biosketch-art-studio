import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useIconTags } from '@/hooks/useIconTags';
import { Skeleton } from '@/components/ui/skeleton';

export function TagStatistics() {
  const { statistics, isLoadingStats } = useIconTags();

  if (isLoadingStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tag Statistics</CardTitle>
          <CardDescription>Overview of tag usage across all icons</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tag Statistics</CardTitle>
            <CardDescription>Overview of tag usage across all icons</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overview metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-2xl font-bold">{statistics.totalIcons}</p>
              <p className="text-sm text-muted-foreground">Total Icons</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-2xl font-bold">{statistics.taggedIcons}</p>
              <p className="text-sm text-muted-foreground">Tagged Icons</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-2xl font-bold">{statistics.uniqueTags}</p>
              <p className="text-sm text-muted-foreground">Unique Tags</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-2xl font-bold">{statistics.avgTagsPerIcon}</p>
              <p className="text-sm text-muted-foreground">Avg Tags/Icon</p>
            </div>
          </div>

          {/* Top tags */}
          {statistics.topTags.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Top {statistics.topTags.length} Tags</h3>
              <div className="space-y-2">
                {statistics.topTags.map(({ tag, count, percentage }) => (
                  <div key={tag} className="flex items-center gap-3">
                    <Badge variant="outline" className="min-w-[150px] justify-center">
                      {tag}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground min-w-[80px] text-right">
                          {count} ({percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {statistics.topTags.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tags found. Start adding tags to icons to see statistics.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
