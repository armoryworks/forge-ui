/**
 * Admin User Onboarding E2E
 *
 * Completes the full onboarding flow for the admin user via the UI:
 *   1. Profile (name, DOB, gender)
 *   2. Contact & Address (phone, email, mailing address)
 *   3. Emergency Contact
 *   4. W-4 Federal Tax Withholding
 *   5. I-9 Employment Eligibility (with identity document upload)
 *   6. State Tax Withholding (Idaho W-4)
 *   7. Workers' Comp Acknowledgment
 *   8. Employee Handbook Acknowledgment
 *   9. Direct Deposit Authorization
 */

import { test, request, Page, APIRequestContext } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';
import path from 'path';
import fs from 'fs';

test.setTimeout(300_000); // 5 minutes for the full flow

const BASE_URL = 'http://localhost:4200';
const API_BASE  = 'http://localhost:5000/api/v1/';

// Fake identity document — reuse a screenshot PNG
const FAKE_ID_DOC = path.join(__dirname, '../screenshots/account-tax-forms-i9.png');

// ─── Auth ──────────────────────────────────────────────────────────────────

let _authToken: string = '';
let _userId: number = 0;

async function loginAsAdmin(page: Page): Promise<void> {
  const api = await request.newContext({ baseURL: API_BASE });
  const res  = await api.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  const { token, user } = await res.json();
  _authToken = token;
  _userId = user.id;
  await api.dispose();

  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('qbe-token', t);
      localStorage.setItem('qbe-user', JSON.stringify(u));
      localStorage.setItem('language', 'en');
    },
    { t: token, u: user },
  );
}

// ─── API: Upload identity document (bypasses OnPush + display:none file input) ─

