import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, Loader2, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/SEO/SEOHead';
import { format } from 'date-fns';

interface RecentGrant {
  id: string;
  user_id: string;
  amount_usd: number;
  generations_granted: number;
  stripe_session_id: string;
  created_at: string;
  profile_email?: string | null;
  profile_full_name?: string | null;
}

export default function AICreditsGrant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Grant form state
  const [emailOrId, setEmailOrId] = useState('');
  const [generations, setGenerations] = useState<number | ''>(50);
  const [reason, setReason] = useState('');

  // Revoke form state
  const [revokeEmailOrId, setRevokeEmailOrId] = useState('');
  const [revokeGenerations, setRevokeGenerations] = useState<number | ''>(10);
  const [revokeReason, setRevokeReason] = useState('');

  // Recent admin activity — includes both grants and revokes (revokes have
  // negative generations_granted). Filtered to `admin-*:` prefix so real
  // Stripe purchases don't clutter the panel.
  const { data: recent, isLoading: recentLoading } = useQuery<RecentGrant[]>({
    queryKey: ['admin-recent-grants'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_credit_purchases')
        .select('id, user_id, amount_usd, generations_granted, stripe_session_id, created_at')
        .or('stripe_session_id.like.admin-grant:%,stripe_session_id.like.admin-revoke:%')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as RecentGrant[];
    },
  });

  const resolveUserId = async (input: string): Promise<string> => {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('Enter a user email or ID');
    // UUID heuristic — 8-4-4-4-12 hex.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid) return trimmed;
    // Otherwise treat as email — look up in profiles.
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', trimmed.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No user found with email "${trimmed}"`);
    return data.id;
  };

  const grantMutation = useMutation({
    mutationFn: async () => {
      const targetId = await resolveUserId(emailOrId);
      const count = Number(generations);
      if (!Number.isFinite(count) || count <= 0) throw new Error('Generations must be a positive number');
      const { data, error } = await supabase.rpc('admin_grant_ai_credits', {
        p_target_user_id: targetId,
        p_generations: count,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      return { rowId: data as string, targetId, count };
    },
    onSuccess: ({ targetId, count }) => {
      toast.success(`Granted ${count} generation${count === 1 ? '' : 's'} to ${targetId.slice(0, 8)}…`);
      setEmailOrId('');
      setGenerations(50);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-recent-grants'] });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes('FORBIDDEN')
        ? 'Only admins can grant credits.'
        : err?.message || 'Grant failed';
      toast.error(msg);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const targetId = await resolveUserId(revokeEmailOrId);
      const count = Number(revokeGenerations);
      if (!Number.isFinite(count) || count <= 0) throw new Error('Generations must be a positive number');
      const { data, error } = await supabase.rpc('admin_revoke_ai_credits', {
        p_target_user_id: targetId,
        p_generations: count,
        p_reason: revokeReason.trim() || null,
      });
      if (error) throw error;
      return { actualRevoked: data as number, requested: count, targetId };
    },
    onSuccess: ({ actualRevoked, requested, targetId }) => {
      if (actualRevoked === 0) {
        toast.info(`User ${targetId.slice(0, 8)}… had no purchased credits to revoke.`);
      } else if (actualRevoked < requested) {
        toast.success(
          `Revoked ${actualRevoked} of ${requested} requested (user only had ${actualRevoked}).`,
        );
      } else {
        toast.success(`Revoked ${actualRevoked} generation${actualRevoked === 1 ? '' : 's'} from ${targetId.slice(0, 8)}…`);
      }
      setRevokeEmailOrId('');
      setRevokeGenerations(10);
      setRevokeReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-recent-grants'] });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes('FORBIDDEN')
        ? 'Only admins can revoke credits.'
        : err?.message || 'Revoke failed';
      toast.error(msg);
    },
  });

  return (
    <>
      <SEOHead title="Grant AI Credits · Admin | BioSketch" />

      <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Grant AI Credits</h1>
              <p className="text-sm text-muted-foreground">Comp a user for support, promo, or apology.</p>
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Grant credits</CardTitle>
              <CardDescription>
                Credits are added to the user's purchased balance and don't expire.
                An audit row is written to <code className="text-xs bg-muted/60 px-1 rounded">ai_credit_purchases</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="emailOrId">User email or user ID</Label>
                <Input
                  id="emailOrId"
                  placeholder="user@example.com or abc12345-..."
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Email lookup is exact-match against <code className="bg-muted/60 px-1 rounded">profiles.email</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="generations">Generations</Label>
                  <Input
                    id="generations"
                    type="number"
                    min={1}
                    max={10000}
                    value={generations}
                    onChange={(e) => setGenerations(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    placeholder="e.g. Gemini outage refund, welcome promo, support ticket #123"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => grantMutation.mutate()}
                  disabled={!emailOrId || !generations || grantMutation.isPending}
                >
                  {grantMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Grant credits
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6 border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MinusCircle className="h-4 w-4 text-destructive" />
                Revoke credits
              </CardTitle>
              <CardDescription>
                Remove purchased credits — use for Stripe refunds, over-granted comps, or anti-abuse.
                Cannot revoke below zero (request is clamped). Only touches purchased balance; the free
                monthly grant is not affected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="revokeEmailOrId">User email or user ID</Label>
                <Input
                  id="revokeEmailOrId"
                  placeholder="user@example.com or abc12345-..."
                  value={revokeEmailOrId}
                  onChange={(e) => setRevokeEmailOrId(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="revokeGenerations">Generations to revoke</Label>
                  <Input
                    id="revokeGenerations"
                    type="number"
                    min={1}
                    max={10000}
                    value={revokeGenerations}
                    onChange={(e) => setRevokeGenerations(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="revokeReason">Reason (optional)</Label>
                  <Input
                    id="revokeReason"
                    placeholder="e.g. Stripe refund #ref_..., chargeback, abuse"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => revokeMutation.mutate()}
                  disabled={!revokeEmailOrId || !revokeGenerations || revokeMutation.isPending}
                  variant="destructive"
                >
                  {revokeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Revoke credits
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent admin activity</CardTitle>
              <CardDescription>Last 20 grants and revokes issued via this panel.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <p className="text-sm text-muted-foreground py-4">Loading…</p>
              ) : !recent || recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No admin activity yet.</p>
              ) : (
                <div className="rounded-lg overflow-hidden border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Date</th>
                        <th className="text-left px-3 py-2 font-semibold">Action</th>
                        <th className="text-left px-3 py-2 font-semibold">User ID</th>
                        <th className="text-left px-3 py-2 font-semibold">Generations</th>
                        <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">Session</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card/80">
                      {recent.map((g) => {
                        const isRevoke = g.stripe_session_id.startsWith('admin-revoke:');
                        return (
                          <tr key={g.id}>
                            <td className="px-3 py-2 text-foreground">
                              {format(new Date(g.created_at), 'MMM d, HH:mm')}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={
                                  isRevoke
                                    ? 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-destructive/10 text-destructive'
                                    : 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                }
                              >
                                {isRevoke ? 'Revoke' : 'Grant'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-foreground font-mono text-xs">
                              {g.user_id.slice(0, 8)}…
                            </td>
                            <td className={`px-3 py-2 tabular-nums ${isRevoke ? 'text-destructive' : 'text-foreground'}`}>
                              {g.generations_granted > 0 ? `+${g.generations_granted}` : g.generations_granted}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs font-mono hidden md:table-cell">
                              {g.stripe_session_id.slice(-12)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
