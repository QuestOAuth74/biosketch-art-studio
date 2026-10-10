import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, ArrowLeft, Microscope, Beaker, FlaskConical, Dna, TestTube, Pill, Syringe, Brain, Heart, Atom } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/lib/toast-helpers';
import { SEOHead } from '@/components/SEO/SEOHead';
import { VerifyEmailTestIds, ToastTestIds } from '@/lib/test-ids';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const email = sessionStorage.getItem('verifyEmail') || '';
  const isResent = searchParams.get('resent') === 'true';

  // Floating lab icons configuration (same as Auth.tsx)
  const floatingIcons = [
    { Icon: Microscope, top: '10%', left: '5%', size: 48, speed: 'slow', delay: '0s' },
    { Icon: Beaker, top: '15%', right: '8%', size: 56, speed: 'medium', delay: '2s' },
    { Icon: FlaskConical, top: '45%', left: '3%', size: 44, speed: 'fast', delay: '1s' },
    { Icon: Dna, top: '65%', right: '5%', size: 52, speed: 'slow', delay: '3s' },
    { Icon: TestTube, top: '30%', right: '15%', size: 40, speed: 'medium', delay: '1.5s' },
    { Icon: Pill, top: '75%', left: '10%', size: 36, speed: 'fast', delay: '2.5s' },
    { Icon: Syringe, top: '20%', left: '20%', size: 42, speed: 'slow', delay: '4s' },
    { Icon: Brain, top: '55%', right: '20%', size: 50, speed: 'medium', delay: '0.5s' },
    { Icon: Heart, top: '85%', right: '12%', size: 46, speed: 'fast', delay: '3.5s' },
    { Icon: Atom, top: '40%', left: '15%', size: 38, speed: 'slow', delay: '1s' },
  ];

  const handleResend = async () => {
    if (!email) {
      showErrorToast("Email address not found. Please try signing up again.", ToastTestIds.VERIFY_EMAIL_RESEND_ERROR);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email
    });
    setIsLoading(false);

    if (error) {
      showErrorToast(error.message, ToastTestIds.VERIFY_EMAIL_RESEND_ERROR);
    } else {
      showSuccessToast("Verification email sent! Check your inbox.", ToastTestIds.VERIFY_EMAIL_RESEND_SUCCESS);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center notebook-page graph-paper relative overflow-hidden p-4">
      {/* Decorative notebook elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Lab Icons - styled as pencil sketches */}
        {floatingIcons.map((config, index) => {
          const IconComponent = config.Icon;
          const style: React.CSSProperties = {
            top: config.top,
            left: config.left,
            right: config.right,
            animationDelay: config.delay,
          };

          return (
            <IconComponent
              key={index}
              size={config.size}
              className={`floating-icon ${config.speed} text-[hsl(var(--pencil-gray))]/20`}
              style={style}
              aria-hidden="true"
            />
          );
        })}
      </div>

      <SEOHead
        title="Verify Email - BioSketch"
        description="Verify your email address to complete your BioSketch registration"
        noindex={true}
      />

      <Card className="w-full max-w-md paper-shadow border-2 border-[hsl(var(--pencil-gray))] bg-[hsl(var(--cream))] rotate-1 hover:rotate-0 transition-transform duration-300 relative z-10">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Mail className="h-16 w-16 text-[hsl(var(--ink-blue))]" />
          </div>
          <CardTitle className="text-4xl font-bold text-center handwritten text-[hsl(var(--ink-blue))]" data-testid={VerifyEmailTestIds.HEADING}>
            Check Your Email
          </CardTitle>
          <CardDescription className="text-center font-source-serif text-[hsl(var(--pencil-gray))]">
            {isResent
              ? "We've sent another verification link to:"
              : "We sent a verification link to:"}
          </CardDescription>
          {email && (
            <p className="text-center font-source-serif font-semibold text-[hsl(var(--ink-blue))]" data-testid={VerifyEmailTestIds.EMAIL_DISPLAY}>
              {email}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center font-source-serif text-[hsl(var(--pencil-gray))]" data-testid={VerifyEmailTestIds.VERIFICATION_MESSAGE}>
            Click the link in the email to verify your account and start creating amazing scientific illustrations.
          </p>
          <Button
            variant="sticky"
            className="w-full"
            onClick={handleResend}
            disabled={isLoading || !email}
            data-testid={VerifyEmailTestIds.RESEND_BUTTON}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Didn't receive it? Resend verification email
          </Button>
          <Button
            variant="ghost"
            className="w-full hover:bg-[hsl(var(--highlighter-yellow))]/20 text-[hsl(var(--ink-blue))]"
            onClick={() => navigate('/auth')}
            data-testid={VerifyEmailTestIds.BACK_TO_SIGNIN_BUTTON}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
