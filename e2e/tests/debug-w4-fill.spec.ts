import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

test('debug-w4-fill', async ({ page }) => {
  test.setTimeout(60000);
  const api = await request.newContext({ baseURL: 'http://localhost:5000/api/v1/' });
  const { token, user } = await (await api.post('auth/login', { data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD } })).json();
  await api.dispose();
  await page.goto('http://localhost:4200', { waitUntil: 'commit' });
  await page.evaluate(({t,u}: any) => {
    localStorage.setItem('qbe-token',t); localStorage.setItem('qbe-user',JSON.stringify(u)); localStorage.setItem('language','en');
  }, {t:token,u:user});
  await page.goto('http://localhost:4200/account/tax-forms/w4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Fill fields
  for (const [label, val] of [
    ['(a) First name and middle initial', 'Admin'],
    ['Last name', 'User'],
    ['Social security number', '123-45-6789'],
    ['Address', '123 Main St'],
    ['City or town, state, and ZIP code', 'Boise, ID 83702'],
  ]) {
    const el = page.locator(`input[aria-label="${label}"]`).first();
    await el.click();
    await page.keyboard.selectAll();
    await el.fill(val);
    await el.press('Tab');
  }

  // Click first filing status option label (not the input directly)
  await page.locator('.gov-form__filing-status .gov-form__radio').first().click();
  await page.waitForTimeout(500);

  // Signature
  const sig = page.locator('input.gov-form__input--signature').first();
  await sig.click();
  await sig.fill('Admin User');
  await sig.press('Tab');

  // Check form validity via Angular
  const isValid = await page.evaluate(() => {
    const form = (window as any)['ng']?.getComponent?.(document.querySelector('app-compliance-form-renderer'));
    return form?.form?.valid;
  });
  console.log('Form valid (ng probe):', isValid);

  // Check if submit button is enabled
  const btnDisabled = await page.locator('.compliance-form__actions .action-btn--primary').getAttribute('disabled');
  console.log('Submit disabled attr:', btnDisabled);
  
  await page.screenshot({ path: 'e2e/screenshots/debug-w4-filled.png' });
});
