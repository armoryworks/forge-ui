import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

// One-off verification of the quote-detail-panel button-placement fix.
// Picks the first quote in the seed data and renders its detail dialog.
test('quote detail button placement', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const api = await request.newContext({ baseURL: API_BASE });
  const login = await api.post('auth/login', {
    data: { email: 'admin@forge.local', password: SEED_PASSWORD },
  });
  if (!login.ok()) throw new Error(`Login failed: ${login.status()}`);
  const auth = await login.json();

  // Pick the first quote from the list.
  const listResp = await api.get('quotes', { headers: { Authorization: `Bearer ${auth.token}` } });
  if (!listResp.ok()) throw new Error(`List quotes failed: ${listResp.status()}`);
  const list = await listResp.json();
  const items = Array.isArray(list) ? list : (list.items ?? list.data ?? []);
  if (items.length === 0) {
    await api.dispose();
    await context.close();
    throw new Error('No quotes in seed data — cannot verify quote button placement.');
  }
  const quoteId = items[0].id;
  await api.dispose();

  // Seed auth on the page origin.
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user, lang }) => {
      localStorage.setItem('forge-token', token);
      localStorage.setItem('forge-user', JSON.stringify(user));
      localStorage.setItem('language', lang);
    },
    { token: auth.token, user: auth.user, lang: 'en' },
  );

  // Navigate to the quote detail.
  await page.goto(`${BASE_URL}/quotes?detail=quote:${quoteId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: `e2e/screenshots/quote-detail-button-fix.png`, fullPage: true });
  await context.close();
});
