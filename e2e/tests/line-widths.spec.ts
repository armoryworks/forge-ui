import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth.helper';

test('check add-line grid widths in quote dialog', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/quotes');
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("New Quote")');
  await page.waitForSelector('app-quote-dialog', { timeout: 5000 });

  const widths = await page.evaluate(() => {
    const addLine = document.querySelector('app-quote-dialog .add-line') as HTMLElement;
    if (!addLine) return {};
    const items = Array.from(addLine.children).map(el => ({
      tag: el.tagName,
      width: (el as HTMLElement).offsetWidth,
      selector: el.className || el.tagName,
    }));
    return {
      gridWidth: addLine.offsetWidth,
      gridCols: window.getComputedStyle(addLine).gridTemplateColumns,
      items,
    };
  });

  console.log('ADD-LINE WIDTHS:', JSON.stringify(widths, null, 2));
  expect(true).toBe(true);
});
