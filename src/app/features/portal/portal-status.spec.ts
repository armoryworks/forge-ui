import { describe, expect, it } from 'vitest';

import { portalQuoteTypeLabelKey, portalStatusChip, portalStatusLabelKey } from './portal-status';

describe('portal status labels', () => {
  it('labels every server status through the shared status keys', () => {
    expect(portalStatusLabelKey('order', 'InProduction')).toBe('salesOrders.statusInProduction');
    expect(portalStatusLabelKey('quote', 'ConvertedToOrder')).toBe('quotes.statusConvertedToOrder');
    expect(portalStatusLabelKey('invoice', 'Voided')).toBe('invoices.statusVoided');
    expect(portalStatusLabelKey('shipment', 'InTransit')).toBe('shipments.statusInTransit');
    expect(portalQuoteTypeLabelKey('Estimate')).toBe('portal.quotes.typeEstimate');
  });

  it('colours the real enum values, not stale ones', () => {
    expect(portalStatusChip('invoice', 'Voided')).toBe('chip chip--muted');
    expect(portalStatusChip('shipment', 'Cancelled')).toBe('chip chip--muted');
    expect(portalStatusChip('shipment', 'Packed')).toBe('chip chip--muted');
    expect(portalStatusChip('order', 'Cancelled')).toBe('chip chip--muted');
    expect(portalStatusChip('quote', 'Expired')).toBe('chip chip--muted');
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(portalStatusLabelKey('order', 'Mystery')).toBe('Mystery');
    expect(portalStatusChip('order', 'Mystery')).toBe('chip');
  });
});
