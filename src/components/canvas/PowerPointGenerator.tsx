import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, FileText, Upload, Loader2, Info } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAIGenerationUsage } from '@/hooks/useAIGenerationUsage';
import { useGenerationBalance } from '@/hooks/useGenerationBalance';
import { useAiInvokeGuard } from '@/hooks/useAiInvokeGuard';
import { useAuth } from '@/contexts/AuthContext';
import { InsufficientGenerationsDialog } from '@/components/credits/InsufficientGenerationsDialog';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface PowerPointGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PowerPointGenerator = ({ open, onOpenChange }: PowerPointGeneratorProps) => {
  const { hasAccess, remaining } = useFeatureAccess();
  const { user, isAdmin } = useAuth();
  const { usage, isLoading: quotaLoading, refetch: refetchQuota } = useAIGenerationUsage();
  // New credit system — authoritative for gating.
  const { data: balance } = useGenerationBalance();
  const { isGated } = useAiInvokeGuard();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const navigate = useNavigate();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDrop: (files) => {
      if (!isAdmin && balance && balance.total_available === 0) {
        setShowInsufficient(true);
        return;
      }
      if (isGated()) return;
      if (files.length > 0) {
        setSelectedFile(files[0]);
      }
    },
  });

  const handleGenerate = async () => {
    // Out-of-generations pre-check — authoritative source is the new balance
    // (grant + purchased). Open the buy/share dialog if truly empty.
    if (!isAdmin && balance && balance.total_available === 0) {
      setShowInsufficient(true);
      return;
    }
    if (isGated()) return;

    if (!selectedFile) {
      toast.error('Please select a Word document first');
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${Date.now()}-${selectedFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('ppt-word-uploads')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Create database record so the /powerpoint page can track progress
      const { data: generation, error: insertError } = await supabase
        .from('powerpoint_generations')
        .insert({
          user_id: user.id,
          original_filename: selectedFile.name,
          generated_filename: selectedFile.name.replace('.docx', '.pptx'),
          template_name: 'scientific-report',
          storage_path: '',
          word_doc_path: fileName,
          status: 'processing',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Invoke edge function (fire and forget)
      supabase.functions.invoke('generate-powerpoint', {
        body: {
          generationId: generation.id,
          wordDocPath: fileName,
          templateId: 'scientific-report',
        },
      }).catch((err) => {
        console.error('Edge function error:', err);
      });

      refetchQuota();
      // Refresh the generation-balance pill immediately after a successful call.
      queryClient.invalidateQueries({ queryKey: ['generation-balance', user?.id] });

      toast.success('Generation started!', {
        description: 'View progress on the PowerPoint page.',
        action: {
          label: 'View Progress',
          onClick: () => navigate('/powerpoint')
        }
      });

      setSelectedFile(null);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Upload error:', error);

      if (error.message?.includes('PREMIUM_REQUIRED')) {
        toast.error('Premium access required', {
          description: `Share ${remaining} more approved projects to unlock`,
          action: {
            label: 'View Projects',
            onClick: () => navigate('/projects')
          }
        });
      } else if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
        toast.error('Monthly limit reached', {
          description: 'Your AI generation quota resets on the 1st of each month.',
          duration: 5000
        });
      } else {
        toast.error('Failed to start generation');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PowerPoint Generator
          </DialogTitle>
        </DialogHeader>

        {!isAdmin && balance?.total_available === 0 && (
          <div className="bg-muted p-4 rounded-lg flex items-start gap-3">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium text-sm">Out of generations</p>
              <p className="text-xs text-muted-foreground mt-1">
                Buy more or share {remaining} more approved project{remaining !== 1 ? 's' : ''} to earn free ones.
              </p>
            </div>
          </div>
        )}

        {balance && !isAdmin && balance.total_available > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg flex items-start gap-3 border border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                AI Generations: {balance.total_available} available
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {balance.grant_remaining} free · {balance.purchased} purchased · shared across BioSketch tools
              </p>
            </div>
          </div>
        )}

        {(() => {
          const outOfCredits = !isAdmin && balance?.total_available === 0;
          return (
            <>
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  isDragActive && 'border-primary bg-primary/5',
                  outOfCredits && 'opacity-50 cursor-not-allowed'
                )}
              >
                <input {...getInputProps()} disabled={outOfCredits} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {selectedFile ? selectedFile.name : 'Drop your .docx file here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse (max 10MB)
                </p>
              </div>

              {selectedFile && (
                <Button
                  onClick={handleGenerate}
                  disabled={outOfCredits || isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting generation...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate PowerPoint
                    </>
                  )}
                </Button>
              )}
            </>
          );
        })()}
      </DialogContent>
      <InsufficientGenerationsDialog
        open={showInsufficient}
        onOpenChange={setShowInsufficient}
      />
    </Dialog>
  );
};
