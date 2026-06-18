/**
 * Carrier scan-to-ship gate — asserted e2e (carrier epic, slice 1).
 *
 * A shipment assigned to a set-up carrier that requires it can only be marked
 * Shipped after the worker scans the shipment's Forge label QR — the
 * coverage-bound ScanCode the API issues at shipment creation. This proves:
 *
 *   - a custom "shadow shipper" can be created (POST /carriers)
 *   - a scan-required carrier (seeded UPS): ship blocked with no scan (409),
 *     blocked with a wrong scan (409), allowed with the correct ScanCode (Shipped)
 *   - an opt-out carrier (seeded Will Call, requiresScanToShip=false) ships with
 *     no scan — the gate only applies where the carrier asks for it
 *
 * API-only (no browser). Self-sufficient: creates its own customer + orders so it
 * runs on a minimal seed. PRECONDITION: seeded stack (admin@forge.local), carriers
 * seeded by essential seed (UPS + Will Call always present).
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';
import { getAuthToken, SEED_PASSWORD } from '../helpers/auth.helper';

const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';
const ADMIN_EMAIL = 'admin@forge.local';

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
  // O2C response bodies are dynamically shaped; `any` keeps the asserted probe readable.
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

test.describe.serial('Carrier scan-to-ship gate', () => {
  let token: string;
  let customerId: number;
  let upsCarrierId: number;
  let willCallCarrierId: number;
  const createdSoIds: number[] = [];

  // Create + confirm an SO with one line; returns the SO id + first line id.
  async function confirmedSO(qty: number, price: number): Promise<{ soId: number; lineId: number }> {
    const so = await api(token, 'post', 'orders', {
      customerId, taxRate: 0,
      lines: [{ description: 'SCAN-PROBE item — safe to delete', quantity: qty, unitPrice: price }],
    });
    expect(so.status, `create SO: ${JSON.stringify(so.body)}`).toBe(201);
    const soId = so.body.id;
    createdSoIds.push(soId);
    const detail = (await api(token, 'get', `orders/${soId}`)).body;
    const lineId = detail.lines[0].id;
    const confirm = await api(token, 'post', `orders/${soId}/confirm`);
    expect(confirm.status, 'confirm SO').toBeLessThan(300);
    return { soId, lineId };
  }

  test.beforeAll(async () => {
    token = await getAuthToken(ADMIN_EMAIL, SEED_PASSWORD);

    const carriers = (await api(token, 'get', 'carriers')).body as Array<{ id: number; code: string; requiresScanToShip: boolean }>;
    const ups = carriers.find(c => c.code === 'UPS');
    const willCall = carriers.find(c => c.code === 'WILLCALL');
    expect(ups, 'UPS carrier must be seeded').toBeTruthy();
    expect(ups!.requiresScanToShip, 'UPS requires a scan').toBe(true);
    expect(willCall, 'Will Call carrier must be seeded').toBeTruthy();
    expect(willCall!.requiresScanToShip, 'Will Call opts out of the scan').toBe(false);
    upsCarrierId = ups!.id;
    willCallCarrierId = willCall!.id;

    const c = await api(token, 'post', 'customers', { name: `SCAN-PROBE Co ${new Date().toISOString()}` });
    expect(c.status, `customer: ${JSON.stringify(c.body)}`).toBe(201);
    customerId = c.body.id;
  });

  test.afterAll(async () => {
    for (const id of createdSoIds) {
      await api(token, 'post', `orders/${id}/cancel`).catch(() => {});
      await api(token, 'delete', `orders/${id}`).catch(() => {});
    }
    if (customerId) await api(token, 'delete', `customers/${customerId}`).catch(() => {});
  });

  test('1. a custom "shadow shipper" can be created', async () => {
    // Unique code per run so the probe is re-runnable (codes are unique).
    const code = `PROBE${Date.now()}`;
    const { status, body } = await api(token, 'post', 'carriers', {
      name: 'Probe House Courier', code, integrationKind: 'Manual', requiresScanToShip: true,
    });
    expect(status, `create carrier: ${JSON.stringify(body)}`).toBe(201);
    expect(String(body.integrationKind)).toBe('Manual');
    expect(body.requiresScanToShip).toBe(true);
  });

  test('2. scan-required carrier: ship gated on the label scan', async () => {
    const { soId, lineId } = await confirmedSO(5, 100);
    const ship = await api(token, 'post', 'shipments', {
      salesOrderId: soId, carrierId: upsCarrierId,
      lines: [{ salesOrderLineId: lineId, quantity: 5 }],
    });
    expect(ship.status, `create shipment: ${JSON.stringify(ship.body)}`).toBe(201);
    const shipmentId = ship.body.id;

    // The API issues a coverage-bound ScanCode at creation — the value the master QR encodes.
    const detail = (await api(token, 'get', `shipments/${shipmentId}`)).body;
    const scanCode: string = detail.scanCode;
    expect(scanCode, 'shipment must carry a scan code').toBeTruthy();
    expect(scanCode.startsWith('v1.'), 'scan code is the versioned, coverage-bound token').toBe(true);

    // No scan → blocked.
    const noScan = await api(token, 'post', `shipments/${shipmentId}/ship`);
    expect(noScan.status, 'ship with no scan must be blocked').toBe(409);

    // Wrong scan → blocked.
    const wrong = await api(token, 'post', `shipments/${shipmentId}/ship`, { scanCode: 'v1.WRONG.zzzzzzzzzzzz' });
    expect(wrong.status, 'ship with a mismatched scan must be blocked').toBe(409);

    // Still not shipped.
    expect(String((await api(token, 'get', `shipments/${shipmentId}`)).body.status)).not.toBe('Shipped');

    // Correct scan → ships.
    const ok = await api(token, 'post', `shipments/${shipmentId}/ship`, { scanCode });
    expect(ok.status, `ship with the correct scan: ${JSON.stringify(ok.body)}`).toBeLessThan(300);
    expect(String((await api(token, 'get', `shipments/${shipmentId}`)).body.status)).toBe('Shipped');
  });

  test('3. opt-out carrier (Will Call) ships without a scan', async () => {
    const { soId, lineId } = await confirmedSO(3, 50);
    const ship = await api(token, 'post', 'shipments', {
      salesOrderId: soId, carrierId: willCallCarrierId,
      lines: [{ salesOrderLineId: lineId, quantity: 3 }],
    });
    expect(ship.status, `create shipment: ${JSON.stringify(ship.body)}`).toBe(201);
    const shipmentId = ship.body.id;

    const ok = await api(token, 'post', `shipments/${shipmentId}/ship`);
    expect(ok.status, 'a carrier that opts out of the scan ships freely').toBeLessThan(300);
    expect(String((await api(token, 'get', `shipments/${shipmentId}`)).body.status)).toBe('Shipped');
  });
});
