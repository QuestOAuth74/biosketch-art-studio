import { useRef, useEffect } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

const LatexEditor = () => {
  useTrackToolVisit("latex");
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'latex-png-for-canvas' && e.data.dataUrl) {
        const w = e.data.width as number;
        const h = e.data.height as number;
        const dataUrl = e.data.dataUrl as string;
        // Wrap the PNG data URL in an SVG <image> tag that Fabric.js can parse
        const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
          `<image width="${w}" height="${h}" xlink:href="${dataUrl}"/></svg>`;
        sessionStorage.setItem('latex_svg_import', svgOut);
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
    name: "Free LaTeX Equation Renderer - BioSketch",
    description: "Type LaTeX math equations, preview rendered output, and export as PNG or SVG. Free, no signup required.",
    url: "https://biosketch.art/latex",
    applicationCategory: "EducationalApplication", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <SEOHead
        title="Free LaTeX Equation Renderer | BioSketch"
        description="Type LaTeX math equations and preview them instantly. Export as high-resolution PNG or SVG. 15 built-in examples including scientific equations. Free, no signup."
        canonical="https://biosketch.art/latex"
        keywords="LaTeX equation renderer, LaTeX to image, math equation editor, LaTeX preview, equation PNG, LaTeX online free, math formula renderer"
        structuredData={structuredData}
      />

      {/* Header */}
      <header className="h-12 min-h-[3rem] flex items-center px-4 gap-3 border-b border-border/30 bg-white dark:bg-card">
        <button onClick={() => navigate('/')} className="font-bold font-serif text-sm tracking-tight hover:text-primary transition-colors">
          BioSketch
        </button>
        <div className="h-4 w-px bg-border/50" />
        <h1 className="text-sm font-semibold">LaTeX Equation Renderer</h1>
        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0.5 rounded">FREE</span>
        <div className="flex-1" />
        <ToolRating toolId="latex" />
        <div className="h-4 w-px bg-border/30" />
        <button onClick={openInCanvas} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          Open in Canvas
        </button>
      </header>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          src="/latex-editor/index.html"
          className="w-full h-full border-0"
          title="LaTeX Equation Renderer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        />
      </div>
    </div>
  );
};

export default LatexEditor;
