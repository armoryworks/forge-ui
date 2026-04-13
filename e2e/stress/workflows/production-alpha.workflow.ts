import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { randomDelay, testId, maybe, randomPick, randomInt } from '../../lib/random.lib';

// ---------------------------------------------------------------------------
// Production Alpha Workflow
//
// Simulates a production worker on the Production track during a shift.
// Steps represent one iteration of typical activities: checking the board,
// working on jobs, tracking time, looking up parts, and communicating
// with the team. The orchestrator loops this workflow for the test duration.
// ---------------------------------------------------------------------------

const SEARCH_TERMS = ['steel', 'aluminum', 'bearing', 'shaft', 'bracket', 'housing', 'gasket', 'flange', 'bolt', 'plate'];
const CHAT_MESSAGES = [
  'Alpha team check-in: on station, ready to go.',
  'Starting next job on the board.',
  'Material looks good, moving to production.',
  'QC passed on last batch, moving forward.',
  'Need a quick hand at station 3 when someone is free.',
  'Wrapping up current task, about to clock a break.',
  'Heads up — tooling on press 2 needs inspection soon.',
  'All clear on my end, proceeding to next job.',
  'Just finished setup, starting run now.',
  'Part count verified, marking batch complete.',
];
const NAV_TIMEOUT = 15_000;
const ELEMENT_TIMEOUT = 8_000;

