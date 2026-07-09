/**
 * Phase 4 Phase-D (layer-3) — URL-pattern → capability-code registry.
 *
 * Mirrors the controller-level `[RequiresCapability("CAP-...")]` attributes
 * on the .NET API. Used by `capabilityGateInterceptor` to short-circuit
 * outbound HTTP requests for endpoints whose capability is disabled — so
 * the request never leaves the browser. This is the layer-3 complement to
 * the layer-2 work in `httpErrorInterceptor` (which catches the 403 if it
 * does come back from the server).
 *
 * The registry is order-sensitive: the first matching prefix wins. More
 * specific paths (e.g. `inventory/abc`, `inventory/transfers`) MUST appear
 * before their parent prefix (`inventory`).
 *
 * Each entry's `prefix` is the path SUFFIX after `/api/v1/`. Matching is
 * done against the request URL's `/api/v1/<rest>` segment regardless of
 * whether the URL is absolute (`https://host/api/v1/foo`) or relative
 * (`/api/v1/foo`).
 *
 * To add a new gated endpoint:
 *  1. Confirm the controller has `[RequiresCapability("CAP-...")]` on the
 *     class or action.
 *  2. Add an entry below with the path prefix (no leading slash, no `/api/v1`).
 *  3. Place specific routes above their parent prefix.
 *
 * Bootstrap-exempt endpoints (descriptor read, admin capability mutations)
 * MUST NOT appear here — the interceptor leaves any non-matching URL alone.
 */
export interface CapabilityEndpointEntry {
  /** Path prefix after `/api/v1/`. Match is performed in declaration order. */
  readonly prefix: string;
  /** Capability code (e.g. `CAP-EXT-AI-ASSISTANT`) gating this endpoint. */
  readonly capability: string;
}

/**
 * Order-sensitive list. Specific paths first (e.g. `inventory/abc` before
 * `inventory`). All controller-level `[RequiresCapability]` attributes are
 * mirrored here. Method-level overrides on the server side are intentionally
 * not mirrored — the interceptor only short-circuits on the controller-level
 * (most common) gate. Endpoints with method-level overrides still go through
 * (the server's middleware will 403 them and the layer-2 interceptor will
 * convert that into a `CapabilityDisabledError`).
 */
