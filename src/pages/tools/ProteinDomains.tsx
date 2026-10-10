import { useState, useMemo, useRef } from "react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Plus, Trash2, X, Copy, Check, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTrackToolVisit } from "@/hooks/useToolVisits";
import { ToolRating } from "@/components/tools/ToolRating";

interface Domain {
  name: string;
  start: number;
  end: number;
  color: string;
  type: "domain" | "signal" | "transmembrane" | "coiled" | "disordered" | "ptm" | "region";
}

const TYPE_STYLES: Record<string, { label: string; height: number; shape: "rect" | "arrow" | "diamond" | "line" }> = {
  domain:        { label: "Domain",           height: 28, shape: "rect" },
  signal:        { label: "Signal peptide",   height: 20, shape: "arrow" },
  transmembrane: { label: "Transmembrane",    height: 24, shape: "rect" },
  coiled:        { label: "Coiled coil",      height: 18, shape: "rect" },
  disordered:    { label: "Disordered",       height: 14, shape: "line" },
  ptm:           { label: "PTM site",         height: 28, shape: "diamond" },
  region:        { label: "Region",           height: 22, shape: "rect" },
};

const DOMAIN_COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2", "#e11d48", "#4f46e5", "#15803d", "#b91c1c"];

interface ProteinExample {
  label: string;
  length: number;
  name: string;
  domains: Domain[];
}

const EXAMPLES: Record<string, ProteinExample> = {
  p53: {
    label: "TP53",
    name: "Tumor Protein P53",
    length: 393,
    domains: [
      { name: "TAD1", start: 1, end: 40, color: "#dc2626", type: "domain" },
      { name: "TAD2", start: 41, end: 61, color: "#f97316", type: "domain" },
      { name: "Proline-rich", start: 64, end: 92, color: "#eab308", type: "region" },
      { name: "DNA-binding", start: 102, end: 292, color: "#2563eb", type: "domain" },
      { name: "Tetramerization", start: 323, end: 356, color: "#7c3aed", type: "domain" },
      { name: "Regulatory", start: 364, end: 393, color: "#059669", type: "domain" },
      { name: "S15-P", start: 15, end: 15, color: "#e11d48", type: "ptm" },
      { name: "S20-P", start: 20, end: 20, color: "#e11d48", type: "ptm" },
      { name: "K120-Ac", start: 120, end: 120, color: "#0891b2", type: "ptm" },
      { name: "K382-Ac", start: 382, end: 382, color: "#0891b2", type: "ptm" },
    ],
  },
  egfr: {
    label: "EGFR",
    name: "Epidermal Growth Factor Receptor",
    length: 1210,
    domains: [
      { name: "Signal", start: 1, end: 24, color: "#94a3b8", type: "signal" },
      { name: "Domain I", start: 25, end: 165, color: "#2563eb", type: "domain" },
      { name: "Domain II", start: 166, end: 309, color: "#0891b2", type: "domain" },
      { name: "Domain III", start: 310, end: 480, color: "#059669", type: "domain" },
      { name: "Domain IV", start: 481, end: 621, color: "#15803d", type: "domain" },
      { name: "TM", start: 622, end: 644, color: "#d97706", type: "transmembrane" },
      { name: "Tyrosine kinase", start: 696, end: 979, color: "#dc2626", type: "domain" },
      { name: "Y1068-P", start: 1068, end: 1068, color: "#e11d48", type: "ptm" },
      { name: "Y1173-P", start: 1173, end: 1173, color: "#e11d48", type: "ptm" },
    ],
  },
  insulin: {
    label: "Insulin",
    name: "Insulin Precursor",
    length: 110,
    domains: [
      { name: "Signal", start: 1, end: 24, color: "#94a3b8", type: "signal" },
      { name: "B chain", start: 25, end: 54, color: "#2563eb", type: "domain" },
      { name: "C peptide", start: 57, end: 87, color: "#eab308", type: "region" },
      { name: "A chain", start: 90, end: 110, color: "#dc2626", type: "domain" },
    ],
  },
  gpcr: {
    label: "β2-Adrenergic",
    name: "β2-Adrenergic Receptor (ADRB2)",
    length: 413,
    domains: [
      { name: "N-term", start: 1, end: 34, color: "#94a3b8", type: "region" },
      { name: "TM1", start: 35, end: 58, color: "#2563eb", type: "transmembrane" },
      { name: "TM2", start: 68, end: 96, color: "#2563eb", type: "transmembrane" },
      { name: "TM3", start: 107, end: 136, color: "#2563eb", type: "transmembrane" },
      { name: "TM4", start: 150, end: 172, color: "#2563eb", type: "transmembrane" },
      { name: "TM5", start: 197, end: 228, color: "#2563eb", type: "transmembrane" },
      { name: "TM6", start: 267, end: 298, color: "#2563eb", type: "transmembrane" },
      { name: "TM7", start: 305, end: 328, color: "#2563eb", type: "transmembrane" },
      { name: "IDR", start: 233, end: 263, color: "#d97706", type: "disordered" },
      { name: "S355-P", start: 355, end: 355, color: "#e11d48", type: "ptm" },
      { name: "S356-P", start: 356, end: 356, color: "#e11d48", type: "ptm" },
    ],
  },
};

