import { useState, useEffect } from "react";
import { Loader2, Sparkles, X, Download, Plus, Lock } from "lucide-react";
import { TextAa } from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useAIGenerationUsage } from "@/hooks/useAIGenerationUsage";
import { useGenerationBalance } from "@/hooks/useGenerationBalance";
import { useAiInvokeGuard } from "@/hooks/useAiInvokeGuard";
import { useAuth } from "@/contexts/AuthContext";
import { InsufficientGenerationsDialog } from "@/components/credits/InsufficientGenerationsDialog";
import { PurchaseCreditsDialog } from "@/components/credits/PurchaseCreditsDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

interface AIFigureGeneratorProps {
  canvas: FabricCanvas | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGGESTIONS = [
  "EGFR to MAPK signaling cascade",
  "CRISPR-Cas9 gene editing mechanism",
  "Insulin signaling pathway",
  "T-cell activation cascade",
  "Glycolysis metabolic pathway",
  "Cell membrane with ion channels and transport proteins",
];

export function AIFigureGenerator({ canvas, open, onOpenChange }: AIFigureGeneratorProps) {
  const navigate = useNavigate();
  const { remaining, isLoading: accessLoading } = useFeatureAccess();
  const { usage, refetch: refetchUsage } = useAIGenerationUsage();
  const { user, isAdmin } = useAuth();
  // New credit system — authoritative for gating.
  const { data: balance } = useGenerationBalance();
  const { isGated, handleInvokeError } = useAiInvokeGuard();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [excludeText, setExcludeText] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);

  // canUseAI is only false when the new balance is truly exhausted (admins bypass).
  const canUseAI = isAdmin || !balance || balance.total_available > 0;

