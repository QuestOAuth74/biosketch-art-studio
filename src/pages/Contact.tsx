import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, User, Globe, MessageSquare, Send, Zap, LifeBuoy, FlaskConical, Github, Share2, Heart } from "lucide-react";

import { z } from "zod";
import { SEOHead } from "@/components/SEO/SEOHead";

const contactStyles = `
  @keyframes ct-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .ct-fade-1 { animation: ct-fade-up 0.4s ease-out 0.1s both; }
  .ct-fade-2 { animation: ct-fade-up 0.4s ease-out 0.2s both; }
  .ct-fade-3 { animation: ct-fade-up 0.4s ease-out 0.3s both; }
`;

const contactSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255),
  fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100),
  country: z.string().trim().min(1, { message: "Country is required" }).max(100),
  message: z.string().trim().min(1, { message: "Message is required" }).max(5000, { message: "Message must be less than 5000 characters" })
});

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    country: "",
    message: ""
  });
  const [wordCount, setWordCount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleMessageChange = (text: string) => {
    const words = countWords(text);
    setWordCount(words);
    setFormData(prev => ({ ...prev, message: text }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (wordCount > 500) {
      setErrors({ message: "Message must not exceed 500 words" });
      return;
    }

    try {
      contactSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("contact_messages").insert({
        email: formData.email,
        full_name: formData.fullName,
        country: formData.country,
        message: formData.message,
        user_id: user?.id || null
      });

      if (error) throw error;

      toast({
        title: "Message Sent!",
        description: "Thank you for contacting us. We'll get back to you soon.",
      });

      setFormData({ email: "", fullName: "", country: "", message: "" });
      setWordCount(0);
    } catch (error) {
      console.error("Error submitting contact form:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
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
      <style>{contactStyles}</style>

      <SEOHead
        title="Contact Us - BioSketch"
        description="Get in touch with the BioSketch team. Send us your questions, feedback, or suggestions for improving our scientific illustration tool."
        canonical="https://biosketch.art/contact"
      />

      {/* Soft decorative blobs */}
      <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-200/25 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-3xl" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 md:pt-16">

        {/* ── Hero header (homepage style) ── */}
        <div className="text-center ct-fade-1">
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            }}
          >
            <Mail className="h-3.5 w-3.5 text-slate-700" />
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
              Contact Us
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
            Get in touch with us.
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
            Have a question, feedback, or suggestion? We'd love to hear from you. Our team is here to help.
          </p>
        </div>

        {/* ── Main Content Grid ── */}
        <div className="ct-fade-2 mt-12 grid lg:grid-cols-3 gap-4">

          {/* ── Sidebar ── */}
          <div className="lg:col-span-1 space-y-3">
            {/* Open Source Banner */}
            <div
              className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-4"
              style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Github className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900" style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}>
                    Open Source Project
                  </p>
                  <p className="text-xs text-slate-500 leading-tight mt-0.5">Free for the research community</p>
                </div>
              </div>
            </div>

            {/* Share Resources */}
            <div
              className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-4"
              style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Share2 className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900" style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}>
                    Share Your Work
                  </p>
                  <p className="text-xs text-slate-500 leading-tight mt-0.5">Share illustration resources with the community</p>
                </div>
              </div>
            </div>

            {/* Quick Info Items */}
            {[
              { icon: <Zap className="h-4 w-4 text-slate-600" />, title: "Quick Response", desc: "We respond within 24-48 hours" },
              { icon: <LifeBuoy className="h-4 w-4 text-slate-600" />, title: "Support", desc: "Include URGENT for priority help" },
              { icon: <FlaskConical className="h-4 w-4 text-slate-600" />, title: "For Scientists", desc: "Serving researchers worldwide" },
              { icon: <Heart className="h-4 w-4 text-rose-500" />, title: "Community Driven", desc: "Built with feedback from users like you" },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 px-4 py-3"
                style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 leading-tight" style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.01em" }}>
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Contact Form ── */}
          <div className="lg:col-span-2">
            <div
              className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 p-6 md:p-8"
              style={{ boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.08)" }}
            >
              <div className="mb-6">
                <h2
                  className="text-xl font-bold text-slate-900 mb-1"
                  style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.02em" }}
                >
                  Send us a message
                </h2>
                <p className="text-sm text-slate-500">
                  Fill out the form below and we'll get back to you as soon as possible.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-500" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your.email@example.com"
                      className="h-11 rounded-xl border-slate-200 bg-white"
                      required
                    />
                    {errors.email && <p className="text-rose-500 text-xs">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-500" />
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="John Doe"
                      className="h-11 rounded-xl border-slate-200 bg-white"
                      required
                    />
                    {errors.fullName && <p className="text-rose-500 text-xs">{errors.fullName}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-slate-500" />
                    Country / Region
                  </Label>
                  <Input
                    id="country"
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="United States"
                    className="h-11 rounded-xl border-slate-200 bg-white"
                    required
                  />
                  {errors.country && <p className="text-rose-500 text-xs">{errors.country}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="message" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                      Your Message
                    </Label>
                    <span className={`text-[10px] tabular-nums ${wordCount > 500 ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
                      {wordCount} / 500 words
                    </span>
                  </div>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => handleMessageChange(e.target.value)}
                    placeholder="Tell us what's on your mind. We're here to help with any questions about BioSketch, feature requests, or general feedback..."
                    rows={6}
                    className="resize-none rounded-xl border-slate-200 bg-white"
                    required
                  />
                  {errors.message && <p className="text-rose-500 text-xs">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || wordCount > 500}
                  className="w-full h-12 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-16" />
      </div>
    </div>
  );
};

export default Contact;
