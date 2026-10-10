import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { GraduationCap, ExternalLink, Check, X, Clock, Loader2 } from "lucide-react";

// Reward defaults — pre-filled on the approve dialog; admin can override
// per-application. Must match src/components/scholars/ScholarsSection.tsx.
const TRACK_DEFAULTS: Record<string, { label: string; reward: number }> = {
  citation: { label: "Citation", reward: 100 },
  academic: { label: "Academic", reward: 50 },
  community: { label: "Community", reward: 20 },
};

type ApplicationRow = {
  id: string;
  user_id: string;
  track: "citation" | "academic" | "community";
  url: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  credits_granted: number | null;
  reviewed_at: string | null;
  created_at: string;
  applicantEmail?: string;
};

export default function ScholarsReview() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [approveApp, setApproveApp] = useState<ApplicationRow | null>(null);
  const [rejectApp, setRejectApp] = useState<ApplicationRow | null>(null);
  const [creditAmount, setCreditAmount] = useState<string>("");
  const [adminNote, setAdminNote] = useState<string>("");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admin-scholar-applications", statusFilter],
    queryFn: async (): Promise<ApplicationRow[]> => {
      let q = supabase
        .from("scholar_applications")
        .select("id, user_id, track, url, description, status, admin_note, credits_granted, reviewed_at, created_at")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;

      // Batch-fetch emails from profiles. RLS on profiles typically allows
      // admins full read; if not, .in() falls back to empty results.
      const rows = (data ?? []) as ApplicationRow[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length === 0) return rows;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      const emailById = new Map<string, string>();
      for (const p of profs ?? []) emailById.set(p.id, p.email as string);
      return rows.map((r) => ({ ...r, applicantEmail: emailById.get(r.user_id) }));
    },
    enabled: isAdmin === true,
  });

  const openApprove = (app: ApplicationRow) => {
    setApproveApp(app);
    setCreditAmount(String(TRACK_DEFAULTS[app.track]?.reward ?? 0));
    setAdminNote("");
  };
  const openReject = (app: ApplicationRow) => {
    setRejectApp(app);
    setAdminNote("");
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      const app = approveApp;
      if (!app || !user?.id) throw new Error("No application selected");
      const credits = Number(creditAmount);
      if (!Number.isFinite(credits) || credits <= 0) throw new Error("Credit amount must be a positive number");

      // 1. Grant credits via the existing admin RPC (writes to
      //    ai_credit_purchases with an admin-grant prefix; the user's balance
      //    updates immediately).
      const reason = `Scholars program — ${TRACK_DEFAULTS[app.track]?.label ?? app.track} track (app ${app.id.slice(0, 8)}…)`;
      const { error: grantError } = await supabase.rpc("admin_grant_ai_credits", {
        p_target_user_id: app.user_id,
        p_generations: credits,
        p_reason: reason,
      });
      if (grantError) throw grantError;

      // 2. Mark the application approved.
      const { error: updateError } = await supabase
        .from("scholar_applications")
        .update({
          status: "approved",
          credits_granted: credits,
          admin_note: adminNote.trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Application approved — credits granted");
      setApproveApp(null);
      queryClient.invalidateQueries({ queryKey: ["admin-scholar-applications"] });
    },
    onError: (err: any) => {
      console.error("Approve failed:", err);
      toast.error(err?.message || "Approve failed");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const app = rejectApp;
      if (!app || !user?.id) throw new Error("No application selected");
      if (!adminNote.trim()) throw new Error("Please provide a reason for rejection");
      const { error } = await supabase
        .from("scholar_applications")
        .update({
          status: "rejected",
          admin_note: adminNote.trim(),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application rejected — user will see the reason");
      setRejectApp(null);
      queryClient.invalidateQueries({ queryKey: ["admin-scholar-applications"] });
    },
    onError: (err: any) => {
      console.error("Reject failed:", err);
      toast.error(err?.message || "Reject failed");
    },
  });

  if (isAdmin !== true) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Scholars program</h1>
          <p className="text-sm text-slate-500">
            Review user applications. Approve to grant AI generation credits.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-colors ${
              statusFilter === f
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading applications…
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-200 rounded-lg">
          No {statusFilter === "all" ? "" : statusFilter} applications.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 font-semibold">
              <tr>
                <th className="text-left px-4 py-2.5">Applicant</th>
                <th className="text-left px-4 py-2.5">Track</th>
                <th className="text-left px-4 py-2.5">URL</th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">Notes</th>
                <th className="text-left px-4 py-2.5">Submitted</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-800">
                    <div className="font-medium">{app.applicantEmail ?? app.user_id.slice(0, 8) + "…"}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{app.user_id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                      {TRACK_DEFAULTS[app.track]?.label ?? app.track}
                    </span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      default +{TRACK_DEFAULTS[app.track]?.reward ?? 0}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 text-xs max-w-[240px] truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{app.url}</span>
                    </a>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell max-w-[240px]">
                    {app.description && (
                      <p className="text-xs text-slate-600 line-clamp-3">{app.description}</p>
                    )}
                    {app.admin_note && (
                      <p className="text-[11px] text-slate-500 italic mt-1">
                        {app.status === "approved" ? "Note: " : "Reason: "}
                        {app.admin_note}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                    {new Date(app.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {app.status === "pending" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openApprove(app)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openReject(app)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </div>
                    ) : (
                      <StatusPill status={app.status} credits={app.credits_granted} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve dialog */}
      <Dialog open={approveApp !== null} onOpenChange={(o) => { if (!o && !approveMutation.isPending) setApproveApp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve application</DialogTitle>
            <DialogDescription>
              Grants credits to {approveApp?.applicantEmail ?? approveApp?.user_id.slice(0, 8) + "…"}.
              Uses the same admin credit-grant RPC — the balance updates immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <div><strong>Track:</strong> {approveApp && TRACK_DEFAULTS[approveApp.track]?.label}</div>
              <div className="mt-1 truncate"><strong>URL:</strong> {approveApp?.url}</div>
              {approveApp?.description && (
                <div className="mt-1"><strong>Notes:</strong> {approveApp.description}</div>
              )}
            </div>

            <div>
              <label htmlFor="approve-credits" className="block text-xs font-bold text-slate-600 mb-1">
                Credits to grant <span className="text-primary">*</span>
              </label>
              <input
                id="approve-credits"
                type="number"
                min={1}
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                disabled={approveMutation.isPending}
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Default for {approveApp?.track} track is {approveApp && TRACK_DEFAULTS[approveApp.track]?.reward}. Override if the submission deserves more or less.
              </p>
            </div>

            <div>
              <label htmlFor="approve-note" className="block text-xs font-bold text-slate-600 mb-1">
                Note <span className="font-normal text-slate-400">(optional — visible to user)</span>
              </label>
              <textarea
                id="approve-note"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Thanks for sharing! Loved the section about…"
                disabled={approveMutation.isPending}
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setApproveApp(null)}
              disabled={approveMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || !creditAmount}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {approveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {approveMutation.isPending ? "Granting…" : "Grant + approve"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectApp !== null} onOpenChange={(o) => { if (!o && !rejectMutation.isPending) setRejectApp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>
              Marks this application as rejected. The reason you enter is shown
              to the user in their My Applications view.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label htmlFor="reject-note" className="block text-xs font-bold text-slate-600 mb-1">
              Reason <span className="text-primary">*</span>
            </label>
            <textarea
              id="reject-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Link isn't publicly accessible / doesn't mention BioSketch / …"
              disabled={rejectMutation.isPending}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60"
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setRejectApp(null)}
              disabled={rejectMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending || !adminNote.trim()}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {rejectMutation.isPending ? "Rejecting…" : "Reject"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status, credits }: { status: "approved" | "rejected"; credits: number | null }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
        <Check className="h-3 w-3" /> Approved{credits ? ` · +${credits}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
      <X className="h-3 w-3" /> Rejected
    </span>
  );
}
