import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Eye } from "lucide-react";

interface StatsData {
  totalUsers: number;
  totalViews: number;
}

function useAnimatedCounter(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (target === 0 || hasAnimated.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export function StatsSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0,
    totalViews: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const [viewsRes] = await Promise.all([
        supabase
          .from("canvas_projects")
          .select("view_count")
          .eq("is_public", true)
          .eq("approval_status", "approved"),
      ]);

      supabase
        .rpc("get_user_count")
        .then(({ data }) => {
          if (typeof data === "number") {
            setStats((prev) => ({ ...prev, totalUsers: data }));
          }
        });

      const totalViews =
        viewsRes.data?.reduce((sum, p) => sum + (p.view_count ?? 0), 0) ?? 0;

      setStats((prev) => ({ ...prev, totalViews }));
    }

    fetchStats();
  }, []);

  const usersCounter = useAnimatedCounter(stats.totalUsers);
  const viewsCounter = useAnimatedCounter(stats.totalViews);

  return (
    <section className="w-full">
      <div className="mx-auto max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Users Card — coral-tinted ambient shadow */}
          <div
            ref={usersCounter.ref}
            className="group relative rounded-2xl border border-border/50 bg-card/70 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:-translate-y-0.5 shadow-[0_6px_24px_-8px_rgba(217,119,87,0.2)] hover:shadow-[0_14px_36px_-8px_rgba(217,119,87,0.32)]"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total
              </span>
            </div>
            <p className="text-4xl md:text-5xl font-bold tracking-tight text-foreground font-serif">
              {formatNumber(usersCounter.count)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registered Researchers
            </p>
          </div>

          {/* Views Card — slate-tinted ambient shadow */}
          <div
            ref={viewsCounter.ref}
            className="group relative rounded-2xl border border-border/50 bg-card/70 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:-translate-y-0.5 shadow-[0_6px_24px_-8px_rgba(100,116,139,0.22)] hover:shadow-[0_14px_36px_-8px_rgba(100,116,139,0.34)]"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="rounded-xl bg-slate-500/10 p-2.5">
                <Eye className="h-5 w-5 text-slate-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total
              </span>
            </div>
            <p className="text-4xl md:text-5xl font-bold tracking-tight text-foreground font-serif">
              {formatNumber(viewsCounter.count)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Project Views
            </p>
          </div>
        </div>

        {/* ORCID Sign-In CTA — only show when not logged in */}
        {!user && (
          <div className="mt-6">
            <button
              onClick={() => navigate('/auth')}
              className="w-full group relative rounded-2xl border-2 border-[#A6CE39]/40 bg-[#A6CE39]/5 backdrop-blur-sm p-5 transition-all duration-300 hover:border-[#A6CE39]/70 hover:bg-[#A6CE39]/10 hover:-translate-y-0.5 shadow-[0_6px_24px_-8px_rgba(166,206,57,0.25)] hover:shadow-[0_14px_36px_-8px_rgba(166,206,57,0.4)] flex items-center justify-center gap-3"
            >
              <svg width="28" height="28" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <path d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z" fill="#A6CE39"/>
                <path d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 178 93 149 93h-24.7v79.4zM88.7 56.8c0 5.5-4.5 10.1-10.1 10.1s-10.1-4.6-10.1-10.1c0-5.6 4.5-10.1 10.1-10.1s10.1 4.6 10.1 10.1z" fill="#fff"/>
              </svg>
              <span className="text-base font-bold text-foreground">
                One-click sign in with your ORCID research ID
              </span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
