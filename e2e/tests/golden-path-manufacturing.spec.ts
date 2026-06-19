/**
 * Manufacturing Golden Path — asserted end-to-end, the production sibling of
 * golden-path-accounting.spec.ts. Where the accounting path ships directly, this
 * one drives the FULL make-to-order narrative through production and asserts the
 * SO advances on the right signal at each step:
 *
 *   quote-less SO → confirm → (jobs auto-created) → SO Confirmed
 *     → move jobs into production            → SO InProduction
 *     → move jobs to a ship/complete stage   → SO STILL InProduction  ← the decoupling:
 *                                               the job kanban must NOT mark it Shipped
 *     → one-click create-shipment-from-order → SO Shipped (a real shipment is the truth)
 *     → invoice → send → pay                 → SO Completed
 *
 * This proves the connective tissue across jobs + shipping + accounting is coherent:
 * jobs own production status, shipments own fulfillment, accounting owns completion —
 * no two writers fighting over Shipped. API-only; self-sufficient.
 *
 * PRECONDITION: seeded stack (admin@forge.local) + the default "Production" track.
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';
import { getAuthToken, SEED_PASSWORD } from '../helpers/auth.helper';

const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';
const ADMIN_EMAIL = 'admin@forge.local';

const QTY = 3;
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
  token: string, method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, data?: Record<string, unknown>,
  // O2C/job response bodies are dynamically shaped; `any` keeps the asserted path readable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; body: any }> {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const opts = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(data ? { data } : {}) };
  const resp = method === 'get' ? await ctx.get(path, opts)
    : method === 'delete' ? await ctx.delete(path, opts)
    : method === 'patch' ? await ctx.patch(path, opts)
    : method === 'put' ? await ctx.put(path, opts)
    : await ctx.post(path, opts);
  const raw = await resp.json().catch(() => null);
  await ctx.dispose();
  return { status: resp.status(), body: raw !== null ? normalizeCasing(raw) : null };
}

// The full make-to-order path needs the production module (jobs/kanban) AND the O2C chain (orders →
// shipping → invoice → payment). Enable the whole closure in topological order (dependencies first);
// idempotent — already-on caps are a no-op. A realistic manufacturing install has all of these on.
const REQUIRED_CAPS = [
  // master data + foundational
  'CAP-IDEN-TENANT-CONFIG', 'CAP-MD-UOM', 'CAP-MD-CUSTOMERS', 'CAP-MD-PARTS',
  'CAP-MD-WORKCENTERS', 'CAP-MD-TAXCODES', 'CAP-MD-BOM', 'CAP-MD-ROUTING',
  // order-to-cash chain
  'CAP-O2C-QUOTE', 'CAP-O2C-SO', 'CAP-O2C-PICKPACK', 'CAP-O2C-SHIP', 'CAP-O2C-INVOICE', 'CAP-O2C-CASH',
  // production / kanban
  'CAP-EXT-KANBAN', 'CAP-MFG-WO-RELEASE',
];
const isoNow = () => new Date().toISOString();
const isoPlusDays = (d: number) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString(); };

async function soStatus(token: string, soId: number): Promise<string> {
  return String((await api(token, 'get', `orders/${soId}`)).body.status);
}

test.describe.serial('Manufacturing golden path', () => {
  let token: string;
  let customerId: number;
  let soId: number;
  let inProductionStageId: number;
  let shippedStageId: number;
  let jobIds: number[] = [];
  const created: { invoiceIds: number[]; paymentIds: number[]; shipmentIds: number[] } =
    { invoiceIds: [], paymentIds: [], shipmentIds: [] };

  test.beforeAll(async () => {
    token = await getAuthToken(ADMIN_EMAIL, SEED_PASSWORD);

    // Ensure the production module is enabled (topological order so dependency gates pass).
    for (const cap of REQUIRED_CAPS) {
      await api(token, 'put', `capabilities/${cap}/enabled`, { enabled: true, reason: 'mfg golden path e2e' });
    }
    const jobsReachable = await api(token, 'get', 'jobs?pageSize=1');
    expect(jobsReachable.status, 'production module (CAP-MFG-WO-RELEASE) must be enabled').toBeLessThan(300);

    const c = await api(token, 'post', 'customers', { name: `MFG-GOLDEN Co ${new Date().toISOString()}` });
    if (c.status !== 201) throw new Error(`mfg-golden: customer create failed (${c.status}): ${JSON.stringify(c.body)}`);
    customerId = c.body.id;
  });

  test.afterAll(async () => {
    for (const id of created.paymentIds) await api(token, 'delete', `payments/${id}`).catch(() => {});
    for (const id of created.invoiceIds) {
      await api(token, 'post', `invoices/${id}/void`).catch(() => {});
      await api(token, 'delete', `invoices/${id}`).catch(() => {});
    }
    if (soId) await api(token, 'post', `orders/${soId}/cancel`).catch(() => {});
    if (soId) await api(token, 'delete', `orders/${soId}`).catch(() => {});
    if (customerId) await api(token, 'delete', `customers/${customerId}`).catch(() => {});
  });

  test('1. confirm an order → jobs auto-created; SO Confirmed', async () => {
    const so = await api(token, 'post', 'orders', {
      customerId, taxRate: 0,
      lines: [{ description: 'MFG-GOLDEN widget — safe to delete', quantity: QTY, unitPrice: PRICE }],
    });
    expect(so.status, `create SO: ${JSON.stringify(so.body)}`).toBe(201);
    soId = so.body.id;

    const confirm = await api(token, 'post', `orders/${soId}/confirm`);
    expect(confirm.status, `confirm: ${JSON.stringify(confirm.body)}`).toBeLessThan(300);
    expect(await soStatus(token, soId)).toBe('Confirmed');

    // The confirm event auto-creates a production job per line.
    const jobs = (await api(token, 'get', `jobs?customerId=${customerId}&pageSize=100`)).body;
    const rows = (Array.isArray(jobs) ? jobs : (jobs?.data ?? jobs?.items ?? [])) as Array<{ id: number }>;
    jobIds = rows.map(j => j.id);
    expect(jobIds.length, 'a job was auto-created for the confirmed order').toBeGreaterThan(0);
  });

  test('2. resolve the Production track stages', async () => {
    const tracks = (await api(token, 'get', 'track-types')).body as Array<{ name: string; isDefault: boolean; stages: Array<{ id: number; name: string }> }>;
    const prod = tracks.find(t => t.stages?.some(s => s.name === 'In Production'))
      ?? tracks.find(t => t.isDefault);
    expect(prod, 'a Production track with an "In Production" stage must exist').toBeTruthy();
    const inProd = prod!.stages.find(s => s.name === 'In Production');
    const shipped = prod!.stages.find(s => s.name === 'Shipped' || /ship/i.test(s.name));
    expect(inProd, '"In Production" stage').toBeTruthy();
    expect(shipped, 'a ship/complete stage').toBeTruthy();
    inProductionStageId = inProd!.id;
    shippedStageId = shipped!.id;
  });

  test('3. jobs enter production → SO InProduction', async () => {
    for (const jobId of jobIds) {
      const move = await api(token, 'patch', `jobs/${jobId}/stage`, { jobId, stageId: inProductionStageId });
      expect(move.status, `move job ${jobId} → In Production: ${JSON.stringify(move.body)}`).toBeLessThan(300);
    }
    expect(await soStatus(token, soId), 'production kickoff advances the SO').toBe('InProduction');
  });

  test('4. jobs reach a ship/complete stage → SO STILL InProduction (not Shipped)', async () => {
    for (const jobId of jobIds) {
      const move = await api(token, 'patch', `jobs/${jobId}/stage`, { jobId, stageId: shippedStageId });
      expect(move.status, `move job ${jobId} → Shipped stage: ${JSON.stringify(move.body)}`).toBeLessThan(300);
    }
    // The decoupling: a job on the kanban "Shipped" column must NOT mark the order shipped —
    // only a real shipment does. The SO holds at InProduction until one is created.
    expect(await soStatus(token, soId), 'job kanban must not own fulfillment status').toBe('InProduction');
  });

  test('5. one-click create-shipment from the order → SO Shipped', async () => {
    const ship = await api(token, 'post', `orders/${soId}/create-shipment`);
    expect(ship.status, `create-shipment-from-order: ${JSON.stringify(ship.body)}`).toBe(200);
    if (ship.body?.id) created.shipmentIds.push(ship.body.id);

    expect(await soStatus(token, soId), 'a real shipment is the source of truth for Shipped').toBe('Shipped');
    const so = (await api(token, 'get', `orders/${soId}`)).body;
    expect(Number(so.lines[0].remainingQuantity), 'fully shipped').toBe(0);
  });

  test('6. invoice the shipment → Sent', async () => {
    const inv = await api(token, 'post', 'invoices', {
      customerId, salesOrderId: soId, shipmentId: created.shipmentIds[0] ?? null,
      invoiceDate: isoNow(), dueDate: isoPlusDays(30), taxRate: 0, notes: 'MFG-GOLDEN',
      lines: [{ partId: null, description: 'MFG-GOLDEN widget', quantity: QTY, unitPrice: PRICE }],
    });
    expect(inv.status, `invoice: ${JSON.stringify(inv.body)}`).toBe(201);
    created.invoiceIds.push(inv.body.id);
    expect(Number(inv.body.total)).toBe(SO_TOTAL);

    const send = await api(token, 'post', `invoices/${inv.body.id}/send`);
    expect(send.status, `send invoice: ${JSON.stringify(send.body)}`).toBeLessThan(300);
  });

  test('7. pay the invoice → SO Completed', async () => {
    const invId = created.invoiceIds[0];
    const inv = (await api(token, 'get', `invoices/${invId}`)).body;
    const pay = await api(token, 'post', 'payments', {
      customerId, method: 'Check', amount: Number(inv.total), paymentDate: isoNow(),
      referenceNumber: `MFG-${invId}`, applications: [{ invoiceId: invId, amount: Number(inv.total) }],
    });
    expect(pay.status, `payment: ${JSON.stringify(pay.body)}`).toBe(201);
    if (pay.body?.id) created.paymentIds.push(pay.body.id);

    const after = (await api(token, 'get', `invoices/${invId}`)).body;
    expect(Number(after.balanceDue)).toBe(0);
    // Terminal: fully produced → shipped → invoiced → paid.
    expect(await soStatus(token, soId), 'order-to-cash completes through production').toBe('Completed');
  });
});
