import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AcceptInvitationTestIds } from '@/lib/test-ids';

type PageState = 'loading' | 'unauthenticated' | 'ready' | 'accepting' | 'accepted' | 'already_accepted' | 'error';

interface InvitationDetails {
  pageName: string;
  inviterName: string;
  permission: 'view' | 'edit';
}

export default function AcceptPageInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [state, setState] = useState<PageState>('loading');
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [acceptedPageId, setAcceptedPageId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      fetchInvitationDetails();
    }
  }, [token, authLoading]);

  const fetchInvitationDetails = async () => {
    if (!token) { setState('error'); setErrorMessage('Invalid invitation link'); return; }

    const { data, error } = await supabase.functions.invoke('get-invitation-preview', {
      body: { token, type: 'page' },
    });

    if (error || !data || data.error) {
      if (!user) { setState('unauthenticated'); return; }
      setState('error');
      setErrorMessage('Invitation not found or the link is invalid');
      return;
    }

    if (data.acceptedAt) {
      setState('already_accepted');
      return;
    }

    setDetails({
      pageName: data.pageName ?? 'a page',
      inviterName: data.inviterName ?? 'Someone',
      permission: data.permission as 'view' | 'edit',
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

    const { error, data } = await supabase.functions.invoke('accept-page-invitation', {
      body: { token },
    });

    if (error || data?.error) {
      const msg = data?.error || error?.message || 'Failed to accept invitation';
      if (msg.includes('already')) {
        setState('already_accepted');
      } else {
        setState('error');
        setErrorMessage(msg);
      }
      return;
    }

    setAcceptedPageId(data.pageId);
    setState('accepted');
    queryClient.invalidateQueries({ queryKey: ['user-notifications', user.id] });
    toast.success('Invitation accepted!');
    setTimeout(() => navigate(`/pages/${data.pageId}`), 1500);
  };

  const handleDecline = async () => {
    if (user) {
      await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('notification_type', 'page_invitation')
        .eq('is_read', false);
      queryClient.invalidateQueries({ queryKey: ['user-notifications', user.id] });
    }
    navigate('/pages');
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
          <FileText className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle>Page Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'already_accepted' && (
            <div className="text-center space-y-3" data-testid={AcceptInvitationTestIds.ALREADY_ACCEPTED_MESSAGE}>
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              <p className="font-medium">Invitation already accepted</p>
              <Button onClick={() => navigate('/pages')}>Go to Pages</Button>
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
              <p className="font-medium">You've been added to the page!</p>
              <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
            </div>
          )}

          {state === 'unauthenticated' && (
            <div className="text-center space-y-4" data-testid={AcceptInvitationTestIds.INVITATION_DETAILS}>
              {details ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    <strong>{details.inviterName}</strong> shared <strong>"{details.pageName}"</strong> with you.
                  </p>
                  <Badge variant="outline">{details.permission === 'edit' ? 'Edit Access' : 'View Only'}</Badge>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">You've been invited to view a page.</p>
              )}
              <p className="text-sm text-muted-foreground">Sign in to accept the invitation.</p>
              <Button className="w-full" onClick={handleSignIn} data-testid={AcceptInvitationTestIds.SIGNIN_BUTTON}>
                Sign in to Accept
              </Button>
            </div>
          )}

          {state === 'ready' && details && (
            <div className="space-y-4" data-testid={AcceptInvitationTestIds.INVITATION_DETAILS}>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>{details.inviterName}</strong> shared <strong>"{details.pageName}"</strong> with you.
                </p>
                <Badge variant="outline">{details.permission === 'edit' ? 'Edit Access' : 'View Only'}</Badge>
              </div>
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
