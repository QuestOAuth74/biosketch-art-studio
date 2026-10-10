import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LockInfo {
  lockedBy: string;         // user id
  lockedByName: string;     // display name
  lockedAt: string;
}

export interface UseProjectLockReturn {
  isLocked: boolean;
  lockInfo: LockInfo | null;
  canManageLock: boolean;
  lockProject: () => Promise<void>;
  unlockProject: () => Promise<void>;
}

export function useProjectLock(
  projectId: string | null,
  userId: string | null | undefined,
  userRole: 'owner' | 'admin' | 'member' | null,
): UseProjectLockReturn {
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);

  const canManageLock = userRole === 'owner' || userRole === 'admin';

  // Fetch initial lock state
  useEffect(() => {
    if (!projectId) return;

    const fetchLock = async () => {
      const { data } = await supabase
        .from('project_locks')
        .select('project_id, locked_by, locked_at')
        .eq('project_id', projectId)
        .maybeSingle();

      if (data) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.locked_by)
          .maybeSingle();

        setLockInfo({
          lockedBy: data.locked_by,
          lockedByName: profile?.full_name ?? 'Unknown',
          lockedAt: data.locked_at,
        });
      } else {
        setLockInfo(null);
      }
    };

    fetchLock();

    // Subscribe to realtime changes on this project's lock row
    const channel = supabase
      .channel(`project-lock:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_locks',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            setLockInfo(null);
          } else if (payload.eventType === 'INSERT') {
            const row = payload.new as { locked_by: string; locked_at: string };
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', row.locked_by)
              .maybeSingle();

            setLockInfo({
              lockedBy: row.locked_by,
              lockedByName: profile?.full_name ?? 'Unknown',
              lockedAt: row.locked_at,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const lockProject = useCallback(async () => {
    if (!projectId || !userId) return;
    await supabase
      .from('project_locks')
      .insert({ project_id: projectId, locked_by: userId });
    supabase.functions.invoke('send-lock-notification', {
      body: { projectId, action: 'locked' },
    });
  }, [projectId, userId]);

  const unlockProject = useCallback(async () => {
    if (!projectId) return;
    await supabase
      .from('project_locks')
      .delete()
      .eq('project_id', projectId);
    supabase.functions.invoke('send-lock-notification', {
      body: { projectId, action: 'unlocked' },
    });
  }, [projectId]);

  return {
    isLocked: lockInfo !== null,
    lockInfo,
    canManageLock,
    lockProject,
    unlockProject,
  };
}
