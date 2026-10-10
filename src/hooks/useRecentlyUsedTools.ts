import { useState, useEffect, useCallback } from 'react';

const MAX_RECENT_TOOLS = 5;
const STORAGE_KEY = 'canvas_recent_tools';

export const useRecentlyUsedTools = () => {
  const [recentTools, setRecentTools] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentTools));
    } catch (error) {
      console.error('Failed to save recent tools:', error);
    }
  }, [recentTools]);

  const addRecentTool = useCallback((toolId: string) => {
    // Ignore 'select' tool
    if (toolId === 'select') return;
    
    setRecentTools(prev => {
      // Remove if already exists
      const filtered = prev.filter(t => t !== toolId);
      // Add to beginning
      const updated = [toolId, ...filtered];
      // Limit to MAX_RECENT_TOOLS
      return updated.slice(0, MAX_RECENT_TOOLS);
    });
  }, []);

  const clearRecentTools = useCallback(() => {
    setRecentTools([]);
  }, []);

  return {
    recentTools,
    addRecentTool,
    clearRecentTools,
  };
};
