import { Injectable, Signal, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { AuthService } from './auth.service';
import { CapabilityService } from './capability.service';
import { NavItem } from '../models/nav-item.model';

@Injectable({ providedIn: 'root' })
export class NavTreeService {
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.split('?')[0]),
    ),
    { initialValue: this.router.url.split('?')[0] },
  );

  // Pinned-top items: always rendered at the top of the sidebar regardless of
  // which group the user has drilled into. Currently empty — see allMainTree
  // below for Dashboard's home as a top-level peer (not workflow-domain-bound).
  private readonly allPinnedTopTree: NavItem[] = [];

  private readonly allMainTree: NavItem[] = [
    // Dashboard sits at the top of the main tree as a peer of Operations / Sales
    // / Production / etc. — NOT as a child of any one functional area. The
    // dashboard is per-user, customized to the signed-in user's role and main
    // job function (engineer, PM, office manager, production worker), so
    // bucketing it under any single domain misrepresents what it shows.
    { icon: 'dashboard', label: 'Dashboard', i18nKey: 'nav.dashboard', route: '/dashboard', shortcut: ['Q', 'D'] },
    {
      icon: 'space_dashboard', label: 'Operations', i18nKey: 'navGroups.operations',
      children: [
        { icon: 'view_kanban', label: 'Board', i18nKey: 'nav.kanban', route: '/kanban', shortcut: ['Q', 'K'], capability: 'CAP-EXT-KANBAN', allowedRoles: ['Admin', 'Manager', 'Engineer', 'ProductionWorker'] },
        { icon: 'inbox', label: 'Backlog', i18nKey: 'nav.backlog', route: '/backlog', shortcut: ['Q', 'B'], capability: 'CAP-EXT-KANBAN', allowedRoles: ['Admin', 'Manager', 'PM', 'Engineer'] },
        { icon: 'event_note', label: 'Planning', i18nKey: 'nav.planning', route: '/planning', capability: 'CAP-EXT-KANBAN', allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'calendar_month', label: 'Calendar', i18nKey: 'nav.calendar', route: '/calendar', capability: 'CAP-EXT-KANBAN' },
        { icon: 'rule', label: 'Approvals', i18nKey: 'nav.approvals', route: '/approvals', capability: 'CAP-P2P-APPROVALS', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
      ],
    },
    {
      icon: 'sell', label: 'Sales', i18nKey: 'navGroups.sales',
      children: [
        // Phase 1r — Customers is now a group with sub-routes for
        // account-management surfaces (flat cross-customer contact view,
        // portal-access admin, saved segments, bulk import). Same
        // submenu shape Leads uses but customer-specific children since
        // customer work is *management*, not *acquisition*.
        {
          icon: 'people', label: 'Customers', i18nKey: 'nav.customers',
          capability: 'CAP-MD-CUSTOMERS',
          allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'],
          children: [
            { icon: 'list', label: 'All Customers', i18nKey: 'nav.customersAll', route: '/customers' },
            { icon: 'contacts', label: 'Contacts', i18nKey: 'nav.customersContacts', route: '/customers/contacts' },
            { icon: 'vpn_key', label: 'Portal Access', i18nKey: 'nav.customersPortalAccess', route: '/customers/portal-access' },
            { icon: 'filter_alt', label: 'Segments', i18nKey: 'nav.customersSegments', route: '/customers/segments' },
            { icon: 'upload_file', label: 'Import', i18nKey: 'nav.customersImport', route: '/customers/import' },
          ],
        },
        // Phase 1r — Leads is now a group with sub-routes for high-volume
        // marketing surfaces (bulk intake / worker queue / campaigns /
        // suppression). First child "All" routes to the original list page
        // so /leads still resolves cleanly for existing bookmarks + cross-
        // entity links. Same submenu pattern Admin uses.
        {
          icon: 'people_outline', label: 'Leads', i18nKey: 'nav.leads',
          capability: 'CAP-O2C-LEAD',
          allowedRoles: ['Admin', 'Manager', 'PM'],
          children: [
            { icon: 'list', label: 'All Leads', i18nKey: 'nav.leadsAll', route: '/leads' },
            { icon: 'upload_file', label: 'Bulk Intake', i18nKey: 'nav.leadsIntake', route: '/leads/intake' },
            { icon: 'speed', label: 'Worker Queue', i18nKey: 'nav.leadsQueue', route: '/leads/queue' },
            { icon: 'campaign', label: 'Campaigns', i18nKey: 'nav.leadsCampaigns', route: '/leads/campaigns' },
            { icon: 'block', label: 'Suppression', i18nKey: 'nav.leadsSuppression', route: '/leads/suppression' },
            { icon: 'card_giftcard', label: 'Samples', i18nKey: 'nav.leadsSamples', route: '/leads/samples' },
            { icon: 'business', label: 'Accounts', i18nKey: 'nav.leadsAccounts', route: '/leads/accounts' },
          ],
        },
        { icon: 'request_quote', label: 'Quotes', i18nKey: 'nav.quotes', route: '/quotes', capability: 'CAP-O2C-QUOTE', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'shopping_cart', label: 'Sales Orders', i18nKey: 'nav.salesOrders', route: '/sales-orders', capability: 'CAP-O2C-SO', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'event_repeat', label: 'Recurring Orders', i18nKey: 'nav.recurringOrders', route: '/sales-orders/recurring', capability: 'CAP-O2C-RECURRING', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'outbox', label: 'Shipments', i18nKey: 'nav.shipments', route: '/shipments', capability: 'CAP-O2C-SHIP', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'assignment_return', label: 'Customer Returns', i18nKey: 'nav.customerReturns', route: '/customer-returns', capability: 'CAP-O2C-RMA', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'receipt', label: 'Invoices', i18nKey: 'nav.invoices', route: '/invoices', capability: 'CAP-O2C-INVOICE', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'payments', label: 'Payments', i18nKey: 'nav.payments', route: '/payments', capability: 'CAP-O2C-CASH', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },
    {
      icon: 'precision_manufacturing', label: 'Production', i18nKey: 'navGroups.production',
      children: [
        { icon: 'category', label: 'Parts', i18nKey: 'nav.parts', route: '/parts', shortcut: ['Q', 'P'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'PM'] },
        { icon: 'hub', label: 'MRP', i18nKey: 'nav.mrp', route: '/mrp', capability: 'CAP-PLAN-MRP', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'event_available', label: 'Scheduling', i18nKey: 'nav.scheduling', route: '/scheduling', capability: 'CAP-PLAN-CAPACITY', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'batch_prediction', label: 'Lots', i18nKey: 'nav.lots', route: '/lots', capability: 'CAP-INV-LOTS', allowedRoles: ['Admin', 'Manager', 'Engineer'] },
        { icon: 'speed', label: 'OEE', i18nKey: 'nav.oee', route: '/oee', capability: 'CAP-RPT-OEE', allowedRoles: ['Admin', 'Manager'] },
      ],
    },
    {
      icon: 'inventory_2', label: 'Inventory', i18nKey: 'navGroups.inventory',
      children: [
        { icon: 'inventory', label: 'Stock', i18nKey: 'nav.inventory', route: '/inventory', shortcut: ['Q', 'I'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'build', label: 'Assets', i18nKey: 'nav.assets', route: '/assets', capability: 'CAP-MD-ASSETS', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'precision_manufacturing', label: 'Maintenance', i18nKey: 'nav.maintenance', route: '/maintenance/predictions', capability: 'CAP-MAINT-PM', allowedRoles: ['Admin', 'Manager'] },
      ],
    },
    {
      icon: 'local_shipping', label: 'Purchasing', i18nKey: 'navGroups.purchasing',
      children: [
        { icon: 'storefront', label: 'Vendors', i18nKey: 'nav.vendors', route: '/vendors', capability: 'CAP-MD-VENDORS', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'description', label: 'Purchase Orders', i18nKey: 'nav.purchaseOrders', route: '/purchase-orders', capability: 'CAP-P2P-PO', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'request_page', label: 'RFQs', i18nKey: 'nav.purchasing', route: '/purchasing', capability: 'CAP-P2P-RFQ', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'request_quote', label: 'Payables', i18nKey: 'nav.payables', route: '/payables', capability: 'CAP-P2P-BILL', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },
    {
      icon: 'groups', label: 'People', i18nKey: 'navGroups.people',
      children: [
        { icon: 'badge', label: 'Employees', i18nKey: 'nav.employees', route: '/employees', capability: 'CAP-MD-EMPLOYEES', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'schedule', label: 'Time', i18nKey: 'nav.timeTracking', route: '/time-tracking', shortcut: ['Q', 'T'], capability: 'CAP-HR-TIMETRACK' },
        { icon: 'receipt_long', label: 'Expenses', i18nKey: 'nav.expenses', route: '/expenses', capability: 'CAP-ACCT-EXPENSES', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        { icon: 'school', label: 'Training', i18nKey: 'nav.training', route: '/training/library' },
      ],
    },
    {
      icon: 'insights', label: 'Insights', i18nKey: 'navGroups.insights',
      children: [
        { icon: 'bar_chart', label: 'Reports', i18nKey: 'nav.reports', route: '/reports', shortcut: ['Q', 'R'], allowedRoles: ['Admin', 'Manager', 'PM'] },
        { icon: 'smart_toy', label: 'AI', i18nKey: 'nav.ai', route: '/ai', capability: 'CAP-EXT-AI-ASSISTANT' },
      ],
    },
    {
      // Dark GL accounting suite — the whole group is hidden unless CAP-ACCT-FULLGL is enabled.
      icon: 'account_balance', label: 'Accounting', i18nKey: 'navGroups.accounting',
      capability: 'CAP-ACCT-FULLGL',
      allowedRoles: ['Admin', 'Manager', 'OfficeManager'],
      children: [
        { icon: 'balance', label: 'Trial Balance', i18nKey: 'nav.trialBalance', route: '/accounting/trial-balance' },
        { icon: 'trending_up', label: 'Profit & Loss', i18nKey: 'nav.profitLoss', route: '/accounting/profit-loss' },
        { icon: 'account_balance', label: 'Balance Sheet', i18nKey: 'nav.balanceSheet', route: '/accounting/balance-sheet' },
        { icon: 'waterfall_chart', label: 'Cash Flow', i18nKey: 'nav.cashFlow', route: '/accounting/cash-flow' },
        { icon: 'trending_flat', label: 'AR Aging', i18nKey: 'nav.arAging', route: '/accounting/ar-aging' },
        { icon: 'schedule', label: 'AP Aging', i18nKey: 'nav.apAging', route: '/accounting/ap-aging' },
        { icon: 'inventory_2', label: 'GRNI', i18nKey: 'nav.grni', route: '/accounting/grni' },
        { icon: 'event_available', label: 'Period Close', i18nKey: 'nav.periodClose', route: '/accounting/period-close', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'account_balance_wallet', label: 'Bank Reconciliation', i18nKey: 'nav.bankRec', route: '/accounting/bank-rec', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },
  ];

  private readonly allBottomTree: NavItem[] = [
    { icon: 'storefront', label: 'Shop Floor', i18nKey: 'nav.shopFloor', route: '/display/shop-floor', capability: 'CAP-MFG-SHOPFLOOR', allowedRoles: ['Admin', 'Manager'] },
    {
      icon: 'settings', label: 'Admin', i18nKey: 'nav.admin', routePrefix: '/admin',
      allowedRoles: ['Admin', 'Manager', 'OfficeManager'],
      children: [
        { icon: 'dashboard', label: 'Overview', i18nKey: 'admin.tabs.overview', route: '/admin/overview', allowedRoles: ['Admin'] },
        {
          icon: 'manage_accounts', label: 'Users & Access', i18nKey: 'adminGroups.usersAccess',
          children: [
            { icon: 'people', label: 'Users', i18nKey: 'admin.tabs.users', route: '/admin/users', allowedRoles: ['Admin'] },
            { icon: 'groups', label: 'Teams', i18nKey: 'admin.tabs.teams', route: '/admin/teams', allowedRoles: ['Admin'] },
            { icon: 'layers', label: 'Role Templates', i18nKey: 'admin.tabs.roleTemplates', route: '/admin/role-templates', allowedRoles: ['Admin'] },
            { icon: 'verified_user', label: 'MFA Policy', i18nKey: 'admin.tabs.mfa', route: '/admin/mfa', allowedRoles: ['Admin'] },
          ],
        },
        {
          icon: 'dataset', label: 'Master Data', i18nKey: 'adminGroups.masterData',
          children: [
            { icon: 'dataset', label: 'Reference Data', i18nKey: 'admin.tabs.referenceData', route: '/admin/reference-data', allowedRoles: ['Admin'] },
            { icon: 'translate', label: 'Terminology', i18nKey: 'admin.tabs.terminology', route: '/admin/terminology', allowedRoles: ['Admin'] },
            { icon: 'route', label: 'Track Types', i18nKey: 'admin.tabs.trackTypes', route: '/admin/track-types', allowedRoles: ['Admin'] },
            { icon: 'percent', label: 'Sales Tax', i18nKey: 'admin.tabs.salesTax', route: '/admin/sales-tax', allowedRoles: ['Admin'] },
            { icon: 'campaign', label: 'Lead Sources', i18nKey: 'admin.tabs.leadSources', route: '/admin/lead-sources', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'fact_check', label: 'ICP Rubrics', i18nKey: 'admin.tabs.icpRubrics', route: '/admin/icp-rubrics', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'alt_route', label: 'Assignment Rules', i18nKey: 'admin.tabs.assignmentRules', route: '/admin/assignment-rules', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'payments', label: 'Currencies & FX', i18nKey: 'admin.tabs.currencies', route: '/admin/currencies', allowedRoles: ['Admin'] },
          ],
        },
        {
          icon: 'hub', label: 'Integrations', i18nKey: 'adminGroups.integrations',
          children: [
            { icon: 'hub', label: 'Integrations', i18nKey: 'admin.tabs.integrations', route: '/admin/integrations', allowedRoles: ['Admin'] },
            { icon: 'swap_horiz', label: 'EDI', i18nKey: 'admin.tabs.edi', route: '/admin/edi', allowedRoles: ['Admin'] },
            { icon: 'outbox', label: 'Integration Outbox', i18nKey: 'admin.tabs.integrationOutbox', route: '/admin/integration-outbox', allowedRoles: ['Admin'] },
            { icon: 'smart_toy', label: 'AI Assistants', i18nKey: 'admin.tabs.aiAssistants', route: '/admin/ai-assistants', allowedRoles: ['Admin'] },
            { icon: 'auto_awesome', label: 'Auto-PO', i18nKey: 'admin.tabs.autoPo', route: '/admin/auto-po', allowedRoles: ['Admin'] },
            { icon: 'local_shipping', label: 'Carriers', i18nKey: 'admin.tabs.carriers', route: '/admin/carriers', capability: 'CAP-O2C-SHIP', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
          ],
        },
        {
          icon: 'auto_fix_high', label: 'Workflow', i18nKey: 'adminGroups.workflow',
          children: [
            { icon: 'auto_fix_high', label: 'Automations', i18nKey: 'admin.tabs.automations', route: '/admin/automations', allowedRoles: ['Admin'] },
            { icon: 'event', label: 'Events', i18nKey: 'admin.tabs.events', route: '/admin/events', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'campaign', label: 'Announcements', i18nKey: 'admin.tabs.announcements', route: '/admin/announcements', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'school', label: 'Training', i18nKey: 'admin.tabs.training', route: '/admin/training', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'fact_check', label: 'Compliance', i18nKey: 'admin.tabs.compliance', route: '/admin/compliance', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
            { icon: 'receipt_long', label: 'Expense Policy', i18nKey: 'admin.tabs.expenses', route: '/admin/expenses', allowedRoles: ['Admin'] },
          ],
        },
        {
          icon: 'toggle_on', label: 'Capabilities', i18nKey: 'adminGroups.capabilities',
          children: [
            { icon: 'toggle_on', label: 'Capabilities', i18nKey: 'admin.tabs.capabilities', route: '/admin/capabilities', allowedRoles: ['Admin'] },
            { icon: 'quiz', label: 'Discovery Wizard', i18nKey: 'admin.tabs.discovery', route: '/admin/discovery', allowedRoles: ['Admin'] },
            { icon: 'dashboard_customize', label: 'Presets', i18nKey: 'admin.tabs.presets', route: '/admin/presets', allowedRoles: ['Admin'] },
            { icon: 'fact_check', label: 'Entity Completeness', i18nKey: 'admin.tabs.entityCompleteness', route: '/admin/entity-completeness', allowedRoles: ['Admin'] },
          ],
        },
        {
          icon: 'settings', label: 'System', i18nKey: 'adminGroups.system',
          children: [
            { icon: 'tune', label: 'Settings', i18nKey: 'admin.tabs.settings', route: '/admin/settings', allowedRoles: ['Admin'] },
            { icon: 'manage_search', label: 'Audit Log', i18nKey: 'admin.tabs.auditLog', route: '/admin/audit-log', allowedRoles: ['Admin'] },
            { icon: 'vpn_key', label: 'BI API Keys', i18nKey: 'admin.tabs.biApiKeys', route: '/admin/bi-api-keys', allowedRoles: ['Admin'] },
            { icon: 'key', label: 'System API Keys', i18nKey: 'admin.tabs.systemApiKeys', route: '/admin/system-api-keys', allowedRoles: ['Admin'] },
            { icon: 'lan', label: 'Connections', i18nKey: 'admin.tabs.connections', route: '/admin/connections', allowedRoles: ['Admin'] },
            { icon: 'edit_note', label: 'Time Corrections', i18nKey: 'admin.tabs.timeCorrections', route: '/admin/time-corrections', allowedRoles: ['Admin', 'Manager'] },
          ],
        },
      ],
    },
  ];

  readonly pinnedTopTree: Signal<NavItem[]> = computed(() => this.filterTree(this.allPinnedTopTree));
  readonly mainTree: Signal<NavItem[]> = computed(() => this.filterTree(this.allMainTree));
  readonly bottomTree: Signal<NavItem[]> = computed(() => this.filterTree(this.allBottomTree));

  /**
   * Full ancestor chain of the current URL, walking all groups (including
   * non-routePrefix groups). Used by the header breadcrumb so that e.g.
   * `/kanban` shows `Operations > Board` even though Operations doesn't
   * own the `/kanban` URL prefix. Top-level peer leaves like `/dashboard`
   * resolve to a single-item trail (just `Dashboard`).
   */
  readonly breadcrumbTrail: Signal<NavItem[]> = computed(() => {
    const url = this.currentUrl();
    const trail = this.findTrail([...this.mainTree(), ...this.bottomTree()], url, /*requirePrefix*/ false);
    // Group crumbs (Operations, Sales, …) are organizational — they carry
    // `children` but no `route`, so the header renders them as dead <span>s and
    // clicking a mid-breadcrumb does nothing. Resolve each routeless group to
    // its first navigable descendant leaf (the section's default landing page,
    // matching the sidebar drill) so intermediate crumbs become clickable links.
    return trail.map(item =>
      item.route || !item.children ? item : { ...item, route: this.firstLeafRoute(item) },
    );
  });

  /**
   * Ancestor chain used by the sidebar to auto-drill into the current URL's
   * group on page load so the second tier (group's children) is visible. Uses
   * the same resolution as the breadcrumb — every nav group, not just those
   * with an explicit routePrefix — so e.g. /kanban lands on Operations'
   * children instead of the tier-1 group list. Manual drill-override still
   * wins between navigations (sidebar.drillPath() checks drillOverride first).
   */
  readonly drillTrail: Signal<NavItem[]> = computed(() => {
    const url = this.currentUrl();
    return this.findTrail([...this.mainTree(), ...this.bottomTree()], url, /*requirePrefix*/ false);
  });

  private filterTree(tree: NavItem[]): NavItem[] {
    return tree
      .filter(item => this.isAllowed(item))
      .flatMap(item => {
        // Leaf — keep as-is.
        if (!item.children) return [item];
        const children = this.filterTree(item.children);
        // Empty group (all children gated/role-filtered out) — drop it.
        if (children.length === 0) return [];
        // A group reduced to a single child is a pointless expandable: promote
        // the lone child up a level so the user doesn't drill through an empty
        // shell. Happens naturally when modules are narrowed. (The promoted
        // child keeps its own label/route; the redundant wrapper disappears.)
        if (children.length === 1) return children;
        return [{ ...item, children }];
      });
  }

  private isAllowed(item: NavItem): boolean {
    if (item.capability && !this.capabilities.isEnabled(item.capability)) return false;
    if (!item.allowedRoles) return true;
    return this.auth.hasAnyRole(item.allowedRoles);
  }

  private findTrail(tree: NavItem[], url: string, requirePrefix: boolean, insideDrillable = false): NavItem[] {
    // Phase 1r — match the most-specific leaf when siblings have
    // overlapping route prefixes. e.g. under the Leads group, "All
    // Leads" has route `/leads` and "Bulk Intake" has `/leads/intake`;
    // for url `/leads/intake` we want the Intake match, not the
    // prefix-y All-Leads match. Sort by route length descending so
    // longer routes are tested first; groups (no route) sort to the
    // end of the leaf-match phase but their child recursion is still
    // attempted.
    const ordered = [...tree].sort((a, b) =>
      (b.route?.length ?? 0) - (a.route?.length ?? 0));

    for (const item of ordered) {
      if (item.children?.length) {
        if (requirePrefix && item.routePrefix && !this.urlMatchesPrefix(url, item.routePrefix)) continue;
        const isDrillable = insideDrillable || !!item.routePrefix;
        const childTrail = this.findTrail(item.children, url, requirePrefix, isDrillable);
        if (childTrail.length > 0) {
          if (requirePrefix) {
            return isDrillable ? [item, ...childTrail] : childTrail;
          }
          return [item, ...childTrail];
        }
      } else if (item.route && (item.route === url || url.startsWith(item.route + '/'))) {
        return [item];
      }
    }
    return [];
  }

  private urlMatchesPrefix(url: string, prefix: string): boolean {
    return url === prefix || url.startsWith(prefix + '/');
  }

  /** First navigable route within an item's subtree (its own, else first descendant leaf). */
  private firstLeafRoute(item: NavItem): string | undefined {
    if (item.route) return item.route;
    for (const child of item.children ?? []) {
      const route = this.firstLeafRoute(child);
      if (route) return route;
    }
    return undefined;
  }
}
