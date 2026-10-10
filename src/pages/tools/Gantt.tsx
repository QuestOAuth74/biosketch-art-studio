import { useRef, useEffect } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

const Gantt = () => {
  useTrackToolVisit("gantt");
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'export-result') {
        if (e.data.success) toast.success('Gantt chart exported!');
        else if (e.data.error) toast.error(e.data.error);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const doExport = (format: 'png' | 'svg' | 'json') => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) { toast.error('Editor not ready'); return; }
    iframe.contentWindow.postMessage({ type: 'export-gantt', format }, '*');
  };

  const structuredData = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "Free Gantt Chart Maker - BioSketch",
    description: "Create project timelines and Gantt charts online for free. Add tasks, dependencies, milestones, and export.",
    url: "https://biosketch.art/gantt",
    applicationCategory: "ProjectManagement", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <SEOHead
        title="Free Gantt Chart Maker - Project Timeline Tool | BioSketch"
        description="Create Gantt charts and project timelines online for free. Add tasks, set dependencies, assign resources, and export as PNG or JSON. No signup required."
        canonical="https://biosketch.art/gantt"
        keywords="gantt chart maker, free gantt chart, project timeline tool, task scheduler, project management chart, gantt diagram online"
        structuredData={structuredData}
      />

      {/* Header */}
      <header className="h-12 min-h-[3rem] flex items-center px-4 gap-3 border-b border-border/30 bg-white dark:bg-card">
        <button onClick={() => navigate('/')} className="font-bold font-serif text-sm tracking-tight hover:text-primary transition-colors">
          BioSketch
        </button>
        <div className="h-4 w-px bg-border/50" />
        <h1 className="text-sm font-semibold">Gantt Chart Maker</h1>
        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded">FREE</span>

        <div className="flex-1" />
        <ToolRating toolId="gantt" />
        <div className="h-4 w-px bg-border/30" />
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => doExport('svg')}>
            <FileText className="h-3.5 w-3.5" /> SVG
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => doExport('png')}>
            <ImageIcon className="h-3.5 w-3.5" /> PNG
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => doExport('json')}>
            <Download className="h-3.5 w-3.5" /> JSON
          </Button>
        </div>
      </header>

      {/* Gantt Editor */}
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          src="/gantt-editor/index.html"
          className="w-full h-full border-0"
          title="Gantt Chart Maker"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        />
      </div>
    </div>
  );
};

export default Gantt;
