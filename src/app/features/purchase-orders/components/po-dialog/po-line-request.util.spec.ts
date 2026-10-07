import { describe, it, expect } from 'vitest';

import { toCreateLineRequest, toTierVarianceLines } from './po-line-request.util';
import { PoLineEntry } from '../../models/po-line-entry.model';

const partLine = (overrides: Partial<PoLineEntry> = {}): PoLineEntry => ({
  partId: 8,
  partNumber: 'P-008',
  description: 'Bracket',
  orderedQuantity: 10,
  unitPrice: 4.5,
  purchaseUnitId: 3,
  purchaseUnitLabel: 'Box of 10',
  ...overrides,
});

const serviceLine = (overrides: Partial<PoLineEntry> = {}): PoLineEntry => ({
  partId: null,
  partNumber: null,
  description: 'Heat treat per AMS 2759',
  orderedQuantity: 1,
  unitPrice: 250,
  purchaseUnitId: null,
  purchaseUnitLabel: null,
  notes: 'Certs required',
  ...overrides,
});

describe('toCreateLineRequest', () => {
  it('sends a service line with no part, its description and its note', () => {
    expect(toCreateLineRequest(serviceLine())).toEqual({
      partId: null,
      description: 'Heat treat per AMS 2759',
      quantity: 1,
      unitPrice: 250,
      notes: 'Certs required',
      purchaseUnitId: null,
      manualOverrideReason: undefined,
    });
  });

  it('leaves the description to the server for a part line', () => {
    const request = toCreateLineRequest(partLine({ notes: 'Deburr', overrideReason: 'Negotiated' }));
    expect(request.partId).toBe(8);
    expect(request.description).toBeUndefined();
    expect(request.purchaseUnitId).toBe(3);
    expect(request.notes).toBe('Deburr');
    expect(request.manualOverrideReason).toBe('Negotiated');
  });

  it('drops a blank note', () => {
    expect(toCreateLineRequest(partLine({ notes: '   ' })).notes).toBeUndefined();
  });
});

describe('toTierVarianceLines', () => {
  it('checks only lines that have a part', () => {
    expect(toTierVarianceLines([serviceLine(), partLine()])).toEqual([
      { partId: 8, quantity: 10, unitPrice: 4.5, purchaseUnitId: 3 },
    ]);
  });

  it('returns nothing for a PO of service lines only', () => {
    expect(toTierVarianceLines([serviceLine()])).toEqual([]);
  });
});
