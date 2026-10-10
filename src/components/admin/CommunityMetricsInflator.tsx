import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Loader2, Eye, Heart, Copy, RefreshCw, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CurrentMetrics {
  totalViews: number;
  totalLikes: number;
  totalClones: number;
  projectCount: number;
}

interface ProjectData {
  id: string;
  view_count: number;
  like_count: number;
  cloned_count: number;
  created_at: string;
}

interface InflationLog {
  id: string;
  inflated_at: string;
  percentage: number;
  variation_mode: string;
  tier_filter: string;
  projects_affected: number;
  total_views_before: number;
  total_views_after: number;
  total_likes_before: number;
  total_likes_after: number;
  total_clones_before: number;
  total_clones_after: number;
}

export const CommunityMetricsInflator = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<CurrentMetrics>({
    totalViews: 0,
    totalLikes: 0,
    totalClones: 0,
    projectCount: 0,
  });
  const [projectsData, setProjectsData] = useState<ProjectData[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [newProjectsSinceInflation, setNewProjectsSinceInflation] = useState(0);
  const [percentage, setPercentage] = useState([15]);
  const [variationMode, setVariationMode] = useState<'uniform' | 'varied'>('varied');
  const [tierFilter, setTierFilter] = useState<'all' | 'tier1' | 'tier2' | 'tier3'>('all');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [inflationHistory, setInflationHistory] = useState<InflationLog[]>([]);

  const fetchCurrentMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('canvas_projects')
        .select('id, view_count, like_count, cloned_count, created_at')
        .eq('is_public', true)
        .eq('approval_status', 'approved')
        .order('view_count', { ascending: false });

      if (error) throw error;

      if (data) {
        setProjectsData(data);
        setMetrics({
          totalViews: data.reduce((sum, p) => sum + (p.view_count || 0), 0),
          totalLikes: data.reduce((sum, p) => sum + (p.like_count || 0), 0),
          totalClones: data.reduce((sum, p) => sum + (p.cloned_count || 0), 0),
          projectCount: data.length,
        });
        setLastRefreshTime(new Date());
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch current metrics',
        variant: 'destructive',
      });
    }
  };

  const fetchInflationHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('metrics_inflation_log')
        .select('*')
        .order('inflated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (data) setInflationHistory(data);
    } catch (error) {
      console.error('Error fetching inflation history:', error);
    }
  };

  useEffect(() => {
    fetchCurrentMetrics();
    fetchInflationHistory();
  }, []);

  useEffect(() => {
    if (inflationHistory.length > 0 && projectsData.length > 0) {
      const lastInflationTime = new Date(inflationHistory[0].inflated_at);
      const newProjects = projectsData.filter(p => 
        new Date(p.created_at) > lastInflationTime
      );
      setNewProjectsSinceInflation(newProjects.length);
    }
  }, [inflationHistory, projectsData]);

  const getPreviewMetrics = () => {
    let relevantProjects = projectsData;
    
    // Apply tier filtering to preview
    if (tierFilter === 'tier1') {
      relevantProjects = projectsData.slice(0, 5);
    } else if (tierFilter === 'tier2') {
      relevantProjects = projectsData.slice(5, 13);
    } else if (tierFilter === 'tier3') {
      relevantProjects = projectsData.slice(13, 31);
    }
    
    let totalViews = 0;
    let totalLikes = 0;
    let totalClones = 0;
    
    relevantProjects.forEach(project => {
      const inflationPercent = variationMode === 'varied' 
        ? Math.random() * (Math.min(30, percentage[0] + 5) - Math.max(5, percentage[0] - 5)) + Math.max(5, percentage[0] - 5)
        : percentage[0];
      
      const inflationFactor = 1 + inflationPercent / 100;
      
      totalViews += Math.round((project.view_count || 0) * inflationFactor);
      totalLikes += Math.round((project.like_count || 0) * inflationFactor);
      totalClones += Math.round((project.cloned_count || 0) * inflationFactor);
    });
    
    return { views: totalViews, likes: totalLikes, clones: totalClones };
  };

  const previewMetrics = getPreviewMetrics();

  const getTierProjectCount = () => {
    if (tierFilter === 'tier1') return Math.min(5, projectsData.length);
    if (tierFilter === 'tier2') return Math.min(8, Math.max(0, projectsData.length - 5));
    if (tierFilter === 'tier3') return Math.min(18, Math.max(0, projectsData.length - 13));
    return projectsData.length;
  };

  const handleInflate = async () => {
    setLoading(true);
    setShowConfirmDialog(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('inflate-community-metrics', {
        body: {
          percentage: percentage[0],
          variationMode,
          tierFilter,
        },
      });

      if (response.error) throw response.error;

      const result = response.data;

      const successMessage = result.projectsSkipped > 0
        ? `${result.projectsAffected} projects updated, ${result.projectsSkipped} skipped (clone count > 100). Views: ${result.before.views.toLocaleString()} → ${result.after.views.toLocaleString()}`
        : `${result.projectsAffected} projects updated. Views: ${result.before.views.toLocaleString()} → ${result.after.views.toLocaleString()}`;

      toast({
        title: '✓ Metrics Inflated Successfully!',
        description: successMessage,
      });

      // Refresh metrics and history
      await fetchCurrentMetrics();
      await fetchInflationHistory();

    } catch (error) {
      console.error('Error inflating metrics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to inflate metrics';
      toast({
        title: 'Inflation Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data from inflation history
  const chartData = inflationHistory
    .slice()
    .reverse()
    .map((log) => ({
      date: new Date(log.inflated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      views: log.total_views_after,
      likes: log.total_likes_after,
      clones: log.total_clones_after,
      percentage: log.percentage,
    }));

  return (
    <div className="space-y-6">
      {/* Current Metrics Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalViews.toLocaleString()}</div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{metrics.projectCount} projects</p>
              {newProjectsSinceInflation > 0 && (
                <p className="text-xs text-primary font-medium">
                  +{newProjectsSinceInflation} new
                </p>
              )}
            </div>
            {lastRefreshTime && (
              <p className="text-xs text-muted-foreground mt-1">
                Updated {lastRefreshTime.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalLikes.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clones</CardTitle>
            <Copy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalClones.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Inflated</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {inflationHistory.length > 0
                ? new Date(inflationHistory[0].inflated_at).toLocaleDateString()
                : 'Never'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inflation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Inflate Community Metrics</CardTitle>
          <CardDescription>
            Gradually increase engagement metrics to create FOMO effect
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Percentage Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Percentage Increase</Label>
              <span className="text-2xl font-bold text-primary">{percentage[0]}%</span>
            </div>
            <Slider
              value={percentage}
              onValueChange={setPercentage}
              min={5}
              max={30}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 5-10% for gradual weekly growth
            </p>
          </div>

          {/* Variation Mode */}
          <div className="space-y-3">
            <Label>Variation Mode</Label>
            <RadioGroup value={variationMode} onValueChange={(v: any) => setVariationMode(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="uniform" id="uniform" />
                <Label htmlFor="uniform" className="font-normal cursor-pointer">
                  Uniform (all projects +{percentage[0]}%)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="varied" id="varied" />
                <Label htmlFor="varied" className="font-normal cursor-pointer">
                  Varied (each project +{Math.max(5, percentage[0] - 5)}% to +{Math.min(30, percentage[0] + 5)}% randomly)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Tier Filter */}
          <div className="space-y-3">
            <Label>Apply To</Label>
            <RadioGroup value={tierFilter} onValueChange={(v: any) => setTierFilter(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal cursor-pointer">
                  All Projects ({metrics.projectCount} projects)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tier1" id="tier1" />
                <Label htmlFor="tier1" className="font-normal cursor-pointer">
                  Tier 1 Only ({Math.min(5, projectsData.length)} top projects)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tier2" id="tier2" />
                <Label htmlFor="tier2" className="font-normal cursor-pointer">
                  Tier 2 Only ({Math.min(8, Math.max(0, projectsData.length - 5))} moderate projects)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tier3" id="tier3" />
                <Label htmlFor="tier3" className="font-normal cursor-pointer">
                  Tier 3 Only ({Math.min(18, Math.max(0, projectsData.length - 13))} growing projects)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Preview */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <h4 className="font-semibold text-sm">Preview</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Views:</span>
                <span className="font-mono">
                  {metrics.totalViews.toLocaleString()} → {previewMetrics.views.toLocaleString()}{' '}
                  <span className="text-primary">(+{(previewMetrics.views - metrics.totalViews).toLocaleString()})</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>Likes:</span>
                <span className="font-mono">
                  {metrics.totalLikes.toLocaleString()} → {previewMetrics.likes.toLocaleString()}{' '}
                  <span className="text-primary">(+{(previewMetrics.likes - metrics.totalLikes).toLocaleString()})</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>Clones:</span>
                <span className="font-mono">
                  {metrics.totalClones.toLocaleString()} → {previewMetrics.clones.toLocaleString()}{' '}
                  <span className="text-primary">(+{(previewMetrics.clones - metrics.totalClones).toLocaleString()})</span>
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inflating...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Apply Inflation
                </>
              )}
            </Button>
            <Button
              onClick={fetchCurrentMetrics}
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inflation History Chart */}
      {inflationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Inflation Trends</CardTitle>
                <CardDescription>Historical growth of community metrics over time</CardDescription>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend 
                    wrapperStyle={{
                      paddingTop: '20px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="views" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total Views"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="likes" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--destructive))', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total Likes"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clones" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-3))', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total Clones"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Avg Inflation</div>
                <div className="text-2xl font-bold">
                  {(inflationHistory.reduce((sum, log) => sum + log.percentage, 0) / inflationHistory.length).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Total Inflations</div>
                <div className="text-2xl font-bold">{inflationHistory.length}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Projects Affected</div>
                <div className="text-2xl font-bold">
                  {inflationHistory.reduce((sum, log) => sum + log.projects_affected, 0)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inflation History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Inflation History</CardTitle>
          <CardDescription>Complete log of all metric inflation operations</CardDescription>
        </CardHeader>
        <CardContent>
          {inflationHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No inflation history yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead className="text-right">Views Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inflationHistory.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.inflated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{log.percentage}%</TableCell>
                    <TableCell className="text-sm capitalize">{log.variation_mode}</TableCell>
                    <TableCell className="text-sm">{log.projects_affected}</TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {log.total_views_before.toLocaleString()} →{' '}
                      {log.total_views_after.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Metric Inflation</AlertDialogTitle>
            <AlertDialogDescription>
              This will increase metrics by {percentage[0]}% for {getTierProjectCount()} projects
              in {variationMode} mode. This action cannot be undone.
              <div className="mt-4 p-3 rounded-lg bg-muted text-sm space-y-1">
                <div>Views: {metrics.totalViews.toLocaleString()} → {previewMetrics.views.toLocaleString()}</div>
                <div>Likes: {metrics.totalLikes.toLocaleString()} → {previewMetrics.likes.toLocaleString()}</div>
                <div>Clones: {metrics.totalClones.toLocaleString()} → {previewMetrics.clones.toLocaleString()}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInflate}>
              Confirm Inflation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