// ── SVG Renderer ──
function ProteinSVG({ proteinLength, proteinName, domains, svgRef }: {
  proteinLength: number; proteinName: string; domains: Domain[];
  svgRef: React.RefObject<SVGSVGElement>;
}) {
  const svgW = 900;
  const margin = { left: 55, right: 55, top: 55, bottom: 44 };
  const barW = svgW - margin.left - margin.right;
  const scale = barW / proteinLength;

  // Separate PTMs (rendered above) from other features (rendered on the track)
  const ptms = domains.filter(d => d.type === "ptm");
  const features = domains.filter(d => d.type !== "ptm");

  // PTM stacking: stagger labels to avoid overlap
  const ptmLabelHeight = ptms.length > 0 ? Math.min(ptms.length, 4) * 14 + 10 : 0;

  const trackY = margin.top + ptmLabelHeight;
  const trackH = 36;
  const axisH = 24;
  const legendTypes = Array.from(new Set(domains.map(d => d.type)));
  const legendH = legendTypes.length > 0 ? 24 : 0;
  const svgH = trackY + trackH + axisH + legendH + margin.bottom;

  const cy = trackY + trackH / 2;

  // Sort features: larger drawn first (behind), smaller on top
  const sortedFeatures = [...features].sort((a, b) => (b.end - b.start) - (a.end - a.start));

  // Tick marks
  const tickStep = proteinLength <= 100 ? 20 : proteinLength <= 200 ? 50 : proteinLength <= 500 ? 100 : proteinLength <= 1000 ? 200 : 500;
  const ticks: number[] = [1];
  for (let t = tickStep; t < proteinLength; t += tickStep) ticks.push(t);
  if (ticks[ticks.length - 1] !== proteinLength) ticks.push(proteinLength);

  const truncateLabel = (name: string, w: number, fontSize: number) => {
    const charW = fontSize * 0.56;
    const maxChars = Math.floor((w - 12) / charW);
    if (maxChars < 2) return "";
    if (name.length <= maxChars) return name;
    return name.slice(0, maxChars - 1) + "…";
  };

  // Determine if a color is light (needs dark text) or dark (needs white text)
  const isLightColor = (hex: string): boolean => {
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    // Relative luminance
    return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
  };

  const textColorFor = (bgColor: string): string => isLightColor(bgColor) ? "#1e293b" : "#ffffff";

  // Darken a hex color by a factor (0-1)
  const darken = (hex: string, amount: number): string => {
    const c = hex.replace("#", "");
    const r = Math.round(parseInt(c.substring(0, 2), 16) * (1 - amount));
    const g = Math.round(parseInt(c.substring(2, 4), 16) * (1 - amount));
    const b = Math.round(parseInt(c.substring(4, 6), 16) * (1 - amount));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  // PTM label staggering: assign vertical offset to avoid overlap
  const ptmsSorted = [...ptms].sort((a, b) => a.start - b.start);
  const ptmOffsets: number[] = [];
  const ptmSlots: number[] = []; // tracks occupied x ranges per row
  ptmsSorted.forEach((p, i) => {
    const px = margin.left + (p.start - 1) * scale;
    let row = 0;
    // Simple: alternate rows 0,1,2,3
    row = i % Math.min(4, ptms.length);
    ptmOffsets.push(row);
  });

  return (
    <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
      <defs>
        {/* Text shadow filter for labels on colored backgrounds */}
        <filter id="text-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <filter id="text-shadow-light" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#fff" floodOpacity="0.6" />
        </filter>
      </defs>
      <rect width={svgW} height={svgH} fill="#fff" />

      {/* Title */}
      <text x={svgW / 2} y={18} textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif" letterSpacing="-0.02em">
        {proteinName}
      </text>
      <text x={svgW / 2} y={34} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="Inter, sans-serif">
        {proteinLength.toLocaleString()} amino acids
      </text>

      {/* Backbone bar with subtle gradient */}
      <linearGradient id="backbone-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d1d5db" />
        <stop offset="100%" stopColor="#e5e7eb" />
      </linearGradient>
      <rect x={margin.left} y={cy - 3} width={barW} height={6} rx="3" fill="url(#backbone-grad)" />

      {/* N / C terminus */}
      <text x={margin.left - 10} y={cy + 4} textAnchor="end" fontSize="12" fontWeight="800" fill="#64748b" fontFamily="Inter, sans-serif">N</text>
      <text x={margin.left + barW + 10} y={cy + 4} textAnchor="start" fontSize="12" fontWeight="800" fill="#64748b" fontFamily="Inter, sans-serif">C</text>

      {/* Features (non-PTM) */}
      {sortedFeatures.map((d, i) => {
        const x = margin.left + (d.start - 1) * scale;
        const w = Math.max(3, (d.end - d.start + 1) * scale);
        const style = TYPE_STYLES[d.type] || TYPE_STYLES.domain;
        const fh = style.height;
        const txtColor = textColorFor(d.color);
        const useShadow = !isLightColor(d.color); // dark bg → white text with dark shadow

        if (style.shape === "line") {
          const steps = Math.max(6, Math.floor(w / 4));
          let path = `M${x},${cy}`;
          for (let s = 1; s <= steps; s++) {
            const px = x + (s / steps) * w;
            const py = cy + (s % 2 === 0 ? -5 : 5);
            path += ` L${px.toFixed(1)},${py}`;
          }
          return (
            <g key={`f-${i}`}>
              <path d={path} fill="none" stroke={d.color} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
              <text x={x + w / 2} y={cy + fh + 6} textAnchor="middle" fontSize="8" fill={darken(d.color, 0.2)} fontFamily="Inter, sans-serif" fontWeight="600">
                {d.name}
              </text>
            </g>
          );
        }

        if (style.shape === "arrow") {
          const arrowTip = Math.min(10, w * 0.18);
          return (
            <g key={`f-${i}`}>
              <path d={`M${x},${cy - fh / 2} L${x + w - arrowTip},${cy - fh / 2} L${x + w},${cy} L${x + w - arrowTip},${cy + fh / 2} L${x},${cy + fh / 2} Z`}
                fill={d.color} stroke={darken(d.color, 0.15)} strokeWidth="0.8" />
              <text x={x + (w - arrowTip) / 2} y={cy + 3.5} textAnchor="middle" fontSize="8.5"
                fill={txtColor} fontFamily="Inter, sans-serif" fontWeight="700"
                filter={useShadow ? "url(#text-shadow)" : undefined}>
                {truncateLabel(d.name, w - arrowTip, 8.5)}
              </text>
            </g>
          );
        }

        // Rectangles: domain, transmembrane, coiled, region
        const isRegion = d.type === "region";
        const fontSize = w > 80 ? 10.5 : w > 50 ? 9.5 : 8;
        const label = truncateLabel(d.name, w, fontSize);

        return (
          <g key={`f-${i}`}>
            <defs>
              <clipPath id={`clip-f-${i}`}>
                <rect x={x} y={cy - fh / 2} width={w} height={fh} rx="4" />
              </clipPath>
              <linearGradient id={`grad-f-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.color} stopOpacity={isRegion ? 0.25 : 1} />
                <stop offset="100%" stopColor={darken(d.color, 0.12)} stopOpacity={isRegion ? 0.35 : 1} />
              </linearGradient>
            </defs>
            <rect x={x} y={cy - fh / 2} width={w} height={fh} rx="5"
              fill={`url(#grad-f-${i})`}
              stroke={darken(d.color, 0.2)} strokeWidth={isRegion ? 1 : 0.8} strokeOpacity={isRegion ? 0.5 : 0.3} />
            {label && (
              <text x={x + w / 2} y={cy + 4} textAnchor="middle" fontSize={fontSize}
                fill={isRegion ? darken(d.color, 0.3) : txtColor}
                fontWeight="700" fontFamily="Inter, sans-serif"
                clipPath={`url(#clip-f-${i})`}
                filter={!isRegion && useShadow ? "url(#text-shadow)" : (!isRegion && !useShadow ? "url(#text-shadow-light)" : undefined)}>
                {label}
              </text>
            )}
            {/* Label below if too narrow */}
            {!label && w >= 3 && (
              <text x={x + w / 2} y={cy + fh / 2 + 11} textAnchor="middle" fontSize="7.5"
                fill={darken(d.color, 0.15)} fontFamily="Inter, sans-serif" fontWeight="600">
                {d.name}
              </text>
            )}
          </g>
        );
      })}

      {/* PTM markers (above the track) */}
      {ptmsSorted.map((d, i) => {
        const px = margin.left + (d.start - 1) * scale;
        const row = ptmOffsets[i];
        const labelY = trackY - 8 - row * 16;
        const size = 5;

        // Find if this PTM sits on top of a domain box — offset label to nearest edge
        const overlapping = features.find(f =>
          f.type !== "disordered" && f.type !== "ptm" &&
          d.start >= f.start && d.start <= f.end
        );

        let labelX = px; // default: centered above marker
        let anchor: "middle" | "start" | "end" = "middle";

        if (overlapping) {
          const domLeft = margin.left + (overlapping.start - 1) * scale;
          const domRight = domLeft + Math.max(3, (overlapping.end - overlapping.start + 1) * scale);
          const domCenter = (domLeft + domRight) / 2;

          // Offset to whichever edge is closer
          if (px <= domCenter) {
            // Closer to left edge — place label to the left of the domain
            labelX = domLeft - 4;
            anchor = "end";
          } else {
            // Closer to right edge — place label to the right of the domain
            labelX = domRight + 4;
            anchor = "start";
          }
        }

        const pillW = d.name.length * 5.5 + 12;
        const pillX = anchor === "middle" ? labelX - pillW / 2 : anchor === "end" ? labelX - pillW : labelX;

        return (
          <g key={`ptm-${i}`}>
            {/* Connecting line: vertical from diamond, then horizontal to label */}
            <path
              d={`M${px},${cy - size - 4} L${px},${labelY + 8} L${labelX},${labelY + 8}`}
              fill="none" stroke={d.color} strokeWidth="0.8" opacity="0.35" strokeDasharray="2,2"
            />
            {/* Diamond marker on track */}
            <polygon points={`${px},${cy - size - 4} ${px + size},${cy - 4} ${px},${cy + size - 4} ${px - size},${cy - 4}`}
              fill={d.color} stroke={darken(d.color, 0.2)} strokeWidth="0.8" />
            {/* Label pill */}
            <rect x={pillX} y={labelY - 9} width={pillW} height="13" rx="3" fill="#fff" stroke={d.color} strokeWidth="0.6" opacity="0.9" />
            <text x={labelX} y={labelY} textAnchor={anchor} fontSize="8" fill={darken(d.color, 0.15)} fontFamily="Inter, sans-serif" fontWeight="700">
              {d.name}
            </text>
          </g>
        );
      })}

      {/* Axis ticks */}
      {ticks.map(t => {
        const x = margin.left + (t - 1) * scale;
        return (
          <g key={`tick-${t}`}>
            <line x1={x} x2={x} y1={cy + trackH / 2 + 4} y2={cy + trackH / 2 + 9} stroke="#d1d5db" strokeWidth="1" />
            <text x={x} y={cy + trackH / 2 + 20} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="Inter, sans-serif" fontWeight="500">
              {t.toLocaleString()}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {legendTypes.length > 0 && (() => {
        const items = legendTypes.map(t => ({
          type: t,
          label: TYPE_STYLES[t]?.label || t,
          color: domains.find(d => d.type === t)?.color || "#999",
        }));
        const itemW = Math.min(105, (barW - 20) / items.length);
        const totalW = items.length * itemW;
        const startX = margin.left + (barW - totalW) / 2;

        return (
          <g transform={`translate(0, ${svgH - margin.bottom + 10})`}>
            {items.map((item, i) => (
              <g key={item.type} transform={`translate(${startX + i * itemW}, 0)`}>
                {item.type === "ptm" ? (
                  <polygon points="5,0 10,5 5,10 0,5" fill={item.color} stroke={darken(item.color, 0.2)} strokeWidth="0.5" />
                ) : item.type === "disordered" ? (
                  <path d="M0,5 L2.5,1 L5,9 L7.5,1 L10,5" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" />
                ) : item.type === "signal" ? (
                  <polygon points="0,2 8,2 10,5 8,8 0,8" fill={item.color} stroke={darken(item.color, 0.15)} strokeWidth="0.5" />
                ) : (
                  <rect x={0} y={1} width={10} height={8} rx={2.5} fill={item.color} stroke={darken(item.color, 0.15)} strokeWidth="0.5" />
                )}
                <text x={14} y={8} fontSize="8.5" fill="#475569" fontFamily="Inter, sans-serif" fontWeight="600">{item.label}</text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

// ── Main Page ──
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Free Protein Domain Viewer - BioSketch",
  description: "Visualize protein domain architecture with domains, signal peptides, transmembrane regions, PTM sites, and disordered regions. Export as SVG or PNG.",
  url: "https://biosketch.art/protein-domains",
  applicationCategory: "EducationalApplication", operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const ProteinDomains = () => {
  useTrackToolVisit("protein-domains");
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const [proteinName, setProteinName] = useState(EXAMPLES.p53.name);
  const [proteinLength, setProteinLength] = useState(String(EXAMPLES.p53.length));
  const [domains, setDomains] = useState<Domain[]>(EXAMPLES.p53.domains);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDomain, setNewDomain] = useState<Domain>({ name: "", start: 1, end: 100, color: DOMAIN_COLORS[0], type: "domain" });
  const [copied, setCopied] = useState(false);
  const [colorIdx, setColorIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const length = parseInt(proteinLength) || 100;

  // ── UniProt Search ──
  const UNIPROT_FIELDS = "accession,protein_name,gene_names,length,ft_domain,ft_signal,ft_transmem,ft_mod_res,ft_topo_dom,ft_region,ft_repeat,ft_motif,ft_coiled,ft_compbias";

  const typeMap: Record<string, Domain["type"]> = {
    "Domain": "domain",
    "Signal": "signal",
    "Signal peptide": "signal",
    "Transit peptide": "signal",
    "Transmembrane": "transmembrane",
    "Modified residue": "ptm",
    "Topological domain": "region",
    "Region": "region",
    "Repeat": "domain",
    "Motif": "region",
    "Coiled coil": "coiled",
    "Compositional bias": "disordered",
  };

  const featureColorMap: Record<string, string> = {
    "domain": "#2563eb",
    "signal": "#94a3b8",
    "transmembrane": "#d97706",
    "ptm": "#e11d48",
    "region": "#8b5cf6",
    "coiled": "#059669",
    "disordered": "#f97316",
  };

  const searchUniProt = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setSearching(true);

    try {
      // Detect if input is a UniProt accession (e.g. P04637, Q9Y6K9)
      const isAccession = /^[A-Z][0-9][A-Z0-9]{3}[0-9](-\d+)?$/i.test(query) || /^[A-Z0-9]{6,10}$/i.test(query);

      let url: string;
      if (isAccession) {
        url = `https://rest.uniprot.org/uniprotkb/${query.toUpperCase()}?fields=${UNIPROT_FIELDS}`;
      } else {
        url = `https://rest.uniprot.org/uniprotkb/search?query=gene:${encodeURIComponent(query)}+AND+organism_id:9606+AND+reviewed:true&fields=${UNIPROT_FIELDS}&size=1`;
      }

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("Not found");

      const json = await res.json();
      const entry = isAccession ? json : json.results?.[0];
      if (!entry) { toast.error(`No protein found for "${query}"`); return; }

      // Extract protein info
      const name = entry.proteinDescription?.recommendedName?.fullName?.value
        || entry.proteinDescription?.submittedName?.[0]?.fullName?.value
        || entry.genes?.[0]?.geneName?.value
        || query;
      const gene = entry.genes?.[0]?.geneName?.value || "";
      const seqLength = entry.sequence?.length || 0;

      if (!seqLength) { toast.error("No sequence data found"); return; }

      // Extract features
      const features: Domain[] = [];
      let cIdx = 0;

      (entry.features || []).forEach((f: any) => {
        const start = f.location?.start?.value;
        const end = f.location?.end?.value;
        if (!start || !end) return;

        const mappedType = typeMap[f.type] || "region";
        const color = featureColorMap[mappedType] || DOMAIN_COLORS[cIdx % DOMAIN_COLORS.length];

        const desc = f.description || f.type;
        // For PTMs, include residue info
        let featureName = desc;
        if (mappedType === "ptm") {
          const residue = desc.replace(/;.*/, "").trim();
          featureName = `${residue} (${start})`;
        }

        features.push({
          name: featureName,
          start,
          end,
          color: mappedType === "ptm" ? "#e11d48" : color,
          type: mappedType,
        });

        if (mappedType !== "ptm") cIdx++;
      });

      // Assign distinct colors to domains
      const domainFeatures = features.filter(f => f.type === "domain");
      domainFeatures.forEach((f, i) => { f.color = DOMAIN_COLORS[i % DOMAIN_COLORS.length]; });

      setProteinName(gene ? `${gene} — ${name}` : name);
      setProteinLength(String(seqLength));
      setDomains(features);
      toast.success(`Loaded ${gene || name}: ${seqLength} aa, ${features.length} features`);
    } catch (err) {
      toast.error(`Could not find "${query}". Try a gene name (e.g. TP53) or UniProt ID (e.g. P04637).`);
    } finally {
      setSearching(false);
    }
  };

  const addDomain = () => {
    if (!newDomain.name) { toast.error("Enter a domain name"); return; }
    if (newDomain.start < 1 || newDomain.end > length || newDomain.start > newDomain.end) {
      toast.error(`Positions must be between 1 and ${length}`); return;
    }
    setDomains([...domains, { ...newDomain }]);
    const nextColor = DOMAIN_COLORS[(colorIdx + 1) % DOMAIN_COLORS.length];
    setColorIdx(colorIdx + 1);
    setNewDomain({ ...newDomain, name: "", color: nextColor });
    setShowAddForm(false);
  };

  const removeDomain = (idx: number) => setDomains(domains.filter((_, i) => i !== idx));

  const loadExample = (key: string) => {
    const ex = EXAMPLES[key];
    setProteinName(ex.name);
    setProteinLength(String(ex.length));
    setDomains(ex.domains);
  };

  // Read actual SVG viewBox dimensions for export
  const getSvgDims = () => {
    if (!svgRef.current) return { w: 900, h: 220 };
    const vb = svgRef.current.getAttribute("viewBox")?.split(" ");
    return { w: parseInt(vb?.[2] || "900"), h: parseInt(vb?.[3] || "220") };
  };

  const exportPlot = (format: "svg" | "png") => {
    if (!svgRef.current) return;
    const { w: svgW, h: svgH } = getSvgDims();
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(svgW)); clone.setAttribute("height", String(svgH));
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = "text{font-family:Inter,sans-serif}";
    clone.insertBefore(styleEl, clone.firstChild);
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: "image/svg+xml" });
    if (format === "svg") {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "protein-domains.svg"; a.click();
    } else {
      const img = new Image(); const url = URL.createObjectURL(blob);
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = svgW * 5; c.height = svgH * 5;
        const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "protein-domains.png"; a.click(); });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  };

  const openInCanvas = () => {
    if (!svgRef.current) return;
    const { w: svgW, h: svgH } = getSvgDims();
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(svgW)); clone.setAttribute("height", String(svgH));
    clone.removeAttribute("class");
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = "text{font-family:Inter,sans-serif}";
    clone.insertBefore(styleEl, clone.firstChild);
    const svgStr = new XMLSerializer().serializeToString(clone);
    const scale = 5; const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = svgW * scale; c.height = svgH * scale;
      const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/png");
      const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"><image width="${svgW}" height="${svgH}" xlink:href="${dataUrl}"/></svg>`;
      sessionStorage.setItem("volcano_svg_import", svgOut);
      window.location.href = "/canvas";
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  };

  const copyDomainTable = () => {
    const header = "Name\tType\tStart\tEnd";
    const rows = domains.map(d => `${d.name}\t${d.type}\t${d.start}\t${d.end}`);
    navigator.clipboard.writeText([header, ...rows].join("\n"));
    setCopied(true); toast.success("Domain table copied"); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Free Protein Domain Viewer - Domain Architecture Map | BioSketch"
        description="Visualize protein domain architecture online. Draw domains, signal peptides, transmembrane regions, PTM sites, coiled coils, and disordered regions on a linear protein map. 4 example proteins (TP53, EGFR, Insulin, GPCR). Export as SVG or PNG. Free, no signup required."
        canonical="https://biosketch.art/protein-domains"
        keywords="protein domain viewer, domain architecture, Pfam domain map, protein feature viewer, protein domain diagram, signal peptide, transmembrane domain, PTM site, protein structure visualization, InterPro domain, protein annotation tool"
        structuredData={structuredData}
      />

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tools")} className="mb-6 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tools
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif tracking-tight text-foreground">Protein Domain Viewer</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Linear protein domain architecture maps with domains, signals, TM regions, and PTM sites.</p>
          <ToolRating toolId="protein-domains" />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-72 space-y-5 shrink-0">
            {/* UniProt Search */}
            <div>
              <Label className="text-xs text-muted-foreground">Search UniProt</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Gene name (e.g. TP53, BRCA1) or UniProt ID (e.g. P04637)</p>
              <div className="flex gap-1.5">
                <Input className="h-8 text-xs flex-1" placeholder="TP53, EGFR, P04637..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") searchUniProt(); }} />
                <Button size="sm" className="h-8 px-3 text-xs" onClick={searchUniProt} disabled={searching}>
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Protein info */}
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Protein name</Label>
                <Input className="mt-1 h-8 text-xs" value={proteinName} onChange={e => setProteinName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Length (amino acids)</Label>
                <Input className="mt-1 h-8 text-xs font-mono" type="text" inputMode="numeric"
                  value={proteinLength} onChange={e => setProteinLength(e.target.value)} />
              </div>
            </div>

            {/* Examples */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Examples</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(EXAMPLES).map(([k, ex]) => (
                  <button key={k} onClick={() => loadExample(k)}
                    className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Domains list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Features ({domains.length})</span>
                <div className="flex gap-2">
                  <button onClick={copyDomainTable} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                  <button onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors">
                    {showAddForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    {showAddForm ? "Cancel" : "Add"}
                  </button>
                </div>
              </div>

              {showAddForm && (
                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2 mb-2">
                  <Input className="h-7 text-xs" placeholder="Feature name" value={newDomain.name}
                    onChange={e => setNewDomain({ ...newDomain, name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input className="h-7 text-xs font-mono" placeholder="Start" type="text" inputMode="numeric"
                      value={newDomain.start || ""} onChange={e => setNewDomain({ ...newDomain, start: parseInt(e.target.value) || 0 })} />
                    <Input className="h-7 text-xs font-mono" placeholder="End" type="text" inputMode="numeric"
                      value={newDomain.end || ""} onChange={e => setNewDomain({ ...newDomain, end: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex gap-1.5">
                    <Select value={newDomain.type} onValueChange={(v: any) => setNewDomain({ ...newDomain, type: v })}>
                      <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_STYLES).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="color" value={newDomain.color} onChange={e => setNewDomain({ ...newDomain, color: e.target.value })}
                      className="h-7 w-10 rounded border border-border cursor-pointer" />
                  </div>
                  <Button size="sm" className="h-7 text-[10px] w-full" onClick={addDomain}>Add Feature</Button>
                </div>
              )}

              <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
                {domains.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/20 text-[10px]">
                    <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="font-medium text-foreground truncate flex-1">{d.name}</span>
                    <span className="text-muted-foreground font-mono">{d.start}–{d.end}</span>
                    <button onClick={() => removeDomain(i)} className="text-muted-foreground/40 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => exportPlot("svg")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> SVG
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => exportPlot("png")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> PNG
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={openInCanvas}>Canvas</Button>
            </div>
          </div>

          {/* Visualization */}
          <div className="flex-1 min-w-0">
            <div className="bg-card rounded-xl border border-border p-4">
              <ProteinSVG proteinLength={length} proteinName={proteinName} domains={domains} svgRef={svgRef} />
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-xl bg-muted/20 border border-border/30 text-[11px] text-muted-foreground leading-relaxed space-y-1.5 max-w-2xl">
          <p><strong>Feature types:</strong> Domain (colored rectangle), Signal peptide (arrow), Transmembrane (narrow rectangle), Coiled coil (thin bar), Disordered region (zigzag), PTM site (diamond marker), Region (semi-transparent box).</p>
          <p><strong>Positions:</strong> 1-based amino acid numbering. Start and end positions are inclusive.</p>
          <p><strong>PTM sites:</strong> Use start = end for single-residue modifications (phosphorylation, acetylation, etc.).</p>
          <p><strong>Examples:</strong> TP53 (tumor suppressor with TAD, DNA-binding, tetramerization domains + PTMs), EGFR (receptor tyrosine kinase with extracellular domains + TM + kinase), Insulin (signal + B/C/A chains), β2-Adrenergic (GPCR with 7 TM helices).</p>
        </div>
      </div>
    </div>
  );
};

export default ProteinDomains;
