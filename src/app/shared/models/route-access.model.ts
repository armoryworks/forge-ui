/**
 * Who may open a gated top-level route: any one of `roles`, every one of `capabilities`, and at least one of
 * `anyCapabilities` when that is set.
 */
export interface RouteAccess {
  roles?: readonly string[];
  capabilities?: readonly string[];
  anyCapabilities?: readonly string[];
}

/**
 * Role and capability gates for the top-level routes of the signed-in shell, keyed by route path.
 * The route table builds its guards from this map, and the landing-route resolver checks a landing
 * target against it, so a user is never sent home to a page their guard would refuse.
 */
export const ROUTE_ACCESS: Readonly<Record<string, RouteAccess>> = {
  'kanban': { roles: ['Admin', 'Manager', 'PM', 'Engineer', 'ProductionWorker', 'OfficeManager'] },
  'parts': { roles: ['Admin', 'Manager', 'Engineer', 'PM', 'OfficeManager'] },
  'costing': { roles: ['Admin', 'Manager'] },
  'sequences': { roles: ['Admin', 'Manager'], capabilities: ['CAP-CROSS-SEQUENCES'] },
  'compliance': { roles: ['Admin', 'Manager', 'ComplianceOfficer', 'OfficeManager'], capabilities: ['CAP-EXT-WATCHTOWER'] },
  'watchtower': { roles: ['Admin', 'Manager'], capabilities: ['CAP-EXT-WATCHTOWER'] },
  'shipping': { roles: ['Admin', 'Manager', 'OfficeManager'], capabilities: ['CAP-O2C-SHIP'] },
  'inventory': { roles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
  'customers': { roles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
  'communications': { roles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
  'sales-channels': { roles: ['Admin', 'Manager', 'PM', 'OfficeManager'], capabilities: ['CAP-O2C-CHANNELS'] },
  'leads': { roles: ['Admin', 'Manager', 'PM'] },
  'expenses': { roles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
  'accounting/opening-journal': { roles: ['Controller'], capabilities: ['CAP-ACCT-MIGRATION'] },
  'accounting/opening-stock': { roles: ['Controller'], anyCapabilities: ['CAP-ACCT-MIGRATION', 'CAP-ACCT-FULLGL'] },
  'accounting': { roles: ['Controller'], capabilities: ['CAP-ACCT-GL-VIEW'] },
  'assets': { roles: ['Admin', 'Manager', 'Engineer'] },
  'maintenance': { roles: ['Admin', 'Manager'] },
  'piece-rates': { roles: ['Admin', 'Manager', 'OfficeManager'], capabilities: ['CAP-HR-PIECE-RATES'] },
  'employees': { roles: ['Admin', 'Manager'] },
  'planning': { roles: ['Admin', 'Manager', 'PM'] },
  'vendors': { roles: ['Admin', 'Manager', 'OfficeManager', 'Procurement'] },
  'purchasing': { roles: ['Admin', 'Manager', 'OfficeManager', 'Procurement'] },
  'purchase-orders': { roles: ['Admin', 'Manager', 'OfficeManager', 'Procurement'] },
  'sales-orders': { roles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
  'quotes': { roles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
  'shipments': { roles: ['Admin', 'Manager', 'OfficeManager'] },
  'invoices': { roles: ['Admin', 'Manager', 'OfficeManager'] },
  'payments': { roles: ['Admin', 'Manager', 'OfficeManager'] },
  'credit-memos': { roles: ['Admin', 'Manager', 'OfficeManager', 'Controller'], anyCapabilities: ['CAP-O2C-CREDITMEMO', 'CAP-O2C-RMA'] },
  'payables': { roles: ['Admin', 'Manager', 'OfficeManager', 'Procurement', 'Controller'], capabilities: ['CAP-P2P-BILL'] },
  'approvals': { roles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
  'quality': { roles: ['Admin', 'Manager', 'Engineer'] },
  'customer-returns': { roles: ['Admin', 'Manager', 'OfficeManager'] },
  'lots': { roles: ['Admin', 'Manager', 'Engineer'] },
  'mrp': { roles: ['Admin', 'Manager'] },
  'oee': { roles: ['Admin', 'Manager'] },
  'scheduling': { roles: ['Admin', 'Manager'] },
  'admin': { roles: ['Admin', 'Manager', 'OfficeManager'] },
};

/**
 * The access rule for a URL: the longest {@link ROUTE_ACCESS} key that matches the URL's leading
 * path segments, or `undefined` when the URL's route is not gated.
 */
export function routeAccessFor(url: string): RouteAccess | undefined {
  const segments = url.split(/[?#]/)[0].split('/').filter((s) => s.length > 0);
  for (let length = segments.length; length > 0; length--) {
    const access = ROUTE_ACCESS[segments.slice(0, length).join('/')];
    if (access) return access;
  }
  return undefined;
}
