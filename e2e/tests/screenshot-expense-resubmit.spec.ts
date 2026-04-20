import { test, request, expect } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

test('screenshot expense resubmit dialog with revision feedback', async ({ browser }) => {
  // 1. Admin: find a pending expense + request revision with feedback notes
  const adminApi = await request.newContext({ baseURL: API_BASE });
  const adminLogin = await adminApi.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  if (!adminLogin.ok()) throw new Error(`admin login failed: ${adminLogin.status()}`);
  const adminData = await adminLogin.json();
  const adminAuth = { Authorization: `Bearer ${adminData.token}` };

  const queueRes = await adminApi.get('expenses?status=Pending', { headers: adminAuth });
  if (!queueRes.ok()) throw new Error(`queue fetch failed: ${queueRes.status()}`);
  const queueText = await queueRes.text();
  const queue = JSON.parse(queueText) as Array<{ id: number; userId: number; userName?: string }>;
  const submitter = queue.find(e => e.userId !== adminData.user.id);
  if (!submitter) throw new Error('no non-admin pending expense available');

  const declineRes = await adminApi.patch(`expenses/${submitter.id}/status`, {
    headers: { ...adminAuth, 'Content-Type': 'application/json' },
    data: { status: 'NeedsRevision', approvalNotes: 'Please attach a readable copy of the receipt — the photo is too blurry to verify.' },
  });
  if (!declineRes.ok()) throw new Error(`decline failed: ${declineRes.status()} ${await declineRes.text()}`);

  const usersRes = await adminApi.get('admin/users', { headers: adminAuth });
  const users = await usersRes.json() as Array<{ id: number; email: string }>;
  const submitterUser = users.find(u => u.id === submitter.userId);
  if (!submitterUser) throw new Error('submitter user not found');
  const submitterEmail = submitterUser.email;
  await adminApi.dispose();

  // 2. Login as submitter, navigate to expenses, click resubmit
  const submitterApi = await request.newContext({ baseURL: API_BASE });
  const subLogin = await submitterApi.post('auth/login', { data: { email: submitterEmail, password: SEED_PASSWORD } });
  if (!subLogin.ok()) throw new Error(`submitter login failed: ${subLogin.status()}`);
  const subData = await subLogin.json();
  await submitterApi.dispose();

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('qbe-token', token);
    localStorage.setItem('qbe-user', JSON.stringify(user));
    localStorage.setItem('language', 'en');
  }, { token: subData.token, user: subData.user });

  await page.goto(`${BASE_URL}/expenses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Filter by "Needs Revision" if a status filter exists, otherwise just click the first resubmit button visible
  const resubmitBtn = page.locator('[data-testid="resubmit-expense-btn"]').first();
  await expect(resubmitBtn).toBeVisible({ timeout: 10_000 });
  await resubmitBtn.click();
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'e2e/screenshots/expense-resubmit-dialog.png', fullPage: false });

  await context.close();
});
