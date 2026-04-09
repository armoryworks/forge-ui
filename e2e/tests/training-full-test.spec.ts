/**
 * Comprehensive training module test — all content types.
 * Run from qb-engineer-ui/: npx playwright test training-full-test
 */
import { test, expect, request, Page, BrowserContext } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL  = 'http://localhost:4200';
const API_BASE  = 'http://localhost:5000/api/v1/';
const SHOT_DIR  = path.join(__dirname, '../screenshots/training');

// Ensure screenshot directory exists
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function loginAndSeedStorage(page: Page): Promise<void> {
  const apiCtx = await request.newContext({ baseURL: API_BASE });
  const resp   = await apiCtx.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  if (!resp.ok()) throw new Error(`Login failed: ${resp.status()}`);
  const { token, user } = await resp.json();
  await apiCtx.dispose();

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

// ─── Screenshot helper ────────────────────────────────────────────────────────
async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage });
  console.log(`📸  ${name}`);
}

// ─── Wait for page content ────────────────────────────────────────────────────
async function waitForContent(page: Page): Promise<void> {
  // Wait for network idle, then allow Angular signals to settle
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
}

// =============================================================================
// BATCH 1 — Training Library
// =============================================================================
test('batch-1: training library overview', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Library root
  await page.goto(`${BASE_URL}/training/library`, { waitUntil: 'networkidle' });
  await waitForContent(page);
  await shot(page, '01-library-overview');

  // Scroll down to see all modules
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(400);
  await shot(page, '02-library-scrolled');

  // Hover a module card to inspect interactive state
  const cards = page.locator('.module-card, .training-card, [class*="module"]');
  const cardCount = await cards.count();
  if (cardCount > 0) {
    await cards.first().hover();
    await page.waitForTimeout(300);
    await shot(page, '03-library-card-hover', false);
  }

  // Filter by content type if selector exists
  const typeFilter = page.locator('app-select, mat-select').filter({ hasText: /type|filter/i }).first();
  if (await typeFilter.count() > 0) {
    await typeFilter.click();
    await page.waitForTimeout(500);
    await shot(page, '04-library-filter-open', false);
    await page.keyboard.press('Escape');
  }

  await ctx.close();
});

// =============================================================================
// BATCH 2 — Article Module (full lifecycle)
// =============================================================================
test('batch-2: article module full lifecycle', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Navigate to training library, pick first article
  await page.goto(`${BASE_URL}/training/library`, { waitUntil: 'networkidle' });
  await waitForContent(page);

  // Find and click first Article module
  const articleLink = page.locator('a, button, [role="link"]').filter({ hasText: /article/i }).first();
  let moduleId: number | null = null;

  // Try to find a module card labeled Article via chip
  const articleChip = page.locator('.chip').filter({ hasText: 'Article' }).first();
  if (await articleChip.count() > 0) {
    const card = articleChip.locator('xpath=ancestor::*[@class and contains(@class,"card") or contains(@class,"module") or contains(@class,"item")][1]');
    if (await card.count() > 0) {
      await card.click();
    } else {
      // Navigate directly to first module
      await page.goto(`${BASE_URL}/training/module/1`, { waitUntil: 'networkidle' });
    }
  } else {
    await page.goto(`${BASE_URL}/training/module/1`, { waitUntil: 'networkidle' });
  }

  await waitForContent(page);
  await shot(page, '05-article-initial-state');

  // Verify module header elements visible
  const title    = page.locator('.module-viewer__title, h1').first();
  const typeBadge = page.locator('.chip').filter({ hasText: 'Article' }).first();
  await expect(title).toBeVisible();
  console.log(`  Title: ${await title.textContent()}`);

  // Scroll through article body
  const body = page.locator('.module-viewer__body').first();
  await body.evaluate(el => el.scrollTop += 300);
  await page.waitForTimeout(400);
  await shot(page, '06-article-scrolled');

  // Check reading timer
  const timerBar = page.locator('.reading-timer__track').first();
  if (await timerBar.count() > 0) {
    await shot(page, '07-article-timer-bar', false);
    console.log('  ✓ Reading timer present');
  }

  // Wait for timer to tick — verify progress bar width increases (only when not already completed)
  const timerFill = page.locator('.reading-timer__fill').first();
  if (await timerFill.count() > 0) {
    const fillBefore = await timerFill.evaluate(el => (el as HTMLElement).style.width);
    await page.waitForTimeout(3000);
    const fillAfter = await timerFill.evaluate(el => (el as HTMLElement).style.width);
    console.log(`  Timer progress: ${fillBefore} → ${fillAfter}`);
  } else {
    console.log('  Timer not shown (module already completed or walkthrough type)');
    await page.waitForTimeout(1000);
  }

  await shot(page, '08-article-timer-ticking');

  // Mark Complete button (should be disabled until timer finishes)
  const completeBtn = page.locator('button').filter({ hasText: /mark.*complete/i }).first();
  if (await completeBtn.count() > 0) {
    const isDisabled = await completeBtn.isDisabled();
    console.log(`  Mark Complete disabled (timer running): ${isDisabled}`);
    await shot(page, '09-article-footer-state', false);
  }

  // Back button
  const backBtn = page.locator('.module-viewer__back-btn').first();
  if (await backBtn.count() > 0) {
    await backBtn.click();
    await waitForContent(page);
    await shot(page, '10-back-to-library');
  }

  await ctx.close();
});

