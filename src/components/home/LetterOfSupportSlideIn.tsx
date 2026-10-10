import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSignature, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SESSION_KEY = 'biosketch_los_slidein_shown';
const SHOW_DELAY_MS = 5000;          // wait 5s after mount before sliding in
const AUTO_DISMISS_MS = 30000;       // visible for 30s, then auto-leave
const ANIMATION_MS = 500;            // slide transition duration

type State = 'pending' | 'entering' | 'visible' | 'leaving' | 'hidden';

/**
 * Slide-in card that appears on the home page 5 seconds after load,
 * inviting users to read / sign the letter of support (currently
 * routed at /survey — renamed from "Letter of Support" but the URL
 * was kept). Auto-dismisses 5 seconds later if not clicked. Shown
 * at most once per browser session.
 */
export function LetterOfSupportSlideIn() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>('pending');

  // After delay, transition to entering → visible (next frame).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) {
      setState('hidden');
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, '1');
      setState('entering');
      requestAnimationFrame(() => setState('visible'));
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss after AUTO_DISMISS_MS visible.
  useEffect(() => {
    if (state !== 'visible') return;
    const t = setTimeout(() => setState('leaving'), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [state]);

  // Unmount after slide-out completes.
  useEffect(() => {
    if (state !== 'leaving') return;
    const t = setTimeout(() => setState('hidden'), ANIMATION_MS);
    return () => clearTimeout(t);
  }, [state]);

  if (state === 'pending' || state === 'hidden') return null;

  const handleClick = () => {
    setState('leaving');
    navigate('/survey');
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState('leaving');
  };

  const isOffscreen = state !== 'visible';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label="Read and sign the BioSketch letter of support"
      className={cn(
        'fixed right-6 top-1/2 -translate-y-1/2 z-40 w-[320px] cursor-pointer text-left',
        'rounded-2xl overflow-hidden border border-sky-200/70 backdrop-blur-md',
        'transition-all ease-out',
        'focus:outline-none focus:ring-2 focus:ring-sky-300/60',
        isOffscreen ? 'translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100',
      )}
      style={{
        transitionDuration: `${ANIMATION_MS}ms`,
        background:
          'linear-gradient(135deg, rgba(224,242,254,0.96) 0%, rgba(207,232,253,0.96) 55%, rgba(219,234,254,0.96) 100%)',
        boxShadow: '0 12px 32px -10px rgba(56,134,205,0.22), 0 4px 12px -4px rgba(56,134,205,0.10)',
      }}
    >
      {/* Close button — sits over the card's pale-blue surface, so its
          chrome is slate, not white. */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Dismiss"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/70 hover:bg-white text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors shadow-sm"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>

      <div className="p-5 pr-9">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-9 w-9 rounded-xl bg-white/80 ring-1 ring-sky-200 flex items-center justify-center">
            <FileSignature className="h-5 w-5 text-sky-700" strokeWidth={2.25} />
          </div>
          <span className="text-[11px] font-bold tracking-widest uppercase text-sky-800/80">
            Letter of Support
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900 leading-snug">
          Help us keep BioSketch free.
        </h3>
        <p className="mt-1 text-xs text-slate-700 leading-snug">
          Sign the letter to support open scientific tools. It takes a minute.
        </p>

        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 bg-white/70 hover:bg-white rounded-lg px-3 py-1.5 ring-1 ring-sky-200/80 transition-colors">
          Read &amp; sign
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
