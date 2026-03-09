import { test, expect, request } from '@playwright/test';

import { loginViaApi, getAuthToken } from '../helpers/auth.helper';

const API_BASE = 'http://localhost:5000/api/v1/';

interface TrackType {
  id: number;
  code: string;
  stages: { id: number; code: string; name: string }[];
}

test.describe('SignalR Board Sync', () => {
  test('job moved between columns reflects in both browsers via SignalR', async ({ browser }) => {
    // ── 1. Create two independent browser contexts ──────────────────
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // ── 2. Log in both users ────────────────────────────────────────
    await loginViaApi(pageA, 'admin@qbengineer.local', 'Admin123!');
    await loginViaApi(pageB, 'akim@qbengineer.local', 'Engineer123!');

    // ── 3. Both navigate to the kanban board ────────────────────────
    await pageA.goto('/kanban');
    await pageB.goto('/kanban');

    await pageA.waitForSelector('.board', { timeout: 10_000 });
    await pageB.waitForSelector('.board', { timeout: 10_000 });

    // ── 4. Resolve dynamic IDs from the API ─────────────────────────
    const adminToken = await getAuthToken('admin@qbengineer.local', 'Admin123!');
    const apiContext = await request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
    });

    // Get production track type and its stages
    const trackTypesRes = await apiContext.get('track-types');
    const trackTypes: TrackType[] = await trackTypesRes.json();
    const productionTrack = trackTypes.find(t => t.code === 'production');
    if (!productionTrack) throw new Error('Production track type not found. Is the database seeded?');

    const quoteRequestedStage = productionTrack.stages.find(s => s.code === 'quote_requested');
    const quotedStage = productionTrack.stages.find(s => s.code === 'quoted');
    if (!quoteRequestedStage || !quotedStage) throw new Error('Required stages not found');

    // Find J-1050 job
    const jobsRes = await apiContext.get('jobs', {
      params: { trackTypeId: productionTrack.id.toString(), isArchived: 'false' },
    });
    const jobs: { id: number; jobNumber: string; currentStageId: number }[] = await jobsRes.json();
    const targetJob = jobs.find(j => j.jobNumber === 'J-1050');
    if (!targetJob) throw new Error('Seed job J-1050 not found. Is the database seeded?');

    // Determine source and target for the move
    const isInQuoteRequested = targetJob.currentStageId === quoteRequestedStage.id;
    const fromStage = isInQuoteRequested ? quoteRequestedStage : quotedStage;
    const toStage = isInQuoteRequested ? quotedStage : quoteRequestedStage;

    // ── 5. Verify J-1050 is visible on both boards before the move ──
    const jobCardOnA = pageA.locator('.card__job-number:text-is("J-1050")');
    const jobCardOnB = pageB.locator('.card__job-number:text-is("J-1050")');
    await expect(jobCardOnA).toBeVisible({ timeout: 5_000 });
    await expect(jobCardOnB).toBeVisible({ timeout: 5_000 });

    // Verify both browsers show J-1050 in the source column
    const jobInSourceOnA = pageA.locator(
      `.column:has(.column__name:text-is("${fromStage.name}")) .card__job-number:text-is("J-1050")`,
    );
    const jobInSourceOnB = pageB.locator(
      `.column:has(.column__name:text-is("${fromStage.name}")) .card__job-number:text-is("J-1050")`,
    );
    await expect(jobInSourceOnA).toBeVisible({ timeout: 5_000 });
    await expect(jobInSourceOnB).toBeVisible({ timeout: 5_000 });

    // ── 6. Move J-1050 via API (simulates User A's drag-drop) ───────
    const moveRes = await apiContext.patch(`jobs/${targetJob.id}/stage`, {
      data: { stageId: toStage.id },
    });
    expect(moveRes.ok()).toBe(true);

    // ── 7. Verify BOTH browsers update via SignalR ──────────────────
    // Both browsers receive 'jobMoved' event via SignalR, which triggers
    // selectTrackType() to re-fetch the board. We allow 5s for propagation.

    // Browser A (the mover) should show J-1050 in the target column
    const jobInTargetOnA = pageA.locator(
      `.column:has(.column__name:text-is("${toStage.name}")) .card__job-number:text-is("J-1050")`,
    );
    await expect(jobInTargetOnA).toBeVisible({ timeout: 5_000 });

    // Browser B (the observer) should also show J-1050 in the target column
    const jobInTargetOnB = pageB.locator(
      `.column:has(.column__name:text-is("${toStage.name}")) .card__job-number:text-is("J-1050")`,
    );
    await expect(jobInTargetOnB).toBeVisible({ timeout: 5_000 });

    // J-1050 should no longer be in the source column on EITHER browser
    const jobStillInSourceOnA = pageA.locator(
      `.column:has(.column__name:text-is("${fromStage.name}")) .card__job-number:text-is("J-1050")`,
    );
    const jobStillInSourceOnB = pageB.locator(
      `.column:has(.column__name:text-is("${fromStage.name}")) .card__job-number:text-is("J-1050")`,
    );
    await expect(jobStillInSourceOnA).not.toBeVisible();
    await expect(jobStillInSourceOnB).not.toBeVisible();

    // ── 8. Cleanup — move job back for idempotent reruns ────────────
    await apiContext.patch(`jobs/${targetJob.id}/stage`, {
      data: { stageId: fromStage.id },
    });

    // Verify cleanup propagated to both browsers
    const jobBackOnA = pageA.locator(
      `.column:has(.column__name:text-is("${fromStage.name}")) .card__job-number:text-is("J-1050")`,
    );
    const jobBackOnB = pageB.locator(
      `.column:has(.column__name:text-is("${fromStage.name}")) .card__job-number:text-is("J-1050")`,
    );
    await expect(jobBackOnA).toBeVisible({ timeout: 5_000 });
    await expect(jobBackOnB).toBeVisible({ timeout: 5_000 });

    await apiContext.dispose();
    await contextA.close();
    await contextB.close();
  });
});
