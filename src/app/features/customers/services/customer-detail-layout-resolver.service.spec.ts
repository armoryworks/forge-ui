import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { CustomerDetailLayoutResolverService } from './customer-detail-layout-resolver.service';
import { CustomerSummary } from '../models/customer-summary.model';

function makeSummary(overrides: Partial<CustomerSummary> = {}): CustomerSummary {
  return {
    id: 1,
    name: 'Acme Co',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    estimateCount: 0,
    quoteCount: 0,
    orderCount: 0,
    activeJobCount: 0,
    openInvoiceCount: 0,
    openInvoiceTotal: 0,
    ytdRevenue: 0,
    ...overrides,
  };
}

describe('CustomerDetailLayoutResolverService', () => {
  let service: CustomerDetailLayoutResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CustomerDetailLayoutResolverService);
  });

  it('Active → overview, contacts, addresses, estimates, quotes, orders, jobs, invoices, pricing, interactions, documents, activity', () => {
    const ids = service.resolve('Active').map(t => t.id);
    expect(ids).toEqual([
      'overview', 'contacts', 'addresses', 'estimates', 'quotes',
      'orders', 'jobs', 'invoices', 'pricing', 'interactions', 'documents', 'activity',
    ]);
  });

  it('Prospect → overview, contacts, addresses, estimates, quotes, interactions, documents, activity (no orders/jobs/invoices)', () => {
    const ids = service.resolve('Prospect').map(t => t.id);
    expect(ids).toEqual([
      'overview', 'contacts', 'addresses', 'estimates', 'quotes', 'interactions', 'documents', 'activity',
    ]);
    expect(ids).not.toContain('orders');
    expect(ids).not.toContain('jobs');
  });

  it('Archived → overview, contacts, addresses, invoices, interactions, documents, activity (read-only history posture)', () => {
    const ids = service.resolve('Archived').map(t => t.id);
    expect(ids).toEqual([
      'overview', 'contacts', 'addresses', 'invoices', 'interactions', 'documents', 'activity',
    ]);
    expect(ids).not.toContain('estimates');
    expect(ids).not.toContain('quotes');
    expect(ids).not.toContain('orders');
    expect(ids).not.toContain('jobs');
  });

  it('Documents is present in every lifecycle (attachments precede and outlive active business)', () => {
    for (const lc of ['Active', 'Prospect', 'Archived'] as const) {
      expect(service.resolve(lc).map(t => t.id), `documents tab for ${lc}`).toContain('documents');
    }
  });

  it('Identity (overview) always first; Activity always last across every lifecycle', () => {
    const lifecycles = ['Active', 'Prospect', 'Archived'] as const;
    for (const lc of lifecycles) {
      const layout = service.resolve(lc);
      expect(layout.length, `layout for ${lc} non-empty`).toBeGreaterThanOrEqual(2);
      expect(layout[0].id, `first tab for ${lc}`).toBe('overview');
      expect(layout[layout.length - 1].id, `last tab for ${lc}`).toBe('activity');
    }
  });

  it('unknown lifecycle defaults to the permissive Active layout', () => {
    // Cast so the spec exercises the default branch even though TS forbids it
    // at the type level — production code has the discriminator narrowed.
    const ids = service.resolve('Unknown' as never).map(t => t.id);
    expect(ids).toEqual([
      'overview', 'contacts', 'addresses', 'estimates', 'quotes',
      'orders', 'jobs', 'invoices', 'pricing', 'interactions', 'documents', 'activity',
    ]);
  });

  it('every tab descriptor carries id + labelKey + iconName', () => {
    const layout = service.resolve('Active');
    for (const tab of layout) {
      expect(tab.id).toBeTruthy();
      expect(tab.labelKey).toMatch(/^customers\.detail\.tabs\./);
      expect(tab.iconName).toBeTruthy();
    }
  });

  describe('deriveLifecycle', () => {
    it('derives Archived when isActive is false', () => {
      expect(service.deriveLifecycle(makeSummary({ isActive: false, orderCount: 5 }))).toBe('Archived');
    });

    it('derives Prospect when isActive is true but no open documents', () => {
      expect(service.deriveLifecycle(makeSummary({ isActive: true }))).toBe('Prospect');
    });

    it('derives Active when isActive is true with at least one open document', () => {
      expect(service.deriveLifecycle(makeSummary({ isActive: true, estimateCount: 1 }))).toBe('Active');
      expect(service.deriveLifecycle(makeSummary({ isActive: true, orderCount: 1 }))).toBe('Active');
      expect(service.deriveLifecycle(makeSummary({ isActive: true, openInvoiceCount: 1 }))).toBe('Active');
    });
  });
});
