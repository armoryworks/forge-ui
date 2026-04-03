/**
 * Playwright test entry point for the week-by-week simulation.
 *
 * Run with:
 *   npm run simulate              (headless)
 *   npm run simulate:headed       (headed, watch requests)
 *
 * This is a single long-running test. Playwright wraps it for reporting,
 * timeout management, and the HTML report. All week-level errors are
 * logged (not thrown) so the test always completes the full date range.
 */

import { test, expect } from '@playwright/test';
import { runSimulation } from '../runner/week-runner';

test('full simulation — 2024-01-01 to today', async () => {
  const report = await runSimulation();

  // Soft assertions — warn but don't fail the test on high error rates
  const errorRate = report.totalActions > 0
    ? report.totalErrors / report.totalActions
    : 0;

  console.log(`\nSimulation summary:`);
  console.log(`  Weeks:   ${report.totalWeeks}`);
  console.log(`  Actions: ${report.totalActions} (${report.totalErrors} errors, ${(errorRate * 100).toFixed(1)}% error rate)`);
  console.log(`  Duration: ${Math.round((new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime()) / 1000)}s`);

  // Fail only if > 50% of actions error (likely indicates a systemic problem)
  expect(errorRate, `Error rate ${(errorRate * 100).toFixed(1)}% exceeds 50% threshold`).toBeLessThan(0.5);
});
