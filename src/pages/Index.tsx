import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { IconSubmissionDialog } from "@/components/community/IconSubmissionDialog";
import { ProjectPreviewModal } from "@/components/community/ProjectPreviewModal";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEO/SEOHead";
import { getWebApplicationSchema, getOrganizationSchema } from "@/components/SEO/StructuredData";
import { useRecentSignups } from "@/hooks/useRecentSignups";
import { SignupToast } from "@/components/SignupToast";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { BiosketchHero } from "@/components/ui/biosketch-hero";
import { ExitIntentModal } from "@/components/ExitIntentModal";
import { HomeBento } from "@/components/home/HomeBento";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const { data: signupData } = useRecentSignups();

  useEffect(() => {
    supabase
      .from("icon_categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCategories(data || []));
  }, []);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [getWebApplicationSchema(), getOrganizationSchema()],
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle grid background — design tool aesthetic */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.07] dark:opacity-[0.1]"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      <MaintenanceBanner />

      <SEOHead
        title="BioSketch - Free Scientific Illustration Tool for Researchers"
        description="Create stunning scientific illustrations with BioSketch - a free drag-and-drop tool for scientists and researchers. Build publication-ready figures with our extensive biomedical icon library."
        canonical="https://biosketch.art/"
        keywords="scientific illustration, biomedical graphics, research illustration software, free science graphics, publication figures, scientific diagrams, biology illustration, medical graphics creator"
        structuredData={structuredData}
      />

      {/* Hero Section */}
      <BiosketchHero
        title="Scientific figures, made simple."
        subtitle="BioSketch.Art is a free, open illustration software built for researchers. Create publication-quality figures for papers, posters, and grants — minimal design skills needed."
        primaryAction={{
          label: user ? "Start Creating" : "Get Started Free",
          onClick: () => navigate(user ? "/projects" : "/auth"),
        }}
        secondaryAction={{
          label: "Browse Community",
          onClick: () => navigate("/community"),
        }}
        disclaimer="*Free forever. No credit card required."
        showcase={{
          title: "Wnt Signaling Pathways Regulate Cell-Cycle Progression",
          prompt: `Create a publication-ready, landscape biomedical pathway infographic titled "Wnt Signaling Pathways Regulate Cell-Cycle Progression." Cell Press–style aesthetic with a white background, crisp dark-gray linework, muted pastel colors, smooth semi-flat vector rendering.

Compose the figure as an integrated left-to-right signaling map that connects Wnt receptor activation at the plasma membrane to two distinct outcomes: canonical β-catenin–dependent G1/S progression and Wnt/STOP–dependent G2/M progression and mitotic control. Show a Wnt ligand binding Frizzled + LRP5/6, DVL adaptor, an inhibited β-catenin destruction complex (APC · Axin · GSK3 · CK1), stabilized β-catenin entering the nucleus to activate c-MYC and Cyclin D. On the Wnt/STOP branch, show stabilization of Protein X/Y/Z leading to cell-size, spindle assembly, and mitotic control panels. Include a circular G1 · S · G2 · M cell-cycle diagram in the lower right.`,
          imageUrl: "https://tljsbmpglwmzyaoxsqyj.supabase.co/storage/v1/object/public/badges%20folder/PROMPT%20WNT%20SIGNALING%20GLOSSY%203D.png",
          imageAlt: "AI-generated Wnt signaling pathway figure, Cell Press–style with muted pastel palette",
        }}
      />

      {/* Editorial bento — open library, AI suite, stats, quote, community CTA */}
      <HomeBento />

      <IconSubmissionDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog} categories={categories} />
      <ProjectPreviewModal project={selectedProject} isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} />
      {signupData && <SignupToast signup={signupData} />}

      {/* Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-4xl p-0 gap-0 bg-black border-0 overflow-hidden rounded-xl">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={showVideoModal ? "https://www.youtube.com/embed/rETbE0cX0e8?autoplay=1" : ""}
              title="How to use BioSketch.Art"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>

      <ExitIntentModal />
    </div>
  );
};

export default Index;
