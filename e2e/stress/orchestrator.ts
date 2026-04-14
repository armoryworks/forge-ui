import { chromium, Browser, BrowserContext, Page } from 'playwright';

import { STRESS_USERS, BASE_URL, API_URL, STRESS_DURATION_MS, MAX_WORKERS, TestUser } from '../lib/fixtures';
import { StressMetrics, WorkerState, WorkflowError, StepResult } from '../lib/types';
import { clearOverlayBackdrops, dismissDraftRecoveryPrompt, clearAllDrafts } from '../lib/form.lib';

// Workflow imports — each returns a Workflow describing the loop for that role/team
import { getProductionAlphaWorkflow } from './workflows/production-alpha.workflow';
import { getProductionBravoWorkflow } from './workflows/production-bravo.workflow';
import { getEngineerWorkflow } from './workflows/engineer.workflow';
import { getManagerWorkflow } from './workflows/manager.workflow';
import { getOfficeWorkflow } from './workflows/office.workflow';
import { getAdminWorkflow } from './workflows/admin.workflow';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StepCategory = 'browse' | 'create' | 'timer-start' | 'timer-stop' | 'chat' | 'search' | 'admin' | 'report';

export interface WorkflowStep {
  id: string;
  name: string;
  /** Step categorization for filtering and metrics */
  category: StepCategory;
  /** Tags for grouping related steps (e.g., 'kanban', 'inventory', 'time-tracking') */
  tags: string[];
  /** Returns optional entity type string if data was created (e.g., 'job', 'lead') */
  execute: (page: Page) => Promise<string | void>;
}

