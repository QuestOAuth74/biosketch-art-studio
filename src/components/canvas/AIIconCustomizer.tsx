import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2, Replace, Pencil, FlaskConical, Paintbrush } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FabricObject, FabricImage, Canvas as FabricCanvas } from 'fabric';
import { useCanvas } from '@/contexts/CanvasContext';
import { useAiInvokeGuard } from '@/hooks/useAiInvokeGuard';

interface AIIconCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetObject: FabricObject | null;
}

const STYLES = [
  { id: 'pencil', label: 'Pencil', icon: Pencil, description: 'Hand-drawn sketch' },
  { id: 'biomedical', label: 'Biomedical', icon: FlaskConical, description: 'Clean vector style' },
  { id: 'oil', label: 'Oil Paint', icon: Paintbrush, description: 'Rich painterly style' },
] as const;

type StyleId = typeof STYLES[number]['id'];

/**
 * Remove white/near-white background from an image, making it transparent.
 * Uses a threshold to handle anti-aliased edges gracefully.
 */
function removeWhiteBackground(dataUrl: string, threshold = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const { data } = imageData;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // If pixel is white or near-white, make it transparent
        if (r >= threshold && g >= threshold && b >= threshold) {
          data[i + 3] = 0; // Set alpha to 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for background removal'));
    img.src = dataUrl;
  });
}

export function AIIconCustomizer({ open, onOpenChange, targetObject }: AIIconCustomizerProps) {
  const { canvas, saveStateWithLabel } = useCanvas();
  const { isGated, handleInvokeError } = useAiInvokeGuard();
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<StyleId>('biomedical');
  const [generating, setGenerating] = useState(false);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const targetRef = useRef<FabricObject | null>(null);

  // Rasterize the icon when dialog opens
  useEffect(() => {
    if (open && targetObject) {
      targetRef.current = targetObject;
      rasterizeIcon(targetObject);
      setGeneratedImage(null);
      setPrompt('');
    }
  }, [open, targetObject]);

  const rasterizeIcon = (obj: FabricObject) => {
    try {
      // Render at 2x for quality
      const canvasEl = obj.toCanvasElement({ multiplier: 2 });

      // Composite onto a white background so Gemini doesn't see/reproduce
      // a checkerboard transparency pattern
      const w = canvasEl.width;
      const h = canvasEl.height;
      const bg = document.createElement('canvas');
      bg.width = w;
      bg.height = h;
      const ctx = bg.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(canvasEl, 0, 0);

      setOriginalPreview(bg.toDataURL('image/png'));
    } catch (err) {
      console.error('Failed to rasterize icon:', err);
      toast.error('Failed to capture icon preview');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !originalPreview) return;
    if (isGated()) return;

    setGenerating(true);
    setGeneratedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke('customize-icon', {
        body: {
          image: originalPreview,
          prompt: prompt.trim(),
          style,
        },
      });

      if (error) {
        // Parse the error body if available
        const errorBody = typeof error === 'object' && 'context' in error
          ? error
          : null;
        throw new Error(errorBody?.message || error.message || 'Generation failed');
      }

      if (!data?.success || !data?.image) {
        throw new Error(data?.error || 'No image returned');
      }

      // Remove white background to get true transparency
      const transparentImage = await removeWhiteBackground(data.image);
      setGeneratedImage(transparentImage);
    } catch (err: any) {
      if (await handleInvokeError(err)) return;
      console.error('AI icon customization error:', err);
      const message = err.message || 'Failed to customize icon';

      if (message.includes('PREMIUM_REQUIRED') || message.includes('Premium access required')) {
        toast.error('Premium access required. Share 3+ projects to unlock AI features.');
      } else if (message.includes('RATE_LIMIT') || message.includes('generation limit')) {
        toast.error('Monthly AI generation limit reached. Resets on the 1st.');
      } else {
        toast.error(message);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleReplace = async () => {
    if (!generatedImage || !targetRef.current || !canvas) return;

    try {
      const original = targetRef.current;
      const origLeft = original.left ?? 0;
      const origTop = original.top ?? 0;
      const origAngle = original.angle ?? 0;
      const origScaleX = original.scaleX ?? 1;
      const origScaleY = original.scaleY ?? 1;
      const origWidth = original.getScaledWidth();
      const origHeight = original.getScaledHeight();

      // Load the generated image
      const img = await FabricImage.fromURL(generatedImage, { crossOrigin: 'anonymous' });

      // Scale the new image to match the original icon's dimensions
      const imgWidth = img.width ?? 100;
      const imgHeight = img.height ?? 100;
      const fitScaleX = origWidth / imgWidth;
      const fitScaleY = origHeight / imgHeight;
      // Use uniform scale to maintain aspect ratio
      const fitScale = Math.min(fitScaleX, fitScaleY);

      img.set({
        left: origLeft,
        top: origTop,
        scaleX: fitScale,
        scaleY: fitScale,
        angle: origAngle,
        originX: original.originX,
        originY: original.originY,
      });

      // Remove original and add new
      canvas.remove(original);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      saveStateWithLabel('AI Icon Customization');

      toast.success('Icon replaced with AI variant');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to replace icon:', err);
      toast.error('Failed to replace icon');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Customize Icon with AI
          </DialogTitle>
          <DialogDescription>
            Describe how you want to modify this icon. AI will generate a new variant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Previews */}
          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Original</Label>
              <div className="aspect-square rounded-xl border border-border/50 bg-muted/20 flex items-center justify-center p-4 overflow-hidden">
                {originalPreview ? (
                  <img
                    src={originalPreview}
                    alt="Original icon"
                    className="max-w-full max-h-full object-contain"
                    style={{ imageRendering: 'auto' }}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">No preview</div>
                )}
              </div>
            </div>

            {/* AI Result */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Result</Label>
              <div className="aspect-square rounded-xl border border-border/50 bg-muted/20 flex items-center justify-center p-4 overflow-hidden">
                {generating ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Generating...</span>
                  </div>
                ) : generatedImage ? (
                  <img
                    src={generatedImage}
                    alt="AI generated icon"
                    className="max-w-full max-h-full object-contain"
                    style={{ imageRendering: 'auto' }}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground text-center">
                    Enter a prompt and click Generate
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Style Picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style</Label>
            <div className="flex gap-2">
              {STYLES.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${
                      style === s.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border/50 hover:border-border'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${style === s.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{s.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{s.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Modification Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Make it red and more detailed, add a phospholipid bilayer, simplify the structure..."
              rows={3}
              maxLength={500}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim() && !generating) {
                  handleGenerate();
                }
              }}
            />
            <p className="text-xs text-muted-foreground text-right">{prompt.length}/500</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            {generatedImage && (
              <Button
                onClick={handleReplace}
                className="gap-2"
              >
                <Replace className="h-4 w-4" />
                Replace Icon
              </Button>
            )}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              variant={generatedImage ? 'outline' : 'default'}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  {generatedImage ? 'Regenerate' : 'Generate'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
