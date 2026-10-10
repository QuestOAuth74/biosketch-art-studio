import { Page } from '@playwright/test';
import { MetricsCollector } from './metrics-collector';
import { StressTestConfig } from './stress-config';
import { AdminPage } from '../utils/page-objects/AdminPage';
import { ProjectsPage } from '../utils/page-objects/ProjectsPage';
import { CommunityPage } from '../utils/page-objects/CommunityPage';
import { ContactPage } from '../utils/page-objects/ContactPage';
import { BlogPage } from '../utils/page-objects/BlogPage';

/**
 * Anonymous User Simulator
 * Simulates unauthenticated user behavior
 */
export class AnonymousUserSimulator {
  private page: Page;
  private userId: string;
  private metricsCollector: MetricsCollector;
  private config: StressTestConfig;

  constructor(
    page: Page,
    userId: string,
    metricsCollector: MetricsCollector,
    config: StressTestConfig
  ) {
    this.page = page;
    this.userId = userId;
    this.metricsCollector = metricsCollector;
    this.config = config;
  }

  async runRandomAction(): Promise<void> {
    const actions = [
      { name: 'visitHomePage', fn: () => this.visitHomePage() },
      { name: 'visitTestimonials', fn: () => this.visitTestimonials() },
      { name: 'visitReleaseNotes', fn: () => this.visitReleaseNotes() },
      { name: 'visitTerms', fn: () => this.visitTerms() },
      { name: 'visitContactPage', fn: () => this.visitContactPage() },
      { name: 'submitContactForm', fn: () => this.submitContactForm() },
      { name: 'navigateToAuth', fn: () => this.navigateToAuth() },
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];
    await this.trackAction(action.name, action.fn);
  }

  private async trackAction(
    actionName: string,
    action: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    try {
      await action();
      this.metricsCollector.recordAction({
        timestamp: startTime,
        userId: this.userId,
        userType: 'anonymous',
        action: actionName,
        duration: Date.now() - startTime,
        success: true,
      });
    } catch (error: any) {
      this.metricsCollector.recordAction({
        timestamp: startTime,
        userId: this.userId,
        userType: 'anonymous',
        action: actionName,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
      });
    }
  }

  private async visitHomePage(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  private async visitTestimonials(): Promise<void> {
    await this.page.goto('/testimonials');
    await this.page.waitForLoadState('networkidle');
    await this.scrollPage();
    await this.randomDelay();
  }

  private async visitReleaseNotes(): Promise<void> {
    await this.page.goto('/release-notes');
    await this.page.waitForLoadState('networkidle');
    await this.scrollPage();
    await this.randomDelay();
  }

  private async visitTerms(): Promise<void> {
    await this.page.goto('/terms');
    await this.page.waitForLoadState('networkidle');
    await this.scrollPage();
    await this.randomDelay();
  }

  private async visitContactPage(): Promise<void> {
    await this.page.goto('/contact');
    await this.page.waitForLoadState('networkidle');
  }

  private async submitContactForm(): Promise<void> {
    await this.page.goto('/contact');
    await this.page.waitForLoadState('networkidle');

    const contactPage = new ContactPage(this.page);
    await contactPage.submitContactForm(
      `stress-test-${this.userId}@example.com`,
      `Stress Test User ${this.userId}`,
      'United States',
      'This is a stress test message.'
    );

    await this.page.waitForLoadState('networkidle');
  }

  private async navigateToAuth(): Promise<void> {
    await this.page.goto('/auth');
    await this.page.waitForLoadState('networkidle');
  }

  private async scrollPage(): Promise<void> {
    await this.page.evaluate(() => window.scrollBy(0, 500));
  }

  private async randomDelay(): Promise<void> {
    const delay = Math.random() * 2000 + 500; // 500-2500ms
    await this.page.waitForTimeout(delay);
  }
}

/**
 * Authenticated User Simulator
 * Simulates authenticated user behavior
 */
export class AuthenticatedUserSimulator {
  private page: Page;
  private userId: string;
  private metricsCollector: MetricsCollector;
  private config: StressTestConfig;

