import { useRef, useState, useEffect } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

const SmilesEditor = () => {
  useTrackToolVisit("smiles");
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Listen for SVG data from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'smiles-svg-for-canvas' && e.data.svg) {
        sessionStorage.setItem('smiles_svg_import', e.data.svg);
        navigate('/canvas');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

  const openInCanvas = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'get-svg-for-canvas' }, '*');
  };

  const searchByName = async () => {
    const name = searchQuery.trim();
    if (!name) return;

    setIsSearching(true);
    try {
      const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/IsomericSMILES,MolecularFormula,MolecularWeight,IUPACName/JSON`;

      const res = await fetch(url);

      if (!res.ok) throw new Error('Not found');

      const data = await res.json();
      const props = data?.PropertyTable?.Properties?.[0];

      // PubChem returns SMILES under different field names depending on the request
      const smiles = props?.IsomericSMILES || props?.CanonicalSMILES || props?.SMILES || props?.ConnectivitySMILES;

      if (!smiles) throw new Error('No SMILES found');

      // Send SMILES to iframe
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'render-smiles',
          smiles,
          name,
          props: { ...props, CanonicalSMILES: smiles },
        }, '*');
        toast.success(`Found: ${props.IUPACName || name}`);
      } else {
        toast.error('Editor not ready. Try again.');
      }
    } catch (err: any) {
      toast.error(`"${name}" not found. Try a different name or enter SMILES directly.`);
    } finally {
      setIsSearching(false);
    }
  };

  const structuredData = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "Free SMILES Molecular Structure Editor - BioSketch",
    description: "Draw and visualize chemical structures from SMILES strings. Search compounds by name via PubChem.",
    url: "https://biosketch.art/smiles",
    applicationCategory: "EducationalApplication", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <SEOHead
        title="Free SMILES Molecular Structure Renderer | BioSketch"
        description="Visualize chemical structures from SMILES strings online for free. Search compounds by name, render 2D molecular diagrams, and export as PNG or SVG. No signup required."
        canonical="https://biosketch.art/smiles"
        keywords="SMILES renderer, molecular structure editor, chemical structure drawing, molecule viewer, SMILES to structure, free chemistry tool, molecular diagram maker, PubChem search"
        structuredData={structuredData}
      />

      {/* Header */}
      <header className="h-12 min-h-[3rem] flex items-center px-4 gap-3 border-b border-border/30 bg-white dark:bg-card">
        <button onClick={() => navigate('/')} className="font-bold font-serif text-sm tracking-tight hover:text-primary transition-colors">
          BioSketch
        </button>
        <div className="h-4 w-px bg-border/50" />
        <h1 className="text-sm font-semibold">Molecular Structure Renderer</h1>
        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded">FREE</span>

        <div className="flex-1" />
        <ToolRating toolId="smiles" />
        <div className="h-4 w-px bg-border/30" />
        {/* Search bar in header */}
        <div className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchByName()}
              placeholder="Search compound name..."
              className="h-8 pl-8 text-xs w-56"
            />
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={searchByName}
            disabled={isSearching}
          >
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </Button>
          <div className="h-4 w-px bg-border/40 mx-1" />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={openInCanvas}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Canvas
          </Button>
        </div>
      </header>

      {/* SMILES Editor */}
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          src="/smiles-editor/index.html"
          className="w-full h-full border-0"
          title="Molecular Structure Renderer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        />
      </div>
    </div>
  );
};

export default SmilesEditor;
