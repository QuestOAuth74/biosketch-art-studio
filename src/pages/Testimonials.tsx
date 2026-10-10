import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Heart, MessageCircleHeart, Globe, Sparkles, CheckCircle, Star, Quote, PenLine, User, ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/SEO/SEOHead";
import { TestimonialsColumn, type ColumnTestimonial } from "@/components/ui/testimonials-columns-1";
import { motion } from "framer-motion";

const testimonialStyles = `
  @keyframes tm-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .tm-fade-1 { animation: tm-fade-up 0.4s ease-out 0.1s both; }
  .tm-fade-2 { animation: tm-fade-up 0.4s ease-out 0.2s both; }
  .tm-fade-3 { animation: tm-fade-up 0.4s ease-out 0.3s both; }
`;

const testimonialSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  country: z.string().trim().min(2, "Country is required").max(100, "Country must be less than 100 characters"),
  scientific_discipline: z.string().trim().min(2, "Scientific discipline is required").max(100, "Please enter a shorter discipline name"),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(500, "Message must be less than 500 characters"),
  rating: z.number().min(1).max(5),
});

interface DisplayReview {
  id: string;
  name: string;
  discipline: string | null;
  country: string | null;
  message: string;
  created_at: string;
  source: 'testimonial' | 'canvas';
  // testimonials: 1-5; canvas: 'thumbs_up' | 'thumbs_down'
  rating: number | 'thumbs_up' | 'thumbs_down';
}

