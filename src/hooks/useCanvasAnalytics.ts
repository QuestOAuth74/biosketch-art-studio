import { useEffect, useRef } from "react";
import {
  trackCanvasClick,
  trackCanvasSessionStart,
  trackCanvasSessionEnd,
  trackToolUse,
  flushAnalytics,
} from "@/lib/analyticsTracker";

export function useCanvasAnalytics(activeTool: string) {
  const sessionStartRef = useRef<number>(0);
  const lastToolRef = useRef<string>("");

  // Track session start/end
  useEffect(() => {
    sessionStartRef.current = Date.now();
    trackCanvasSessionStart();

    return () => {
      if (sessionStartRef.current) {
        trackCanvasSessionEnd(Date.now() - sessionStartRef.current);
        flushAnalytics();
      }
    };
  }, []);

  // Track tool changes
  useEffect(() => {
    if (activeTool && activeTool !== lastToolRef.current) {
      lastToolRef.current = activeTool;
      trackToolUse(activeTool);
    }
  }, [activeTool]);

  return { trackCanvasClick };
}
