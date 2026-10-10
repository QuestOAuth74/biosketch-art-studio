import { useRef, useEffect } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

const HeatmapGenerator = () => {
  useTrackToolVisit("heatmap");
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'heatmap-svg-for-canvas' && e.data.svg) {
        sessionStorage.setItem('heatmap_svg_import', e.data.svg);
        navigate('/canvas');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  const openInCanvas = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'get-svg-for-canvas' }, '*');
  };

  const structuredData = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "Free Heatmap Generator - BioSketch",
    description: "Generate publication-ready heatmaps online for free. Paste data, choose from 9 color scales, show cell values, and export as PNG or SVG. No signup required.",
    url: "https://biosketch.art/heatmap",
    applicationCategory: "EducationalApplication", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <SEOHead
        title="Free Heatmap Generator with Clustering | BioSketch"
        description="Generate publication-ready heatmaps online for free. Paste your data, choose from 9 color scales (RdBu, Viridis, YlOrRd, and more), show values in cells, reverse scales, and export as high-resolution PNG or SVG. No signup required."
        canonical="https://biosketch.art/heatmap"
        keywords="heatmap generator, free heatmap maker, hierarchical clustering heatmap, dendrogram heatmap, gene expression heatmap, publication heatmap, scientific data visualization"
        structuredData={structuredData}
      />

      {/* Header */}
      <header className="h-12 min-h-[3rem] flex items-center px-4 gap-3 border-b border-border/30 bg-white dark:bg-card">
        <button onClick={() => navigate('/')} className="font-bold font-serif text-sm tracking-tight hover:text-primary transition-colors">
          BioSketch
        </button>
        <div className="h-4 w-px bg-border/50" />
        <h1 className="text-sm font-semibold">Heatmap Generator</h1>
        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded">FREE</span>
        <div className="flex-1" />
        <ToolRating toolId="heatmap" />
          <button
            onClick={() => navigate("/chart-studio?type=heatmap")}
            style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600,
              background: "#1e40af", color: "white", border: "1px solid #1e3a8a",
              borderRadius: 6, cursor: "pointer", fontFamily: "'Segoe UI', Inter, sans-serif",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 14 14"><rect x={1} y={7} width={3} height={6} rx={0.5} fill="white"/><rect x={5.5} y={3} width={3} height={10} rx={0.5} fill="white" opacity={0.7}/><rect x={10} y={5} width={3} height={8} rx={0.5} fill="white" opacity={0.4}/></svg>
            Open in Chart Studio
          </button>
        <div className="h-4 w-px bg-border/30" />
        <label className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          Upload CSV
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => {
              const text = ev.target?.result as string;
              if (text) iframeRef.current?.contentWindow?.postMessage({ type: 'load-data', data: text }, '*');
            };
            reader.readAsText(f); e.target.value = "";
          }} />
        </label>
        <button onClick={openInCanvas} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          Open in Canvas
        </button>
      </header>

      {/* Heatmap Editor */}
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          src="/heatmap-editor/index.html"
          className="w-full h-full border-0"
          title="Heatmap Generator"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        />
      </div>
    </div>
  );
};

export default HeatmapGenerator;
