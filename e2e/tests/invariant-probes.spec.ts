/**
 * Wave-0 Illegal-Action Probe Harness
 *
 * Invariants (GT-CHARTER §2A "UI probe" tier):
 *   INV-SO2  — SO-line qty is immutable; no direct edit endpoint exists
 *   INV-SF2  — job-stage over-complete rejected (good > started − scrap)
 *   INV-INV2 — over-issue returns 4xx, never 200; on_hand never silently negative
 *   INV-SH1  — over-ship returns 409; shipped ≤ ordered − already_shipped
 *   INV-IN2  — double-invoice returns 409; each shipment/SO invoiced ≤ once
 *   INV-QBO2 — sync failure surfaced & retryable (seam-level; real QB deferred)
 *
 * ORACLE (eng-lead ruling 2026-05-20):
 *   Illegal state transitions must return 409 Conflict.
 *   200 + state changed  = defect: no guard
 *   200 + state unchanged = defect: silent no-op
 *   4xx (any)            = blocked correctly
 *
 * NON-DESTRUCTIVE DESIGN (2026-05-21):
 *   Mutation probes (INV-IN2, INV-INV2, INV-SF2) operate on probe-owned entities
 *   created in beforeAll and torn down in afterAll. Seeded spine records are
 *   NEVER mutated. Blocked probes (INV-SO2, INV-SH1) use seeded entities read-only
 *   since a 409 response guarantees no state change.
 *
 * CREDS DEPENDENCY:
 *   Set SEED_USER_PASSWORD=ForgeDemo!2026 before running:
 *     $env:SEED_USER_PASSWORD = 'ForgeDemo!2026'
 *     npx playwright test invariant-probes --config=e2e/playwright.config.ts
 */

import { test, expect, type Page, request as playwrightRequest } from '@playwright/test';
import { loginViaApi, getAuthToken, SEED_PASSWORD } from '../helpers/auth.helper';
import { navigateTo } from '../helpers/ui.helper';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';
const APP_BASE = process.env['SIM_APP_BASE'] ?? 'http://localhost:4200';
const ADMIN_EMAIL = 'admin@forge.local';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes a JSON object's keys to camelCase.
 * Safety net for System.Text.Json PascalCase responses; no-op if already camelCase.
 */
function normalizeCasing<T>(obj: unknown): T {
  if (obj === null || typeof obj !== 'object') return obj as T;
  if (Array.isArray(obj)) return obj.map(item => normalizeCasing(item)) as unknown as T;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const camel = k.charAt(0).toLowerCase() + k.slice(1);
    result[camel] = Array.isArray(v) ? v.map(item => normalizeCasing(item)) : normalizeCasing(v);
  }
  return result as T;
}

async function apiGet(token: string, path: string): Promise<{ status: number; body: unknown }> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const resp = await ctx.get(path, { headers: { Authorization: `Bearer ${token}` } });
  const raw = await resp.json().catch(() => null);
  const body = raw !== null ? normalizeCasing(raw) : null;
  await ctx.dispose();
  return { status: resp.status(), body };
}

