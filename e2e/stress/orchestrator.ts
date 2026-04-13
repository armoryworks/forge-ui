import { chromium, Browser, BrowserContext, Page } from 'playwright';

import { STRESS_USERS, BASE_URL, API_URL, STRESS_DURATION_MS, TestUser } from '../lib/fixtures';
import { StressMetrics, WorkerState, WorkflowError, StepResult } from '../lib/types';

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

export interface WorkflowStep {
  id: string;
  name: string;
  execute: (page: Page) => Promise<void>;
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
    this.browser = await chromium.launch({ headless: true });
    this.running = true;
    this.metrics = this.createEmptyMetrics();
    this.errors = [];
    this.allResponseTimes = [];

    // Authenticate and launch each worker with a 500ms stagger
    const workerPromises: Promise<void>[] = [];

    for (let i = 0; i < STRESS_USERS.length; i++) {
      const user = STRESS_USERS[i];

      // Stagger: wait 500ms between each worker launch
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

    // Give workers a moment to finish their current step
    await this.delay(2000);

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
    };

    const wc: WorkerContext = {
      user,
      context,
      page,
      state,
      abortController: new AbortController(),
    };

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

      try {
        let completedAllSteps = true;

        for (const step of workflow.steps) {
          // Check stop conditions before each step
          if (!this.running || wc.abortController.signal.aborted) {
            completedAllSteps = false;
            break;
          }

          wc.state.currentStep = `${step.id} ${step.name}`;
          const start = Date.now();

          try {
            await step.execute(wc.page);
            const duration = Date.now() - start;

            this.recordStep(wc, {
              stepId: step.id,
              stepName: step.name,
              success: true,
              durationMs: duration,
            });

            // Random delay between steps (2-15 seconds to simulate human pace)
            if (this.running && !wc.abortController.signal.aborted) {
              await wc.page.waitForTimeout(2000 + Math.random() * 13000);
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
          await wc.page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
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
    const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
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

    // Navigate to the app so localStorage is scoped to the correct origin
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Also set directly (addInitScript only fires on future navigations)
    await page.evaluate(
      (data: { token: string; user: unknown }) => {
        localStorage.setItem('qbe-token', data.token);
        localStorage.setItem('qbe-user', JSON.stringify(data.user));
      },
      { token: body.token, user: body.user },
    );
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
