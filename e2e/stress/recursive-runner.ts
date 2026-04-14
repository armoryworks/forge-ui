/**
 * Recursive stress test runner.
 *
 * Runs N iterations of: stress test (3 min) → screenshot capture → findings log.
 * Findings are accumulated in a JSON file for later review.
 *
 * Usage:
 *   npx ts-node e2e/stress/recursive-runner.ts [iterations=20]
 *   E2E_STRESS_DURATION=180000 npx ts-node e2e/stress/recursive-runner.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ITERATIONS = parseInt(process.argv[2] || '20', 10);
const STRESS_DURATION = process.env.E2E_STRESS_DURATION || '180000'; // 3 minutes
const outDir = path.join(__dirname, 'recursive-results');
fs.mkdirSync(outDir, { recursive: true });

interface RunResult {
  iteration: number;
  runId: string;
  stressTestExitCode: number;
  stressTestOutput: string;
  screenshotsCaptured: number;
  screenshotsFailed: number;
  metricsFile: string | null;
  errorsFile: string | null;
  timestamp: string;
}

const allResults: RunResult[] = [];

function findLatestFile(dir: string, prefix: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix)).sort().reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  QB Engineer Recursive Stress Test`);
  console.log(`  Iterations: ${ITERATIONS}`);
  console.log(`  Duration per run: ${parseInt(STRESS_DURATION) / 1000}s`);
  console.log(`${'='.repeat(60)}\n`);

  for (let i = 1; i <= ITERATIONS; i++) {
    const runId = `iter-${i}-${Date.now()}`;
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Iteration ${i}/${ITERATIONS} — ${runId}`);
    console.log(`${'─'.repeat(60)}\n`);

    // Step 1: Run stress test
    let stressOutput = '';
    let stressExitCode = 0;
    try {
      stressOutput = execSync(
        `npx ts-node e2e/stress/run.ts`,
        {
          cwd: path.join(__dirname, '..', '..'),
          env: { ...process.env, E2E_STRESS_DURATION: STRESS_DURATION, E2E_MAX_WORKERS: '20' },
          encoding: 'utf-8',
          timeout: 600_000, // 10 min max
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
    } catch (err: unknown) {
      const execErr = err as { status?: number; stdout?: string; stderr?: string };
      stressExitCode = execErr.status ?? 1;
      stressOutput = (execErr.stdout ?? '') + '\n' + (execErr.stderr ?? '');
    }

    // Save stress output
    const stressLogPath = path.join(outDir, `${runId}-stress.log`);
    fs.writeFileSync(stressLogPath, stressOutput);
    console.log(`  Stress test exit code: ${stressExitCode}`);

    // Step 2: Capture screenshots
    let screenshotsCaptured = 0;
    let screenshotsFailed = 0;
    try {
      const ssOutput = execSync(
        `npx ts-node e2e/stress/capture-screenshots.ts ${runId}`,
        {
          cwd: path.join(__dirname, '..', '..'),
          encoding: 'utf-8',
          timeout: 300_000, // 5 min max
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      // Parse captured/failed counts from output
      const match = ssOutput.match(/Done: (\d+) captured, (\d+) failed/);
      if (match) {
        screenshotsCaptured = parseInt(match[1]);
        screenshotsFailed = parseInt(match[2]);
      }
      fs.writeFileSync(path.join(outDir, `${runId}-screenshots.log`), ssOutput);
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string };
      console.log(`  Screenshot capture error: ${(execErr.stderr ?? '').slice(0, 100)}`);
      fs.writeFileSync(path.join(outDir, `${runId}-screenshots.log`), (execErr.stdout ?? '') + '\n' + (execErr.stderr ?? ''));
    }

    // Find metrics/errors files
    const metricsFile = findLatestFile(path.join(__dirname, 'metrics'), 'metrics-');
    const errorsFile = findLatestFile(path.join(__dirname, 'errors'), 'errors-');

    const result: RunResult = {
      iteration: i,
      runId,
      stressTestExitCode: stressExitCode,
      stressTestOutput: stressOutput.slice(-2000), // last 2KB
      screenshotsCaptured,
      screenshotsFailed,
      metricsFile,
      errorsFile,
      timestamp: new Date().toISOString(),
    };

    allResults.push(result);

    // Save cumulative results
    const resultsPath = path.join(outDir, 'all-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));

    console.log(`  Screenshots: ${screenshotsCaptured} ok, ${screenshotsFailed} failed`);
    console.log(`  Results saved to ${resultsPath}`);

    // Brief pause between iterations
    if (i < ITERATIONS) {
      console.log(`  Waiting 5s before next iteration...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  COMPLETE — ${ITERATIONS} iterations`);
  console.log(`${'='.repeat(60)}`);

  const totalErrors = allResults.filter(r => r.stressTestExitCode !== 0).length;
  console.log(`  Successful runs: ${ITERATIONS - totalErrors}/${ITERATIONS}`);
  console.log(`  Failed runs: ${totalErrors}/${ITERATIONS}`);
  console.log(`  Results: ${path.join(outDir, 'all-results.json')}`);
  console.log(`  Screenshots: ${path.join(__dirname, 'screenshots')}/`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
