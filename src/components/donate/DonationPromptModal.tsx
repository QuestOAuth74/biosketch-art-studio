import { useEffect, useState } from 'react';
import { DonationPickerModal } from './DonationPickerModal';

// LocalStorage keys — user-agent-scoped (a user who dismissed on one device
// won't see it again on the same device even after signing out).
const KEY_DISMISS_UNTIL = 'biosketch:donation-prompt-dismissed-until';
const KEY_DONATED = 'biosketch:donation-prompt-donated';
const KEY_LAST_SHOWN = 'biosketch:donation-prompt-last-shown';

// "Not now" suppresses for 30 days. Donation suppresses forever.
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function shouldShowPrompt(projectCount: number): boolean {
  if (projectCount < 3) return false;
  try {
    if (localStorage.getItem(KEY_DONATED) === '1') return false;
    const dismissUntil = Number(localStorage.getItem(KEY_DISMISS_UNTIL) || '0');
    if (dismissUntil > Date.now()) return false;
    const lastShown = Number(localStorage.getItem(KEY_LAST_SHOWN) || '0');
    if (Date.now() - lastShown < 60_000) return false;
  } catch {
    return false;
  }
  return true;
}

interface DonationPromptModalProps {
  projectCount: number | undefined;
}

/**
 * Auto-shown donation prompt for users with ≥3 projects. Uses the shared
 * DonationPickerModal so the tier UI matches the "Donate" button elsewhere.
 * Passes a warm project-count intro banner.
 */
export function DonationPromptModal({ projectCount }: DonationPromptModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (projectCount === undefined) return;
    if (!shouldShowPrompt(projectCount)) return;
    setOpen(true);
    try {
      localStorage.setItem(KEY_LAST_SHOWN, String(Date.now()));
    } catch { /* ignore */ }
  }, [projectCount]);

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      // Any close route that isn't "donated" counts as "not now" — suppress 30d.
      try {
        localStorage.setItem(KEY_DISMISS_UNTIL, String(Date.now() + DISMISS_DURATION_MS));
      } catch { /* ignore */ }
    }
    setOpen(newOpen);
  };

  const handleDonate = () => {
    try {
      localStorage.setItem(KEY_DONATED, '1');
    } catch { /* ignore */ }
  };

  return (
    <DonationPickerModal
      open={open}
      onOpenChange={handleClose}
      onDonate={handleDonate}
      intro={
        <span>
          You've built <strong className="text-foreground">{projectCount}</strong>{' '}
          project{projectCount === 1 ? '' : 's'} on BioSketch — thank you for using
          the tool. If it's helped with a paper, poster, or grant, please consider
          chipping in below.
        </span>
      }
    />
  );
}