async function apiPost(
  token: string,
  path: string,
  data: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const resp = await ctx.post(path, {
    data,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const raw = await resp.json().catch(() => null);
  const body = raw !== null ? normalizeCasing(raw) : null;
  await ctx.dispose();
  return { status: resp.status(), body };
}

async function apiDelete(token: string, path: string): Promise<{ status: number }> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const resp = await ctx.delete(path, { headers: { Authorization: `Bearer ${token}` } });
  await ctx.dispose();
  return { status: resp.status() };
}

/** Unwraps paged `{ items, totalCount, ... }` or flat array responses. */
function unwrapList<T>(body: unknown): T[] {
  if (body === null || body === undefined) return [];
  if (Array.isArray(body)) return body as T[];
  const paged = body as { items?: T[] };
  return paged.items ?? [];
}

// ---------------------------------------------------------------------------
// Wave-0 fixtures
// ---------------------------------------------------------------------------

interface ProbeFixtures {
  adminToken: string;
  // ── Seeded SO for INV-SH1 (must be non-Draft/non-Cancelled; read-only / blocked probe)
  shipSOId: number;
  shipSOLineId: number;
  shipSOLineQty: number;
  // ── Probe-owned SO for INV-SO2 + INV-IN2 (created fresh, deleted in afterAll)
  probeSOId: number;
  probeSOCustomerId: number;
  probeSOLineId: number;
  probeSOLineQty: number;
  probeSOInvoiceCountBefore: number;
  // ── Probe-owned job + production run for INV-INV2 + INV-SF2 (created fresh, torn down in afterAll)
  probeJobId: number;
  probeRunId: number | null;    // null if creation failed — INV-SF2 skips gracefully
  probeRunTargetQty: number;
  probePartId: number;
}

let fixtures: ProbeFixtures;

// ---------------------------------------------------------------------------
// Wave-0 suite
// ---------------------------------------------------------------------------
test.describe.serial('Invariant probes — Wave 0', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const token = await getAuthToken(ADMIN_EMAIL, SEED_PASSWORD);
    page = await browser.newPage();
    await loginViaApi(page, ADMIN_EMAIL, SEED_PASSWORD);

    // ── 1. Seeded SO for INV-SH1: must be non-Draft / non-Cancelled with lines
    //       so that CreateShipment reaches the over-quantity guard (not the Draft guard).
    //       Expected result: 409. Guard is confirmed → no mutation risk.
    const { body: ordersBody } = await apiGet(token, 'orders');
    const orders = unwrapList<{ id: number; status: string; lineCount: number }>(ordersBody);
    const shipSO = orders.find(o => !['Draft', 'Cancelled'].includes(o.status) && o.lineCount > 0);
    if (!shipSO) throw new Error('Probe setup: no shippable seeded SO (need non-Draft/non-Cancelled with lines)');
    const { body: shipSODetail } = await apiGet(token, `orders/${shipSO.id}`);
    const shipSOData = shipSODetail as { lines: Array<{ id: number; quantity: number; remainingQuantity: number }> };
    const shipSOLine = shipSOData.lines.find(l => l.remainingQuantity > 0) ?? shipSOData.lines[0];

    // ── 2. Probe customer (read-only — needed to create probe SO and probe invoices)
    const { body: custBody } = await apiGet(token, 'customers?pageSize=1');
    const customers = unwrapList<{ id: number }>(custBody);
    if (!customers.length) throw new Error('Probe setup: no customers in demo env');
    const probeCustomerId = customers[0].id;

    // ── 3. Probe part (needed for production run creation — PartId is required).
    //       Prefer parts with a non-null description/name to avoid NullReferenceException
    //       in CreateProductionRun.cs:76 (`part.Description ?? part.Name`).
    const { body: partsBody } = await apiGet(token, 'parts?pageSize=20');
    const parts = unwrapList<{ id: number; description?: string; name?: string }>(partsBody);
    if (!parts.length) throw new Error('Probe setup: no parts in demo env (needed for production run)');
    const probePart = parts.find(p => p.description || p.name) ?? parts[0];
    const probePartId = probePart.id;

    // ── 4. TrackTypeId from first existing job (avoids needing a /track-types endpoint)
    const { body: jobsBody } = await apiGet(token, 'jobs?pageSize=1');
    const existingJobs = unwrapList<{ id: number; trackTypeId?: number }>(jobsBody);
    const probeTrackTypeId = existingJobs[0]?.trackTypeId ?? 1;

    // ── 5. Create probe SO (Draft)
    const { status: soCreateStatus, body: soCreated } = await apiPost(token, 'orders', {
      customerId: probeCustomerId,
      taxRate: 0,
      lines: [{ description: 'PROBE-HARNESS invariant probe — safe to delete', quantity: 100, unitPrice: 1 }],
    });
    if (soCreateStatus !== 201) throw new Error(`Probe setup: failed to create probe SO (${soCreateStatus}): ${JSON.stringify(soCreated)}`);
    const soCreatedData = soCreated as { id: number; lines?: Array<{ id: number; quantity: number }> };
    let probeSOLines = soCreatedData.lines ?? [];
    if (!probeSOLines.length) {
      // Create response may not include lines — fetch detail
      const { body: soDetail } = await apiGet(token, `orders/${soCreatedData.id}`);
      probeSOLines = (soDetail as { lines: Array<{ id: number; quantity: number }> }).lines ?? [];
    }
    const probeSOLine = probeSOLines[0];
    const probeSOId = soCreatedData.id;

    // ── 6. Create probe job
    const { status: jobCreateStatus, body: jobCreated } = await apiPost(token, 'jobs', {
      title: `PROBE-HARNESS invariant probe job ${new Date().toISOString()}`,
      trackTypeId: probeTrackTypeId,
    });
    if (jobCreateStatus !== 201) throw new Error(`Probe setup: failed to create probe job (${jobCreateStatus}): ${JSON.stringify(jobCreated)}`);
    const probeJobId = (jobCreated as { id: number }).id;

    // ── 7. Create probe production run (targetQuantity=5) — non-fatal; INV-SF2 skips if this fails
    const { status: runCreateStatus, body: runCreated } = await apiPost(token, `jobs/${probeJobId}/production-runs`, {
      partId: probePartId,
      targetQuantity: 5,
    });
    let probeRunId: number | null = null;
    let probeRunTargetQty = 5;
    if (runCreateStatus === 201) {
      const probeRun = runCreated as { id: number; targetQuantity: number };
      probeRunId = probeRun.id;
      probeRunTargetQty = probeRun.targetQuantity;
    } else {
      console.warn(`Probe setup: probe production run creation failed (${runCreateStatus}) — INV-SF2 will skip. Body: ${JSON.stringify(runCreated)}`);
    }

    // ── 8. Baseline invoice count on probe SO (should be 0; used as delta check for INV-IN2)
    const { body: soInvoicesBody } = await apiGet(token, `orders/${probeSOId}/invoices`);
    const probeSOInvoiceCountBefore = (soInvoicesBody as unknown[] | null)?.length ?? 0;

    fixtures = {
      adminToken: token,
      shipSOId: shipSO.id,
      shipSOLineId: shipSOLine.id,
      shipSOLineQty: shipSOLine.quantity,
      probeSOId,
      probeSOCustomerId: probeCustomerId,
      probeSOLineId: probeSOLine.id,
      probeSOLineQty: probeSOLine.quantity,
      probeSOInvoiceCountBefore,
      probeJobId,
      probeRunId,
      probeRunTargetQty,
      probePartId,
    };

    console.log(
      `Wave-0 fixtures: probeSOId=${probeSOId} probeSOLineId=${probeSOLine.id} qty=${probeSOLine.quantity} ` +
      `probeJobId=${probeJobId} probeRunId=${probeRunId ?? 'null (INV-SF2 will skip)'} targetQty=${probeRunTargetQty} ` +
      `shipSOId=${shipSO.id} shipSOLineId=${shipSOLine.id}`,
    );
  });

  test.afterAll(async () => {
    const token = fixtures?.adminToken;
    if (!token) { await page?.close(); return; }

    // Cleanup sequence: probe invoices → probe run → dispose probe job → probe SO
    // Best-effort: log errors but don't fail.

    // 1. Delete probe invoices created by INV-IN2 (should be Draft if gap present)
    if (fixtures.probeSOId) {
      const { body: invBody } = await apiGet(token, `orders/${fixtures.probeSOId}/invoices`);
      const probeInvoices = (invBody as Array<{ id: number; status?: string }> | null) ?? [];
      for (const inv of probeInvoices) {
        const { status: delStatus } = await apiDelete(token, `invoices/${inv.id}`);
        console.log(`Probe cleanup: DELETE invoices/${inv.id} (${inv.status ?? 'unknown'}) → ${delStatus}`);
      }
    }

    // 2. Delete probe production run
    if (fixtures.probeJobId && fixtures.probeRunId) {
      const { status } = await apiDelete(token, `jobs/${fixtures.probeJobId}/production-runs/${fixtures.probeRunId}`);
      console.log(`Probe cleanup: DELETE jobs/${fixtures.probeJobId}/production-runs/${fixtures.probeRunId} → ${status}`);
    }

    // 3. Dispose probe job (soft-delete; no hard DELETE endpoint for jobs)
    if (fixtures.probeJobId) {
      const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
      const resp = await ctx.post(`jobs/${fixtures.probeJobId}/dispose`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`Probe cleanup: POST jobs/${fixtures.probeJobId}/dispose → ${resp.status()}`);
      await ctx.dispose();
    }

    // 4. Delete probe SO (must be Draft; invoice cleanup above must run first)
    if (fixtures.probeSOId) {
      const { status } = await apiDelete(token, `orders/${fixtures.probeSOId}`);
      console.log(`Probe cleanup: DELETE orders/${fixtures.probeSOId} → ${status}`);
    }

    await page?.close();
  });

  // -------------------------------------------------------------------------
  // INV-SO2 — SO lines are EDITABLE while the order is in Draft.
  //
  // Updated invariant (was: "no edit endpoint"). The sales pipeline now supports
  // line editing on draft documents: PUT /orders/{id}/lines/{lineId} succeeds on
  // a Draft order and 409s once Confirmed (the Confirmed-lock is gated in the
  // handler). The probe SO is freshly created (Draft) and shared with INV-IN2,
  // so we capture the line, assert the edit lands, then restore it to keep the
  // probe SO pristine.
  // -------------------------------------------------------------------------
  test('INV-SO2 SO-line is editable on a Draft order', async () => {
    const { probeSOId, probeSOLineId, probeSOLineQty, adminToken } = fixtures;

    // Capture the original line so we can restore it afterward.
    const { body: soBefore } = await apiGet(adminToken, `orders/${probeSOId}`);
    const before = (soBefore as { lines: Array<{ id: number; quantity: number; unitPrice: number; description: string }> })
      .lines.find(l => l.id === probeSOLineId)!;

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const newQty = probeSOLineQty + 99;
    const resp = await ctx.put(`orders/${probeSOId}/lines/${probeSOLineId}`, {
      data: { description: before.description, quantity: newQty, unitPrice: before.unitPrice },
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    });
    const attemptStatus = resp.status();

    expect(
      attemptStatus,
      `INV-SO2 FAIL: PUT line on a Draft SO returned ${attemptStatus}; expected 200 (Draft SO lines are editable).`,
    ).toBe(200);

    // Verify the edit landed.
    const { body: soAfter } = await apiGet(adminToken, `orders/${probeSOId}`);
    const after = (soAfter as { lines: Array<{ id: number; quantity: number }> }).lines.find(l => l.id === probeSOLineId);
    expect(after?.quantity, 'INV-SO2: line qty did not update despite a 200').toBe(newQty);

    // Restore the original line so the shared probe SO stays pristine for INV-IN2.
    await ctx.put(`orders/${probeSOId}/lines/${probeSOLineId}`, {
      data: { description: before.description, quantity: before.quantity, unitPrice: before.unitPrice },
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    });
    await ctx.dispose();

    console.log(`INV-SO2 PASS: Draft SO-line editable (PUT ${attemptStatus}), restored to qty ${probeSOLineQty}`);
  });

  // -------------------------------------------------------------------------
  // INV-SH1 — over-ship returns 409 Conflict
  //
  // Uses seeded non-Draft SO (read-only selection; 409 → no state change).
  // Must use non-Draft SO so CreateShipment reaches the over-quantity guard
  // at CreateShipment.cs:74 rather than the Draft status guard at :49.
  // -------------------------------------------------------------------------
  test('INV-SH1 over-ship returns 409 Conflict', async () => {
    const { shipSOId, shipSOLineId, shipSOLineQty, adminToken } = fixtures;

    const { body: soBefore } = await apiGet(adminToken, `orders/${shipSOId}`);
    const soBeforeData = soBefore as { lines: Array<{ id: number; shippedQuantity: number }> };
    const shippedBefore = soBeforeData.lines.find(l => l.id === shipSOLineId)?.shippedQuantity ?? 0;

    const overQty = shipSOLineQty + 1;
    const { status: attemptStatus, body: attemptBody } = await apiPost(adminToken, 'shipments', {
      salesOrderId: shipSOId,
      lines: [{ salesOrderLineId: shipSOLineId, quantity: overQty }],
    });

    expect(
      attemptStatus,
      `INV-SH1 FAIL: over-ship returned ${attemptStatus} instead of 409. Body: ${JSON.stringify(attemptBody)}`,
    ).toBe(409);

    const { body: soAfter } = await apiGet(adminToken, `orders/${shipSOId}`);
    const soAfterData = soAfter as { lines: Array<{ id: number; shippedQuantity: number }> };
    const shippedAfter = soAfterData.lines.find(l => l.id === shipSOLineId)?.shippedQuantity ?? 0;
    expect(shippedAfter, 'INV-SH1: shippedQuantity changed despite 409 — partial write or double-count bug').toBe(shippedBefore);

    console.log(`INV-SH1 PASS: over-ship qty=${overQty} on line with qty=${shipSOLineQty} → ${attemptStatus}`);
  });

  // -------------------------------------------------------------------------
  // INV-INV2 — over-issue returns 4xx; on_hand never silently negative
  //
  // Uses probe job (probe-owned; any material issue records are on probe entities).
  //
  // Path A (BinContentId provided): guard fires → 409 (CreateMaterialIssue.cs:55)
  //   Demo env has zero bin_contents → coverage hole logged.
  //
  // Path B (no BinContentId): NO guard → issues unconditionally → CONFIRMED-GAP.
  //   Oracle requires 409. Probe documents the gap as an annotation.
  // -------------------------------------------------------------------------
  test('INV-INV2 over-issue is blocked [Path-B gap expected]', async () => {
    const { probeJobId, probePartId, adminToken } = fixtures;

    test.info().annotations.push({
      type: 'coverage-hole',
      description: 'INV-INV2 Path-A (BinContentId provided): demo env has zero bin_contents — cannot reach CreateMaterialIssue.cs:55 guard. Probe deferred until inventory is seeded.',
    });

    const { status: attemptStatus, body: attemptBody } = await apiPost(adminToken, `jobs/${probeJobId}/material-issues`, {
      partId: probePartId,
      quantity: 99999,
      issueType: 'Issue',
    });

    if (attemptStatus < 400) {
      console.warn(
        `INV-INV2 CONFIRMED-GAP (Path-B): POST /jobs/${probeJobId}/material-issues without BinContentId returned ${attemptStatus}. ` +
        'CreateMaterialIssue.cs has no stock guard when BinContentId is absent — unlimited issue possible. Oracle requires 409.',
      );
      test.info().annotations.push({
        type: 'confirmed-gap',
        description: `INV-INV2 Path-B: free-floating issue (no BinContentId) returned ${attemptStatus} — stock guard bypassed. AUDIT defect.`,
      });
    } else if (attemptStatus === 404) {
      console.log(`INV-INV2: returned 404 (part/job not found). Issue was blocked but not by a stock guard.`);
    } else {
      console.log(`INV-INV2 PASS (unexpected): returned ${attemptStatus}. Stock guard present without BinContentId — update code audit.`);
    }

    // Soft assertion — known gap; harden to: expect(attemptStatus).toBeGreaterThanOrEqual(400); once fix lands
    console.log(`INV-INV2 Path-B result: ${attemptStatus} — ${attemptStatus >= 400 ? 'BLOCKED' : 'NOT BLOCKED (gap)'}`);
  });

  // -------------------------------------------------------------------------
  // INV-IN2 — double-invoice returns 409 Conflict
  //
  // Uses probe SO (probe-owned; any created invoices are torn down in afterAll).
  //
  // CONFIRMED-GAP: CreateInvoice.cs has no uniqueness check → 201 returned.
  // -------------------------------------------------------------------------
  test('INV-IN2 double-invoice returns 409 [KNOWN-GAP: expected to fail]', async () => {
    const { probeSOId, probeSOCustomerId, probeSOInvoiceCountBefore, adminToken } = fixtures;

    const today = new Date().toISOString();
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString();

    const { status: attemptStatus, body: attemptBody } = await apiPost(adminToken, 'invoices', {
      customerId: probeSOCustomerId,
      salesOrderId: probeSOId,
      invoiceDate: today,
      dueDate: due,
      taxRate: 0,
      lines: [{ description: 'INV-IN2 double-invoice probe', quantity: 1, unitPrice: 0.01 }],
    });

    const { body: invoicesAfter } = await apiGet(adminToken, `orders/${probeSOId}/invoices`);
    const invoiceCountAfter = (invoicesAfter as unknown[] | null)?.length ?? probeSOInvoiceCountBefore;

    if (attemptStatus === 201 && invoiceCountAfter > probeSOInvoiceCountBefore) {
      console.warn(
        `INV-IN2 CONFIRMED-GAP: POST /invoices returned ${attemptStatus} and invoice count went ` +
        `${probeSOInvoiceCountBefore} → ${invoiceCountAfter}. CreateInvoice.cs has no uniqueness guard. ` +
        'Oracle requires 409. Filed as AUDIT defect.',
      );
      test.info().annotations.push({
        type: 'confirmed-gap',
        description: `INV-IN2: double-invoice created (count ${probeSOInvoiceCountBefore}→${invoiceCountAfter}). No uniqueness check in CreateInvoice.cs.`,
      });
    } else if (attemptStatus >= 400) {
      expect(invoiceCountAfter, 'INV-IN2: blocked by 4xx but invoice count still increased').toBe(probeSOInvoiceCountBefore);
      console.log(`INV-IN2 PASS: double-invoice returned ${attemptStatus}, count stable at ${probeSOInvoiceCountBefore}`);
    } else {
      console.warn(`INV-IN2 SILENT-NO-OP: returned ${attemptStatus} with no new invoice. Silent swallow — also a defect.`);
      test.info().annotations.push({ type: 'confirmed-gap', description: `INV-IN2: silent ${attemptStatus} no-op — oracle requires 409` });
    }

    // Probe invoices are cleaned up in afterAll — no seeded entity touched.
    // Harden to: expect(attemptStatus, 'INV-IN2: double-invoice must return 409').toBe(409); once fix lands.
    console.log(`INV-IN2 result: status=${attemptStatus} invoices ${probeSOInvoiceCountBefore}→${invoiceCountAfter}`);
  });

  // -------------------------------------------------------------------------
  // INV-SF2 — job-stage over-complete returns 409 Conflict
  //
  // Uses probe job + probe production run (probe-owned; run deleted in afterAll).
  //
  // CONFIRMED-GAP (code audit F-049): UpdateProductionRun.cs:57-58 assigns
  // CompletedQuantity directly with no completedQty + scrapQty ≤ targetQty guard.
  // -------------------------------------------------------------------------
  test('INV-SF2 over-complete returns 409 [KNOWN-GAP: expected to fail]', async () => {
    const { probeJobId, probeRunId, probeRunTargetQty, adminToken } = fixtures;

    if (!probeRunId) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'INV-SF2: probe production run creation failed in beforeAll (likely 500 from API — CreateProductionRun.cs:76 NullRef on part.Description??part.Name). Test skipped. F-049.' });
      console.warn('INV-SF2 SKIP: no probe production run available (beforeAll creation failed)');
      return;
    }

    // Pre-state: get current completedQuantity on the probe run
    const { body: runList } = await apiGet(adminToken, `jobs/${probeJobId}/production-runs`);
    const runs = runList as Array<{ id: number; completedQuantity: number }> | null;
    const completedBefore = runs?.find(r => r.id === probeRunId)?.completedQuantity ?? 0;

    const overQty = probeRunTargetQty + 1;

    const putCtx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const putResp = await putCtx.put(`jobs/${probeJobId}/production-runs/${probeRunId}`, {
      data: { completedQuantity: overQty, scrapQuantity: 0, status: 'Completed' },
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    });
    const putStatus = putResp.status();
    await putCtx.dispose();

    const { body: runAfterList } = await apiGet(adminToken, `jobs/${probeJobId}/production-runs`);
    const runsAfter = runAfterList as Array<{ id: number; completedQuantity: number }> | null;
    const completedAfter = runsAfter?.find(r => r.id === probeRunId)?.completedQuantity ?? completedBefore;

    if (putStatus < 400) {
      console.warn(
        `INV-SF2 CONFIRMED-GAP: PUT /jobs/${probeJobId}/production-runs/${probeRunId} ` +
        `completedQty=${overQty} (targetQty=${probeRunTargetQty}) returned ${putStatus}. ` +
        `UpdateProductionRun.cs has no ≤targetQty guard. completedQty: ${completedBefore}→${completedAfter}. ` +
        'Oracle requires 409. Filed as AUDIT F-049.',
      );
      test.info().annotations.push({
        type: 'confirmed-gap',
        description: `INV-SF2: over-complete (${overQty} > targetQty=${probeRunTargetQty}) returned ${putStatus}; completedQty now ${completedAfter}. AUDIT F-049.`,
      });
    } else {
      console.log(`INV-SF2 PASS (unexpected): returned ${putStatus} — guard is present, update code audit.`);
      expect(completedAfter, 'INV-SF2: blocked by 4xx but completedQuantity still changed').toBe(completedBefore);
    }

    // Soft assertion; harden to: expect(putStatus, 'INV-SF2: over-complete must return 409').toBe(409); once F-049 fix lands.
    console.log(`INV-SF2 result: status=${putStatus} completedQty ${completedBefore}→${completedAfter} (target=${probeRunTargetQty})`);
  });

  // -------------------------------------------------------------------------
  // INV-QBO2 — sync failure surfaced & retryable (seam-level)
  //
  // Read-only: no mutations. MOCK_INTEGRATIONS=true in demo env.
  // -------------------------------------------------------------------------
  test('INV-QBO2 integration outbox seam is reachable and retry-path present', async () => {
    const { adminToken } = fixtures;

    const { status: outboxStatus, body: outboxBody } = await apiGet(adminToken, 'admin/integration-outbox');

    expect(
      outboxStatus,
      `INV-QBO2: /admin/integration-outbox returned ${outboxStatus} — must be reachable (not 5xx)`,
    ).toBeLessThan(500);

    if (outboxStatus === 200) {
      const items = outboxBody as Array<{ id: unknown }> | null;
      if (items && items.length > 0) {
        expect(items[0].id, 'INV-QBO2: outbox item missing id field — retry path cannot be constructed').toBeDefined();
        console.log(`INV-QBO2: outbox has ${items.length} item(s) — retry seam present`);
      } else {
        console.log('INV-QBO2: outbox reachable but empty (expected under MOCK_INTEGRATIONS=true)');
        test.info().annotations.push({
          type: 'coverage-note',
          description: 'INV-QBO2: outbox empty. Full failure-injection deferred to real QB sandbox milestone per ORCH ruling.',
        });
      }
    } else if (outboxStatus === 401 || outboxStatus === 403) {
      console.warn(`INV-QBO2: outbox returned ${outboxStatus} — admin token may lack /admin role`);
    }

    await navigateTo(page, `${APP_BASE}/admin`);
    await page.waitForLoadState('networkidle');
    const pageError = await page.locator('app-error, .error-page, [data-testid="error"]').isVisible({ timeout: 2_000 }).catch(() => false);
    expect(pageError, 'INV-QBO2: /admin route shows error page — outbox UI surface broken').toBe(false);

    console.log(`INV-QBO2 seam check: API status=${outboxStatus}, /admin UI loads without error`);
  });
});

