import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { randomDelay, testId, maybe, randomPick, randomInt } from '../../lib/random.lib';

/**
 * Production Bravo workflow — simulates a maintenance worker's shift.
 *
 * Focused on the Maintenance track: kanban board, asset management,
 * inventory checks, quality inspections, and chat updates.
 * Includes some error-path scenarios (searching for nonexistent items,
 * navigating to pages that may have no data).
 *
 * Runs in a loop with ~20 steps per iteration.
 */
export function getProductionBravoWorkflow(): Workflow {
  return {
    name: 'production-bravo',
    steps: [
      // ---------------------------------------------------------------
      // 1. Dashboard check-in
      // ---------------------------------------------------------------
      {
        id: 'pb-01',
        name: 'Navigate to dashboard',
        execute: async (page: Page) => {
          await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
          // Wait for at least one dashboard widget to render
          await page.locator('app-dashboard-widget, .dashboard-widget, .widget').first()
            .waitFor({ state: 'visible', timeout: 10000 })
            .catch(() => {
              // Dashboard may be empty for this user — not critical
            });
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 2. Navigate to kanban board
      // ---------------------------------------------------------------
      {
        id: 'pb-02',
        name: 'Navigate to kanban board',
        execute: async (page: Page) => {
          await page.goto('/kanban', { waitUntil: 'domcontentloaded', timeout: 15000 });
          // Wait for track type buttons or the board columns to appear
          await page.locator('.track-type-btn, .board-column, app-board-column').first()
            .waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 3. Switch to Maintenance track
      // ---------------------------------------------------------------
      {
        id: 'pb-03',
        name: 'Switch to Maintenance track',
        execute: async (page: Page) => {
          // Look for a track type button containing "Maintenance"
          const maintenanceBtn = page.locator('.track-type-btn', { hasText: /maintenance/i });
          const count = await maintenanceBtn.count();

          if (count > 0) {
            await maintenanceBtn.first().click();
            // Wait for board to reload after track switch
            await page.waitForTimeout(randomDelay(1000, 2000));
            await page.locator('.board-column, app-board-column, .column').first()
              .waitFor({ state: 'visible', timeout: 8000 })
              .catch(() => { /* Board may be empty for maintenance track */ });
          }
          // If no maintenance track button, just stay on current track
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 4. Browse maintenance jobs — count visible cards
      // ---------------------------------------------------------------
      {
        id: 'pb-04',
        name: 'Browse maintenance jobs',
        execute: async (page: Page) => {
          const cards = page.locator('app-job-card, .card[class*="card"]');
          const cardCount = await cards.count().catch(() => 0);
          // Just observe the board — maintenance workers scan before picking work
          if (cardCount > 0) {
            // Scroll through the board horizontally if needed
            const board = page.locator('.board, .board-container').first();
            if (await board.count() > 0) {
              await board.evaluate((el) => {
                el.scrollLeft = Math.random() * el.scrollWidth;
              }).catch(() => { /* scroll attempt is best-effort */ });
            }
          }
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 5. Open a random job detail
      // ---------------------------------------------------------------
      {
        id: 'pb-05',
        name: 'Open a job detail',
        execute: async (page: Page) => {
          const cards = page.locator('app-job-card');
          const count = await cards.count();

          if (count === 0) {
            // No jobs on board — skip gracefully
            await page.waitForTimeout(randomDelay(500, 1000));
            return;
          }

          // Click a random card
          const idx = randomInt(0, count - 1);
          await cards.nth(idx).click({ timeout: 5000 });

          // Wait for detail dialog/panel to open
          await page.locator('.cdk-overlay-container mat-dialog-container, app-job-detail-panel, .panel__header')
            .first()
            .waitFor({ state: 'visible', timeout: 8000 })
            .catch(() => {
              // Detail panel may not open if card click was intercepted
            });
          await page.waitForTimeout(randomDelay(1000, 2000));
        },
      },

      // ---------------------------------------------------------------
      // 6. Read job info — verify content loaded
      // ---------------------------------------------------------------
      {
        id: 'pb-06',
        name: 'Read job info',
        execute: async (page: Page) => {
          // Check for job number or title in the detail panel/dialog
          const detailVisible = await page.locator('.panel__job-number, .dialog__header, .jd-body')
            .first()
            .isVisible()
            .catch(() => false);

          if (detailVisible) {
            // Scroll through the detail content
            const body = page.locator('.jd-body, .dialog__body, mat-dialog-content').first();
            if (await body.isVisible().catch(() => false)) {
              await body.evaluate((el) => {
                el.scrollTop = el.scrollHeight * 0.5;
              }).catch(() => { /* best-effort scroll */ });
            }
          }
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 7. Browse files section in job detail
      // ---------------------------------------------------------------
      {
        id: 'pb-07',
        name: 'Browse files section',
        execute: async (page: Page) => {
          // Look for a files section header in the detail panel
          const filesSection = page.locator('text=Files, text=Attachments, .jd-sidebar-section__title:has-text("Files")').first();
          const visible = await filesSection.isVisible().catch(() => false);

          if (visible) {
            // Scroll to the files section
            await filesSection.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 8. Close job detail
      // ---------------------------------------------------------------
      {
        id: 'pb-08',
        name: 'Close job detail',
        execute: async (page: Page) => {
          // Try the close button on the panel/dialog
          const closeBtn = page.locator(
            '.panel__close, [aria-label*="close" i], [aria-label*="Close" i], button:has(span.material-icons-outlined:text("close"))'
          ).first();

          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click({ timeout: 5000 });
            await page.waitForTimeout(randomDelay(300, 600));
          } else {
            // Fallback: press Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 9. Navigate to assets (equipment management)
      // ---------------------------------------------------------------
      {
        id: 'pb-09',
        name: 'Navigate to assets',
        execute: async (page: Page) => {
          await page.goto('/assets', { waitUntil: 'domcontentloaded', timeout: 15000 });
          // Wait for data table or empty state
          await page.locator('app-data-table, app-empty-state, .page-header').first()
            .waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 10. Search assets
      // ---------------------------------------------------------------
      {
        id: 'pb-10',
        name: 'Search assets',
        execute: async (page: Page) => {
          const searchTerms = ['CNC', 'lathe', 'drill', 'press', 'mill', 'saw', 'welder', 'compressor', 'pump'];
          const searchInput = page.locator('app-input input[type="text"], input[placeholder*="earch" i]').first();

          if (await searchInput.isVisible().catch(() => false)) {
            const term = randomPick(searchTerms);
            await searchInput.fill('');
            await searchInput.fill(term);
            await page.waitForTimeout(randomDelay(800, 1500));
          }

          // Error path: sometimes search for nonsense to test empty results
          if (maybe(0.3)) {
            const nonsense = testId('zzznoexist');
            if (await searchInput.isVisible().catch(() => false)) {
              await searchInput.fill(nonsense);
              await page.waitForTimeout(randomDelay(500, 1000));
              // Clear the bad search
              await searchInput.fill('');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 11. Open an asset detail
      // ---------------------------------------------------------------
      {
        id: 'pb-11',
        name: 'Open asset detail',
        execute: async (page: Page) => {
          const rows = page.locator('app-data-table tbody tr, .data-table__row');
          const count = await rows.count().catch(() => 0);

          if (count === 0) {
            // No assets — skip gracefully
            await page.waitForTimeout(randomDelay(500, 800));
            return;
          }

          const idx = randomInt(0, Math.min(count - 1, 9)); // Pick from first 10
          await rows.nth(idx).click({ timeout: 5000 }).catch(() => {});

          // Wait for detail dialog
          await page.locator('.cdk-overlay-container mat-dialog-container, app-detail-side-panel')
            .first()
            .waitFor({ state: 'visible', timeout: 8000 })
            .catch(() => {
              // Detail may not open — some tables don't have row click
            });
          await page.waitForTimeout(randomDelay(1000, 2000));
        },
      },

      // ---------------------------------------------------------------
      // 12. Close asset detail
      // ---------------------------------------------------------------
      {
        id: 'pb-12',
        name: 'Close asset detail',
        execute: async (page: Page) => {
          // Close any open dialog or panel
          const closeBtn = page.locator(
            'mat-dialog-container [aria-label*="close" i], mat-dialog-container button:has(span:text("close")), .panel__close'
          ).first();

          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click({ timeout: 5000 });
          } else {
            await page.keyboard.press('Escape');
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 13. Navigate to inventory
      // ---------------------------------------------------------------
      {
        id: 'pb-13',
        name: 'Navigate to inventory',
        execute: async (page: Page) => {
          await page.goto('/inventory', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.locator('app-data-table, app-empty-state, .page-header, .tab').first()
            .waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 14. Search inventory
      // ---------------------------------------------------------------
      {
        id: 'pb-14',
        name: 'Search inventory',
        execute: async (page: Page) => {
          const searchTerms = ['bolt', 'nut', 'bearing', 'seal', 'gasket', 'filter', 'belt', 'hose', 'wire'];
          const searchInput = page.locator('app-input input[type="text"], input[placeholder*="earch" i]').first();

          if (await searchInput.isVisible().catch(() => false)) {
            const term = randomPick(searchTerms);
            await searchInput.fill('');
            await searchInput.fill(term);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Clear search for next step
            await searchInput.fill('');
            await page.waitForTimeout(randomDelay(300, 500));
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 15. Navigate to quality
      // ---------------------------------------------------------------
      {
        id: 'pb-15',
        name: 'Navigate to quality',
        execute: async (page: Page) => {
          await page.goto('/quality', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.locator('.page-header, app-data-table, app-empty-state, .tab').first()
            .waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 16. Browse inspections
      // ---------------------------------------------------------------
      {
        id: 'pb-16',
        name: 'Browse inspections',
        execute: async (page: Page) => {
          // Check if inspection table has rows
          const rows = page.locator('app-data-table tbody tr, .data-table__row');
          const count = await rows.count().catch(() => 0);

          if (count > 0 && maybe(0.5)) {
            // Click a random inspection row to view detail
            const idx = randomInt(0, Math.min(count - 1, 4));
            await rows.nth(idx).click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Close any opened dialog
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 17. Open chat and send maintenance update
      // ---------------------------------------------------------------
      {
        id: 'pb-17',
        name: 'Send chat message',
        execute: async (page: Page) => {
          // Chat is a panel triggered from the header, not a route
          const chatBtn = page.locator('button[aria-label*="hat" i], button:has(span.material-icons-outlined:text("chat"))').first();

          try {
            if (await chatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await chatBtn.click({ timeout: 5000 });
              await page.waitForTimeout(randomDelay(800, 1500));

              // Check if chat panel opened
              const chatPanel = page.locator('.chat-panel');
              if (await chatPanel.isVisible().catch(() => false)) {
                // Try to select a conversation or find the first one
                const conversations = page.locator('.chat-panel__conversations [role="button"], .chat-panel__conversations .conversation-item, .chat-panel__conversations > div > div');
                const convCount = await conversations.count().catch(() => 0);

                if (convCount > 0) {
                  await conversations.first().click({ timeout: 3000 }).catch(() => {});
                  await page.waitForTimeout(randomDelay(500, 1000));
                }

                // Type and send a message
                const messageInput = page.locator('[data-testid="chat-message-input"]');
                if (await messageInput.isVisible().catch(() => false)) {
                  const statuses = [
                    'Equipment check complete',
                    'PM schedule on track',
                    'Replaced filters on unit 3',
                    'Compressor pressure nominal',
                    'Awaiting parts for conveyor repair',
                    'Bearing replacement done',
                    'Lubrication cycle finished',
                    'Safety inspection passed',
                  ];
                  const message = `Bravo team maintenance update: ${randomPick(statuses)}`;
                  await messageInput.fill(message);
                  await page.waitForTimeout(randomDelay(300, 600));

                  const sendBtn = page.locator('[data-testid="chat-send-btn"]');
                  if (await sendBtn.isVisible().catch(() => false)) {
                    await sendBtn.click({ timeout: 3000 });
                  } else {
                    // Fallback: press Enter to send
                    await messageInput.press('Enter');
                  }
                  await page.waitForTimeout(randomDelay(500, 1000));
                }

                // Close chat panel
                await chatBtn.click({ timeout: 3000 }).catch(() => {
                  page.keyboard.press('Escape');
                });
              }
            }
          } catch {
            // Chat failures are non-critical — close any overlay and move on
            await page.keyboard.press('Escape').catch(() => {});
          }
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ---------------------------------------------------------------
      // 18. Navigate to time tracking
      // ---------------------------------------------------------------
      {
        id: 'pb-18',
        name: 'Navigate to time tracking',
        execute: async (page: Page) => {
          await page.goto('/time-tracking', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.locator('.page-header, app-data-table, app-empty-state').first()
            .waitFor({ state: 'visible', timeout: 10000 });
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // 19. Check for running timer
      // ---------------------------------------------------------------
      {
        id: 'pb-19',
        name: 'Check for running timer',
        execute: async (page: Page) => {
          // Look for active timer indicator in the header or time tracking page
          const activeTimer = page.locator(
            '.timer--active, .active-timer, [class*="timer"][class*="active"], .panel__timer-btn--active'
          ).first();

          const hasTimer = await activeTimer.isVisible().catch(() => false);

          if (hasTimer) {
            // If there's a running timer, just observe it
            await page.waitForTimeout(randomDelay(500, 1000));
          }

          // Error path: occasionally try to scroll past the bottom of time entries
          if (maybe(0.2)) {
            const tableContainer = page.locator('app-data-table .data-table__scroll, .table-container').first();
            if (await tableContainer.isVisible().catch(() => false)) {
              await tableContainer.evaluate((el) => {
                el.scrollTop = el.scrollHeight + 500;
              }).catch(() => {});
            }
          }
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ---------------------------------------------------------------
      // 20. Return to kanban board
      // ---------------------------------------------------------------
      {
        id: 'pb-20',
        name: 'Return to kanban board',
        execute: async (page: Page) => {
          await page.goto('/kanban', { waitUntil: 'domcontentloaded', timeout: 15000 });
          // Confirm board loaded
          await page.locator('.track-type-btn, .board-column, app-board-column').first()
            .waitFor({ state: 'visible', timeout: 10000 });

          // Re-select Maintenance track if available
          const maintenanceBtn = page.locator('.track-type-btn', { hasText: /maintenance/i });
          if (await maintenanceBtn.first().isVisible().catch(() => false)) {
            await maintenanceBtn.first().click();
            await page.waitForTimeout(randomDelay(800, 1500));
          }
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },
    ],
  };
}
