import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, ChevronDown, ChevronUp, ImageIcon, RefreshCw, BookOpen, Save, Trash2, FolderOpen, ExternalLink, Pin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSavedReferenceImages } from '@/hooks/useSavedReferenceImages';
import { useAiInvokeGuard } from '@/hooks/useAiInvokeGuard';

interface AIReferenceChatProps {
  onUseAsGuide: (imageDataUrl: string, size: 'small' | 'medium' | 'large') => void;
  onPinToCanvas?: (imageDataUrl: string) => void;
}

export const AIReferenceChat = ({ onUseAsGuide, onPinToCanvas }: AIReferenceChatProps) => {
  const { user, isAdmin } = useAuth();
  const { isGated, handleInvokeError } = useAiInvokeGuard();
  const [collapsed, setCollapsed] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [lastPrompt, setLastPrompt] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [savedPage, setSavedPage] = useState(0);
  const SAVED_PER_PAGE = 4;

  const {
    savedImages,
    loading: savedLoading,
    saving,
    saveReferenceImage,
    deleteReferenceImage,
    getImageUrl,
  } = useSavedReferenceImages();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    if (!user) {
      toast.error('Please sign in to use AI Reference Guide');
      return;
    }
    if (isGated()) return;

    setLoading(true);
    setResultImage(null);
    setSources([]);
    setIsSaved(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired. Please sign in again.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-reference-image', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { prompt: prompt.trim() },
      });

      if (error) {
        // supabase.functions.invoke wraps non-2xx responses as FunctionsHttpError
        // Try to parse the JSON body for a user-friendly message
        let errorBody: any = null;
        try {
          if (error.context?.body) {
            const reader = error.context.body.getReader?.();
            if (reader) {
              const { value } = await reader.read();
              errorBody = JSON.parse(new TextDecoder().decode(value));
            }
          }
        } catch { /* ignore parse failures */ }

        const serverMsg = errorBody?.error || error.message || '';
        if (serverMsg.includes('limit') || serverMsg.includes('RATE_LIMIT')) {
          setRemaining(0);
          toast.error('Generation limit reached (3 per month). Please try again later.');
          return;
        }
        if (serverMsg.includes('Premium') || serverMsg.includes('PREMIUM_REQUIRED')) {
          toast.error('Premium access required to generate reference images.');
          return;
        }
        throw new Error(serverMsg || 'Generation failed');
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Generation failed');
      }

      setResultImage(data.image);
      setSources(data.sources || []);
      setLastPrompt(prompt.trim());
      if (data.remaining !== undefined && data.remaining !== null) {
        setRemaining(data.remaining);
      }
    } catch (error: any) {
      if (await handleInvokeError(error)) return;
      console.error('AI reference generation failed:', error);
      const msg = error?.message || 'Failed to generate reference image';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (lastPrompt) {
      setPrompt(lastPrompt);
      handleGenerate();
    }
  };

  const handleSave = async () => {
    if (!resultImage || !lastPrompt) return;
    const success = await saveReferenceImage({
      imageDataUrl: resultImage,
      prompt: lastPrompt,
      sources,
    });
    if (success) setIsSaved(true);
  };

  const handleLoadSaved = (ref: typeof savedImages[0]) => {
    const imageUrl = getImageUrl(ref.storage_path);
    setResultImage(imageUrl);
    setSources(ref.sources || []);
    setLastPrompt(ref.prompt);
    setPrompt(ref.prompt);
    setIsSaved(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      handleGenerate();
    }
  };

  if (collapsed) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCollapsed(false)}
        className="h-8 gap-1.5 bg-background/80 backdrop-blur-sm shadow-sm"
        title="AI Reference Guide"
      >
        <Sparkles className="h-3.5 w-3.5" />
        AI Guide
        <ChevronDown className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <div className="w-80 bg-background border border-border rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Reference Guide</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCollapsed(true)}>
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Prompt input */}
      <div className="p-3 border-b">
        <div className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the illustration..."
            disabled={loading}
            className="text-sm h-9"
          />
          <Button
            size="sm"
            className="h-9 px-3"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim() || (!isAdmin && remaining === 0)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {!user && (
          <p className="text-xs text-muted-foreground mt-2">Sign in to use AI Reference Guide</p>
        )}
        {user && !isAdmin && remaining !== null && (
          <p className={`text-xs mt-2 ${remaining === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {remaining === 0
              ? 'Limit reached (3 per 30 days)'
              : `${remaining}/3 generations remaining`}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1 min-h-0">
        {/* Result */}
        <div className="p-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating reference image...</p>
            </div>
          )}

          {!loading && !resultImage && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <ImageIcon className="h-10 w-10 opacity-30" />
              <p className="text-sm text-center">Describe the scientific illustration you want to create</p>
            </div>
          )}

          {!loading && resultImage && (
            <div className="space-y-3">
              <img
                src={resultImage}
                alt="AI generated reference"
                className="w-full rounded-lg border"
                draggable={false}
              />

              {/* Sources */}
              {sources.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-medium">Sources</p>
                  </div>
                  {sources.map((source, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground leading-snug pl-4">
                      {source}
                    </p>
                  ))}
                </div>
              )}

              {/* Size buttons */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Use as canvas guide:</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => onUseAsGuide(resultImage, 'small')}
                  >
                    Small
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => onUseAsGuide(resultImage, 'medium')}
                  >
                    Medium
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => onUseAsGuide(resultImage, 'large')}
                  >
                    Large
                  </Button>
                </div>
              </div>

              {/* Pin to Canvas */}
              {onPinToCanvas && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={() => onPinToCanvas(resultImage)}
                >
                  <Pin className="h-3.5 w-3.5 mr-1.5" />
                  Pin as Reference on Canvas
                </Button>
              )}

              {/* Save & Regenerate */}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleSave}
                  disabled={saving || isSaved}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {isSaved ? 'Saved' : 'Save'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleRegenerate}
                  disabled={loading || (!isAdmin && remaining === 0)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Saved References Section */}
        {user && (
          <div className="border-t">
            <button
              type="button"
              className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/30 transition-colors"
              onClick={() => { setShowSaved(!showSaved); setSavedPage(0); }}
            >
              <div className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">
                  Saved References{savedImages.length > 0 ? ` (${savedImages.length})` : ''}
                </span>
              </div>
              {showSaved ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {showSaved && (
              <div className="px-3 pb-3">
                {savedLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!savedLoading && savedImages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No saved references yet
                  </p>
                )}

                {!savedLoading && savedImages.length > 0 && (() => {
                  const totalPages = Math.ceil(savedImages.length / SAVED_PER_PAGE);
                  const pageImages = savedImages.slice(
                    savedPage * SAVED_PER_PAGE,
                    (savedPage + 1) * SAVED_PER_PAGE
                  );
                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-0.5">
                        {pageImages.map((ref) => (
                          <div
                            key={ref.id}
                            className="group relative rounded-lg border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                            onClick={() => handleLoadSaved(ref)}
                            title={ref.prompt}
                          >
                            <img
                              src={getImageUrl(ref.storage_path)}
                              alt={ref.prompt}
                              className="w-full aspect-square object-cover"
                              draggable={false}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                              <p className="text-[10px] text-white leading-tight line-clamp-2">
                                {ref.prompt}
                              </p>
                            </div>
                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="p-1 rounded bg-black/50 text-white hover:bg-primary/80"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUseAsGuide(getImageUrl(ref.storage_path), 'medium');
                                }}
                                title="Use as guide"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded bg-black/50 text-white hover:bg-red-500/80"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteReferenceImage(ref.id);
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={savedPage === 0}
                            onClick={() => setSavedPage((p) => p - 1)}
                          >
                            <ChevronDown className="h-3 w-3 rotate-90 mr-0.5" />
                            Prev
                          </Button>
                          <span className="text-[10px] text-muted-foreground">
                            {savedPage + 1} / {totalPages}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={savedPage >= totalPages - 1}
                            onClick={() => setSavedPage((p) => p + 1)}
                          >
                            Next
                            <ChevronDown className="h-3 w-3 -rotate-90 ml-0.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
