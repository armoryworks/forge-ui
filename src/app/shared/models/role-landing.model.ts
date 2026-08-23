/** localStorage/API preference key for a user's explicitly chosen landing screen. */
export const LANDING_ROUTE_PREF_KEY = 'landing:route';

/**
 * Primary landing route for a user whose access is dominated by a single role.
 * When a user has exactly one (expanded) role and it maps here, they land on the
 * screen most relevant to that role instead of the generic dashboard. Broad roles
 * (Admin, Manager, IT Admin) are intentionally absent — they land on the dashboard.
 *
 * Targets are best-effort: if a mapped screen is gated off by capability for that
 * install, the route guard falls the user back to the dashboard.
 */
export const ROLE_LANDING: Readonly<Record<string, string>> = {
  ProductionWorker: '/kanban',
  'Production Manager': '/kanban',
  'Production Planner': '/planning',
  Engineer: '/parts',
  Procurement: '/purchasing',
  Controller: '/accounting',
  OfficeManager: '/customers',
  ComplianceOfficer: '/compliance',
  PM: '/backlog',
};

/** A selectable landing-screen choice for the profile customization screen. */
export interface LandingOption {
  /** Route to store, or 'auto' to clear the preference and use role-based landing. */
  value: string;
  labelKey: string;
}

/** Curated landing-screen choices offered in Account → Customization. */
export const LANDING_OPTIONS: readonly LandingOption[] = [
  { value: 'auto', labelKey: 'account.landingAuto' },
  { value: '/dashboard', labelKey: 'account.landingDashboard' },
  { value: '/kanban', labelKey: 'account.landingKanban' },
  { value: '/backlog', labelKey: 'account.landingBacklog' },
  { value: '/parts', labelKey: 'account.landingParts' },
  { value: '/customers', labelKey: 'account.landingCustomers' },
  { value: '/sales-orders', labelKey: 'account.landingSalesOrders' },
  { value: '/purchasing', labelKey: 'account.landingPurchasing' },
  { value: '/inventory', labelKey: 'account.landingInventory' },
  { value: '/scheduling', labelKey: 'account.landingScheduling' },
  { value: '/reports', labelKey: 'account.landingReports' },
  { value: '/accounting', labelKey: 'account.landingAccounting' },
];

/**
 * Resolve a role-based landing route. Returns a route only when the user has a
 * single role that maps here, so any multi-role (broader-access) user keeps the
 * dashboard.
 */
export function resolveRoleLanding(roles: readonly string[]): string | null {
  if (roles.length !== 1) return null;
  return ROLE_LANDING[roles[0]] ?? null;
}
