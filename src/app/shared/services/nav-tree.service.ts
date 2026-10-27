import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { AuthService } from './auth.service';
import { CapabilityService } from './capability.service';
import { NavItem } from '../models/nav-item.model';
import { NavLeaf } from '../models/nav-leaf.model';

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

  private readonly routeBreadcrumbKey = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.deepestRouteBreadcrumb()),
    ),
    { initialValue: this.deepestRouteBreadcrumb() },
  );

  private readonly recordCrumbState = signal<{ label: string; urlPrefix: string } | null>(null);

  // Pinned-top items: always rendered at the top of the sidebar regardless of
  // which group the user has drilled into. Currently empty — see allMainTree
  // below for Dashboard's home as a top-level peer (not workflow-domain-bound).
  private readonly allPinnedTopTree: NavItem[] = [];

  // IA (redesigned 2026-08-22): grouped by the value streams a manufacturer
  // recognizes — Sell, Make, Buy, Stock, Equipment, Ship, Money, Quality,
  // People, Insights — rather than by internal module boundaries. Key moves vs
  // the prior tree: (1) all money consolidated into one Financials home
  // (Invoices/Payments/Expenses/Payables/Costing/aging/GL were scattered across
  // five groups); (2) the "Operations" grab-bag dissolved — execution → Make,
  // Compliance/Watchtower → Quality, Approvals → Purchasing, Sequences → Make;
  // (3) Shipping de-duplicated into one Fulfillment group (was a top-level leaf
  // AND a Shipments record under Sales); (4) asset reliability unified under
  // Equipment (Assets/Maintenance/OEE were split across Inventory + Production);
  // (5) Quality surfaced (it had no nav entry); (6) Costing promoted to a
  // first-class Financials entry (Tier-3, capability-gated).
  private readonly allMainTree: NavItem[] = [
    // Dashboard is per-user (role + job-function customised), so it sits as a
    // top-level peer, not under any single domain.
    { icon: 'dashboard', label: 'Dashboard', i18nKey: 'nav.dashboard', route: '/dashboard', shortcut: ['Q', 'D'] },

    // ── SELL — demand + customer capture (CRM through order). Deliberately no
    // money and no fulfilment here; those get their own homes below. ──
    {
      icon: 'sell', label: 'Sales', i18nKey: 'navGroups.sales',
      children: [
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
        {
          icon: 'storefront', label: 'Sales Channels', i18nKey: 'nav.salesChannels',
          capability: 'CAP-O2C-CHANNELS',
          allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'],
          children: [
            { icon: 'list', label: 'All Channels', i18nKey: 'nav.salesChannelsAll', route: '/sales-channels' },
            { icon: 'power', label: 'Connections', i18nKey: 'nav.salesChannelsConnections', route: '/sales-channels/connections', capability: 'CAP-EXT-ECOMMERCE', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'sell', label: 'Listings', i18nKey: 'nav.salesChannelsListings', route: '/sales-channels/listings', capability: 'CAP-EXT-ECOMMERCE', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
            { icon: 'person_outline', label: 'Retail Buyers', i18nKey: 'nav.salesChannelsBuyers', route: '/sales-channels/buyers', capability: 'CAP-O2C-RETAIL' },
            { icon: 'account_balance', label: 'Settlements', i18nKey: 'nav.salesChannelsSettlements', route: '/sales-channels/settlements', capability: 'CAP-O2C-SETTLEMENT', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
          ],
        },
        { icon: 'request_quote', label: 'Quotes', i18nKey: 'nav.quotes', route: '/quotes', capability: 'CAP-O2C-QUOTE', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'shopping_cart', label: 'Sales Orders', i18nKey: 'nav.salesOrders', route: '/sales-orders', capability: 'CAP-O2C-SO', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
        { icon: 'event_repeat', label: 'Recurring Orders', i18nKey: 'nav.recurringOrders', route: '/sales-orders/recurring', capability: 'CAP-O2C-RECURRING', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },

    // ── MAKE — planning + tracking the work, and the product/process data
    // behind it. Absorbs the old Operations execution surfaces. ──
    {
      icon: 'precision_manufacturing', label: 'Production', i18nKey: 'navGroups.production',
      children: [
        { icon: 'view_kanban', label: 'Board', i18nKey: 'nav.kanban', route: '/kanban', shortcut: ['Q', 'K'], capability: 'CAP-EXT-KANBAN', allowedRoles: ['Admin', 'Manager', 'PM', 'Engineer', 'ProductionWorker', 'OfficeManager', 'Production Planner'] },
        { icon: 'inbox', label: 'Backlog', i18nKey: 'nav.backlog', route: '/backlog', shortcut: ['Q', 'B'], capability: 'CAP-EXT-KANBAN', allowedRoles: ['Admin', 'Manager', 'PM', 'Engineer'] },
        { icon: 'event_note', label: 'Planning', i18nKey: 'nav.planning', route: '/planning', capability: 'CAP-EXT-KANBAN', allowedRoles: ['Admin', 'Manager', 'PM', 'Production Planner'] },
        { icon: 'folder_special', label: 'Projects', i18nKey: 'nav.projects', route: '/projects', capability: 'CAP-EXT-PROJECTS', allowedRoles: ['Admin', 'Manager', 'PM', 'Engineer'] },
        { icon: 'event_available', label: 'Scheduling', i18nKey: 'nav.scheduling', route: '/scheduling', capability: 'CAP-PLAN-CAPACITY', allowedRoles: ['Admin', 'Manager', 'Production Planner'] },
        { icon: 'calendar_month', label: 'Calendar', i18nKey: 'nav.calendar', route: '/calendar', capability: 'CAP-EXT-KANBAN' },
        { icon: 'category', label: 'Parts', i18nKey: 'nav.parts', route: '/parts', shortcut: ['Q', 'P'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'PM', 'OfficeManager', 'Production Planner'] },
        { icon: 'hub', label: 'MRP', i18nKey: 'nav.mrp', route: '/mrp', capability: 'CAP-PLAN-MRP', allowedRoles: ['Admin', 'Manager', 'Production Planner'] },
        { icon: 'batch_prediction', label: 'Lots', i18nKey: 'nav.lots', route: '/lots', capability: 'CAP-INV-LOTS', allowedRoles: ['Admin', 'Manager', 'Engineer'] },
        { icon: 'campaign', label: 'Andon', i18nKey: 'nav.andon', route: '/andon', capability: 'CAP-EXT-ANDON' },
        {
          icon: 'account_tree', label: 'Sequences', i18nKey: 'nav.sequences',
          capability: 'CAP-CROSS-SEQUENCES', allowedRoles: ['Admin', 'Manager'],
          children: [
            { icon: 'schema', label: 'Definitions', i18nKey: 'nav.sequencesDefinitions', route: '/sequences' },
            { icon: 'playlist_play', label: 'Instances', i18nKey: 'nav.sequencesInstances', route: '/sequences/instances' },
          ],
        },
      ],
    },

    // ── BUY — procurement. Approvals lives here (it is the procure-to-pay gate). ──
    {
      icon: 'shopping_bag', label: 'Purchasing', i18nKey: 'navGroups.purchasing',
      children: [
        { icon: 'storefront', label: 'Vendors', i18nKey: 'nav.vendors', route: '/vendors', capability: 'CAP-MD-VENDORS', allowedRoles: ['Admin', 'Manager', 'OfficeManager', 'Procurement'] },
        { icon: 'description', label: 'Purchase Orders', i18nKey: 'nav.purchaseOrders', route: '/purchase-orders', capability: 'CAP-P2P-PO', allowedRoles: ['Admin', 'Manager', 'OfficeManager', 'Procurement'] },
        { icon: 'request_page', label: 'RFQs', i18nKey: 'nav.purchasing', route: '/purchasing', capability: 'CAP-P2P-RFQ', allowedRoles: ['Admin', 'Manager', 'OfficeManager', 'Procurement'] },
        { icon: 'handshake', label: 'Consignment', i18nKey: 'nav.consignment', route: '/inventory/consignment', capability: 'CAP-MD-CONTRACTS-CONSIGNMENT', allowedRoles: ['Admin', 'Manager', 'OfficeManager', 'Engineer'] },
        { icon: 'rule', label: 'Approvals', i18nKey: 'nav.approvals', route: '/approvals', capability: 'CAP-P2P-APPROVALS', allowedRoles: ['Admin', 'Manager', 'PM', 'OfficeManager'] },
      ],
    },

    // ── STOCK — physical goods on hand. ──
    {
      icon: 'inventory_2', label: 'Inventory', i18nKey: 'navGroups.inventory',
      children: [
        { icon: 'inventory', label: 'Stock', i18nKey: 'nav.inventory', route: '/inventory', shortcut: ['Q', 'I'], allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager', 'Production Planner'] },
        { icon: 'fact_check', label: 'Physical Inventory', i18nKey: 'nav.physicalInventory', route: '/inventory/physical-inventory', capability: 'CAP-INV-PHYSICAL', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
      ],
    },

    // ── EQUIPMENT — asset reliability, unified (was split Inventory/Production). ──
    {
      icon: 'construction', label: 'Equipment', i18nKey: 'navGroups.equipment',
      children: [
        { icon: 'build', label: 'Assets', i18nKey: 'nav.assets', route: '/assets', capability: 'CAP-MD-ASSETS', allowedRoles: ['Admin', 'Manager', 'Engineer'] },
        { icon: 'handyman', label: 'Maintenance', i18nKey: 'nav.maintenance', route: '/maintenance/schedules', capability: 'CAP-MAINT-PM', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'insights', label: 'Predictions', i18nKey: 'nav.maintenancePredictions', route: '/maintenance/predictions', capability: 'CAP-MAINT-PREDICTIVE', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'speed', label: 'OEE', i18nKey: 'nav.oee', route: '/oee', capability: 'CAP-RPT-OEE', allowedRoles: ['Admin', 'Manager'] },
      ],
    },

    // ── SHIP — getting goods to the customer. Consolidates the shipping
    // workspace, the shipments record, and returns. ──
    {
      icon: 'local_shipping', label: 'Fulfillment', i18nKey: 'navGroups.fulfillment',
      children: [
        { icon: 'local_shipping', label: 'Shipping', i18nKey: 'nav.shipping', route: '/shipping', capability: 'CAP-O2C-SHIP', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'inventory', label: 'Pick waves', i18nKey: 'nav.pickWaves', route: '/pick-waves', capability: 'CAP-O2C-PICKPACK', allowedRoles: ['Admin', 'Manager', 'OfficeManager', 'Engineer', 'ProductionWorker'] },
        { icon: 'outbox', label: 'Shipments', i18nKey: 'nav.shipments', route: '/shipments', capability: 'CAP-O2C-SHIP', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'assignment_return', label: 'Customer Returns', i18nKey: 'nav.customerReturns', route: '/customer-returns', capability: 'CAP-O2C-RMA', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
      ],
    },

    // ── MONEY — the single home for everything financial: receivables, payables,
    // expenses, standard costing, and (dark) the full GL suite. This is the
    // biggest IA win — the money layer was previously spread across Sales,
    // People, Purchasing, Admin, and its own group. ──
    {
      icon: 'account_balance_wallet', label: 'Financials', i18nKey: 'navGroups.financials',
      children: [
        { icon: 'receipt', label: 'Invoices', i18nKey: 'nav.invoices', route: '/invoices', capability: 'CAP-O2C-INVOICE', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'payments', label: 'Payments', i18nKey: 'nav.payments', route: '/payments', capability: 'CAP-O2C-CASH', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'request_quote', label: 'Credit Memos', i18nKey: 'nav.creditMemos', route: '/credit-memos', anyCapabilities: ['CAP-O2C-CREDITMEMO', 'CAP-O2C-RMA'], allowedRoles: ['Admin', 'Manager', 'OfficeManager', 'Controller'] },
        { icon: 'request_quote', label: 'Payables', i18nKey: 'nav.payables', route: '/payables', capability: 'CAP-P2P-BILL', allowedRoles: ['Admin', 'Manager', 'OfficeManager', 'Procurement', 'Controller'] },
        { icon: 'receipt_long', label: 'Expenses', i18nKey: 'nav.expenses', route: '/expenses', capability: 'CAP-ACCT-EXPENSES', allowedRoles: ['Admin', 'Manager', 'Engineer', 'OfficeManager'] },
        // Tier-3 standard costing (overhead pools, budgets, freeze, rates).
        // Capability-gated (default OFF) — the feature only appears when the
        // install opts into activity-based costing.
        { icon: 'calculate', label: 'Costing', i18nKey: 'nav.costing', route: '/costing', capability: 'CAP-COSTING-TIER3-ABC', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'input', label: 'Opening Journal', i18nKey: 'nav.openingJournal', route: '/accounting/opening-journal', capability: 'CAP-ACCT-MIGRATION', hiddenWithCapability: 'CAP-ACCT-FULLGL', allowedRoles: ['Controller'] },
        { icon: 'inventory', label: 'Opening Stock', i18nKey: 'nav.openingStock', route: '/accounting/opening-stock', capability: 'CAP-ACCT-MIGRATION', hiddenWithCapability: 'CAP-ACCT-FULLGL', allowedRoles: ['Controller'] },
        { icon: 'request_quote', label: 'Opening Receivables & Payables', i18nKey: 'nav.openingOpenItems', route: '/accounting/opening-open-items', capability: 'CAP-ACCT-MIGRATION', hiddenWithCapability: 'CAP-ACCT-FULLGL', allowedRoles: ['Controller'] },
        {
          // Dark GL accounting suite — hidden unless CAP-ACCT-FULLGL is enabled.
          icon: 'account_balance', label: 'Accounting', i18nKey: 'navGroups.accounting',
          capability: 'CAP-ACCT-FULLGL',
          allowedRoles: ['Controller'],
          children: [
            // Data-entry surfaces first — these exist on main but were previously
            // absent from the nav, so the GL looked read-only.
            { icon: 'account_tree', label: 'Chart of Accounts', i18nKey: 'nav.chartOfAccounts', route: '/accounting/chart-of-accounts' },
            { icon: 'input', label: 'Opening Journal', i18nKey: 'nav.openingJournal', route: '/accounting/opening-journal', capability: 'CAP-ACCT-MIGRATION' },
            { icon: 'inventory', label: 'Opening Stock', i18nKey: 'nav.openingStock', route: '/accounting/opening-stock' },
            { icon: 'request_quote', label: 'Opening Receivables & Payables', i18nKey: 'nav.openingOpenItems', route: '/accounting/opening-open-items' },
            { icon: 'post_add', label: 'Journal Entries', i18nKey: 'nav.journalEntries', route: '/accounting/journal-entries/new' },
            { icon: 'fact_check', label: 'Journal Approvals', i18nKey: 'nav.journalApprovals', route: '/accounting/journal-approvals' },
            { icon: 'content_copy', label: 'Journal Templates', i18nKey: 'nav.journalTemplates', route: '/accounting/journal-templates' },
            { icon: 'menu_book', label: 'Ledger', i18nKey: 'nav.ledger', route: '/accounting/ledger' },
            // Financial statements.
            { icon: 'balance', label: 'Trial Balance', i18nKey: 'nav.trialBalance', route: '/accounting/trial-balance' },
            { icon: 'trending_up', label: 'Profit & Loss', i18nKey: 'nav.profitLoss', route: '/accounting/profit-loss' },
            { icon: 'account_balance', label: 'Balance Sheet', i18nKey: 'nav.balanceSheet', route: '/accounting/balance-sheet' },
            { icon: 'savings', label: 'Budgets', i18nKey: 'nav.budgets', route: '/accounting/budgets' },
            { icon: 'waterfall_chart', label: 'Cash Flow', i18nKey: 'nav.cashFlow', route: '/accounting/cash-flow' },
            // Sub-ledgers / aging.
            { icon: 'trending_flat', label: 'AR Aging', i18nKey: 'nav.arAging', route: '/accounting/ar-aging' },
            { icon: 'schedule', label: 'AP Aging', i18nKey: 'nav.apAging', route: '/accounting/ap-aging' },
            { icon: 'inventory_2', label: 'GRNI', i18nKey: 'nav.grni', route: '/accounting/grni' },
            { icon: 'warehouse', label: 'Inventory Valuation', i18nKey: 'nav.inventoryValuation', route: '/accounting/inventory-valuation' },
            { icon: 'precision_manufacturing', label: 'Fixed Assets', i18nKey: 'nav.fixedAssets', route: '/accounting/fixed-assets', capability: 'CAP-ACCT-DEPRECIATION' },
            { icon: 'factory', label: 'Overhead Pool', i18nKey: 'nav.overheadPool', route: '/accounting/overhead' },
            { icon: 'percent', label: 'Sales Tax Liability', i18nKey: 'nav.salesTaxLiability', route: '/accounting/sales-tax-liability' },
            { icon: 'badge', label: '1099 Report', i18nKey: 'nav.form1099', route: '/accounting/1099-report' },
            // Bank + period + export.
            { icon: 'account_balance_wallet', label: 'Bank Reconciliation', i18nKey: 'nav.bankRec', route: '/accounting/bank-rec' },
            { icon: 'receipt_long', label: 'Bank Statements', i18nKey: 'nav.bankStatements', route: '/accounting/bank-statements' },
            { icon: 'event_available', label: 'Period Close', i18nKey: 'nav.periodClose', route: '/accounting/period-close' },
            { icon: 'payments', label: 'Pay Runs', i18nKey: 'nav.payRuns', route: '/accounting/pay-runs', capability: 'CAP-PAYROLL-RUN' },
            { icon: 'currency_exchange', label: 'Exchange Rates', i18nKey: 'nav.exchangeRates', route: '/accounting/exchange-rates', capability: 'CAP-MD-CURRENCIES' },
            { icon: 'sync_alt', label: 'CPA Exports', i18nKey: 'nav.exports', route: '/accounting/exports' },
            { icon: 'school', label: 'Accounting Training', i18nKey: 'nav.accountingTraining', route: '/accounting/training' },
          ],
        },
      ],
    },

    // ── QUALITY — inspection + regulatory. Quality was previously unreachable
    // from the nav; Compliance/Watchtower moved here from the Operations bag. ──
    {
      icon: 'verified', label: 'Quality', i18nKey: 'navGroups.quality',
      children: [
        { icon: 'checklist', label: 'Quality', i18nKey: 'nav.quality', route: '/quality', capability: 'CAP-QC-INSPECTION', allowedRoles: ['Admin', 'Manager', 'Engineer'] },
        { icon: 'report', label: 'Recalls', i18nKey: 'recalls.title', route: '/quality/recalls', capability: 'CAP-QC-RECALL', allowedRoles: ['Admin', 'Manager', 'Engineer'] },
        { icon: 'rule', label: 'FMEA', i18nKey: 'nav.fmea', route: '/quality/fmea', capability: 'CAP-QC-FMEA', allowedRoles: ['Admin', 'Manager', 'Engineer'] },
        { icon: 'assignment_turned_in', label: 'PPAP', i18nKey: 'nav.ppap', route: '/quality/ppap', capability: 'CAP-QC-PPAP', allowedRoles: ['Admin', 'Manager', 'Engineer'] },
        { icon: 'description', label: 'Controlled Documents', i18nKey: 'nav.controlledDocuments', route: '/controlled-documents', capability: 'CAP-CROSS-DOCS', allowedRoles: ['Admin', 'Manager', 'Engineer', 'ComplianceOfficer'] },
        { icon: 'fact_check', label: 'Compliance', i18nKey: 'nav.compliance', route: '/compliance', capability: 'CAP-EXT-WATCHTOWER', allowedRoles: ['Admin', 'Manager', 'ComplianceOfficer', 'OfficeManager'] },
        { icon: 'radar', label: 'Watchtower', i18nKey: 'nav.watchtower', route: '/watchtower', capability: 'CAP-EXT-WATCHTOWER', allowedRoles: ['Admin', 'Manager'] },
      ],
    },

    // ── PEOPLE — HR (expenses moved to Financials). ──
    {
      icon: 'groups', label: 'People', i18nKey: 'navGroups.people',
      children: [
        { icon: 'badge', label: 'Employees', i18nKey: 'nav.employees', route: '/employees', capability: 'CAP-MD-EMPLOYEES', allowedRoles: ['Admin', 'Manager'] },
        { icon: 'schedule', label: 'Time', i18nKey: 'nav.timeTracking', route: '/time-tracking', shortcut: ['Q', 'T'], capability: 'CAP-HR-TIMETRACK' },
        { icon: 'beach_access', label: 'Leave', i18nKey: 'nav.leave', route: '/leave/mine', routePrefix: '/leave', capability: 'CAP-HR-LEAVE' },
        { icon: 'request_quote', label: 'Piece Rates', i18nKey: 'nav.pieceRates', route: '/piece-rates', capability: 'CAP-HR-PIECE-RATES', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
        { icon: 'school', label: 'Training', i18nKey: 'nav.training', route: '/training/library', routePrefix: '/training' },
        { icon: 'rate_review', label: 'Reviews', i18nKey: 'nav.reviews', route: '/reviews', routePrefix: '/reviews', capability: 'CAP-HR-REVIEW' },
      ],
    },

    // ── INSIGHTS — reporting + AI. ──
    {
      icon: 'insights', label: 'Insights', i18nKey: 'navGroups.insights',
      children: [
        { icon: 'bar_chart', label: 'Reports', i18nKey: 'nav.reports', route: '/reports', shortcut: ['Q', 'R'] },
        { icon: 'smart_toy', label: 'AI', i18nKey: 'nav.ai', route: '/ai', capability: 'CAP-EXT-AI-ASSISTANT' },
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
            { icon: 'language', label: 'UI Labels', i18nKey: 'admin.tabs.i18nLabels', route: '/admin/i18n-labels', capability: 'CAP-ADMIN-I18N', allowedRoles: ['Admin'] },
            { icon: 'g_translate', label: 'Languages', i18nKey: 'admin.tabs.languages', route: '/admin/languages', capability: 'CAP-ADMIN-I18N', allowedRoles: ['Admin'] },
            { icon: 'factory', label: 'Plants', i18nKey: 'admin.tabs.plants', route: '/admin/plants', capability: 'CAP-MD-LOCATIONS', allowedRoles: ['Admin'] },
            { icon: 'route', label: 'Track Types', i18nKey: 'admin.tabs.trackTypes', route: '/admin/track-types', allowedRoles: ['Admin'] },
            { icon: 'percent', label: 'Sales Tax', i18nKey: 'admin.tabs.salesTax', route: '/admin/sales-tax', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'calculate', label: 'Costing', i18nKey: 'admin.tabs.costing', route: '/admin/costing', capability: 'CAP-COSTING-TIER2-DEPTRATES', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'qr_code_2', label: 'GS1 / GTIN', i18nKey: 'admin.tabs.gs1', route: '/admin/gs1', capability: 'CAP-MD-GS1', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
            { icon: 'campaign', label: 'Lead Sources', i18nKey: 'admin.tabs.leadSources', route: '/admin/lead-sources', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'fact_check', label: 'ICP Rubrics', i18nKey: 'admin.tabs.icpRubrics', route: '/admin/icp-rubrics', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'alt_route', label: 'Assignment Rules', i18nKey: 'admin.tabs.assignmentRules', route: '/admin/assignment-rules', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'payments', label: 'Currencies & FX', i18nKey: 'admin.tabs.currencies', route: '/admin/currencies', allowedRoles: ['Admin'] },
            { icon: 'request_quote', label: 'Tariff Rates', i18nKey: 'admin.tabs.tariffs', route: '/admin/tariffs', allowedRoles: ['Admin'] },
            { icon: 'calendar_month', label: 'Working Calendars', i18nKey: 'admin.tabs.workingCalendars', route: '/admin/working-calendars', allowedRoles: ['Admin'] },
            { icon: 'event_note', label: 'Payment Terms', i18nKey: 'admin.tabs.paymentTerms', route: '/admin/payment-terms', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
            { icon: 'gavel', label: 'Terms & Conditions', i18nKey: 'admin.tabs.terms', route: '/admin/terms', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
          ],
        },
        {
          icon: 'hub', label: 'Integrations', i18nKey: 'adminGroups.integrations',
          children: [
            { icon: 'hub', label: 'Integrations', i18nKey: 'admin.tabs.integrations', route: '/admin/integrations', allowedRoles: ['Admin'] },
            { icon: 'swap_horiz', label: 'EDI', i18nKey: 'admin.tabs.edi', route: '/admin/edi', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'outbox', label: 'Integration Outbox', i18nKey: 'admin.tabs.integrationOutbox', route: '/admin/integration-outbox', allowedRoles: ['Admin'] },
            { icon: 'smart_toy', label: 'AI Assistants', i18nKey: 'admin.tabs.aiAssistants', route: '/admin/ai-assistants', allowedRoles: ['Admin'] },
            { icon: 'auto_awesome', label: 'Auto-PO', i18nKey: 'admin.tabs.autoPo', route: '/admin/auto-po', allowedRoles: ['Admin'] },
            { icon: 'local_shipping', label: 'Carriers', i18nKey: 'admin.tabs.carriers', route: '/admin/carriers', capability: 'CAP-O2C-SHIP', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
            { icon: 'webhook', label: 'Webhooks', i18nKey: 'admin.tabs.webhooks', route: '/admin/webhooks', capability: 'CAP-CROSS-WEBHOOKS', allowedRoles: ['Admin'] },
            { icon: 'cloud', label: 'Cloud Storage', i18nKey: 'admin.tabs.cloudStorage', route: '/admin/cloud-storage', capability: 'CAP-EXT-CLOUD-STORAGE', allowedRoles: ['Admin'] },
            { icon: 'manage_search', label: 'AI Search Index', i18nKey: 'admin.tabs.aiIndex', route: '/admin/ai-index', capability: 'CAP-EXT-AI-ASSISTANT', allowedRoles: ['Admin'] },
            { icon: 'sensors', label: 'Machine Connections', i18nKey: 'admin.tabs.machineConnections', route: '/admin/machine-connections', capability: 'CAP-MFG-MACHINE-CONNECT', allowedRoles: ['Admin', 'Manager'] },
          ],
        },
        {
          icon: 'auto_fix_high', label: 'Workflow', i18nKey: 'adminGroups.workflow',
          children: [
            { icon: 'auto_fix_high', label: 'Automations', i18nKey: 'admin.tabs.automations', route: '/admin/automations', allowedRoles: ['Admin'] },
            { icon: 'event', label: 'Events', i18nKey: 'admin.tabs.events', route: '/admin/events', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'event_repeat', label: 'Scheduled Tasks', i18nKey: 'admin.tabs.scheduledTasks', route: '/admin/scheduled-tasks', allowedRoles: ['Admin'] },
            { icon: 'campaign', label: 'Announcements', i18nKey: 'admin.tabs.announcements', route: '/admin/announcements', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'school', label: 'Training', i18nKey: 'admin.tabs.training', route: '/admin/training', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'fact_check', label: 'Compliance', i18nKey: 'admin.tabs.compliance', route: '/admin/compliance', capability: 'CAP-QC-COMPLIANCE-FORMS', allowedRoles: ['Admin', 'Manager', 'OfficeManager'] },
            { icon: 'receipt_long', label: 'Expense Policy', i18nKey: 'admin.tabs.expenses', route: '/admin/expenses', allowedRoles: ['Admin'] },
            { icon: 'policy', label: 'Leave Policies', i18nKey: 'admin.tabs.leavePolicies', route: '/leave/policies', capability: 'CAP-HR-LEAVE', allowedRoles: ['Admin'] },
            { icon: 'account_balance', label: 'Banking', i18nKey: 'admin.tabs.banking', route: '/admin/banking', allowedRoles: ['Admin'] },
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
            { icon: 'qr_code_scanner', label: 'Scanners', i18nKey: 'admin.tabs.scanners', route: '/admin/scanners', capability: 'CAP-MFG-SHOPFLOOR', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'edit_note', label: 'Time Corrections', i18nKey: 'admin.tabs.timeCorrections', route: '/admin/time-corrections', allowedRoles: ['Admin', 'Manager'] },
            { icon: 'system_update_alt', label: 'Updates', i18nKey: 'admin.tabs.updates', route: '/admin/updates', allowedRoles: ['Admin'] },
            { icon: 'storage', label: 'Database Transfer', i18nKey: 'admin.tabs.database', route: '/admin/database', allowedRoles: ['Admin'] },
          ],
        },
      ],
    },
  ];

  readonly pinnedTopTree: Signal<NavItem[]> = computed(() => this.filterTree(this.allPinnedTopTree));
  readonly mainTree: Signal<NavItem[]> = computed(() => this.filterTree(this.allMainTree));
  readonly bottomTree: Signal<NavItem[]> = computed(() => this.filterTree(this.allBottomTree));

  /**
   * Every navigable leaf the current user is allowed to see, flattened with
   * its ancestor-group trail. Feeds the header search so pages (Watchtower,
   * Bulk Intake, …) are findable via Ctrl+K, not just data entities. Built
   * from the filtered trees, so capability gates and role checks apply.
   */
  readonly flatLeaves: Signal<NavLeaf[]> = computed(() => {
    const collect = (items: NavItem[], trail: string[]): NavLeaf[] =>
      items.flatMap(item => {
        if (item.children?.length) {
          return collect(item.children, [...trail, item.i18nKey ?? item.label]);
        }
        return item.route
          ? [{ icon: item.icon, label: item.label, i18nKey: item.i18nKey, route: item.route, trailKeys: trail }]
          : [];
      });
    return [
      ...collect(this.pinnedTopTree(), []),
      ...collect(this.mainTree(), []),
      ...collect(this.bottomTree(), []),
    ];
  });

  /**
   * Route of the nav leaf that owns the current URL: the longest leaf route
   * equal to the URL or a path prefix of it. The sidebar highlights only this
   * leaf, so `/sequences/instances` lights Instances but not Definitions
   * (`/sequences`), while `/sequences/new` still lights Definitions.
   */
  readonly activeLeafRoute: Signal<string | null> = computed(() => {
    const url = this.currentUrl().split('#')[0];
    return this.flatLeaves()
      .map(leaf => leaf.route)
      .filter(route => url === route || url.startsWith(route + '/'))
      .reduce<string | null>((best, route) => (best === null || route.length > best.length ? route : best), null);
  });

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
    if (trail.length === 0) {
      const key = this.routeBreadcrumbKey();
      return key ? [{ icon: '', label: key, i18nKey: key }] : [];
    }
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
   * Name of the record the current page shows (a customer, an employee, …),
   * rendered by the header as the final breadcrumb. Only reported while the
   * URL stays under the prefix it was set for, so it disappears as soon as
   * the user navigates away from that record.
   */
  readonly recordCrumb: Signal<string | null> = computed(() => {
    const state = this.recordCrumbState();
    return state && this.urlMatchesPrefix(this.currentUrl(), state.urlPrefix) ? state.label : null;
  });

  /** Names the record shown under `urlPrefix` (e.g. `/customers/12`) for the header breadcrumb. */
  setRecordCrumb(label: string, urlPrefix: string): void {
    this.recordCrumbState.set(label ? { label, urlPrefix } : null);
  }

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

  /**
   * Whether the current user can open `route` (or a screen under it) from the
   * navigation. Capability gates apply only when `includeCapabilities` is true,
   * because the capability snapshot may not be loaded yet right after sign-in;
   * a gated screen then falls back through its route guard.
   */
  canReach(route: string, includeCapabilities = true): boolean {
    const matches = (candidate?: string) => !!candidate && (candidate === route || candidate.startsWith(`${route}/`));
    const walk = (items: NavItem[]): boolean => items.some(item => {
      if (includeCapabilities && !this.isCapabilityAllowed(item)) return false;
      if (item.allowedRoles && !this.auth.hasAnyRole(item.allowedRoles)) return false;
      return item.children?.length ? walk(item.children) : matches(item.route);
    });
    return walk([...this.allPinnedTopTree, ...this.allMainTree, ...this.allBottomTree]);
  }

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
    if (!this.isCapabilityAllowed(item)) return false;
    if (!item.allowedRoles) return true;
    return this.auth.hasAnyRole(item.allowedRoles);
  }

  private isCapabilityAllowed(item: NavItem): boolean {
    if (item.capability && !this.capabilities.isEnabled(item.capability)) return false;
    if (item.anyCapabilities?.length && !item.anyCapabilities.some(code => this.capabilities.isEnabled(code))) return false;
    return !(item.hiddenWithCapability && this.capabilities.isEnabled(item.hiddenWithCapability));
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
      } else if (item.route && (item.route === url || url.startsWith(item.route + '/')
        || (item.routePrefix && this.urlMatchesPrefix(url, item.routePrefix)))) {
        return [item];
      }
    }
    return [];
  }

  private urlMatchesPrefix(url: string, prefix: string): boolean {
    return url === prefix || url.startsWith(prefix + '/');
  }

  private deepestRouteBreadcrumb(): string | null {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let key: string | null = null;
    while (route) {
      const crumb = route.data['titleKey'];
      if (typeof crumb === 'string') key = crumb;
      route = route.firstChild;
    }
    return key;
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