const Testimonials = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [allReviews, setAllReviews] = useState<DisplayReview[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    scientific_discipline: "",
    message: "",
    rating: 5,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(true);

  const totalCount = allReviews.length;

  // Positive / negative split across both sources.
  // Testimonials: rating >= 4 = positive, < 4 = negative.
  // Canvas reviews: thumbs_up = positive, thumbs_down = negative.
  const ratingStats = useMemo(() => {
    let positive = 0;
    let negative = 0;
    for (const r of allReviews) {
      if (r.source === "testimonial" && typeof r.rating === "number") {
        if (r.rating >= 4) positive++;
        else negative++;
      } else if (r.source === "canvas") {
        if (r.rating === "thumbs_up") positive++;
        else negative++;
      }
    }
    const total = positive + negative;
    return {
      total,
      positive,
      negative,
      positivePct: total > 0 ? (positive / total) * 100 : 0,
      negativePct: total > 0 ? (negative / total) * 100 : 0,
    };
  }, [allReviews]);

  // Map a DisplayReview into the column-card shape
  const toColumn = (r: DisplayReview): ColumnTestimonial => ({
    text: r.message,
    name: r.name,
    role:
      r.source === "canvas"
        ? r.discipline || "Verified canvas user"
        : [r.discipline, r.country].filter(Boolean).join(" · ") || "Scientist",
    rating: r.rating,
    source: r.source,
  });

  // Split reviews into 3 columns for the auto-scroller
  const splitColumns = (reviews: DisplayReview[]): DisplayReview[][] => {
    if (reviews.length === 0) return [[], [], []];
    if (reviews.length < 6) return [reviews, reviews, reviews];
    const cols: DisplayReview[][] = [[], [], []];
    reviews.forEach((r, i) => cols[i % 3].push(r));
    return cols;
  };

  // Carousel only shows reviews that have an actual written message.
  // Stats above still reflect ALL submitted ratings.
  const displayableReviews = useMemo(
    () => allReviews.filter((r) => r.message && r.message.trim().length > 0),
    [allReviews]
  );

  const [firstCol, secondCol, thirdCol] = splitColumns(displayableReviews);

  useEffect(() => {
    fetchAllReviews();
  }, []);

  const fetchAllReviews = async () => {
    // 1. Approved testimonials from the form
    const { data: testData } = await supabase
      .from("testimonials")
      .select("*")
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    // 2. ALL canvas reviews from the in-canvas rating widget — including
    //    ones without a comment, so stats reflect every submitted rating.
    //    The carousel itself filters for non-empty comments below.
    const { data: canvasData } = await supabase
      .from("tool_feedback")
      .select("id, user_id, rating, comment, created_at, page")
      .eq("page", "canvas")
      .order("created_at", { ascending: false });

    // 3. Hydrate canvas reviews with profile name + field of study
    const userIds = [
      ...new Set(
        (canvasData || [])
          .map((c: any) => c.user_id)
          .filter((id: string | null): id is string => !!id)
      ),
    ];

    const profileMap = new Map<string, { full_name: string | null; field_of_study: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, field_of_study")
        .in("id", userIds);
      (profiles || []).forEach((p: any) => {
        profileMap.set(p.id, { full_name: p.full_name, field_of_study: p.field_of_study });
      });
    }

    const testimonialReviews: DisplayReview[] = (testData || []).map((t: any) => ({
      id: `t_${t.id}`,
      name: t.name,
      discipline: t.scientific_discipline,
      country: t.country,
      message: t.message,
      created_at: t.created_at,
      source: 'testimonial',
      rating: t.rating,
    }));

    const canvasReviews: DisplayReview[] = (canvasData || []).map((c: any) => {
      const profile = c.user_id ? profileMap.get(c.user_id) : null;
      return {
        id: `c_${c.id}`,
        name: profile?.full_name || "BioSketch User",
        discipline: profile?.field_of_study || null,
        country: null,
        message: c.comment || "",
        created_at: c.created_at,
        source: 'canvas',
        rating: c.rating as 'thumbs_up' | 'thumbs_down',
      };
    });

    const combined = [...testimonialReviews, ...canvasReviews].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setAllReviews(combined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = testimonialSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("testimonials").insert({
        ...formData,
        user_id: user?.id || null,
      });

      if (error) throw error;

      setSubmitted(true);
      setShowForm(false);
      setFormData({ name: "", country: "", scientific_discipline: "", message: "", rating: 5 });

      toast({
        title: "Thank you!",
        description: "Your kind words mean a lot! We'll review and publish your testimonial soon.",
      });

      setTimeout(() => {
        fetchAllReviews();
        document.getElementById("testimonials-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 500);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Oops!",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #E8F0FF 0%, #F5F9FF 35%, #FFFFFF 100%)",
      }}
    >
      <style>{testimonialStyles}</style>

      <SEOHead
        title="Testimonials - BioSketch"
        description="What scientists and researchers say about BioSketch. Read reviews from our community of users who create scientific illustrations with BioSketch."
        canonical="https://biosketch.art/testimonials"
      />

      {/* Soft decorative blobs */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-200/25 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-rose-200/20 rounded-full blur-3xl" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 md:pt-16">

        {/* ── Hero header (homepage style) ── */}
        <div className="text-center tm-fade-1">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            }}
          >
            <Quote className="h-3.5 w-3.5 text-slate-700" />
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
              Community Voices
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
            What scientists are saying.
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
            Your feedback helps us grow and motivates us to keep BioSketch free for the scientific community.
          </p>

          {/* Action row */}
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setShowForm(true);
                setSubmitted(false);
                setTimeout(() => window.scrollTo({ top: 400, behavior: "smooth" }), 100);
              }}
              className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md"
            >
              <PenLine className="h-4 w-4" />
              Leave a Review
            </button>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-3 gap-3 mt-10 max-w-2xl mx-auto tm-fade-2">
          {[
            {
              icon: MessageCircleHeart,
              chipBg: "bg-primary",
              value: ratingStats.total || "—",
              percent: null as string | null,
              label: "Total Ratings",
            },
            {
              icon: ThumbsUp,
              chipBg: "bg-emerald-500",
              value: ratingStats.total > 0 ? ratingStats.positive : "—",
              percent: ratingStats.total > 0 ? `${ratingStats.positivePct.toFixed(1)}%` : null,
              label: "Positive",
            },
            {
              icon: ThumbsDown,
              chipBg: "bg-rose-500",
              value: ratingStats.total > 0 ? ratingStats.negative : "—",
              percent: ratingStats.total > 0 ? `${ratingStats.negativePct.toFixed(1)}%` : null,
              label: "Negative",
            },
          ].map(({ icon: Icon, chipBg, value, percent, label }) => (
            <div
              key={label}
              className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 px-4 py-5 text-center"
              style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
            >
              <div className="flex items-center justify-center mb-2">
                <div className={`rounded-lg ${chipBg} p-1.5`}>
                  <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <p
                className="text-2xl font-bold text-slate-900 tabular-nums"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
              >
                {value}
                {percent && (
                  <span className="ml-1.5 text-xs font-semibold text-slate-500 tabular-nums">
                    ({percent})
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5 font-medium">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Submit Form ── */}
        {showForm && !submitted && (
          <div className="tm-fade-2 mt-10">
            <div
              className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-6 md:p-10 max-w-3xl mx-auto"
              style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
            >
              <h2
                className="text-xl font-bold text-slate-900 mb-1"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
              >
                Share your experience
              </h2>
              <p className="text-sm text-slate-500 mb-6">Tell the community what you love about BioSketch.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-500" />
                      Your Name *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-11 rounded-xl border-slate-200 bg-white"
                      placeholder="Dr. Jane Smith"
                    />
                    {errors.name && <p className="text-rose-500 text-xs">{errors.name}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="country" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-slate-500" />
                      Country *
                    </Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="h-11 rounded-xl border-slate-200 bg-white"
                      placeholder="United States"
                    />
                    {errors.country && <p className="text-rose-500 text-xs">{errors.country}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="discipline" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                    Scientific Discipline *
                  </Label>
                  <Input
                    id="discipline"
                    value={formData.scientific_discipline}
                    onChange={(e) => setFormData({ ...formData, scientific_discipline: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 bg-white"
                    placeholder="Molecular Biology"
                  />
                  {errors.scientific_discipline && <p className="text-rose-500 text-xs">{errors.scientific_discipline}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-slate-500" />
                    Your Rating *
                  </Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormData({ ...formData, rating: star })}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-9 w-9 ${
                            star <= formData.rating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-none text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-slate-500" />
                    Your Message *
                    <span className="text-[10px] font-normal text-slate-400">(10-500 characters)</span>
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="min-h-[140px] resize-none rounded-xl border-slate-200 bg-white"
                    placeholder="Share what you love about BioSketch..."
                  />
                  <div className="flex justify-between items-center">
                    {errors.message && <p className="text-rose-500 text-xs">{errors.message}</p>}
                    <p className="text-[10px] text-slate-400 ml-auto tabular-nums">
                      {formData.message.length}/500
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Share your experience"}
                  <MessageCircleHeart className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Submitted state ── */}
        {submitted && !showForm && (
          <div className="tm-fade-2 mt-10">
            <div
              className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-10 max-w-2xl mx-auto text-center"
              style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
            >
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-slate-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h2
                className="text-xl font-bold text-slate-900 mb-2"
                style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
              >
                Thank you!
              </h2>
              <p className="text-sm text-slate-600 max-w-sm mx-auto mb-6">
                Your testimonial has been submitted and will appear below after review.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-full text-xs font-semibold hover:border-slate-300 transition-colors"
              >
                Submit Another
              </button>
            </div>
          </div>
        )}

        {/* ── Testimonials 3-Column Auto-Scroller ── */}
        {displayableReviews.length > 0 && (
          <div id="testimonials-section" className="scroll-mt-20 tm-fade-3 mt-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true }}
              className="flex flex-col items-center justify-center max-w-[540px] mx-auto"
            >
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                  }}
                >
                  <Quote className="h-3.5 w-3.5 text-slate-700" />
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
                    Testimonials
                  </span>
                </div>
              </div>

              <h2
                className="mt-5 text-center"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  fontSize: "clamp(24px, 3.5vw, 40px)",
                  lineHeight: "1.15",
                  color: "#1a1a1a",
                  letterSpacing: "-0.02em",
                }}
              >
                What our users say
              </h2>
              <p className="text-center mt-4 text-slate-500 text-sm">
                Real reviews from scientists using BioSketch every day.
              </p>
            </motion.div>

            <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)] max-h-[640px] overflow-hidden">
              <TestimonialsColumn testimonials={firstCol.map(toColumn)} duration={15} />
              <TestimonialsColumn
                testimonials={secondCol.map(toColumn)}
                className="hidden md:block"
                duration={19}
              />
              <TestimonialsColumn
                testimonials={thirdCol.map(toColumn)}
                className="hidden lg:block"
                duration={17}
              />
            </div>
          </div>
        )}

        {/* Bottom spacing */}
        <div className="h-16" />
      </div>
    </div>
  );
};

export default Testimonials;
