import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * Mobile shell, stub-driven: seeds an enrolled instance + session and
 * answers every API call locally, so it runs against any served build
 * and needs no backend. Exercises the five screens' happy paths and the
 * undo / compensating-call contract.
 */
const instance = {
  id: 'shop', serverUrl: 'https://shop.example', name: 'Shop', certSha256: null,
  deviceUuid: 'u1', deviceId: 7, deviceName: 'Phone', shared: false,
};

async function seed(context: BrowserContext): Promise<{ calls: { url: string; method: string; key: string | null; body: unknown }[] }> {
  const calls: { url: string; method: string; key: string | null; body: unknown }[] = [];
  await context.addInitScript((i) => {
    localStorage.setItem('forge-token', 'test-token');
    localStorage.setItem('forge-user', JSON.stringify({ id: 1, email: 'dan@shop.example', firstName: 'Dan', lastName: 'Hokanson', roles: ['Admin'], isActive: true }));
    localStorage.setItem('forge-mobile-instances', JSON.stringify([i]));
    localStorage.setItem('forge-mobile-active-instance', i.id);
  }, instance);
  await context.route('**/api/v1/**', (route) => {
    const req = route.request();
    if (req.method() !== 'GET') calls.push({ url: req.url().replace(/^https?:\/\/[^/]+/, ''), method: req.method(), key: req.headers()['idempotency-key'] ?? null, body: req.postDataJSON() });
    route.fulfill({ json: {} });
  });
  await context.route('**/api/v1/mobile/clock/state', (r) => r.fulfill({ json: { state: 'out', lastEventType: null, lastEventAt: null, lastEventId: null } }));
  await context.route('**/api/v1/mobile/clock/punch', (r) => {
    calls.push({ url: '/api/v1/mobile/clock/punch', method: 'POST', key: r.request().headers()['idempotency-key'] ?? null, body: r.request().postDataJSON() });
    r.fulfill({ json: { eventId: 9, state: { state: 'in', lastEventType: 'ClockIn', lastEventAt: new Date().toISOString(), lastEventId: 9 } } });
  });
  await context.route('**/api/v1/mobile/lookup**', (r) => r.fulfill({ json: [
    { kind: 'job', id: 1055, code: 'JOB-1055', label: 'JOB-1055 · Bracket', subtitle: 'Acme · In Production', actions: ['move', 'start', 'details'] },
    { kind: 'part', id: 42, code: 'PRT-42', label: 'PRT-42 · Bracket', subtitle: '18 on hand', actions: ['moveStock', 'details'] },
  ] }));
  await context.route('**/api/v1/mobile/scan/resolve', (r) => r.fulfill({ json: { kind: 'part', id: 42, code: 'PRT-42', label: 'PRT-42 · Bracket', subtitle: '18 on hand', actions: ['moveStock'] } }));
  await context.route('**/api/v1/mobile/jobs/1055/status', (r) => r.fulfill({ json: {
    id: 1055, jobNumber: 'JOB-1055', title: 'Bracket', customerName: 'Acme', stageId: 3, stageName: 'In Production', stageColor: '#0d9488',
    nextStageId: 4, nextStageName: 'QC', previousStageId: 2, dueDate: null, priority: 'Normal', quantity: 200, assignees: [], notes: [], files: [], timerRunning: false,
  } }));
  await context.route('**/api/v1/mobile/jobs/1055/advance', (r) => {
    calls.push({ url: '/api/v1/mobile/jobs/1055/advance', method: 'POST', key: r.request().headers()['idempotency-key'] ?? null, body: r.request().postDataJSON() });
    r.fulfill({ json: { collapsed: false, previousStageId: 3, status: { id: 1055, jobNumber: 'JOB-1055', title: 'Bracket', customerName: 'Acme', stageId: 4, stageName: 'QC', stageColor: '#0d9488', nextStageId: 5, nextStageName: 'Shipped', previousStageId: 3, dueDate: null, priority: 'Normal', quantity: 200, assignees: [], notes: [], files: [], timerRunning: false } } });
  });
  return { calls };
}

test.use({ viewport: { width: 390, height: 844 } });

test('shell shows the five tabs and no unresolved i18n keys', async ({ context, page }) => {
  await seed(context);
  await page.goto('/app/scan');
  await expect(page.locator('[data-testid^="mobile-app-tab-"]')).toHaveCount(5);
  await expect(page.locator('[data-testid="mobile-app-account"]')).toBeVisible();
  expect(await page.evaluate(() => /mobileApp\./.test(document.body.innerText))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('clock punch shows an undo that fires the compensating delete', async ({ context, page }) => {
  const { calls } = await seed(context);
  await page.goto('/app/clock');
  await expect(page.getByTestId('clock-state')).toHaveText('OUT');
  await page.getByTestId('clock-primary').click();
  await expect(page.getByTestId('clock-state')).toHaveText('IN');
  await expect(page.getByTestId('clock-break')).toBeVisible();
  await page.locator('.mat-mdc-snack-bar-action').click();
  await expect.poll(() => calls.map((c) => `${c.method} ${c.url}`)).toEqual([
    'POST /api/v1/mobile/clock/punch',
    'DELETE /api/v1/mobile/clock/events/9',
  ]);
  expect(calls[0].key).toMatch(/^[0-9a-f-]{36}$/);
});

test('lookup lists results and opens the same action sheet as a scan', async ({ context, page }) => {
  await seed(context);
  await page.goto('/app/lookup');
  await page.locator('[data-testid="lookup-input"] input').fill('brack');
  await expect(page.locator('.lookup__row')).toHaveCount(2);
  await page.getByTestId('lookup-row-42').click();
  await expect(page.locator('app-scan-action-sheet')).toBeVisible();
  await page.getByRole('button', { name: /move stock/i }).click();
  await expect(page).toHaveURL(/\/app\/move\?code=PRT-42/);
  await expect(page.locator('.move__step').first()).toContainText('PRT-42');
});

test('job status advances one column and the undo moves it back', async ({ context, page }) => {
  const { calls } = await seed(context);
  await page.goto('/app/jobs/1055');
  await expect(page.getByText('In Production')).toBeVisible();
  await page.getByTestId('job-status-advance').click();
  await expect(page.getByText('QC', { exact: true })).toBeVisible();
  await page.locator('.mat-mdc-snack-bar-action').click();
  await expect.poll(() => calls.map((c) => `${c.method} ${c.url}`)).toContain('PATCH /api/v1/jobs/1055/stage');
  const [advance, moveBack] = calls.filter((c) => c.method !== 'GET');
  expect(advance.key).not.toBe(moveBack.key);
});
