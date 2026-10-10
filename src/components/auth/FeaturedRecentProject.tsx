import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowUpRight } from "lucide-react";

interface FeaturedProject {
  id: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  updated_at: string;
  user_id: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

export function FeaturedRecentProject() {
  const [project, setProject] = useState<FeaturedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("canvas_projects")
          .select("id, title, description, thumbnail_url, updated_at, user_id")
          .eq("is_public", true)
          .eq("approval_status", "approved")
          .not("thumbnail_url", "is", null)
          .gte("updated_at", thirtyDaysAgo)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("public_profiles")
          .select("full_name, avatar_url")
          .eq("id", data.user_id)
          .maybeSingle();

        setProject({ ...data, profiles: profile ?? null });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-[340px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 animate-pulse">
        <div className="h-48 w-full rounded-xl bg-slate-100 mb-4" />
        <div className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
        <div className="h-3 w-1/2 bg-slate-100 rounded" />
      </div>
    );
  }

  if (!project) return null;

  const authorName = project.profiles?.full_name ?? "A BioSketch scientist";

  return (
    <div
      onClick={() => navigate('/community')}
      className="w-full max-w-[340px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 cursor-pointer transition-all hover:shadow-2xl hover:border-slate-300 hover:-translate-y-0.5"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="inline-flex items-center gap-1.5 mb-3 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100">
        <Sparkles className="h-3 w-3 text-blue-600" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
          Featured Recent
        </span>
      </div>

      {project.thumbnail_url && (
        <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-4 aspect-[4/3]">
          <img
            src={project.thumbnail_url}
            alt={project.title ?? "Recent project"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <h3 className="text-[15px] font-semibold text-slate-900 line-clamp-1 mb-1" style={{ letterSpacing: "-0.01em" }}>
        {project.title ?? "Untitled project"}
      </h3>

      {project.description && (
        <p className="text-[12px] text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          {project.profiles?.avatar_url ? (
            <img src={project.profiles.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-slate-200 shrink-0" />
          )}
          <span className="text-[11px] text-slate-600 truncate">{authorName}</span>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      </div>
    </div>
  );
}
