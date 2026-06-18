/**
 * Standalone-Accounting Golden Path — asserted end-to-end backbone.
 *
 * Turns the structural "the chain runs" (interactive scenarios 02b/03b) into
 * "the chain is provably correct". Drives the order-to-cash happy path via the
 * API and ASSERTS each domain transition + that the AR balance settles to zero:
 *
 *   quote (valid period) → send → accept → convert to SO
 *     → confirm → ship (full) → over-ship blocked (inventory gate)
 *     → partial invoice → remainder invoice (fully invoiced == SO total)
 *     → pay each invoice (BalanceDue → 0)
 *     → ledger balances: Σ invoices == SO total, all paid
 *
 * This is the 80% common-path regression backbone. When a transition is NOT yet
 * built (e.g. SO never auto-advances to Completed), the relevant assertion fails
 * loudly — which is the point: it tells us what's real vs. dark in standalone
 * accounting (CAP-ACCT-BUILTIN).
 *
 * PRECONDITION: seeded stack (admin@forge.local) + standalone accounting.
 *   SEED_USER_PASSWORD=ForgeDemo!2026 npx playwright test golden-path-accounting \
 *     --config=e2e/playwright.config.ts
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';
import { getAuthToken, SEED_PASSWORD } from '../helpers/auth.helper';

const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';
const ADMIN_EMAIL = 'admin@forge.local';

// Clean math: no tax, qty 10 @ $100 → SO total 1000; split-invoiced 400 + 600.
const QTY = 10;
const PRICE = 100;
const SO_TOTAL = QTY * PRICE;

function normalizeCasing<T>(obj: unknown): T {
  if (obj === null || typeof obj !== 'object') return obj as T;
  if (Array.isArray(obj)) return obj.map(i => normalizeCasing(i)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k.charAt(0).toLowerCase() + k.slice(1)] = Array.isArray(v) ? v.map(i => normalizeCasing(i)) : normalizeCasing(v);
  }
  return out as T;
}

async function api(
  token: string, method: 'get' | 'post' | 'delete', path: string, data?: Record<string, unknown>,
  // Response bodies are dynamically shaped across many O2C endpoints; `any` keeps
  // the asserted golden-path readable without a cast per field access.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; body: any }> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const opts = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(data ? { data } : {}) };
  const resp = method === 'get' ? await ctx.get(path, opts)
    : method === 'delete' ? await ctx.delete(path, opts)
    : await ctx.post(path, opts);
  const raw = await resp.json().catch(() => null);
  await ctx.dispose();
  return { status: resp.status(), body: raw !== null ? normalizeCasing(raw) : null };
}
const isoNow = () => new Date().toISOString();
const isoPlusDays = (d: number) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString(); };

test.describe.serial('Standalone-accounting golden path', () => {
  let token: string;
  let customerId: number;
  // Lines are description-only — keeps the test independent of any parts seed.
  const partId: number | null = null;

  const created: { customerId?: number; quoteId?: number; soId?: number; soLineId?: number; invoiceIds: number[]; paymentIds: number[]; shipmentIds: number[] } =
    { invoiceIds: [], paymentIds: [], shipmentIds: [] };

  test.beforeAll(async () => {
    token = await getAuthToken(ADMIN_EMAIL, SEED_PASSWORD);

    // Self-sufficient: create our own customer so the test runs on a minimal
    // seed (no demo-data dependency).
    const c = await api(token, 'post', 'customers', { name: `GOLDEN-PATH Co ${new Date().toISOString()}` });
    if (c.status !== 201) throw new Error(`golden-path: customer create failed (${c.status}): ${JSON.stringify(c.body)}`);
    customerId = c.body.id;
    created.customerId = customerId;
  });

  test.afterAll(async () => {
    // Best-effort teardown (void/delete in reverse dependency order).
    for (const id of created.paymentIds) await api(token, 'delete', `payments/${id}`).catch(() => {});
    for (const id of created.invoiceIds) {
      await api(token, 'post', `invoices/${id}/void`).catch(() => {});
      await api(token, 'delete', `invoices/${id}`).catch(() => {});
    }
    if (created.soId) await api(token, 'post', `orders/${created.soId}/cancel`).catch(() => {});
    if (created.soId) await api(token, 'delete', `orders/${created.soId}`).catch(() => {});
    if (created.quoteId) await api(token, 'delete', `quotes/${created.quoteId}`).catch(() => {});
    if (created.customerId) await api(token, 'delete', `customers/${created.customerId}`).catch(() => {});
  });

  test('1. quote created with a valid-through date (Draft)', async () => {
    const { status, body } = await api(token, 'post', 'quotes', {
      customerId, expirationDate: isoPlusDays(30), taxRate: 0,
      lines: [{ partId, description: 'GOLDEN-PATH item — safe to delete', quantity: QTY, unitPrice: PRICE }],
    });
    expect(status, `create quote: ${JSON.stringify(body)}`).toBe(201);
    created.quoteId = body.id;
    expect(String(body.status)).toBe('Draft');
    expect(body.expirationDate, 'quote must carry a valid-through date').toBeTruthy();
  });

  test('2. quote sent → Sent', async () => {
    const { status, body } = await api(token, 'post', `quotes/${created.quoteId}/send`);
    expect(status, `send: ${JSON.stringify(body)}`).toBeLessThan(300);
    const q = (await api(token, 'get', `quotes/${created.quoteId}`)).body;
    expect(String(q.status)).toBe('Sent');
  });

  test('3. quote accepted → Accepted (the outstanding commitment)', async () => {
    const { status, body } = await api(token, 'post', `quotes/${created.quoteId}/accept`);
    expect(status, `accept: ${JSON.stringify(body)}`).toBeLessThan(300);
    const q = (await api(token, 'get', `quotes/${created.quoteId}`)).body;
    expect(String(q.status)).toBe('Accepted');
  });

  test('4. quote converted → Sales Order with matching total', async () => {
    const { status, body } = await api(token, 'post', `quotes/${created.quoteId}/convert`);
    expect(status, `convert: ${JSON.stringify(body)}`).toBeLessThan(300);
    // Convert returns the SO (or its id); fall back to looking it up by quote.
    created.soId = body?.id ?? body?.salesOrderId;
    if (!created.soId) {
      const q = (await api(token, 'get', `quotes/${created.quoteId}`)).body;
      created.soId = q?.salesOrderId;
    }
    expect(created.soId, 'convert must yield a sales order').toBeTruthy();
    const so = (await api(token, 'get', `orders/${created.soId}`)).body;
    created.soLineId = so.lines?.[0]?.id;
    expect(Number(so.total)).toBe(SO_TOTAL);
    const q = (await api(token, 'get', `quotes/${created.quoteId}`)).body;
    expect(String(q.status)).toBe('ConvertedToOrder');
  });

  test('5. SO confirmed → Confirmed', async () => {
    const { status, body } = await api(token, 'post', `orders/${created.soId}/confirm`);
    expect(status, `confirm: ${JSON.stringify(body)}`).toBeLessThan(300);
    const so = (await api(token, 'get', `orders/${created.soId}`)).body;
    expect(String(so.status)).toBe('Confirmed');
  });

  test('6. ship full → Shipped; over-ship blocked (inventory gate)', async () => {
    const ship = await api(token, 'post', 'shipments', {
      salesOrderId: created.soId,
      lines: [{ salesOrderLineId: created.soLineId, quantity: QTY }],
    });
    expect(ship.status, `ship: ${JSON.stringify(ship.body)}`).toBe(201);
    if (ship.body?.id) created.shipmentIds.push(ship.body.id);

    const so = (await api(token, 'get', `orders/${created.soId}`)).body;
    const line = so.lines.find((l: { id: number }) => l.id === created.soLineId);
    expect(Number(line.shippedQuantity)).toBe(QTY);
    expect(Number(line.remainingQuantity)).toBe(0);
    expect(String(so.status)).toBe('Shipped');

    // Inventory gate: nothing remains, so a second shipment must be rejected.
    const over = await api(token, 'post', 'shipments', {
      salesOrderId: created.soId,
      lines: [{ salesOrderLineId: created.soLineId, quantity: 1 }],
    });
    expect(over.status, 'over-ship must be blocked').toBeGreaterThanOrEqual(400);
  });

  test('7. invoice the shipment → fully invoiced == SO total', async () => {
    // Domain rule (unique ix_invoices_shipment_id): one invoice per shipment.
    // Partial invoicing is therefore driven by partial *shipments* (ship some →
    // invoice that shipment → ship the rest → invoice that shipment), not multiple
    // invoices against one shipment. This golden path ships in full, so it invoices
    // once for the full shipped quantity. (A partial-shipment variant is a worthwhile
    // follow-up to assert the partial-increment loop.)
    const inv = await api(token, 'post', 'invoices', {
      customerId, salesOrderId: created.soId, shipmentId: created.shipmentIds[0] ?? null,
      invoiceDate: isoNow(), dueDate: isoPlusDays(30), taxRate: 0, notes: 'GOLDEN-PATH',
      lines: [{ partId, description: 'GOLDEN-PATH item', quantity: QTY, unitPrice: PRICE }],
    });
    expect(inv.status, `invoice: ${JSON.stringify(inv.body)}`).toBe(201);
    created.invoiceIds.push(inv.body.id);
    expect(Number(inv.body.total)).toBe(SO_TOTAL);

    // Send the invoice to the customer — a Draft invoice can't take payment.
    const send = await api(token, 'post', `invoices/${inv.body.id}/send`);
    expect(send.status, `send invoice: ${JSON.stringify(send.body)}`).toBeLessThan(300);

    // INV-IN2: a second invoice for the same shipment is rejected with 409 (the
    // domain guard), not a 500 from the unique-index violation.
    const dup = await api(token, 'post', 'invoices', {
      customerId, salesOrderId: created.soId, shipmentId: created.shipmentIds[0] ?? null,
      invoiceDate: isoNow(), dueDate: isoPlusDays(30), taxRate: 0,
      lines: [{ partId, description: 'dup', quantity: 1, unitPrice: PRICE }],
    });
    expect(dup.status, 'double-invoicing a shipment must return 409').toBe(409);

    // orders/{id}/invoices list items expose `totalAmount` (the detail model uses `total`).
    const listBody = (await api(token, 'get', `orders/${created.soId}/invoices`)).body;
    const invoices = (Array.isArray(listBody) ? listBody : (listBody?.items ?? [])) as Array<{ totalAmount: number }>;
    const invoiced = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    expect(invoiced, 'fully invoiced == SO total').toBe(SO_TOTAL);
  });

  test('8. pay each invoice → BalanceDue 0', async () => {
    for (const invId of created.invoiceIds) {
      const inv = (await api(token, 'get', `invoices/${invId}`)).body;
      const pay = await api(token, 'post', 'payments', {
        customerId, method: 'Check', amount: Number(inv.total), paymentDate: isoNow(),
        referenceNumber: `GP-${invId}`, applications: [{ invoiceId: invId, amount: Number(inv.total) }],
      });
      expect(pay.status, `payment: ${JSON.stringify(pay.body)}`).toBe(201);
      if (pay.body?.id) created.paymentIds.push(pay.body.id);

      const after = (await api(token, 'get', `invoices/${invId}`)).body;
      expect(Number(after.amountPaid)).toBe(Number(inv.total));
      expect(Number(after.balanceDue)).toBe(0);
    }
  });

  test('9. ledger balances — fully invoiced, fully paid', async () => {
    // Use invoice details for the reliable total / balanceDue fields.
    let invoiced = 0, outstanding = 0;
    for (const id of created.invoiceIds) {
      const inv = (await api(token, 'get', `invoices/${id}`)).body;
      invoiced += Number(inv.total);
      outstanding += Number(inv.balanceDue);
    }
    expect(invoiced, 'fully invoiced').toBe(SO_TOTAL);
    expect(outstanding, 'fully paid — AR balance settles to zero').toBe(0);

    // Terminal O2C state: a fully shipped order whose invoices are all paid is done.
    const so = (await api(token, 'get', `orders/${created.soId}`)).body;
    expect(String(so.status), 'SO advances to Completed when fully shipped + invoiced + paid').toBe('Completed');
  });
});
