import { useAuth } from '@/contexts/AuthContext';
import { useAiGate } from '@/contexts/AiGateContext';
import { useGenerationBalance } from './useGenerationBalance';

/**
 * Guard for AI feature entry points. Handles the 24h onboarding gate two ways:
 *
 *   1. `isGated()` — cheap client-side pre-check. Call BEFORE invoking; if it
 *      returns true, the waiting-period dialog has already been opened and
 *      the caller should return without invoking.
 *
 *   2. `handleInvokeError(err)` — server-side fallback. Call in the catch
 *      block of `supabase.functions.invoke(...)`. If the error is a 429
 *      WAITING_PERIOD (defense-in-depth from the edge function), opens the
 *      dialog and returns true so the caller can suppress its normal error
 *      toast.
 *
 * Usage:
 *   const { isGated, handleInvokeError } = useAiInvokeGuard();
 *   const handleGenerate = async () => {
 *     if (isGated()) return;
 *     try {
 *       const { data, error } = await supabase.functions.invoke(...);
 *       if (error) throw error;
 *       // ...
 *     } catch (e) {
 *       if (await handleInvokeError(e)) return;
 *       // existing error handling
 *     }
 *   };
 */
export function useAiInvokeGuard() {
  const { isAdmin } = useAuth();
  const { data: balance } = useGenerationBalance();
  const { openWaitingPeriodDialog } = useAiGate();

  const isGated = (): boolean => {
    if (isAdmin) return false;
    if (balance?.gate?.locked) {
      openWaitingPeriodDialog(balance.gate.unlock_at);
      return true;
    }
    return false;
  };

  const handleInvokeError = async (err: unknown): Promise<boolean> => {
    // supabase-js attaches the raw Response to error.context for edge-function
    // errors. Peek at the body to distinguish WAITING_PERIOD from other 4xx/5xx.
    const ctx = (err as { context?: Response })?.context;
    if (ctx && typeof ctx.clone === 'function') {
      try {
        const body = await ctx.clone().json();
        if (body?.error === 'WAITING_PERIOD') {
          openWaitingPeriodDialog(body.unlock_at ?? null);
          return true;
        }
      } catch {
        // response body wasn't JSON — fall through
      }
    }
    return false;
  };

  return { isGated, handleInvokeError, openWaitingPeriodDialog };
}