  useEffect(() => {
    if (!open) {
      setImage(null);
      setPrompt("");
      setIsGenerating(false);
      setIsInserting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => onOpenChange(false);

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) return;

    // Out-of-generations pre-check — authoritative source is the new balance
    // (grant + purchased). Open the buy/share dialog if truly empty.
    if (!isAdmin && balance && balance.total_available === 0) {
      setShowInsufficient(true);
      return;
    }
    // 24h onboarding gate — opens the waiting-period dialog if applicable.
    if (isGated()) return;

    setIsGenerating(true);
    setImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-illustrator", {
        body: { prompt: text, mode: "text-to-figure", excludeText },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Generation failed");
      if (!data.image) throw new Error("No image returned");

      setImage(data.image);
      refetchUsage();
      // Refresh the generation-balance pill immediately after a successful call.
      queryClient.invalidateQueries({ queryKey: ['generation-balance', user?.id] });
      toast.success("Figure ready — review and insert when you're happy");
    } catch (e: any) {
      if (await handleInvokeError(e)) return;
      console.error("AI figure generation failed:", e);
      const msg = e?.message?.includes("RATE_LIMITED")
        ? "Rate limited — wait a moment and try again."
        : e?.message?.includes("QUOTA_EXCEEDED")
        ? "Monthly limit reached. Share more projects to earn credits."
        : e?.message || "Failed to generate. Please try again.";
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsert = async () => {
    if (!image || !canvas) return;
    setIsInserting(true);
    try {
      const img = await FabricImage.fromURL(image, { crossOrigin: "anonymous" });
      const cw = canvas.getWidth() || 1200;
      const ch = canvas.getHeight() || 800;
      const maxW = cw * 0.7;
      const maxH = ch * 0.7;
      const iw = (img.width as number) || 1;
      const ih = (img.height as number) || 1;
      const scale = Math.min(maxW / iw, maxH / ih, 1);
      img.scale(scale);
      img.set({
        left: cw / 2 - (iw * scale) / 2,
        top: ch / 2 - (ih * scale) / 2,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      toast.success("Figure inserted into canvas");
      handleClose();
    } catch (e: any) {
      console.error("Insert failed:", e);
      toast.error(e?.message || "Failed to insert into canvas");
    } finally {
      setIsInserting(false);
    }
  };

  const handleDownloadPng = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = "biosketch-figure.png";
    a.click();
  };

  const handleStartOver = () => {
    setImage(null);
    setPrompt("");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-[#FAF9F5] border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden font-sans flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200/80 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <TextAa size={18} weight="duotone" className="text-orange-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">AI Figure Generator</h2>
              <p className="text-[11px] text-slate-500">Generate scientific figures from a text description</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {balance && !isAdmin && (
              <span
                className="text-[11px] text-slate-500 tabular-nums"
                title={`${balance.grant_remaining} free · ${balance.purchased} purchased`}
              >
                {balance.total_available === 0 ? "Out of credits" : `${balance.total_available} credits`}
              </span>
            )}
            <button onClick={handleClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Locked state — shown when balance truly empty. Offers both
              buy-now and share-projects paths so the panel disappears the
              moment credits arrive. */}
          {!canUseAI && !accessLoading && (
            <div className="flex flex-col items-center text-center py-6 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Lock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Out of generations
                </p>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-[320px]">
                  Buy more or share {usage?.needsApproved ?? remaining} more approved project{(usage?.needsApproved ?? remaining) !== 1 ? "s" : ""} to earn free ones.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setShowPurchase(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#D97757] text-white hover:bg-[#C6613F] transition-colors"
                >
                  Buy generations
                </button>
                <button
                  onClick={() => { handleClose(); navigate("/projects"); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors"
                >
                  Go to Projects
                </button>
              </div>
            </div>
          )}

          {canUseAI && (
            <>
              {/* Prompt textarea + Send */}
              <div
                className="bg-white border border-slate-200 rounded-2xl shadow-sm"
                style={{ boxShadow: "0 1px 2px -1px rgba(0,0,0,0.06), 0 4px 12px -2px rgba(0,0,0,0.04)" }}
              >
                <div className="px-3 pt-3 pb-2 space-y-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && prompt.trim() && !isGenerating) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    placeholder="Describe the figure, e.g. 'EGFR to MAPK signaling cascade'"
                    disabled={isGenerating || isInserting}
                    rows={3}
                    className="w-full bg-transparent border-0 outline-none text-slate-900 text-[15px] placeholder:text-slate-400 resize-none px-1 leading-relaxed"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={excludeText}
                        onChange={(e) => setExcludeText(e.target.checked)}
                        className="accent-slate-700 w-3 h-3"
                      />
                      Exclude text from output
                    </label>
                    <button
                      onClick={handleGenerate}
                      disabled={!prompt.trim() || isGenerating || isInserting}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-semibold transition-colors ${
                        prompt.trim() && !isGenerating
                          ? "bg-[#D97757] text-white hover:bg-[#C6613F] shadow-sm"
                          : "bg-[#D97757]/25 text-white/70 cursor-default"
                      }`}
                    >
                      {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {isGenerating ? "Generating…" : image ? "Regenerate" : "Generate"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Suggestion chips */}
              {!image && !isGenerating && (
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      disabled={isGenerating || isInserting}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Generating state */}
              {isGenerating && (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-[#D97757] rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">AI is composing your figure…</p>
                </div>
              )}

              {/* Image preview + actions */}
              {image && !isGenerating && (
                <div className="space-y-3">
                  <div
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-center"
                    style={{ maxHeight: 380 }}
                  >
                    <img src={image} alt="Generated figure" className="max-w-full max-h-[340px] object-contain" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleInsert}
                      disabled={isInserting || !canvas}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#D97757] text-white text-[12px] font-semibold hover:bg-[#C6613F] transition-colors shadow-sm disabled:opacity-60"
                    >
                      {isInserting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Insert into canvas
                    </button>
                    <button
                      onClick={handleDownloadPng}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-[12px] font-medium hover:border-slate-300 hover:text-slate-900 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PNG
                    </button>
                    <button
                      onClick={handleStartOver}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-slate-500 text-[12px] font-medium hover:text-slate-900 hover:bg-slate-100 transition-colors ml-auto"
                    >
                      Start over
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
}
