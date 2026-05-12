import * as fs from 'fs';
import * as path from 'path';
import { type Browser, type BrowserContext, type Page, chromium } from '@playwright/test';
import { loginViaApi, seedAuth } from '../../helpers/auth.helper';

/** Real-time progress log file — bypasses Playwright output buffering */
const PROGRESS_LOG = path.join(__dirname, '..', '..', 'playwright-report', 'simulation-progress.log');
export function logProgress(msg: string): void {
  const dir = path.dirname(PROGRESS_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(PROGRESS_LOG, `${new Date().toISOString().slice(11, 19)} ${msg}\n`);
}

export type SimRole = 'admin' | 'engineer' | 'pm' | 'manager' | 'office' | 'worker';

const SEED_PASSWORD = process.env['SEED_USER_PASSWORD'] ?? 'Test1234!';

const ROLE_CREDENTIALS: Record<SimRole, { email: string; password: string }> = {
  admin:    { email: 'admin@forge.local',    password: SEED_PASSWORD },
  engineer: { email: 'akim@forge.local',     password: SEED_PASSWORD },
  pm:       { email: 'pmorris@forge.local',  password: SEED_PASSWORD },
  manager:  { email: 'lwilson@forge.local',  password: SEED_PASSWORD },
  office:   { email: 'cthompson@forge.local', password: SEED_PASSWORD },
  worker:   { email: 'bkelly@forge.local',   password: SEED_PASSWORD },
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
  // Clear IndexedDB drafts so the DraftRecoveryService doesn't show the recovery
  // prompt on the first auth-triggered load — the prompt sits as a modal
  // dialog-backdrop that intercepts every click until dismissed. Drafts from
  // prior simulation runs are stale residue, not part of the test subject.
  await page.evaluate(async () => {
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('forge-drafts');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    } catch { /* best effort */ }
  }).catch(() => { /* page may not have navigated yet */ });
  return { role, context, page, email: creds.email };
}

/**
 * Closes the browser context, ignoring errors (page may already be closed).
 */
export async function closeSimContext(ctx: SimContext): Promise<void> {
  try { await ctx.context.close(); } catch { /* ignore */ }
}

/** Per-action timeout (ms). Prevents a single hung action from blocking the entire week. */
const ACTION_TIMEOUT_MS = 60_000; // 60 seconds max per action

/**
 * Wraps a UI action so failures are logged but do not throw.
 * Returns true if the action succeeded, false if it failed.
 * Applies a hard timeout to prevent a single action from blocking the week.
 */
