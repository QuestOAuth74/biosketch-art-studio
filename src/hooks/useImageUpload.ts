import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Canvas as FabricCanvas } from 'fabric';
import { supabase } from '@/integrations/supabase/client';

/**
 * User-facing image upload for the Simple canvas.
 *
 * Opens a native file picker constrained to SVG / PNG / JPG, validates size,
 * reads the file with real-time progress, and places it on the canvas. On
 * success also fires a silent persistence to the `user-assets` bucket so the
 * image appears in the Assets tab next time. All user-visible errors surface
 * as toasts; the persistence failure path only logs (the image is already on
 * canvas, so we don't want to noise the user for a background best-effort save).
 */

/**
 * Silent best-effort save to the user_assets registry. If any step fails we
 * `console.warn` — the image is already on the canvas, so failing to persist
 * shouldn't interrupt the user's flow. Called via `void persistToUserAssets(file)`.
 */
async function persistToUserAssets(file: File): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Anonymous / logged-out — skip persistence

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const storagePath = `${user.id}/originals/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-assets')
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.warn('[useImageUpload] user-assets upload failed:', uploadError.message);
      return;
    }

    // Best-effort dimension read for raster images (skip for SVG — its "size"
    // is style-dependent and the library UI can render it fine without it).
    let width: number | null = null;
    let height: number | null = null;
    if (file.type !== 'image/svg+xml' && file.type.startsWith('image/')) {
      try {
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 0, height: 0 });
          img.src = URL.createObjectURL(file);
        });
        width = dims.width || null;
        height = dims.height || null;
      } catch { /* ignore */ }
    }

    const { error: dbError } = await supabase.from('user_assets').insert({
      user_id: user.id,
      file_name: fileName,
      original_name: file.name,
      file_type: ext,
      mime_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      category: 'uploaded',
      tags: [],
      width,
      height,
      is_shared: false,
    });
    if (dbError) {
      console.warn('[useImageUpload] user_assets insert failed:', dbError.message);
    }
  } catch (err) {
    console.warn('[useImageUpload] persistToUserAssets failed:', err);
  }
}

const ACCEPT = 'image/svg+xml,image/png,image/jpeg,image/jpg';
const MAX_BYTES = 2000 * 1024; // 2000 KB
const ALLOWED_MIME = new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg']);

export type ImageUploadPhase =
  | 'idle'
  | 'reading'   // FileReader in-flight (has determinate progress)
  | 'decoding'; // image decoding / canvas insertion (indeterminate)

export interface ImageUploadState {
  phase: ImageUploadPhase;
  progress: number; // 0..1 during 'reading'; ignored otherwise
  fileName: string | null;
}

export function useImageUpload(canvas: FabricCanvas | null, saveState?: () => void) {
  const [state, setState] = useState<ImageUploadState>({
    phase: 'idle',
    progress: 0,
    fileName: null,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setState({ phase: 'idle', progress: 0, fileName: null });
  }, []);

  const insertRasterFromDataUrl = useCallback(async (dataUrl: string) => {
    if (!canvas) return;
    const { FabricImage } = await import('fabric');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = dataUrl;
    });

    // Fit within 60% of the current canvas size while preserving aspect
    const cw = canvas.width ?? 800;
    const ch = canvas.height ?? 600;
    const maxW = cw * 0.6;
    const maxH = ch * 0.6;
    const scale = Math.min(1, maxW / img.width, maxH / img.height);

    const fabricImage = new FabricImage(img, {
      left: (cw - img.width * scale) / 2,
      top: (ch - img.height * scale) / 2,
      scaleX: scale,
      scaleY: scale,
      crossOrigin: 'anonymous',
    });
    canvas.add(fabricImage);
    canvas.setActiveObject(fabricImage);
    canvas.requestRenderAll();
  }, [canvas]);

  const insertSvg = useCallback(async (svgText: string) => {
    if (!canvas) return;
    const { loadSVGFromString, util } = await import('fabric');
    const { objects, options } = await loadSVGFromString(svgText);
    if (!objects || objects.length === 0) throw new Error('SVG contains no visible content');
    // Group the parsed SVG objects for a single-object insert experience.
    const group: any = util.groupSVGElements(objects.filter(Boolean) as any[], options);

    const cw = canvas.width ?? 800;
    const ch = canvas.height ?? 600;
    const gw = group.width ?? 100;
    const gh = group.height ?? 100;
    const maxW = cw * 0.6;
    const maxH = ch * 0.6;
    const scale = Math.min(1, maxW / gw, maxH / gh);
    group.set({
      left: (cw - gw * scale) / 2,
      top: (ch - gh * scale) / 2,
      scaleX: scale,
      scaleY: scale,
    });
    canvas.add(group as any);
    canvas.setActiveObject(group as any);
    canvas.requestRenderAll();
  }, [canvas]);

  const handleFile = useCallback((file: File) => {
    // Validate MIME (fall back to extension for SVGs served with weird MIMEs)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isSvg = file.type === 'image/svg+xml' || ext === 'svg';
    if (!ALLOWED_MIME.has(file.type) && !isSvg) {
      toast.error('Unsupported file type', {
        description: 'Please upload an SVG, PNG, or JPG image.',
      });
      reset();
      return;
    }

    if (file.size > MAX_BYTES) {
      const kb = Math.round(file.size / 1024);
      toast.error('File too large', {
        description: `Your file is ${kb} KB; maximum is 2000 KB (2 MB).`,
      });
      reset();
      return;
    }

    setState({ phase: 'reading', progress: 0, fileName: file.name });

    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setState((s) => ({ ...s, progress: e.loaded / e.total }));
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
      reset();
    };
    reader.onload = async () => {
      setState((s) => ({ ...s, phase: 'decoding', progress: 1 }));
      try {
        if (isSvg) {
          const text = typeof reader.result === 'string' ? reader.result : new TextDecoder().decode(reader.result as ArrayBuffer);
          await insertSvg(text);
        } else {
          const dataUrl = reader.result as string;
          await insertRasterFromDataUrl(dataUrl);
        }
        toast.success('Image added');
        saveState?.();
        // Fire-and-forget: register the file in the user_assets library so it
        // appears in the Assets tab next time. Failure is silent (image is
        // already on the canvas).
        void persistToUserAssets(file);
      } catch (err) {
        console.error('Image insertion failed:', err);
        toast.error('Could not add image', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        reset();
      }
    };

    if (isSvg) reader.readAsText(file);
    else reader.readAsDataURL(file);
  }, [insertRasterFromDataUrl, insertSvg, reset, saveState]);

  const openPicker = useCallback(() => {
    if (state.phase !== 'idle') return; // Already busy; ignore
    if (!inputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPT;
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        // Reset input value so selecting the same file twice still fires change.
        input.value = '';
        if (file) handleFile(file);
      });
      document.body.appendChild(input);
      inputRef.current = input;
    }
    inputRef.current.click();
  }, [handleFile, state.phase]);

  return { state, openPicker };
}
