import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart, Send, Users, DollarSign, Microscope,
  Sparkles, Globe, FileSignature, User, Building2, Mail,
  MessageSquare, ChevronLeft, ChevronRight,
} from "lucide-react";
import { SEOHead } from "@/components/SEO/SEOHead";
import { formatDistanceToNow } from "date-fns";

const surveyStyles = `
  @keyframes sv-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .sv-fade-1 { animation: sv-fade-up 0.4s ease-out 0.1s both; }
  .sv-fade-2 { animation: sv-fade-up 0.4s ease-out 0.2s both; }
  .sv-fade-3 { animation: sv-fade-up 0.4s ease-out 0.3s both; }
  .sv-fade-4 { animation: sv-fade-up 0.4s ease-out 0.4s both; }
  .sv-fade-5 { animation: sv-fade-up 0.4s ease-out 0.5s both; }
  .sv-fade-6 { animation: sv-fade-up 0.4s ease-out 0.6s both; }

  @keyframes sv-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  .sv-supporters-scroll {
    animation: sv-scroll 30s linear infinite;
  }
  .sv-supporters-scroll:hover {
    animation-play-state: paused;
  }
`;

// Question options
const ROLE_OPTIONS = [
  "Undergraduate student",
  "Graduate / PhD student",
  "Postdoctoral researcher",
  "Principal Investigator / Professor",
  "Research staff or lab manager",
  "Scientific illustrator or science communicator",
];

const RESEARCH_AREA_OPTIONS = [
  "Cell & molecular biology",
  "Microbiology / Immunology",
  "Neuroscience",
  "Biochemistry / Chemistry",
  "Biomedical / Clinical research",
  "Ecology / Environmental science",
  "Computational biology / Bioinformatics",
];

const PAY_OPTIONS = [
  "Yes — I have a personal paid subscription",
  "Yes — my institution or lab covers it",
  "No — the cost is a barrier for me",
  "No — I get by with free or general-purpose tools",
];

const PREFERRED_TOOL_OPTIONS = [
  "BioRender",
  "Adobe Illustrator",
  "Affinity Designer",
  "BioSketch.Art (already my choice)",
  "I don't have a preference",
];

const COST_IMPACT_OPTIONS = [
  "Yes, significantly",
  "Yes, somewhat",
  "Not really",
  "No — I've always had access to what I need",
];

const FAMILIARITY_OPTIONS = [
  "I use it regularly",
  "I've tried it a few times",
  "I've heard of it but haven't tried it",
  "This survey is how I found out about it",
];

const LIMITATION_OPTIONS = [
  "The icon library doesn't cover my research area well enough",
  "I wasn't sure what editor to pair with the icons",
  "The web editor needs more features",
  "My institution already provides BioRender or a similar tool",
  "Nothing — I use it without issues",
];

const USAGE_CONTEXT_OPTIONS = [
  "Peer-reviewed publication",
  "Grant or funding application",
  "Conference poster or talk",
  "Graphical abstract",
  "Thesis or dissertation",
  "Teaching or outreach materials",
  "Not yet, but I intend to",
];

const FEATURE_ITEMS = [
  { key: "icon_library", label: "Larger icon library covering more organisms, pathways, and research contexts" },
  { key: "icon_request", label: "Icon request system — submit and upvote what's missing" },
  { key: "figure_editor", label: "A fully featured, in-browser figure editor" },
  { key: "figure_templates", label: "Figure templates for common experimental workflows" },
  { key: "abstract_builder", label: "A graphical abstract builder" },
  { key: "export_options", label: "PowerPoint and PDF export options" },
  { key: "video_tutorials", label: "Video tutorials and illustration guides" },
  { key: "offline_version", label: "Offline / desktop version" },
];

const RATING_LEVELS = ["Not useful", "Low priority", "Nice to have", "High priority"];

const OPEN_SOURCE_OPTIONS = [
  "Critical — paywalled tools exclude researchers without institutional support",
  "Important — I prefer free tools when quality is comparable",
  "Somewhat — I care more about features than licensing",
  "Not a priority for me personally",
];

const CONTRIBUTION_OPTIONS = [
  "Submit icons or illustrations",
  "Help with code or development",
  "Share feedback and feature ideas",
  "Recommend BioSketch.Art to colleagues or students",
  "I already contribute",
  "Not at this time",
];

