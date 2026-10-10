import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Share2, Mail, Loader2, Palette, MousePointer2, Download, Cloud, Sparkles, CheckCircle2, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';


const shareSchema = z.object({
  senderName: z.string().max(100, 'Name must be less than 100 characters').optional(),
  recipientName: z.string().min(2, 'Recipient name is required').max(100, 'Name must be less than 100 characters'),
  recipientEmail: z.string().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters'),
  personalMessage: z.string().max(500, 'Message must be less than 500 characters').optional(),
});

export default function Share() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    senderName: user?.user_metadata?.full_name || '',
    recipientName: '',
    recipientEmail: '',
    personalMessage: "I've been using BioSketch for my scientific illustrations and thought you might find it useful too! It's completely free and has made creating diagrams so much easier.",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      const validatedData = shareSchema.parse(formData);
      
      setIsSubmitting(true);

      // Call edge function to send email
      const { data, error } = await supabase.functions.invoke('send-share-email', {
        body: {
          senderName: validatedData.senderName || 'A BioSketch User',
          recipientName: validatedData.recipientName,
          recipientEmail: validatedData.recipientEmail,
          personalMessage: validatedData.personalMessage || '',
        },
      });

      if (error) {
        console.error('Error sending share email:', error);
        toast.error('Failed to send email. Please try again.');
        return;
      }

      toast.success(`BioSketch shared successfully with ${validatedData.recipientName}!`);
      
      // Reset form
      setFormData({
        senderName: user?.user_metadata?.full_name || '',
        recipientName: '',
        recipientEmail: '',
        personalMessage: "I've been using BioSketch for my scientific illustrations and thought you might find it useful too! It's completely free and has made creating diagrams so much easier.",
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        console.error('Error sharing:', error);
        toast.error('An error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <Card className="scientific-card">
          <CardHeader className="space-y-4 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl scientific-shadow">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-4xl flex items-center gap-2">
                  Share BioSketch
                  <Sparkles className="h-6 w-6 text-secondary" />
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="scientific-card p-5 bg-accent/10">
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <div className="p-2 bg-background rounded-lg">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                Share via Email
              </h3>
              <p className="text-sm text-muted-foreground">
                Enter the details below and we'll send an email introducing BioSketch 
                to your designated person with information about its features.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senderName">Your Name (Optional)</Label>
                <Input
                  id="senderName"
                  placeholder="Your name"
                  value={formData.senderName}
                  onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient's Name *</Label>
                <Input
                  id="recipientName"
                  placeholder="Who do you want to share BioSketch with?"
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                  required
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientEmail">Recipient's Email *</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="their.email@example.com"
                  value={formData.recipientEmail}
                  onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                  required
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personalMessage">Personal Message (Optional)</Label>
                <Textarea
                  id="personalMessage"
                  placeholder="Add a personal note about why you think they'd enjoy BioSketch..."
                  value={formData.personalMessage}
                  onChange={(e) => setFormData({ ...formData, personalMessage: e.target.value })}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.personalMessage.length}/500 characters
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Share2 className="h-5 w-5 mr-2" />
                    Share BioSketch
                  </>
                )}
              </Button>
            </form>

            <div className="scientific-card p-6 bg-gradient-to-br from-secondary/10 to-accent/10">
              <h4 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-secondary" />
                What will they receive?
              </h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 mt-0.5">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Your personal message introducing BioSketch</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 mt-0.5">
                    <MousePointer2 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Overview of the intuitive drag-and-drop canvas</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 mt-0.5">
                    <Palette className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Hundreds of scientific icons across biology, chemistry, and more</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 mt-0.5">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Export options for high-quality PNG and SVG files</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 mt-0.5">
                    <Cloud className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Cloud save feature to access projects from anywhere</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Direct link to start creating immediately—100% free, no signup required</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
