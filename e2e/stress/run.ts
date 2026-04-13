/**
 * Stress test entry point.
 *
 * Launches 20 concurrent browser contexts simulating a full shop floor:
 *   - 7 Alpha team production workers (Production track)
 *   - 7 Bravo team production workers (Maintenance track)
 *   - 2 Engineers
 *   - 2 Managers
 *   - 1 Office/Sales
 *   - 1 Admin
 *
 * Usage:
 *   npm run stress                        # 90-minute default
 *   E2E_STRESS_DURATION=600000 npm run stress  # 10-minute quick run
 *   E2E_BASE_URL=http://192.168.1.10:4200 npm run stress
 */

import { StressOrchestrator } from './orchestrator';
import { ConsoleUI } from './console-ui';
import { STRESS_DURATION_MS } from '../lib/fixtures';

import * as fs from 'fs';
import * as path from 'path';

// Ensure output directories exist
const errorDir = path.join(__dirname, 'errors');
const metricsDir = path.join(__dirname, 'metrics');
fs.mkdirSync(errorDir, { recursive: true });
fs.mkdirSync(metricsDir, { recursive: true });

// Suppress unhandled rejections from Playwright calls that fire during shutdown
// (e.g., page.keyboard.press after browser.close). These are expected and harmless.
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (msg.includes('has been closed') || msg.includes('Target closed') || msg.includes('disposed')) {
    // Expected during graceful shutdown — swallow
    return;
  }
  console.error('Unhandled rejection:', reason);
});

// ── Bootstrap ───────────────────────────────────────────────────────

const ui = new ConsoleUI(STRESS_DURATION_MS);

const orchestrator = new StressOrchestrator({
  onUpdate: (metrics) => {
    ui.updateMetrics(metrics);
  },
  onError: (error) => {
    const shortMsg = `[W${error.workerId}] ${error.stepName}: ${error.error.slice(0, 80)}`;
    ui.addEvent(shortMsg);
  },
  onEvent: (message) => {
    // Strip the timestamp prefix that orchestrator already adds
    const stripped = message.replace(/^\[stress [^\]]+\]\s*/, '');
    ui.addEvent(stripped);
  },
});

// Graceful shutdown on Ctrl+C
process.on('SIGINT', async () => {
  ui.addEvent('SIGINT received — shutting down gracefully...');
  await orchestrator.stop();
  ui.stop();
  saveMetricsReport();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await orchestrator.stop();
  ui.stop();
  saveMetricsReport();
  process.exit(0);
});

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Starting QB Engineer Stress Test...');
  console.log(`Duration: ${Math.round(STRESS_DURATION_MS / 60_000)} minutes`);
  console.log('Press Ctrl+C to stop early.\n');

  ui.start();

  try {
    await orchestrator.start();
  } catch (err) {
    console.error('Orchestrator failed:', err);
  }

  ui.stop();
  saveMetricsReport();

  const metrics = orchestrator.getMetrics();
  const errors = orchestrator.getErrors();

  // Exit with non-zero if there were critical failures (> 20% error rate)
  if (metrics.totalActions > 0) {
    const errorRate = metrics.totalErrors / metrics.totalActions;
    if (errorRate > 0.2) {
      console.log(`\nError rate ${(errorRate * 100).toFixed(1)}% exceeds 20% threshold.`);
      process.exit(1);
    }
  }

  // Save error details
  if (errors.length > 0) {
    const errorLogPath = path.join(errorDir, `errors-${Date.now()}.json`);
    fs.writeFileSync(errorLogPath, JSON.stringify(errors, null, 2));
    console.log(`Error log saved to: ${errorLogPath}`);
  }

  process.exit(0);
}

function saveMetricsReport(): void {
  const metrics = orchestrator.getMetrics();
  const reportPath = path.join(metricsDir, `metrics-${Date.now()}.json`);

  const report = {
    ...metrics,
    startedAt: metrics.startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: Date.now() - metrics.startedAt.getTime(),
    workers: metrics.workers.map((w) => ({
      ...w,
      startedAt: w.startedAt.toISOString(),
      lastErrorAt: w.lastErrorAt?.toISOString() ?? null,
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Metrics saved to: ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
