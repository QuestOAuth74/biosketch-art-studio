import { useState } from "react";
import { Gift, X, Copy, Check, Mail, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";

/**
 * Floating "Share with friend" CTA. Opens a modal showing the user's
 * permanent referral link. When a friend signs up via that link, the
 * inviter is awarded 3 bonus AI generation credits — capped at one
 * bonus per inviter per calendar month (enforced server-side in
 * claim_referral_bonus RPC).
 *
 * Permanent referral link shape:
 *   https://biosketch.art/auth?ref=<userId>
 *
 * The referral is captured on the friend's auth page and claimed
 * after their first authenticated session in AuthContext.
 */
export const ShareWithFriendFAB = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Hide on auth + survey routes — irrelevant context.
  if (location.pathname.startsWith("/auth") || location.pathname === "/survey") return null;

  // Anonymous users can't refer.
  if (!user) return null;

  const referralLink = `${window.location.origin}/auth?ref=${user.id}`;
  const shareText =
    "I'm using BioSketch.art for scientific illustrations — free, open, and surprisingly capable. " +
    "Sign up via my link and I get bonus AI credits.";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "BioSketch.art",
          text: shareText,
          url: referralLink,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  const mailto = `mailto:?subject=${encodeURIComponent("BioSketch.art — free scientific illustration tool")}&body=${encodeURIComponent(shareText + "\n\n" + referralLink)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(shareText + " " + referralLink)}`;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Share with a friend"
        title="Invite a friend, earn 3 AI credits"
        className="fixed bottom-6 right-6 z-40 group inline-flex items-center gap-2 px-4 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-[0_8px_24px_-6px_rgba(15,23,42,0.4)] hover:shadow-[0_14px_32px_-6px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 transition-all"
      >
        <Gift className="h-4 w-4 text-[#D97757]" />
        <span className="hidden sm:inline">Invite a friend</span>
        <span className="hidden sm:inline text-[10px] font-normal text-slate-300">+3 credits</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#FAF9F5] border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200/80 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                  <Gift className="h-4 w-4 text-[#D97757]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Invite a friend</h2>
                  <p className="text-[11px] text-slate-500">Earn 3 AI credits when they sign up</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Share your link with a colleague or labmate. When they sign up, you'll earn{" "}
                <span className="font-semibold text-slate-900">3 bonus AI credits</span>.
                Limit: one bonus per calendar month.
              </p>

              {/* Link + copy */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 bg-transparent outline-none text-[13px] text-slate-700 font-mono truncate"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={handleCopy}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                    copied
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Share targets */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={mailto}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-slate-700"
                >
                  <Mail className="h-4 w-4" />
                  <span className="text-[11px] font-medium">Email</span>
                </a>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-slate-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-[11px] font-medium">WhatsApp</span>
                </a>
                <button
                  onClick={handleNativeShare}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-slate-700"
                >
                  <Gift className="h-4 w-4" />
                  <span className="text-[11px] font-medium">More…</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed text-center pt-1">
                Bonus credits are permanent — they extend your free trial limit and stack onto your monthly allowance forever.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
