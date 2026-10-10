import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const STORAGE_KEY = 'biosketch_icon_downloads';
const ANON_LIMIT = 1;
const AUTH_LIMIT = 10;

interface DownloadQuota {
  downloads_used: number;
  can_download: boolean;
  remaining: number;
}

function getStoredDownloadCount(userId?: string): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;
    const parsed = JSON.parse(stored);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    if (parsed.month !== monthKey) return 0;
    const key = userId || 'anon';
    return parsed[key] || 0;
  } catch {
    return 0;
  }
}

function incrementStoredDownloadCount(userId?: string): void {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const key = userId || 'anon';
  let parsed: any = {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      parsed = JSON.parse(stored);
      if (parsed.month !== monthKey) {
        parsed = { month: monthKey };
      }
    }
  } catch { /* ignore */ }
  parsed.month = monthKey;
  parsed[key] = (parsed[key] || 0) + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}

export const useIconDownloadQuota = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['icon-download-quota', user?.id],
    queryFn: async (): Promise<DownloadQuota> => {
      const limit = user ? AUTH_LIMIT : ANON_LIMIT;
      const used = getStoredDownloadCount(user?.id);
      return {
        downloads_used: used,
        can_download: used < limit,
        remaining: Math.max(limit - used, 0),
      };
    },
    staleTime: 1000 * 30,
  });
};

export const useIconDownload = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const downloadIcon = useCallback(async (
    iconId: string,
    iconName: string,
    svgContent: string,
    format: 'svg' | 'png',
    pngSize: number = 512
  ): Promise<boolean> => {
    const limit = user ? AUTH_LIMIT : ANON_LIMIT;
    const used = getStoredDownloadCount(user?.id);

    if (used >= limit) {
      if (!user) {
        toast.error('Download limit reached', {
          description: 'Sign in to download more free icons.',
          action: {
            label: 'Sign In',
            onClick: () => { window.location.href = '/auth'; },
          },
        });
      } else {
        toast.error(`Monthly download limit reached (${AUTH_LIMIT}/month)`, {
          description: 'Try again next month.',
        });
      }
      return false;
    }

    try {
      const transparentSvg = stripSvgBackground(svgContent);

      if (format === 'svg') {
        const blob = new Blob([transparentSvg], { type: 'image/svg+xml' });
        triggerDownload(blob, `${iconName}.svg`);
      } else {
        const blob = await svgToPng(transparentSvg, pngSize);
        triggerDownload(blob, `${iconName}.png`);
      }

      // Track download locally
      incrementStoredDownloadCount(user?.id);

      // Record download in Supabase
      const insertData: any = {
        icon_id: iconId,
        download_format: format,
      };
      if (user) {
        insertData.user_id = user.id;
      }
      await (supabase as any).from('icon_downloads').insert(insertData);

      // Invalidate caches so sidebar and counts update
      queryClient.invalidateQueries({ queryKey: ['icon-download-quota'] });
      queryClient.invalidateQueries({ queryKey: ['icon-sidebar'] });
      queryClient.invalidateQueries({ queryKey: ['icon-detail', iconId] });
      queryClient.invalidateQueries({ queryKey: ['icon-gallery'] });

      toast.success(`${format.toUpperCase()} downloaded`);
      return true;
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Download failed');
      return false;
    }
  }, [user, queryClient]);

  return { downloadIcon };
};

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function svgToPng(svgContent: string, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (pngBlob) => {
          if (pngBlob) resolve(pngBlob);
          else reject(new Error('PNG conversion failed'));
        },
        'image/png'
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG for PNG conversion'));
    };

    img.src = url;
  });
}

function stripSvgBackground(svgContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svg = doc.documentElement;

  // Remove background rects that are direct children of the SVG root
  const children = Array.from(svg.children);
  for (const child of children) {
    if (child.tagName === 'rect') {
      const fill = (child.getAttribute('fill') || '').toLowerCase();
      const width = child.getAttribute('width');
      const height = child.getAttribute('height');
      const svgWidth = svg.getAttribute('width') || svg.getAttribute('viewBox')?.split(' ')[2];
      const svgHeight = svg.getAttribute('height') || svg.getAttribute('viewBox')?.split(' ')[3];

      // Remove if it's a full-size rect with white/near-white fill
      const isFullSize = (width === '100%' || width === svgWidth) &&
                         (height === '100%' || height === svgHeight);
      const isWhite = fill === '#fff' || fill === '#ffffff' || fill === 'white' ||
                      fill === 'rgb(255,255,255)' || fill === 'rgb(255, 255, 255)';

      if (isFullSize && isWhite) {
        child.remove();
      }
    }
  }

  // Remove any style="background..." on the SVG element itself
  const style = svg.getAttribute('style') || '';
  if (style) {
    const cleaned = style.replace(/background[-\w]*\s*:[^;]+;?/gi, '').trim();
    if (cleaned) {
      svg.setAttribute('style', cleaned);
    } else {
      svg.removeAttribute('style');
    }
  }

  return new XMLSerializer().serializeToString(svg);
}
