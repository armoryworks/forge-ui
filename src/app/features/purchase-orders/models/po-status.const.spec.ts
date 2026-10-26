import { describe, it, expect } from 'vitest';

import { PO_STATUSES, PO_STATUS_CHIP_CLASSES, PO_STATUS_LABEL_KEYS } from './po-status.const';

describe('PO status presentation maps', () => {
  it('give every server status a chip class and a label key', () => {
    for (const status of PO_STATUSES) {
      expect(PO_STATUS_CHIP_CLASSES[status]).toMatch(/^chip--/);
      expect(PO_STATUS_LABEL_KEYS[status]).toBeTruthy();
    }
  });

  it('list a PO waiting for approval between Draft and Submitted', () => {
    expect(PO_STATUSES.slice(0, 3)).toEqual(['Draft', 'PendingApproval', 'Submitted']);
    expect(PO_STATUS_LABEL_KEYS['PendingApproval']).toBe('purchaseOrders.statusPendingApproval');
  });
});
