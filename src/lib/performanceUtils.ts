// Performance utility functions for canvas optimization

/**
 * Throttle function - limits execution to once per wait period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastRan: number | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();

    if (lastRan === null || now - lastRan >= wait) {
      func.apply(this, args);
      lastRan = now;
    } else if (!timeout) {
      timeout = setTimeout(
        () => {
          func.apply(this, args);
          lastRan = Date.now();
          timeout = null;
        },
        wait - (now - lastRan)
      );
    }
  };
}

/**
 * Debounce function - delays execution until after wait period of inactivity
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(this, args);
      timeout = null;
    }, wait);
  };
}

/**
 * Enhanced Render Scheduler for batching canvas render calls and operations
 */
export class RenderScheduler {
  private scheduled: boolean = false;
  private canvas: any = null;
  private operationQueue: Array<() => void> = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(canvas?: any) {
    this.canvas = canvas;
  }

  setCanvas(canvas: any) {
    this.canvas = canvas;
  }

  scheduleRender() {
    if (this.scheduled || !this.canvas) return;
    
    this.scheduled = true;
    requestAnimationFrame(() => {
      if (this.canvas) {
        this.canvas.requestRenderAll();
      }
      this.scheduled = false;
    });
  }

  renderNow() {
    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
    this.scheduled = false;
  }

  /**
   * Queue an operation to be executed in batch
   * Useful for bulk modifications that should only trigger one render
   */
  queueOperation(operation: () => void) {
    this.operationQueue.push(operation);

    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Set new timeout to execute batch
    this.batchTimeout = setTimeout(() => {
      this.executeBatch();
    }, 16); // ~60fps
  }

  /**
   * Execute all queued operations in batch
   */
  private executeBatch() {
    if (this.operationQueue.length === 0 || !this.canvas) return;

    // Disable rendering temporarily for bulk operations
    this.canvas.renderOnAddRemove = false;

    // Execute all operations
    this.operationQueue.forEach(operation => {
      try {
        operation();
      } catch (error) {
        console.error('Error executing batched operation:', error);
      }
    });

    // Re-enable rendering and render once
    this.canvas.renderOnAddRemove = true;
    this.scheduleRender();

    // Clear queue
    this.operationQueue = [];
    this.batchTimeout = null;
  }

  /**
   * Execute operations immediately (skip batching)
   */
  executeImmediate(operation: () => void) {
    if (!this.canvas) return;

    operation();
    this.renderNow();
  }

  /**
   * Clear all pending operations
   */
  clearQueue() {
    this.operationQueue = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Get number of pending operations
   */
  getPendingCount(): number {
    return this.operationQueue.length;
  }
}