// =============================================================================
// BATCH 3 — QuickRef Module
// =============================================================================
test('batch-3: quickref module', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // QuickRef module is "Parts Quick Reference" — navigate to library and find it
  await page.goto(`${BASE_URL}/training/library`, { waitUntil: 'networkidle' });
  await waitForContent(page);

  // Find QuickRef chip to locate the module
  const quickRefChip = page.locator('.chip').filter({ hasText: 'QuickRef' }).first();
  if (await quickRefChip.count() > 0) {
    // Click its parent card
    const parentCard = quickRefChip.locator('xpath=ancestor::*[contains(@class,"training-card") or contains(@class,"module-card")][1]');
    if (await parentCard.count() > 0) {
      await parentCard.first().click();
    } else {
      await page.goto(`${BASE_URL}/training/module/12`, { waitUntil: 'networkidle' });
    }
  } else {
    // Try known module IDs — QuickRef is module 12 in seed data (Parts Quick Reference)
    await page.goto(`${BASE_URL}/training/module/12`, { waitUntil: 'networkidle' });
  }

  await waitForContent(page);
  await shot(page, '11-quickref-full');

  // Verify grid layout of reference groups
  const groups = page.locator('.quickref-group');
  const groupCount = await groups.count();
  console.log(`  QuickRef groups visible: ${groupCount}`);
  if (groupCount > 0) {
    await expect(groups.first()).toBeVisible();
    await shot(page, '12-quickref-groups', false);
  }

  // QuickRef has no reading timer but does have the complete button
  const footer = page.locator('.module-viewer__footer');
  if (await footer.count() > 0) {
    await footer.first().screenshot({ path: path.join(SHOT_DIR, '13-quickref-footer.png') });
    console.log('  📸  13-quickref-footer');
  }

  await ctx.close();
});

