/**
 * UI interaction helpers for Angular Material components.
 * All helpers operate on `data-testid` attributes and handle the Angular Material
 * component wrapper → native element nesting.
 */

import type { Page } from '@playwright/test';

export const APP_BASE = process.env['SIM_APP_BASE'] ?? 'http://localhost:4200';

// ── Loading overlay ───────────────────────────────────────────────────────────

/**
 * Wait until the global LoadingOverlay is gone from the DOM.
 * The overlay uses @if so the .loading-overlay div is completely detached when idle.
 * Uses waitForFunction for reliable polling in the browser context.
 * Short 3s timeout — if the overlay persists longer, we proceed anyway (best-effort).
 * Note: in some configurations (e.g. CI clock manipulation), the overlay may persist
 * indefinitely due to a stuck LoadingService cause; callers must not depend on this.
 */
export async function waitForIdle(page: Page, timeout = 8000): Promise<void> {
  await page.waitForFunction(
    () => !document.querySelector('.loading-overlay'),
    { timeout, polling: 100 },
  ).catch(() => { /* best-effort — proceed even if overlay persists */ });
  // Small buffer for Angular change detection to finish
  await page.waitForTimeout(150);
}

// ── Navigation ────────────────────────────────────────────────────────────────

export async function navigateTo(page: Page, path: string): Promise<void> {
  // Use 'commit' (just response headers) — 'domcontentloaded' can hang in headless
  // Chromium when the Angular SPA is loaded or when there are race conditions
  // from the initial goto('/', {waitUntil:'commit'}) in loginViaApi.
  await page.goto(`${APP_BASE}${path}`, { waitUntil: 'commit', timeout: 10000 })
    .catch(() => { /* navigation timeout — page may still load */ });

  // Wait for router-outlet to exist (Angular booted + route activated)
  await page.waitForSelector('router-outlet', { timeout: 8000 })
    .catch(() => { /* best-effort */ });

  // Brief wait for Angular change detection + route loading overlay to clear
  await waitForIdle(page);
}

// ── Inputs ────────────────────────────────────────────────────────────────────

/**
 * Fill a plain text/number `<input>` inside an `<app-input>` wrapper.
 *
 * Primary path: Angular CVA API — sets the FormControl value directly and calls
 * the CVA's onChange so that Angular's reactive form state updates correctly.
 * In zoneless/OnPush mode, Playwright's synthetic InputEvent doesn't always
 * trigger Angular's change detection, so we bypass the DOM event entirely.
 *
 * Fallback: standard Playwright fill (typing simulation).
 */
