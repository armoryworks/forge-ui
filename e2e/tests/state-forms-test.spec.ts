import { test, request } from '@playwright/test';
import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

// All 37 states + DC that have their own withholding forms
const STATE_FORM_CODES = [
  'AL', 'AZ', 'AR', 'CA', 'CT', 'DC', 'DE', 'GA', 'HI',
  'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD',
  'ME', 'MI', 'MN', 'MO', 'MS', 'NC', 'NE', 'NJ', 'NY',
  'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'VA', 'VT', 'WI', 'WV',
];

function setLocationState(stateCode: string): void {
  execSync(
    `docker compose exec -T qb-engineer-db psql -U postgres -d qb_engineer -c "UPDATE company_locations SET state = '${stateCode}' WHERE is_default = true;"`,
    { cwd: 'e:/dev/qb-engineer-wrapper', stdio: 'pipe' },
  );
}

function clearFormCache(): void {
  execSync(
    `docker compose exec -T qb-engineer-db psql -U postgres -d qb_engineer -c "DELETE FROM state_form_definition_caches;"`,
    { cwd: 'e:/dev/qb-engineer-wrapper', stdio: 'pipe' },
  );
}

test('extract and screenshot all state withholding forms', async ({ browser }) => {
  test.setTimeout(3_600_000); // 60 min — first-time extraction is slow

  // Don't clear cache — re-run only uncached states

  // Login once
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const loginRes = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: 'Admin123!' },
  });
  if (!loginRes.ok()) throw new Error(`Login failed: ${loginRes.status()}`);
  const loginData = await loginRes.json();
  await apiContext.dispose();

  // Create a single browser context for all states
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Seed auth once
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ tkn, user }) => {
      localStorage.setItem('qbe-token', tkn);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { tkn: loginData.token, user: loginData.user },
  );

  const results: { state: string; status: string; error?: string }[] = [];

  for (let i = 0; i < STATE_FORM_CODES.length; i++) {
    const stateCode = STATE_FORM_CODES[i];
    console.log(`\n--- Testing ${stateCode} (${i + 1}/${STATE_FORM_CODES.length}) ---`);

    try {
      // Update location state directly via SQL (bypasses rate limiter)
      setLocationState(stateCode);

      // Navigate away first to force Angular to re-initialize the component
      await page.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle', timeout: 15_000 });
      await page.waitForTimeout(500);

      // Navigate to the state withholding form page
      // Use 'domcontentloaded' instead of 'networkidle' — the API call for form extraction
      // can keep the network busy for 60s+, we don't want to block navigation on it
      await page.goto(`${BASE_URL}/account/tax-forms/stateWithholding`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // Wait for a terminal state — first-time PDF extraction can take 30-60s
      // Three possible outcomes:
      //   1. Form renderer appears (.compliance-form__body) — extraction succeeded
      //   2. Acknowledge button appears (.form-detail__acknowledge-btn) — extraction failed, fallback mode
      //   3. Neither appears within timeout — still loading (slow PDF download)
      let status = 'LOADING';
      try {
        const result = await Promise.race([
          page.waitForSelector('.compliance-form__body', { timeout: 90_000 }).then(() => 'OK' as const),
          page.waitForSelector('.form-detail__acknowledge-btn', { timeout: 90_000 }).then(() => 'ACKNOWLEDGE' as const),
        ]);
        status = result;
      } catch {
        // Neither appeared within 90s — check what's visible
        const bodyText = await page.textContent('body') ?? '';
        if (bodyText.includes('Loading')) {
          status = 'LOADING';
        } else if (bodyText.includes('No form') || bodyText.includes('no_state')) {
          status = 'NO_FORM';
        } else {
          status = 'UNKNOWN';
        }
      }
      await page.waitForTimeout(500);

      console.log(`  [${stateCode}] Status: ${status}`);

      // Screenshot
      await page.screenshot({
        path: `e2e/screenshots/state-forms/${stateCode}.png`,
        fullPage: true,
      });

      results.push({ state: stateCode, status });
    } catch (err: any) {
      console.log(`  [${stateCode}] Exception: ${err.message}`);
      results.push({ state: stateCode, status: 'EXCEPTION', error: err.message });

      // Try to screenshot error state
      try {
        await page.screenshot({
          path: `e2e/screenshots/state-forms/${stateCode}_error.png`,
          fullPage: true,
        });
      } catch { /* ignore screenshot failure */ }
    }
  }

  // Restore location to ID (Idaho)
  setLocationState('ID');

  await context.close();

  // Summary
  console.log('\n\n=== STATE FORM EXTRACTION SUMMARY ===');
  const ok = results.filter(r => r.status === 'OK');
  const ack = results.filter(r => r.status === 'ACKNOWLEDGE');
  const loading = results.filter(r => r.status === 'LOADING');
  const noForm = results.filter(r => r.status === 'NO_FORM');
  const unknown = results.filter(r => r.status === 'UNKNOWN');
  const exceptions = results.filter(r => r.status === 'EXCEPTION');
  console.log(`OK (form rendered): ${ok.length} — ${ok.map(r => r.state).join(', ')}`);
  if (ack.length) console.log(`ACKNOWLEDGE (no form def): ${ack.length} — ${ack.map(r => r.state).join(', ')}`);
  if (loading.length) console.log(`LOADING (timed out): ${loading.length} — ${loading.map(r => r.state).join(', ')}`);
  if (noForm.length) console.log(`NO_FORM: ${noForm.length} — ${noForm.map(r => r.state).join(', ')}`);
  if (unknown.length) console.log(`UNKNOWN: ${unknown.length} — ${unknown.map(r => r.state).join(', ')}`);
  if (exceptions.length) console.log(`EXCEPTION: ${exceptions.length} — ${exceptions.map(r => `${r.state}: ${r.error}`).join(', ')}`);
});
