import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Upload, Loader2, ArrowRight, Save, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserAssets } from '@/hooks/useUserAssets';
import { useAiInvokeGuard } from '@/hooks/useAiInvokeGuard';
import { cn } from '@/lib/utils';

interface StyleTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StyleTransferDialog = ({ open, onOpenChange }: StyleTransferDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { uploadAsset } = useUserAssets();
  const { isGated, handleInvokeError } = useAiInvokeGuard();
  
  const styleFileRef = useRef<HTMLInputElement>(null);
  const contentFileRef = useRef<HTMLInputElement>(null);
  
  const [styleImage, setStyleImage] = useState<string | null>(null);
  const [contentImage, setContentImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    setImage: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleStyleTransfer = async () => {
    if (!styleImage || !contentImage) {
      toast({
        title: 'Missing images',
        description: 'Please upload both a style reference and content image',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to use style transfer',
        variant: 'destructive',
      });
      return;
    }
    if (isGated()) return;

    try {
      setIsProcessing(true);
      setProgress(10);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      setProgress(30);

      const { data, error } = await supabase.functions.invoke('apply-style-transfer', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          styleImage: styleImage,
          contentImage: contentImage,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Style transfer failed');
      }

      setProgress(90);
      setResultImage(data.resultImage);
      setProgress(100);

      toast({
        title: 'Style transfer complete!',
        description: 'Your styled icon is ready',
      });

    } catch (error: any) {
      if (await handleInvokeError(error)) {
        setIsProcessing(false);
        return;
      }
      console.error('Style transfer error:', error);

      toast({
        title: 'Style transfer failed',
        description: error.message || 'Failed to apply style. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveResult = async () => {
    if (!resultImage || !user) return;

    try {
      setIsProcessing(true);

      // Convert base64 to blob
      const base64Data = resultImage.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      const fileName = `style-transfer-${Date.now()}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      
      await uploadAsset({ 
        file,
        category: 'Generated',
        description: 'Style transfer result'
      });

      toast({
        title: 'Saved to library!',
        description: 'The styled icon has been added to your assets',
      });

      handleReset();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: error.message || 'Failed to save icon. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStyleImage(null);
    setContentImage(null);
    setResultImage(null);
    setProgress(0);
    if (styleFileRef.current) styleFileRef.current.value = '';
    if (contentFileRef.current) contentFileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Style Transfer
          </DialogTitle>
          <DialogDescription>
            Apply the visual style of one icon to another for consistent aesthetics
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Style Reference */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Style Reference</Label>
              <p className="text-xs text-muted-foreground mt-1">
                The icon whose style you want to copy
              </p>
            </div>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors min-h-[200px] flex items-center justify-center"
              onClick={() => styleFileRef.current?.click()}
            >
              {styleImage ? (
                <img src={styleImage} alt="Style reference" className="max-h-48 rounded" />
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Upload style icon</p>
                </div>
              )}
            </div>
            <input
              ref={styleFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, setStyleImage)}
            />
          </div>

          {/* Arrow indicator */}
          <div className="flex items-center justify-center">
            <ArrowRight className="h-8 w-8 text-muted-foreground" />
          </div>

          {/* Content Image */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">Content Image</Label>
              <p className="text-xs text-muted-foreground mt-1">
                The icon that will receive the new style
              </p>
            </div>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors min-h-[200px] flex items-center justify-center"
              onClick={() => contentFileRef.current?.click()}
            >
              {contentImage ? (
                <img src={contentImage} alt="Content" className="max-h-48 rounded" />
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Upload content icon</p>
                </div>
              )}
            </div>
            <input
              ref={contentFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, setContentImage)}
            />
          </div>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <Label>Processing</Label>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Applying style transfer...
            </p>
          </div>
        )}

        {/* Result */}
        {resultImage && !isProcessing && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Result</Label>
            <div className="border rounded-lg p-6 bg-muted/30 flex items-center justify-center">
              <img src={resultImage} alt="Result" className="max-h-64 rounded" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveResult} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Save to Library
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!resultImage && (
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleStyleTransfer}
              disabled={!styleImage || !contentImage || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Apply Style Transfer
                </>
              )}
            </Button>
            {(styleImage || contentImage) && (
              <Button variant="ghost" onClick={handleReset} disabled={isProcessing}>
                Reset
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
