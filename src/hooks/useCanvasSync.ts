import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Canvas as FabricCanvas } from 'fabric';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { CANVAS_CUSTOM_PROPS } from '@/contexts/CanvasContext';
import { restoreObjectCustomProps, runPostLoadGlobalSteps } from '@/lib/canvasPostProcessing';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 500;

/**
 * Maximum base64-encoded compressed string length.
 * Base64 expands binary by ~33%, so this keeps the total JSON payload
 * well under Supabase Realtime's 1 MB per-message hard limit.
 */
const MAX_COMPRESSED_CHARS = 870_000;

// ─── Compression helpers ───────────────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compress(str: string): Promise<string> {
  const bytes = new TextEncoder().encode(str);
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

  return uint8ArrayToBase64(merged);
}

async function decompress(b64: string): Promise<string> {
  const bytes = base64ToUint8Array(b64);
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

  return new TextDecoder().decode(merged);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CanvasSyncPayload {
  version: 2;
  senderId: string;
  compressed: string; // gzip-compressed, base64-encoded canvas JSON
}

export interface UseCanvasSyncOptions {
  isLocked: boolean;
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useCanvasSync(
  projectId: string | null,
  canvas: FabricCanvas | null,
  userId: string | null | undefined,
  options: UseCanvasSyncOptions,
) {
  const channelRef   = useRef<RealtimeChannel | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);  // suppress events during apply
  const tooLargeRef  = useRef(false);  // track to avoid repeated toasts

  // ─── Broadcast: serialize → compress → send ──────────────────────────────
  const broadcastCanvas = useCallback(async () => {
    if (!canvas || !channelRef.current || !userId) return;
    if (isSyncingRef.current) return;

    // Filter on LIVE objects where JS flags (isGridLine, isEndpointMarker, etc.)
    // are reliably set — fabric's toObject() may not serialise them.
    const allObjects = canvas.getObjects();
    const userObjects = allObjects.filter((obj: any) =>
      !obj.isGridLine &&
      !obj.isRuler &&
      !obj.excludeFromExport &&
      !obj.isControlHandle &&
      !obj.isHandleLine &&
      !obj.isAnchorHandle &&
      !obj.isGuideLine &&
      !obj.isEraserPath &&
      !obj.isPortIndicator &&
      !obj.isFeedback &&
      !obj.isEndpointMarker
    );

    // Serialize each object, manually ensuring custom props are included.
    // fabric's toObject(propertiesToInclude) can miss arbitrary JS properties;
    // the project-save path in CanvasContext does the same manual copy.
    const data: Record<string, unknown> = {
      version: '6.0.0',
      objects: userObjects.map((obj: any) => {
        const objData = obj.toObject(CANVAS_CUSTOM_PROPS);
        CANVAS_CUSTOM_PROPS.forEach(prop => {
          if (obj[prop] !== undefined) {
            objData[prop] = obj[prop];
          }
        });
        // Convert Map to plain object for JSON serialization
        if (obj.originalColors instanceof Map) {
          objData.originalColors = Object.fromEntries(obj.originalColors);
        }
        return objData;
      }),
    };

    const json = JSON.stringify(data);
    const compressed = await compress(json);

    if (compressed.length > MAX_COMPRESSED_CHARS) {
      if (!tooLargeRef.current) {
        tooLargeRef.current = true;
        toast.warning('Canvas is too large for live collaboration sync. Other collaborators will not see your changes until you save.', {
          duration: 6000,
        });
      }
      return;
    }

    // Clear the too-large flag if the canvas shrank back within limits
    if (tooLargeRef.current) {
      tooLargeRef.current = false;
      toast.success('Live collaboration sync resumed');
    }

    const payload: CanvasSyncPayload = { version: 2, senderId: userId, compressed };
    channelRef.current.send({ type: 'broadcast', event: 'canvas-snapshot', payload });
  }, [canvas, userId]);

  const scheduleSnapshot = useCallback(() => {
    if (isSyncingRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(broadcastCanvas, DEBOUNCE_MS);
  }, [broadcastCanvas]);

  // ─── Apply incoming snapshot: decompress → loadFromJSON → post-process ────
  const applyIncoming = useCallback(async (payload: CanvasSyncPayload) => {
    if (!canvas) return;

    isSyncingRef.current = true;
    try {
      const json = await decompress(payload.compressed);
      const data = JSON.parse(json) as { objects?: unknown[] } & Record<string, unknown>;

      // Save viewport so the collaborator's view doesn't jump
      const savedVpt = canvas.viewportTransform
        ? ([...canvas.viewportTransform] as [number, number, number, number, number, number])
        : undefined;

      await canvas.loadFromJSON(data);

      // Restore all custom properties (membranes, lines, connectors, etc.)
      if (data.objects) {
        const loadedObjects = canvas.getObjects();
        (data.objects as Record<string, unknown>[]).forEach((objData, i) => {
          const obj = loadedObjects[i];
          if (obj && objData) restoreObjectCustomProps(obj, objData);
        });
      }

      // Clean up any stray UI elements that may have leaked through
      const strayUI = canvas.getObjects().filter((obj: any) =>
        obj.isGridLine || obj.isRuler
      );
      strayUI.forEach(obj => canvas.remove(obj));

      // Reconnect lines, rasterize membranes, reload CORS images, etc.
      await runPostLoadGlobalSteps(canvas);

      if (savedVpt) canvas.setViewportTransform(savedVpt);

      // Signal FabricCanvas to re-render grid/ruler overlays, which were
      // destroyed by loadFromJSON replacing all canvas objects.
      canvas.fire('sync:applied' as any);

      canvas.requestRenderAll();
    } catch (err) {
      console.error('[useCanvasSync] Failed to apply incoming snapshot:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [canvas]);

  // ─── Subscribe to Supabase Realtime channel ───────────────────────────────
  useEffect(() => {
    if (!projectId || !canvas || !userId) return;

    const channel = supabase.channel(`sync:${projectId}`);

    channel.on('broadcast', { event: 'canvas-snapshot' }, ({ payload }) => {
      const p = payload as CanvasSyncPayload;
      if (p.senderId === userId) return; // ignore own broadcasts
      if (options.isLocked) return;
      applyIncoming(p);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, canvas, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Listen to canvas events → schedule broadcast ────────────────────────
  useEffect(() => {
    if (!canvas) return;

    // Skip UI-only objects (grids, rulers, etc.) — these are local overlays
    // that should never trigger a broadcast to other collaborators.
    const scheduleIfUserObject = (e: any) => {
      const t = e.target;
      if (t?.isGridLine || t?.isRuler || t?.isGuideLine || t?.isControlHandle ||
          t?.isHandleLine || t?.isAnchorHandle || t?.isPortIndicator ||
          t?.isFeedback) return;
      scheduleSnapshot();
    };

    canvas.on('object:modified',     scheduleIfUserObject);
    canvas.on('object:added',        scheduleIfUserObject);
    canvas.on('object:removed',      scheduleIfUserObject);
    canvas.on('path:created',        scheduleSnapshot);
    canvas.on('text:editing:exited', scheduleSnapshot);
    // Eraser: the brush fires a brush-level "end" event which FabricCanvas promotes
    // to a canvas-level "erasing:end" event so we can pick it up here.
    (canvas as any).on('erasing:end', scheduleSnapshot);

    return () => {
      canvas.off('object:modified',     scheduleIfUserObject);
      canvas.off('object:added',        scheduleIfUserObject);
      canvas.off('object:removed',      scheduleIfUserObject);
      canvas.off('path:created',        scheduleSnapshot);
      canvas.off('text:editing:exited', scheduleSnapshot);
      (canvas as any).off('erasing:end', scheduleSnapshot);
    };
  }, [canvas, scheduleSnapshot]);
}
