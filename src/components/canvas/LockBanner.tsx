import { Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CanvasEditorTestIds } from '@/lib/test-ids';
import type { LockInfo } from '@/hooks/useProjectLock';

interface LockBannerProps {
  lockInfo: LockInfo;
  canManageLock: boolean;
  onUnlock: () => void;
}

export function LockBanner({ lockInfo, canManageLock, onUnlock }: LockBannerProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm"
      data-testid={CanvasEditorTestIds.LOCK_BANNER}
    >
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 flex-shrink-0" />
        <span>
          This project is locked by <strong>{lockInfo.lockedByName}</strong>. Edits are disabled.
        </span>
      </div>
      {canManageLock ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onUnlock}
          className="border-destructive text-destructive hover:bg-destructive/10 flex-shrink-0"
          data-testid={CanvasEditorTestIds.UNLOCK_BUTTON}
        >
          <Unlock className="h-3 w-3 mr-1" />
          Unlock
        </Button>
      ) : (
        <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
          Edit disabled
        </span>
      )}
    </div>
  );
}
