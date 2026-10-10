import { useState, useCallback, useEffect } from 'react';
import { FileText, Upload, Loader2, Lock, Info, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAIGenerationUsage } from '@/hooks/useAIGenerationUsage';
import { useGenerationBalance } from '@/hooks/useGenerationBalance';
import { useAuth } from '@/contexts/AuthContext';
import { InsufficientGenerationsDialog } from '@/components/credits/InsufficientGenerationsDialog';
import { PurchaseCreditsDialog } from '@/components/credits/PurchaseCreditsDialog';
import { useQueryClient } from '@tanstack/react-query';
import { usePowerPointGenerationStatus } from '@/hooks/usePowerPointGenerationStatus';
import { useActiveGeneration } from '@/hooks/useActiveGeneration';
import { usePowerPointGenerations } from '@/hooks/usePowerPointGenerations';
import { AgentProgressPanel } from '@/components/powerpoint/AgentProgressPanel';
import { PowerPointGenerationList } from '@/components/admin/PowerPointGenerationList';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEO/SEOHead';

const PowerPointMaker = () => {
  const { hasAccess, remaining } = useFeatureAccess();
  const { user, isAdmin } = useAuth();
  const { usage, isLoading: quotaLoading, refetch: refetchQuota } = useAIGenerationUsage();
  // New credit system — authoritative for gating. Old `usage` still drives some
  // trial-banner UI but should NOT block generation on its own.
  const { data: balance } = useGenerationBalance();
  const queryClient = useQueryClient();
  // canUseAI: admins bypass, otherwise gated on the new balance.
  const canUseAI = isAdmin || !balance || balance.total_available > 0;
  const isTrial = usage?.mode === 'trial';
  const isTrialExhausted = usage?.mode === 'trial-exhausted';
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const navigate = useNavigate();

  // Auto-detect any in-progress generation (survives page navigation)
  const { data: activeGeneration } = useActiveGeneration();
  useEffect(() => {
    if (activeGeneration?.id && !activeGenerationId) {
      setActiveGenerationId(activeGeneration.id);
    }
  }, [activeGeneration, activeGenerationId]);

  const { data: generationStatus } = usePowerPointGenerationStatus(activeGenerationId);
  const { downloadGeneration, generations } = usePowerPointGenerations();

  const onDrop = useCallback((files: File[]) => {
    if (!isAdmin && balance && balance.total_available === 0) {
      setShowInsufficient(true);
      return;
    }
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  }, [isAdmin, balance]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDrop,
  });

  const handleGenerate = async () => {
    // Out-of-generations pre-check — authoritative source is the new balance
    // (grant + purchased). Open the buy/share dialog if truly empty.
    if (!isAdmin && balance && balance.total_available === 0) {
      setShowInsufficient(true);
      return;
    }
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

      // Create database record
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

      setActiveGenerationId(generation.id);

      // Call edge function (fire and forget)
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
      toast.success('Generation started!');
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      if (error.message?.includes('PREMIUM_REQUIRED')) {
        toast.error('Premium access required', {
          description: `Share ${remaining} more approved projects to unlock`,
        });
      } else if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
        toast.error('Monthly limit reached', {
          description: 'Your AI generation quota resets on the 1st of each month.',
        });
      } else {
        toast.error('Failed to upload document');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Notify when generation completes
  useEffect(() => {
    if (generationStatus?.status === 'completed' && activeGenerationId) {
      toast.success('PowerPoint is ready!', { duration: 5000 });
    } else if (generationStatus?.status === 'failed' && activeGenerationId) {
      toast.error('Generation failed', {
        description: generationStatus.error_message || 'Unknown error',
        duration: 8000,
      });
    }
  }, [generationStatus?.status, activeGenerationId]);

  // Show progress panel as soon as we have an activeGenerationId — even before poll returns
  const hasActiveGeneration = !!activeGenerationId;
  const statusLoaded = !!generationStatus;
  const isProcessing = hasActiveGeneration && (!statusLoaded || generationStatus?.status === 'processing');
  const isCompleted = hasActiveGeneration && generationStatus?.status === 'completed';
  const isFailed = hasActiveGeneration && generationStatus?.status === 'failed';

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
      <SEOHead
        title="PowerPoint Generator - BioSketch"
        description="Generate scientific PowerPoint presentations from Word documents"
        noindex={true}
      />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-8 w-8 text-[#1e3a8a]" />
          PowerPoint Generator
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload a Word document and AI will create a scientific presentation
        </p>
      </div>

      {/* Trial banner */}
      {isTrial && (
        <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-lg flex items-start gap-3 border border-emerald-200 dark:border-emerald-800">
          <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              Free trial: {usage?.trialRemaining ?? usage?.remaining ?? 0} of 3 AI generations left
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              Share 3 approved projects to unlock the full monthly credits
            </p>
          </div>
        </div>
      )}

      {/* Feature lock notice — shown only after trial exhausted AND balance truly empty
          so the banner disappears the moment the user buys credits. */}
      {isTrialExhausted && balance?.total_available === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3 mb-3">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-amber-900 dark:text-amber-100">Free trial used (3/3)</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Buy more or share {usage?.needsApproved ?? 3} approved project{(usage?.needsApproved ?? 3) !== 1 ? 's' : ''} to earn free ones.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-8">
            <Button
              size="sm"
              onClick={() => setShowPurchase(true)}
            >
              Buy generations
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/projects')}
            >
              Go to Projects
            </Button>
          </div>
        </div>
      )}

      {/* Balance display — non-admin users; sourced from the new balance so
          purchases + grant refreshes are reflected immediately. */}
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

      {/* Upload area */}
      {!isProcessing && (
        <div>
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
              isDragActive && 'border-primary bg-primary/5',
              !canUseAI && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input {...getInputProps()} disabled={!canUseAI} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium">
              {selectedFile ? selectedFile.name : 'Drop your .docx file here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse (max 10MB)</p>
          </div>

          {selectedFile && (
            <Button
              onClick={handleGenerate}
              disabled={!canUseAI || isUploading}
              className="w-full mt-4"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate PowerPoint
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Agent Progress Panel — shows immediately when generation starts */}
      {hasActiveGeneration && (
        <div className="space-y-4">
          <AgentProgressPanel
            currentStep={generationStatus?.current_step ?? null}
            status={generationStatus?.status ?? 'processing'}
            errorMessage={generationStatus?.error_message ?? null}
          />

          {isCompleted && generationStatus?.storage_path && (
            <Button
              onClick={() =>
                downloadGeneration({
                  id: generationStatus.id,
                  storage_path: generationStatus.storage_path,
                  generated_filename: generationStatus.generated_filename,
                } as any)
              }
              className="w-full"
              size="lg"
            >
              <Download className="mr-2 h-4 w-4" />
              Download PowerPoint
            </Button>
          )}

          {(isCompleted || isFailed) && (
            <Button
              variant="outline"
              onClick={() => setActiveGenerationId(null)}
              className="w-full"
            >
              Start New Generation
            </Button>
          )}
        </div>
      )}

      {/* Generation History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Generation History</h2>
        <PowerPointGenerationList />
      </div>

      <InsufficientGenerationsDialog
        open={showInsufficient}
        onOpenChange={setShowInsufficient}
      />
      <PurchaseCreditsDialog
        open={showPurchase}
        onOpenChange={setShowPurchase}
      />
    </div>
  );
};

export default PowerPointMaker;
