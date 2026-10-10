import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

import { SEOHead } from '@/components/SEO/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { FeaturedRecentProject } from '@/components/auth/FeaturedRecentProject';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES, FIELDS_OF_STUDY } from '@/lib/constants';
import { AuthTestIds, ToastTestIds } from '@/lib/test-ids';
import { showSuccessToast, showErrorToast } from '@/lib/toast-helpers';

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  country: z.string().min(1, 'Country is required'),
  fieldOfStudy: z.string().min(1, 'Field of study is required')
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

const updatePasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const authStyles = `
  @keyframes auth-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .auth-fade-1 { animation: auth-fade-up 0.4s ease-out 0.05s both; }
  .auth-fade-2 { animation: auth-fade-up 0.4s ease-out 0.15s both; }
`;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const OrcidIcon = () => (
  <svg width="18" height="18" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z" fill="#A6CE39"/>
    <path d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 178 93 149 93h-24.7v79.4zM88.7 56.8c0 5.5-4.5 10.1-10.1 10.1s-10.1-4.6-10.1-10.1c0-5.6 4.5-10.1 10.1-10.1s10.1 4.6 10.1 10.1z" fill="#fff"/>
  </svg>
);

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithGoogle, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailError, setResetEmailError] = useState('');
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatePasswordErrors, setUpdatePasswordErrors] = useState<any>({});

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpCountry, setSignUpCountry] = useState('');
  const [signUpFieldOfStudy, setSignUpFieldOfStudy] = useState('');

  const [signInErrors, setSignInErrors] = useState<any>({});
  const [signUpErrors, setSignUpErrors] = useState<any>({});
  const [honeypot, setHoneypot] = useState('');

  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.rpc('get_user_count').then(({ data }) => {
      if (typeof data === 'number') setUserCount(data);
    });
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    if (type === 'recovery' || type === 'magiclink') {
      setShowUpdatePassword(true);
      setShowResetPassword(false);
    }
  }, []);

  // Capture referral code from ?ref=<inviterId> so we can award the inviter
  // 3 bonus AI credits when this signup completes (handled in AuthContext
  // when the session becomes active).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      try { localStorage.setItem('biosketch_ref_inviter', ref); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (user && !loading && !showUpdatePassword && !isLoading) {
      navigate('/profile');
    }
  }, [user, loading, showUpdatePassword, isLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    setSignInErrors({});
    const result = signInSchema.safeParse({ email: signInEmail, password: signInPassword });
    if (!result.success) {
      const errors: any = {};
      result.error.errors.forEach(err => { errors[err.path[0]] = err.message; });
      setSignInErrors(errors);
      return;
    }
    setIsLoading(true);
    const { error } = await signIn(signInEmail, signInPassword);
    setIsLoading(false);
    if (error) {
      if (error.redirect) navigate(error.redirect);
    } else {
      const postAuthRedirect = sessionStorage.getItem('postAuthRedirect');
      if (postAuthRedirect) { sessionStorage.removeItem('postAuthRedirect'); navigate(postAuthRedirect); }
      else navigate('/profile');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    setSignUpErrors({});
    const result = signUpSchema.safeParse({
      email: signUpEmail, password: signUpPassword, fullName: signUpFullName,
      country: signUpCountry, fieldOfStudy: signUpFieldOfStudy
    });
    if (!result.success) {
      const errors: any = {};
      result.error.errors.forEach(err => { errors[err.path[0]] = err.message; });
      setSignUpErrors(errors);
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(signUpEmail, signUpPassword, signUpFullName, signUpCountry, signUpFieldOfStudy);
    setIsLoading(false);
    if (!error) {
      sessionStorage.setItem('verifyEmail', signUpEmail);
      navigate('/auth/verify-email');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetEmailError('');
    const result = resetPasswordSchema.safeParse({ email: resetEmail });
    if (!result.success) { setResetEmailError(result.error.errors[0].message); return; }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsLoading(false);
    if (error) showErrorToast(error.message, ToastTestIds.PASSWORD_RESET_SENT_ERROR);
    else {
      showSuccessToast("Check your email. We've sent you a password reset link.", ToastTestIds.PASSWORD_RESET_SENT_SUCCESS);
      setResetEmail(''); setShowResetPassword(false); setActiveTab('signin');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatePasswordErrors({});
    const result = updatePasswordSchema.safeParse({ password: newPassword, confirmPassword });
    if (!result.success) {
      const errors: any = {};
      result.error.errors.forEach(err => { errors[err.path[0]] = err.message; });
      setUpdatePasswordErrors(errors);
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsLoading(false);
    if (error) showErrorToast(error.message, ToastTestIds.PASSWORD_UPDATE_ERROR);
    else {
      showSuccessToast("Password updated! You can now sign in with your new password.", ToastTestIds.PASSWORD_UPDATE_SUCCESS);
      setNewPassword(''); setConfirmPassword(''); setShowUpdatePassword(false);
      await supabase.auth.signOut();
      navigate('/auth');
    }
  };

  const handleOrcidSignIn = () => {
    setIsLoading(true);
    const redirectUri = `${window.location.origin}/auth`;
    const orcidClientId = 'APP-0A87BIJ2IWCK2ZCV';
    window.location.href = `https://orcid.org/oauth/authorize?client_id=${orcidClientId}&response_type=code&scope=/authenticate&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    window.history.replaceState({}, '', '/auth');

    const exchangeCode = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('orcid-auth', {
          body: { code, redirectUri: `${window.location.origin}/auth` },
        });
        if (error || !data?.success) {
          let detail = data?.error || 'ORCID sign-in failed';
          if (error && typeof error.context?.json === 'function') {
            try { const errBody = await error.context.json(); detail = errBody?.error || detail; } catch {}
          }
          showErrorToast(detail, ToastTestIds.AUTH_SIGNIN_ERROR);
          setIsLoading(false);
          return;
        }
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        const postAuthRedirect = sessionStorage.getItem('postAuthRedirect');
        if (postAuthRedirect) { sessionStorage.removeItem('postAuthRedirect'); navigate(postAuthRedirect); }
        else navigate('/profile');
      } catch {
        showErrorToast('ORCID sign-in failed', ToastTestIds.AUTH_SIGNIN_ERROR);
      }
      setIsLoading(false);
    };
    exchangeCode();
  }, []);

  const inputClass = "h-11 bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-xl transition-all text-slate-900 placeholder:text-slate-400 px-4";
  const labelClass = "text-[13px] font-semibold text-slate-900";
  const errorClass = "text-xs text-red-500 mt-1";
  const btnPrimary = "w-full h-11 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white transition-all active:scale-[0.99]";
  const btnOutline = "w-full h-11 rounded-xl font-medium bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-900 transition-all active:scale-[0.99] gap-2 flex items-center justify-center";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #E8F0FF 0%, #F5F9FF 50%, #FFFFFF 100%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #E8F0FF 0%, #F5F9FF 50%, #FFFFFF 100%)' }}
    >
      <style>{authStyles}</style>

      {/* Ambient blobs */}
      <div className="fixed inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-200/15 rounded-full blur-3xl" />
      </div>

      <SEOHead title="Sign In - BioSketch" description="Sign in to BioSketch" noindex={true} />

      {/* Back to home link */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 z-10 flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors auth-fade-1"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </button>

      {/* Logo */}
      <div className="relative z-10 text-center mb-6 auth-fade-1">
        <button onClick={() => navigate('/')} className="inline-flex flex-col items-center group" aria-label="BioSketch home">
          <img
            src="https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0"
            alt="BioSketch"
            className="h-48 w-48 object-contain rounded-2xl shadow-xl transition-transform group-hover:scale-105"
          />
        </button>
      </div>

      {/* Auth card + featured project (side-by-side on desktop) */}
      <div className="relative z-10 w-full flex flex-col lg:flex-row items-center justify-center gap-6 auth-fade-2">
        <div className="w-full max-w-[400px]">
        <div className="rounded-2xl bg-white border border-slate-200 p-7 shadow-xl shadow-slate-900/5">

          {showUpdatePassword ? (
            <>
              <h1 className="text-[20px] font-bold text-slate-900 mb-1" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Set new password</h1>
              <p className="text-sm text-slate-500 mb-6">Enter your new password below.</p>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className={labelClass}>New password</Label>
                  <Input id="new-password" type="password" placeholder="••••••••" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading}
                    data-testid={AuthTestIds.UPDATE_PASSWORD_INPUT} className={inputClass} />
                  {updatePasswordErrors.password && <p className={errorClass} data-testid={AuthTestIds.UPDATE_ERROR_PASSWORD}>{updatePasswordErrors.password}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className={labelClass}>Confirm password</Label>
                  <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading}
                    data-testid={AuthTestIds.UPDATE_CONFIRM_INPUT} className={inputClass} />
                  {updatePasswordErrors.confirmPassword && <p className={errorClass} data-testid={AuthTestIds.UPDATE_ERROR_CONFIRM}>{updatePasswordErrors.confirmPassword}</p>}
                </div>
                <Button type="submit" className={btnPrimary} disabled={isLoading} data-testid={AuthTestIds.UPDATE_SUBMIT_BUTTON}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update password
                </Button>
              </form>
            </>
          ) : showResetPassword ? (
            <>
              <button
                onClick={() => { setShowResetPassword(false); setResetEmail(''); setResetEmailError(''); }}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 mb-4 transition-colors"
                data-testid={AuthTestIds.RESET_BACK_BUTTON}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h1 className="text-[20px] font-bold text-slate-900 mb-1" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Reset password</h1>
              <p className="text-sm text-slate-500 mb-6">We'll send a reset link to your email.</p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className={labelClass}>Email address</Label>
                  <Input id="reset-email" type="email" placeholder="you@example.com" value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)} disabled={isLoading}
                    data-testid={AuthTestIds.RESET_EMAIL_INPUT} className={inputClass} />
                  {resetEmailError && <p className={errorClass} data-testid={AuthTestIds.RESET_ERROR_EMAIL}>{resetEmailError}</p>}
                </div>
                <Button type="submit" className={btnPrimary} disabled={isLoading} data-testid={AuthTestIds.RESET_SEND_BUTTON}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>
            </>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="mb-6">
                <h1 className="text-[22px] font-bold text-slate-900 mb-1" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
                  {activeTab === 'signin' ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="text-sm text-slate-500">
                  {activeTab === 'signin' ? 'Sign in to continue to BioSketch' : 'Start creating in seconds — no credit card required'}
                </p>
              </div>

              <TabsList className="grid w-full grid-cols-2 mb-5 h-10 rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="signin" data-testid={AuthTestIds.TAB_SIGNIN} className="text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-600 transition-all">Sign in</TabsTrigger>
                <TabsTrigger value="signup" data-testid={AuthTestIds.TAB_SIGNUP} className="text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-600 transition-all">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-0">
                {/* OAuth buttons first — faster conversion */}
                <div className="space-y-2.5 mb-5">
                  <Button type="button" className={btnOutline} disabled={isLoading}
                    onClick={() => { setIsLoading(true); signInWithGoogle(); }}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </Button>
                  <Button type="button" className={btnOutline} disabled={isLoading} onClick={handleOrcidSignIn}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <OrcidIcon />}
                    Continue with ORCID
                  </Button>
                </div>

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase tracking-widest">
                    <span className="bg-white px-3 text-slate-400 font-medium">or email</span>
                  </div>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="absolute opacity-0 top-0 left-0 h-0 w-0 -z-10 overflow-hidden" aria-hidden="true">
                    <input type="text" id="website_url" name="website_url" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email" className={labelClass}>Email</Label>
                    <Input id="signin-email" type="email" placeholder="you@example.com" value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)} disabled={isLoading}
                      data-testid={AuthTestIds.SIGNIN_EMAIL_INPUT} className={inputClass} />
                    {signInErrors.email && <p className={errorClass} data-testid={AuthTestIds.SIGNIN_ERROR_EMAIL}>{signInErrors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password" className={labelClass}>Password</Label>
                      <button type="button" onClick={() => setShowResetPassword(true)}
                        data-testid={AuthTestIds.FORGOT_PASSWORD_LINK}
                        className="text-xs font-medium text-slate-900 hover:text-slate-700 transition-colors">
                        Forgot?
                      </button>
                    </div>
                    <Input id="signin-password" type="password" placeholder="••••••••" value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)} disabled={isLoading}
                      data-testid={AuthTestIds.SIGNIN_PASSWORD_INPUT} className={inputClass} />
                    {signInErrors.password && <p className={errorClass} data-testid={AuthTestIds.SIGNIN_ERROR_PASSWORD}>{signInErrors.password}</p>}
                  </div>
                  <Button type="submit" className={btnPrimary} disabled={isLoading} data-testid={AuthTestIds.SIGNIN_SUBMIT_BUTTON}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                {/* OAuth buttons first */}
                <div className="space-y-2.5 mb-5">
                  <Button type="button" className={btnOutline} disabled={isLoading}
                    onClick={() => { setIsLoading(true); signInWithGoogle(); }}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </Button>
                  <Button type="button" className={btnOutline} disabled={isLoading} onClick={handleOrcidSignIn}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <OrcidIcon />}
                    Continue with ORCID
                  </Button>
                </div>

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase tracking-widest">
                    <span className="bg-white px-3 text-slate-400 font-medium">or email</span>
                  </div>
                </div>

                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="absolute opacity-0 top-0 left-0 h-0 w-0 -z-10 overflow-hidden" aria-hidden="true">
                    <input type="text" id="company_name" name="company_name" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className={labelClass}>Full name</Label>
                    <Input id="signup-name" type="text" placeholder="Jane Scientist" value={signUpFullName}
                      onChange={(e) => setSignUpFullName(e.target.value)} disabled={isLoading}
                      data-testid={AuthTestIds.SIGNUP_NAME_INPUT} className={inputClass} />
                    {signUpErrors.fullName && <p className={errorClass} data-testid={AuthTestIds.SIGNUP_ERROR_NAME}>{signUpErrors.fullName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className={labelClass}>Email</Label>
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)} disabled={isLoading}
                      data-testid={AuthTestIds.SIGNUP_EMAIL_INPUT} className={inputClass} />
                    {signUpErrors.email && <p className={errorClass} data-testid={AuthTestIds.SIGNUP_ERROR_EMAIL}>{signUpErrors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password" className={labelClass}>Password</Label>
                    <Input id="signup-password" type="password" placeholder="6+ characters" value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)} disabled={isLoading}
                      data-testid={AuthTestIds.SIGNUP_PASSWORD_INPUT} className={inputClass} />
                    {signUpErrors.password && <p className={errorClass} data-testid={AuthTestIds.SIGNUP_ERROR_PASSWORD}>{signUpErrors.password}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-country" className={labelClass}>Country</Label>
                      <Select value={signUpCountry} onValueChange={setSignUpCountry} disabled={isLoading}>
                        <SelectTrigger id="signup-country" data-testid={AuthTestIds.SIGNUP_COUNTRY_SELECT}
                          className="h-11 bg-white border border-slate-200 focus:border-slate-900 rounded-xl text-slate-900">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[280px]">
                          {COUNTRIES.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {signUpErrors.country && <p className={errorClass} data-testid={AuthTestIds.SIGNUP_ERROR_COUNTRY}>{signUpErrors.country}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-field" className={labelClass}>Field</Label>
                      <Select value={signUpFieldOfStudy} onValueChange={setSignUpFieldOfStudy} disabled={isLoading}>
                        <SelectTrigger id="signup-field" data-testid={AuthTestIds.SIGNUP_FIELD_SELECT}
                          className="h-11 bg-white border border-slate-200 focus:border-slate-900 rounded-xl text-slate-900">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELDS_OF_STUDY.map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {signUpErrors.fieldOfStudy && <p className={errorClass} data-testid={AuthTestIds.SIGNUP_ERROR_FIELD}>{signUpErrors.fieldOfStudy}</p>}
                    </div>
                  </div>
                  <Button type="submit" className={btnPrimary + " mt-2"} disabled={isLoading} data-testid={AuthTestIds.SIGNUP_SUBMIT_BUTTON}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create account
                  </Button>
                  <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                    By signing up, you agree to our{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-slate-900 font-medium hover:underline">
                      terms and privacy policy
                    </a>.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Social proof footer */}
        {userCount !== null && !showUpdatePassword && !showResetPassword && (
          <p className="text-center text-xs text-slate-500 mt-5" style={{ fontFamily: 'Inter, sans-serif' }}>
            Join <span className="font-semibold text-slate-900">{userCount.toLocaleString()}+</span> scientists already using BioSketch.Art
          </p>
        )}
        </div>

        {/* Featured recent project (hidden on mobile for compact auth view) */}
        <div className="hidden lg:block">
          <FeaturedRecentProject />
        </div>
      </div>
    </div>
  );
}
