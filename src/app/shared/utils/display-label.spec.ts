import { camelKey, humanizeIdentifier, identifierWords, snakeKey } from './display-label';

describe('display-label', () => {
  it('splits PascalCase, acronym runs, digits and separators into words', () => {
    expect(identifierWords('CustomerPO')).toEqual(['Customer', 'PO']);
    expect(identifierWords('QCInspection')).toEqual(['QC', 'Inspection']);
    expect(identifierWords('Net30')).toEqual(['Net', '30']);
    expect(identifierWords('due_on-receipt')).toEqual(['due', 'on', 'receipt']);
  });

  it('humanizes enum values into sentence case', () => {
    expect(humanizeIdentifier('InProgress')).toBe('In progress');
    expect(humanizeIdentifier('PartiallyReceived')).toBe('Partially received');
    expect(humanizeIdentifier('OUT_OF_SPEC')).toBe('Out of spec');
    expect(humanizeIdentifier('Net30')).toBe('Net 30');
  });

  it('keeps known acronyms upper case, the same as the activity log wording', () => {
    expect(humanizeIdentifier('QcInspection')).toBe('QC inspection');
    expect(humanizeIdentifier('PurchaseOrderRfq')).toBe('Purchase order RFQ');
    expect(humanizeIdentifier('StockUom')).toBe('Stock UoM');
    expect(humanizeIdentifier('PM')).toBe('PM');
  });

  it('returns an empty string for missing values', () => {
    expect(humanizeIdentifier(null)).toBe('');
    expect(humanizeIdentifier(undefined)).toBe('');
    expect(humanizeIdentifier('')).toBe('');
  });

  it('builds camelCase i18n keys and snake_case override keys', () => {
    expect(camelKey('InProgress')).toBe('inProgress');
    expect(camelKey('OnHold')).toBe('onHold');
    expect(camelKey('Net30')).toBe('net30');
    expect(snakeKey('InProduction')).toBe('in_production');
  });
});