export const CAPABILITY_ENDPOINT_REGISTRY: readonly CapabilityEndpointEntry[] = [
  // ── Specific sub-paths first (must precede their parent prefix) ──
  { prefix: 'admin/bi-api-keys', capability: 'CAP-IDEN-AUTH-API-KEYS' },
  { prefix: 'admin/currencies', capability: 'CAP-MD-CURRENCIES' },
  { prefix: 'admin/exchange-rates', capability: 'CAP-MD-CURRENCIES' },
  { prefix: 'admin/machine-connections', capability: 'CAP-MFG-MACHINE-CONNECT' },
  { prefix: 'admin/plants', capability: 'CAP-MD-LOCATIONS' },
  { prefix: 'admin/webhooks', capability: 'CAP-CROSS-WEBHOOKS' },
  { prefix: 'documents/controlled', capability: 'CAP-CROSS-DOCS' },
  { prefix: 'inventory/abc', capability: 'CAP-PLAN-ABC' },
  { prefix: 'inventory/transfers', capability: 'CAP-INV-MULTILOC' },
  { prefix: 'reports/copq', capability: 'CAP-RPT-OPERATIONAL' },
  { prefix: 'reports/sankey', capability: 'CAP-RPT-OPERATIONAL' },
  { prefix: 'shop-floor/andon', capability: 'CAP-EXT-ANDON' },
  { prefix: 'shop-floor/machine', capability: 'CAP-MFG-MACHINE-CONNECT' },

  // ── Top-level prefixes ──
  { prefix: 'accounting', capability: 'CAP-ACCT-FULLGL' },
  { prefix: 'ai-assistants', capability: 'CAP-EXT-AI-ASSISTANT' },
  { prefix: 'ai', capability: 'CAP-EXT-AI-ASSISTANT' },
  { prefix: 'announcements', capability: 'CAP-EXT-ANNOUNCEMENTS' },
  { prefix: 'approvals', capability: 'CAP-P2P-APPROVALS' },
  { prefix: 'assets', capability: 'CAP-MD-ASSETS' },
  { prefix: 'auto-po', capability: 'CAP-P2P-AUTOPO' },
  { prefix: 'banking', capability: 'CAP-BANK-NACHA' },
  { prefix: 'bi', capability: 'CAP-CROSS-BI-EXPORT' },
  { prefix: 'chat', capability: 'CAP-EXT-CHAT' },
  { prefix: 'company-locations', capability: 'CAP-MD-LOCATIONS' },
  { prefix: 'compliance-forms', capability: 'CAP-QC-COMPLIANCE-FORMS' },
  { prefix: 'consignment-agreements', capability: 'CAP-MD-CONTRACTS-CONSIGNMENT' },
  { prefix: 'costing', capability: 'CAP-COSTING-TIER2-DEPTRATES' },
  { prefix: 'cpq', capability: 'CAP-O2C-CPQ' },
  { prefix: 'customer-returns', capability: 'CAP-O2C-RMA' },
  { prefix: 'customers', capability: 'CAP-MD-CUSTOMERS' },
  { prefix: 'dashboard', capability: 'CAP-RPT-DASHBOARDS' },
  { prefix: 'downloads', capability: 'CAP-CROSS-DOCS' },
  { prefix: 'edi', capability: 'CAP-CROSS-INTEG-EDI' },
  { prefix: 'employee-profile', capability: 'CAP-MD-EMPLOYEES' },
  { prefix: 'employees', capability: 'CAP-MD-EMPLOYEES' },
  { prefix: 'estimates', capability: 'CAP-O2C-QUOTE' },
  { prefix: 'events', capability: 'CAP-MD-EMPLOYEES' },
  { prefix: 'expenses', capability: 'CAP-ACCT-EXPENSES' },
  { prefix: 'fmeas', capability: 'CAP-QC-FMEA' },
  { prefix: 'identity-documents', capability: 'CAP-QC-COMPLIANCE-FORMS' },
  { prefix: 'inventory', capability: 'CAP-INV-CORE' },
  { prefix: 'invoices', capability: 'CAP-O2C-INVOICE' },
  { prefix: 'jobs', capability: 'CAP-MFG-WO-RELEASE' },
  { prefix: 'kanban-cards', capability: 'CAP-EXT-KANBAN-REPLENISHMENT' },
  { prefix: 'leads', capability: 'CAP-O2C-LEAD' },
  { prefix: 'leave', capability: 'CAP-HR-LEAVE' },
  { prefix: 'lots', capability: 'CAP-INV-LOTS' },
  { prefix: 'mrp', capability: 'CAP-PLAN-MRP' },
  { prefix: 'notifications', capability: 'CAP-CROSS-NOTIFICATIONS' },
  { prefix: 'onboarding', capability: 'CAP-HR-HIRE' },
  { prefix: 'parts', capability: 'CAP-MD-PARTS' },
  // AP split: dedicated codes for vendor bills / payments (PO endpoints
  // themselves keep CAP-P2P-PO).
  { prefix: 'payment-transmissions', capability: 'CAP-P2P-PAY' },
  { prefix: 'payments', capability: 'CAP-O2C-CASH' },
  { prefix: 'payroll', capability: 'CAP-HR-PAYROLL' },
  { prefix: 'pick-waves', capability: 'CAP-O2C-PICKPACK' },
  { prefix: 'planning-cycles', capability: 'CAP-PLAN-MRP' },
  { prefix: 'ppap-submissions', capability: 'CAP-QC-PPAP' },
  { prefix: 'predictions', capability: 'CAP-MAINT-PREDICTIVE' },
  { prefix: 'price-lists', capability: 'CAP-MD-PRICELIST' },
  { prefix: 'pricing', capability: 'CAP-MD-PRICELIST' },
  { prefix: 'projects', capability: 'CAP-EXT-PROJECTS' },
  { prefix: 'purchase-orders', capability: 'CAP-P2P-PO' },
  { prefix: 'purchasing', capability: 'CAP-P2P-RFQ' },
  // The QualityController has both CAP-QC-INSPECTION and CAP-QC-NCR action-
  // level overrides. Default to CAP-QC-INSPECTION (the controller-level gate)
  // — NCR-specific paths still 403-and-fall-through-to-layer-2 if NCR is off
  // but inspection is on, which is the rare edge case.
  { prefix: 'quality', capability: 'CAP-QC-INSPECTION' },
  { prefix: 'receiving-inspection-templates', capability: 'CAP-QC-INSPECTION' },
  { prefix: 'quotes', capability: 'CAP-O2C-QUOTE' },
  { prefix: 'recurring-orders', capability: 'CAP-O2C-RECURRING' },
  { prefix: 'replenishment', capability: 'CAP-PLAN-SAFETYSTOCK' },
  { prefix: 'report-builder', capability: 'CAP-RPT-DASHBOARDS' },
  { prefix: 'reports', capability: 'CAP-RPT-OPERATIONAL' },
  { prefix: 'reviews', capability: 'CAP-HR-REVIEW' },
  { prefix: 'sales-orders', capability: 'CAP-O2C-SO' },
  { prefix: 'sales-tax-rates', capability: 'CAP-MD-TAXCODES' },
  { prefix: 'scanner', capability: 'CAP-MFG-SHOPFLOOR' },
  { prefix: 'scheduling', capability: 'CAP-PLAN-CAPACITY' },
  { prefix: 'serials', capability: 'CAP-INV-SERIALS' },
  { prefix: 'shifts', capability: 'CAP-HR-SHIFTS' },
  { prefix: 'shipments', capability: 'CAP-O2C-SHIP' },
  { prefix: 'spc', capability: 'CAP-QC-SPC' },
  { prefix: 'status-tracking', capability: 'CAP-CROSS-ACTIVITY-LOG' },
  { prefix: 'time-tracking', capability: 'CAP-HR-TIMETRACK' },
  { prefix: 'track-types', capability: 'CAP-EXT-KANBAN' },
  { prefix: 'users', capability: 'CAP-IDEN-USERS' },
  // AP split: dedicated codes for vendor bills / payments (PO endpoints
  // themselves keep CAP-P2P-PO).
  { prefix: 'vendor-bills', capability: 'CAP-P2P-BILL' },
  { prefix: 'vendor-payments', capability: 'CAP-P2P-PAY' },
  { prefix: 'vendors', capability: 'CAP-MD-VENDORS' },
  { prefix: 'work-centers', capability: 'CAP-MD-WORKCENTERS' },
];