export async function tryAction(
  label: string,
  action: () => Promise<void>,
  errorLog: SimError[],
  page?: Page,
): Promise<boolean> {
  try {
    logProgress(`  START ${label}`);
    await Promise.race([
      action(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Action timed out after ${ACTION_TIMEOUT_MS}ms`)), ACTION_TIMEOUT_MS),
      ),
    ]);
    logProgress(`  OK    ${label}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorLog.push({ label, error: message, timestamp: new Date().toISOString() });
    const shortMsg = message.split('\n')[0].substring(0, 120);
    logProgress(`  FAIL  ${label}: ${shortMsg}`);
    console.error(`  [FAIL] ${label}: ${message}`);
    if (page) {
      try {
        const shotDir = path.join(__dirname, '..', '..', 'screenshots');
        if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
        const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
        await page.screenshot({ path: path.join(shotDir, `fail-${safeLabel}-${Date.now()}.png`), fullPage: false });
      } catch { /* best effort */ }
    }
    return false;
  }
}

export interface SimError {
  label: string;
  error: string;
  timestamp: string;
}

/**
 * Minimal valid PDF bytes — used as fixture content for I-9 identity document and
 * voided-check uploads during onboarding-wizard simulation. Real file is irrelevant;
 * backend only stores to MinIO and attaches a FileAttachment row.
 */
function buildFixturePdfBuffer(label: string): Buffer {
  const body =
    '%PDF-1.4\n' +
    '1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n' +
    '2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj\n' +
    '3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Contents 4 0 R>> endobj\n' +
    `4 0 obj <</Length ${label.length + 40}>>stream\nBT /F1 12 Tf 10 50 Td (${label}) Tj ET\nendstream endobj\n` +
    'xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000053 00000 n\n' +
    '0000000100 00000 n\n0000000175 00000 n\n' +
    'trailer <</Size 5/Root 1 0 R>>\nstartxref\n250\n%%EOF';
  return Buffer.from(body, 'utf-8');
}

/**
 * Deterministic pseudo-random for a seed string so each user gets different (but stable)
 * onboarding data. Not cryptographic — just hashes the email into a 32-bit int.
 */
function seedFromEmail(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Drives the full 7-step onboarding wizard UI for a user, then surrogates the
 * DocuSeal-webhook completion step by posting to /employee-profile/acknowledge/{formType}
 * for the three sign-required forms (W-4, I-9, State Withholding), and sets the
 * emergency contact (which the wizard doesn't collect) via PUT /employee-profile.
 *
 * Why a surrogate instead of driving DocuSeal: compliance-form templates in the dev
 * seed don't have AcroFieldMapJson / FilledPdfTemplate configured, and MockIntegrations
 * is false. POST /onboarding/sign-form therefore throws 400 in this environment.
 * /acknowledge/{formType} is the same endpoint the DocuSeal webhook calls when a form
 * is signed in production, so this mirrors production semantics at the data layer.
 *
 * Idempotent — reads /completeness first and returns immediately if already 8/8.
 */
export async function ensureUserOnboarded(page: Page, token: string): Promise<boolean> {
  const { apiCall } = await import('./api.helper');
  const completeness = await apiCall<{ isComplete: boolean; canBeAssignedJobs: boolean }>(
    'GET', 'employee-profile/completeness', token,
  );
  if (completeness?.isComplete) return true;

  // The /employee-profile payload has no firstName/lastName/email; those come from auth.
  // Read the seeded authUser out of localStorage to pick a deterministic seed + email
  // so our generated data matches the logged-in account.
  const authUser = await page.evaluate<{ email: string; firstName: string; lastName: string } | null>(
    () => {
      const raw = localStorage.getItem('forge-user');
      return raw ? JSON.parse(raw) : null;
    },
  ).catch(() => null);

  const email = authUser?.email ?? 'user@forge.local';
  const firstNameFromAuth = authUser?.firstName ?? 'Test';
  const lastNameFromAuth = authUser?.lastName ?? 'User';
  const seed = seedFromEmail(email);
  const streetNum = 100 + (seed % 9900);
  const zip = String(10000 + (seed % 89999));
  const phoneArea = 200 + (seed % 700);
  const phone3 = 200 + ((seed >> 4) % 700);
  const phone4 = 1000 + ((seed >> 8) % 8999);
  const phoneStr = `(${phoneArea}) ${phone3}-${phone4}`;
  const ssn = `${100 + (seed % 899)}-${10 + ((seed >> 6) % 89)}-${1000 + ((seed >> 12) % 8999)}`;
  const dobYear = 1970 + (seed % 28);
  const dobStr = `01/15/${dobYear}`;

  let currentStep = 'init';
  const screenshotOnFail = async (label: string) => {
    try {
      const shotDir = path.join(__dirname, '..', '..', 'screenshots');
      if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
      const safe = email.replace(/[^a-z0-9]/gi, '_');
      await page.screenshot({ path: path.join(shotDir, `onboarding-fail-${safe}-${label}.png`), fullPage: false });
    } catch { /* best effort */ }
  };
  const clickContinue = async (label: string): Promise<void> => {
    const continueBtn = page.locator('[data-testid="onboarding-continue-btn"]');
    try {
      await continueBtn.waitFor({ state: 'visible', timeout: 8_000 });
      // Wait up to 6s for the button to become enabled (form valid).
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="onboarding-continue-btn"]') as HTMLButtonElement | null;
          return btn !== null && !btn.disabled;
        },
        undefined,
        { timeout: 6_000 },
      );
    } catch (err) {
      await screenshotOnFail(`${label}-btn-disabled`);
      throw new Error(`Continue button still disabled on ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
    await continueBtn.click();
    await page.waitForTimeout(600);
  };

  try {
    await page.goto('/onboarding', { waitUntil: 'commit', timeout: 20_000 });
    const {
      fillInput, fillMatSelect, fillDatepicker, waitForIdle,
    } = await import('./ui-actions.helper');
    await waitForIdle(page);

    // ── Step 0: Personal ────────────────────────────────────────────────────
    currentStep = 'step0-personal';
    await page.waitForSelector('[data-testid="onboarding-first-name"]', { timeout: 10_000 });
    // firstName/lastName/email are pre-filled from auth.user but some runs see empty
    // fields (race between effect init and our query). Always fill explicitly.
    const fnInput = page.locator('[data-testid="onboarding-first-name"] input');
    if (!(await fnInput.inputValue().catch(() => ''))) await fillInput(page, 'onboarding-first-name', firstNameFromAuth);
    const lnInput = page.locator('[data-testid="onboarding-last-name"] input');
    if (!(await lnInput.inputValue().catch(() => ''))) await fillInput(page, 'onboarding-last-name', lastNameFromAuth);
    // Email is a REQUIRED field — always fill regardless of pre-fill state.
    const emailTestId = await page.locator('[data-testid="onboarding-email"]').count();
    if (emailTestId > 0) {
      await fillInput(page, 'onboarding-email', email);
    } else {
      // Fallback: find email input by placeholder/name if no data-testid
      const emailInput = page.locator('input[type="email"], input[formcontrolname="email"]').first();
      if (await emailInput.count() > 0) {
        const curr = await emailInput.inputValue().catch(() => '');
        if (!curr) {
          await emailInput.fill(email);
          await emailInput.blur().catch(() => {});
        }
      }
    }
    await fillDatepicker(page, 'onboarding-dob', dobStr);
    await fillInput(page, 'onboarding-ssn', ssn);
    await fillInput(page, 'onboarding-phone', phoneStr);
    await page.waitForTimeout(400);
    await clickContinue(currentStep);

    // ── Step 1: Address ─────────────────────────────────────────────────────
    currentStep = 'step1-address';
    await page.waitForSelector('[data-testid="onboarding-street1"]', { timeout: 10_000 });
    await fillInput(page, 'onboarding-street1', `${streetNum} Main St`);
    await fillInput(page, 'onboarding-city', 'Salt Lake City');
    await fillMatSelect(page, 'onboarding-state', 'Utah'); // UT has state withholding
    await fillInput(page, 'onboarding-zip', zip.slice(0, 5));
    await page.waitForTimeout(400);
    await clickContinue(currentStep);

    // ── Step 2: W-4 ─────────────────────────────────────────────────────────
    currentStep = 'step2-w4';
    await page.waitForSelector('[data-testid="onboarding-w4-filing-status"]', { timeout: 10_000 });
    await fillMatSelect(page, 'onboarding-w4-filing-status', 'Single or Married filing separately');
    await fillInput(page, 'onboarding-w4-qualifying-children', '0');
    await fillInput(page, 'onboarding-w4-other-dependents', '0');
    await page.waitForTimeout(400);
    await clickContinue(currentStep);

    // ── Step 3: State Withholding (Utah has state income tax) ───────────────
    currentStep = 'step3-state';
    const stateFilingVisible = await page.locator('[data-testid="onboarding-state-filing-status"]')
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (stateFilingVisible) {
      await fillMatSelect(page, 'onboarding-state-filing-status', 'Single');
      await fillInput(page, 'onboarding-state-allowances', '1');
      await page.waitForTimeout(400);
    }
    await clickContinue(currentStep);

    // ── Step 4: I-9 ─────────────────────────────────────────────────────────
    currentStep = 'step4-i9';
    await page.waitForSelector('[data-testid="onboarding-i9-citizenship"]', { timeout: 10_000 });
    await fillMatSelect(page, 'onboarding-i9-citizenship', 'A citizen of the United States');
    await page.locator('[data-testid="onboarding-i9-list-a-btn"]').click();
    await page.waitForTimeout(300);
    await fillMatSelect(page, 'onboarding-i9-list-a-type', 'U.S. Passport');
    await fillInput(page, 'onboarding-i9-list-a-doc-number', `P${String(100_000_000 + (seed % 900_000_000))}`);
    await fillInput(page, 'onboarding-i9-list-a-authority', 'U.S. Department of State');
    await fillDatepicker(page, 'onboarding-i9-list-a-expiry', `12/31/${2030 + (seed % 5)}`);

    // Upload the I-9 List A document — targets the <input type=file> inside the <label>
    // that sits next to the currently-visible List A section.
    const listAFileInput = page.locator('label.doc-upload__zone input[type="file"]').first();
    await listAFileInput.setInputFiles({
      name: 'list-a-passport.pdf',
      mimeType: 'application/pdf',
      buffer: buildFixturePdfBuffer('List A Document'),
    });
    // Wait for upload to complete — chip appears once fileId is set
    await page.waitForSelector('.doc-upload__chip', { timeout: 15_000 });
    await page.waitForTimeout(400);
    await clickContinue(currentStep);

    // ── Step 5: Direct Deposit ──────────────────────────────────────────────
    currentStep = 'step5-deposit';
    await page.waitForSelector('[data-testid="onboarding-bank-name"]', { timeout: 10_000 });
    await fillInput(page, 'onboarding-bank-name', 'Zions Bank');
    await fillInput(page, 'onboarding-routing-number', '124000054');
    await fillInput(page, 'onboarding-account-number', String(1_000_000_000 + (seed % 900_000_000)));
    await fillMatSelect(page, 'onboarding-account-type', 'Checking');

    const voidedCheckInput = page.locator('input[type="file"][accept*="pdf"]').last();
    await voidedCheckInput.setInputFiles({
      name: 'voided-check.pdf',
      mimeType: 'application/pdf',
      buffer: buildFixturePdfBuffer('Voided Check'),
    });
    await page.waitForSelector('.doc-upload__attached', { timeout: 15_000 });
    await page.waitForTimeout(400);
    await clickContinue(currentStep);

    // ── Step 6: Acknowledgments ─────────────────────────────────────────────
    currentStep = 'step6-ack';
    await page.waitForSelector('[data-testid="onboarding-ack-workers-comp"]', { timeout: 10_000 });
    // app-toggle wraps mat-slide-toggle; the actual clickable control is the button inside.
    await page.locator('[data-testid="onboarding-ack-workers-comp"] button').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="onboarding-ack-handbook"] button').click();
    await page.waitForTimeout(400);

    // ── Submit ──────────────────────────────────────────────────────────────
    currentStep = 'submit';
    const submitBtn = page.locator('[data-testid="onboarding-submit-btn"]');
    await submitBtn.waitFor({ timeout: 10_000 });
    // Wait for button to enable
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="onboarding-submit-btn"]') as HTMLButtonElement | null;
        return btn !== null && !btn.disabled;
      },
      undefined,
      { timeout: 8_000 },
    ).catch(async () => { await screenshotOnFail('submit-btn-disabled'); });
    const saveResponse = page.waitForResponse(
      r => r.url().includes('/onboarding/save') && r.request().method() === 'POST',
      { timeout: 15_000 },
    ).catch(() => null);
    await submitBtn.click();
    await saveResponse;
    await page.waitForTimeout(800);
  } catch (err) {
    logProgress(`  [ensureUserOnboarded] wizard walk failed at ${currentStep} for ${email}: ${err instanceof Error ? err.message : String(err)}`);
    await screenshotOnFail(`${currentStep}-catch`);
    // Fall through to API-side acknowledgments so at least completeness reaches 8/8.
  }

  // ── DocuSeal webhook surrogate: ack the 3 sign-required forms ─────────────
  // In production, HandleDocuSealWebhookHandler calls AcknowledgeFormCommand after the
  // form.completed webhook fires. We call the same MediatR command via the self-service
  // endpoint here because the dev seed has no AcroFieldMap templates configured.
  for (const formType of ['w4', 'i9', 'state_withholding']) {
    await apiCall<void>('POST', `employee-profile/acknowledge/${formType}`, token);
  }

  // ── Emergency contact (not collected by the wizard) ───────────────────────
  // PUT /employee-profile merges the emergency-contact fields onto the existing profile.
  const current = await apiCall<Record<string, unknown>>('GET', 'employee-profile', token);
  if (current) {
    await apiCall<unknown>('PUT', 'employee-profile', token, {
      ...current,
      emergencyContactName: 'Jordan Taylor',
      emergencyContactPhone: phoneStr,
      emergencyContactRelationship: 'Spouse',
    });
  }

  const after = await apiCall<{
    isComplete: boolean;
    totalItems?: number;
    completedItems?: number;
    items?: Array<{ key: string; label: string; isComplete: boolean }>;
  }>('GET', 'employee-profile/completeness', token);
  if (!after?.isComplete) {
    const missing = (after?.items ?? []).filter(i => !i.isComplete).map(i => i.key);
    logProgress(`  [ensureUserOnboarded] still incomplete for ${email} (${after?.completedItems}/${after?.totalItems}) — missing: ${JSON.stringify(missing)}`);
  }
  return !!after?.isComplete;
}

/**
 * Background seed users (alpha1-6, bravo1-7, etc.) appear in the admin list but are
 * not simulation drivers. They still need to show as "onboarded" so that the admin
 * compliance view doesn't show 0/8 for most of the workforce.
 *
 * Clicks the "Skip onboarding" button on the onboarding banner (a legitimate production
 * feature — mirrors an employee who completed onboarding off-platform) and confirms
 * in the follow-up dialog.  Pure UI interaction; no API writes.
 *
 * Idempotent — checks completeness first and returns immediately if already complete
 * or bypassed.
 */
export async function bypassOnboardingViaUI(page: Page, token: string, email: string): Promise<boolean> {
  const { apiCall } = await import('./api.helper');
  const completeness = await apiCall<{ isComplete: boolean }>(
    'GET', 'employee-profile/completeness', token,
  );
  if (completeness?.isComplete) return true;

  // Try multiple routes in sequence — some users land on dashboards with big announcement
  // overlays that race with profile-service load, leaving the banner un-rendered within
  // the timeout window. A route change forces the layout to re-evaluate banner visibility.
  const routes = ['/kanban', '/dashboard', '/backlog'];

  // Announcement overlay is position:fixed with high z-index; individual announcements
  // have pointer-events:auto and will intercept clicks on the onboarding banner below.
  // Acknowledge all pending announcements first (real production workflow — a user
  // with pending announcements would naturally click through them).
  const acknowledgeAllAnnouncements = async (): Promise<void> => {
    for (let i = 0; i < 25; i++) {
      const ackBtn = page.locator('[data-testid="announcement-ack-btn"]').first();
      const visible = await ackBtn.isVisible({ timeout: 500 }).catch(() => false);
      if (!visible) return;
      await ackBtn.click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(200);
    }
  };

  const clickSkipSequence = async (): Promise<boolean> => {
    await acknowledgeAllAnnouncements();
    const skipBtn = page.locator('[data-testid="onboarding-skip-btn"]');
    try {
      await skipBtn.waitFor({ state: 'visible', timeout: 6_000 });
    } catch {
      return false;
    }
    // force:true as fallback in case a transient overlay (toast, snackbar, late-arriving
    // announcement) lands between acknowledge-loop and click.
    await skipBtn.click({ force: true });
    await page.waitForTimeout(300);

    const confirmBtn = page.locator('[data-testid="onboarding-skip-confirm-btn"]');
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 5_000 });
    } catch {
      return false;
    }
    await confirmBtn.click({ force: true });

    await page.waitForFunction(
      () => document.querySelector('[data-testid="onboarding-skip-btn"]') === null,
      undefined,
      { timeout: 10_000 },
    ).catch(() => { /* banner may already be gone */ });
    await page.waitForTimeout(400);
    return true;
  };

  let clicked = false;
  for (const route of routes) {
    try {
      await page.goto(route, { waitUntil: 'commit', timeout: 20_000 });
      // Banner computed() reads profileService.completeness() which loads async.
      // Wait for the network to settle so the profile/completeness responses arrive.
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* best effort */ });
      await page.waitForTimeout(500);
      if (await clickSkipSequence()) {
        clicked = true;
        break;
      }
    } catch (err) {
      logProgress(`  [bypassOnboardingViaUI] route ${route} failed for ${email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!clicked) {
    logProgress(`  [bypassOnboardingViaUI] banner never became clickable for ${email} across ${routes.join(', ')}`);
    try {
      const diagnostic = await page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem('forge-user') ?? 'null');
        const token = localStorage.getItem('forge-token');
        const bannerEl = document.querySelector('.onboarding-banner');
        const skipBtnEl = document.querySelector('[data-testid="onboarding-skip-btn"]');
        return {
          pathname: window.location.pathname,
          userEmail: user?.email,
          userProfileComplete: user?.profileComplete,
          userRoles: user?.roles,
          hasToken: !!token,
          bannerExistsInDom: !!bannerEl,
          bannerDisplayed: bannerEl ? window.getComputedStyle(bannerEl as HTMLElement).display : 'n/a',
          skipBtnExists: !!skipBtnEl,
        };
      }).catch(() => null);
      logProgress(`  [bypassOnboardingViaUI] diagnostic for ${email}: ${JSON.stringify(diagnostic)}`);
      const shotDir = path.join(__dirname, '..', '..', 'screenshots');
      if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
      const safe = email.replace(/[^a-z0-9]/gi, '_');
      await page.screenshot({ path: path.join(shotDir, `onboarding-bypass-fail-${safe}.png`), fullPage: false });
    } catch { /* best effort */ }
  }

  // Verify end state.
  const after = await apiCall<{ isComplete: boolean }>(
    'GET', 'employee-profile/completeness', token,
  );
  return !!after?.isComplete;
}
