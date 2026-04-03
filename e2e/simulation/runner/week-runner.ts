import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { setSimulatedClock, resetClock } from '../helpers/clock.helper';
import { createSimContext, closeSimContext, type SimRole } from '../helpers/sim-context.helper';
import { getAuthToken } from '../../helpers/auth.helper';
import type { WeekContext, WeekResult, SimulationReport } from '../types/simulation.types';

// ── Configuration ───────────────────────────────────────────────────────────
const SIM_START = new Date('2024-01-01T00:00:00Z');
const SIM_END   = new Date();  // today
const ROLES: SimRole[] = ['admin', 'engineer', 'pm', 'manager', 'office', 'worker'];
const ROLE_PASSWORDS: Record<SimRole, string> = {
  admin: 'Admin123!', engineer: 'Engineer123!', pm: 'Engineer123!',
  manager: 'Engineer123!', office: 'Engineer123!', worker: 'Engineer123!',
};
const ROLE_EMAILS: Record<SimRole, string> = {
  admin:    'admin@qbengineer.local',
  engineer: 'akim@qbengineer.local',
  pm:       'pmorris@qbengineer.local',
  manager:  'lwilson@qbengineer.local',
  office:   'cthompson@qbengineer.local',
  worker:   'bkelly@qbengineer.local',
};

// ── Week helpers ─────────────────────────────────────────────────────────────
function getWeeks(start: Date, end: Date): Array<{ start: Date; end: Date; index: number; label: string }> {
  const weeks = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  // Advance to Monday
  const day = cursor.getUTCDay();
  if (day !== 1) cursor.setUTCDate(cursor.getUTCDate() + ((8 - day) % 7));

  let index = 0;
  while (cursor <= end) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    const weekNum = Math.ceil(
      (weekStart.getUTCDate() - weekStart.getUTCDay() + 10) / 7,
    );
    const label = `${weekStart.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    weeks.push({ start: weekStart, end: weekEnd, index, label });

    cursor.setUTCDate(cursor.getUTCDate() + 7);
    index++;
  }
  return weeks;
}

// ── Dynamic scenario import ──────────────────────────────────────────────────
async function runWeekScenario(ctx: WeekContext): Promise<WeekResult> {
  // Dynamically import the week scenario module (avoids circular deps)
  const { runWeek } = await import('../scenarios/week-scenario');
  return runWeek(ctx);
}

// ── Main runner ──────────────────────────────────────────────────────────────
async function runSimulation(): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`QB Engineer UI Simulation`);
  console.log(`Range: ${SIM_START.toISOString().slice(0, 10)} → ${SIM_END.toISOString().slice(0, 10)}`);
  console.log(`${'═'.repeat(60)}\n`);

  const weeks = getWeeks(SIM_START, SIM_END);
  console.log(`Total weeks to simulate: ${weeks.length}\n`);

  const report: SimulationReport = {
    startedAt: new Date().toISOString(),
    completedAt: '',
    totalWeeks: weeks.length,
    totalActions: 0,
    totalErrors: 0,
    weeks: [],
  };

  // Pre-authenticate all roles once (tokens are long-lived in dev)
  console.log('Authenticating simulation users...');
  const tokens: Record<string, string> = {};
  for (const role of ROLES) {
    try {
      tokens[ROLE_EMAILS[role]] = await getAuthToken(ROLE_EMAILS[role], ROLE_PASSWORDS[role]);
      console.log(`  ✓ ${role} (${ROLE_EMAILS[role]})`);
    } catch (err) {
      console.error(`  ✗ ${role}: ${err}`);
    }
  }
  console.log('');

  for (const week of weeks) {
    const weekStart = Date.now();
    console.log(`\n─── ${week.label} (${week.start.toISOString().slice(0, 10)}) ───`);

    // Set server clock to start of this week
    try {
      await setSimulatedClock(week.start);
    } catch (err) {
      console.error(`  Failed to set clock: ${err} — skipping week`);
      continue;
    }

    const ctx: WeekContext = {
      weekStart: week.start,
      weekEnd: week.end,
      weekIndex: week.index,
      weekLabel: week.label,
      tokens,
    };

    let result: WeekResult;
    try {
      result = await runWeekScenario(ctx);
    } catch (err) {
      result = {
        weekLabel: week.label,
        weekStart: week.start.toISOString(),
        actionsAttempted: 0,
        actionsSucceeded: 0,
        errors: [{ label: 'week-scenario', error: String(err), timestamp: new Date().toISOString() }],
        durationMs: Date.now() - weekStart,
      };
    }

    result.durationMs = Date.now() - weekStart;
    report.weeks.push(result);
    report.totalActions += result.actionsAttempted;
    report.totalErrors += result.errors.length;

    console.log(`  Actions: ${result.actionsSucceeded}/${result.actionsAttempted} succeeded, ${result.errors.length} errors (${result.durationMs}ms)`);
  }

  // Reset clock to real time
  try { await resetClock(); } catch { /* ignore */ }

  report.completedAt = new Date().toISOString();

  // Write report
  const reportDir = path.join(__dirname, '..', '..', 'playwright-report', 'simulation');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'simulation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Simulation complete`);
  console.log(`Total weeks: ${report.totalWeeks}`);
  console.log(`Total actions: ${report.totalActions} (${report.totalErrors} errors)`);
  console.log(`Report: ${reportPath}`);
  console.log(`${'═'.repeat(60)}\n`);
}

runSimulation().catch(console.error);