  constructor(
    page: Page,
    userId: string,
    metricsCollector: MetricsCollector,
    config: StressTestConfig
  ) {
    this.page = page;
    this.userId = userId;
    this.metricsCollector = metricsCollector;
    this.config = config;
  }

  async runRandomAction(): Promise<void> {
    const actions = [
      { name: 'visitProjects', fn: () => this.visitProjects() },
      { name: 'searchProjects', fn: () => this.searchProjects() },
      { name: 'visitCommunity', fn: () => this.visitCommunity() },
      { name: 'searchCommunity', fn: () => this.searchCommunity() },
      { name: 'sortCommunity', fn: () => this.sortCommunity() },
      { name: 'viewCommunityProject', fn: () => this.viewCommunityProject() },
      { name: 'visitBlog', fn: () => this.visitBlog() },
      { name: 'searchBlog', fn: () => this.searchBlog() },
      { name: 'visitProfile', fn: () => this.visitProfile() },
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];
    await this.trackAction(action.name, action.fn);
  }

  private async trackAction(
    actionName: string,
    action: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    try {
      await action();
      this.metricsCollector.recordAction({
        timestamp: startTime,
        userId: this.userId,
        userType: 'authenticated',
        action: actionName,
        duration: Date.now() - startTime,
        success: true,
      });
    } catch (error: any) {
      this.metricsCollector.recordAction({
        timestamp: startTime,
        userId: this.userId,
        userType: 'authenticated',
        action: actionName,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
      });
    }
  }

  private async visitProjects(): Promise<void> {
    const projectsPage = new ProjectsPage(this.page);
    await projectsPage.goto();
    await projectsPage.waitForPageLoad();
    await projectsPage.scrollPage();
    await this.randomDelay();
  }

  private async searchProjects(): Promise<void> {
    const projectsPage = new ProjectsPage(this.page);
    await projectsPage.goto();
    await projectsPage.waitForPageLoad();
    await projectsPage.search('test project');
    await this.page.waitForLoadState('networkidle');
  }

  private async visitCommunity(): Promise<void> {
    const communityPage = new CommunityPage(this.page);
    await communityPage.goto();
    await communityPage.waitForPageLoad();
    await communityPage.scrollPage();
    await this.randomDelay();
  }

  private async searchCommunity(): Promise<void> {
    const communityPage = new CommunityPage(this.page);
    await communityPage.goto();
    await communityPage.waitForPageLoad();
    await communityPage.search('biology');
    await this.page.waitForLoadState('networkidle');
  }

  private async sortCommunity(): Promise<void> {
    const communityPage = new CommunityPage(this.page);
    await communityPage.goto();
    await communityPage.waitForPageLoad();

    const sortOptions: ('recent' | 'popular' | 'cloned' | 'liked')[] = [
      'recent',
      'popular',
      'cloned',
      'liked',
    ];
    const option = sortOptions[Math.floor(Math.random() * sortOptions.length)];

    await communityPage.sortBy(option);
    await this.page.waitForLoadState('networkidle');
  }

  private async viewCommunityProject(): Promise<void> {
    const communityPage = new CommunityPage(this.page);
    await communityPage.goto();
    await communityPage.waitForPageLoad();
    await communityPage.clickFirstProject();
    await this.page.waitForLoadState('networkidle');
  }

  private async visitBlog(): Promise<void> {
    const blogPage = new BlogPage(this.page);
    await blogPage.goto();
    await blogPage.waitForPageLoad();
    await blogPage.scrollPage();
    await this.randomDelay();
  }

  private async searchBlog(): Promise<void> {
    const blogPage = new BlogPage(this.page);
    await blogPage.goto();
    await blogPage.waitForPageLoad();
    await blogPage.search('science');
    await this.page.waitForLoadState('networkidle');
  }

