import { useRef, useState, useEffect } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { HelpCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

const Pedigree = () => {
  useTrackToolVisit("pedigree");
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showLegend, setShowLegend] = useState(true);

  // Listen for SVG data from iframe to send to canvas
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'svg-for-canvas' && e.data.svg) {
        // Store SVG in sessionStorage so canvas page can pick it up
        sessionStorage.setItem('pedigree_svg_import', e.data.svg);
        navigate('/canvas');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  const structuredData = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "Free Pedigree Chart Maker - BioSketch",
    description: "Create professional genetics pedigree charts online for free.",
    url: "https://biosketch.art/pedigree",
    applicationCategory: "EducationalApplication", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const legendSymbols = [
    { svg: <rect x="4" y="4" width="16" height="16" fill="#fff" stroke="#334155" strokeWidth="2" rx="1" />, label: 'Unaffected male' },
    { svg: <circle cx="12" cy="12" r="8" fill="#fff" stroke="#334155" strokeWidth="2" />, label: 'Unaffected female' },
    { svg: <rect x="4" y="4" width="16" height="16" fill="#1e293b" stroke="#334155" strokeWidth="2" rx="1" />, label: 'Affected male' },
    { svg: <circle cx="12" cy="12" r="8" fill="#1e293b" stroke="#334155" strokeWidth="2" />, label: 'Affected female' },
    { svg: <><rect x="4" y="4" width="16" height="16" fill="#fff" stroke="#334155" strokeWidth="2" rx="1" /><polygon points="4,20 20,20 4,4" fill="#1e293b" /></>, label: 'Carrier male' },
    { svg: <><circle cx="12" cy="12" r="8" fill="#fff" stroke="#334155" strokeWidth="2" /><path d="M4,12 A8,8 0 0,1 12,4 L12,20 A8,8 0 0,1 4,12" fill="#1e293b" /></>, label: 'Carrier female' },
    { svg: <polygon points="12,3 21,12 12,21 3,12" fill="#fff" stroke="#334155" strokeWidth="2" />, label: 'Unknown sex' },
    { svg: <><rect x="4" y="4" width="16" height="16" fill="#fff" stroke="#334155" strokeWidth="2" rx="1" /><line x1="2" y1="22" x2="22" y2="2" stroke="#dc2626" strokeWidth="2" /></>, label: 'Deceased' },
    { svg: <rect x="4" y="4" width="16" height="16" fill="#fff" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 2" rx="1" />, label: 'Pregnancy / Unborn' },
  ];

  const legendConnections = [
    { svg: <line x1="2" y1="12" x2="22" y2="12" stroke="#334155" strokeWidth="2.5" />, label: 'Mating line' },
    { svg: <><line x1="2" y1="12" x2="22" y2="12" stroke="#334155" strokeWidth="2.5" /><line x1="2" y1="16" x2="22" y2="16" stroke="#334155" strokeWidth="2.5" /></>, label: 'Consanguinity' },
    { svg: <><line x1="12" y1="2" x2="12" y2="12" stroke="#334155" strokeWidth="2.5" /><line x1="4" y1="12" x2="20" y2="12" stroke="#334155" strokeWidth="2.5" /><line x1="4" y1="12" x2="4" y2="22" stroke="#334155" strokeWidth="2.5" /><line x1="20" y1="12" x2="20" y2="22" stroke="#334155" strokeWidth="2.5" /></>, label: 'Offspring / Sibship line' },
    { svg: <line x1="2" y1="12" x2="22" y2="12" stroke="#334155" strokeWidth="2.5" strokeDasharray="4 3" />, label: 'No contact / Separated' },
  ];

  const legendPatterns = [
    { title: 'Autosomal Dominant', desc: 'Affected in every generation. Males and females equally affected. Affected individuals have at least one affected parent.' },
    { title: 'Autosomal Recessive', desc: 'Often skips generations. Unaffected parents can have affected children (both carriers). Males and females equally affected.' },
    { title: 'X-linked Recessive', desc: 'More males affected than females. No male-to-male transmission. Affected males related through carrier females.' },
    { title: 'X-linked Dominant', desc: 'Affected males pass to all daughters, no sons. Affected females pass to ~50% of children.' },
    { title: 'Mitochondrial', desc: 'Maternal inheritance only. Affected mother passes to all children. Affected father does not pass to any children.' },
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <SEOHead
        title="Free Pedigree Chart Maker - Genetics Pedigree Tool | BioSketch"
        description="Create professional genetics pedigree charts online for free. Standard pedigree symbols, connections, and export. No signup required."
        canonical="https://biosketch.art/pedigree"
        keywords="pedigree chart maker, genetics pedigree tool, free pedigree diagram, family genetics chart, inheritance pattern diagram"
        structuredData={structuredData}
      />

      {/* Header */}
      <header className="h-12 min-h-[3rem] flex items-center px-4 gap-3 border-b border-border/30 bg-white dark:bg-card">
        <button onClick={() => navigate('/')} className="font-bold font-serif text-sm tracking-tight hover:text-primary transition-colors">
          BioSketch
        </button>
        <div className="h-4 w-px bg-border/50" />
        <h1 className="text-sm font-semibold">Pedigree Chart Maker</h1>
        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded">FREE</span>

        <div className="flex-1" />
        <ToolRating toolId="pedigree" />
        <div className="h-4 w-px bg-border/30" />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => {
            const iframe = iframeRef.current;
            if (!iframe?.contentWindow) return;
            // Ask iframe to export SVG and send it back
            iframe.contentWindow.postMessage({ type: 'get-svg-for-canvas' }, '*');
          }}
        >
          Open in Canvas Editor
        </Button>
        <Button
          variant={showLegend ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowLegend(!showLegend)}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {showLegend ? 'Hide Guide' : 'Pedigree Guide'}
        </Button>
      </header>

      {/* Main area */}
      <div className="flex-1 min-h-0 relative">
        {/* Pedigree Editor iframe */}
        <iframe
          ref={iframeRef}
          src="/pedigree-editor/index.html"
          className="w-full h-full border-0"
          title="Pedigree Chart Maker"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads allow-modals"
        />

        {/* Legend / Guide Panel */}
        {showLegend && (
          <div className="absolute top-0 right-0 h-full w-80 bg-white dark:bg-card border-l border-border/40 shadow-xl z-20 flex flex-col animate-in slide-in-from-right-4 duration-200">
            {/* Legend header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <h2 className="text-sm font-semibold text-foreground">Pedigree Guide</h2>
              <button onClick={() => setShowLegend(false)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

              {/* Symbols */}
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-3">Standard Symbols</h3>
                <div className="space-y-2">
                  {legendSymbols.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">{item.svg}</svg>
                      <span className="text-[12px] text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Connections */}
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-3">Connection Lines</h3>
                <div className="space-y-2">
                  {legendConnections.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">{item.svg}</svg>
                      <span className="text-[12px] text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* How to use */}
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-3">How to Use</h3>
                <div className="space-y-2 text-[12px] text-muted-foreground leading-relaxed">
                  <p><strong className="text-foreground">1.</strong> Select a template or start from scratch</p>
                  <p><strong className="text-foreground">2.</strong> Hover over an individual to see action handles</p>
                  <p><strong className="text-foreground">3.</strong> Drag the side handles to create partners</p>
                  <p><strong className="text-foreground">4.</strong> Drag the bottom handle to add children</p>
                  <p><strong className="text-foreground">5.</strong> Click an individual to edit their details</p>
                  <p><strong className="text-foreground">6.</strong> Use Export to save as PNG, JPG, SVG, or PDF</p>
                </div>
              </div>

              {/* Inheritance Patterns */}
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-3">Inheritance Patterns</h3>
                <div className="space-y-3">
                  {legendPatterns.map((pattern, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/40 border border-border/30">
                      <p className="text-[12px] font-semibold text-foreground mb-1">{pattern.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{pattern.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30">
                <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mb-1">Pro Tips</p>
                <ul className="text-[11px] text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                  <li>Males are always squares, females are circles</li>
                  <li>Filled shapes = affected individuals</li>
                  <li>Half-filled = carriers</li>
                  <li>A diagonal line through a symbol = deceased</li>
                  <li>Generations are read top to bottom (I, II, III...)</li>
                  <li>The proband (patient) is indicated with an arrow</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pedigree;
