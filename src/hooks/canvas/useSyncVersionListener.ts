import { useEffect, useState } from "react";
import { Canvas } from "fabric";

export function useSyncVersionListener(canvas: Canvas | null): number {
  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    if (!canvas) return;
    const handleSyncApplied = () => setSyncVersion(v => v + 1);
    (canvas as any).on('sync:applied', handleSyncApplied);
    return () => { (canvas as any).off('sync:applied', handleSyncApplied); };
  }, [canvas]);

  return syncVersion;
}
