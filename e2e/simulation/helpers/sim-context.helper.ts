import { type Browser, type BrowserContext, type Page, chromium } from '@playwright/test';
import { loginViaApi, seedAuth } from '../../helpers/auth.helper';

export type SimRole = 'admin' | 'engineer' | 'pm' | 'manager' | 'office' | 'worker';

const SEED_PASSWORD = process.env['SEED_USER_PASSWORD'] ?? 'Test1234!';

const ROLE_CREDENTIALS: Record<SimRole, { email: string; password: string }> = {
  admin:    { email: 'admin@qbengineer.local',    password: SEED_PASSWORD },
  engineer: { email: 'akim@qbengineer.local',     password: SEED_PASSWORD },
  pm:       { email: 'pmorris@qbengineer.local',  password: SEED_PASSWORD },
  manager:  { email: 'lwilson@qbengineer.local',  password: SEED_PASSWORD },
  office:   { email: 'cthompson@qbengineer.local', password: SEED_PASSWORD },
  worker:   { email: 'bkelly@qbengineer.local',   password: SEED_PASSWORD },
};

export interface SimContext {
  role: SimRole;
  context: BrowserContext;
  page: Page;
  email: string;
}

/**
 * Creates an authenticated browser context for the given role.
 * Each role gets its own isolated context (separate cookies/localStorage).
 * If a pre-fetched session is provided it is used directly (no additional API login).
 */
export async function createSimContext(
  browser: Browser,
  role: SimRole,
  session?: { token: string; user: { id: number; email: string; firstName: string; lastName: string; initials: string | null; avatarColor: string | null; roles: string[] } },
): Promise<SimContext> {
  const creds = ROLE_CREDENTIALS[role];
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  if (session) {
    await seedAuth(page, session);
  } else {
    await loginViaApi(page, creds.email, creds.password);
  }
  return { role, context, page, email: creds.email };
}

/**
 * Closes the browser context, ignoring errors (page may already be closed).
 */
export async function closeSimContext(ctx: SimContext): Promise<void> {
  try { await ctx.context.close(); } catch { /* ignore */ }
}

/**
 * Wraps a UI action so failures are logged but do not throw.
 * Returns true if the action succeeded, false if it failed.
 */
export async function tryAction(
  label: string,
  action: () => Promise<void>,
  errorLog: SimError[],
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorLog.push({ label, error: message, timestamp: new Date().toISOString() });
    console.error(`  [FAIL] ${label}: ${message}`);
    return false;
  }
}

export interface SimError {
  label: string;
  error: string;
  timestamp: string;
}