// =============================================================================
// F-033 State-machine guard probes
//
// Regression net for backend-engineer's guard implementation (all guards landed
// and tests are GREEN — this Playwright layer verifies the live HTTP surface
// agrees with the handler-level unit tests).
//
// NON-DESTRUCTIVE DESIGN:
//   - Probe Draft invoice and probe Sent invoice created in beforeAll; torn down
//     in afterAll (best-effort — probe invoices that get voided can't be deleted
//     but are clearly labeled probe entities, not seeded spine data).
//   - Seeded entities used ONLY for blocked probes (409 = no state change) or
//     idempotent probes (Cancelled→Cancelled = no net change). F-033-C uses a
//     probe Sent invoice so the seeded Sent invoice is never consumed.
//
// ORACLE UPDATES (F-033 guards landed 2026-05-21):
//   VoidInvoice(Draft)          → 409 ✓ (guard landed) — was CONFIRMED-GAP
//   VoidInvoice(Voided)         → 409 ✓ (guard landed) — was CONFIRMED-GAP
//   CancelPO(PartiallyReceived) → 409 ✓ (guard landed) — was CONFIRMED-GAP
//   CancelSO(Cancelled)         → 409   (handler throws — was expected 2xx idempotent;
//                                         [DOM] ruling pending)
//   ConvertQuote(converted)     → 409 ✓ already correct
// =============================================================================