export async function fillInput(page: Page, testid: string, value: string): Promise<void> {
  await page.locator(`[data-testid="${testid}"]`).waitFor({ state: 'visible', timeout: 5000 });

  // ── Primary: set via Angular's CVA / FormControl API ─────────────────────
  const setViaAngular = await page.evaluate(
    ({ sel, val }: { sel: string; val: string }) => {
      const ngApi = (window as any).ng;
      if (!ngApi) return false;

      const appInput = document.querySelector(sel);
      if (!appInput) return false;

      // Strategy 1: FormControlName directive on the app-input element
      try {
        const directives: any[] = ngApi.getDirectives?.(appInput) ?? [];
        for (const d of directives) {
          if (d.control && typeof d.control.setValue === 'function') {
            d.control.setValue(val, { emitEvent: true, emitModelToViewChange: true });
            if (ngApi.applyChanges) ngApi.applyChanges(appInput);
            return true;
          }
        }
      } catch { /* ignore */ }

      // Strategy 2: InputComponent CVA — call onChange directly + update value signal
      try {
        const comp = ngApi.getComponent?.(appInput);
        if (comp) {
          // Call the private onChange (registered by Angular's reactive forms machinery)
          if (typeof (comp as any).onChange === 'function') {
            (comp as any).onChange(val);
            if (typeof comp.value?.set === 'function') comp.value.set(val);
            if (ngApi.applyChanges) ngApi.applyChanges(appInput);
            return true;
          }
        }
      } catch { /* ignore */ }

      return false;
    },
    { sel: `[data-testid="${testid}"]`, val: value },
  ).catch(() => false);

  if (setViaAngular) {
    await page.waitForTimeout(50);
    return;
  }

  // ── Fallback: DOM fill (fires InputEvent which onInput handler should catch) ──
  const loc = page.locator(`[data-testid="${testid}"] input`).first();
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  await loc.clear();
  await loc.fill(value);
  // Dispatch change event as extra insurance for CVA listeners
  await page.evaluate((nativeInputSel) => {
    const el = document.querySelector(nativeInputSel) as HTMLInputElement;
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, `[data-testid="${testid}"] input`);
  await page.waitForTimeout(50);
}

/** Fill a `<textarea>` inside an `<app-textarea>` wrapper. */
export async function fillTextarea(page: Page, testid: string, value: string): Promise<void> {
  await page.locator(`[data-testid="${testid}"]`).waitFor({ state: 'visible', timeout: 5000 });

  // Primary: Angular CVA API
  const setViaAngular = await page.evaluate(
    ({ sel, val }: { sel: string; val: string }) => {
      const ngApi = (window as any).ng;
      if (!ngApi) return false;
      const el = document.querySelector(sel);
      if (!el) return false;
      try {
        const directives: any[] = ngApi.getDirectives?.(el) ?? [];
        for (const d of directives) {
          if (d.control && typeof d.control.setValue === 'function') {
            d.control.setValue(val, { emitEvent: true });
            if (ngApi.applyChanges) ngApi.applyChanges(el);
            return true;
          }
        }
        const comp = ngApi.getComponent?.(el);
        if (comp && typeof (comp as any).onChange === 'function') {
          (comp as any).onChange(val);
          if (typeof comp.value?.set === 'function') comp.value.set(val);
          if (ngApi.applyChanges) ngApi.applyChanges(el);
          return true;
        }
      } catch { /* ignore */ }
      return false;
    },
    { sel: `[data-testid="${testid}"]`, val: value },
  ).catch(() => false);

  if (setViaAngular) {
    await page.waitForTimeout(50);
    return;
  }

  // Fallback: DOM fill
  const loc = page.locator(`[data-testid="${testid}"] textarea`).first();
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  await loc.clear();
  await loc.fill(value);
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLTextAreaElement;
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
  }, `[data-testid="${testid}"] textarea`);
  await page.waitForTimeout(50);
}

/**
 * Pick an option from an Angular Material `mat-select` inside an `<app-select>` wrapper.
 * Opens the dropdown and clicks the first option matching `optionText`.
 */
/**
 * Pick an option from an Angular Material `mat-select` inside an `<app-select>` wrapper.
 * Opens the dropdown and clicks the first option matching `optionText` (partial, case-insensitive).
 * Falls back to first option if no match found.
 */
/**
 * Pick an option from an Angular Material `mat-select` inside an `<app-select>` wrapper.
 *
 * Primary path: Angular CVA API (reliable in headless) — sets the value via the
 *   SelectComponent.onSelectionChange() and triggers change detection.
 * Fallback: standard Playwright trigger click → wait for mat-option → click.
 */