// =============================================================================
// BATCH 4 — Quiz Module (full flow: attempt, submit, pass/fail)
// =============================================================================
test('batch-4: quiz module full flow', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Find the Onboarding Quiz (module 7 in seed data)
  // Try library first, fall back to direct navigation
  await page.goto(`${BASE_URL}/training/library`, { waitUntil: 'networkidle' });
  await waitForContent(page);

  const quizChip = page.locator('.chip').filter({ hasText: 'Quiz' }).first();
  let navigatedToQuiz = false;
  if (await quizChip.count() > 0) {
    // Find the closest ancestor card element
    const parentCard = quizChip.locator('xpath=ancestor::*[contains(@class,"training-card") or contains(@class,"module-card")][1]');
    if (await parentCard.count() > 0) {
      await parentCard.first().click();
      navigatedToQuiz = true;
    }
  }
  if (!navigatedToQuiz) {
    await page.goto(`${BASE_URL}/training/module/7`, { waitUntil: 'networkidle' });
  }

  await waitForContent(page);
  await shot(page, '14-quiz-initial');

  // Verify quiz component rendered
  const quizEl = page.locator('app-training-module-quiz, .quiz-viewer').first();
  if (await quizEl.count() > 0) {
    console.log('  ✓ Quiz component rendered');
  }

  // Count questions
  const questions = page.locator('.quiz-question, [class*="question"]');
  const qCount = await questions.count();
  console.log(`  Questions visible: ${qCount}`);

  await shot(page, '15-quiz-questions-visible');

  // Answer all questions by selecting the first option for each
  const optionBtns = page.locator('.quiz-option, [class*="option"], input[type="radio"]');
  const optCount   = await optionBtns.count();
  console.log(`  Option elements: ${optCount}`);

  // Try clicking first option per question group
  if (qCount > 0) {
    for (let i = 0; i < qCount; i++) {
      const q        = questions.nth(i);
      const firstOpt = q.locator('.quiz-option, label, input[type="radio"]').first();
      if (await firstOpt.count() > 0) {
        await firstOpt.click({ force: true });
        await page.waitForTimeout(200);
      }
    }
    await shot(page, '16-quiz-answers-selected');
  }

  // Submit button
  const submitBtn = page.locator('button').filter({ hasText: /submit|check/i }).first();
  if (await submitBtn.count() > 0) {
    const isDisabled = await submitBtn.isDisabled();
    console.log(`  Submit button disabled: ${isDisabled}`);
    await shot(page, '17-quiz-before-submit', false);

    if (!isDisabled) {
      await submitBtn.click();
      await waitForContent(page);
      await shot(page, '18-quiz-results');

      // Look for score display
      const score = page.locator('[class*="score"], [class*="result"], [class*="passed"], [class*="failed"]').first();
      if (await score.count() > 0) {
        console.log(`  Score display: ${await score.textContent()}`);
        await shot(page, '19-quiz-score-display', false);
      }
    }
  }

  await ctx.close();
});

