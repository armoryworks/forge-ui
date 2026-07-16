import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { setSimulatedClock, resetClock } from '../helpers/clock.helper';
import { type SimRole, createSimContext, ensureUserOnboarded, bypassOnboardingViaUI, logProgress } from '../helpers/sim-context.helper';
import { getAuthSession } from '../../helpers/auth.helper';
import type { WeekContext, WeekResult, SimulationReport } from '../types/simulation.types';
import { runWeek } from '../scenarios/week-scenario';
import { runWeekApi } from '../scenarios/week-scenario-api';
import { runWeekNarrative } from '../scenarios/week-scenario-narrative';

// ── Configuration ───────────────────────────────────────────────────────────
const SIM_START = new Date(process.env['SIM_START'] ?? '2018-01-01T00:00:00Z');
const SIM_END   = new Date(process.env['SIM_END'] ?? new Date().toISOString());
const RESUME    = (process.env['SIM_RESUME'] ?? 'true').toLowerCase() !== 'false';

/**
 * SIM_MODE controls how weeks are selected:
 *   full   — run every week from SIM_START to SIM_END
 *   resume — skip weeks that already have data, run from last data point forward
 *   gaps   — query DB for coverage, only run weeks with no data (gaps > 1 week)
 *   range  — run SIM_START to SIM_END exactly (set both via env vars)
 *   api    — like 'full' but uses API-direct scenario (fast, no browser needed)
 */
const SIM_MODE = (process.env['SIM_MODE'] ?? 'full') as 'full' | 'resume' | 'gaps' | 'range' | 'api' | 'narrative';

/** When true, use an API-direct scenario (no browser). Both 'api' and 'narrative' are browser-less. */
const USE_API = SIM_MODE === 'api' || SIM_MODE === 'narrative' || (process.env['SIM_API'] ?? 'false').toLowerCase() === 'true';

const ROLES: SimRole[] = ['admin', 'engineer', 'pm', 'manager', 'office', 'worker'];
const SEED_PASSWORD = process.env['SEED_USER_PASSWORD'] ?? 'Test1234!';
const ROLE_PASSWORDS: Record<SimRole, string> = {
  admin: SEED_PASSWORD, engineer: SEED_PASSWORD, pm: SEED_PASSWORD,
  manager: SEED_PASSWORD, office: SEED_PASSWORD, worker: SEED_PASSWORD,
};
const ROLE_EMAILS: Record<SimRole, string> = {
  admin:    'admin@forge.local',
  engineer: 'akim@forge.local',
  pm:       'pmorris@forge.local',
  manager:  'lwilson@forge.local',
  office:   'cthompson@forge.local',
  worker:   'bkelly@forge.local',
};

/**
 * Discover background seed users dynamically from the admin roster.
 *
 * Why dynamic: the DB can grow between runs (admin-created users, imports, new seed rows).
 * Any user who can log in (has a password) and isn't one of the 6 core simulation drivers
 * should have their onboarding bypassed so the admin compliance view reads 8/8 across
 * the workforce — otherwise most of the list sits at 0/8 with no real signal.
 *
 * Filters applied:
 *   • Skip core role emails (they drive the full wizard)
 *   • Skip users without passwords (pending setup tokens → login would 401)
 *   • Skip inactive users (soft-deleted or disabled)
 */
async function discoverBackgroundUsers(adminToken: string): Promise<string[]> {
  const { apiCall } = await import('../helpers/api.helper');
  const users = await apiCall<Array<{
    email: string;
    isActive: boolean;
    hasPassword: boolean;
    hasPendingSetupToken: boolean;
  }>>('GET', 'admin/users', adminToken);
  if (!users) return [];
  const coreEmails = new Set(Object.values(ROLE_EMAILS));
  return users
    .filter(u => u.isActive && u.hasPassword && !coreEmails.has(u.email))
    .map(u => u.email)
    .sort();
}

// ── Resume / gap detection ──────────────────────────────────────────────────
/**
 * Queries the API for the latest created_at across simulation-era entities.
 * Returns the Monday of the week AFTER the latest data, or null if no data.
 */
async function detectResumeWeek(token: string): Promise<Date | null> {
  const { apiCall } = await import('../helpers/api.helper');

  const leads = await apiCall<{ data: Array<{ createdAt: string }> }>('GET', 'leads?pageSize=500', token);
  const allLeads = leads?.data ?? [];
  if (allLeads.length === 0) return null;

  let latest: Date | null = null;
  for (const lead of allLeads) {
    const d = new Date(lead.createdAt);
    if (d >= SIM_START && (!latest || d > latest)) latest = d;
  }
  if (!latest) return null;

  const resume = new Date(latest);
  const day = resume.getUTCDay();
  resume.setUTCDate(resume.getUTCDate() + ((8 - day) % 7 || 7));
  resume.setUTCHours(0, 0, 0, 0);
  return resume;
}

/**
 * Detects weeks with no entity data (gaps > 1 week).
 * Queries leads + expenses (the two most reliably created entities)
 * and returns a Set of week labels that have zero records.
 */