interface SurveyFormData {
  q1_role: string;
  q1_role_other: string;
  q2_research_area: string;
  q2_research_area_other: string;
  q3_pay_for_tool: string;
  q4_preferred_tool: string;
  q4_preferred_tool_other: string;
  q5_cost_affected_quality: string;
  q6_biosketch_familiarity: string;
  q7_limitations: string[];
  q7_limitations_other: string;
  q8_usage_contexts: string[];
  q8_usage_contexts_other: string;
  q8_publication_link: string;
  q9_feature_ratings: Record<string, string>;
  q10_missing_icons: string;
  q11_open_source_importance: string;
  q12_willing_to_contribute: string[];
  signed_letter: boolean;
  supporter_name: string;
  supporter_institution: string;
  supporter_role: string;
  supporter_country: string;
  supporter_email: string;
  supporter_comments: string;
}

const initialFormData: SurveyFormData = {
  q1_role: "",
  q1_role_other: "",
  q2_research_area: "",
  q2_research_area_other: "",
  q3_pay_for_tool: "",
  q4_preferred_tool: "",
  q4_preferred_tool_other: "",
  q5_cost_affected_quality: "",
  q6_biosketch_familiarity: "",
  q7_limitations: [],
  q7_limitations_other: "",
  q8_usage_contexts: [],
  q8_usage_contexts_other: "",
  q8_publication_link: "",
  q9_feature_ratings: {},
  q10_missing_icons: "",
  q11_open_source_importance: "",
  q12_willing_to_contribute: [],
  signed_letter: false,
  supporter_name: "",
  supporter_institution: "",
  supporter_role: "",
  supporter_country: "",
  supporter_email: "",
  supporter_comments: "",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

// Reusable radio group
function RadioGroup({
  name,
  options,
  value,
  onChange,
  hasOther,
  otherValue,
  onOtherChange,
}: {
  name: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  hasOther?: boolean;
  otherValue?: string;
  onOtherChange?: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label key={opt} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="mt-0.5 accent-slate-900 h-4 w-4 shrink-0"
          />
          <span className="text-sm text-slate-700">{opt}</span>
        </label>
      ))}
      {hasOther && (
        <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
          <input
            type="radio"
            name={name}
            value="__other__"
            checked={value === "__other__"}
            onChange={() => onChange("__other__")}
            className="mt-0.5 accent-slate-900 h-4 w-4 shrink-0"
          />
          <div className="flex-1">
            <span className="text-sm text-slate-700">Other:</span>
            {value === "__other__" && (
              <Input
                value={otherValue}
                onChange={(e) => onOtherChange?.(e.target.value)}
                placeholder="Please specify..."
                className="mt-1.5 h-9 rounded-xl border-slate-200 bg-white text-sm"
              />
            )}
          </div>
        </label>
      )}
    </div>
  );
}

// Reusable checkbox group
function CheckboxGroup({
  options,
  selected,
  onChange,
  hasOther,
  otherValue,
  onOtherChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  hasOther?: boolean;
  otherValue?: string;
  onOtherChange?: (v: string) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };
  const otherSelected = selected.includes("__other__");
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label key={opt} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="mt-0.5 accent-slate-900 h-4 w-4 shrink-0"
          />
          <span className="text-sm text-slate-700">{opt}</span>
        </label>
      ))}
      {hasOther && (
        <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={otherSelected}
            onChange={() => toggle("__other__")}
            className="mt-0.5 accent-slate-900 h-4 w-4 shrink-0"
          />
          <div className="flex-1">
            <span className="text-sm text-slate-700">Other:</span>
            {otherSelected && (
              <Input
                value={otherValue}
                onChange={(e) => onOtherChange?.(e.target.value)}
                placeholder="Please specify..."
                className="mt-1.5 h-9 rounded-xl border-slate-200 bg-white text-sm"
              />
            )}
          </div>
        </label>
      )}
    </div>
  );
}