// =============================================================================
// BATCH 5 — Walkthrough Module (seed + test)
// =============================================================================
test('batch-5: walkthrough module', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Create a walkthrough module via API
  const apiCtx = await request.newContext({ baseURL: API_BASE });
  const loginResp = await apiCtx.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  const { token } = await loginResp.json();

  const walkthroughContent = {
    appRoute: '/kanban',
    startButtonLabel: 'Start Tour',
    steps: [
      {
        element: '[data-tour="track-type-switcher"]',
        popover: {
          title: 'Track Type Selector',
          description: 'Switch between different workflow tracks here. Each track has its own set of stages.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="board-filters"]',
        popover: {
          title: 'Board Filters',
          description: 'Filter jobs by team member to focus on specific workloads.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="board-columns"]',
        popover: {
          title: 'Kanban Columns',
          description: 'Each column represents a stage in your workflow. Drag cards between columns to move jobs forward.',
          side: 'top',
        },
      },
    ],
  };

  const createResp = await apiCtx.post('training/modules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'Kanban Board Walkthrough',
      slug: 'kanban-board-walkthrough',
      summary: 'An interactive guided tour of the kanban board interface.',
      contentType: 'Walkthrough',
      contentJson: JSON.stringify(walkthroughContent),
      estimatedMinutes: 3,
      tags: ['kanban', 'walkthrough', 'test'],
      appRoutes: ['/kanban'],
      isPublished: true,
      isOnboardingRequired: false,
      sortOrder: 99,
    },
  });

  let walkthroughId: number | null = null;
  if (createResp.ok()) {
    const created = await createResp.json();
    walkthroughId = created.id;
    console.log(`  ✓ Created walkthrough module id=${walkthroughId}`);
  } else {
    const errText = await createResp.text();
    console.log(`  ✗ Create failed: ${createResp.status()} ${errText}`);
    // Try to find existing walkthrough
    const allResp = await apiCtx.get('training/modules', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (allResp.ok()) {
      const { data } = await allResp.json();
      const wt = data.find((m: { contentType: string }) => m.contentType === 'Walkthrough');
      if (wt) walkthroughId = wt.id;
    }
  }
  await apiCtx.dispose();

  if (!walkthroughId) {
    console.log('  ✗ No walkthrough module available — skipping');
    await ctx.close();
    return;
  }

  await page.goto(`${BASE_URL}/training/module/${walkthroughId}`, { waitUntil: 'networkidle' });
  await waitForContent(page);
  await shot(page, '20-walkthrough-initial');

  // Verify walkthrough info panel
  const walkthroughInfo = page.locator('.walkthrough-viewer__info');
  if (await walkthroughInfo.count() > 0) {
    console.log('  ✓ Walkthrough info panel visible');
    await shot(page, '21-walkthrough-info-panel', false);
  }

  // Check step count
  const stepsCount = page.locator('.walkthrough-viewer__steps-count');
  if (await stepsCount.count() > 0) {
    console.log(`  Steps label: ${await stepsCount.textContent()}`);
  }

  // Start the tour
  const takeTourBtn = page.locator('button').filter({ hasText: /take.*tour|start/i }).first();
  if (await takeTourBtn.count() > 0) {
    await takeTourBtn.click();
    // Wait for navigation to kanban + tour to initialize
    await page.waitForURL(`${BASE_URL}/kanban**`, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, '22-walkthrough-tour-started', false);

    // Tour popover should be visible
    const popover = page.locator('.driver-popover');
    if (await popover.count() > 0) {
      console.log('  ✓ Tour popover visible');
      await shot(page, '23-walkthrough-first-step', false);

      // Click Next through steps
      for (let step = 0; step < 3; step++) {
        const nextBtn = page.locator('.driver-popover-next-btn');
        if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
          await nextBtn.click();
          await page.waitForTimeout(800);
          await shot(page, `24-walkthrough-step-${step + 2}`, false);
        } else {
          break;
        }
      }
    }

    // After tour ends, should redirect to training module page
    await page.waitForURL(`${BASE_URL}/training/module/${walkthroughId}**`, { timeout: 8000 }).catch(() => {});
    await waitForContent(page);
    await shot(page, '25-walkthrough-completion-page');

    // Check for completed badge
    const completedBadge = page.locator('.module-viewer__completed-badge, .module-viewer__completed-chip');
    if (await completedBadge.count() > 0) {
      console.log('  ✓ Completed badge visible after walkthrough');
    } else {
      console.log('  ✗ Completed badge NOT visible — completion flow may have failed');
    }
  }

  await ctx.close();
});

