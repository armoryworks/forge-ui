import { Injectable } from '@angular/core';

import { CustomerLifecycle } from '../models/customer-lifecycle.type';
import { CustomerSummary } from '../models/customer-summary.model';

/**
 * Pillar 5 — Identifier for a single tab on the Customer detail page.
 *
 * Order in the resolver's output: Identity is always first; Activity is
 * always last. The middle tabs depend on the customer's lifecycle bucket
 * (`CustomerLifecycle`).
 *
 * Spec source of truth: `docs/entity-detail-pattern.md` § 6.
 */
export type CustomerDetailTabId =
  | 'overview'
  | 'contacts'
  | 'addresses'
  | 'estimates'
  | 'quotes'
  | 'orders'
  | 'jobs'
  | 'invoices'
  | 'interactions'
  | 'pricing'
  | 'activity';

/** A single tab descriptor returned by the resolver. */
export interface TabLayoutEntry {
  /** Stable id used for keying templates and the `?tab=` query param. */
  id: CustomerDetailTabId;
  /** ngx-translate key for the tab label. */
  labelKey: string;
  /** Material Icons Outlined glyph name. */
  iconName: string;
}

// ── Tab descriptors ─────────────────────────────────────────────────────────

const OVERVIEW: TabLayoutEntry = { id: 'overview', labelKey: 'customers.detail.tabs.overview', iconName: 'badge' };
const CONTACTS: TabLayoutEntry = { id: 'contacts', labelKey: 'customers.detail.tabs.contacts', iconName: 'people' };
const ADDRESSES: TabLayoutEntry = { id: 'addresses', labelKey: 'customers.detail.tabs.addresses', iconName: 'location_on' };
const ESTIMATES: TabLayoutEntry = { id: 'estimates', labelKey: 'customers.detail.tabs.estimates', iconName: 'request_quote' };
const QUOTES: TabLayoutEntry = { id: 'quotes', labelKey: 'customers.detail.tabs.quotes', iconName: 'description' };
const ORDERS: TabLayoutEntry = { id: 'orders', labelKey: 'customers.detail.tabs.orders', iconName: 'shopping_cart' };
const JOBS: TabLayoutEntry = { id: 'jobs', labelKey: 'customers.detail.tabs.jobs', iconName: 'engineering' };
const INVOICES: TabLayoutEntry = { id: 'invoices', labelKey: 'customers.detail.tabs.invoices', iconName: 'receipt_long' };
const INTERACTIONS: TabLayoutEntry = { id: 'interactions', labelKey: 'customers.detail.tabs.interactions', iconName: 'forum' };
const PRICING: TabLayoutEntry = { id: 'pricing', labelKey: 'customers.detail.tabs.pricing', iconName: 'sell' };
const ACTIVITY: TabLayoutEntry = { id: 'activity', labelKey: 'customers.detail.tabs.activity', iconName: 'timeline' };

/**
 * Pillar 5 — Pure-function resolver that maps the Customer's lifecycle bucket
 * (derived from `IsActive` + open-document counts) to an ordered tab layout.
 *
 * Returns the permissive `Active` layout for any unknown / future lifecycle
 * value. Identity (overview) is always first; Activity always last.
 *
 * Spec source of truth: `docs/entity-detail-pattern.md` § 6.
 */
@Injectable({ providedIn: 'root' })
export class CustomerDetailLayoutResolverService {
  resolve(lifecycle: CustomerLifecycle): TabLayoutEntry[] {
    const middle = this.middleTabs(lifecycle);
    return [OVERVIEW, ...middle, ACTIVITY];
  }

  private middleTabs(lifecycle: CustomerLifecycle): TabLayoutEntry[] {
    if (lifecycle === 'Prospect') {
      // No active business yet — surface intake + sales-pipeline tabs only.
      // Pricing is omitted: prospects rarely have negotiated price lists.
      return [CONTACTS, ADDRESSES, ESTIMATES, QUOTES, INTERACTIONS];
    }
    if (lifecycle === 'Archived') {
      // Read-only history posture. Keep Invoices for unpaid balances.
      return [CONTACTS, ADDRESSES, INVOICES, INTERACTIONS];
    }
    // Active (default permissive layout). Pricing surfaces here so Office
    // Managers can adjust customer-specific price lists in-context.
    return [CONTACTS, ADDRESSES, ESTIMATES, QUOTES, ORDERS, JOBS, INVOICES, PRICING, INTERACTIONS];
  }

  /**
   * Pure helper that derives the lifecycle bucket from a customer summary.
   * Lives on the resolver service so callers don't have to import it from
   * a separate util.
   */
  deriveLifecycle(summary: Pick<CustomerSummary,
    'isActive' | 'estimateCount' | 'quoteCount' | 'orderCount' | 'activeJobCount' | 'openInvoiceCount'
  >): CustomerLifecycle {
    if (!summary.isActive) return 'Archived';
    const openDocs = summary.estimateCount + summary.quoteCount + summary.orderCount
      + summary.activeJobCount + summary.openInvoiceCount;
    return openDocs > 0 ? 'Active' : 'Prospect';
  }
}
