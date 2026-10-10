"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"

// Custom SVG icons — hand-drawn, subtle, no Lucide
function IconShapes({ color }: { color: string }) {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32">
      <circle cx={10} cy={12} r={6} fill="none" stroke={color} strokeWidth={1.8} opacity={0.7} />
      <rect x={17} y={7} width={10} height={10} rx={2} fill="none" stroke={color} strokeWidth={1.8} opacity={0.5} />
      <polygon points="14,22 22,30 6,30" fill="none" stroke={color} strokeWidth={1.8} opacity={0.6} />
    </svg>
  )
}
function IconCanvas({ color }: { color: string }) {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32">
      <rect x={3} y={3} width={26} height={20} rx={2} fill="none" stroke={color} strokeWidth={1.8} opacity={0.5} />
      <rect x={6} y={6} width={8} height={6} rx={1} fill={color} opacity={0.15} />
      <line x1={6} y1={16} x2={18} y2={16} stroke={color} strokeWidth={1.5} opacity={0.3} strokeLinecap="round" />
      <line x1={6} y1={19} x2={14} y2={19} stroke={color} strokeWidth={1.5} opacity={0.2} strokeLinecap="round" />
      <path d="M22,10 L26,14 L20,20 L16,21 L17,17 Z" fill={color} opacity={0.25} stroke={color} strokeWidth={1} />
    </svg>
  )
}
function IconTools({ color }: { color: string }) {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32">
      <circle cx={12} cy={12} r={8} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />
      <circle cx={12} cy={12} r={3} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
      <line x1={18} y1={18} x2={28} y2={28} stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
      <circle cx={6} cy={26} r={2} fill={color} opacity={0.2} />
      <circle cx={26} cy={6} r={1.5} fill={color} opacity={0.15} />
    </svg>
  )
}
function IconExport({ color }: { color: string }) {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32">
      <rect x={5} y={4} width={18} height={24} rx={2} fill="none" stroke={color} strokeWidth={1.8} opacity={0.4} />
      <line x1={9} y1={12} x2={19} y2={12} stroke={color} strokeWidth={1.5} opacity={0.3} strokeLinecap="round" />
      <line x1={9} y1={16} x2={16} y2={16} stroke={color} strokeWidth={1.5} opacity={0.25} strokeLinecap="round" />
      <line x1={9} y1={20} x2={17} y2={20} stroke={color} strokeWidth={1.5} opacity={0.2} strokeLinecap="round" />
      <rect x={9} y={6} width={10} height={3} rx={0.5} fill={color} opacity={0.15} />
      <path d="M24,18 L24,28 L28,23 M24,28 L20,23" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
    </svg>
  )
}
function IconTemplates({ color }: { color: string }) {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32">
      <rect x={3} y={3} width={12} height={12} rx={2} fill={color} opacity={0.1} stroke={color} strokeWidth={1.2} opacity={0.3} />
      <rect x={17} y={3} width={12} height={5} rx={1.5} fill={color} opacity={0.08} stroke={color} strokeWidth={1.2} opacity={0.25} />
      <rect x={17} y={10} width={12} height={5} rx={1.5} fill={color} opacity={0.12} stroke={color} strokeWidth={1.2} opacity={0.3} />
      <rect x={3} y={17} width={26} height={12} rx={2} fill={color} opacity={0.06} stroke={color} strokeWidth={1.2} opacity={0.2} />
      <line x1={7} y1={22} x2={18} y2={22} stroke={color} strokeWidth={1.2} opacity={0.2} strokeLinecap="round" />
      <line x1={7} y1={25} x2={14} y2={25} stroke={color} strokeWidth={1.2} opacity={0.15} strokeLinecap="round" />
    </svg>
  )
}
function IconCollaboration({ color }: { color: string }) {
  return (
    <svg width={32} height={32} viewBox="0 0 32 32">
      <circle cx={11} cy={10} r={4} fill="none" stroke={color} strokeWidth={1.8} opacity={0.5} />
      <path d="M3,24 C3,18 7,16 11,16 C15,16 19,18 19,24" fill="none" stroke={color} strokeWidth={1.8} opacity={0.4} />
      <circle cx={22} cy={12} r={3.5} fill="none" stroke={color} strokeWidth={1.5} opacity={0.35} />
      <path d="M16,26 C16,21 18.5,19 22,19 C25.5,19 28,21 28,26" fill="none" stroke={color} strokeWidth={1.5} opacity={0.3} />
      <circle cx={25} cy={6} r={1} fill={color} opacity={0.4} />
      <circle cx={27} cy={8} r={0.8} fill={color} opacity={0.3} />
    </svg>
  )
}

const ICON_COMPONENTS: Record<string, React.FC<{ color: string }>> = {
  icons: IconShapes,
  canvas: IconCanvas,
  tools: IconTools,
  export: IconExport,
  templates: IconTemplates,
  collaboration: IconCollaboration,
}

const ACCENT_COLORS: Record<string, string> = {
  icons: "#404040",
  canvas: "#404040",
  tools: "#404040",
  export: "#404040",
  templates: "#404040",
  collaboration: "#404040",
}

interface FeatureCard {
  id: string
  title: string
  description: string
  accentColor: string
  bgGradient: string
}

