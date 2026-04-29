import { test, expect, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

/**
 * Workflow Pattern Phase 4 — interactive smoke for the demo route.
 *
 * Verifies the shell renders end-to-end and that the mode toggle + entity
 * editor wiring works. Used as the "did it actually render?" gate after
 * any Phase 4 / 5 change to the shell.
 */
test('workflow-shell-demo renders + mode toggle works + entity edits propagate', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Auth
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const loginData = await response.json();
  await apiContext.dispose();

  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('qbe-token', token);
    localStorage.setItem('qbe-user', JSON.stringify(user));
  }, { token: loginData.token, user: loginData.user });

  await page.goto(`${BASE_URL}/workflow-shell-demo`, { waitUntil: 'networkidle' });

  // Shell is mounted
  await expect(page.locator('[data-testid="workflow-rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="workflow-step-basics"]')).toBeVisible();
  await expect(page.locator('[data-testid="workflow-step-alternates"]')).toBeVisible();

  // D2: future steps are locked initially (basics is current; bom/routing/costing locked)
  await expect(page.locator('[data-testid="workflow-step-bom"]')).toBeDisabled();

  // D2: filling basics fields unlocks the predicate gate, but bom only
  // unlocks when its own gate passes. Let's verify the basics check icon
  // appears once name/type/material are filled.
  await page.locator('[data-testid="demo-field-name"]').fill('ASM-100');
  await page.locator('[data-testid="demo-field-type"]').fill('Assembly');
  await page.locator('[data-testid="demo-field-material"]').fill('Aluminum');

  // Wait for change detection.
  await page.waitForTimeout(200);

  // Step indicator on basics now shows the 'check' material icon.
  const basicsIndicator = page.locator('[data-testid="workflow-step-basics"] .material-icons-outlined');
  await expect(basicsIndicator).toHaveText('check');

  // D4: mode toggle — clicking express hides the rail and shows the express container.
  await page.locator('[data-testid="workflow-mode-express"]').click();
  await expect(page.locator('[data-testid="workflow-rail"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="workflow-express-content"]')).toBeVisible();

  // Mode toggle is reflected in URL.
  const url = new URL(page.url());
  expect(url.searchParams.get('mode')).toBe('express');

  // Switching back to guided returns the rail.
  await page.locator('[data-testid="workflow-mode-guided"]').click();
  await expect(page.locator('[data-testid="workflow-rail"]')).toBeVisible();

  await context.close();
});
