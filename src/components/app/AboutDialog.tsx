import { create } from 'zustand';
import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/stores/settingsStore';

interface AboutStore {
  open: boolean;
  show: () => void;
  hide: () => void;
}

export const useAboutDialog = create<AboutStore>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

const WEBSITE = 'https://biosketch.art';
const DOWNLOAD_URL = 'https://biosketch.art/studio';

export function AboutDialog() {
  const { open, hide } = useAboutDialog();
  const { watermarkEnabled, setWatermarkEnabled } = useSettings();
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''));
  }, []);

  const copyDownloadLink = async () => {
    try {
      await navigator.clipboard.writeText(DOWNLOAD_URL);
      toast.success('Download link copied — share with a friend');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : hide())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <img
              src="/biosketch-logo.png"
              alt="Biosketch.Art Studio"
              className="h-14 w-14 rounded-lg shrink-0"
            />
            <div>
              <DialogTitle className="text-2xl">Biosketch.Art Studio</DialogTitle>
              <DialogDescription>
                Free scientific illustration editor for scientists, by scientists. Works offline; browsing new icons needs internet.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Version</span>
            <span className="font-mono">{version || '—'}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>License</span>
            <span>MIT</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Website</span>
            <a
              href={WEBSITE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              biosketch.art <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="pt-2 border-t space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="watermark-toggle" className="text-sm">Watermark exports</Label>
              <p className="text-xs text-muted-foreground">Adds "Made with Biosketch.Art Studio" to exported images</p>
            </div>
            <Switch id="watermark-toggle" checked={watermarkEnabled} onCheckedChange={setWatermarkEnabled} />
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            Enjoying Biosketch.Art Studio? Share it with a colleague.
          </p>
          <Button onClick={copyDownloadLink} variant="outline" size="sm" className="w-full gap-2">
            <Copy className="h-3.5 w-3.5" />
            Copy download link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
