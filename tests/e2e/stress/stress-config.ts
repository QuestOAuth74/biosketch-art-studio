import { BrowserContext, Page } from '@playwright/test';

/**
 * Stress test configuration
 * Configurable via environment variables
 */
export interface StressTestConfig {
  baseUrl: string;
  duration: number; // seconds
  anonymousUsers: number;
  authenticatedUsers: number;
  adminUsers: number;
  actionDelayMin: number; // milliseconds
  actionDelayMax: number; // milliseconds
  progressInterval: number; // milliseconds

  // Pass/fail thresholds
  maxConsoleErrors: number;
  maxFailureRate: number; // percentage
  maxAvgPageLoadTime: number; // milliseconds

  // Connection leak detection thresholds
  slowQueryThreshold: number; // milliseconds
  verySlowQueryThreshold: number; // milliseconds
  maxVerySlowQueries: number;
  maxPerformanceDegradation: number; // ratio (1.5 = 50% degradation)
}

/**
 * Get stress test configuration from environment variables with fallback defaults
 */
export const getStressTestConfig = (): StressTestConfig => {
  return {
    baseUrl:
      process.env.STRESS_TEST_URL ||
      process.env.BASE_URL ||
      'http://localhost:8080',
    duration: parseInt(process.env.STRESS_TEST_DURATION || '240', 10), // 4 minutes
    anonymousUsers: parseInt(process.env.STRESS_TEST_ANON_USERS || '3', 10),
    authenticatedUsers: parseInt(process.env.STRESS_TEST_AUTH_USERS || '4', 10),
    adminUsers: parseInt(process.env.STRESS_TEST_ADMIN_USERS || '1', 10),
    actionDelayMin: parseInt(
      process.env.STRESS_TEST_ACTION_DELAY_MIN || '1000',
      10
    ),
    actionDelayMax: parseInt(
      process.env.STRESS_TEST_ACTION_DELAY_MAX || '5000',
      10
    ),
    progressInterval: 15000, // 15 seconds

    // Pass/fail thresholds
    maxConsoleErrors: 0, // No I/O timeouts allowed
    maxFailureRate: 5, // 5% max failure rate
    maxAvgPageLoadTime: 5000, // 5 seconds

    // Connection leak detection thresholds
    slowQueryThreshold: 2000, // 2 seconds
    verySlowQueryThreshold: 5000, // 5 seconds
    maxVerySlowQueries: 0, // No queries > 10s allowed
    maxPerformanceDegradation: 1.5, // 50% slower max
  };
};

export type UserType = 'anonymous' | 'authenticated' | 'admin';

export interface TestUser {
  userId: string;
  email: string;
  password: string;
}

export interface UserContext {
  id: string;
  type: UserType;
  testUser?: TestUser;
  context: BrowserContext;
  page: Page;
}

export interface ActionMetrics {
  timestamp: number;
  userId: string;
  userType: UserType;
  action: string;
  duration: number;
  success: boolean;
  error?: string;
}

export interface NetworkMetrics {
  timestamp: number;
  userId: string;
  url: string;
  method: string;
  status: number;
  duration: number;
}

export interface ConsoleMessage {
  timestamp: number;
  userId: string;
  type: string;
  text: string;
}

export interface StressTestMetrics {
  actions: ActionMetrics[];
  networkRequests: NetworkMetrics[];
  consoleMessages: ConsoleMessage[];
  startTime: number;
  endTime?: number;
}
