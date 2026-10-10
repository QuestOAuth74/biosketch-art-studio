import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X, Type, Sparkles, MousePointerClick } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildRectMaskPng, type MaskBox } from '@/lib/regionRefine';

interface TextItem {
  text: string;
  bbox: [number, number, number, number]; // normalized 0..1 [x0,y0,x1,y1]
  // Refined-mode font attributes, forwarded to refine-image so the redraw
  // matches the original text style with explicit numbers instead of a vague
  // "match the style" instruction. All optional — a missing field just means
  // that attribute won't appear in the refine-image prompt.
  fontFamily?: string;
  fontSize?: number;   // approximate point size given the image is 1000 px tall
  bold?: boolean;
  color?: string;      // hex, e.g. "#1A1A1A"
}

interface TextEditOverlayProps {
  imageUrl: string;
  onSubmit: (args: {
    maskImage: string;
    box: MaskBox;
    oldText: string;
    newText: string;
    fontMeta?: {
      family?: string;
      size?: number;
      bold?: boolean;
      color?: string;
    };
  }) => Promise<void> | void;
  onClose: () => void;
  submitting?: boolean;
}

/**
 * "Edit text" overlay for AI Illustrator.
 *
 * Flow:
 *   1. Opens → calls detect-text (gemini-2.5-flash) on the image to get every
 *      label as {text, bbox}. Bboxes are normalized 0..1.
 *   2. Renders each detection as a clickable outlined rectangle overlaid on
 *      the image. Click one → sidebar shows an input pre-filled with the
 *      current text.
 *   3. On Apply → we build a same-size rect mask covering just the selected
 *      bbox (with a small pad so the executor can safely erase antialiased
 *      edges), then hand it to the parent which routes through refine-image
 *      mode=text-edit + compositeWithMask.
 *
 * Detection is absorbed (no credit). The edit itself costs 1 credit — same
 * as every other refine.
 */