// Section card wrapper
function SectionCard({
  icon: Icon,
  title,
  subtitle,
  fadeClass,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  fadeClass: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${fadeClass} rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-6 md:p-8 space-y-6`}
      style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary p-2.5 shrink-0">
          <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}>
            {title}
          </h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function QuestionLabel({ number, text }: { number: number; text: string }) {
  return (
    <Label className="text-sm font-semibold text-slate-900">
      <span className="text-slate-500 font-bold mr-1.5">{number}.</span>
      {text}
    </Label>
  );
}

// Supporters strip
function SupportersStrip() {
  const { data: supporters } = useQuery({
    queryKey: ["survey-supporters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_survey_responses")
        .select("supporter_name, supporter_country, created_at")
        .eq("signed_letter", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  if (!supporters || supporters.length === 0) return null;

  const cards = supporters.map((s, i) => (
    <div
      key={i}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/80 backdrop-blur-md border border-slate-200 whitespace-nowrap shrink-0"
      style={{ boxShadow: "0 2px 8px -2px rgba(15, 23, 42, 0.06)" }}
    >
      <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500 shrink-0" />
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-[10px] font-bold">
        {getInitials(s.supporter_name || "?")}
      </span>
      <span className="text-xs font-medium text-slate-700">{s.supporter_country}</span>
      <span className="text-[10px] text-slate-400">
        {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : ""}
      </span>
    </div>
  ));

  // Duplicate for seamless scroll
  return (
    <div className="overflow-hidden py-2">
      <div className="sv-supporters-scroll flex gap-3" style={{ width: "max-content" }}>
        {cards}
        {cards}
      </div>
    </div>
  );
}

// Supporter comments panel with pagination
function SupporterComments() {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data } = useQuery({
    queryKey: ["survey-supporter-comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_survey_responses")
        .select("supporter_name, supporter_country, supporter_comments, created_at")
        .eq("signed_letter", true)
        .neq("supporter_comments", "")
        .not("supporter_comments", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const comments = data || [];
  const totalPages = Math.max(1, Math.ceil(comments.length / PAGE_SIZE));
  const paged = comments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (comments.length === 0) return null;

  return (
    <div
      className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-5 space-y-4 sticky top-24"
      style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
    >
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-rose-500 rounded-full" />
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Supporter Voices</h3>
      </div>

      <div className="space-y-3">
        {paged.map((c, i) => (
          <div key={`${page}-${i}`} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <p className="text-xs text-slate-700 leading-relaxed italic">&ldquo;{c.supporter_comments}&rdquo;</p>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-white text-[9px] font-bold">
                {getInitials(c.supporter_name || "?")}
              </span>
              <span className="font-medium">{c.supporter_country}</span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-slate-500 tabular-nums font-semibold">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const CommunitySurvey = () => {
  const [formData, setFormData] = useState<SurveyFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Support count
  const { data: supportCount } = useQuery({
    queryKey: ["survey-support-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("community_survey_responses")
        .select("id", { count: "exact", head: true })
        .eq("signed_letter", true);
      if (error) throw error;
      return count || 0;
    },
  });

  const updateField = <K extends keyof SurveyFormData>(key: K, value: SurveyFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.q1_role) {
      toast({ title: "Please select your current role", variant: "destructive" });
      return;
    }

    if (formData.signed_letter && !formData.supporter_name.trim()) {
      toast({ title: "Please enter your name to sign the survey", variant: "destructive" });
      return;
    }

    if (formData.signed_letter && !formData.supporter_country.trim()) {
      toast({ title: "Please enter your country to sign the survey", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();

      const resolveOther = (val: string, other: string) =>
        val === "__other__" ? other || "Other" : val;

      const resolveMultiOther = (arr: string[], other: string) =>
        arr.map((v) => (v === "__other__" ? other || "Other" : v));

      const { error } = await supabase.from("community_survey_responses").insert({
        user_id: user?.id || null,
        q1_role: resolveOther(formData.q1_role, formData.q1_role_other),
        q1_role_other: formData.q1_role === "__other__" ? formData.q1_role_other : null,
        q2_research_area: resolveOther(formData.q2_research_area, formData.q2_research_area_other),
        q2_research_area_other: formData.q2_research_area === "__other__" ? formData.q2_research_area_other : null,
        q3_pay_for_tool: formData.q3_pay_for_tool || null,
        q4_preferred_tool: resolveOther(formData.q4_preferred_tool, formData.q4_preferred_tool_other),
        q4_preferred_tool_other: formData.q4_preferred_tool === "__other__" ? formData.q4_preferred_tool_other : null,
        q5_cost_affected_quality: formData.q5_cost_affected_quality || null,
        q6_biosketch_familiarity: formData.q6_biosketch_familiarity || null,
        q7_limitations: resolveMultiOther(formData.q7_limitations, formData.q7_limitations_other),
        q7_limitations_other: formData.q7_limitations.includes("__other__") ? formData.q7_limitations_other : null,
        q8_usage_contexts: resolveMultiOther(formData.q8_usage_contexts, formData.q8_usage_contexts_other),
        q8_usage_contexts_other: formData.q8_usage_contexts.includes("__other__") ? formData.q8_usage_contexts_other : null,
        q8_publication_link: formData.q8_publication_link || null,
        q9_feature_ratings: formData.q9_feature_ratings,
        q10_missing_icons: formData.q10_missing_icons || null,
        q11_open_source_importance: formData.q11_open_source_importance || null,
        q12_willing_to_contribute: formData.q12_willing_to_contribute,
        signed_letter: formData.signed_letter,
        supporter_name: formData.signed_letter ? formData.supporter_name.trim() : null,
        supporter_institution: formData.signed_letter ? formData.supporter_institution.trim() || null : null,
        supporter_role: formData.signed_letter ? (resolveOther(formData.q1_role, formData.q1_role_other)) : null,
        supporter_country: formData.signed_letter ? formData.supporter_country.trim() : null,
        supporter_email: formData.signed_letter ? formData.supporter_email.trim() || null : null,
        supporter_comments: formData.signed_letter ? formData.supporter_comments.trim() || null : null,
      });

      if (error) throw error;

      toast({
        title: "Thank you!",
        description: formData.signed_letter
          ? "Your survey response has been submitted."
          : "Your survey response has been submitted.",
      });

      setFormData(initialFormData);
      queryClient.invalidateQueries({ queryKey: ["survey-support-count"] });
      queryClient.invalidateQueries({ queryKey: ["survey-supporters"] });
      queryClient.invalidateQueries({ queryKey: ["survey-supporter-comments"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Survey submission error:", error);
      toast({
        title: "Submission failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Community Survey | BioSketch.Art"
        description="Share your experience with scientific illustration tools to help shape what BioSketch.Art builds next."
      />

      <div
        className="min-h-screen relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #E8F0FF 0%, #F5F9FF 35%, #FFFFFF 100%)",
        }}
      >
        <style>{surveyStyles}</style>

        {/* Soft decorative blobs */}
        <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-200/25 rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-rose-200/20 rounded-full blur-3xl" />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-12 md:pt-16">

          {/* ── Hero header (homepage style) ── */}
          <div className="text-center sv-fade-1">
            {/* Pill badge */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
              style={{
                background: "#FFFFFF",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
              }}
            >
              <FileSignature className="h-3.5 w-3.5 text-slate-700" />
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
                Survey
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
              Help us keep science free.
            </h1>

            <p
              className="mx-auto mt-4 max-w-2xl"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "clamp(14px, 1.8vw, 18px)",
                lineHeight: "1.6",
                color: "#4a5568",
              }}
            >
              BioSketch.Art is a free, open-source scientific illustration platform built by indie developers and scientists. Your responses help us understand what you need and shape what we build next.
            </p>
          </div>

          {/* ── Survey form ── */}
          <div className="mt-10 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Note about signing */}
        <p className="sv-fade-1 text-xs text-slate-500 text-center italic">
          Signing the survey is optional but appreciated. Your email will never be shared or used for marketing.
        </p>

        {/* Section 1: Who You Are */}
        <SectionCard icon={Users} title="Who You Are" fadeClass="sv-fade-1">
          <div className="space-y-5">
            <div className="space-y-2">
              <QuestionLabel number={1} text="What is your current role?" />
              <RadioGroup
                name="q1"
                options={ROLE_OPTIONS}
                value={formData.q1_role}
                onChange={(v) => updateField("q1_role", v)}
                hasOther
                otherValue={formData.q1_role_other}
                onOtherChange={(v) => updateField("q1_role_other", v)}
              />
            </div>
            <div className="space-y-2">
              <QuestionLabel number={2} text="What is your primary research area?" />
              <RadioGroup
                name="q2"
                options={RESEARCH_AREA_OPTIONS}
                value={formData.q2_research_area}
                onChange={(v) => updateField("q2_research_area", v)}
                hasOther
                otherValue={formData.q2_research_area_other}
                onOtherChange={(v) => updateField("q2_research_area_other", v)}
              />
            </div>
          </div>
        </SectionCard>

        {/* Section 2: The Cost Problem */}
        <SectionCard icon={DollarSign} title="The Cost Problem" fadeClass="sv-fade-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <QuestionLabel number={3} text="Do you currently pay for a scientific illustration tool?" />
              <RadioGroup
                name="q3"
                options={PAY_OPTIONS}
                value={formData.q3_pay_for_tool}
                onChange={(v) => updateField("q3_pay_for_tool", v)}
              />
            </div>
            <div className="space-y-2">
              <QuestionLabel number={4} text="If cost were not a factor, which tool would you use for scientific illustrations?" />
              <RadioGroup
                name="q4"
                options={PREFERRED_TOOL_OPTIONS}
                value={formData.q4_preferred_tool}
                onChange={(v) => updateField("q4_preferred_tool", v)}
                hasOther
                otherValue={formData.q4_preferred_tool_other}
                onOtherChange={(v) => updateField("q4_preferred_tool_other", v)}
              />
            </div>
            <div className="space-y-2">
              <QuestionLabel number={5} text="Has the cost of illustration software ever affected the quality of your figures — for a paper, grant, or presentation?" />
              <RadioGroup
                name="q5"
                options={COST_IMPACT_OPTIONS}
                value={formData.q5_cost_affected_quality}
                onChange={(v) => updateField("q5_cost_affected_quality", v)}
              />
            </div>
          </div>
        </SectionCard>

        {/* Section 3: Your Experience with BioSketch */}
        <SectionCard icon={Microscope} title="Your Experience with BioSketch.Art" fadeClass="sv-fade-3">
          <div className="space-y-5">
            <div className="space-y-2">
              <QuestionLabel number={6} text="How familiar are you with BioSketch.Art?" />
              <RadioGroup
                name="q6"
                options={FAMILIARITY_OPTIONS}
                value={formData.q6_biosketch_familiarity}
                onChange={(v) => updateField("q6_biosketch_familiarity", v)}
              />
            </div>
            <div className="space-y-2">
              <QuestionLabel number={7} text="What has limited your use of BioSketch.Art, if anything? (Select all that apply)" />
              <CheckboxGroup
                options={LIMITATION_OPTIONS}
                selected={formData.q7_limitations}
                onChange={(v) => updateField("q7_limitations", v)}
                hasOther
                otherValue={formData.q7_limitations_other}
                onOtherChange={(v) => updateField("q7_limitations_other", v)}
              />
            </div>
            <div className="space-y-2">
              <QuestionLabel number={8} text="Have you used BioSketch.Art in any of the following? (Select all that apply)" />
              <CheckboxGroup
                options={USAGE_CONTEXT_OPTIONS}
                selected={formData.q8_usage_contexts}
                onChange={(v) => updateField("q8_usage_contexts", v)}
                hasOther
                otherValue={formData.q8_usage_contexts_other}
                onOtherChange={(v) => updateField("q8_usage_contexts_other", v)}
              />
              <div className="pt-2 space-y-1.5">
                <Label className="text-xs text-slate-500">
                  If you used BioSketch.Art in a publication, feel free to share a link:
                </Label>
                <Input
                  value={formData.q8_publication_link}
                  onChange={(e) => updateField("q8_publication_link", e.target.value)}
                  placeholder="https://doi.org/..."
                  className="h-9 rounded-xl border-slate-200 bg-white text-sm"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Section 4: What Would Make BioSketch Better */}
        <SectionCard icon={Sparkles} title="What Would Make BioSketch.Art Better" fadeClass="sv-fade-4">
          <div className="space-y-5">
            <div className="space-y-3">
              <QuestionLabel number={9} text="Which of the following would have the most impact on your work? (Rate each)" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-4 font-semibold text-slate-500 text-xs uppercase tracking-wider min-w-[200px]">Feature</th>
                      {RATING_LEVELS.map((level) => (
                        <th key={level} className="text-center py-2 px-2 font-semibold text-slate-500 whitespace-nowrap text-[10px] uppercase tracking-wider">
                          {level}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_ITEMS.map((item) => (
                      <tr key={item.key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 pr-4 text-slate-700 text-xs">{item.label}</td>
                        {RATING_LEVELS.map((level) => (
                          <td key={level} className="text-center py-3 px-2">
                            <input
                              type="radio"
                              name={`q9_${item.key}`}
                              checked={formData.q9_feature_ratings[item.key] === level}
                              onChange={() =>
                                updateField("q9_feature_ratings", {
                                  ...formData.q9_feature_ratings,
                                  [item.key]: level,
                                })
                              }
                              className="accent-slate-900 h-4 w-4"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-2">
              <QuestionLabel number={10} text="What specific icons, organisms, or research topics does BioSketch.Art currently lack that you need most?" />
              <Textarea
                value={formData.q10_missing_icons}
                onChange={(e) => updateField("q10_missing_icons", e.target.value)}
                placeholder="E.g., specific organisms, pathways, lab equipment..."
                className="min-h-[100px] rounded-xl border-slate-200 bg-white resize-y"
              />
            </div>
          </div>
        </SectionCard>

        {/* Section 5: Open Science & Community */}
        <SectionCard icon={Globe} title="Open Science & Community" fadeClass="sv-fade-5">
          <div className="space-y-5">
            <div className="space-y-2">
              <QuestionLabel number={11} text="How important is it to you that scientific illustration tools are free and open source?" />
              <RadioGroup
                name="q11"
                options={OPEN_SOURCE_OPTIONS}
                value={formData.q11_open_source_importance}
                onChange={(v) => updateField("q11_open_source_importance", v)}
              />
            </div>
            <div className="space-y-2">
              <QuestionLabel number={12} text="Would you be willing to contribute to BioSketch.Art? (Select all that apply)" />
              <CheckboxGroup
                options={CONTRIBUTION_OPTIONS}
                selected={formData.q12_willing_to_contribute}
                onChange={(v) => updateField("q12_willing_to_contribute", v)}
              />
            </div>
          </div>
        </SectionCard>

        {/* Section 6: Survey */}
        <SectionCard icon={FileSignature} title="Survey" subtitle="Optional but appreciated" fadeClass="sv-fade-6">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-5 text-sm text-slate-600 leading-relaxed italic">
            I support BioSketch.Art's mission to make professional-quality scientific illustration tools freely available to every researcher — regardless of institution size or budget. I believe open-source, community-driven tools are essential infrastructure for modern science.
          </div>

          <label className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={formData.signed_letter}
              onChange={(e) => updateField("signed_letter", e.target.checked)}
              className="accent-slate-900 h-5 w-5 shrink-0"
            />
            <div>
              <span className="text-sm font-semibold text-slate-900">I would like to sign this survey</span>
              <p className="text-xs text-slate-500 mt-0.5">Your email will never be shared or used for marketing.</p>
            </div>
          </label>

          {formData.signed_letter && (
            <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" /> Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={formData.supporter_name}
                  onChange={(e) => updateField("supporter_name", e.target.value)}
                  placeholder="Your full name"
                  className="h-11 rounded-xl border-slate-200 bg-white"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-500" /> Institution / Affiliation
                </Label>
                <Input
                  value={formData.supporter_institution}
                  onChange={(e) => updateField("supporter_institution", e.target.value)}
                  placeholder="University, institute, or company"
                  className="h-11 rounded-xl border-slate-200 bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-slate-500" /> Country <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={formData.supporter_country}
                  onChange={(e) => updateField("supporter_country", e.target.value)}
                  placeholder="United States"
                  className="h-11 rounded-xl border-slate-200 bg-white"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-500" /> Email (optional)
                </Label>
                <Input
                  type="email"
                  value={formData.supporter_email}
                  onChange={(e) => updateField("supporter_email", e.target.value)}
                  placeholder="you@institution.edu"
                  className="h-11 rounded-xl border-slate-200 bg-white"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-500" /> Any other thoughts or comments
                </Label>
                <Textarea
                  value={formData.supporter_comments}
                  onChange={(e) => updateField("supporter_comments", e.target.value)}
                  placeholder="Optional — share anything else you'd like us to know."
                  className="min-h-[80px] rounded-xl border-slate-200 bg-white resize-y"
                />
              </div>
            </div>
          )}
        </SectionCard>

        {/* Submit */}
        <div className="flex justify-center pt-4 pb-8">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 px-10 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>Submitting...</>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Survey
              </>
            )}
          </button>
        </div>
      </form>

          </div>

          {/* Bottom spacing */}
          <div className="h-16" />
        </div>
      </div>
    </>
  );
};

export default CommunitySurvey;
