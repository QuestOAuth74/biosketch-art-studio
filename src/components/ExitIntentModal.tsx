import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, ArrowRight } from "lucide-react";

interface FeaturedProject {
  id: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  user_id: string;
  profiles: { full_name: string | null } | null;
}

const SESSION_KEY = "exitIntentShown";

export function ExitIntentModal() {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<FeaturedProject | null>(null);
  const navigate = useNavigate();

  // Load a featured recent project once on mount.
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    const load = async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("canvas_projects")
        .select("id, title, description, thumbnail_url, user_id")
        .eq("is_public", true)
        .eq("approval_status", "approved")
        .not("thumbnail_url", "is", null)
        .gte("updated_at", thirtyDaysAgo)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      const { data: profile } = await supabase
        .from("public_profiles")
        .select("full_name")
        .eq("id", data.user_id)
        .maybeSingle();
      setProject({ ...data, profiles: profile ?? null });
    };
    load();
  }, []);

  // Trigger: mouse-to-top exit intent (desktop) + back button (all devices).
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;

    const trigger = () => {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
    };

    // Desktop exit intent: mouse leaves through the top edge.
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };

    // Back-button intercept: push a sentinel state; when the user hits back,
    // popstate fires, we show the modal and re-push so the next back fires again.
    history.pushState({ __exitIntent: true }, "");
    const onPopState = () => {
      trigger();
      history.pushState({ __exitIntent: true }, "");
    };

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const handleCTA = () => {
    setOpen(false);
    navigate("/community");
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[520px] p-0 gap-0 bg-white border-0 overflow-hidden rounded-2xl shadow-2xl"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <div
          className="px-7 pt-7 pb-3"
          style={{ background: "linear-gradient(135deg, #EEF4FF 0%, #FFFFFF 100%)" }}
        >
          <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-0.5 rounded-full bg-blue-600 text-white">
            <Sparkles className="h-3 w-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Wait — before you go</span>
          </div>
          <h2
            className="text-[24px] font-bold text-slate-900 leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Scientists are creating things like this right now.
          </h2>
          <p className="text-[13px] text-slate-600 mt-2 leading-relaxed">
            Take 30 seconds to see what the community has been building on BioSketch this week.
          </p>
        </div>

        <div className="px-7 pb-7 pt-4">
          {project.thumbnail_url && (
            <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-200 aspect-[16/9] mb-4">
              <img
                src={project.thumbnail_url}
                alt={project.title ?? "Recent project"}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <h3
            className="text-[15px] font-semibold text-slate-900 mb-1 line-clamp-1"
            style={{ letterSpacing: "-0.01em" }}
          >
            {project.title ?? "Untitled project"}
          </h3>
          {project.profiles?.full_name && (
            <p className="text-[12px] text-slate-500 mb-5">
              by <span className="font-medium text-slate-700">{project.profiles.full_name}</span>
            </p>
          )}

          <button
            onClick={handleCTA}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            See the full community gallery
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            No thanks, I'll head out
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
