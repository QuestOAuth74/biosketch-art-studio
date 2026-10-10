import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AcceptInvitationTestIds } from '@/lib/test-ids';

type PageState = 'loading' | 'unauthenticated' | 'ready' | 'accepting' | 'accepted' | 'declined' | 'expired' | 'already_accepted' | 'error';

interface InvitationDetails {
  groupName: string;
  inviterName: string;
}

export default function AcceptGroupInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [state, setState] = useState<PageState>('loading');
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!authLoading) {
      fetchInvitationDetails();
    }
  }, [token, authLoading]);

  const fetchInvitationDetails = async () => {
    if (!token) { setState('error'); setErrorMessage('Invalid invitation link'); return; }

    const { data, error } = await supabase.functions.invoke('get-invitation-preview', {
      body: { token, type: 'group' },
    });

    if (error || !data || data.error) {
      setState('error');
      setErrorMessage('Invitation not found or the link is invalid');
      return;
    }

    if (data.acceptedAt) {
      setState('already_accepted');
      return;
    }

    if (new Date(data.expiresAt) < new Date()) {
      setState('expired');
      return;
    }

    setDetails({
      groupName: data.groupName ?? 'the group',
      inviterName: data.inviterName ?? 'Someone',
    });

    setState(user ? 'ready' : 'unauthenticated');
  };

  const handleSignIn = () => {
    sessionStorage.setItem('postAuthRedirect', window.location.pathname);
    navigate('/auth');
  };

  const handleAccept = async () => {
    if (!user) { handleSignIn(); return; }
    setState('accepting');

    const { error, data } = await supabase.functions.invoke('accept-group-invitation', {
      body: { token },
    });

    if (error || data?.error) {
      const msg = data?.error || error?.message || 'Failed to accept invitation';
      if (msg.includes('expired')) {
        setState('expired');
      } else if (msg.includes('already')) {
        setState('already_accepted');
      } else {
        setState('error');
        setErrorMessage(msg);
      }
      return;
    }

    setState('accepted');
    queryClient.invalidateQueries({ queryKey: ['user-notifications', user.id] });
    toast.success(`You've joined ${details?.groupName}!`);
    setTimeout(() => navigate(`/groups/${data.groupId}`), 1500);
  };

  const handleDecline = async () => {
    if (!user) { navigate('/groups'); return; }
    await supabase.functions.invoke('accept-group-invitation', {
      body: { token, action: 'decline' },
    });
    // Mark related notifications as read on decline
    await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('notification_type', 'group_invitation')
      .eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['user-notifications', user.id] });
    setState('declined');
  };

  if (authLoading || state === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh] p-4" data-testid={AcceptInvitationTestIds.PAGE_CONTAINER}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Users className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle>Group Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'expired' && (
            <div className="text-center space-y-3" data-testid={AcceptInvitationTestIds.EXPIRED_MESSAGE}>
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="font-medium">This invitation has expired</p>
              <p className="text-sm text-muted-foreground">Ask the group manager to send a new invitation.</p>
              <Button variant="outline" onClick={() => navigate('/groups')}>Go to Groups</Button>
            </div>
          )}

          {state === 'already_accepted' && (
            <div className="text-center space-y-3" data-testid={AcceptInvitationTestIds.ALREADY_ACCEPTED_MESSAGE}>
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              <p className="font-medium">Invitation already accepted</p>
              <Button onClick={() => navigate('/groups')}>Go to Groups</Button>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center space-y-3" data-testid={AcceptInvitationTestIds.ERROR_MESSAGE}>
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <Button variant="outline" onClick={() => navigate('/')}>Go to Home</Button>
            </div>
          )}

          {state === 'accepted' && (
            <div className="text-center space-y-3">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              <p className="font-medium">You've joined {details?.groupName}!</p>
              <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
            </div>
          )}

          {state === 'declined' && (
            <div className="text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-medium">Invitation declined</p>
              <p className="text-sm text-muted-foreground">Changed your mind? You can still accept using the original link.</p>
              <Button variant="outline" onClick={() => setState('ready')}>Accept Instead</Button>
            </div>
          )}

          {state === 'unauthenticated' && (
            <div className="text-center space-y-4" data-testid={AcceptInvitationTestIds.INVITATION_DETAILS}>
              <p className="text-sm text-muted-foreground">
                <strong>{details?.inviterName}</strong> invited you to join <strong>{details?.groupName}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">Sign in to accept the invitation.</p>
              <Button className="w-full" onClick={handleSignIn} data-testid={AcceptInvitationTestIds.SIGNIN_BUTTON}>
                Sign in to Accept
              </Button>
            </div>
          )}

          {state === 'ready' && details && (
            <div className="space-y-4" data-testid={AcceptInvitationTestIds.INVITATION_DETAILS}>
              <p className="text-center text-sm text-muted-foreground">
                <strong>{details.inviterName}</strong> invited you to join <strong>{details.groupName}</strong>.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDecline}
                  data-testid={AcceptInvitationTestIds.DECLINE_BUTTON}
                >
                  Decline
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAccept}
                  data-testid={AcceptInvitationTestIds.ACCEPT_BUTTON}
                >
                  Accept Invitation
                </Button>
              </div>
            </div>
          )}

          {state === 'accepting' && (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Accepting invitation...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
