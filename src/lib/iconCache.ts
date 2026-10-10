// IndexedDB cache for parsed SVG icons to improve performance
const DB_NAME = 'IconCacheDB';
const STORE_NAME = 'icons';
const DB_VERSION = 2; // Incremented for schema update
// Tiered cache TTL based on usage
const CACHE_TTL_FREQUENT = 7 * 24 * 60 * 60 * 1000; // 7 days for frequently used
const CACHE_TTL_MODERATE = 3 * 24 * 60 * 60 * 1000; // 3 days for moderately used
const CACHE_TTL_RARE = 24 * 60 * 60 * 1000; // 24 hours for rarely used

interface CachedIcon {
  id: string;
  svgContent: string;
  parsedData: any; // Serialized Fabric.js object data
  timestamp: number;
  complexity: number;
  accessCount: number; // How many times this icon has been accessed
  lastAccessTime: number; // When it was last accessed
}

class IconCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async initDB(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB is not available in this environment');
      return;
    }

    this.initPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.error('Failed to open IconCache DB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const oldVersion = event.oldVersion;

          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('lastAccessTime', 'lastAccessTime', { unique: false });
            store.createIndex('accessCount', 'accessCount', { unique: false });
          } else if (oldVersion < 2) {
            // Migration for existing data - add new indexes
            const transaction = (event.target as IDBOpenDBRequest).transaction!;
            const store = transaction.objectStore(STORE_NAME);

            if (!store.indexNames.contains('lastAccessTime')) {
              store.createIndex('lastAccessTime', 'lastAccessTime', { unique: false });
            }
            if (!store.indexNames.contains('accessCount')) {
              store.createIndex('accessCount', 'accessCount', { unique: false });
            }
          }
        };
      } catch (error) {
        console.error('Error initializing IconCache DB:', error);
        reject(error);
      }
    });

    return this.initPromise;
  }

  async get(id: string): Promise<CachedIcon | null> {
    try {
      await this.initDB();
      if (!this.db) return null;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const cached = request.result as CachedIcon | undefined;

          if (!cached) {
            resolve(null);
            return;
          }

          // Determine TTL based on usage frequency
          const accessCount = cached.accessCount || 0;
          let ttl = CACHE_TTL_RARE; // Default to 24 hours

          if (accessCount >= 10) {
            ttl = CACHE_TTL_FREQUENT; // 7 days for frequently used
          } else if (accessCount >= 3) {
            ttl = CACHE_TTL_MODERATE; // 3 days for moderately used
          }

          // Check if cache is still valid based on tiered TTL
          const age = Date.now() - cached.timestamp;
          if (age > ttl) {
            // Cache expired, delete it
            this.delete(id);
            resolve(null);
            return;
          }

          // Update access tracking
          const updatedIcon: CachedIcon = {
            ...cached,
            accessCount: (cached.accessCount || 0) + 1,
            lastAccessTime: Date.now()
          };

          // Update in background (non-blocking)
          store.put(updatedIcon);

          resolve(cached);
        };

        request.onerror = () => {
          console.error('Failed to get cached icon:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(icon: CachedIcon): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Initialize usage tracking for new entries
        const iconWithTracking: CachedIcon = {
          ...icon,
          timestamp: Date.now(),
          accessCount: icon.accessCount || 0,
          lastAccessTime: icon.lastAccessTime || Date.now()
        };

        const request = store.put(iconWithTracking);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Failed to cache icon:', request.error);
          resolve(); // Don't reject, caching is optional
        };
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      return new Promise((resolve) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Failed to delete cached icon:', request.error);
          resolve();
        };
      });
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      return new Promise((resolve) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          console.error('Failed to clear cache:', request.error);
          resolve();
        };
      });
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async cleanupExpired(): Promise<void> {
    try {
      await this.initDB();
      if (!this.db) return;

      return new Promise((resolve) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        let deletedCount = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const cached = cursor.value as CachedIcon;

            // Determine TTL based on usage
            const accessCount = cached.accessCount || 0;
            let ttl = CACHE_TTL_RARE;

            if (accessCount >= 10) {
              ttl = CACHE_TTL_FREQUENT;
            } else if (accessCount >= 3) {
              ttl = CACHE_TTL_MODERATE;
            }

            // Check if expired based on tiered TTL
            const age = Date.now() - cached.timestamp;
            if (age > ttl) {
              cursor.delete();
              deletedCount++;
            }

            cursor.continue();
          } else {
            if (deletedCount > 0) {
            }
            resolve();
          }
        };

        request.onerror = () => {
          console.error('Failed to cleanup expired cache:', request.error);
          resolve();
        };
      });
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }
}

// Export singleton instance
export const iconCache = new IconCache();

// Export a function to initialize and cleanup (called by consuming code)
export const initIconCache = () => {
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      iconCache.cleanupExpired().catch(err => {
        console.warn('Failed to cleanup expired icon cache on init:', err);
      });
    }, 5000);
  }
};