export interface Workflow {
  name: string;
  steps: WorkflowStep[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface WorkerContext {
  user: TestUser;
  context: BrowserContext;
  page: Page;
  state: WorkerState;
  abortController: AbortController;
}

interface OrchestratorOptions {
  onUpdate?: (metrics: StressMetrics) => void;
  onError?: (error: WorkflowError) => void;
  onEvent?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class StressOrchestrator {
  private browser!: Browser;
  private workers: Map<number, WorkerContext> = new Map();
  private metrics: StressMetrics;
  private errors: WorkflowError[] = [];
  private allResponseTimes: number[] = [];
  private running = false;
  private durationTimer: ReturnType<typeof setTimeout> | null = null;
  private metricsInterval: ReturnType<typeof setInterval> | null = null;

  private readonly onUpdate?: (metrics: StressMetrics) => void;
  private readonly onError?: (error: WorkflowError) => void;
  private readonly onEvent?: (message: string) => void;

  constructor(options?: OrchestratorOptions) {
    this.onUpdate = options?.onUpdate;
    this.onError = options?.onError;
    this.onEvent = options?.onEvent;
    this.metrics = this.createEmptyMetrics();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    this.log('Launching browser (headless Chromium)...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',    // Use /tmp instead of /dev/shm (prevents OOM)
        '--no-sandbox',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
      ],
    });
    this.running = true;
    this.metrics = this.createEmptyMetrics();
    this.errors = [];
    this.allResponseTimes = [];

    // Authenticate and launch each worker with a 500ms stagger
    const workerPromises: Promise<void>[] = [];

    const usersToLaunch = STRESS_USERS.slice(0, MAX_WORKERS);
    for (let i = 0; i < usersToLaunch.length; i++) {
      const user = usersToLaunch[i];

      // Stagger: wait 500ms between each worker launch (auth is the bottleneck)
      if (i > 0) {
        await this.delay(500);
      }

      this.log(`[W${user.workerId}] Initializing ${user.email} (${user.role})...`);

      try {
        const wc = await this.createWorker(user);
        this.workers.set(user.workerId, wc);
        this.metrics.workers.push(wc.state);

        // Fire and forget — each worker runs its loop independently
        workerPromises.push(this.runWorkerLoop(wc));
        this.log(`[W${user.workerId}] Started workflow loop`);
      } catch (err) {
        this.log(`[W${user.workerId}] FAILED to initialize: ${this.extractMessage(err)}`);
      }
    }

    // Set the duration timer to stop everything
    this.durationTimer = setTimeout(() => {
      this.log(`Duration limit reached (${STRESS_DURATION_MS}ms). Stopping all workers...`);
      this.stop();
    }, STRESS_DURATION_MS);

    // Periodically emit metrics updates (every 10 seconds)
    this.metricsInterval = setInterval(() => {
      this.refreshAggregateMetrics();
      this.onUpdate?.(this.metrics);
    }, 10_000);

    this.log(`All ${this.workers.size} workers launched. Running for ${Math.round(STRESS_DURATION_MS / 60_000)} minutes.`);

    // Wait for all worker loops to finish (they stop when this.running = false)
    await Promise.allSettled(workerPromises);
    this.log('All worker loops have exited.');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    this.log('Stopping orchestrator...');

    // Clear timers
    if (this.durationTimer) {
      clearTimeout(this.durationTimer);
      this.durationTimer = null;
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Signal all workers to abort
    for (const [, wc] of this.workers) {
      wc.abortController.abort();
    }

    // Give workers time to finish their current step (steps avg ~9s)
    await this.delay(15_000);

    // Close all contexts and the browser
    for (const [, wc] of this.workers) {
      try {
        await wc.context.close();
      } catch {
        // Context may already be closed on error
      }
    }

    try {
      await this.browser.close();
    } catch {
      // Browser may already be closed
    }

    // Final metrics snapshot
    this.refreshAggregateMetrics();
    this.onUpdate?.(this.metrics);
    this.log('Orchestrator stopped. Final metrics captured.');
  }

  getMetrics(): StressMetrics {
    this.refreshAggregateMetrics();
    return { ...this.metrics };
  }

  getErrors(): WorkflowError[] {
    return [...this.errors];
  }

  // -----------------------------------------------------------------------
  // Worker lifecycle
  // -----------------------------------------------------------------------

  private async createWorker(user: TestUser): Promise<WorkerContext> {
    const context = await this.browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    const state: WorkerState = {
      workerId: user.workerId,
      email: user.email,
      role: user.role,
      team: user.team,
      status: 'initializing',
      currentStep: '',
      currentScript: '',
      loopCount: 0,
      stepCount: 0,
      errorCount: 0,
      lastError: null,
      lastErrorAt: null,
      startedAt: new Date(),
      signalrEvents: 0,
      chatMessages: 0,
      avgResponseMs: 0,
      dataCreated: {},
    };

    const wc: WorkerContext = {
      user,
      context,
      page,
      state,
      abortController: new AbortController(),
    };

    // Track 401 burst to trigger re-auth
    let consecutive401s = 0;
    let reauthing = false;

    page.on('response', (res) => {
      if (res.url().includes('/api/v1/')) {
        if (res.status() === 401) {
          consecutive401s++;
          // After 3 consecutive 401s, re-authenticate (session likely expired)
          if (consecutive401s >= 3 && !reauthing) {
            reauthing = true;
            this.log(`[W${user.workerId}] Session expired — re-authenticating...`);
            this.authenticate(context, page, user)
              .then(() => {
                consecutive401s = 0;
                reauthing = false;
                this.log(`[W${user.workerId}] Re-authenticated successfully`);
              })
              .catch(() => { reauthing = false; });
          }
        } else if (res.ok()) {
          consecutive401s = 0; // Reset on any successful call
        }

        if (res.status() >= 400) {
          const url = res.url().replace(API_URL, '');
          // Skip noisy expected errors
          if (res.status() === 401) return; // handled by re-auth above
          if (res.status() === 403 && (url.includes('planning-cycles') || url.includes('/admin/'))) return;
          if (res.status() === 409 && url.includes('timer/stop')) return;
          this.log(`[W${user.workerId}] HTTP ${res.status()} ${res.request().method()} ${url}`);
        }
      }
    });

    // Authenticate
    await this.authenticate(context, page, user);
    state.status = 'running';
    state.currentScript = this.getWorkflow(user).name;

    return wc;
  }

  private async runWorkerLoop(wc: WorkerContext): Promise<void> {
    const workflow = this.getWorkflow(wc.user);
    wc.state.currentScript = workflow.name;

    while (this.running && !wc.abortController.signal.aborted) {
      wc.state.loopCount++;

      // Clear stale drafts at the start of each loop to prevent recovery prompts
      await clearAllDrafts(wc.page).catch(() => {});

      // Shuffle step order each iteration — Fisher-Yates
      const steps = [...workflow.steps];
      for (let i = steps.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [steps[i], steps[j]] = [steps[j], steps[i]];
      }

      try {
        let completedAllSteps = true;

        for (const step of steps) {
          // Check stop conditions before each step
          if (!this.running || wc.abortController.signal.aborted) {
            completedAllSteps = false;
            break;
          }

          wc.state.currentStep = `${step.id} ${step.name}`;
          const start = Date.now();

          try {
            // Clear tooltips/overlays before each step to prevent pointer interception
            await clearOverlayBackdrops(wc.page).catch(() => {});
            // Dismiss any draft recovery dialogs left by previous steps
            await dismissDraftRecoveryPrompt(wc.page).catch(() => {});

            const dataCreated = await step.execute(wc.page);
            const duration = Date.now() - start;

            this.recordStep(wc, {
              stepId: step.id,
              stepName: step.name,
              success: true,
              durationMs: duration,
              dataCreated: dataCreated || undefined,
            });

            // Clean up any lingering CDK overlay backdrops before next step
            await clearOverlayBackdrops(wc.page).catch(() => {});

            // Random delay between steps — scales with test duration
            // Short tests (< 5 min): 1-3s, medium (5-30 min): 2-8s, long (> 30 min): 2-15s
            if (this.running && !wc.abortController.signal.aborted) {
              const durationMin = STRESS_DURATION_MS / 60_000;
              const minDelay = durationMin < 5 ? 1000 : 2000;
              const maxDelay = durationMin < 5 ? 3000 : durationMin < 30 ? 8000 : 15000;
              await wc.page.waitForTimeout(minDelay + Math.random() * (maxDelay - minDelay));
            }
          } catch (err) {
            const duration = Date.now() - start;
            const screenshot = await this.captureScreenshot(wc);
            const error = this.buildError(wc, step, err, screenshot);

            this.errors.push(error);
            this.onError?.(error);

            wc.state.errorCount++;
            wc.state.lastError = error.error;
            wc.state.lastErrorAt = new Date();

            this.recordStep(wc, {
              stepId: step.id,
              stepName: step.name,
              success: false,
              durationMs: duration,
              error: error.error,
              screenshot,
            });

            // On failure: break out of this loop iteration, start next iteration
            completedAllSteps = false;
            break;
          }
        }

        // Brief pause between loop iterations
        if (this.running && !wc.abortController.signal.aborted) {
          // Shorter pause if we broke out early (error recovery), longer if full loop
          const pauseMs = completedAllSteps ? 3000 : 1000;
          await wc.page.waitForTimeout(pauseMs);
        }
      } catch (outerErr) {
        // Catastrophic failure — page may be in a bad state
        this.log(
          `[W${wc.user.workerId}] Catastrophic error in loop ${wc.state.loopCount}: ${this.extractMessage(outerErr)}`,
        );
        wc.state.status = 'failed';

        // Cooldown before retry — try to recover by navigating to a known page
        try {
          await wc.page.waitForTimeout(5000);
          await wc.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
          wc.state.status = 'running';
        } catch {
          // If we can't even navigate, try recreating the page
          try {
            await wc.page.close();
            wc.page = await wc.context.newPage();
            await this.authenticate(wc.context, wc.page, wc.user);
            wc.state.status = 'running';
            this.log(`[W${wc.user.workerId}] Recovered with new page`);
          } catch (recreateErr) {
            this.log(
              `[W${wc.user.workerId}] Could not recover: ${this.extractMessage(recreateErr)}. Worker is dead.`,
            );
            wc.state.status = 'failed';
            return; // Exit the loop — this worker is done
          }
        }
      }
    }

    wc.state.status = 'completed';
    wc.state.currentStep = '';
    this.log(`[W${wc.user.workerId}] Loop exited (${wc.state.loopCount} iterations, ${wc.state.errorCount} errors)`);
  }

  // -----------------------------------------------------------------------
  // Workflow assignment
  // -----------------------------------------------------------------------

  private getWorkflow(user: TestUser): Workflow {
    switch (user.role) {
      case 'production-worker':
        return user.team === 'alpha'
          ? getProductionAlphaWorkflow()
          : getProductionBravoWorkflow();
      case 'engineer':
        return getEngineerWorkflow();
      case 'manager':
        return getManagerWorkflow();
      case 'office':
        return getOfficeWorkflow();
      case 'admin':
        return getAdminWorkflow();
    }
  }

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  private async authenticate(
    context: BrowserContext,
    page: Page,
    user: TestUser,
  ): Promise<void> {
    // Use context.request (APIRequestContext) instead of page.request to avoid
    // corrupting the page's CDP session — page.request.post goes through the
    // page's protocol session and can leave it in a bad state.
    const response = await context.request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: user.email, password: user.password },
    });