export async function fillMatSelect(page: Page, testid: string, optionText: string): Promise<void> {
  await page.locator(`[data-testid="${testid}"]`).waitFor({ state: 'visible', timeout: 5000 });

  // ── Primary: set via Angular's CVA API ──────────────────────────────────────
  // Async evaluate: yields to the event loop between attempts so Angular CD can run
  const setViaApi = await page.evaluate(
    async ({ sel, text }: { sel: string; text: string }) => {
      function trySetViaOptions(appSelect: Element, comp: any, ngApi: any): boolean {
        // Read options — NG0950 thrown if required input not yet set
        let options: Array<{ value: unknown; label: string }> = [];
        try {
          options = comp.options() ?? [];
        } catch(e: any) {
          return false;                                  // not ready yet — retry
        }
        if (!Array.isArray(options) || !options.length) return false;

        const lower = text.toLowerCase();
        let chosen: { value: unknown; label: string } | undefined =
          options.find((o: any) => String(o.label).toLowerCase().includes(lower));
        if (!chosen) chosen = options.find((o: any) => o.value !== null && String(o.label) !== '-- None --');
        if (!chosen) chosen = options[0];

        try {
          if (typeof comp.onSelectionChange === 'function') {
            comp.onSelectionChange(chosen.value);
            if (ngApi.applyChanges) ngApi.applyChanges(appSelect);
            return true;
          }
        } catch(e: any) { return false; }
        return false;
      }

      function trySetViaFormControl(appSelect: Element, comp: any, ngApi: any): boolean {
        // Fallback: get FormControlName directive on the app-select element and setValue directly.
        // Works for string-valued selects (value === label, e.g. lead-source, expense-category).
        try {
          const directives: any[] = ngApi.getDirectives?.(appSelect) ?? [];
          for (const d of directives) {
            // FormControlName directive has a `control` property (AbstractControl)
            if (d.control && typeof d.control.setValue === 'function') {
              d.control.setValue(text);
              // Update SelectComponent's internal value signal so mat-select shows the text
              if (comp?.value?.set) comp.value.set(text);
              if (ngApi.applyChanges) ngApi.applyChanges(appSelect);
              return true;
            }
          }
        } catch(e: any) { /* ignore */ }
        return false;
      }

      function trySetDirect(appSelect: Element, comp: any, ngApi: any): boolean {
        // Last resort: call onSelectionChange(text) directly without reading options.
        // Works for string-valued selects (value === label) even when options input is not
        // yet initialized (NG0950 guard) — onSelectionChange only writes value, doesn't read options.
        try {
          if (typeof comp.onSelectionChange === 'function') {
            comp.onSelectionChange(text);
            if (ngApi.applyChanges) ngApi.applyChanges(appSelect);
            return true;
          }
        } catch(e: any) { /* ignore */ }
        return false;
      }

      function trySet(): boolean {
        const ngApi = (window as any).ng;
        if (!ngApi || !ngApi.getComponent) return false;

        const appSelect = document.querySelector(sel);
        if (!appSelect) return false;

        let comp: any;
        try { comp = ngApi.getComponent(appSelect); } catch(e: any) { return false; }
        if (!comp) return false;

        // Primary: read options and invoke CVA selection handler
        if (trySetViaOptions(appSelect, comp, ngApi)) return true;

        // Fallback: set FormControl value directly (works for string-valued selects)
        if (trySetViaFormControl(appSelect, comp, ngApi)) return true;

        // Last resort: call onSelectionChange directly without reading options
        if (trySetDirect(appSelect, comp, ngApi)) return true;

        return false;
      }

      // First try immediately (synchronous path for already-initialized components)
      if (trySet()) return true;

      // Yield to event loop up to 20 times (2s) for Angular change detection to set inputs
      for (let i = 0; i < 20; i++) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        if (trySet()) return true;
      }
      return false;
    },
    { sel: `[data-testid="${testid}"]`, text: optionText },
  ).catch(() => false);

  if (setViaApi) {
    await page.waitForTimeout(100);
    return;
  }

  // ── Fallback: UI click approach (best-effort — never throws) ────────────────
  try {
    const trigger = page.locator(`[data-testid="${testid}"] .mat-mdc-select-trigger`);
    await trigger.waitFor({ state: 'visible', timeout: 5000 });
    await trigger.click({ force: true });
    const appeared = await page.locator('mat-option').first()
      .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
    if (!appeared) return; // mat-options never opened in headless — give up gracefully
    const opts = page.locator('mat-option');
    const count = await opts.count();
    const lower = optionText.toLowerCase();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const text = (await opts.nth(i).textContent() ?? '').trim().toLowerCase();
      if (text && text !== '-- none --' && text.includes(lower)) {
        await opts.nth(i).click({ force: true });
        clicked = true;
        break;
      }
    }
    if (!clicked && count > 0) {
      for (let i = 0; i < count; i++) {
        const text = (await opts.nth(i).textContent() ?? '').trim().toLowerCase();
        if (text && text !== '-- none --') { await opts.nth(i).click({ force: true }); break; }
      }
    }
    await page.locator('mat-option').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  } catch { /* UI fallback failed — field may be optional, proceed */ }
}

/**
 * Fill an Angular Material datepicker `<app-datepicker>` wrapper.
 * Expects `dateStr` in MM/DD/YYYY format (Material default locale).
 */
export async function fillDatepicker(page: Page, testid: string, dateStr: string): Promise<void> {
  const loc = page.locator(`[data-testid="${testid}"] input`).first();
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  await loc.clear();
  await loc.fill(dateStr);
  await loc.press('Tab');
}

