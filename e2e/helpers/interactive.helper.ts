import { type Page } from '@playwright/test';

/**
 * Interactive checkpoint — pauses the test for manual user intervention.
 *
 * In headed mode: opens Playwright Inspector, user interacts with the browser,
 * then clicks "Resume" when done.
 *
 * In headless mode: skips the pause (for non-interactive runs).
 */
export async function checkpoint(
  page: Page,
  title: string,
  instructions: string[],
): Promise<void> {
  const divider = '═'.repeat(60);
  const subDivider = '─'.repeat(60);

  console.log('');
  console.log(divider);
  console.log(`  ⏸  ${title}`);
  console.log(subDivider);
  for (const line of instructions) {
    console.log(`  ${line}`);
  }
  console.log('');
  console.log('  When done, click RESUME in the Playwright Inspector.');
  console.log(divider);
  console.log('');

  // page.pause() opens the inspector in headed mode.
  // In headless mode it resolves immediately.
  await page.pause();
}

/** Log a scenario step */
export function step(message: string): void {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`  [${ts}] ${message}`);
}

/** Log scenario phase header */
export function phase(title: string): void {
  console.log('');
  console.log(`  ▶ ${title}`);
  console.log('  ' + '─'.repeat(50));
}