    if (!response.ok()) {
      const status = response.status();
      const text = await response.text().catch(() => '');
      throw new Error(
        `Auth failed for ${user.email}: ${status} ${text}`,
      );
    }

    const body = await response.json();

    // addInitScript runs on every new page/navigation in this context,
    // ensuring tokens persist across navigations
    await context.addInitScript(
      (data: { token: string; user: unknown }) => {
        localStorage.setItem('qbe-token', data.token);
        localStorage.setItem('qbe-user', JSON.stringify(data.user));
      },
      { token: body.token, user: body.user },
    );

    // Navigate to the app root — baseURL is set on the context so '/' works.
    // This scopes localStorage to the correct origin.
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Set tokens directly for this first load (addInitScript fires on future navigations)
    await page.evaluate(
      (data: { token: string; user: unknown }) => {
        localStorage.setItem('qbe-token', data.token);
        localStorage.setItem('qbe-user', JSON.stringify(data.user));
      },
      { token: body.token, user: body.user },
    );

    // Reload to pick up the token — Angular's auth guard reads localStorage on init
    await page.reload({ waitUntil: 'load', timeout: 30000 });

    // Wait for the app shell to appear
    await page.waitForSelector('app-sidebar, .nav-item, app-header', {
      timeout: 15000,
    }).catch(() => {});

