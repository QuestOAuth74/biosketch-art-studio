import { useMemo } from "react";
import DOMPurify from "dompurify";

interface SafeSvgRendererProps {
  svgContent: string;
  className?: string;
}

/**
 * Renders SVG content safely as an <img src="data:image/svg+xml;…">.
 * Loading the SVG through an <img> means the browser parses it as XML, so
 * embedded <style> blocks, namespace prefixes (e.g. <ns0:svg>), and other
 * Adobe Illustrator quirks render correctly — unlike inline injection via
 * dangerouslySetInnerHTML, where the HTML5 parser sometimes spills the CSS
 * inside <defs><style> out as visible text.
 */
export const SafeSvgRenderer = ({ svgContent, className = "" }: SafeSvgRendererProps) => {
  const dataUrl = useMemo(() => {
    const clean = DOMPurify.sanitize(svgContent, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ["use"],
      ADD_ATTR: ["xlink:href", "clip-path", "mask", "filter", "fill-rule", "clip-rule"],
    });

    // Normalize a namespace-prefixed root like <ns0:svg xmlns:ns0="…/svg"> into
    // <svg xmlns="…/svg"> so img loaders treat it as the default SVG namespace.
    const normalized = clean.replace(
      /<([A-Za-z_][\w-]*):svg\b([^>]*)>/,
      (_m, prefix, attrs) => {
        const stripped = attrs.replace(
          new RegExp(`\\s+xmlns:${prefix}\\s*=\\s*"http://www\\.w3\\.org/2000/svg"`),
          "",
        );
        return `<svg xmlns="http://www.w3.org/2000/svg"${stripped}>`;
      },
    );

    // btoa rejects non-Latin1 — escape first for safety.
    let encoded: string;
    try {
      encoded = btoa(unescape(encodeURIComponent(normalized)));
    } catch {
      return "";
    }
    return `data:image/svg+xml;base64,${encoded}`;
  }, [svgContent]);

  if (!dataUrl) return null;

  return (
    <img
      src={dataUrl}
      alt=""
      className={className}
      draggable={false}
    />
  );
};
