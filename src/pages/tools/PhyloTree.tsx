import { useRef, useEffect } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Phylogenetic Tree Viewer - BioSketch",
  description: "Visualize phylogenetic trees from Newick format data. Rectangular and radial layouts, branch length scaling, SVG and PNG export. Free for researchers and students.",
  url: "https://biosketch.art/phylo-tree",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const PhyloTree = () => {
  useTrackToolVisit("phylo-tree");
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'phylo-svg-for-canvas' && e.data.svg) {
        sessionStorage.setItem('phylo_svg_import', e.data.svg);
        navigate('/canvas');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  const openInCanvas = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'get-svg-for-canvas' }, '*');
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <SEOHead
        title="Free Phylogenetic Tree Viewer - Newick Tree Visualizer | BioSketch"
        description="Visualize phylogenetic trees online from Newick format data. Rectangular cladogram and radial circular layouts with branch length scaling, tip alignment, and internal node labels. Export as SVG or PNG. Free, no signup required."
        canonical="https://biosketch.art/phylo-tree"
        keywords="phylogenetic tree viewer, Newick tree viewer, phylogenetic tree maker, cladogram generator, radial phylogeny, evolutionary tree online, phylogenetics tool, tree of life viewer, Newick format visualizer, free phylogenetic tree"
        structuredData={structuredData}
      />

      {/* Header */}
      <header className="h-12 min-h-[3rem] flex items-center px-4 gap-3 border-b border-border/30 bg-white dark:bg-card">
        <button onClick={() => navigate('/')} className="font-bold font-serif text-sm tracking-tight hover:text-primary transition-colors">
          BioSketch
        </button>
        <div className="h-4 w-px bg-border/50" />
        <h1 className="text-sm font-semibold">Phylogenetic Tree Viewer</h1>
        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded">FREE</span>
        <div className="flex-1" />
        <ToolRating toolId="phylo-tree" />
        <div className="h-4 w-px bg-border/30" />
        <button onClick={openInCanvas} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          Open in Canvas
        </button>
        <button onClick={() => navigate('/tools')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          All Tools
        </button>
      </header>

      {/* Viewer */}
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          src="/phylo-viewer/index.html"
          className="w-full h-full border-0"
          title="Phylogenetic Tree Viewer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        />
      </div>
    </div>
  );
};

export default PhyloTree;
