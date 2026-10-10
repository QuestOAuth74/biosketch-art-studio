import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Share2, Check, Copy, QrCode, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** URL to encode + share. Defaults to window.location.href. */
  url?: string;
  /** Display title shown above the QR. */
  title?: string;
}

export function SharePopover({ url, title = "Share this 3D model" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");

  // Regenerate the QR each time the popover opens so it stays in sync if the
  // URL slug/state changes between sessions.
  useEffect(() => {
    if (!open || !shareUrl) return;
    setQrLoading(true);
    setQrPng(null);
    QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: "M",
      width: 360,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrPng)
      .catch((err) => {
        console.error("[share-qr] generation failed:", err);
        toast.error("Could not generate QR code");
      })
      .finally(() => setQrLoading(false));
  }, [open, shareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleDownloadQr = () => {
    if (!qrPng) return;
    const a = document.createElement("a");
    a.href = qrPng;
    a.download = `qr-3d-model-${Date.now()}.png`;
    a.click();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[300px] p-4"
      >
        <p className="text-xs font-semibold text-slate-800 mb-3">{title}</p>

        {/* QR code panel */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center">
          {qrLoading ? (
            <div className="h-44 w-44 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : qrPng ? (
            <img src={qrPng} alt="Scan to open this 3D model" className="h-44 w-44 rounded-lg bg-white" />
          ) : (
            <div className="h-44 w-44 flex items-center justify-center">
              <QrCode className="h-8 w-8 text-slate-300" />
            </div>
          )}
          <p className="mt-2 text-[10.5px] text-muted-foreground text-center">
            Patient scans this with their phone to open the model
          </p>
        </div>

        {/* URL copy + download QR */}
        <div className="mt-3 flex items-center gap-1.5">
          <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] text-slate-700 font-mono truncate">
            {shareUrl}
          </div>
          <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[11px]" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="mt-1.5 w-full h-7 text-[11px] gap-1 text-muted-foreground hover:text-slate-700"
          onClick={handleDownloadQr}
          disabled={!qrPng}
        >
          <Download className="h-3 w-3" />
          Download QR as PNG
        </Button>
      </PopoverContent>
    </Popover>
  );
}
