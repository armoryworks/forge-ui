import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { randomDelay, testId, maybe, randomPick } from '../../lib/random.lib';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_TABS = [
  'users', 'roles', 'settings', 'reference-data', 'track-types',
  'integrations', 'terminology', 'notifications', 'events', 'edi',
  'ai-assistants', 'scheduled-tasks', 'time-corrections', 'mfa',
];

const NAV_TIMEOUT = 10_000;
const ELEMENT_TIMEOUT = 8_000;
const SHORT_TIMEOUT = 5_000;

/** Wait for the DataTable component to appear on the page. */
async function waitForDataTable(page: Page): Promise<void> {
  await page.locator('app-data-table').first().waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
}

/** Wait for any content to load in the admin tab panel area. */
async function waitForAdminContent(page: Page): Promise<void> {
  // Admin pages either have a DataTable, a form, or a card-based layout
  await page.locator('app-data-table, form, .tab-panel, mat-card, .page-content').first()
    .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
}

/** Scroll a container or the page by a random amount. */
async function randomScroll(page: Page): Promise<void> {
  const scrollAmount = Math.floor(Math.random() * 400) + 100;
  await page.mouse.wheel(0, scrollAmount);
  await page.waitForTimeout(randomDelay(300, 800));
}

/** Click a column header in the DataTable to trigger sorting. */
async function sortByRandomColumn(page: Page): Promise<void> {
  const headers = page.locator('app-data-table th[class*="sortable"], app-data-table th');
  const count = await headers.count();
  if (count > 1) {
    const index = Math.floor(Math.random() * Math.min(count, 5));
    await headers.nth(index).click({ timeout: SHORT_TIMEOUT });
    await page.waitForTimeout(randomDelay(500, 1000));
  }
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export function getAdminWorkflow(): Workflow {
  return {
    name: 'admin',
    steps: [
      // ---------------------------------------------------------------
      // 1. Dashboard check
      // ---------------------------------------------------------------
      {
        id: 'adm-01',
        name: 'Navigate to dashboard',
        execute: async (page: Page) => {
          await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.locator('app-dashboard-widget, .dashboard, .page-content').first()
            .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 2. Admin users page
      // ---------------------------------------------------------------
      {
        id: 'adm-02',
        name: 'Navigate to admin users',
        execute: async (page: Page) => {
          await page.goto('/admin/users', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await waitForDataTable(page);
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 3. Browse user list
      // ---------------------------------------------------------------
      {
        id: 'adm-03',
        name: 'Browse user list',
        execute: async (page: Page) => {
          try {
            // Check row count
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();
            if (rowCount === 0) {
              // Empty table — just pause and move on
              await page.waitForTimeout(randomDelay(500, 1000));
              return;
            }

            // Sort by a column
            await sortByRandomColumn(page);

            // Scroll through the list
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(500, 1500));

            // Maybe scroll again
            if (maybe(0.5)) {
              await randomScroll(page);
            }
          } catch {
            // Non-critical — browsing failure does not break the workflow
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 4. Open a user detail
      // ---------------------------------------------------------------
      {
        id: 'adm-04',
        name: 'Open a user detail',
        execute: async (page: Page) => {
          try {
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();
            if (rowCount === 0) {
              await page.waitForTimeout(randomDelay(500, 1000));
              return;
            }

            // Click a random row (prefer first few for stability)
            const index = Math.floor(Math.random() * Math.min(rowCount, 5));
            await rows.nth(index).click({ timeout: SHORT_TIMEOUT });

            // Wait for detail dialog or side panel to appear
            await page.locator('mat-dialog-container, app-detail-side-panel, .cdk-overlay-pane').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch {
            // User detail may not open (no clickable rows configured) — non-critical
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 5. Close user detail
      // ---------------------------------------------------------------
      {
        id: 'adm-05',
        name: 'Close user detail',
        execute: async (page: Page) => {
          try {
            // Try to close any open dialog or panel
            const closeBtn = page.locator(
              'mat-dialog-container button:has(mat-icon:text("close")), ' +
              'mat-dialog-container button[aria-label*="close" i], ' +
              'mat-dialog-container button[aria-label*="Close" i], ' +
              'app-detail-side-panel button:has(mat-icon:text("close")), ' +
              '.cdk-overlay-backdrop',
            ).first();

            if (await closeBtn.isVisible({ timeout: 2000 })) {
              await closeBtn.click({ timeout: SHORT_TIMEOUT });
              await page.waitForTimeout(randomDelay(400, 800));
            }
          } catch {
            // No dialog open — press Escape as fallback
            try {
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            } catch {
              // Ignore
            }
          }
        },
      },

      // ---------------------------------------------------------------
      // 6. Admin settings — company profile
      // ---------------------------------------------------------------
      {
        id: 'adm-06',
        name: 'Navigate to admin settings',
        execute: async (page: Page) => {
          await page.goto('/admin/settings', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await waitForAdminContent(page);
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 7. Review company profile form
      // ---------------------------------------------------------------
      {
        id: 'adm-07',
        name: 'Review company profile',
        execute: async (page: Page) => {
          try {
            // Verify form fields are present (company name, phone, etc.)
            const formFields = page.locator('app-input, app-select, mat-form-field');
            const fieldCount = await formFields.count();

            // Scroll through the settings form
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Maybe check the locations table if visible
            if (maybe(0.4)) {
              const locationsTable = page.locator('app-data-table').first();
              if (await locationsTable.isVisible({ timeout: 2000 })) {
                await randomScroll(page);
              }
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 8. Reference data
      // ---------------------------------------------------------------
      {
        id: 'adm-08',
        name: 'Navigate to reference data',
        execute: async (page: Page) => {
          await page.goto('/admin/reference-data', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await waitForAdminContent(page);
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 9. Browse reference data groups
      // ---------------------------------------------------------------
      {
        id: 'adm-09',
        name: 'Browse reference data',
        execute: async (page: Page) => {
          try {
            // Reference data page may have groups/categories to expand
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(500, 1000));

            // Try clicking a group/row to expand it
            const rows = page.locator('app-data-table tbody tr, .ref-data-group, .expansion-panel');
            const count = await rows.count();
            if (count > 0) {
              const index = Math.floor(Math.random() * Math.min(count, 8));
              await rows.nth(index).click({ timeout: SHORT_TIMEOUT });
              await page.waitForTimeout(randomDelay(500, 1200));
            }

            if (maybe(0.5)) {
              await randomScroll(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 10. Track types
      // ---------------------------------------------------------------
      {
        id: 'adm-10',
        name: 'Navigate to track types',
        execute: async (page: Page) => {
          await page.goto('/admin/track-types', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await waitForAdminContent(page);
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 11. Review track configuration
      // ---------------------------------------------------------------
      {
        id: 'adm-11',
        name: 'Review track configuration',
        execute: async (page: Page) => {
          try {
            // Track types page lists Production, R&D, Maintenance, etc.
            const trackItems = page.locator(
              'app-data-table tbody tr, .track-type-card, mat-expansion-panel, .track-item',
            );
            const count = await trackItems.count();

            if (count > 0 && maybe(0.6)) {
              // Click a track type to view its stages
              const index = Math.floor(Math.random() * Math.min(count, 4));
              await trackItems.nth(index).click({ timeout: SHORT_TIMEOUT });
              await page.waitForTimeout(randomDelay(800, 1500));
            }

            await randomScroll(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 12. Terminology
      // ---------------------------------------------------------------
      {
        id: 'adm-12',
        name: 'Navigate to terminology',
        execute: async (page: Page) => {
          await page.goto('/admin/terminology', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await waitForAdminContent(page);
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 13. Review terminology settings
      // ---------------------------------------------------------------
      {
        id: 'adm-13',
        name: 'Review terminology',
        execute: async (page: Page) => {
          try {
            // Terminology page has a grid/form of configurable labels
            const fields = page.locator('app-input, mat-form-field, .terminology-row');
            const count = await fields.count();

            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));

            // Scroll down to see more terminology entries
            if (maybe(0.5)) {
              await randomScroll(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 14. Events
      // ---------------------------------------------------------------
      {
        id: 'adm-14',
        name: 'Navigate to events',
        execute: async (page: Page) => {
          await page.goto('/admin/events', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await waitForAdminContent(page);
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 15. Browse events
      // ---------------------------------------------------------------
      {
        id: 'adm-15',
        name: 'Browse events',
        execute: async (page: Page) => {
          try {
            const rows = page.locator('app-data-table tbody tr');
            const count = await rows.count();

            if (count > 0) {
              // Sort events
              await sortByRandomColumn(page);
              await randomScroll(page);

              // Maybe click an event to view details
              if (maybe(0.4)) {
                const index = Math.floor(Math.random() * Math.min(count, 5));
                await rows.nth(index).click({ timeout: SHORT_TIMEOUT });
                await page.waitForTimeout(randomDelay(800, 1500));

                // Close any opened dialog
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }

            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 16. Scheduled tasks
      // ---------------------------------------------------------------
      {
        id: 'adm-16',
        name: 'Navigate to scheduled tasks',
        execute: async (page: Page) => {
          await page.goto('/admin/scheduled-tasks', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await waitForAdminContent(page);
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 17. Review scheduled tasks
      // ---------------------------------------------------------------
      {
        id: 'adm-17',
        name: 'Review scheduled tasks',
        execute: async (page: Page) => {
          try {
            const rows = page.locator('app-data-table tbody tr');
            const count = await rows.count();

            if (count > 0) {
              await sortByRandomColumn(page);
              await randomScroll(page);
            }

            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 18. Training (LMS)
      // ---------------------------------------------------------------
      {
        id: 'adm-18',
        name: 'Navigate to training',
        execute: async (page: Page) => {
          await page.goto('/training', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.locator('app-data-table, .training-module, .module-card, .page-content').first()
            .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 19. Browse training modules
      // ---------------------------------------------------------------
      {
        id: 'adm-19',
        name: 'Browse training modules',
        execute: async (page: Page) => {
          try {
            // Training page has module cards or a list view
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(500, 1000));

            // Try clicking a module to view details
            const modules = page.locator(
              '.module-card, app-data-table tbody tr, .training-item, mat-card',
            );
            const count = await modules.count();
            if (count > 0 && maybe(0.5)) {
              const index = Math.floor(Math.random() * Math.min(count, 6));
              await modules.nth(index).click({ timeout: SHORT_TIMEOUT });
              await page.waitForTimeout(randomDelay(800, 1500));

              // Close any opened detail
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }

            if (maybe(0.4)) {
              await randomScroll(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 20. Reports
      // ---------------------------------------------------------------
      {
        id: 'adm-20',
        name: 'Navigate to reports',
        execute: async (page: Page) => {
          await page.goto('/reports', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.locator('app-data-table, .report-card, .report-list, .page-content').first()
            .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 21. Browse report templates
      // ---------------------------------------------------------------
      {
        id: 'adm-21',
        name: 'Browse report templates',
        execute: async (page: Page) => {
          try {
            // Reports page lists saved reports / templates
            const reports = page.locator(
              'app-data-table tbody tr, .report-card, .report-item, mat-card',
            );
            const count = await reports.count();

            await randomScroll(page);
            await page.waitForTimeout(randomDelay(500, 1000));

            if (count > 0 && maybe(0.4)) {
              // Click a report template to preview
              const index = Math.floor(Math.random() * Math.min(count, 5));
              await reports.nth(index).click({ timeout: SHORT_TIMEOUT });
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Navigate back to the reports list
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 22. Chat
      // ---------------------------------------------------------------
      {
        id: 'adm-22',
        name: 'Navigate to chat',
        execute: async (page: Page) => {
          await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.locator('.chat-room, .chat-list, .chat-container, .page-content').first()
            .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
          await page.waitForTimeout(randomDelay(600, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 23. Send admin status message in chat
      // ---------------------------------------------------------------
      {
        id: 'adm-23',
        name: 'Send admin update in chat',
        execute: async (page: Page) => {
          try {
            const messages = [
              'Admin system check: all panels reviewed, system healthy',
              'Verified user accounts and permissions — no issues found',
              'Reference data and terminology settings confirmed',
              'Scheduled tasks running on schedule, no failures',
              'Training module catalog reviewed, all modules active',
              'Track type configuration verified for all production lines',
              'Event calendar reviewed, upcoming events confirmed',
              'System health check complete — all integrations nominal',
            ];

            const message = randomPick(messages);

            // Try to find and click a chat room first
            const rooms = page.locator('.chat-room-item, .room-list-item, .chat-room');
            const roomCount = await rooms.count();
            if (roomCount > 0) {
              await rooms.first().click({ timeout: SHORT_TIMEOUT });
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Find the message input and type
            const chatInput = page.locator(
              'textarea[data-testid="chat-message"], ' +
              'input[data-testid="chat-message"], ' +
              'textarea[placeholder*="message" i], ' +
              'input[placeholder*="message" i], ' +
              '.chat-input textarea, ' +
              '.chat-input input',
            ).first();

            if (await chatInput.isVisible({ timeout: 3000 })) {
              await chatInput.fill(message);
              await page.waitForTimeout(randomDelay(300, 600));

              // Send via Enter or send button
              const sendBtn = page.locator(
                'button[data-testid="chat-send"], button[aria-label*="send" i], button:has(mat-icon:text("send"))',
              ).first();

              if (await sendBtn.isVisible({ timeout: 2000 })) {
                await sendBtn.click({ timeout: SHORT_TIMEOUT });
              } else {
                await chatInput.press('Enter');
              }

              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Chat may not be fully set up — non-critical
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },
    ],
  };
}
