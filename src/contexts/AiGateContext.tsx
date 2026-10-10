import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { WaitingPeriodDialog } from '@/components/ai/WaitingPeriodDialog';

interface AiGateContextType {
  /**
   * Open the 24h waiting-period dialog. Pass the ISO unlock timestamp from the
   * balance RPC or from a 429 WAITING_PERIOD response; null falls back to a
   * generic "come back tomorrow" message.
   */
  openWaitingPeriodDialog: (unlockAt: string | null) => void;
}

const AiGateContext = createContext<AiGateContextType | undefined>(undefined);

export const useAiGate = (): AiGateContextType => {
  const ctx = useContext(AiGateContext);
  if (!ctx) throw new Error('useAiGate must be used within AiGateProvider');
  return ctx;
};

export const AiGateProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [unlockAt, setUnlockAt] = useState<string | null>(null);

  const openWaitingPeriodDialog = useCallback((next: string | null) => {
    setUnlockAt(next);
    setOpen(true);
  }, []);

  return (
    <AiGateContext.Provider value={{ openWaitingPeriodDialog }}>
      {children}
      <WaitingPeriodDialog open={open} onOpenChange={setOpen} unlockAt={unlockAt} />
    </AiGateContext.Provider>
  );
};
