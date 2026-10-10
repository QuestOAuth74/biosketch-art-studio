import { Link } from "react-router-dom";
import {
  Scale,
  ImageIcon,
  Users,
  Upload,
  ShieldAlert,
  AlertTriangle,
  FlaskConical,
  Lock,
  FileText,
  Ban,
  Gavel,
  CheckCircle2,
} from "lucide-react";
import { SEOHead } from "@/components/SEO/SEOHead";

const termsStyles = `
  @keyframes ts-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .ts-fade-1 { animation: ts-fade-up 0.4s ease-out 0.1s both; }
  .ts-fade-2 { animation: ts-fade-up 0.4s ease-out 0.2s both; }
  .ts-fade-3 { animation: ts-fade-up 0.4s ease-out 0.3s both; }
`;

interface TermsSectionProps {
  icon: React.ReactNode;
  number: string;
  title: string;
  children: React.ReactNode;
}

const TermsSection = ({ icon, number, title, children }: TermsSectionProps) => (
  <div
    className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-6 md:p-8 transition-all duration-200 hover:-translate-y-0.5"
    style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
  >
    <div className="flex items-start gap-4 mb-4">
      <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Section {number}</span>
        <h2
          className="text-lg font-bold text-slate-900"
          style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
      </div>
    </div>
    <div className="text-sm text-slate-600 leading-relaxed">
      {children}
    </div>
  </div>
);

const Terms = () => {
  const usageLicenseItems = [
    'Academic research publications',
    'Educational materials and presentations',
    'Scientific documentation and reports',
    'Commercial and non-commercial scientific communication'
  ];

  const iconLibraryItems = [
    'Icons may be used without restriction in your scientific projects',
    'No copyright permission is required for use of these icons',
    'Icons may be modified, adapted, and incorporated into derivative works'
  ];

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #E8F0FF 0%, #F5F9FF 35%, #FFFFFF 100%)",
      }}
    >
      <style>{termsStyles}</style>

      <SEOHead
        title="Terms and Conditions - BioSketch.Art"
        description="Terms of service and usage guidelines for BioSketch.Art scientific illustration tool. Learn about licensing, usage rights, and community guidelines."
        canonical="https://biosketch.art/terms"
      />

      {/* Soft decorative blobs */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-200/25 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-sky-200/20 rounded-full blur-3xl" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-12 md:pt-16">

        {/* ── Hero header (homepage style) ── */}
        <div className="text-center ts-fade-1">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            }}
          >
            <Scale className="h-3.5 w-3.5 text-slate-700" />
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
              Legal
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
            Terms & conditions.
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
            By using BioSketch.Art, you agree to these terms. We've designed them to be fair, transparent, and supportive of the scientific community.
          </p>
          <p className="text-[11px] text-slate-400 mt-3 uppercase tracking-wider font-semibold">
            Last Updated: January 2025
          </p>
        </div>

        {/* ── Terms Sections ── */}
        <div className="ts-fade-2 mt-12 space-y-4">
          <TermsSection
            icon={<FlaskConical className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="1"
            title="License and Usage"
          >
            <p className="mb-3">
              BioSketch.Art is provided <span className="font-semibold text-slate-900">free of charge</span> for use in all scientific projects, including but not limited to:
            </p>
            <ul className="space-y-2">
              {usageLicenseItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-700 mt-0.5 shrink-0" strokeWidth={2.5} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </TermsSection>

          <TermsSection
            icon={<ImageIcon className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="2"
            title="Icon Library"
          >
            <p className="mb-3">
              All icons available in BioSketch.Art are in the <span className="font-semibold text-slate-900">public domain</span> or provided under open licenses that permit free use:
            </p>
            <ul className="space-y-2 mb-4">
              {iconLibraryItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-700 mt-0.5 shrink-0" strokeWidth={2.5} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs">
                <span className="font-semibold text-slate-900">Attribution Recommendation:</span> While not legally required, we strongly encourage users to provide attribution to the original authors of icons when possible. Proper attribution supports the scientific community.
              </p>
            </div>
          </TermsSection>

          <TermsSection
            icon={<FileText className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="3"
            title="User Content"
          >
            <p>
              You retain all rights to the diagrams, projects, and content you create using BioSketch.Art. You are responsible for ensuring that your use of the application and any content you create complies with applicable laws and regulations.
            </p>
          </TermsSection>

          <TermsSection
            icon={<Upload className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="4"
            title="Community Submissions"
          >
            <p>
              By submitting icons or projects to the BioSketch.Art community library, you grant BioSketch.Art and its users a non-exclusive, worldwide, royalty-free license to use, display, and distribute your submissions. You confirm that you have the right to submit such content.
            </p>
          </TermsSection>

          <TermsSection
            icon={<ShieldAlert className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="5"
            title="Disclaimer of Warranties"
          >
            <p>
              BioSketch.Art is provided "as is" without any warranties, express or implied. We do not guarantee that the application will be error-free, uninterrupted, or meet your specific requirements. Use of BioSketch.Art is at your own risk.
            </p>
          </TermsSection>

          <TermsSection
            icon={<AlertTriangle className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="6"
            title="Limitation of Liability"
          >
            <p>
              To the maximum extent permitted by law, BioSketch.Art and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the application.
            </p>
          </TermsSection>

          <TermsSection
            icon={<FlaskConical className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="7"
            title="Scientific Accuracy"
          >
            <p>
              While BioSketch.Art provides tools for creating scientific diagrams, users are solely responsible for ensuring the scientific accuracy, validity, and appropriateness of their work. BioSketch.Art does not verify or validate the scientific content of user-created diagrams.
            </p>
          </TermsSection>

          <TermsSection
            icon={<Lock className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="8"
            title="Data and Privacy"
          >
            <p>
              We respect your privacy and handle your data responsibly. Your projects and personal information are stored securely. We do not sell or share your personal data with third parties for marketing purposes.
            </p>
          </TermsSection>

          <TermsSection
            icon={<FileText className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="9"
            title="Modifications to Terms"
          >
            <p>
              We reserve the right to modify these terms at any time. Continued use of BioSketch.Art after changes constitutes acceptance of the modified terms. We encourage users to review these terms periodically.
            </p>
          </TermsSection>

          <TermsSection
            icon={<Ban className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="10"
            title="Account Termination"
          >
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms, engage in abusive behavior, or misuse the application.
            </p>
          </TermsSection>

          <TermsSection
            icon={<Gavel className="h-5 w-5 text-white" strokeWidth={2.5} />}
            number="11"
            title="Governing Law"
          >
            <p>
              These terms shall be governed by and construed in accordance with applicable international laws regarding software use and intellectual property.
            </p>
          </TermsSection>
        </div>

        {/* ── Contact CTA ── */}
        <div className="ts-fade-3 mt-10">
          <div
            className="rounded-2xl bg-primary p-8 md:p-10 text-center"
            style={{ boxShadow: "0 8px 32px -8px rgba(15, 23, 42, 0.25)" }}
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
              <Users className="h-7 w-7 text-white" strokeWidth={2.5} />
            </div>
            <h3
              className="text-2xl font-bold text-white mb-2"
              style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
            >
              Have questions?
            </h3>
            <p className="text-sm text-slate-300 mb-6 max-w-md mx-auto">
              If you have questions about these terms, please don't hesitate to reach out to our team.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-100 transition-colors shadow-md"
            >
              Contact Us
            </Link>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-16" />
      </div>
    </div>
  );
};

export default Terms;
