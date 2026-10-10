"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { PlayCircle, Sparkles, Users, Zap } from "lucide-react"

interface BiosketchVideoSectionProps {
  videoEmbedUrl?: string
  title?: string
  subtitle?: string
  badge?: string
}

// Each highlight gets a tinted ambient shadow + matching badge color so the
// row feels lively without being noisy. Colors are kept muted-scientific.
const HIGHLIGHTS = [
  {
    icon: Zap,
    label: "Built for speed",
    description: "Drag, drop, done — no design skills required",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    shadowRgb: "234, 179, 8",
  },
  {
    icon: Sparkles,
    label: "Publication ready",
    description: "Export at 600 DPI for journals and posters",
    badgeBg: "bg-violet-100",
    badgeText: "text-violet-700",
    shadowRgb: "139, 92, 246",
  },
  {
    icon: Users,
    label: "Loved by researchers",
    description: "Used by labs and universities worldwide",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    shadowRgb: "16, 185, 129",
  },
]

export function BiosketchVideoSection({
  videoEmbedUrl = "https://www.youtube.com/embed/rETbE0cX0e8?autoplay=1&mute=1",
  title = "See BioSketch in action",
  subtitle = "Watch how researchers create publication-quality scientific illustrations in minutes — without ever opening Illustrator.",
  badge = "2-MIN DEMO",
}: BiosketchVideoSectionProps) {
  return (
    <section
      className="relative w-full overflow-hidden py-16 lg:py-24"
      style={{
        background:
          "linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 50%, #F5F5F5 100%)",
      }}
    >
      {/* Soft decorative blobs in the background */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-gray-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-gray-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            }}
          >
            <PlayCircle className="h-3.5 w-3.5 text-slate-700" />
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                color: "#1a1a1a",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {badge}
            </span>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 4.5vw, 56px)",
              lineHeight: "1.1",
              color: "#1a1a1a",
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-4 max-w-xl"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(14px, 1.8vw, 18px)",
              lineHeight: "1.6",
              color: "#4a5568",
            }}
          >
            {subtitle}
          </motion.p>
        </div>

        {/* Video frame */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="relative mx-auto"
          style={{ maxWidth: "1000px" }}
        >
          {/* Decorative dotted accents around the frame */}
          <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-gray-400/40 blur-sm pointer-events-none" />
          <div className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-gray-400/40 blur-sm pointer-events-none" />

          <div
            className="relative overflow-hidden bg-white"
            style={{
              borderRadius: "28px",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              boxShadow:
                "0 30px 80px -20px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5) inset",
              padding: "12px",
            }}
          >
            <div
              className="relative w-full overflow-hidden"
              style={{
                paddingBottom: "56.25%",
                borderRadius: "20px",
              }}
            >
              <iframe
                className="absolute inset-0 w-full h-full"
                src={videoEmbedUrl}
                title="BioSketch demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
              />
            </div>
          </div>
        </motion.div>

        {/* Highlights row below the video */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-4xl mx-auto"
        >
          {HIGHLIGHTS.map((highlight, i) => {
            const Icon = highlight.icon
            return (
              <div
                key={i}
                className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-5 flex items-start gap-3 transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  boxShadow: `0 6px 22px -8px rgba(${highlight.shadowRgb}, 0.22), 0 1px 3px rgba(15, 23, 42, 0.04)`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 14px 36px -8px rgba(${highlight.shadowRgb}, 0.34), 0 2px 6px rgba(15, 23, 42, 0.06)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 6px 22px -8px rgba(${highlight.shadowRgb}, 0.22), 0 1px 3px rgba(15, 23, 42, 0.04)`;
                }}
              >
                <div className={`rounded-xl ${highlight.badgeBg} p-2 flex-shrink-0`}>
                  <Icon className={`h-4 w-4 ${highlight.badgeText}`} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold text-slate-900"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {highlight.label}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {highlight.description}
                  </p>
                </div>
              </div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
