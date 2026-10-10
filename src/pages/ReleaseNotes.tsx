import { useNavigate } from "react-router-dom";
import { CheckCircle2, Sparkles, GitBranch, PackageCheck, ArrowRight, Rocket } from "lucide-react";
import { SEOHead } from "@/components/SEO/SEOHead";

const releaseStyles = `
  @keyframes rn-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .rn-fade-1 { animation: rn-fade-up 0.4s ease-out 0.1s both; }
  .rn-fade-2 { animation: rn-fade-up 0.4s ease-out 0.2s both; }
  .rn-fade-3 { animation: rn-fade-up 0.4s ease-out 0.3s both; }
`;

const ReleaseNotes = () => {
  const navigate = useNavigate();

  const releases = [
    {
      version: "3.0.0",
      date: "April 2026",
      title: "Simple Canvas & New Tools",
      features: [
        {
          title: "Simple Canvas Mode",
          description: "A streamlined editor with the canvas front-and-center and just the essentials — select, text, shapes, lines, pen, eraser, and image. Same project format as Advanced Canvas, switch between modes anytime without losing work.",
          icon: "🎨"
        },
        {
          title: "Triple Membrane Tool",
          description: "Draw curvature-aware membrane bands with a single path. Curvature smoothing prevents overlap on tight curves, signed-curvature normals stay attached as you edit, and band geometry regenerates instantly in edit mode.",
          icon: "🧬"
        },
        {
          title: "Free Scientific Tools Collection",
          description: "30+ free browser-based tools for researchers: Kaplan-Meier survival curves, volcano plots, dose-response IC50/EC50 fitter, pedigree charts, codon wheel, gel electrophoresis simulator, plasmid viewer, and more. No signup required.",
          icon: "🧪"
        },
        {
          title: "Free AI Credits Program",
          description: "Earn AI generation credits by sharing approved community projects. Tiered structure starts at 20 credits for 3 approved projects, with +10 per additional project plus profile bonuses. No subscriptions, no paywalls — ever.",
          icon: "✨"
        }
      ]
    },
    {
      version: "2.2.0",
      date: "February 2025",
      title: "AI & PowerPoint Features",
      features: [
        {
          title: "AI Icon Generator",
          description: "Generate custom scientific icons instantly using AI. Describe what you need and watch as AI creates professional icons tailored to your specifications.",
          icon: "🤖"
        },
        {
          title: "PowerPoint Export",
          description: "Transform your scientific illustrations into professional PowerPoint presentations. Export diagrams with customizable templates and layouts for seamless presentation workflow.",
          icon: "📊"
        },
        {
          title: "Expanded Icon Library",
          description: "Hundreds of new professionally-designed scientific icons added by the BioSketch team. Enhanced coverage across anatomy, cellular biology, chemistry, and medical equipment categories.",
          icon: "🎨"
        },
        {
          title: "AI Figure Generator",
          description: "Create complete scientific figures from text descriptions. AI understands scientific concepts and generates publication-ready illustrations with proper labels and styling.",
          icon: "✨"
        }
      ]
    },
    {
      version: "2.1.1",
      date: "January 2025",
      title: "Lab Notebook Theme",
      features: [
        {
          title: "Lab Notebook Visual Theme",
          description: "Complete redesign with warm, organic notebook aesthetic featuring ruled lines, handwritten accents (Caveat font), and academic typography (Source Serif 4).",
          icon: "📔"
        },
        {
          title: "Notebook-Styled Components",
          description: "Pages now feature paper textures, sticky notes, washi tape decorations, torn notebook page cards, and spiral binding effects throughout the interface.",
          icon: "✏️"
        },
        {
          title: "Enhanced Navigation",
          description: "Top navigation bar updated with notebook theme including paper texture, handwritten logo font, and highlighter-yellow hover accents.",
          icon: "🎨"
        },
        {
          title: "Community & Blog Updates",
          description: "Community gallery and blog pages redesigned with paper-tab filters, sticky note stats, and torn page project cards for authentic notebook feel.",
          icon: "📰"
        }
      ]
    },
    {
      version: "1.1.0",
      date: "December 2024",
      title: "Community & Collaboration",
      features: [
        {
          title: "Community Gallery",
          description: "Browse and share scientific illustrations created by users worldwide. Discover inspiration and contribute your own work to the growing collection.",
          icon: "👥"
        },
        {
          title: "Icon Suggestion System",
          description: "Request new scientific icons directly through the app. Submit your icon needs and help shape the library with community-driven additions.",
          icon: "💡"
        },
        {
          title: "Advanced Connector Tool",
          description: "Create professional diagrams with smart connectors that automatically route between objects and stay attached when elements are moved.",
          icon: "🔗"
        },
        {
          title: "User Asset Upload",
          description: "Upload and manage your own custom assets. Build a personal library of frequently used images and icons for faster workflow.",
          icon: "📤"
        },
        {
          title: "Project Management",
          description: "Save, organize, and access all your illustrations from one central dashboard. Never lose your work with cloud-based project storage.",
          icon: "📁"
        }
      ]
    }
  ];

  const totalFeatures = releases.reduce((sum, r) => sum + r.features.length, 0);

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #E8F0FF 0%, #F5F9FF 35%, #FFFFFF 100%)",
      }}
    >
      <style>{releaseStyles}</style>

      <SEOHead
        title="What's New - BioSketch Release Notes"
        description="Latest features and improvements in BioSketch. Discover new tools for creating scientific illustrations including community gallery, icon suggestions, and advanced connectors."
        canonical="https://biosketch.art/release-notes"
      />

      {/* Soft decorative blobs */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-200/25 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-3xl" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 md:pt-16">

        {/* ── Hero header (homepage style) ── */}
        <div className="text-center rn-fade-1">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            }}
          >
            <Rocket className="h-3.5 w-3.5 text-slate-700" />
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
              Release Notes
            </span>
          </div>

          <h1
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(32px, 5vw, 56px)",
              lineHeight: "1.1",
              color: "#1a1a1a",
              letterSpacing: "-0.02em",
            }}
          >
            What's new in BioSketch.
          </h1>

          <p
            className="mx-auto mt-4 max-w-xl"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(14px, 1.8vw, 18px)",
              lineHeight: "1.6",
              color: "#4a5568",
            }}
          >
            The latest features, improvements, and updates shipped by our team.
          </p>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 gap-3 mt-10 max-w-md mx-auto rn-fade-2">
          {[
            { icon: PackageCheck, value: releases.length, label: 'Releases' },
            { icon: Sparkles, value: totalFeatures, label: 'Features' },
          ].map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 px-4 py-5 text-center"
              style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
            >
              <div className="flex items-center justify-center mb-2">
                <div className="rounded-lg bg-primary p-1.5">
                  <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <p
                className="text-2xl font-bold text-slate-900 tabular-nums"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
              >
                {value}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5 font-medium">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Releases timeline ── */}
        <div className="mt-12 space-y-10 rn-fade-2">
          {releases.map((release) => (
            <div key={release.version}>
              {/* Release Version Header */}
              <div
                className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-5 md:p-6 mb-4"
                style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary mb-2">
                      <GitBranch className="w-3 h-3 text-white" strokeWidth={2.5} />
                      <span className="text-[11px] font-semibold text-white tabular-nums">v{release.version}</span>
                    </div>
                    <h2
                      className="text-xl font-bold text-slate-900"
                      style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
                    >
                      {release.title}
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{release.date}</span>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {release.features.map((feature, featureIndex) => (
                  <div
                    key={featureIndex}
                    className="group/card rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-5 transition-all duration-200 hover:-translate-y-0.5"
                    style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-xl">
                        {feature.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-slate-700 shrink-0" strokeWidth={2.5} />
                          <h3
                            className="font-semibold text-slate-900 text-sm"
                            style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}
                          >
                            {feature.title}
                          </h3>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-600">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── CTA banner ── */}
        <div className="mt-12 rn-fade-3">
          <div
            className="rounded-2xl bg-primary p-8 md:p-10 text-center"
            style={{ boxShadow: "0 8px 32px -8px rgba(15, 23, 42, 0.25)" }}
          >
            <h2
              className="text-2xl md:text-3xl font-bold text-white mb-2"
              style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
            >
              Ready to create?
            </h2>
            <p className="text-slate-300 text-sm max-w-md mx-auto mb-6">
              Start using these powerful features to build stunning scientific illustrations today.
            </p>
            <button
              onClick={() => navigate("/projects")}
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-100 transition-colors shadow-md"
            >
              Start Creating
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-16" />
      </div>
    </div>
  );
};

export default ReleaseNotes;