async function uploadIdentityDocViaApi(): Promise<void> {
  const api = await request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${_authToken}` },
  });

  // Step 1: upload file to storage (entity type must be "employees")
  const fileBytes = fs.readFileSync(FAKE_ID_DOC);
  const uploadRes = await api.post(`employees/${_userId}/files`, {
    multipart: {
      file: {
        name: 'identity-doc.png',
        mimeType: 'image/png',
        buffer: fileBytes,
      },
    },
  });
  if (!uploadRes.ok()) {
    console.warn('File upload failed:', uploadRes.status(), await uploadRes.text());
    await api.dispose();
    return;
  }
  const { id: fileId } = await uploadRes.json();

  // Step 2: create identity document record
  const docRes = await api.post(`identity-documents/me?fileAttachmentId=${fileId}`, {
    data: { documentType: 'ListA', expiresAt: null },
  });
  if (!docRes.ok()) {
    console.warn('Identity doc creation failed:', docRes.status(), await docRes.text());
  } else {
    console.log('Identity doc uploaded via API, fileId:', fileId);
  }
  await api.dispose();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Clear + fill an <app-input> by its visible label text */
async function fillAppInput(page: Page, label: string, value: string) {
  // Dismiss any open overlay (mat-select dropdown) before clicking
  await page.keyboard.press('Escape');
  const input = page
    .locator('app-input')
    .filter({ hasText: label })
    .locator('input')
    .first();
  await input.click({ clickCount: 3, force: true });
  await input.fill(value);
}

/** Fill an <app-datepicker> by its visible label text */
async function fillAppDate(page: Page, label: string, value: string) {
  const input = page
    .locator('app-datepicker')
    .filter({ hasText: label })
    .locator('input')
    .first();
  await input.click({ clickCount: 3, force: true });
  await input.fill(value);
}

/** Open a Material <app-select> and click an option */
async function selectAppOption(page: Page, label: string, option: string) {
  await page.locator('app-select').filter({ hasText: label }).locator('mat-select').click();
  await page.locator('mat-option').filter({ hasText: option }).first().click();
}

/** Click the primary save button inside .account-page__actions */
async function clickPageSave(page: Page) {
  await page.locator('.account-page__actions .action-btn--primary').click();
  await page.waitForTimeout(1500);
}

/** Click "Submit Form" in the compliance-form-renderer footer */
async function clickSubmitForm(page: Page) {
  await page.locator('.compliance-form__actions .action-btn--primary').click();
  await page.waitForTimeout(2500);
}

/**
 * Fill a gov-form field by aria-label (or partial aria-label via contains).
 * Accepts both <input> and <textarea>. Uses the first matching element.
 */
async function fillGovInput(page: Page, ariaLabel: string, value: string) {
  const el = page
    .locator(`input[aria-label="${ariaLabel}"], textarea[aria-label="${ariaLabel}"]`)
    .first();
  await el.click({ clickCount: 3, force: true });
  await el.fill(value);
}

/**
 * If the form page shows "Resubmit Form" (already completed), click it
 * so we can re-enter and re-submit the form.
 */
async function ensureFormActive(page: Page) {
  // Translation key 'account.resubmitForm' = "Submit New Version"
  const btn = page.locator('button:has-text("Submit New Version")');
  const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
}

async function settle(page: Page, ms = 1200) {
  await page.waitForTimeout(ms);
}

// ─── Steps ─────────────────────────────────────────────────────────────────

async function completeProfile(page: Page) {
  console.log('Step 1: Profile');
  await page.goto(`${BASE_URL}/account/profile`, { waitUntil: 'networkidle' });
  await settle(page);

  await fillAppInput(page, 'First Name', 'Admin');
  await fillAppInput(page, 'Last Name', 'User');
  await fillAppDate(page, 'Date of Birth', '01/15/1985');

  const genderSel = page.locator('app-select').filter({ hasText: 'Gender' });
  if (await genderSel.count() > 0) {
    await genderSel.locator('mat-select').click();
    await page.locator('mat-option').first().click();
  }

  await clickPageSave(page);
  await page.screenshot({ path: 'e2e/screenshots/onboarding-01-profile.png' });
}

async function completeContact(page: Page) {
  console.log('Step 2: Contact & Address');
  await page.goto(`${BASE_URL}/account/contact`, { waitUntil: 'networkidle' });
  await settle(page);

  await fillAppInput(page, 'Phone Number', '(208) 555-0100');
  await fillAppInput(page, 'Personal Email', 'admin.personal@example.com');

  // Address form (app-address-form — embedded inside the contact card)
  await fillAppInput(page, 'Street Address', '123 Main St');
  await fillAppInput(page, 'City', 'Boise');

  const stateSel = page.locator('app-address-form app-select').filter({ hasText: 'State' });
  if (await stateSel.count() > 0) {
    await stateSel.locator('mat-select').click();
    // State options use 2-letter abbreviations (ID, CA, etc.)
    await page.locator('mat-option').filter({ hasText: /^ID$/ }).first().click();
  }

  await fillAppInput(page, 'ZIP', '83702');

  await clickPageSave(page);
  await page.screenshot({ path: 'e2e/screenshots/onboarding-02-contact.png' });
}

async function completeEmergency(page: Page) {
  console.log('Step 3: Emergency Contact');
  await page.goto(`${BASE_URL}/account/emergency`, { waitUntil: 'networkidle' });
  await settle(page);

  await fillAppInput(page, 'Contact Name', 'Jane User');
  await fillAppInput(page, 'Contact Phone', '(208) 555-0199');

  const relSel = page.locator('app-select').filter({ hasText: 'Relationship' });
  if (await relSel.count() > 0) {
    await relSel.locator('mat-select').click();
    await page.locator('mat-option').first().click();
  }

  await clickPageSave(page);
  await page.screenshot({ path: 'e2e/screenshots/onboarding-03-emergency.png' });
}

async function completeW4(page: Page) {
  console.log('Step 4: W-4');
  await page.goto(`${BASE_URL}/account/tax-forms/w4`, { waitUntil: 'networkidle' });
  await settle(page, 2000);
  await ensureFormActive(page);

  // Step 1 — Personal information (all required fields on Page 1)
  await fillGovInput(page, '(a) First name and middle initial', 'Admin');
  await fillGovInput(page, 'Last name', 'User');
  await fillGovInput(page, 'Social security number', '123-45-6789');
  await fillGovInput(page, 'Address', '123 Main St');
  await fillGovInput(page, 'City or town, state, and ZIP code', 'Boise, ID 83702');

  // (c) Filing status — click the label wrapper to properly trigger Angular's RadioControlValueAccessor
  const filingLabel = page.locator('.gov-form__filing-status .gov-form__radio').first();
  if (await filingLabel.count() > 0) {
    await filingLabel.click({ force: true });
    await page.waitForTimeout(300);
  }

  // Step 5 — Signature
  const sigInput = page.locator('input.gov-form__input--signature').first();
  if (await sigInput.count() > 0) {
    await sigInput.click({ clickCount: 3, force: true });
    await sigInput.fill('Admin User');
  }

  // Date — only fill if currently empty
  const dateInput = page.locator('input[aria-label="Date"]').first();
  if (await dateInput.count() > 0) {
    if (!(await dateInput.inputValue())) {
      await dateInput.fill('03/20/2026');
    }
  }

  await page.screenshot({ path: 'e2e/screenshots/onboarding-04-w4-filled.png' });
  await clickSubmitForm(page);
  await page.screenshot({ path: 'e2e/screenshots/onboarding-04-w4-done.png' });
}

async function completeI9(page: Page) {
  console.log('Step 5: I-9');

  // Upload identity doc via API first (bypasses display:none file input + OnPush + zoneless issues).
  // When the I-9 page loads, identityDocuments() will already have the doc → extraValidation passes.
  await uploadIdentityDocViaApi();

  await page.goto(`${BASE_URL}/account/tax-forms/i9`, { waitUntil: 'networkidle' });
  // Wait for the form to be fully initialized (savedFormData arrives async which triggers form recreation)
  await page.waitForSelector('input[aria-label="Last Name (Family Name)"]', { timeout: 10000 });
  await settle(page, 2000);
  await ensureFormActive(page);

  // ── Section 1 — Employee Information ──────────────────────────────────────
  await fillGovInput(page, 'Last Name (Family Name)', 'User');
  await fillGovInput(page, 'First Name (Given Name)', 'Admin');
  await fillGovInput(page, 'Address (Street Number and Name)', '123 Main St');
  await fillGovInput(page, 'City or Town', 'Boise');
  await fillGovInput(page, 'State', 'ID');
  await fillGovInput(page, 'ZIP Code', '83702');
  await fillGovInput(page, 'Date of Birth (mm/dd/yyyy)', '01/15/1985');

  // Citizenship status — click the label wrapper to properly trigger Angular's RadioControlValueAccessor
  const citizenLabel = page.locator('.gov-form__filing-status .gov-form__radio').first();
  if (await citizenLabel.count() > 0) {
    await citizenLabel.click({ force: true });
    await page.waitForTimeout(300);
  }

  // Section 1 — Employee signature (use aria-label for precise targeting)
  const sig1 = page.locator('input[aria-label="Signature of Employee"]');
  if (await sig1.count() > 0) {
    await sig1.click({ clickCount: 3, force: true });
    await sig1.fill('Admin User');
  } else {
    // Fallback: first signature input
    const sig1fb = page.locator('input.gov-form__input--signature').first();
    await sig1fb.click({ clickCount: 3, force: true });
    await sig1fb.fill('Admin User');
  }

  // Section 1 — Today's date (matches both straight and curly apostrophe)
  const todayDateInputs = page.locator('input[aria-label*="Today"]');
  if (await todayDateInputs.count() > 0 && !(await todayDateInputs.first().inputValue())) {
    await todayDateInputs.first().fill('03/20/2026');
  }

  // ── Section 2 — Employer Certification ────────────────────────────────────
  await fillGovInput(page, 'Document Title 1', 'U.S. Passport');
  await fillGovInput(page, 'Issuing Authority', 'U.S. Dept. of State');
  await fillGovInput(page, 'Document Number (if any)', 'P12345678');

  const firstDayInput = page.locator('input[aria-label="First Day of Employment (mm/dd/yyyy)"]');
  if (await firstDayInput.count() > 0) await firstDayInput.fill('01/06/2025');

  // Section 2 — Employer signature (last signature field on the page)
  const sig2 = page.locator('input.gov-form__input--signature').last();
  if (await sig2.count() > 0) {
    await sig2.click({ clickCount: 3, force: true });
    await sig2.fill('Admin User');
  }

  const empNameInput = page.locator('input[aria-label*="Business or Organization Name"]');
  if (await empNameInput.count() > 0) await empNameInput.fill('QB Engineer Inc.');

  // Re-fill fields that might be wiped by form re-initialization (savedFormData arrives async)
  await settle(page, 500);
  await fillGovInput(page, 'Last Name (Family Name)', 'User');
  const sig1b = page.locator('input[aria-label="Signature of Employee"]');
  if (await sig1b.count() > 0 && !(await sig1b.inputValue())) {
    await sig1b.click({ clickCount: 3, force: true });
    await sig1b.fill('Admin User');
  }

  await page.screenshot({ path: 'e2e/screenshots/onboarding-05-i9-filled.png' });
  await clickSubmitForm(page);
  await page.screenshot({ path: 'e2e/screenshots/onboarding-05-i9-done.png' });
}

async function completeStateWithholding(page: Page) {
  console.log('Step 6: State Withholding (Idaho W-4)');
  await page.goto(`${BASE_URL}/account/tax-forms/stateWithholding`, { waitUntil: 'networkidle' });
  await settle(page, 2000);
  await ensureFormActive(page);

  // Withholding Status — click the label wrapper to properly trigger Angular's RadioControlValueAccessor
  const statusLabel = page.locator('.gov-form__filing-status .gov-form__radio').first();
  if (await statusLabel.count() > 0) {
    await statusLabel.click({ force: true });
    await page.waitForTimeout(300);
  }

  // Line 1 — Total allowances (amount-line, aria-label is the amountLabel "1")
  const allowancesInput = page.locator('input[aria-label="1"]').first();
  if (await allowancesInput.count() > 0) {
    await allowancesInput.fill('1');
  }

  // Grid fields (labels confirmed from rendered HTML)
  await fillGovInput(page, 'Social security number', '123-45-6789');
  await fillGovInput(page, 'First name and middle initial', 'Admin');
  await fillGovInput(page, 'Last name', 'User');
  await fillGovInput(page, 'Current mailing address', '123 Main St');
  await fillGovInput(page, 'City', 'Boise');
  await fillGovInput(page, 'State', 'ID');
  await fillGovInput(page, 'ZIP Code', '83702');

  // Signature (aria-label="Signature" confirmed from rendered HTML)
  const sigInput = page.locator('input[aria-label="Signature"], input.gov-form__input--signature').first();
  if (await sigInput.count() > 0) {
    await sigInput.click({ clickCount: 3, force: true });
    await sigInput.fill('Admin User');
  }

  // Date (aria-label="Date" confirmed from rendered HTML) — fill only if empty
  const dateInput = page.locator('input[aria-label="Date"]').first();
  if (await dateInput.count() > 0 && !(await dateInput.inputValue())) {
    await dateInput.fill('03/20/2026');
  }

  await page.screenshot({ path: 'e2e/screenshots/onboarding-06-state-withholding.png' });
  await clickSubmitForm(page);
  await page.screenshot({ path: 'e2e/screenshots/onboarding-06-state-done.png' });
}

async function acknowledgeForm(page: Page, formType: string, screenshotName: string) {
  console.log(`Step: Acknowledge ${formType}`);
  await page.goto(`${BASE_URL}/account/tax-forms/${formType}`, { waitUntil: 'networkidle' });

  // Wait for the template to load (form detail renders either the status-complete div,
  // the acknowledge button, or the pending-setup banner — any of these confirms load).
  await page.waitForSelector(
    '.form-detail__status--complete, button:has-text("Acknowledge & Complete"), .form-detail__pending-setup',
    { timeout: 10000 },
  ).catch(() => null);
  await settle(page, 500);

  // If already complete: "Acknowledge & Complete" won't show (isComplete() blocks it, and
  // startResubmit() only affects forms with a formDefinition). Just screenshot and move on.
  const alreadyComplete = await page.locator('.form-detail__status--complete').isVisible({ timeout: 2000 }).catch(() => false);
  if (alreadyComplete) {
    console.log(`  ${formType} already acknowledged — skipping`);
    await page.screenshot({ path: `e2e/screenshots/${screenshotName}.png` });
    return;
  }

  await page.locator('button:has-text("Acknowledge & Complete")').click();
  await settle(page, 1500);
  await page.screenshot({ path: `e2e/screenshots/${screenshotName}.png` });
}

// ─── Main test ─────────────────────────────────────────────────────────────

test('Complete admin user onboarding', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await loginAsAdmin(page);

  await completeProfile(page);
  await completeContact(page);
  await completeEmergency(page);
  await completeW4(page);
  await completeI9(page);
  await completeStateWithholding(page);
  await acknowledgeForm(page, 'workersComp', 'onboarding-07-workers-comp');
  await acknowledgeForm(page, 'handbook', 'onboarding-08-handbook');
  await acknowledgeForm(page, 'directDeposit', 'onboarding-09-direct-deposit');

  // Final — view completeness on the tax forms list
  await page.goto(`${BASE_URL}/account/tax-forms`, { waitUntil: 'networkidle' });
  await settle(page, 1500);
  await page.screenshot({ path: 'e2e/screenshots/onboarding-10-final-status.png', fullPage: true });

  console.log('Onboarding complete!');
  await context.close();
});
