import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';

export default function EmailPreview() {
  const navigate = useNavigate();
  const [activeTemplate, setActiveTemplate] = useState<'signup' | 'recovery'>('signup');

  const logoUrl = "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/sign/icon%20site/biosketch%20art-min.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zOWUxYTMwMi1lYjJkLTQxOGUtYjdkZS1hZGE0M2NhNTI0NDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpY29uIHNpdGUvYmlvc2tldGNoIGFydC1taW4ucG5nIiwiaWF0IjoxNzYwODM2MjgxLCJleHAiOjIwNzYxOTYyODF9.LDw-xwHK6WmdeLwiG_BwtT0jX3N6fjdOvZmoUcI4FP0";

  const getConfirmationEmailHtml = (confirmationUrl: string, email: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 40px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 40px 20px; max-width: 560px; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${logoUrl}" width="48" height="48" alt="BioSketch" style="margin: 0 auto; object-fit: contain;">
    </div>
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 24px;">Welcome to BioSketch!</h1>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      Thanks for signing up! Please confirm your email address to get started.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${confirmationUrl}" style="background-color: #16a34a; border-radius: 6px; color: #fff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 12px 24px; display: inline-block;">
        Confirm Email Address
      </a>
    </div>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      If you didn't create an account with BioSketch, you can safely ignore this email.
    </p>
    <div style="border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 24px;">
      <p style="color: #8c8c8c; font-size: 12px; line-height: 20px; margin: 0;">
        This email was sent to ${email}. If you have questions, contact us at <a href="mailto:support@biosketch.art" style="color: #16a34a; text-decoration: underline;">support@biosketch.art</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

  const getRecoveryEmailHtml = (confirmationUrl: string, email: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; margin: 0; padding: 40px 0;">
  <div style="background-color: #ffffff; margin: 0 auto; padding: 40px 20px; max-width: 560px; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="${logoUrl}" width="48" height="48" alt="BioSketch" style="margin: 0 auto; object-fit: contain;">
    </div>
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 24px;">Reset Your Password</h1>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      We received a request to reset your password for your BioSketch account. Click the button below to choose a new password.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${confirmationUrl}" style="background-color: #16a34a; border-radius: 6px; color: #fff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 12px 24px; display: inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color: #525252; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
      This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
    </p>
    <div style="border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 24px;">
      <p style="color: #8c8c8c; font-size: 12px; line-height: 20px; margin: 0;">
        This email was sent to ${email}. If you have questions, contact us at <a href="mailto:support@biosketch.art" style="color: #16a34a; text-decoration: underline;">support@biosketch.art</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

  const sampleEmail = 'user@example.com';
  const sampleUrl = 'https://biosketch.art/auth?token=sample-verification-token';

  const templateHtml = activeTemplate === 'signup'
    ? getConfirmationEmailHtml(sampleUrl, sampleEmail)
    : getRecoveryEmailHtml(sampleUrl, sampleEmail);

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/admin')}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Admin
      </Button>

      <h1 className="text-3xl font-bold mb-6">Email Template Preview</h1>

      <Tabs value={activeTemplate} onValueChange={(v) => setActiveTemplate(v as 'signup' | 'recovery')}>
        <TabsList className="mb-6">
          <TabsTrigger value="signup">Signup Verification</TabsTrigger>
          <TabsTrigger value="recovery">Password Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTemplate} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Sample email template with data: {sampleEmail}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <iframe
                srcDoc={templateHtml}
                className="w-full h-[600px] border rounded"
                sandbox="allow-same-origin"
                title="Email Preview"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