export function getProductionAlphaWorkflow(): Workflow {
  return {
    name: 'production-alpha',
    steps: [
      // ------------------------------------------------------------------
      // 1. Dashboard overview
      // ------------------------------------------------------------------
      {
        id: 'pa-01',
        name: 'Navigate to dashboard',
        execute: async (page: Page) => {
          await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.waitForSelector('.dashboard-widget, app-dashboard-widget', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ------------------------------------------------------------------
      // 2. Check notifications
      // ------------------------------------------------------------------
      {
        id: 'pa-02',
        name: 'Check notifications',
        execute: async (page: Page) => {
          try {
            const bellButton = page.locator('button[aria-label*="otification"], button[aria-label*="bell"], .notification-bell').first();
            if (await bellButton.isVisible({ timeout: 3000 })) {
              await bellButton.click();
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Read notification count if visible
              const badge = page.locator('.notification-badge, .mat-badge-content').first();
              if (await badge.isVisible({ timeout: 1000 }).catch(() => false)) {
                await badge.textContent();
              }

              // Scroll through notifications briefly
              const panel = page.locator('.notification-panel, app-notification-panel').first();
              if (await panel.isVisible({ timeout: 2000 }).catch(() => false)) {
                await page.waitForTimeout(randomDelay(500, 1500));
              }

              // Close the panel — click outside or press Escape
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            // Notifications panel may not be available — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 3. Navigate to kanban board
      // ------------------------------------------------------------------
      {
        id: 'pa-03',
        name: 'Navigate to kanban board',
        execute: async (page: Page) => {
          await page.goto('/kanban', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.waitForSelector('.kanban-board, .board-column, app-kanban-board', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ------------------------------------------------------------------
      // 4. Browse job cards on the board
      // ------------------------------------------------------------------
      {
        id: 'pa-04',
        name: 'Browse job cards',
        execute: async (page: Page) => {
          try {
            const columns = page.locator('.board-column, .kanban-column');
            const columnCount = await columns.count();

            if (columnCount > 0) {
              // Scroll through a couple of columns
              const scrollTarget = randomInt(0, Math.min(columnCount - 1, 4));
              const column = columns.nth(scrollTarget);
              await column.scrollIntoViewIfNeeded().catch(() => {});
              await page.waitForTimeout(randomDelay(600, 1200));
            }

            // Count visible cards
            const cards = page.locator('.job-card, [class*="job-card"]');
            const cardCount = await cards.count();
            // Just reading — simulates scanning the board
            if (cardCount > 0) {
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Board may be empty or still loading — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 5. Open a random job detail
      // ------------------------------------------------------------------
      {
        id: 'pa-05',
        name: 'Open a job detail',
        execute: async (page: Page) => {
          try {
            const cards = page.locator('.job-card, [class*="job-card"]');
            const count = await cards.count();

            if (count === 0) {
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }

            const index = randomInt(0, count - 1);
            const card = cards.nth(index);
            await card.scrollIntoViewIfNeeded().catch(() => {});
            await card.click({ timeout: 5000 });

            // Wait for dialog or detail panel to open
            await page.waitForSelector(
              '.mat-mdc-dialog-container, app-job-detail-panel, [class*="detail-panel"], [class*="cdk-overlay"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));
          } catch {
            // Card click or dialog open failed — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 6. Read job details
      // ------------------------------------------------------------------
      {
        id: 'pa-06',
        name: 'Read job details',
        execute: async (page: Page) => {
          try {
            const dialog = page.locator('.mat-mdc-dialog-container, [class*="detail-panel"]').first();
            if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
              // Simulate reading — scroll through content
              await page.waitForTimeout(randomDelay(1000, 2500));

              // Check if tabs exist in the detail view
              const tabs = dialog.locator('.mat-mdc-tab, [role="tab"]');
              const tabCount = await tabs.count();
              if (tabCount > 0) {
                await page.waitForTimeout(randomDelay(400, 800));
              }
            }
          } catch {
            // Detail may not be open — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 7. Switch to subtasks tab
      // ------------------------------------------------------------------
      {
        id: 'pa-07',
        name: 'View subtasks tab',
        execute: async (page: Page) => {
          try {
            const dialog = page.locator('.mat-mdc-dialog-container, [class*="detail-panel"]').first();
            if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
              // Look for a subtasks tab
              const subtaskTab = dialog.locator('[role="tab"]:has-text("Subtask"), [role="tab"]:has-text("Tasks"), [role="tab"]:has-text("Checklist")').first();
              if (await subtaskTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                await subtaskTab.click();
                await page.waitForTimeout(randomDelay(800, 1500));
              } else {
                // Try clicking the second tab if no labeled subtask tab found
                const allTabs = dialog.locator('[role="tab"]');
                if ((await allTabs.count()) > 1) {
                  await allTabs.nth(1).click();
                  await page.waitForTimeout(randomDelay(600, 1200));
                }
              }
            }
          } catch {
            // Tab interaction failed — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 8. Close job detail
      // ------------------------------------------------------------------
      {
        id: 'pa-08',
        name: 'Close job detail',
        execute: async (page: Page) => {
          try {
            // Try the close button first
            const closeBtn = page.locator(
              '.mat-mdc-dialog-container button[aria-label*="lose"], ' +
              '.mat-mdc-dialog-container button[aria-label*="ismiss"], ' +
              '[class*="detail-panel"] button[aria-label*="lose"], ' +
              'button.dialog__close, button[mat-dialog-close]',
            ).first();

            if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await closeBtn.click();
            } else {
              // Fallback: press Escape
              await page.keyboard.press('Escape');
            }
            await page.waitForTimeout(randomDelay(400, 800));

            // Ensure dialog is gone
            await page.waitForSelector('.mat-mdc-dialog-container', { state: 'hidden', timeout: 3000 }).catch(() => {});
          } catch {
            // Force close via Escape
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(300);
          }
        },
      },

      // ------------------------------------------------------------------
      // 9. Navigate to time tracking
      // ------------------------------------------------------------------
      {
        id: 'pa-09',
        name: 'Navigate to time tracking',
        execute: async (page: Page) => {
          await page.goto('/time-tracking', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.waitForSelector('app-data-table, .time-tracking, [class*="time-tracking"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ------------------------------------------------------------------
      // 10. Start or check timer
      // ------------------------------------------------------------------
      {
        id: 'pa-10',
        name: 'Start or check timer',
        execute: async (page: Page) => {
          try {
            // Look for a running timer indicator first
            const runningTimer = page.locator('[class*="timer--running"], [class*="active-timer"], button:has-text("Stop")').first();
            if (await runningTimer.isVisible({ timeout: 2000 }).catch(() => false)) {
              // Timer is running — just observe it
              await page.waitForTimeout(randomDelay(500, 1000));
              return;
            }

            // Try to start a timer — look for start button
            const startBtn = page.locator(
              'button:has-text("Start"), button:has-text("Clock In"), button[aria-label*="tart timer"]',
            ).first();
            if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              if (maybe(0.4)) {
                // Only start a timer 40% of the time to avoid stacking
                await startBtn.click();
                await page.waitForTimeout(randomDelay(800, 1500));
              }
            }
          } catch {
            // Timer interaction failed — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 11. Navigate to parts catalog
      // ------------------------------------------------------------------
      {
        id: 'pa-11',
        name: 'Navigate to parts catalog',
        execute: async (page: Page) => {
          await page.goto('/parts', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.waitForSelector('app-data-table, table, [class*="data-table"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ------------------------------------------------------------------
      // 12. Search for a part
      // ------------------------------------------------------------------
      {
        id: 'pa-12',
        name: 'Search for a part',
        execute: async (page: Page) => {
          try {
            const searchInput = page.locator(
              '[data-testid="part-search"] input, ' +
              'app-input[label*="earch"] input, ' +
              'input[placeholder*="earch"], ' +
              'mat-form-field input[type="text"]',
            ).first();

            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const term = randomPick(SEARCH_TERMS);
              await searchInput.click();
              await searchInput.clear();
              await searchInput.type(term, { delay: randomInt(30, 80) });
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Clear search afterward
              if (maybe(0.5)) {
                await searchInput.clear();
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            // Search field not found — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 13. Open a part detail
      // ------------------------------------------------------------------
      {
        id: 'pa-13',
        name: 'Open a part detail',
        execute: async (page: Page) => {
          try {
            const rows = page.locator('app-data-table tbody tr, table tbody tr').filter({ hasNot: page.locator('.empty-state') });
            const count = await rows.count();

            if (count === 0) {
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }

            const index = randomInt(0, Math.min(count - 1, 9));
            await rows.nth(index).click({ timeout: 3000 });

            // Wait for detail dialog to open
            await page.waitForSelector(
              '.mat-mdc-dialog-container, [class*="detail-panel"], [class*="cdk-overlay"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));
          } catch {
            // Part row click failed — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 14. Close part detail
      // ------------------------------------------------------------------
      {
        id: 'pa-14',
        name: 'Close part detail',
        execute: async (page: Page) => {
          try {
            const closeBtn = page.locator(
              '.mat-mdc-dialog-container button[aria-label*="lose"], ' +
              'button.dialog__close, button[mat-dialog-close]',
            ).first();

            if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await closeBtn.click();
            } else {
              await page.keyboard.press('Escape');
            }
            await page.waitForTimeout(randomDelay(300, 600));
            await page.waitForSelector('.mat-mdc-dialog-container', { state: 'hidden', timeout: 3000 }).catch(() => {});
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(300);
          }
        },
      },

      // ------------------------------------------------------------------
      // 15. Navigate to chat
      // ------------------------------------------------------------------
      {
        id: 'pa-15',
        name: 'Navigate to chat',
        execute: async (page: Page) => {
          await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.waitForSelector(
            'app-chat, [class*="chat"], [class*="message-list"], [class*="chat-room"]',
            { timeout: ELEMENT_TIMEOUT },
          ).catch(() => {});
          await page.waitForTimeout(randomDelay(500, 1200));
        },
      },

      // ------------------------------------------------------------------
      // 16. Send a chat message
      // ------------------------------------------------------------------
      {
        id: 'pa-16',
        name: 'Send a chat message',
        execute: async (page: Page) => {
          try {
            // Try to select a chat room first if the room list is visible
            const roomItems = page.locator('[class*="room-item"], [class*="chat-room"], [class*="conversation-item"]');
            const roomCount = await roomItems.count();
            if (roomCount > 0) {
              const roomIndex = randomInt(0, Math.min(roomCount - 1, 4));
              await roomItems.nth(roomIndex).click({ timeout: 3000 });
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Find the message input
            const messageInput = page.locator(
              '[data-testid="chat-message-input"] input, ' +
              '[data-testid="chat-message-input"] textarea, ' +
              'textarea[placeholder*="essage"], ' +
              'input[placeholder*="essage"], ' +
              '[class*="message-input"] textarea, ' +
              '[class*="message-input"] input',
            ).first();

            if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const message = `${randomPick(CHAT_MESSAGES)} [${testId('alpha')}]`;
              await messageInput.click();
              await messageInput.fill(message);
              await page.waitForTimeout(randomDelay(300, 600));

              // Send — try Enter key or send button
              const sendBtn = page.locator('button[aria-label*="end"], button:has-text("Send")').first();
              if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await sendBtn.click();
              } else {
                await page.keyboard.press('Enter');
              }
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Chat interaction failed — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 17. Return to kanban board
      // ------------------------------------------------------------------
      {
        id: 'pa-17',
        name: 'Return to kanban board',
        execute: async (page: Page) => {
          await page.goto('/kanban', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
          await page.waitForSelector('.kanban-board, .board-column, app-kanban-board', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
          await page.waitForTimeout(randomDelay(500, 1000));
        },
      },

      // ------------------------------------------------------------------
      // 18. Attempt a job action (simulate stage movement)
      // ------------------------------------------------------------------
      {
        id: 'pa-18',
        name: 'Attempt job action',
        execute: async (page: Page) => {
          try {
            const cards = page.locator('.job-card, [class*="job-card"]');
            const count = await cards.count();

            if (count === 0) {
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }

            // Open a card to access its actions
            const index = randomInt(0, Math.min(count - 1, 9));
            await cards.nth(index).scrollIntoViewIfNeeded().catch(() => {});
            await cards.nth(index).click({ timeout: 5000 });

            // Wait for detail to open
            const dialogVisible = await page.waitForSelector(
              '.mat-mdc-dialog-container, [class*="detail-panel"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => null);

            if (dialogVisible) {
              await page.waitForTimeout(randomDelay(600, 1200));

              // Look for stage-movement or action buttons
              if (maybe(0.3)) {
                const actionBtn = page.locator(
                  'button:has-text("Move"), button:has-text("Advance"), button:has-text("Complete"), ' +
                  'button:has-text("Mark Complete"), button[aria-label*="move"], button[aria-label*="advance"]',
                ).first();

                if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                  await actionBtn.click();
                  await page.waitForTimeout(randomDelay(800, 1500));

                  // If a confirmation dialog appeared, confirm it
                  const confirmBtn = page.locator(
                    '.mat-mdc-dialog-container button:has-text("Confirm"), ' +
                    '.mat-mdc-dialog-container button:has-text("Yes"), ' +
                    '.mat-mdc-dialog-container button:has-text("Move")',
                  ).first();
                  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmBtn.click();
                    await page.waitForTimeout(randomDelay(500, 1000));
                  }
                }
              }

              // Close the detail
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
              await page.waitForSelector('.mat-mdc-dialog-container', { state: 'hidden', timeout: 3000 }).catch(() => {});
            }
          } catch {
            // Job action failed — non-critical, close any open dialog
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(300);
          }
        },
      },

      // ------------------------------------------------------------------
      // 19. Check notifications again
      // ------------------------------------------------------------------
      {
        id: 'pa-19',
        name: 'Check notifications again',
        execute: async (page: Page) => {
          try {
            const bellButton = page.locator('button[aria-label*="otification"], button[aria-label*="bell"], .notification-bell').first();
            if (await bellButton.isVisible({ timeout: 3000 })) {
              await bellButton.click();
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Maybe mark one as read
              if (maybe(0.3)) {
                const unreadItem = page.locator('[class*="notification-item"]:not([class*="read"]), [class*="unread"]').first();
                if (await unreadItem.isVisible({ timeout: 1500 }).catch(() => false)) {
                  await unreadItem.click();
                  await page.waitForTimeout(randomDelay(500, 800));
                }
              }

              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            // Non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 20. Brief idle (reading/thinking time)
      // ------------------------------------------------------------------
      {
        id: 'pa-20',
        name: 'Brief idle',
        execute: async (page: Page) => {
          // Simulate a worker pausing to read a work order, check their phone,
          // or walk to a different station. Vary the duration significantly.
          const idleTime = maybe(0.2)
            ? randomDelay(5000, 10000)  // 20% chance of a longer break
            : randomDelay(1500, 4000);  // 80% short pause
          await page.waitForTimeout(idleTime);
        },
      },
    ],
  };
}
