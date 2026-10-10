import {
  ActionMetrics,
  NetworkMetrics,
  ConsoleMessage,
  StressTestMetrics,
  StressTestConfig,
} from './stress-config';

export class MetricsCollector {
  private metrics: StressTestMetrics;
  private config: StressTestConfig;

  constructor(config: StressTestConfig) {
    this.config = config;
    this.metrics = {
      actions: [],
      networkRequests: [],
      consoleMessages: [],
      startTime: Date.now(),
    };
  }

  recordAction(action: ActionMetrics): void {
    this.metrics.actions.push(action);
  }

  recordNetworkRequest(request: NetworkMetrics): void {
    this.metrics.networkRequests.push(request);
  }

  recordConsoleMessage(message: ConsoleMessage): void {
    this.metrics.consoleMessages.push(message);
  }

  getMetrics(): StressTestMetrics {
    return { ...this.metrics, endTime: Date.now() };
  }

  getIOTimeoutErrors(): ConsoleMessage[] {
    return this.metrics.consoleMessages.filter(
      (msg) =>
        msg.type === 'error' &&
        (msg.text.toLowerCase().includes('i/o timeout') ||
          msg.text.toLowerCase().includes('timeout') ||
          msg.text.toLowerCase().includes('econnrefused') ||
          msg.text.toLowerCase().includes('etimedout'))
    );
  }

  getFailedRequests(): NetworkMetrics[] {
    return this.metrics.networkRequests.filter(
      (req) => req.status >= 400 || req.status === 0
    );
  }

  getAveragePageLoadTime(): number {
    const pageLoads = this.metrics.actions.filter(
      (action) =>
        action.action.includes('visit') || action.action.includes('goto')
    );

    if (pageLoads.length === 0) return 0;

    const total = pageLoads.reduce((sum, action) => sum + action.duration, 0);
    return total / pageLoads.length;
  }

  getSuccessRate(): number {
    if (this.metrics.actions.length === 0) return 100;

    const successCount = this.metrics.actions.filter(
      (a) => a.success
    ).length;
    return (successCount / this.metrics.actions.length) * 100;
  }

  getSlowQueries(threshold: number): ActionMetrics[] {
    return this.metrics.actions.filter(
      (action) => action.duration > threshold
    );
  }

  /**
   * Get performance metrics broken down by time period
   * Returns average response time for start, middle, and end periods
   */
  getPerformanceTrend(): {
    start: { avgDuration: number; count: number };
    middle: { avgDuration: number; count: number };
    end: { avgDuration: number; count: number };
    degradation: number;
  } {
    const duration = this.metrics.endTime
      ? this.metrics.endTime - this.metrics.startTime
      : Date.now() - this.metrics.startTime;

    const startPeriodEnd = this.metrics.startTime + 60000; // First 60 seconds
    const endPeriodStart =
      this.metrics.endTime! - 60000 || Date.now() - 60000; // Last 60 seconds

    const startActions = this.metrics.actions.filter(
      (a) => a.timestamp <= startPeriodEnd
    );
    const middleActions = this.metrics.actions.filter(
      (a) => a.timestamp > startPeriodEnd && a.timestamp < endPeriodStart
    );
    const endActions = this.metrics.actions.filter(
      (a) => a.timestamp >= endPeriodStart
    );

    const avgStart =
      startActions.length > 0
        ? startActions.reduce((sum, a) => sum + a.duration, 0) /
          startActions.length
        : 0;
    const avgMiddle =
      middleActions.length > 0
        ? middleActions.reduce((sum, a) => sum + a.duration, 0) /
          middleActions.length
        : 0;
    const avgEnd =
      endActions.length > 0
        ? endActions.reduce((sum, a) => sum + a.duration, 0) / endActions.length
        : 0;

    const degradation = avgStart > 0 ? (avgEnd / avgStart - 1) * 100 : 0;

    return {
      start: { avgDuration: avgStart, count: startActions.length },
      middle: { avgDuration: avgMiddle, count: middleActions.length },
      end: { avgDuration: avgEnd, count: endActions.length },
      degradation,
    };
  }

