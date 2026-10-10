import { useNavigate } from "react-router-dom";
import {
  FlowArrow,
  ListChecks,
  Calendar,
  Atom,
  Camera,
  PencilLine,
  TextAa,
  ArrowsClockwise,
  MagicWand,
  ImageSquare,
} from "@phosphor-icons/react";
import { Sparkles, Pencil } from "lucide-react";

const AI_FEATURES = [
  {
    icon: <Atom size={28} weight="duotone" />,
    name: "Icon Generator",
    description: "Generate scientific icons from a text prompt — proteins, organelles, anatomy.",
  },
  {
    icon: <TextAa size={28} weight="duotone" />,
    name: "Text to Figure",
    description: "Turn a description into a publication-style schematic or pathway diagram.",
  },
  {
    icon: <PencilLine size={28} weight="duotone" />,
    name: "Sketch to Illustration",
    description: "Transform rough sketches into clean, BioRender-style flat 2D illustrations.",
  },
  {
    icon: <Camera size={28} weight="duotone" />,
    name: "Photo to 2D",
    description: "Convert any photograph into a flat 2D vector-style scientific illustration.",
  },
  {
    icon: <ArrowsClockwise size={28} weight="duotone" />,
    name: "Image to Figure",
    description: "Take a micrograph, gel, or photo and render it as a labeled publication figure.",
  },
  {
    icon: <ImageSquare size={28} weight="duotone" />,
    name: "Reference to Figure",
    description: "Recreate a reference image as a clean flat 2D vector scientific figure.",
  },
  {
    icon: <MagicWand size={28} weight="duotone" />,
    name: "Illustration Enhancer",
    description: "Sharpen, clean, and refine an existing illustration to publication quality.",
  },
  {
    icon: <FlowArrow size={28} weight="duotone" />,
    name: "Flowchart",
    description: "Generate clean, editable flowcharts from a text description of any process.",
  },
  {
    icon: <ListChecks size={28} weight="duotone" />,
    name: "Protocol Diagram",
    description: "Convert a written method into a clear, numbered protocol diagram.",
  },
  {
    icon: <Calendar size={28} weight="duotone" />,
    name: "Experimental Timeline",
    description: "Generate horizontal experimental timelines from a study description.",
  },
];

export const HallmarkSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative w-full py-20 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* ── AI Illustration Suite (lab-notebook scientific theme) ── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm px-7 md:px-10 py-8 md:py-10">
          {/* Atomic-orbit motif backdrop */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute -top-6 -right-6 w-48 h-48 md:w-56 md:h-56 text-slate-300 opacity-25"
          >
            <defs>
              <linearGradient id="hallmarkOrbitFade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <g stroke="url(#hallmarkOrbitFade)" fill="none" strokeWidth="1.4">
              <ellipse cx="100" cy="100" rx="78" ry="28" />
              <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(60 100 100)" />
              <ellipse cx="100" cy="100" rx="78" ry="28" transform="rotate(-60 100 100)" />
            </g>
            <circle cx="100" cy="100" r="6" fill="hsl(213, 55%, 50%)" opacity="0.55" />
            <circle cx="172" cy="106" r="3.5" fill="hsl(213, 55%, 50%)" opacity="0.7" />
            <circle cx="56" cy="72" r="2.8" fill="hsl(213, 55%, 50%)" opacity="0.5" />
            <circle cx="68" cy="146" r="2.5" fill="hsl(213, 55%, 50%)" opacity="0.4" />
          </svg>

          {/* Header (matches Projects-style hero) */}
          <div className="relative">
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50/80 mb-3"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <svg width={11} height={11} viewBox="0 0 12 12" fill="none" className="text-[hsl(213,55%,50%)]" aria-hidden>
                <ellipse cx="6" cy="6" rx="5" ry="2" stroke="currentColor" strokeWidth="0.8" />
                <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                <ellipse cx="6" cy="6" rx="5" ry="2" transform="rotate(-60 6 6)" stroke="currentColor" strokeWidth="0.8" />
                <circle cx="6" cy="6" r="1.1" fill="currentColor" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                AI Illustration Suite
              </span>
            </div>
            <h2
              className="text-3xl md:text-[40px] font-bold text-slate-900 leading-[1.05] max-w-3xl"
              style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.028em" }}
            >
              Ten ways to{" "}
              <span
                className="italic font-bold"
                style={{
                  fontFamily: "'Crimson Pro','Source Serif Pro',Georgia,serif",
                  color: "hsl(213, 55%, 36%)",
                }}
              >
                generate
              </span>
              . One canvas to refine.
            </h2>
            <p className="text-[13px] text-muted-foreground mt-2 max-w-2xl inline-flex items-center gap-1.5 flex-wrap">
              <Pencil className="w-3.5 h-3.5 text-[hsl(213,55%,50%)]" />
              Every AI output drops straight into the BioSketch canvas — fully editable, vector-style.
            </p>
          </div>

          {/* Cards marquee — auto-scrolls, pauses on hover, individual cards expand */}
          <style>{`
            @keyframes hallmark-marquee {
              from { transform: translateX(0); }
              to   { transform: translateX(-50%); }
            }
            .hallmark-track { animation: hallmark-marquee 50s linear infinite; }
            .hallmark-marquee:hover .hallmark-track { animation-play-state: paused; }
            @media (prefers-reduced-motion: reduce) {
              .hallmark-track { animation: none; }
            }
          `}</style>
          <div
            className="hallmark-marquee relative mt-7 overflow-hidden py-3"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
            }}
          >
            <div className="hallmark-track flex gap-3 w-max">
              {[...AI_FEATURES, ...AI_FEATURES].map((f, i) => (
                <button
                  key={`${f.name}-${i}`}
                  onClick={() => navigate("/ai-illustrator")}
                  className="group w-72 flex-none text-left rounded-xl bg-white border border-slate-200/80 p-5 hover:border-slate-300 hover:shadow-md hover:scale-[1.06] hover:z-10 transition-transform transition-shadow duration-300"
                >
                  <div
                    className="inline-flex items-center justify-center rounded-lg w-9 h-9 mb-3 text-[hsl(213,55%,36%)]"
                    style={{
                      background: "rgba(96, 165, 250, 0.10)",
                      border: "1px solid rgba(96, 165, 250, 0.20)",
                    }}
                  >
                    {f.icon}
                  </div>
                  <h3
                    className="text-sm font-bold text-slate-900 mb-1"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {f.name}
                  </h3>
                  <p
                    className="text-[12px] text-slate-600 leading-relaxed mb-3"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {f.description}
                  </p>
                  <span className="text-[11px] font-semibold text-[hsl(213,55%,36%)] group-hover:underline">
                    Try it →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/ai-illustrator")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md"
          >
            <Sparkles className="w-4 h-4" />
            Open AI Illustrator
          </button>
        </div>
      </div>
    </section>
  );
};
