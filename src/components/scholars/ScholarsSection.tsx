import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BookOpen, GraduationCap, Megaphone, Link as LinkIcon, ChevronDown, Check, Clock, X as XIcon } from "lucide-react";

// Reward defaults — admins can override per-application at approve time.
// Locked in with the user; keep in sync with the admin review page.
type Track = "citation" | "academic" | "community";
const TRACKS: {
  id: Track;
  label: string;
  reward: number;
  icon: typeof BookOpen;
  color: string;
  border: string;
  headline: string;
  eligibility: string;
  requirements: string[];
}[] = [
  {
    id: "citation",
    label: "Citation",
    reward: 100,
    icon: BookOpen,
    color: "text-primary",
    border: "border-l-primary",
    headline: "Cite BioSketch in a paper",
    eligibility: "Peer-reviewed paper, preprint (bioRxiv / medRxiv), or thesis with a DOI.",
    requirements: [
      "Publicly accessible URL with DOI",
      "Named mention of BioSketch",
      "Clickable link to biosketch.art",
    ],
  },
  {
    id: "academic",
    label: "Academic",
    reward: 50,
    icon: GraduationCap,
    color: "text-emerald-600",
    border: "border-l-emerald-500",
    headline: "Post on a university domain",
    eligibility: "Blog post, course notes, or lab-page write-up on .edu / .ac.* / .edu.* domain.",
    requirements: [
      "URL on a university / research-institution domain",
      "≥ 100 words of your own content about BioSketch",
      "Clickable link to biosketch.art",
    ],
  },
  {
    id: "community",
    label: "Community",
    reward: 20,
    icon: Megaphone,
    color: "text-amber-600",
    border: "border-l-amber-500",
    headline: "Share on social or a blog",
    eligibility: "LinkedIn, Twitter/X, YouTube, Medium, Substack, or your personal blog.",
    requirements: [
      "Public URL (no login wall)",
      "Named mention + clickable link",
      "Genuine review, tutorial, or use-case post",
    ],
  },
];

type ApplicationRow = {
  id: string;
  track: Track;
  url: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  credits_granted: number | null;
  created_at: string;
  reviewed_at: string | null;
};

export function ScholarsSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track>("citation");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load the user's own applications. RLS restricts to their own rows.
  const { data: applications = [] } = useQuery({
    queryKey: ["scholar-applications", user?.id],
    queryFn: async (): Promise<ApplicationRow[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("scholar_applications")
        .select("id, track, url, description, status, admin_note, credits_granted, created_at, reviewed_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApplicationRow[];
    },
    enabled: !!user?.id,
  });

  const openDialog = (track: Track) => {
    if (!user?.id) {
      toast.error("Sign in first to apply for scholar credits");
      return;
    }
    setSelectedTrack(track);
    setUrl("");
    setDescription("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!url.trim() || !/^https?:\/\//i.test(url.trim())) {
      toast.error("Please paste a full URL starting with http:// or https://");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("scholar_applications").insert({
        user_id: user.id,
        track: selectedTrack,
        url: url.trim(),
        description: description.trim() || null,
      });
      if (error) throw error;
      toast.success("Application submitted — you'll see it in My Applications below");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["scholar-applications", user.id] });
    } catch (err: any) {
      console.error("Scholar application submit failed:", err);
      toast.error(err?.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const selected = TRACKS.find((t) => t.id === selectedTrack)!;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="mt-16 md:mt-20"
    >
      <div className="text-center mb-8">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
          Scholars program
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          Three more ways to earn credits.
        </h2>
        <p className="mt-3 text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
          Publicly share BioSketch — in a paper, on your university page, or on
          social — and we'll credit your account after we verify the link.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TRACKS.map((track) => {
          const Icon = track.icon;
          return (
            <div
              key={track.id}
              className={`rounded-xl bg-white border border-slate-200 border-l-4 ${track.border} shadow-md p-6 flex flex-col`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`h-5 w-5 ${track.color}`} />
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 tabular-nums ${track.color}`}>
                  +{track.reward} credits
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 tracking-tight">
                {track.label}
              </h3>
              <p className="text-sm font-semibold text-slate-700 mb-2">
                {track.headline}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                {track.eligibility}
              </p>
              <ul className="space-y-1.5 mb-4 flex-1">
                {track.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <Check className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => openDialog(track.id)}
                className="w-full h-9 rounded-md bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 active:scale-[0.98] transition-all"
              >
                Apply
              </button>
            </div>
          );
        })}
      </div>

      {/* My applications — collapsible; only rendered when the user has any */}
      {applications.length > 0 && (
        <details className="mt-6 group max-w-4xl mx-auto rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer flex items-center justify-between px-5 py-3.5 select-none list-none">
            <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
              My applications ({applications.length})
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {applications.filter((a) => a.status === "pending").length} pending ·{" "}
              {applications.filter((a) => a.status === "approved").length} approved ·{" "}
              {applications.filter((a) => a.status === "rejected").length} rejected
            </span>
          </summary>
          <div className="border-t border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 font-semibold">
                <tr>
                  <th className="text-left px-4 py-2">Track</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">URL</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {applications.map((app) => {
                  const track = TRACKS.find((t) => t.id === app.track);
                  return (
                    <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {track?.label ?? app.track}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1 text-xs max-w-xs truncate"
                        >
                          <LinkIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{app.url}</span>
                        </a>
                        {app.admin_note && app.status === "rejected" && (
                          <p className="text-[11px] text-rose-600 mt-1 italic">
                            {app.admin_note}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill status={app.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800">
                        {app.credits_granted ? `+${app.credits_granted}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Application dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => { if (!submitting) setDialogOpen(o); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply — {selected.label} track</DialogTitle>
            <DialogDescription>
              {selected.headline}. If we can verify the link and it meets the
              requirements, we'll credit your account with{" "}
              <span className="font-bold text-slate-800">+{selected.reward} generations</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label htmlFor="scholar-url" className="block text-xs font-bold text-slate-600 mb-1">
                URL <span className="text-primary">*</span>
              </label>
              <input
                id="scholar-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                disabled={submitting}
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {selected.eligibility}
              </p>
            </div>

            <div>
              <label htmlFor="scholar-desc" className="block text-xs font-bold text-slate-600 mb-1">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="scholar-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Anything the reviewer should know — where in the page BioSketch is mentioned, or which figure(s) it was used for."
                disabled={submitting}
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60"
              />
            </div>

            <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs font-bold text-slate-700 mb-1.5">
                Requirements checklist
              </p>
              <ul className="space-y-1">
                {selected.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <Check className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !url.trim()}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}

function StatusPill({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
        <Check className="h-3 w-3" /> Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
        <XIcon className="h-3 w-3" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}