  /**
   * Get AdminNotificationBell polling cycle metrics
   * Assuming polling happens every 60 seconds starting at test start
   */
  getAdminPollingMetrics(): {
    cycle: number;
    timestamp: number;
    duration: number;
    success: boolean;
  }[] {
    // Look for admin actions around 60-second intervals
    const pollingCycles = [];
    const cycleInterval = 60000; // 60 seconds
    const tolerance = 5000; // 5 second tolerance

    for (let i = 0; i < 6; i++) {
      // Check up to 6 cycles (6 minutes)
      const expectedTime = this.metrics.startTime + i * cycleInterval;
      const cycleActions = this.metrics.actions.filter(
        (a) =>
          a.userType === 'admin' &&
          Math.abs(a.timestamp - expectedTime) < tolerance &&
          (a.action.includes('admin') || a.action.includes('Dashboard'))
      );

      if (cycleActions.length > 0) {
        const avgDuration =
          cycleActions.reduce((sum, a) => sum + a.duration, 0) /
          cycleActions.length;
        const allSuccess = cycleActions.every((a) => a.success);

        pollingCycles.push({
          cycle: i + 1,
          timestamp: expectedTime,
          duration: avgDuration,
          success: allSuccess,
        });
      }
    }

    return pollingCycles;
  }