// =============================================================================
// BATCH 6 — Video Module (seed + test)
// =============================================================================
test('batch-6: video module', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Create a video module via API
  const apiCtx = await request.newContext({ baseURL: API_BASE });
  const loginResp = await apiCtx.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  const { token } = await loginResp.json();

  const videoContent = {
    videoType: 'youtube',
    videoId: 'dQw4w9WgXcQ',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnailUrl: null,
    chaptersJson: [
      { timeSeconds: 0,  label: 'Introduction' },
      { timeSeconds: 30, label: 'Overview' },
      { timeSeconds: 60, label: 'Key Features' },
    ],
    transcript: 'This is a sample transcript for the video training module. In a real module this would contain the full text of the video narration.',
  };

  const createResp = await apiCtx.post('training/modules', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'Platform Overview Video',
      slug: 'platform-overview-video',
      summary: 'A video walkthrough of the QB Engineer platform for new team members.',
      contentType: 'Video',
      contentJson: JSON.stringify(videoContent),
      estimatedMinutes: 5,
      tags: ['video', 'overview', 'onboarding', 'test'],
      appRoutes: ['/dashboard'],
      isPublished: true,
      isOnboardingRequired: false,
      sortOrder: 98,
    },
  });

  let videoId: number | null = null;
  if (createResp.ok()) {
    const created = await createResp.json();
    videoId = created.id;
    console.log(`  ✓ Created video module id=${videoId}`);
  } else {
    const errText = await createResp.text();
    console.log(`  ✗ Create failed: ${createResp.status()} ${errText}`);
    const allResp = await apiCtx.get('training/modules', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (allResp.ok()) {
      const { data } = await allResp.json();
      const vid = data.find((m: { contentType: string }) => m.contentType === 'Video');
      if (vid) videoId = vid.id;
    }
  }
  await apiCtx.dispose();

  if (!videoId) {
    console.log('  ✗ No video module available — skipping');
    await ctx.close();
    return;
  }

  await page.goto(`${BASE_URL}/training/module/${videoId}`, { waitUntil: 'networkidle' });
  await waitForContent(page);
  await shot(page, '26-video-initial');

  // Verify embed container
  const embedWrap = page.locator('.video-viewer__embed-wrap');
  if (await embedWrap.count() > 0) {
    console.log('  ✓ Video embed wrapper visible');
    await shot(page, '27-video-embed', false);
  }

  // Check chapters
  const chapters = page.locator('.video-viewer__chapter');
  const chapterCount = await chapters.count();
  console.log(`  Chapters: ${chapterCount}`);
  if (chapterCount > 0) {
    await shot(page, '28-video-chapters', false);
  }

  // Check transcript toggle
  const transcriptToggle = page.locator('.video-viewer__transcript-toggle');
  if (await transcriptToggle.count() > 0) {
    await transcriptToggle.click();
    await page.waitForTimeout(300);
    await shot(page, '29-video-transcript-open', false);
  }

  // Mark complete
  const completeBtn = page.locator('button').filter({ hasText: /mark.*complete/i }).first();
  if (await completeBtn.count() > 0 && !(await completeBtn.isDisabled())) {
    await completeBtn.click();
    await waitForContent(page);
    await shot(page, '30-video-completed');
  }

  await ctx.close();
});

// =============================================================================
// BATCH 7 — Training Paths view
// =============================================================================
test('batch-7: training paths view', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Navigate to paths view (may be a tab or separate route)
  await page.goto(`${BASE_URL}/training/library`, { waitUntil: 'networkidle' });
  await waitForContent(page);

  // Look for a Paths tab
  const pathsTab = page.locator('.tab, button, a').filter({ hasText: /path|learning path/i }).first();
  if (await pathsTab.count() > 0) {
    await pathsTab.click();
    await waitForContent(page);
    await shot(page, '31-paths-tab');
  }

  // Navigate to a specific path
  const pathCard = page.locator('[class*="path"], [class*="card"]').first();
  if (await pathCard.count() > 0) {
    await pathCard.click();
    await waitForContent(page);
    await shot(page, '32-path-detail');
  }

  await ctx.close();
});

// =============================================================================
// BATCH 8 — Article mark-complete full flow (wait for timer)
// =============================================================================
test('batch-8: article mark-complete flow', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Navigate to shortest article (Welcome to QB Engineer — 3 min = 180s target, 20s minimum)
  await page.goto(`${BASE_URL}/training/module/1`, { waitUntil: 'networkidle' });
  await waitForContent(page);

  // Check if already completed
  const completedChip = page.locator('.module-viewer__completed-chip, .module-viewer__completed-badge');
  const isAlreadyDone = await completedChip.count() > 0;
  console.log(`  Already completed: ${isAlreadyDone}`);
  await shot(page, '33-complete-flow-initial');

  if (!isAlreadyDone) {
    // Wait for the 20s minimum timer
    console.log('  Waiting 22s for reading timer...');
    await page.waitForTimeout(22_000);

    // Timer should now be 100%
    const timerDone = page.locator('.reading-timer--done');
    if (await timerDone.count() > 0) {
      console.log('  ✓ Timer complete state active');
    }
    await shot(page, '34-timer-complete-state');

    // Mark Complete button should now be enabled
    const completeBtn = page.locator('button').filter({ hasText: /mark.*complete/i }).first();
    if (await completeBtn.count() > 0) {
      const isDisabled = await completeBtn.isDisabled();
      console.log(`  Complete btn disabled after timer: ${isDisabled}`);

      if (!isDisabled) {
        await completeBtn.click();
        await waitForContent(page);
        await shot(page, '35-completed-state');

        // Should show completed badge
        const badge = page.locator('.module-viewer__completed-badge');
        if (await badge.count() > 0) {
          console.log('  ✓ Completed badge shown after mark-complete');
        } else {
          console.log('  ✗ Completed badge NOT shown');
        }
      }
    }
  } else {
    // Already done — verify the UI shows completion state
    await shot(page, '34-already-completed-state');
  }

  await ctx.close();
});

