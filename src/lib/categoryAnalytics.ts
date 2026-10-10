/**
 * Category Usage Analytics
 * Tracks which categories users interact with most frequently
 * Used for smart preloading of popular categories
 */

const STORAGE_KEY = 'icon_category_analytics';
const MAX_HISTORY = 100; // Keep last 100 category opens

interface CategoryAccess {
  categoryId: string;
  timestamp: number;
}

interface CategoryStats {
  categoryId: string;
  accessCount: number;
  lastAccessed: number;
  score: number; // Weighted score considering recency and frequency
}

class CategoryAnalytics {
  private history: CategoryAccess[] = [];

  constructor() {
    this.loadHistory();
  }

  /**
   * Load access history from localStorage
   */
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load category analytics:', error);
      this.history = [];
    }
  }

  /**
   * Save access history to localStorage
   */
  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Failed to save category analytics:', error);
    }
  }

  /**
   * Record a category access
   */
  recordAccess(categoryId: string): void {
    const access: CategoryAccess = {
      categoryId,
      timestamp: Date.now()
    };

    this.history.push(access);

    // Keep only recent history
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }

    this.saveHistory();
  }

  /**
   * Get statistics for all categories
   * Calculates frequency and recency scores
   */
  getStats(): CategoryStats[] {
    const now = Date.now();
    const statsMap = new Map<string, CategoryStats>();

    // Calculate raw counts
    this.history.forEach(access => {
      const existing = statsMap.get(access.categoryId);
      if (existing) {
        existing.accessCount++;
        existing.lastAccessed = Math.max(existing.lastAccessed, access.timestamp);
      } else {
        statsMap.set(access.categoryId, {
          categoryId: access.categoryId,
          accessCount: 1,
          lastAccessed: access.timestamp,
          score: 0
        });
      }
    });

    // Calculate weighted scores
    // Score = (accessCount * 10) + (recencyBonus)
    // recencyBonus: 100 for today, 50 for this week, 10 for this month, 0 for older
    statsMap.forEach(stat => {
      const ageMs = now - stat.lastAccessed;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      let recencyBonus = 0;
      if (ageDays < 1) {
        recencyBonus = 100;
      } else if (ageDays < 7) {
        recencyBonus = 50;
      } else if (ageDays < 30) {
        recencyBonus = 10;
      }

      stat.score = (stat.accessCount * 10) + recencyBonus;
    });

    // Convert to array and sort by score
    return Array.from(statsMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Get top N categories for preloading
   */
  getTopCategories(count: number = 3): string[] {
    const stats = this.getStats();
    return stats.slice(0, count).map(s => s.categoryId);
  }

  /**
   * Check if a category should be preloaded
   */
  shouldPreload(categoryId: string, threshold: number = 3): boolean {
    const stats = this.getStats();
    const categoryStat = stats.find(s => s.categoryId === categoryId);
    return categoryStat ? categoryStat.accessCount >= threshold : false;
  }

  /**
   * Clear all analytics data
   */
  clear(): void {
    this.history = [];
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Export singleton instance
export const categoryAnalytics = new CategoryAnalytics();