  getUserTypeBreakdown(): Record<string, number> {
    return this.metrics.actions.reduce(
      (acc, action) => {
        acc[action.userType] = (acc[action.userType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  generateReport(): string {
    const duration =
      (this.metrics.endTime! - this.metrics.startTime) / 1000;
    const totalActions = this.metrics.actions.length;
    const totalRequests = this.metrics.networkRequests.length;
    const ioTimeouts = this.getIOTimeoutErrors().length;
    const failedRequests = this.getFailedRequests().length;
    const avgPageLoad = this.getAveragePageLoadTime();
    const successRate = this.getSuccessRate();
    const failureRate = 100 - successRate;

    const slowQueries = this.getSlowQueries(this.config.slowQueryThreshold);
    const verySlowQueries = this.getSlowQueries(
      this.config.verySlowQueryThreshold
    );
    const criticalSlowQueries = this.getSlowQueries(10000); // > 10 seconds

    const trend = this.getPerformanceTrend();
    const adminPolling = this.getAdminPollingMetrics();
    const userBreakdown = this.getUserTypeBreakdown();

    return `
╔══════════════════════════════════════════════════════════════╗
║           STRESS TEST REPORT                                 ║
╚══════════════════════════════════════════════════════════════╝

Duration: ${duration.toFixed(2)}s

Actions:
  Total: ${totalActions}
  Success Rate: ${successRate.toFixed(2)}%
  Failure Rate: ${failureRate.toFixed(2)}%
  Actions/sec: ${(totalActions / duration).toFixed(2)}

Network:
  Total Requests: ${totalRequests}
  Failed Requests: ${failedRequests} (${((failedRequests / totalRequests) * 100).toFixed(2)}%)
  Requests/sec: ${(totalRequests / duration).toFixed(2)}

Performance:
  Avg Page Load Time: ${avgPageLoad.toFixed(2)}ms
  Slow Queries (> ${this.config.slowQueryThreshold}ms): ${slowQueries.length} (${((slowQueries.length / totalActions) * 100).toFixed(2)}%)
  Very Slow Queries (> ${this.config.verySlowQueryThreshold}ms): ${verySlowQueries.length} (${((verySlowQueries.length / totalActions) * 100).toFixed(2)}%)
  Critical Slow Queries (> 10s): ${criticalSlowQueries.length} ${criticalSlowQueries.length === 0 ? '✅' : '❌'}

${this.generateCriticalSlowQueriesBreakdown(criticalSlowQueries)}

Performance Trend Analysis:
  Start Period (0-60s):
    Avg Response: ${trend.start.avgDuration.toFixed(0)}ms
    Requests: ${trend.start.count}

  Middle Period (60-${duration - 60}s):
    Avg Response: ${trend.middle.avgDuration.toFixed(0)}ms
    Requests: ${trend.middle.count}

  End Period (${duration - 60}-${duration}s):
    Avg Response: ${trend.end.avgDuration.toFixed(0)}ms
    Requests: ${trend.end.count}

  Degradation: ${trend.degradation.toFixed(1)}% (End vs Start) ${trend.degradation < 50 ? '✅' : '❌'}
  Status: ${trend.degradation < 50 ? 'Within acceptable range (< 50%)' : 'Exceeds acceptable range (< 50%)'}

${
  adminPolling.length > 0
    ? `AdminNotificationBell Polling Cycles:
${adminPolling
  .map(
    (cycle) =>
      `  Cycle ${cycle.cycle} (${((cycle.timestamp - this.metrics.startTime) / 1000).toFixed(0)}s):   Duration: ${cycle.duration.toFixed(0)}ms | Success: ${cycle.success ? '✅' : '❌'}`
  )
  .join('\n')}

  Average: ${(adminPolling.reduce((sum, c) => sum + c.duration, 0) / adminPolling.length).toFixed(0)}ms | All cycles ${adminPolling.every((c) => c.success) ? 'successful' : 'had failures'}
  Trend: ${this.analyzePollingTrend(adminPolling)}`
    : ''
}

Console Errors:
  I/O Timeouts: ${ioTimeouts} ${ioTimeouts === 0 ? '✅' : '❌'}
  Total Errors: ${this.metrics.consoleMessages.filter((m) => m.type === 'error').length}

${this.generateErrorBreakdown()}

User Types Breakdown:
${Object.entries(userBreakdown)
  .map(([type, count]) => `  ${type}: ${count} actions`)
  .join('\n')}

📋 Pass/Fail Evaluation (I/O Timeout Detection):
   I/O Timeouts: ${ioTimeouts} (max: ${this.config.maxConsoleErrors}) ${ioTimeouts <= this.config.maxConsoleErrors ? '✅' : '❌'}
   Failure Rate: ${failureRate.toFixed(2)}% (max: ${this.config.maxFailureRate}%) ${failureRate <= this.config.maxFailureRate ? '✅' : '❌'}
   Performance Degradation: ${trend.degradation.toFixed(1)}% (max: ${(this.config.maxPerformanceDegradation - 1) * 100}%) ${trend.degradation / 100 + 1 <= this.config.maxPerformanceDegradation ? '✅' : '❌'}

${this.evaluateOverall() ? '✅ ALL CHECKS PASSED - No connection leaks detected' : '❌ STRESS TEST FAILED - Issues detected'}

    `.trim();
  }

  private generateCriticalSlowQueriesBreakdown(criticalQueries: ActionMetrics[]): string {
    if (criticalQueries.length === 0) {
      return '';
    }

    let breakdown = '\n  Critical Slow Actions (> 10s):\n';
    criticalQueries
      .sort((a, b) => b.duration - a.duration) // Sort by duration descending
      .forEach((action, index) => {
        const timeStr = (action.duration / 1000).toFixed(2);
        breakdown += `    ${index + 1}. [${timeStr}s] ${action.userType} - ${action.action} ${action.success ? '✅' : '❌'}\n`;
      });

    return breakdown;
  }

  private generateErrorBreakdown(): string {
    const errorMessages = this.metrics.consoleMessages.filter(
      (m) => m.type === 'error'
    );

    if (errorMessages.length === 0) {
      return '  No errors detected ✅';
    }

    // Group errors by message text
    const errorCounts = errorMessages.reduce((acc, msg) => {
      const errorText = msg.text;
      acc[errorText] = (acc[errorText] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Sort by frequency
    const sortedErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 most frequent errors

    let breakdown = '\n  Top Error Messages:\n';
    sortedErrors.forEach(([error, count], index) => {
      const truncated = error.length > 100 ? error.substring(0, 100) + '...' : error;
      breakdown += `    ${index + 1}. [${count}x] ${truncated}\n`;
    });

    return breakdown;
  }

  private analyzePollingTrend(
    cycles: {
      cycle: number;
      timestamp: number;
      duration: number;
      success: boolean;
    }[]
  ): string {
    if (cycles.length < 2) return 'Insufficient data';

    const firstDuration = cycles[0].duration;
    const lastDuration = cycles[cycles.length - 1].duration;
    const change = ((lastDuration - firstDuration) / firstDuration) * 100;

    if (Math.abs(change) < 15) return 'Stable (no significant degradation)';
    if (change > 0)
      return `Degrading (${change.toFixed(1)}% slower by end)`;
    return `Improving (${Math.abs(change).toFixed(1)}% faster by end)`;
  }

  evaluateOverall(): boolean {
    // Evaluate based on I/O timeout detection criteria only
    const ioTimeouts = this.getIOTimeoutErrors().length;
    const failureRate = 100 - this.getSuccessRate();
    const trend = this.getPerformanceTrend();
    const degradationRatio = trend.degradation / 100 + 1;

    return (
      ioTimeouts <= this.config.maxConsoleErrors &&
      failureRate <= this.config.maxFailureRate &&
      degradationRatio <= this.config.maxPerformanceDegradation
    );
  }
}
