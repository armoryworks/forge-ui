import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Routing flowchart editor, stub-driven: seeds an Engineer session and answers every API call locally, so it runs
 * against any served build with no backend. Covers what TestBed can't drive — dragging a step's arrow onto another
 * step, dragging a step into a parallel lane — and the save → reload round trip of the whole graph.
 */
interface Step { operationId: number; stepNumber: number; predecessors: { operationId: number; gate: string }[] }

function operation(id: number, stepNumber: number, title: string, predecessors: { operationId: number; gate: string }[]) {
  return {
    id, partId: 42, stepNumber, title, instructions: null, workCenterId: null, workCenterName: null, estimatedMs: null,
    setupMinutes: 0, runMinutesLot: 0, scrapFactor: 0, runMinutesEach: 0, laborAttendancePercent: 100, cycleCountdown: false,
    isQcCheckpoint: false, qcCriteria: null, referencedOperationId: null, referencedOperationTitle: null, materials: [],
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    isSubcontract: false, subcontractVendorId: null, subcontractVendorName: null, subcontractTurnTimeDays: null,
    predecessors: predecessors.map(p => ({ ...p, stepNumber: p.operationId * 10 })),
  };
}

const TITLES: Record<number, string> = { 1: 'Saw', 2: 'Turn', 3: 'Mill', 4: 'Inspect' };

async function seed(context: BrowserContext): Promise<{ saves: Step[][] }> {
  const saves: Step[][] = [];
  let steps: Step[] = [1, 2, 3, 4].map(id => ({ operationId: id, stepNumber: id * 10, predecessors: [] }));
  let version = 1;
  const graph = () => ({
    version: `v${version}`,
    operations: steps.map(s => operation(s.operationId, s.stepNumber, TITLES[s.operationId], s.predecessors)),
  });

  await context.addInitScript(() => {
    localStorage.setItem('forge-token', 'test-token');
    localStorage.setItem('forge-user', JSON.stringify({ id: 1, email: 'eng@shop.example', firstName: 'Erin', lastName: 'Engineer', roles: ['Engineer'], isActive: true }));
  });
  await context.route('**/hubs/**', route => route.abort());
  await context.route('**/api/v1/**', route => route.fulfill({ json: route.request().method() === 'GET' ? [] : {} }));
  await context.route(/\/api\/v1\/parts\?/, route => route.fulfill({ json: { items: [], page: 1, pageSize: 25, totalCount: 0 } }));
  await context.route('**/api/v1/parts/42', route => route.fulfill({ json: {
    id: 42, partNumber: 'PRT-42', name: 'Bracket', description: null, revision: 'A', status: 'Active',
    procurementSource: 'Make', inventoryClass: 'Component', bomLines: [], usedIn: [], operations: graph().operations, stepGating: null,
  } }));
  await context.route('**/api/v1/parts/42/operations', route => route.fulfill({ json: graph().operations }));
  await context.route('**/api/v1/parts/42/routing/graph', route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { version: string; steps: Step[] };
      saves.push(body.steps);
      steps = body.steps;
      version++;
    }
    return route.fulfill({ json: graph() });
  });
  return { saves };
}

async function openFlow(page: Page): Promise<void> {
  await page.goto('/parts?detail=part:42&tab=routing');
  await page.getByTestId('routing-view-flow').click();
  await expect(page.getByTestId('routing-graph-node-40')).toBeVisible();
}

async function dragBetween(page: Page, fromTestId: string, toTestId: string): Promise<void> {
  const from = (await page.getByTestId(fromTestId).boundingBox())!;
  const to = (await page.getByTestId(toTestId).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('dragging a step into a lane and an arrow onto a later step saves the graph and reloads it the same', async ({ context, page }) => {
  const { saves } = await seed(context);
  await openFlow(page);

  await dragBetween(page, 'routing-graph-node-30', 'routing-graph-node-20');
  await expect(page.getByTestId('routing-graph-edge-10-30')).toHaveCount(1);
  await expect(page.getByTestId('routing-graph-edge-20-40')).toHaveCount(1);
  await dragBetween(page, 'routing-graph-handle-10', 'routing-graph-node-40');
  await expect(page.getByTestId('routing-graph-edge-10-40')).toHaveCount(1);
  await expect(page.getByTestId('routing-graph-dirty')).toBeVisible();
  await page.getByTestId('routing-graph-save').click();

  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toEqual([
    { operationId: 1, stepNumber: 10, predecessors: [] },
    { operationId: 2, stepNumber: 20, predecessors: [] },
    { operationId: 3, stepNumber: 30, predecessors: [{ operationId: 1, gate: 'Quantity' }] },
    { operationId: 4, stepNumber: 40, predecessors: [
      { operationId: 3, gate: 'Quantity' }, { operationId: 2, gate: 'Quantity' }, { operationId: 1, gate: 'Quantity' },
    ] },
  ]);
  await expect(page.getByTestId('routing-graph-dirty')).toHaveCount(0);

  await page.reload();
  await page.getByTestId('routing-view-flow').click();
  await expect(page.getByTestId('routing-graph-edge-10-30')).toHaveCount(1);
  await expect(page.getByTestId('routing-graph-edge-20-40')).toHaveCount(1);
  await expect(page.getByTestId('routing-graph-edge-30-40')).toHaveCount(1);
  await expect(page.getByTestId('routing-graph-edge-10-40')).toHaveCount(1);
  await expect(page.getByTestId('routing-graph-edge-20-30')).toHaveCount(0);
  expect(await page.evaluate(() => /routingGraph\./.test(document.body.innerText))).toBe(false);
});

test('a reorder that breaks a link blocks the save until the link is removed', async ({ context, page }) => {
  const { saves } = await seed(context);
  await openFlow(page);

  await page.getByTestId('routing-graph-node-10').click();
  await page.getByTestId('routing-graph-connect-from').click();
  await page.getByTestId('routing-graph-node-40').press('Enter');
  await page.getByTestId('routing-graph-order-up-4').click();
  await page.getByTestId('routing-graph-order-up-4').click();

  await expect(page.getByTestId('routing-graph-conflicts')).toBeVisible();
  await expect(page.getByTestId('routing-graph-save')).toBeDisabled();
  await page.getByTestId('routing-graph-conflicts-remove-all').click();
  await expect(page.getByTestId('routing-graph-save')).toBeEnabled();
  await page.getByTestId('routing-graph-save').click();
  await expect.poll(() => saves.length).toBe(1);
});