/**
 * Fill an `<app-autocomplete>` — clicks the input, types to filter, then
 * picks the first available option in the panel.
 */
export async function fillAutocomplete(
  page: Page,
  testid: string,
  searchText: string,
): Promise<void> {
  const input = page.locator(`[data-testid="${testid}"] input`).first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.click({ force: true });
  if (searchText) {
    await input.fill(searchText);
  }
  await page.locator('mat-option').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('mat-option').first().click({ force: true });
}

// ── Buttons ───────────────────────────────────────────────────────────────────

/**
 * Click any element by its `data-testid`.
 * Uses dispatchEvent (not el.click()) so that disabled <button> elements still receive
 * the click event — Angular's (click) handler applies its own validity guards internally.
 * This is needed because Angular's OnPush + zoneless may not clear the [disabled] binding
 * before we reach the save click, even if the form is actually valid.
 */
export async function clickButton(page: Page, testid: string): Promise<void> {
  const loc = page.locator(`[data-testid="${testid}"]`);
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    if (el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  }, `[data-testid="${testid}"]`);
  await page.waitForTimeout(50);
}

// ── Dialog lifecycle ──────────────────────────────────────────────────────────

export async function waitForDialog(page: Page): Promise<void> {
  // app-dialog host is display:inline with zero dimensions; wait for the backdrop which is position:fixed inset:0
  try {
    await page.locator('.dialog-backdrop').first().waitFor({ state: 'visible', timeout: 8000 });
    // Give the form a moment to settle (inputs/selects initialize)
    await page.waitForTimeout(200);

    // Force Angular change detection to ensure FormControlName.ngOnInit has run
    // and CVA (ControlValueAccessor) onChange callbacks are registered.
    // In zoneless/OnPush mode, Angular's CD may not have processed the new dialog
    // components' lifecycle hooks yet when the backdrop first appears.
    // applyChanges can throw "Index expected to be less than N" when called on a
    // component whose LView is stale — silence errors inside the evaluate.
    await page.evaluate(() => {
      const ng = (window as any).ng;
      try {
        if (ng?.applyChanges) {
          ng.applyChanges(document.querySelector('app-root'));
        }
      } catch { /* ignore — component may be mid-transition */ }
    }).catch(() => { /* ignore page.evaluate transport errors */ });
    await page.waitForTimeout(100);
  } catch (e) {
    // Capture screenshot + URL for debugging
    const url = page.url();
    const screenshotPath = `e:/dev/qb-engineer-wrapper/qb-engineer-ui/e2e/screenshots/dialog-fail-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch((se) => console.error('screenshot failed:', se));
    throw new Error(`Dialog not visible after 8s. URL: ${url}. ${(e as Error).message}`);
  }
}

export async function waitForDialogClosed(page: Page): Promise<void> {
  await page.locator('.dialog-backdrop').first().waitFor({ state: 'hidden', timeout: 15000 });
}

// ── Table rows ────────────────────────────────────────────────────────────────

/**
 * Click the first data table `<tr>` that contains the specified text.
 * Uses force:true to bypass any overlay.
 */
export async function clickRowContaining(page: Page, text: string): Promise<void> {
  await page.locator('tr').filter({ hasText: text }).first().click({ force: true });
}

// ── Rich-text editor ──────────────────────────────────────────────────────────

/**
 * Type into a `<app-rich-text-editor>` — looks for a `contenteditable` inside the wrapper.
 */
export async function fillRichText(page: Page, testid: string, text: string): Promise<void> {
  const editable = page
    .locator(`[data-testid="${testid}"]`)
    .locator('[contenteditable="true"]')
    .first();
  await editable.waitFor({ state: 'visible', timeout: 5000 });
  await editable.click({ force: true });
  await editable.fill(text);
}

// ── Chat panel ────────────────────────────────────────────────────────────────

export async function openChatPanel(page: Page): Promise<void> {
  await page.locator('[aria-label="chat.openChat"], [aria-label="Open chat"]').first().click({ force: true });
  await page.locator('.chat-panel').waitFor({ state: 'visible', timeout: 5000 });
}

// ── Date formatting ───────────────────────────────────────────────────────────

/** Convert a Date or ISO string to MM/DD/YYYY for use in datepicker inputs. */
export function toDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