  private async visitProfile(): Promise<void> {
    await this.page.goto('/profile');
    await this.page.waitForLoadState('networkidle');
  }

  private async randomDelay(): Promise<void> {
    const delay = Math.random() * 2000 + 500; // 500-2500ms
    await this.page.waitForTimeout(delay);
  }
}

/**
 * Admin User Simulator
 * Simulates admin user behavior, including AdminNotificationBell polling
 */
export class AdminUserSimulator {
  private page: Page;
  private userId: string;
  private metricsCollector: MetricsCollector;
  private config: StressTestConfig;

  constructor(
    page: Page,
    userId: string,
    metricsCollector: MetricsCollector,
    config: StressTestConfig
  ) {
    this.page = page;
    this.userId = userId;
    this.metricsCollector = metricsCollector;
    this.config = config;
  }

  async runRandomAction(): Promise<void> {
    const actions = [
      { name: 'visitAdminDashboard', fn: () => this.visitAdminDashboard() },
      { name: 'checkNotifications', fn: () => this.checkNotifications() },
      { name: 'visitAnalytics', fn: () => this.visitAnalytics() },
      { name: 'visitAISettings', fn: () => this.visitAISettings() },
      { name: 'visitRateLimits', fn: () => this.visitRateLimits() },
      {
        name: 'visitEmailNotifications',
        fn: () => this.visitEmailNotifications(),
      },
      { name: 'scrollThroughSections', fn: () => this.scrollThroughSections() },
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];
    await this.trackAction(action.name, action.fn);
  }

  private async trackAction(
    actionName: string,
    action: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    try {
      await action();
      this.metricsCollector.recordAction({
        timestamp: startTime,
        userId: this.userId,
        userType: 'admin',
        action: actionName,
        duration: Date.now() - startTime,
        success: true,
      });
    } catch (error: any) {
      this.metricsCollector.recordAction({
        timestamp: startTime,
        userId: this.userId,
        userType: 'admin',
        action: actionName,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
      });
    }
  }

  private async visitAdminDashboard(): Promise<void> {
    const adminPage = new AdminPage(this.page);
    await adminPage.goto();
    await adminPage.waitForPageLoad();

    // Wait for AdminNotificationBell to complete initial fetch
    await this.page.waitForTimeout(2000);
  }

  private async checkNotifications(): Promise<void> {
    const adminPage = new AdminPage(this.page);
    await adminPage.goto();
    await adminPage.waitForPageLoad();

    // Click notification bell to trigger popover
    await adminPage.clickNotificationBell();
    await this.randomDelay();

    // Close popover
    await this.page.keyboard.press('Escape');
  }

  private async scrollThroughSections(): Promise<void> {
    await this.page.goto('/admin');
    await this.page.waitForLoadState('networkidle');

    // Scroll through different sections
    const sectionIds = [
      'submitted-projects',
      'testimonials',
      'icon-submissions',
      'contact-messages',
      'tool-feedback',
    ];

    for (const sectionId of sectionIds) {
      await this.page.evaluate((id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, sectionId);
      await this.randomDelay();
    }
  }

  private async visitAnalytics(): Promise<void> {
    await this.page.goto('/admin/analytics');
    await this.page.waitForLoadState('networkidle');
    await this.randomDelay();
  }

  private async visitAISettings(): Promise<void> {
    await this.page.goto('/admin/ai-settings');
    await this.page.waitForLoadState('networkidle');
    await this.randomDelay();
  }

  private async visitRateLimits(): Promise<void> {
    await this.page.goto('/admin/rate-limits');
    await this.page.waitForLoadState('networkidle');
    await this.randomDelay();
  }

  private async visitEmailNotifications(): Promise<void> {
    await this.page.goto('/admin/email-notifications');
    await this.page.waitForLoadState('networkidle');
    await this.randomDelay();
  }

  private async randomDelay(): Promise<void> {
    const delay = Math.random() * 2000 + 500; // 500-2500ms
    await this.page.waitForTimeout(delay);
  }
}