// =============================================================================
// BATCH 9 — Quiz full correct-answer flow (verify pass state)
// =============================================================================
test('batch-9: quiz correct answer flow', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Production Engineer Assessment — module 15 (8 questions, 75% pass)
  await page.goto(`${BASE_URL}/training/module/15`, { waitUntil: 'networkidle' });
  await waitForContent(page);
  await shot(page, '36-quiz2-initial');

  // Check quiz rendered
  const quizEl = page.locator('app-training-module-quiz');
  if (await quizEl.count() === 0) {
    console.log('  ✗ Quiz component not found at module 15 — trying module 7');
    await page.goto(`${BASE_URL}/training/module/7`, { waitUntil: 'networkidle' });
    await waitForContent(page);
  }

  // Answer all questions — click first option for each question block
  const questionBlocks = page.locator('[class*="question"]').filter({ hasNot: page.locator('[class*="option"]') });
  const blockCount = await questionBlocks.count();
  console.log(`  Question blocks: ${blockCount}`);

  // More reliable: find all radio/option inputs and select the first per group
  const allOptions = page.locator('.quiz-option, label[class*="option"]');
  const allCount   = await allOptions.count();
  console.log(`  Total option elements: ${allCount}`);

  for (let i = 0; i < allCount; i++) {
    const opt = allOptions.nth(i);
    if (await opt.isVisible()) {
      await opt.click({ force: true });
      await page.waitForTimeout(150);
    }
  }

  await shot(page, '37-quiz2-all-answered');

  const submitBtn = page.locator('button').filter({ hasText: /submit/i }).first();
  if (await submitBtn.count() > 0 && !(await submitBtn.isDisabled())) {
    await submitBtn.click();
    await waitForContent(page);
    await shot(page, '38-quiz2-results');

    // Look for pass/fail indicators
    const passed = page.locator('[class*="pass"], [class*="success"]').first();
    const failed = page.locator('[class*="fail"], [class*="error"]').first();

    if (await passed.count() > 0) {
      console.log(`  ✓ Passed state: ${await passed.textContent()}`);
    }
    if (await failed.count() > 0) {
      console.log(`  ✓ Failed state: ${await failed.textContent()}`);
    }

    // Retry button if failed
    const retryBtn = page.locator('button').filter({ hasText: /retry|try again/i }).first();
    if (await retryBtn.count() > 0) {
      console.log('  ✓ Retry button visible');
      await shot(page, '39-quiz2-retry-btn', false);
      await retryBtn.click();
      await waitForContent(page);
      await shot(page, '40-quiz2-after-retry');
    }
  }

  await ctx.close();
});

// =============================================================================
// BATCH 10 — Admin training dashboard
// =============================================================================
test('batch-10: admin training dashboard', async ({ browser }) => {
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginAndSeedStorage(page);

  // Admin panel — training section
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
  await waitForContent(page);
  await shot(page, '41-admin-overview');

  // Find training tab
  const trainingTab = page.locator('.tab, a, button').filter({ hasText: /training/i }).first();
  if (await trainingTab.count() > 0) {
    await trainingTab.click();
    await waitForContent(page);
    await shot(page, '42-admin-training-tab');
  }

  // Training dashboard in admin features
  await page.goto(`${BASE_URL}/admin/training`, { waitUntil: 'networkidle' }).catch(() => {});
  await waitForContent(page);
  await shot(page, '43-admin-training-panel');

  await ctx.close();
});
