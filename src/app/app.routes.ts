import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { authGuard } from './shared/guards/auth.guard';
import { instanceGuard } from './shared/guards/instance.guard';
import { shellAuthGuard } from './shared/guards/shell-auth.guard';
import { capabilityGuard } from './shared/guards/capability.guard';
import { demoOnlyGuard } from './shared/guards/demo-only.guard';
import { mobileRedirectGuard } from './shared/guards/mobile-redirect.guard';
import { roleGuard } from './shared/guards/role.guard';
import { rootRedirectGuard } from './shared/guards/root-redirect.guard';
import { setupRequiredGuard, setupCompleteGuard } from './shared/guards/setup.guard';
import { portalTerminologyGuard } from './features/portal/services/portal-terminology.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [setupCompleteGuard], component: LoginComponent, data: { titleKey: 'routeTitles.login' } },
  { path: 'sso/callback', loadComponent: () => import('./features/auth/sso-callback.component').then(m => m.SsoCallbackComponent), data: { titleKey: 'routeTitles.ssoCallback' } },
  {
    path: 'welcome',
    data: { titleKey: 'routeTitles.welcome' },
    canActivate: [demoOnlyGuard],
    loadComponent: () => import('./features/welcome/welcome.component').then(m => m.WelcomeComponent),
  },
  // Lazy: the first-run wizard is reachable exactly once in an install's life, and
  // the token flow only from an invite link — neither belongs in the bundle every
  // user downloads on every visit. Login stays eager; it IS the common first paint,
  // and deferring it would trade bundle size for a round trip on the hot path.
  {
    path: 'setup',
    data: { titleKey: 'routeTitles.setup' },
    canActivate: [setupRequiredGuard],
    loadComponent: () => import('./features/auth/setup.component').then((m) => m.SetupComponent),
  },
  // Phase 1m.7 — post-first-admin integration setup wizard. Shown
  // after the first admin completes initial account setup; walks
  // through optional integrations with "Set up" / "Skip" choices per
  // card. Auth-gated; admin-only is enforced inside the component.
  {
    path: 'setup/integrations',
    data: { titleKey: 'setupIntegrations.title' },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/setup-integrations/setup-integrations.component')
        .then(m => m.SetupIntegrationsComponent),
  },
  {
    path: 'setup/:token',
    data: { titleKey: 'routeTitles.tokenSetup' },
    loadComponent: () => import('./features/auth/token-setup.component').then((m) => m.TokenSetupComponent),
  },
  // Phase 1q — customer portal lives outside the employee app shell. Has
  // its own auth flow (passwordless magic link) and its own layout (no
  // sidebar, distinct chrome). Routes are reachable without an employee
  // session and have no role guard.
  {
    path: 'portal',
    canActivate: [portalTerminologyGuard],
    loadChildren: () => import('./features/portal/portal.routes').then(m => m.PORTAL_ROUTES),
  },
  // Anonymous customer acceptance page (CAP-O2C-SO-ACCEPTANCE). Reached from
  // an emailed link; lives OUTSIDE the auth-guarded shell so an unauthenticated
  // customer can review the order and accept it. The public endpoints carry no
  // employee token and are not gated by the capability interceptor.
  {
    path: 'accept/:token',
    data: { titleKey: 'routeTitles.acceptOrder' },
    loadComponent: () =>
      import('./features/sales-orders/pages/public-acceptance/public-acceptance.component')
        .then(m => m.PublicAcceptanceComponent),
  },
  {
    path: 'chat/popout',
    data: { titleKey: 'chat.title' },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/chat/components/chat-popout/chat-popout.component').then(m => m.ChatPopoutComponent),
  },
  // Root branches on build target before authGuard runs so the demo's /welcome
  // page is reachable without login. In prod, the guard returns /dashboard and
  // the authGuard shell below takes over — same behavior as before.
  { path: '', pathMatch: 'full', canActivate: [rootRedirectGuard], children: [] },
  {
    path: '',
    canActivate: [authGuard, mobileRedirectGuard],
    children: [
      // Sidebar nav groups (Operations / Sales / Production / People / Insights)
      // are accordion headers, not routes. Typing their name as a URL used to
      // render blank; redirect each to its default sub-page so deep links and
      // address-bar guesses land somewhere sensible. (Inventory + Purchasing
      // already resolve to real leaf routes of the same name.)
      { path: 'operations', redirectTo: 'kanban', pathMatch: 'full' },
      { path: 'board', redirectTo: 'kanban', pathMatch: 'full' },
      { path: 'sales', redirectTo: 'customers', pathMatch: 'full' },
      { path: 'production', redirectTo: 'parts', pathMatch: 'full' },
      { path: 'people', redirectTo: 'employees', pathMatch: 'full' },
      { path: 'insights', redirectTo: 'reports', pathMatch: 'full' },
      {
        path: 'dashboard',
        data: { titleKey: 'nav.dashboard' },
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'kanban',
        data: { titleKey: 'nav.kanban' },
        loadChildren: () =>
          import('./features/kanban/kanban.routes').then((m) => m.KANBAN_ROUTES),
      },
      {
        path: 'backlog',
        data: { titleKey: 'nav.backlog' },
        loadChildren: () =>
          import('./features/backlog/backlog.routes').then((m) => m.BACKLOG_ROUTES),
      },
      {
        path: 'calendar',
        data: { titleKey: 'nav.calendar' },
        loadChildren: () =>
          import('./features/calendar/calendar.routes').then((m) => m.CALENDAR_ROUTES),
      },
      {
        path: 'parts',
        data: { titleKey: 'nav.parts' },
        canActivate: [roleGuard('Admin', 'Manager', 'Engineer', 'PM')],
        loadChildren: () =>
          import('./features/parts/parts.routes').then((m) => m.PARTS_ROUTES),
      },
      {
        path: 'costing',
        data: { titleKey: 'nav.costing' },
        canActivate: [roleGuard('Admin', 'Manager')],
        loadChildren: () =>
          import('./features/costing/costing.routes').then((m) => m.COSTING_ROUTES),
      },
      {
        // Gated Sequence Engine — dark by default (CAP-CROSS-SEQUENCES), so the
        // whole area is unreachable by URL until the capability is enabled.
        path: 'sequences',
        data: { titleKey: 'nav.sequences' },
        canActivate: [roleGuard('Admin', 'Manager'), capabilityGuard('CAP-CROSS-SEQUENCES')],
        loadChildren: () =>
          import('./features/sequences/sequences.routes').then((m) => m.SEQUENCES_ROUTES),
      },
      {
        path: 'compliance',
        data: { titleKey: 'nav.compliance' },
        canActivate: [roleGuard('Admin', 'Manager', 'ComplianceOfficer', 'OfficeManager'), capabilityGuard('CAP-EXT-WATCHTOWER')],
        loadChildren: () =>
          import('./features/compliance/compliance.routes').then((m) => m.COMPLIANCE_ROUTES),
      },
      {
        path: 'watchtower',
        data: { titleKey: 'nav.watchtower' },
        canActivate: [roleGuard('Admin', 'Manager'), capabilityGuard('CAP-EXT-WATCHTOWER')],
        loadChildren: () =>
          import('./features/watchtower/watchtower.routes').then((m) => m.WATCHTOWER_ROUTES),
      },
      {
        path: 'shipping',
        data: { titleKey: 'nav.shipping' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager'), capabilityGuard('CAP-O2C-SHIP')],
        loadChildren: () =>
          import('./features/shipping/shipping.routes').then((m) => m.SHIPPING_ROUTES),
      },
      {
        path: 'inventory',
        data: { titleKey: 'nav.inventory' },
        canActivate: [roleGuard('Admin', 'Manager', 'Engineer', 'OfficeManager')],
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
      },
      {
        path: 'customers',
        data: { titleKey: 'nav.customers' },
        canActivate: [roleGuard('Admin', 'Manager', 'PM', 'OfficeManager')],
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
      },
      {
        // Proof-of-intent review: an inbound message beside the draft it
        // proposes. The only path from an email to an order runs through here.
        path: 'communications',
        data: { titleKey: 'review.title' },
        canActivate: [roleGuard('Admin', 'Manager', 'PM', 'OfficeManager')],
        loadChildren: () =>
          import('./features/communications/communications.routes').then(
            (m) => m.COMMUNICATIONS_ROUTES,
          ),
      },
      {
        // Sales channels — the retail / marketplace lane. Gated on
        // CAP-O2C-CHANNELS, which ships default-ON and is behaviour-neutral on
        // its own; the retail-specific sub-routes carry their own guards.
        path: 'sales-channels',
        data: { titleKey: 'nav.salesChannels' },
        canActivate: [
          roleGuard('Admin', 'Manager', 'PM', 'OfficeManager'),
          capabilityGuard('CAP-O2C-CHANNELS'),
        ],
        loadChildren: () =>
          import('./features/sales-channels/sales-channels.routes').then(
            (m) => m.SALES_CHANNELS_ROUTES,
          ),
      },
      {
        path: 'leads',
        data: { titleKey: 'nav.leads' },
        canActivate: [roleGuard('Admin', 'Manager', 'PM')],
        loadChildren: () =>
          import('./features/leads/leads.routes').then((m) => m.LEADS_ROUTES),
      },
      {
        path: 'expenses',
        data: { titleKey: 'nav.expenses' },
        canActivate: [roleGuard('Admin', 'Manager', 'Engineer', 'OfficeManager')],
        loadChildren: () =>
          import('./features/expenses/expenses.routes').then((m) => m.EXPENSES_ROUTES),
      },
      {
        path: 'accounting/opening-journal',
        data: { titleKey: 'nav.openingJournal' },
        canActivate: [roleGuard('Controller'), capabilityGuard('CAP-ACCT-MIGRATION')],
        loadComponent: () =>
          import('./features/accounting/components/opening-journal/opening-journal.component').then((m) => m.OpeningJournalComponent),
      },
      {
        // GL accounting suite — gated by CAP-ACCT-GL-VIEW (the read-only view surface) so the
        // ledger/statements stay reachable read-only when a book is deactivated (FULLGL off,
        // GL-VIEW on). Write screens (journal-entries/new) add a CAP-ACCT-FULLGL guard below.
        // until the capability is switched on (mirrors the server-side gate).
        path: 'accounting',
        data: { titleKey: 'navGroups.accounting' },
        canActivate: [roleGuard('Controller'), capabilityGuard('CAP-ACCT-GL-VIEW')],
        loadChildren: () =>
          import('./features/accounting/accounting.routes').then((m) => m.ACCOUNTING_ROUTES),
      },
      {
        path: 'assets',
        data: { titleKey: 'nav.assets' },
        canActivate: [roleGuard('Admin', 'Manager', 'Engineer')],
        loadChildren: () =>
          import('./features/assets/assets.routes').then((m) => m.ASSETS_ROUTES),
      },
      {
        path: 'maintenance',
        data: { titleKey: 'nav.maintenance' },
        canActivate: [roleGuard('Admin', 'Manager')],
        loadChildren: () =>
          import('./features/maintenance/maintenance.routes').then((m) => m.MAINTENANCE_ROUTES),
      },
      {
        path: 'time-tracking',
        data: { titleKey: 'timeTracking.title' },
        loadChildren: () =>
          import('./features/time-tracking/time-tracking.routes').then((m) => m.TIME_TRACKING_ROUTES),
      },
      {
        path: 'piece-rates',
        data: { titleKey: 'nav.pieceRates' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager'), capabilityGuard('CAP-HR-PIECE-RATES')],
        loadComponent: () =>
          import('./features/piece-rates/piece-rates.component').then((m) => m.PieceRatesComponent),
      },
      {
        path: 'employees',
        data: { titleKey: 'nav.employees' },
        canActivate: [roleGuard('Admin', 'Manager')],
        loadChildren: () =>
          import('./features/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES),
      },
      {
        path: 'reports',
        data: { titleKey: 'nav.reports' },
        loadChildren: () =>
          import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'planning',
        data: { titleKey: 'nav.planning' },
        canActivate: [roleGuard('Admin', 'Manager', 'PM')],
        loadChildren: () =>
          import('./features/planning/planning.routes').then((m) => m.PLANNING_ROUTES),
      },
      {
        path: 'vendors',
        data: { titleKey: 'nav.vendors' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager', 'Procurement')],
        loadChildren: () =>
          import('./features/vendors/vendors.routes').then((m) => m.VENDORS_ROUTES),
      },
      {
        path: 'purchasing',
        data: { titleKey: 'nav.purchasing' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager', 'Procurement')],
        loadChildren: () =>
          import('./features/purchasing/purchasing.routes').then((m) => m.PURCHASING_ROUTES),
      },
      {
        path: 'purchase-orders',
        data: { titleKey: 'nav.purchaseOrders' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager', 'Procurement')],
        loadChildren: () =>
          import('./features/purchase-orders/purchase-orders.routes').then((m) => m.PURCHASE_ORDERS_ROUTES),
      },
      {
        path: 'sales-orders',
        data: { titleKey: 'nav.salesOrders' },
        canActivate: [roleGuard('Admin', 'Manager', 'PM', 'OfficeManager')],
        loadChildren: () =>
          import('./features/sales-orders/sales-orders.routes').then((m) => m.SALES_ORDERS_ROUTES),
      },
      {
        path: 'quotes',
        data: { titleKey: 'nav.quotes' },
        canActivate: [roleGuard('Admin', 'Manager', 'PM', 'OfficeManager')],
        loadChildren: () =>
          import('./features/quotes/quotes.routes').then((m) => m.QUOTES_ROUTES),
      },
      {
        path: 'shipments',
        data: { titleKey: 'nav.shipments' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager')],
        loadChildren: () =>
          import('./features/shipments/shipments.routes').then((m) => m.SHIPMENTS_ROUTES),
      },
      {
        path: 'invoices',
        data: { titleKey: 'nav.invoices' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager')],
        loadChildren: () =>
          import('./features/invoices/invoices.routes').then((m) => m.INVOICES_ROUTES),
      },
      {
        path: 'payments',
        data: { titleKey: 'nav.payments' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager')],
        loadChildren: () =>
          import('./features/payments/payments.routes').then((m) => m.PAYMENTS_ROUTES),
      },
      {
        // AP Payables (vendor bills + vendor payments) — gated on the same
        // CAP-P2P-BILL capability as the server-side VendorBillsController
        // (split from CAP-P2P-PO; vendor payments ride CAP-P2P-PAY, which
        // depends on CAP-P2P-BILL).
        path: 'payables',
        data: { titleKey: 'nav.payables' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager', 'Procurement', 'Controller'), capabilityGuard('CAP-P2P-BILL')],
        loadChildren: () =>
          import('./features/payables/payables.routes').then((m) => m.PAYABLES_ROUTES),
      },
      {
        path: 'notifications',
        data: { titleKey: 'notifications.title' },
        loadChildren: () =>
          import('./features/notifications/notifications.routes').then((m) => m.NOTIFICATION_ROUTES),
      },
      {
        path: 'worker',
        data: { titleKey: 'nav.worker' },
        loadChildren: () =>
          import('./features/worker/worker.routes').then((m) => m.WORKER_ROUTES),
      },
      {
        path: 'approvals',
        data: { titleKey: 'nav.approvals' },
        canActivate: [roleGuard('Admin', 'Manager', 'PM', 'OfficeManager')],
        loadChildren: () =>
          import('./features/approvals/approvals.routes').then((m) => m.APPROVALS_ROUTES),
      },
      {
        path: 'quality',
        data: { titleKey: 'nav.quality' },
        canActivate: [roleGuard('Admin', 'Manager', 'Engineer')],
        loadChildren: () =>
          import('./features/quality/quality.routes').then((m) => m.QUALITY_ROUTES),
      },
      {
        path: 'customer-returns',
        data: { titleKey: 'nav.customerReturns' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager')],
        loadChildren: () =>
          import('./features/customer-returns/customer-returns.routes').then((m) => m.CUSTOMER_RETURNS_ROUTES),
      },
      {
        path: 'lots',
        data: { titleKey: 'nav.lots' },
        canActivate: [roleGuard('Admin', 'Manager', 'Engineer')],
        loadChildren: () =>
          import('./features/lots/lots.routes').then((m) => m.LOTS_ROUTES),
      },
      {
        path: 'account',
        data: { titleKey: 'account.title' },
        loadChildren: () =>
          import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES),
      },
      {
        path: 'onboarding',
        data: { titleKey: 'onboarding.title' },
        loadChildren: () =>
          import('./features/onboarding/onboarding.routes').then((m) => m.ONBOARDING_ROUTES),
      },
      {
        path: 'training',
        data: { titleKey: 'nav.training' },
        loadChildren: () =>
          import('./features/training/training.routes').then((m) => m.TRAINING_ROUTES),
      },
      {
        path: 'ai',
        data: { titleKey: 'nav.ai' },
        loadChildren: () =>
          import('./features/ai/ai.routes').then((m) => m.AI_ROUTES),
      },
      {
        path: 'mrp',
        data: { titleKey: 'nav.mrp' },
        canActivate: [roleGuard('Admin', 'Manager')],
        loadChildren: () =>
          import('./features/mrp/mrp.routes').then((m) => m.MRP_ROUTES),
      },
      {
        path: 'oee',
        data: { titleKey: 'nav.oee' },
        canActivate: [roleGuard('Admin', 'Manager')],
        loadChildren: () =>
          import('./features/oee/oee.routes').then((m) => m.OEE_ROUTES),
      },
      {
        path: 'scheduling',
        data: { titleKey: 'nav.scheduling' },
        canActivate: [roleGuard('Admin', 'Manager')],
        loadChildren: () =>
          import('./features/scheduling/scheduling.routes').then((m) => m.SCHEDULING_ROUTES),
      },
      {
        path: 'chat',
        data: { titleKey: 'chat.title' },
        loadChildren: () =>
          import('./features/chat/chat.routes').then((m) => m.CHAT_ROUTES),
      },
      {
        path: 'admin',
        data: { titleKey: 'nav.admin' },
        canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager')],
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        // Workflow Pattern Phase 4 — demo route, no role gating (any
        // authenticated user can poke at the shell). Phase 5+ wires
        // per-entity workflow surfaces into their own routes.
        path: 'workflow-shell-demo',
        data: { titleKey: 'routeTitles.workflowDemo' },
        loadComponent: () =>
          import('./features/workflow-demo/workflow-shell-demo.component')
            .then(m => m.WorkflowShellDemoComponent),
      },
    ],
  },
  {
    path: 'm',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/mobile/mobile.routes').then((m) => m.MOBILE_ROUTES),
  },
  {
    path: 'app/enroll',
    data: { titleKey: 'routeTitles.enroll' },
    loadChildren: () =>
      import('./features/mobile-app/enroll/enroll.routes').then((m) => m.ENROLL_ROUTES),
  },
  {
    path: 'app',
    canActivate: [instanceGuard, shellAuthGuard],
    loadChildren: () =>
      import('./features/mobile-app/mobile-app.routes').then((m) => m.MOBILE_APP_ROUTES),
  },
  {
    path: 'display/shop-floor',
    data: { titleKey: 'shopFloor.title' },
    loadChildren: () =>
      import('./features/shop-floor/shop-floor.routes').then((m) => m.SHOP_FLOOR_ROUTES),
  },
  {
    path: 'dev-tools',
    data: { titleKey: 'routeTitles.devTools' },
    loadChildren: () =>
      import('./features/dev-tools/dev-tools.routes').then((m) => m.DEV_TOOLS_ROUTES),
  },
  {
    path: '__render-form',
    data: { titleKey: 'routeTitles.renderForm' },
    loadChildren: () =>
      import('./features/render/render.routes').then((m) => m.RENDER_ROUTES),
  },
  // Catch-all — an unknown URL previously rendered a blank shell (no route
  // matched). Send it back through the role-aware root redirect instead of
  // leaving the user staring at an empty page.
  { path: '**', redirectTo: '' },
];
