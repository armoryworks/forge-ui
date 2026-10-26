import { describe, expect, it } from 'vitest';

import { OpeningOpenItem } from '../models/opening-open-item.model';
import { OPENING_OFFSET_KEY, openingOpenItemsLines, tieOutDifference } from './opening-open-items-lines';

const item = (partyType: 'Customer' | 'Vendor', amount: number, documentNumber: string | null = null): OpeningOpenItem => ({
  partyType, partyId: null, partyRef: 'X', documentNumber, documentDate: null, dueDate: null, amount, description: null,
});

describe('openingOpenItemsLines', () => {
  it('debits AR and credits AP per party, offsetting the net to Opening Balance Equity', () => {
    const lines = openingOpenItemsLines([item('Customer', 1200, 'INV-1'), item('Customer', 300), item('Vendor', 450)], [7, 7, 9]);

    expect(lines.map((l) => [l.accountDeterminationKey, l.debit, l.credit, l.partyId])).toEqual([
      ['AR_CONTROL', 1200, 0, 7],
      ['AR_CONTROL', 300, 0, 7],
      ['AP_CONTROL', 0, 450, 9],
      [OPENING_OFFSET_KEY, 0, 1050, null],
    ]);
    expect(lines[0].documentNumber).toBe('INV-1');
    expect(lines.reduce((s, l) => s + l.debit, 0)).toBe(lines.reduce((s, l) => s + l.credit, 0));
  });

  it('debits the offset when payables exceed receivables and adds none when they net to zero', () => {
    expect(openingOpenItemsLines([item('Customer', 100), item('Vendor', 250)], [1, 2]).at(-1))
      .toMatchObject({ accountDeterminationKey: OPENING_OFFSET_KEY, debit: 150, credit: 0 });
    expect(openingOpenItemsLines([item('Customer', 100), item('Vendor', 100)], [1, 2])).toHaveLength(2);
  });
});

describe('tieOutDifference', () => {
  it('is the party total less the control, to the cent, and null until the control is entered', () => {
    expect(tieOutDifference(1500, 1500)).toBe(0);
    expect(tieOutDifference(1500.1, 1500)).toBe(0.1);
    expect(tieOutDifference(1400, 1500)).toBe(-100);
    expect(tieOutDifference(1500, null)).toBeNull();
  });
});
