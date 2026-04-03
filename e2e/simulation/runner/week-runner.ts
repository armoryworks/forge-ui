import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { setSimulatedClock, resetClock } from '../helpers/clock.helper';
import { type SimRole, createSimContext } from '../helpers/sim-context.helper';
import { getAuthSession } from '../../helpers/auth.helper';
import type { WeekContext, WeekResult, SimulationReport } from '../types/simulation.types';
import { runWeek } from '../scenarios/week-scenario';

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

// ── Main runner ──────────────────────────────────────────────────────────────
export async function runSimulation(): Promise<SimulationReport> {
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

  // ── Pre-authenticate all roles — one API call each, reuse for both token + browser ─
  console.log('Authenticating simulation users...');
  const tokens: Record<string, string> = {};
  const sessions: Record<SimRole, { token: string; user: any } | null> = {} as any;

  for (const role of ROLES) {
    try {
      const session = await getAuthSession(ROLE_EMAILS[role], ROLE_PASSWORDS[role]);
      tokens[ROLE_EMAILS[role]] = session.token;
      sessions[role] = session;
      console.log(`  ✓ ${role} (${ROLE_EMAILS[role]})`);
    } catch (err) {
      console.error(`  ✗ ${role}: ${err}`);
      sessions[role] = null;
    }
  }
  console.log('');

  // ── Launch browser and create one authenticated page per role ─────────────
  console.log('Launching browser and seeding role pages...');
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
  });
  const pages: Record<string, Page> = {};

  async function ensurePage(role: SimRole): Promise<void> {
    const email = ROLE_EMAILS[role];
    const existing = pages[email];
    if (existing && !existing.isClosed()) return;
    try {
      const simCtx = await createSimContext(browser, role, sessions[role] ?? undefined);
      pages[email] = simCtx.page;
    } catch (err) {
      console.error(`  ✗ recreate page for ${role}: ${err}`);
    }
  }

  for (const role of ROLES) {
    try {
      const simCtx = await createSimContext(browser, role, sessions[role] ?? undefined);
      pages[ROLE_EMAILS[role]] = simCtx.page;
      console.log(`  ✓ browser page: ${role}`);
    } catch (err) {
      console.error(`  ✗ browser page for ${role}: ${err}`);
    }
  }
  console.log('');

  // ── Week loop ─────────────────────────────────────────────────────────────
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

    // Recover any crashed pages before starting the week
    for (const role of ROLES) {
      await ensurePage(role);
    }

    const ctx: WeekContext = {
      weekStart: week.start,
      weekEnd: week.end,
      weekIndex: week.index,
      weekLabel: week.label,
      tokens,
      pages,
    };

    let result: WeekResult;
    try {
      result = await runWeek(ctx);
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

  // ── Teardown ──────────────────────────────────────────────────────────────
  try { await resetClock(); } catch { /* ignore */ }
  await browser.close();

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

  return report;
}