export function TextEditOverlay({
  imageUrl,
  onSubmit,
  onClose,
  submitting = false,
}: TextEditOverlayProps) {
  const [detecting, setDetecting] = useState(true);
  const [items, setItems] = useState<TextItem[]>([]);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [newText, setNewText] = useState('');
  const imgRef = useRef<HTMLImageElement | null>(null);
  // The visible image sub-rectangle inside the `object-contain` container.
  // getBoundingClientRect returns the CONTAINER dimensions; when the image
  // aspect ratio differs from the container's, `object-contain` letterboxes
  // and the visible image occupies only part of the container. Bboxes from
  // detect-text are normalized against the natural image, so overlays must
  // be positioned inside the visible sub-rectangle (offset + scaled), not
  // the container box, or they drift.
  const [visibleImg, setVisibleImg] = useState<{
    w: number;
    h: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // ESC closes unless a request is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && !detecting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting, detecting]);

  // Kick off detection as soon as the overlay mounts. We only need the image
  // itself, not its display dimensions — bboxes are normalized.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDetecting(true);
      setDetectError(null);
      try {
        // Server-side Gemini Flash detection via the detect-text edge fn —
        // the last-known-good approach. Returns [{text, bbox}] with bbox
        // already normalized 0..1 against the natural image, so the overlay
        // and mask code use it directly.
        const { data, error } = await supabase.functions.invoke('detect-text', {
          body: { image: imageUrl },
        });
        if (cancelled) return;
        if (error) {
          let friendly = '';
          try {
            const eBody = await (error as any).context?.json?.();
            if (eBody?.message) friendly = String(eBody.message);
          } catch { /* ignore */ }
          throw new Error(friendly || error.message || 'Could not read this image.');
        }
        if (!data?.success) {
          throw new Error(data?.message || 'Could not read this image. Try re-uploading and running the tool again.');
        }
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[TextEditOverlay] detection failed:', err);
        setDetectError(err?.message || 'Failed to detect text');
        setItems([]);
      } finally {
        if (!cancelled) setDetecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const selected = selectedIdx !== null ? items[selectedIdx] : null;

  // When the user picks a detection, seed the input with the detected string
  // so they can edit rather than type from scratch.
  useEffect(() => {
    if (selected) setNewText(selected.text);
  }, [selectedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Build a rect mask around the selected bbox in original image coords, then
   * hand off to the parent. We inflate the bbox by a small padding so the
   * text-edit prompt has enough room to fill in the antialiased edges of the
   * old glyphs without leaving ghost pixels at the border.
   */
  const handleApply = async () => {
    if (!selected || selected.text === newText.trim() || newText.trim().length === 0) return;
    // Load the image just to get its natural dimensions for the mask.
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = imageUrl;
    });
    const [x0, y0, x1, y1] = selected.bbox;
    const padFrac = 0.01; // 1% of image size — enough for antialiased edges without swallowing neighbors.
    const padX = Math.round(padFrac * dims.w);
    const padY = Math.round(padFrac * dims.h);
    const px0 = Math.max(0, Math.round(x0 * dims.w) - padX);
    const py0 = Math.max(0, Math.round(y0 * dims.h) - padY);
    const px1 = Math.min(dims.w, Math.round(x1 * dims.w) + padX);
    const py1 = Math.min(dims.h, Math.round(y1 * dims.h) + padY);
    const box: MaskBox = { x: px0, y: py0, w: px1 - px0, h: py1 - py0 };
    const maskImage = await buildRectMaskPng(imageUrl, box);
    // Font metadata from refined detect-text — passed through so refine-image
    // can put explicit numbers into the redraw prompt instead of "match the
    // style" hand-wave. Every field is optional; missing ones simply won't
    // appear in the prompt.
    const fontMeta = (selected.fontFamily || selected.fontSize || selected.bold !== undefined || selected.color)
      ? {
          family: selected.fontFamily,
          size: selected.fontSize,
          bold: selected.bold,
          color: selected.color,
        }
      : undefined;
    await onSubmit({
      maskImage,
      box,
      oldText: selected.text,
      newText: newText.trim(),
      fontMeta,
    });
  };

  // Track the visible image sub-rectangle inside the object-contain
  // container. Re-computes on resize AND once the image finishes loading
  // (naturalWidth/naturalHeight aren't available until then).
  useEffect(() => {
    if (!imgRef.current) return;
    const el = imgRef.current;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const nw = el.naturalWidth;
      const nh = el.naturalHeight;
      if (rect.width <= 0 || rect.height <= 0 || nw <= 0 || nh <= 0) return;
      const imgAspect = nw / nh;
      const boxAspect = rect.width / rect.height;
      let w: number, h: number, offsetX: number, offsetY: number;
      if (imgAspect > boxAspect) {
        // Image is wider than the container — letterbox top and bottom.
        w = rect.width;
        h = rect.width / imgAspect;
        offsetX = 0;
        offsetY = (rect.height - h) / 2;
      } else {
        // Image is taller (or equal ratio) — letterbox left and right.
        h = rect.height;
        w = rect.height * imgAspect;
        offsetX = (rect.width - w) / 2;
        offsetY = 0;
      }
      setVisibleImg({ w, h, offsetX, offsetY });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // If the image is still decoding when the effect fires, natural{Width,Height}
    // are 0 — re-run on load. If already complete, this is a no-op.
    if (el.complete) update();
    else el.addEventListener('load', update);
    return () => {
      ro.disconnect();
      el.removeEventListener('load', update);
    };
  }, []);

  const overlays = useMemo(() => {
    if (!visibleImg || items.length === 0) return null;
    return items.map((it, i) => {
      const [x0, y0, x1, y1] = it.bbox;
      const style = {
        left: `${visibleImg.offsetX + x0 * visibleImg.w}px`,
        top: `${visibleImg.offsetY + y0 * visibleImg.h}px`,
        width: `${(x1 - x0) * visibleImg.w}px`,
        height: `${(y1 - y0) * visibleImg.h}px`,
      };
      const isSelected = i === selectedIdx;
      return (
        <button
          key={i}
          type="button"
          onClick={() => setSelectedIdx(i)}
          className={`absolute rounded-sm border-2 cursor-pointer transition-all group ${
            isSelected
              ? 'border-primary bg-primary/10 shadow-[0_0_0_2px_rgba(255,255,255,0.6)]'
              : 'border-emerald-400/70 bg-emerald-400/5 hover:border-emerald-500 hover:bg-emerald-400/10'
          }`}
          style={style}
          title={it.text}
        >
          {/* Small text tag anchored to the top-left of the box so users know
              what the AI thinks the label says, without hovering. */}
          <span
            className={`absolute -top-5 left-0 text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
              isSelected ? 'bg-primary text-white' : 'bg-emerald-600 text-white opacity-0 group-hover:opacity-100 transition-opacity'
            }`}
          >
            {it.text.length > 24 ? it.text.substring(0, 24) + '…' : it.text}
          </span>
        </button>
      );
    });
  }, [items, visibleImg, selectedIdx]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">Edit text in figure</h3>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 p-4">
          {/* Canvas — image with clickable text overlays */}
          <div className="relative flex items-center justify-center min-h-0 bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            <div className="relative inline-block">
              <img
                ref={imgRef}
                src={imageUrl}
                alt=""
                className="max-h-[70vh] max-w-full object-contain rounded-sm"
                draggable={false}
              />
              {visibleImg && overlays}
              {detecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md">
                    <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
                    <span className="text-xs font-medium text-slate-700">Detecting text…</span>
                  </div>
                </div>
              )}
              {!detecting && items.length === 0 && !detectError && (
                <div className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-white/95 backdrop-blur-sm px-4 py-1.5 shadow border border-slate-200 text-xs text-slate-600">
                  No text detected in this figure.
                </div>
              )}
              {detectError && (
                <div className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-red-50 border border-red-200 px-4 py-1.5 shadow text-xs text-red-700">
                  {detectError}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — instructions + inline editor */}
          <div className="flex flex-col min-h-0 gap-3">
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/70 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <MousePointerClick className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  How to use
                </span>
              </div>
              <ol className="text-xs text-slate-600 space-y-1 list-decimal ml-4">
                <li>Click any highlighted label on the figure.</li>
                <li>Edit the text in the box below.</li>
                <li>Apply — the AI redraws just that label. 1 credit.</li>
              </ol>
            </div>

            <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Selected label
              </div>
              {!selected ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400 text-center px-3">
                  {detecting ? 'Waiting for detection…' : 'Click a label on the image to edit it.'}
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Current text
                    </label>
                    <div className="text-xs text-slate-700 rounded-md bg-slate-50 px-2 py-1.5 border border-slate-200 select-text">
                      {selected.text}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      New text
                    </label>
                    <Input
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder="Type replacement text…"
                      disabled={submitting}
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="text-[10.5px] text-slate-500 leading-relaxed">
                    The AI will replace only this label, matching the original font and color. Everything else stays pixel-identical.
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={
                    submitting ||
                    !selected ||
                    newText.trim().length === 0 ||
                    newText.trim() === selected.text
                  }
                  className="h-8 text-xs flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Editing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Apply · 1c
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