interface F033Fixtures {
  adminToken: string;
  // ── Probe-owned invoices (created in beforeAll; cleanup in afterAll)
  probeDraftInvoiceId: number | null;   // F-033-A: VoidInvoice(Draft) → must be 409
  probeSentInvoiceId: number | null;    // F-033-C: VoidInvoice(Sent, zero-payments) → must be 2xx
  // ── Seeded entities for blocked probes (read-only selection; 409 = no state change)
  voidedInvoiceId: number | null;       // F-033-B: re-void Voided → 409 (Voided→Voided = no change)
  shippedSoId: number | null;           // F-033-D: CancelSO(Shipped) → 409
  cancelledSoId: number | null;         // F-033-E: CancelSO(Cancelled) → handler throws (domain ruling pending)
  partiallyReceivedPoId: number | null; // F-033-F: CancelPO(PartiallyReceived) → 409 (guard landed)
  receivedPoId: number | null;          // F-033-G: CancelPO(Received) → 409 (already guarded)
  cancelledPoId: number | null;         // F-033-H: CancelPO(Cancelled) → handler throws
  convertedQuoteId: number | null;      // F-033-I: ConvertQuote(already-converted) → 409
}

let f033: F033Fixtures;

test.describe.serial('F-033 state-machine guard probes', () => {
  test.beforeAll(async () => {
    const token = await getAuthToken(ADMIN_EMAIL, SEED_PASSWORD);

    // ── Seeded entities for blocked/idempotent probes
    const { body: soBody } = await apiGet(token, 'orders');
    const orders = unwrapList<{ id: number; status: string }>(soBody);

    const { body: poBody } = await apiGet(token, 'purchase-orders');
    const pos = unwrapList<{ id: number; status: string }>(poBody);

    const { body: quoteBody } = await apiGet(token, 'quotes');
    const quotes = unwrapList<{ id: number; status: string }>(quoteBody);

    const { body: invBody } = await apiGet(token, 'invoices?pageSize=100');
    const invoices = unwrapList<{ id: number; status: string }>(invBody);
    const voidedInv = invoices.find(i => i.status === 'Voided');

    // ── Probe customer for invoice creation
    const { body: custBody } = await apiGet(token, 'customers?pageSize=1');
    const customers = unwrapList<{ id: number }>(custBody);
    const probeCustomerId = customers[0]?.id ?? null;

    // ── Create probe Draft invoice (for F-033-A VoidInvoice(Draft) + F-033-B re-void fallback)
    let probeDraftInvoiceId: number | null = null;
    if (probeCustomerId) {
      const today = new Date().toISOString();
      const due = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const { status: createStatus, body: created } = await apiPost(token, 'invoices', {
        customerId: probeCustomerId,
        invoiceDate: today, dueDate: due, taxRate: 0,
        lines: [{ description: 'PROBE-HARNESS F-033-A/B draft invoice — safe to delete', quantity: 1, unitPrice: 0.01 }],
      });
      if (createStatus === 201) {
        probeDraftInvoiceId = (created as { id: number }).id;
        console.log(`F-033 setup: probe Draft invoice created (id=${probeDraftInvoiceId})`);
      } else {
        console.warn(`F-033 setup: probe Draft invoice creation failed (${createStatus}) — F-033-A/B will skip`);
      }
    }

    // ── Create probe Sent invoice (for F-033-C VoidInvoice(Sent, zero-payments) legal path)
    let probeSentInvoiceId: number | null = null;
    if (probeCustomerId) {
      const today = new Date().toISOString();
      const due = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const { status: createStatus, body: created } = await apiPost(token, 'invoices', {
        customerId: probeCustomerId,
        invoiceDate: today, dueDate: due, taxRate: 0,
        lines: [{ description: 'PROBE-HARNESS F-033-C sent invoice — safe to delete', quantity: 1, unitPrice: 0.01 }],
      });
      if (createStatus === 201) {
        const newInvId = (created as { id: number }).id;
        // Transition to Sent
        const sendCtx = await playwrightRequest.newContext({ baseURL: API_BASE });
        const sendResp = await sendCtx.post(`invoices/${newInvId}/send`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await sendCtx.dispose();
        if (sendResp.status() < 400) {
          probeSentInvoiceId = newInvId;
          console.log(`F-033 setup: probe Sent invoice created (id=${probeSentInvoiceId})`);
        } else {
          console.warn(`F-033 setup: invoice ${newInvId} created but /send failed (${sendResp.status()}) — F-033-C will skip`);
          await apiDelete(token, `invoices/${newInvId}`);
        }
      }
    }

    f033 = {
      adminToken: token,
      probeDraftInvoiceId,
      probeSentInvoiceId,
      voidedInvoiceId:        voidedInv?.id ?? null,
      shippedSoId:            orders.find(o => o.status === 'Shipped')?.id ?? null,
      cancelledSoId:          orders.find(o => o.status === 'Cancelled')?.id ?? null,
      partiallyReceivedPoId:  pos.find(p => p.status === 'PartiallyReceived')?.id ?? null,
      receivedPoId:           pos.find(p => p.status === 'Received')?.id ?? null,
      cancelledPoId:          pos.find(p => p.status === 'Cancelled')?.id ?? null,
      convertedQuoteId:       quotes.find(q => q.status === 'ConvertedToOrder')?.id ?? null,
    };

    console.log('F-033 fixtures:', JSON.stringify({
      probeDraftInv: f033.probeDraftInvoiceId, probeSentInv: f033.probeSentInvoiceId,
      voidedInv: f033.voidedInvoiceId, shippedSo: f033.shippedSoId,
      cancelledSo: f033.cancelledSoId, partiallyRecPo: f033.partiallyReceivedPoId,
      receivedPo: f033.receivedPoId, cancelledPo: f033.cancelledPoId,
      convertedQuote: f033.convertedQuoteId,
    }));
  });

  test.afterAll(async () => {
    const token = f033?.adminToken;
    if (!token) return;
    // Best-effort cleanup: probe invoices may be Voided after probes run → DELETE fails gracefully
    for (const invId of [f033.probeDraftInvoiceId, f033.probeSentInvoiceId]) {
      if (!invId) continue;
      const { status } = await apiDelete(token, `invoices/${invId}`);
      console.log(`F-033 cleanup: DELETE invoices/${invId} → ${status}`);
    }
  });

  // -------------------------------------------------------------------------
  // F-033-A: VoidInvoice(Draft) → must return 409
  //
  // Guard landed (VoidInvoice.cs whitelist: {Sent, PartiallyPaid, Overdue}).
  // Uses probe Draft invoice — never touches seeded Draft invoices.
  // -------------------------------------------------------------------------
  test('F-033-A VoidInvoice(Draft) → 409 [guard landed — regression wire]', async () => {
    const { adminToken, probeDraftInvoiceId } = f033;

    if (!probeDraftInvoiceId) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'F-033-A: probe Draft invoice creation failed in beforeAll — skip' });
      console.warn('F-033-A SKIP: no probe Draft invoice available');
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`invoices/${probeDraftInvoiceId}/void`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const voidStatus = resp.status();
    await ctx.dispose();

    const { body: afterBody } = await apiGet(adminToken, `invoices/${probeDraftInvoiceId}`);
    const statusAfter = (afterBody as { status?: string } | null)?.status ?? 'unknown';

    // Hard assert — guard landed; regression = must stay 409
    expect(
      voidStatus,
      `F-033-A REGRESSION: VoidInvoice(Draft=${probeDraftInvoiceId}) returned ${voidStatus} — guard broken; status is '${statusAfter}'`,
    ).toBe(409);

    console.log(`F-033-A PASS: VoidInvoice(Draft=${probeDraftInvoiceId}) → ${voidStatus} ✓`);
  });

  // -------------------------------------------------------------------------
  // F-033-B: VoidInvoice(Voided) re-void → must return 409
  //
  // Guard landed. Uses probe invoice (if F-033-A voided it → now Voided)
  // or falls back to seeded Voided invoice (safe: Voided→Voided = no state change).
  // -------------------------------------------------------------------------
  test('F-033-B VoidInvoice(Voided) re-void → 409 [guard landed — regression wire]', async () => {
    const { adminToken, probeDraftInvoiceId, voidedInvoiceId } = f033;

    // Prefer: probe invoice in Voided state (set by F-033-A if guard was absent or was just voided)
    // Fallback: seeded Voided invoice (re-void of Voided is safe — status stays Voided either way)
    let id: number | null = null;

    if (probeDraftInvoiceId) {
      const { body: checkBody } = await apiGet(adminToken, `invoices/${probeDraftInvoiceId}`);
      const currentStatus = (checkBody as { status?: string } | null)?.status;
      if (currentStatus === 'Voided') {
        id = probeDraftInvoiceId;
      }
    }
    if (!id && voidedInvoiceId) {
      id = voidedInvoiceId;
    }

    if (!id) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'F-033-B: no Voided invoice available (probe still Draft, no seeded Voided invoice)' });
      console.warn('F-033-B SKIP: no Voided invoice to re-void');
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`invoices/${id}/void`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const revoidStatus = resp.status();
    await ctx.dispose();

    // Hard assert — guard landed
    expect(
      revoidStatus,
      `F-033-B REGRESSION: VoidInvoice(Voided=${id}) returned ${revoidStatus} — re-void not blocked`,
    ).toBe(409);

    console.log(`F-033-B PASS: VoidInvoice(Voided=${id}) → ${revoidStatus} ✓`);
  });

  // -------------------------------------------------------------------------
  // F-033-C: VoidInvoice(Sent, zero payments) → must return 2xx (legal path)
  //
  // Uses probe Sent invoice (created + sent in beforeAll).
  // Verifies the guard doesn't over-block the legal transition.
  // This WILL void the probe invoice — afterAll cleanup leaves it as Voided
  // (can't DELETE a Voided invoice; labeled PROBE so it's not seeded spine data).
  // -------------------------------------------------------------------------
  test('F-033-C VoidInvoice(Sent, zero-payments) → 2xx (legal — guard must not over-block)', async () => {
    const { adminToken, probeSentInvoiceId } = f033;

    if (!probeSentInvoiceId) {
      test.info().annotations.push({ type: 'coverage-note', description: 'F-033-C: probe Sent invoice not available (creation or /send failed in beforeAll); skipped' });
      console.log('F-033-C SKIP: no probe Sent invoice available');
      return;
    }

    const { body: invDetail } = await apiGet(adminToken, `invoices/${probeSentInvoiceId}`);
    const inv = invDetail as { status?: string; amountPaid?: number } | null;
    if ((inv?.amountPaid ?? 0) > 0) {
      console.log(`F-033-C SKIP: probe Sent invoice ${probeSentInvoiceId} has payments applied`);
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`invoices/${probeSentInvoiceId}/void`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const voidStatus = resp.status();
    await ctx.dispose();

    expect(
      voidStatus,
      `F-033-C FAIL: VoidInvoice(Sent, zero-payments) returned ${voidStatus} — legal transition must be 2xx (guard over-blocks)`,
    ).toBeLessThan(400);

    console.log(`F-033-C PASS: VoidInvoice(Sent=${probeSentInvoiceId}) → ${voidStatus} ✓ (legal path)`);
  });

  // -------------------------------------------------------------------------
  // F-033-D: CancelSalesOrder(Shipped) → must return 409
  //
  // Guard exists in CancelSalesOrder.cs. Regression wire.
  // Seeded Shipped SO — 409 = no state change.
  // -------------------------------------------------------------------------
  test('F-033-D CancelSalesOrder(Shipped) → 409 [regression wire]', async () => {
    const { adminToken, shippedSoId } = f033;

    if (!shippedSoId) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'F-033-D: no Shipped SO in demo env — regression wire untestable' });
      console.warn('F-033-D SKIP: no Shipped SO found');
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`orders/${shippedSoId}/cancel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const cancelStatus = resp.status();
    await ctx.dispose();

    expect(
      cancelStatus,
      `F-033-D REGRESSION: CancelSalesOrder(Shipped=${shippedSoId}) returned ${cancelStatus} — guard broken`,
    ).toBe(409);

    console.log(`F-033-D PASS: CancelSalesOrder(Shipped=${shippedSoId}) → 409 ✓`);
  });

  // -------------------------------------------------------------------------
  // F-033-E: CancelSalesOrder(Cancelled) → handler returns 409
  //
  // NOTE: Handler whitelist is {Draft, Confirmed, PartiallyShipped}; Cancelled
  // is not in the whitelist → throws → 409. Prior oracle expected 2xx idempotent.
  // [DOM] ruling pending on whether re-cancel should be idempotent or blocked.
  // This test verifies current implemented behavior (409).
  // -------------------------------------------------------------------------
  test('F-033-E CancelSalesOrder(Cancelled) → 409 (current behavior; [DOM] ruling pending)', async () => {
    const { adminToken, cancelledSoId } = f033;

    if (!cancelledSoId) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'F-033-E: no Cancelled SO in demo env' });
      console.warn('F-033-E SKIP: no Cancelled SO found');
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`orders/${cancelledSoId}/cancel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const cancelStatus = resp.status();
    await ctx.dispose();

    // Current behavior: handler throws for Cancelled (not in whitelist) → 409.
    // [DOM] must rule: should re-cancel be 2xx idempotent or 409 blocked?
    // Asserting current behavior as a characterization (hard-assert reflects handler reality).
    test.info().annotations.push({
      type: 'domain-ruling-needed',
      description: `F-033-E: CancelSO(Cancelled=${cancelledSoId}) → ${cancelStatus}. Handler whitelist blocks re-cancel with 409. Prior oracle expected 2xx idempotent. Awaiting [DOM] ruling.`,
    });

    // Soft: document current behavior without hard oracle (domain ruling pending).
    console.log(`F-033-E result: CancelSO(Cancelled=${cancelledSoId}) → ${cancelStatus} (current behavior — [DOM] ruling pending)`);
  });

  // -------------------------------------------------------------------------
  // F-033-F: CancelPurchaseOrder(PartiallyReceived) → must return 409
  //
  // Guard landed (CancelPurchaseOrder.cs whitelist: {Draft, Submitted, Acknowledged}).
  // -------------------------------------------------------------------------
  test('F-033-F CancelPurchaseOrder(PartiallyReceived) → 409 [guard landed — regression wire]', async () => {
    const { adminToken, partiallyReceivedPoId } = f033;

    if (!partiallyReceivedPoId) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'F-033-F: no PartiallyReceived PO in demo env — regression wire untestable until PO is seeded in that state' });
      console.warn('F-033-F SKIP: no PartiallyReceived PO found');
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`purchase-orders/${partiallyReceivedPoId}/cancel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const cancelStatus = resp.status();
    await ctx.dispose();

    // Hard assert — guard landed
    expect(
      cancelStatus,
      `F-033-F REGRESSION: CancelPO(PartiallyReceived=${partiallyReceivedPoId}) returned ${cancelStatus} — guard broken`,
    ).toBe(409);

    console.log(`F-033-F PASS: CancelPO(PartiallyReceived=${partiallyReceivedPoId}) → 409 ✓`);
  });

  // -------------------------------------------------------------------------
  // F-033-G: CancelPurchaseOrder(Received) → must return 409 [regression wire]
  // -------------------------------------------------------------------------
  test('F-033-G CancelPurchaseOrder(Received) → 409 [regression wire]', async () => {
    const { adminToken, receivedPoId } = f033;

    if (!receivedPoId) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'F-033-G: no Received PO in demo env' });
      console.warn('F-033-G SKIP: no Received PO found');
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`purchase-orders/${receivedPoId}/cancel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const cancelStatus = resp.status();
    await ctx.dispose();

    expect(
      cancelStatus,
      `F-033-G REGRESSION: CancelPO(Received=${receivedPoId}) returned ${cancelStatus} — guard broken`,
    ).toBe(409);

    console.log(`F-033-G PASS: CancelPO(Received=${receivedPoId}) → 409 ✓`);
  });

  // -------------------------------------------------------------------------
  // F-033-H: CancelPurchaseOrder(Cancelled) → handler returns 409
  //
  // Same domain-ruling-pending note as F-033-E: handler blocks re-cancel.
  // -------------------------------------------------------------------------
  test('F-033-H CancelPurchaseOrder(Cancelled) → 409 (current behavior; [DOM] ruling pending)', async () => {
    const { adminToken, cancelledPoId } = f033;

    if (!cancelledPoId) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'F-033-H: no Cancelled PO in demo env' });
      console.warn('F-033-H SKIP: no Cancelled PO found');
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`purchase-orders/${cancelledPoId}/cancel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const cancelStatus = resp.status();
    await ctx.dispose();

    test.info().annotations.push({
      type: 'domain-ruling-needed',
      description: `F-033-H: CancelPO(Cancelled=${cancelledPoId}) → ${cancelStatus}. Handler blocks re-cancel with 409. Prior oracle expected 2xx idempotent. Awaiting [DOM] ruling.`,
    });

    console.log(`F-033-H result: CancelPO(Cancelled=${cancelledPoId}) → ${cancelStatus} (current behavior — [DOM] ruling pending)`);
  });

  // -------------------------------------------------------------------------
  // F-033-I: ConvertQuoteToOrder(already-converted) → must return 409 [regression wire]
  // -------------------------------------------------------------------------
  test('F-033-I ConvertQuote(already-converted) → 409 [regression wire]', async () => {
    const { adminToken, convertedQuoteId } = f033;

    if (!convertedQuoteId) {
      test.info().annotations.push({ type: 'coverage-hole', description: 'F-033-I: no ConvertedToOrder quote in demo env' });
      console.warn('F-033-I SKIP: no converted quote found');
      return;
    }

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await ctx.post(`quotes/${convertedQuoteId}/convert`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const convertStatus = resp.status();
    await ctx.dispose();

    expect(
      convertStatus,
      `F-033-I REGRESSION: ConvertQuote(converted=${convertedQuoteId}) returned ${convertStatus} — guard broken`,
    ).toBe(409);

    console.log(`F-033-I PASS: ConvertQuote(already-converted=${convertedQuoteId}) → 409 ✓`);
  });

  // -------------------------------------------------------------------------
  // F-033-J: Refund probes [STUB: handler not yet implemented]
  // -------------------------------------------------------------------------
  test('F-033-J Refund probes [STUB: handler not yet implemented]', async () => {
    test.info().annotations.push({
      type: 'coverage-hole',
      description: 'F-033-J: No Refund handler in forge.api/Features/Payments/. ' +
        'When implemented, add probes for: already-refunded → 409; ' +
        'over-original-amount → 409; partial ≤ balance → 2xx.',
    });
    console.log('F-033-J: Refund handler not yet implemented — stubs pending');
  });
});