/**
 * Resolve the capability that gates a URL, or `null` if the URL is not
 * gated. The URL may be absolute or relative — only the segment after
 * `/api/v1/` is considered.
 *
 * Special-cases:
 *  - `customers/{id}/addresses` — gated under the same `CAP-MD-CUSTOMERS` as
 *    the parent (matched by `customers` prefix, no special handling needed).
 *  - `{entityType}/{id}/files` — gated under `CAP-CROSS-ATTACHMENTS`. The
 *    entity-rooted path means we cannot match by static prefix; resolved
 *    here by detecting the trailing `/files` segment.
 *  - `{entityType}/{id}/activity` — gated under `CAP-CROSS-ACTIVITY-LOG`.
 *    Resolved here by detecting the trailing `/activity` segment.
 *
 * The order-sensitive registry is searched first; the entity-rooted special
 * cases are then checked. A URL that matches neither returns `null`.
 */
export function resolveCapabilityForUrl(url: string): string | null {
  // Extract the path part after `/api/v1/`. Handles both absolute and
  // relative URLs. Strip any querystring before matching.
  const apiIdx = url.indexOf('/api/v1/');
  if (apiIdx < 0) return null;
  const afterApi = url.slice(apiIdx + '/api/v1/'.length);
  const path = afterApi.split('?')[0].split('#')[0];

  // Static prefix scan (order-sensitive — first match wins).
  for (const entry of CAPABILITY_ENDPOINT_REGISTRY) {
    if (path === entry.prefix
      || path.startsWith(entry.prefix + '/')) {
      return entry.capability;
    }
  }

  // Entity-rooted attachments: `{entityType}/{entityId}/files...`
  // Avoid matching when the leading segment IS one of the registered
  // prefixes — those are handled above.
  const segments = path.split('/');
  if (segments.length >= 3) {
    const second = segments[1];
    if (/^\d+$/.test(second)) {
      const third = segments[2];
      if (third === 'files') return 'CAP-CROSS-ATTACHMENTS';
      if (third === 'activity') return 'CAP-CROSS-ACTIVITY-LOG';
    }
  }

  return null;
}