    // Permanently dismiss onboarding: click "Skip onboarding" then confirm "Yes, mark as onboarded"
    const skipBtn = page.locator('button', { hasText: /skip onboarding/i }).first();
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use DOM click to avoid tooltip interception
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const skip = btns.find(b => /skip onboarding/i.test(b.textContent ?? ''));
        if (skip) skip.click();
      });
      await page.waitForTimeout(500);

      // Confirm the bypass
      const confirmBtn = page.locator('button', { hasText: /yes.*mark.*onboarded/i }).first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      } else {
        // If confirm doesn't appear, just dismiss the banner
        const dismissBtn = page.locator('.onboarding-banner__dismiss').first();
        if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await dismissBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }

    // Clear any lingering tooltips or overlay backdrops
    await clearOverlayBackdrops(page).catch(() => {});
  }

  // -----------------------------------------------------------------------
  // Metrics recording
  // -----------------------------------------------------------------------

  private recordStep(wc: WorkerContext, result: StepResult): void {
    wc.state.stepCount++;
    this.allResponseTimes.push(result.durationMs);

    // Update per-worker average response time (running average)
    const prevTotal = wc.state.avgResponseMs * (wc.state.stepCount - 1);
    wc.state.avgResponseMs = Math.round((prevTotal + result.durationMs) / wc.state.stepCount);

    // Track 409 conflicts and deadlocks from error messages
    if (!result.success && result.error) {
      if (result.error.includes('409') || result.error.toLowerCase().includes('conflict')) {
        this.metrics.conflicts409++;
      }
      if (result.error.toLowerCase().includes('deadlock')) {
        this.metrics.deadlocks++;
      }
    }

    // Track data creation
    if (result.dataCreated) {
      wc.state.dataCreated[result.dataCreated] = (wc.state.dataCreated[result.dataCreated] || 0) + 1;
      this.log(`[W${wc.user.workerId}] ✓ Created ${result.dataCreated}`);
    }

    // Update global counters
    this.metrics.totalActions++;
    if (!result.success) {
      this.metrics.totalErrors++;
    }
  }

  private refreshAggregateMetrics(): void {
    // Recalculate from worker states
    this.metrics.totalLoops = 0;
    this.metrics.signalrEvents = 0;
    this.metrics.chatMessages = 0;

    for (const [, wc] of this.workers) {
      this.metrics.totalLoops += wc.state.loopCount;
      this.metrics.signalrEvents += wc.state.signalrEvents;
      this.metrics.chatMessages += wc.state.chatMessages;
    }

    // Calculate percentiles from all response times
    if (this.allResponseTimes.length > 0) {
      const sorted = [...this.allResponseTimes].sort((a, b) => a - b);
      const len = sorted.length;

      this.metrics.avgResponseMs = Math.round(
        sorted.reduce((sum, v) => sum + v, 0) / len,
      );
      this.metrics.p95ResponseMs = sorted[Math.floor(len * 0.95)] ?? 0;
      this.metrics.p99ResponseMs = sorted[Math.floor(len * 0.99)] ?? 0;
    }

    // Sync the workers array (may have changed references)
    this.metrics.workers = Array.from(this.workers.values()).map((wc) => wc.state);
  }

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  private async captureScreenshot(wc: WorkerContext): Promise<string> {
    const filename = `e2e/stress/errors/w${wc.user.workerId}-${Date.now()}.png`;
    try {
      await wc.page.screenshot({ path: filename, fullPage: false });
    } catch {
      // Page may be in an unrecoverable state — screenshot is best-effort
      return '';
    }
    return filename;
  }

  private buildError(
    wc: WorkerContext,
    step: WorkflowStep,
    err: unknown,
    screenshot: string,
  ): WorkflowError {
    const message = this.extractMessage(err);
    const stack = err instanceof Error ? err.stack : undefined;

    return {
      workerId: wc.user.workerId,
      email: wc.user.email,
      stepId: step.id,
      stepName: step.name,
      script: wc.state.currentScript,
      error: message,
      stack,
      screenshot: screenshot || undefined,
      timestamp: new Date(),
      loopNumber: wc.state.loopCount,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private createEmptyMetrics(): StressMetrics {
    return {
      totalActions: 0,
      totalErrors: 0,
      totalLoops: 0,
      signalrEvents: 0,
      chatMessages: 0,
      notificationsSent: 0,
      conflicts409: 0,
      deadlocks: 0,
      avgResponseMs: 0,
      p95ResponseMs: 0,
      p99ResponseMs: 0,
      startedAt: new Date(),
      workers: [],
    };
  }

  private extractMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString().slice(11, 23);
    const formatted = `[stress ${timestamp}] ${message}`;
    console.log(formatted);
    this.onEvent?.(formatted);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