async function detectGapWeeks(
  token: string,
  allWeeks: Array<{ start: Date; end: Date; label: string }>,
): Promise<Set<string>> {
  const { apiCall } = await import('../helpers/api.helper');

  // Fetch all leads and expenses to build a coverage map
  const [leadsResp, expensesResp] = await Promise.all([
    apiCall<{ data: Array<{ createdAt: string }> }>('GET', 'leads?pageSize=2000', token),
    apiCall<{ data: Array<{ createdAt: string }> }>('GET', 'expenses?pageSize=5000', token),
  ]);

  const coveredWeeks = new Set<string>();

  const checkEntity = (items: Array<{ createdAt: string }>) => {
    for (const item of items) {
      const d = new Date(item.createdAt);
      if (d < SIM_START) continue;
      // Find which week this falls in
      for (const week of allWeeks) {
        if (d >= week.start && d <= week.end) {
          coveredWeeks.add(week.label);
          break;
        }
      }
    }
  };

  checkEntity(leadsResp?.data ?? []);
  checkEntity(expensesResp?.data ?? []);

  // Gap weeks = all weeks NOT in coveredWeeks
  const gapWeeks = new Set<string>();
  for (const week of allWeeks) {
    if (!coveredWeeks.has(week.label)) {
      gapWeeks.add(week.label);
    }
  }

  return gapWeeks;
}

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
  console.log(`Forge Simulation (mode: ${SIM_MODE}, api: ${USE_API})`);
  console.log(`Range: ${SIM_START.toISOString().slice(0, 10)} → ${SIM_END.toISOString().slice(0, 10)}`);
  console.log(`${'═'.repeat(60)}\n`);

  const allWeeks = getWeeks(SIM_START, SIM_END);
  console.log(`Total weeks in range: ${allWeeks.length}\n`);

  const report: SimulationReport = {
    startedAt: new Date().toISOString(),
    completedAt: '',
    totalWeeks: allWeeks.length,
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

  // ── Week filtering by mode ──────────────────────────────────────────────
  let weeks = allWeeks;
  const adminToken = tokens['admin@forge.local'];

  if (SIM_MODE === 'resume' || (SIM_MODE !== 'gaps' && SIM_MODE !== 'range' && RESUME)) {
    if (adminToken) {
      const resumeFrom = await detectResumeWeek(adminToken);
      if (resumeFrom) {
        const skipped = allWeeks.filter(w => w.start < resumeFrom);
        weeks = allWeeks.filter(w => w.start >= resumeFrom);
        console.log(`Resume: last data ends before ${resumeFrom.toISOString().slice(0, 10)}`);
        console.log(`  Skipping ${skipped.length} completed weeks, ${weeks.length} remaining\n`);
      } else {
        console.log('Resume: no prior simulation data found, starting from beginning\n');
      }
    }
  } else if (SIM_MODE === 'gaps') {
    if (adminToken) {
      console.log('Detecting coverage gaps...');
      const gapLabels = await detectGapWeeks(adminToken, allWeeks);
      weeks = allWeeks.filter(w => gapLabels.has(w.label));
      console.log(`Found ${gapLabels.size} gap weeks out of ${allWeeks.length} total`);
      console.log(`  Running ${weeks.length} weeks to fill gaps\n`);
    }
  }
  // 'range' and 'api' modes just run allWeeks as-is (controlled by SIM_START/SIM_END env)

  // ── Launch browser (skip for API-only mode) ─────────────────────────────
  let browser: Browser | null = null;
  const pages: Record<string, Page> = {};

  async function ensurePage(role: SimRole): Promise<void> {
    if (!browser) return;
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

  if (!USE_API) {
    console.log('Launching browser and seeding role pages...');
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
    });

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

    // One-time per-user compliance: drive each seeded user through the full 7-step
    // onboarding wizard UI (Personal → Address → W-4 → State → I-9 w/ file upload →
    // Direct Deposit w/ file upload → Acknowledgments → Submit), then surrogate the
    // DocuSeal signing completion via POST /employee-profile/acknowledge/{formType}
    // for W-4/I-9/State (mirrors what HandleDocuSealWebhook does in production).
    // Emergency contact is set via PUT /employee-profile afterward. Idempotent.
    console.log('Driving each user through the full onboarding wizard...');
    for (const role of ROLES) {
      const email = ROLE_EMAILS[role];
      const page = pages[email];
      const token = tokens[email];
      if (!page || !token) continue;
      try {
        const ok = await ensureUserOnboarded(page, token);
        console.log(`  ${ok ? '✓' : '✗'} onboarded: ${role}`);
      } catch (err) {
        console.error(`  ✗ onboarding ${role}: ${err}`);
      }
    }
    console.log('');

    // ── Background users: bypass onboarding via UI ──────────────────────────
    // Each user gets a short-lived browser context: login via API + seed localStorage,
    // navigate to /dashboard, click "Skip onboarding" + confirm, close context.
    const backgroundUsers = await discoverBackgroundUsers(tokens[ROLE_EMAILS.admin]);
    console.log(`Bypassing onboarding for ${backgroundUsers.length} background seed users...`);
    for (const bgEmail of backgroundUsers) {
      try {
        const session = await getAuthSession(bgEmail, SEED_PASSWORD);
        const bgContext = await browser.newContext({ ignoreHTTPSErrors: true });
        const bgPage = await bgContext.newPage();
        const { seedAuth } = await import('../../helpers/auth.helper');
        await seedAuth(bgPage, session);
        const ok = await bypassOnboardingViaUI(bgPage, session.token, bgEmail);
        console.log(`  ${ok ? '✓' : '✗'} bypassed: ${bgEmail.split('@')[0]}`);
        await bgContext.close().catch(() => { /* ignore */ });
      } catch (err) {
        console.error(`  ✗ bypass ${bgEmail}: ${err}`);
      }
    }
    console.log('');
  } else {
    console.log('API-direct mode — skipping browser launch\n');
  }

  // ── Token refresh helper ──────────────────────────────────────────────────
  // Re-authenticate every week. seedAuth() only stores the access token in
  // localStorage (no refresh token), so if the interceptor ever hits a 401 and
  // tries /auth/refresh, it will fail → clearAuth() → redirect to /login.
  // Keeping tokens freshly minted each week prevents that failure mode entirely.
  const TOKEN_REFRESH_INTERVAL = 1;
  let weeksSinceRefresh = 0;

  async function refreshTokens(): Promise<void> {
    const { seedAuth } = await import('../../helpers/auth.helper');
    console.log('  Refreshing auth tokens...');
    for (const role of ROLES) {
      try {
        const session = await getAuthSession(ROLE_EMAILS[role], ROLE_PASSWORDS[role]);
        tokens[ROLE_EMAILS[role]] = session.token;
        sessions[role] = session;
        // Re-seed browser localStorage so UI pages use the fresh token.
        // Without this, UI pages are stuck with the token from initial context
        // creation — which is why workers were getting logged out mid-sim.
        const page = pages[ROLE_EMAILS[role]];
        if (page && !page.isClosed()) {
          try {
            await seedAuth(page, session);
          } catch (seedErr) {
            console.error(`  ✗ re-seed ${role}: ${seedErr}`);
          }
        }
      } catch (err) {
        console.error(`  ✗ token refresh for ${role}: ${err}`);
      }
    }
    weeksSinceRefresh = 0;
  }

  // ── Week loop ─────────────────────────────────────────────────────────────
  for (const week of weeks) {
    const weekStart = Date.now();
    console.log(`\n─── ${week.label} (${week.start.toISOString().slice(0, 10)}) ───`);
    logProgress(`\n─── ${week.label} (${week.start.toISOString().slice(0, 10)}) ───`);

    // Refresh tokens periodically to prevent JWT expiry during long runs
    if (weeksSinceRefresh >= TOKEN_REFRESH_INTERVAL) {
      await refreshTokens();
    }
    weeksSinceRefresh++;

    // Set server clock to start of this week. If 401, heal by re-logging in once
    // (server restart / session store cleared mid-run) and retry.
    try {
      await setSimulatedClock(week.start, tokens['admin@forge.local']);
    } catch (err) {
      const msg = String(err);
      if (msg.includes('401')) {
        console.warn('  setClock 401 — attempting session heal (re-login admin)');
        try {
          const session = await getAuthSession(ROLE_EMAILS['admin'], ROLE_PASSWORDS['admin']);
          tokens[ROLE_EMAILS['admin']] = session.token;
          sessions['admin'] = session;
          await setSimulatedClock(week.start, tokens['admin@forge.local']);
          console.log('  ✓ session healed');
        } catch (retryErr) {
          console.error(`  Failed to set clock after heal: ${retryErr} — skipping week`);
          continue;
        }
      } else {
        console.error(`  Failed to set clock: ${err} — skipping week`);
        continue;
      }
    }

    // Recover any crashed pages before starting the week (UI mode only)
    if (!USE_API) {
      for (const role of ROLES) {
        await ensurePage(role);
      }
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
    const WEEK_TIMEOUT_MS = 30 * 60_000; // 30 minutes max per week
    try {
      result = await Promise.race([
        SIM_MODE === 'narrative' ? runWeekNarrative(ctx) : USE_API ? runWeekApi(ctx) : runWeek(ctx),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Week timed out after ${WEEK_TIMEOUT_MS / 1000}s`)), WEEK_TIMEOUT_MS),
        ),
      ]);
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

    const summary = `  Actions: ${result.actionsSucceeded}/${result.actionsAttempted} succeeded, ${result.errors.length} errors (${result.durationMs}ms)`;
    console.log(summary);
    logProgress(summary);
  }

  // ── Teardown ──────────────────────────────────────────────────────────────
  try { await resetClock(tokens['admin@forge.local']); } catch { /* ignore */ }
  if (browser) await browser.close();

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