const FEATURES: FeatureCard[] = [
  {
    id: "icons",
    title: "30,000+ Scientific Icons",
    description: "Drag-and-drop biomedical SVG icons covering biology, chemistry, neuroscience, genetics, and more.",
    accentColor: "text-slate-700",
    bgGradient: "from-slate-50 to-white",
  },
  {
    id: "canvas",
    title: "Canvas Editor",
    description: "Publication-ready figure builder with real-time editing, layers, and precise alignment tools.",
    accentColor: "text-slate-700",
    bgGradient: "from-gray-50 to-white",
  },
  {
    id: "tools",
    title: "Specialized Tools",
    description: "Volcano plots, pedigrees, heatmaps, Kaplan-Meier curves, phylogenetic trees, and 30+ more scientific tools.",
    accentColor: "text-slate-700",
    bgGradient: "from-slate-50 to-white",
  },
  {
    id: "export",
    title: "Export Anywhere",
    description: "PNG, SVG, PDF, and PowerPoint export at 150, 300, or 600 DPI for any publication or presentation.",
    accentColor: "text-slate-700",
    bgGradient: "from-gray-50 to-white",
  },
  {
    id: "templates",
    title: "Templates",
    description: "Pre-built layouts for common figures — pathways, mechanisms, signaling cascades, and lab workflows.",
    accentColor: "text-slate-700",
    bgGradient: "from-slate-50 to-white",
  },
  {
    id: "collaboration",
    title: "Live Collaboration",
    description: "Work together on the same canvas in real time with comments, presence cursors, and version history.",
    accentColor: "text-slate-700",
    bgGradient: "from-gray-50 to-white",
  },
]

const AUTO_ADVANCE_MS = 4500

export function BiosketchFeatureCards() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  // Auto-advance timer
  React.useEffect(() => {
    if (isPaused || isHovered) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % FEATURES.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [isPaused, isHovered])

  const goNext = () => setActiveIndex((prev) => (prev + 1) % FEATURES.length)
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + FEATURES.length) % FEATURES.length)

  return (
    <section className="bg-gradient-to-b from-white via-gray-50/50 to-white py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          <h2
            className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight"
            style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
          >
            Everything you need to illustrate science
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-600">
            Six core features that help researchers, educators, and students create publication-quality figures in minutes.
          </p>
        </div>

        {/* Stacked card deck with auto-advance */}
        <div
          className="relative mx-auto"
          style={{
            width: "100%",
            maxWidth: "520px",
            height: "440px",
            perspective: "1200px",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {FEATURES.map((feature, index) => {
            const SvgIcon = ICON_COMPONENTS[feature.id]
            const iconColor = ACCENT_COLORS[feature.id] || "#64748b"
            // Position relative to active (0 = top, 1 = behind, 2 = further behind, ...)
            const offset = (index - activeIndex + FEATURES.length) % FEATURES.length
            const isVisible = offset < 4 // only render top 4 cards for performance
            const isTop = offset === 0

            return (
              <motion.div
                key={feature.id}
                initial={false}
                animate={{
                  y: offset * 14,
                  scale: 1 - offset * 0.05,
                  rotateZ: offset === 0 ? 0 : (offset % 2 === 0 ? 1.5 : -1.5) * offset,
                  opacity: isVisible ? 1 : 0,
                  zIndex: FEATURES.length - offset,
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 26,
                  mass: 0.8,
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: isTop ? "auto" : "none",
                }}
              >
                <div
                  className={`h-full w-full rounded-3xl border border-slate-200 bg-gradient-to-br ${feature.bgGradient} shadow-2xl shadow-slate-900/15 backdrop-blur-sm`}
                  style={{ padding: "40px 36px" }}
                >
                  <div className="flex flex-col h-full justify-between">
                    {/* Top: icon + step counter */}
                    <div className="flex items-start justify-between">
                      <div className="rounded-2xl bg-white shadow-md p-3 border border-slate-200/60">
                        {SvgIcon ? <SvgIcon color={iconColor} /> : <div className="w-8 h-8" />}
                      </div>
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        {String(index + 1).padStart(2, "0")} / {String(FEATURES.length).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Middle: title + description */}
                    <div className="flex flex-col gap-4 flex-1 justify-center">
                      <h3
                        className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight"
                        style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
                      >
                        {feature.title}
                      </h3>
                      <p className="text-base text-slate-600 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>

                    {/* Bottom: progress bar that fills while card is active */}
                    <div className="h-1 w-full bg-slate-200/60 rounded-full overflow-hidden">
                      {isTop && !isPaused && !isHovered && (
                        <motion.div
                          key={`${feature.id}-progress-${activeIndex}`}
                          className="h-full bg-slate-900"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: "linear" }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Controls below the stack */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={goPrev}
            className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all flex items-center justify-center text-slate-700"
            aria-label="Previous feature"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {FEATURES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === activeIndex ? "w-8 bg-slate-900" : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to feature ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => setIsPaused((p) => !p)}
            className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all flex items-center justify-center text-slate-700"
            aria-label={isPaused ? "Resume autoplay" : "Pause autoplay"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          <button
            onClick={goNext}
            className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all flex items-center justify-center text-slate-700"
            aria-label="Next feature"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
