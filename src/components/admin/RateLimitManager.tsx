import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Unlock, Trash2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  attempt_time: string;
  success: boolean;
  created_at: string;
}

interface RateLimitStatus {
  email: string;
  failed_attempts: number;
  latest_attempt: string;
  is_locked: boolean;
  time_until_reset: number | null;
}

const MAX_ATTEMPTS = 5;
const TIME_WINDOW_MINUTES = 15;

export default function RateLimitManager() {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);

  const fetchLoginAttempts = async () => {
    setLoading(true);

    // Get login attempts from the last 24 hours with a limit to reduce load
    const { data, error } = await supabase
      .from('login_attempts')
      .select('*')
      .gte('attempt_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('attempt_time', { ascending: false })
      .limit(500); // Limit to most recent 500 attempts

    if (error) {
      toast.error('Failed to fetch login attempts');
      console.error(error);
    } else {
      setAttempts(data || []);
      calculateRateLimits(data || []);
    }

    setLoading(false);
  };

  const calculateRateLimits = (allAttempts: LoginAttempt[]) => {
    const timeThreshold = Date.now() - TIME_WINDOW_MINUTES * 60 * 1000;
    const emailGroups = new Map<string, LoginAttempt[]>();

    // Group attempts by email
    allAttempts.forEach(attempt => {
      if (!emailGroups.has(attempt.email)) {
        emailGroups.set(attempt.email, []);
      }
      emailGroups.get(attempt.email)!.push(attempt);
    });

    const status: RateLimitStatus[] = [];

    emailGroups.forEach((attempts, email) => {
      const recentFailedAttempts = attempts.filter(
        a => !a.success && new Date(a.attempt_time).getTime() > timeThreshold
      );

      if (recentFailedAttempts.length > 0) {
        const isLocked = recentFailedAttempts.length >= MAX_ATTEMPTS;
        const latestAttempt = recentFailedAttempts[0];
        const oldestRelevantAttempt = recentFailedAttempts[recentFailedAttempts.length - 1];
        
        let timeUntilReset = null;
        if (isLocked) {
          const resetTime = new Date(oldestRelevantAttempt.attempt_time).getTime() + 
                           (TIME_WINDOW_MINUTES * 60 * 1000);
          timeUntilReset = Math.max(0, Math.ceil((resetTime - Date.now()) / 60000));
        }

        status.push({
          email,
          failed_attempts: recentFailedAttempts.length,
          latest_attempt: latestAttempt.attempt_time,
          is_locked: isLocked,
          time_until_reset: timeUntilReset,
        });
      }
    });

    // Sort by locked status first, then by failed attempts
    status.sort((a, b) => {
      if (a.is_locked !== b.is_locked) return a.is_locked ? -1 : 1;
      return b.failed_attempts - a.failed_attempts;
    });

    setRateLimitStatus(status);
  };

  const clearRateLimit = async (email: string) => {
    setClearing(email);
    
    const { error } = await supabase
      .from('login_attempts')
      .delete()
      .eq('email', email)
      .eq('success', false);

    if (error) {
      toast.error('Failed to clear rate limit');
      console.error(error);
    } else {
      toast.success(`Rate limit cleared for ${email}`);
      await fetchLoginAttempts();
    }
    
    setClearing(null);
  };

  const clearAllOldAttempts = async () => {
    setLoading(true);
    
    const { error } = await supabase
      .from('login_attempts')
      .delete()
      .lt('attempt_time', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (error) {
      toast.error('Failed to clear old attempts');
      console.error(error);
    } else {
      toast.success('Old attempts cleared successfully');
      await fetchLoginAttempts();
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchLoginAttempts();

    // Refresh every 60 seconds to reduce database load
    const interval = setInterval(fetchLoginAttempts, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rate Limit Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage login rate limits
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLoginAttempts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllOldAttempts}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Old Attempts
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts (24h)</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attempts.length}</div>
            <p className="text-xs text-muted-foreground">
              {attempts.filter(a => a.success).length} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {attempts.filter(a => !a.success).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limited Users</CardTitle>
            <Unlock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {rateLimitStatus.filter(s => s.is_locked).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently locked out
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rate-limits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="all-attempts">All Attempts</TabsTrigger>
        </TabsList>

        <TabsContent value="rate-limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Rate Limits</CardTitle>
              <CardDescription>
                Users with failed login attempts in the last {TIME_WINDOW_MINUTES} minutes.
                {MAX_ATTEMPTS} failed attempts trigger a lockout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rateLimitStatus.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active rate limits</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Failed Attempts</TableHead>
                      <TableHead>Latest Attempt</TableHead>
                      <TableHead>Reset Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateLimitStatus.map((status) => (
                      <TableRow key={status.email}>
                        <TableCell className="font-medium">{status.email}</TableCell>
                        <TableCell>
                          {status.is_locked ? (
                            <Badge variant="destructive">Locked</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                              Warning
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={status.is_locked ? 'text-destructive font-semibold' : ''}>
                            {status.failed_attempts} / {MAX_ATTEMPTS}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(status.latest_attempt), 'MMM dd, HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          {status.time_until_reset !== null ? (
                            <span className="text-sm">
                              {status.time_until_reset} min
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => clearRateLimit(status.email)}
                            disabled={clearing === status.email}
                          >
                            <Unlock className="h-3 w-3 mr-1" />
                            Clear
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-attempts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Login Attempts</CardTitle>
              <CardDescription>
                All login attempts from the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attempts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No login attempts recorded
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-medium">{attempt.email}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {attempt.ip_address || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {attempt.success ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(attempt.attempt_time), 'MMM dd, HH:mm:ss')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
