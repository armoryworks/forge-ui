import { describe, it, expect } from 'vitest';

import { DemoDataStore } from '../services/demo-data-store.service';
import { synthesizeAggregate } from './demo-aggregate-synth';

function storeWith(rows: Record<string, Record<string, unknown>[]>): DemoDataStore {
  return { load: async (entity: string) => rows[entity] ?? [] } as unknown as DemoDataStore;
}

describe('synthesizeAggregate /inventory/low-stock', () => {
  it('alerts on the min threshold or the reorder point, like the API', async () => {
    const store = storeWith({
      part: [
        { id: 1, partNumber: 'MIN-ONLY', minStockThreshold: 10, reorderPoint: null },
        { id: 2, partNumber: 'ROP-ONLY', minStockThreshold: null, reorderPoint: 5 },
        { id: 3, partNumber: 'HEALTHY', minStockThreshold: 2, reorderPoint: 3 },
        { id: 4, partNumber: 'NO-LEVELS', minStockThreshold: null, reorderPoint: null },
      ],
      'bin-content': [
        { entityType: 'part', entityId: 1, quantity: 4 },
        { entityType: 'part', entityId: 2, quantity: 5 },
        { entityType: 'part', entityId: 3, quantity: 9 },
        { entityType: 'part', entityId: 4, quantity: 0 },
      ],
    });

    const alerts = await synthesizeAggregate(store, 'GET', 'inventory/low-stock') as
      { partNumber: string; minStockThreshold: number | null; reorderPoint: number | null }[];

    expect(alerts.map(a => a.partNumber)).toEqual(['MIN-ONLY', 'ROP-ONLY']);
    expect(alerts[1].minStockThreshold).toBeNull();
    expect(alerts[1].reorderPoint).toBe(5);
  });
});
