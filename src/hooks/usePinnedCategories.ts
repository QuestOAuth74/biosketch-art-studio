import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pinned_icon_categories';

export const usePinnedCategories = () => {
  const [pinnedCategoryIds, setPinnedCategoryIds] = useState<string[]>([]);

  // Load pinned categories from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPinnedCategoryIds(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Failed to load pinned categories:', error);
    }
  }, []);

  // Save to localStorage whenever pinnedCategoryIds changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedCategoryIds));
    } catch (error) {
      console.error('Failed to save pinned categories:', error);
    }
  }, [pinnedCategoryIds]);

  const togglePin = (categoryId: string) => {
    setPinnedCategoryIds(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const isPinned = (categoryId: string) => pinnedCategoryIds.includes(categoryId);

  return {
    pinnedCategoryIds,
    togglePin,
    isPinned,
  };
};
