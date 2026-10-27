import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AdminComponent } from './admin.component';
import { capabilityGuard } from '../../shared/guards/capability.guard';
import { roleGuard } from '../../shared/guards/role.guard';
import { tabGuard } from '../../shared/guards/tab.guard';
import { AuthService } from '../../shared/services/auth.service';
import { ADMIN_TAB_ROLES } from './models/admin-tab-roles.model';
import { ADMIN_TABS } from './models/admin-tab.model';

export const ADMIN_ROUTES: Routes = [
  // Admin Overview is the landing surface for /admin. Previously redirected
  // to /admin/users which forced the people-management page to act as both
  // entry point and full-screen task page even when the admin was here to
  // do something else. Overview is a launchpad — people / capabilities /
  // integrations / recent audit — that deep-links into the relevant tab.
  { path: '', redirectTo: () => adminDefaultTab(), pathMatch: 'full' },
  // Phase 4 Phase-A — diagnostic page that renders the loaded capability descriptor.
  // Listed before the catch-all `:tab` route so it wins. Phase C added the
  // working `/admin/capabilities` page below; the debug page stays as a
  // diagnostic and will be replaced/folded into Phase E's full admin UI.
  {
    path: 'capabilities-debug',
    data: { titleKey: 'admin.tabs.capabilities' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./capabilities-debug/capabilities-debug.component').then((m) => m.CapabilitiesDebugComponent),
  },
  // Phase 4 Phase-E — full admin capability management surface (replaces
  // Phase C minimum). List page at `/admin/capabilities`; per-capability
  // detail page at `/admin/capabilities/:id`. Detail route MUST be listed
  // before the `:tab` catch-all so the AdminComponent doesn't intercept the
  // capability code as a tab name. Both lazy-loaded.
  // Self-service upgrade. Before the `:tab` catch-all so it is not read as a
  // tab name. Admin-only via [Authorize(Roles="Admin")] on the API; the screen
  // itself degrades to "no agent on this box" where upgrades are not local.
  {
    path: 'updates',
    data: { titleKey: 'admin.tabs.updates' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./updates/updates.component').then((m) => m.UpdatesComponent),
  },
  {
    path: 'capabilities',
    data: { titleKey: 'admin.tabs.capabilities' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./capabilities/capabilities.component').then((m) => m.CapabilitiesComponent),
  },
  {
    path: 'capabilities/:id',
    data: { titleKey: 'admin.tabs.capabilities' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./capability-detail/capability-detail.component').then(
        (m) => m.CapabilityDetailComponent,
      ),
  },
  // Phase 4 Phase-F — discovery wizard. Lazy-loaded; admin-only via the
  // server's [Authorize(Roles="Admin")] on the API endpoints. Routed before
  // the `:tab` catch-all so AdminComponent doesn't intercept it.
  {
    path: 'discovery',
    data: { titleKey: 'admin.tabs.discovery' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./discovery/discovery.component').then((m) => m.DiscoveryComponent),
  },
  // Phase 4 Phase-G — preset browser + apply. Lazy-loaded admin-only routes.
  // Specific routes (compare, custom) listed BEFORE the :id catch-all so
  // their literal segments win over the dynamic route.
  {
    path: 'presets',
    data: { titleKey: 'admin.tabs.presets' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./presets/preset-browser/preset-browser.component').then((m) => m.PresetBrowserComponent),
  },
  {
    path: 'presets/compare',
    data: { titleKey: 'admin.tabs.presets' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./presets/preset-compare/preset-compare.component').then((m) => m.PresetCompareComponent),
  },
  {
    path: 'presets/custom',
    data: { titleKey: 'admin.tabs.presets' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./presets/preset-custom/preset-custom.component').then((m) => m.PresetCustomComponent),
  },
  {
    path: 'presets/:id',
    data: { titleKey: 'admin.tabs.presets' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./presets/preset-detail/preset-detail.component').then((m) => m.PresetDetailComponent),
  },
  // Phase-4 entity-completeness — admin CRUD over the requirement-row catalog
  // that drives the per-entity completeness chip + badge. Routed before the
  // `:tab` catch-all so AdminComponent doesn't intercept the literal segment.
  {
    path: 'entity-completeness',
    data: { titleKey: 'admin.tabs.entityCompleteness' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./entity-completeness/entity-completeness-admin.component').then(
        (m) => m.EntityCompletenessAdminComponent,
      ),
  },
  // Bought-parts effort PR1 — working calendars + holidays. Drives every
  // business-day calculation in the system. Tenant-default + per-CompanyLocation
  // override; resolution at runtime via IWorkingCalendarService server-side.
  {
    path: 'working-calendars',
    data: { titleKey: 'workingCalendars.title' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./working-calendars/working-calendars.component').then(
        (m) => m.WorkingCalendarsComponent,
      ),
  },
  // Bought-parts effort PR4 — TariffRate admin page. Admin imports HTS-code
  // tariffs that feed the landed-cost duty component on the part Cost tab.
  {
    path: 'tariffs',
    data: { titleKey: 'admin.tariffs.title' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./tariffs/tariffs.component').then((m) => m.TariffsComponent),
  },
  // Phase 1r / Batch 9 — LeadSource admin. Admin-managed catalog of formal
  // lead sources (replaces the legacy free-text Lead.Source field). Quality
  // score is owned by the nightly recompute job — admin manages name +
  // description + active flag.
  {
    path: 'lead-sources',
    data: { titleKey: 'admin.tabs.leadSources' },
    canActivate: [roleGuard('Admin', 'Manager')],
    loadComponent: () =>
      import('./lead-sources/lead-sources.component').then((m) => m.LeadSourcesComponent),
  },
  // Phase 1r / Batch 10 — ICP rubric admin. Admins define the scoring
  // scheme + dimensions used by the nightly LeadScore recompute job.
  {
    path: 'icp-rubrics',
    data: { titleKey: 'admin.tabs.icpRubrics' },
    canActivate: [roleGuard('Admin', 'Manager')],
    loadComponent: () =>
      import('./icp-rubrics/icp-rubrics.component').then((m) => m.IcpRubricsComponent),
  },
  // Phase 1r / Batch 11 — lead assignment rules. Admin-configured priority-
  // ordered rules that route incoming leads to reps (round-robin / territory
  // / industry / account-based).
  {
    path: 'assignment-rules',
    data: { titleKey: 'admin.tabs.assignmentRules' },
    canActivate: [roleGuard('Admin', 'Manager')],
    loadComponent: () =>
      import('./assignment-rules/assignment-rules.component').then((m) => m.AssignmentRulesComponent),
  },
  // Multi-currency admin — currencies catalog + per-day FX rates.
  {
    path: 'currencies',
    data: { titleKey: 'admin.tabs.currencies' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./currencies/currencies.component').then((m) => m.CurrenciesComponent),
  },
  // Shipping carriers — list carriers, create custom shippers, and enter per-carrier API
  // credentials (encrypted, write-only). Routed before the `:tab` catch-all.
  {
    path: 'carriers',
    data: { titleKey: 'admin.tabs.carriers' },
    loadComponent: () =>
      import('./carriers/carriers.component').then((m) => m.CarriersComponent),
  },
  {
    path: 'payment-terms',
    data: { titleKey: 'admin.tabs.paymentTerms' },
    canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager')],
    loadComponent: () =>
      import('./payment-terms/payment-terms-admin.component').then((m) => m.PaymentTermsAdminComponent),
  },
  // S3 — Terms & Conditions admin. Company-scope T&Cs plus a scope filter to
  // browse/manage customer- and part-scoped terms. Company mutations are
  // Admin-only (server-enforced + gated in-page). Lives in the terms feature.
  {
    path: 'terms',
    data: { titleKey: 'admin.tabs.terms' },
    loadComponent: () =>
      import('../terms/admin/terms-admin.component').then((m) => m.TermsAdminComponent),
  },
  // Costing Tier 2 — departmental cost rates. Switches the active costing profile
  // to per-work-center overhead percentages of direct labor. Gated by
  // CAP-COSTING-TIER2-DEPTRATES (route guard) + Admin/Manager on the server.
  {
    path: 'costing',
    data: { titleKey: 'admin.tabs.costing' },
    canActivate: [roleGuard('Admin', 'Manager'), capabilityGuard('CAP-COSTING-TIER2-DEPTRATES')],
    loadComponent: () =>
      import('./costing/costing.component').then((m) => m.CostingComponent),
  },
  // GS1 GTIN barcode identity — optional. Company-prefix settings that let
  // parts be assigned globally-unique GTINs for retail / marketplace channels.
  // Off by default; gated by CAP-MD-GS1 (route guard) + Admin/Manager/OfficeManager
  // (save Admin-only) on the server. Routed before the `:tab` catch-all so the literal segment wins.
  {
    path: 'gs1',
    data: { titleKey: 'admin.tabs.gs1' },
    canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager'), capabilityGuard('CAP-MD-GS1')],
    loadComponent: () =>
      import('./gs1/gs1.component').then((m) => m.Gs1Component),
  },
  // Admin i18n — tenant UI-label overrides editor. Lists every shipped catalog
  // key with base vs. customized value per language; edits are stored in the
  // DB and merged over the shipped JSON at load time (I18nOverridesService),
  // with machine-translation fan-out to the other configured languages.
  // Gated by CAP-ADMIN-I18N (route guard) + Admin on the server.
  {
    path: 'i18n-labels',
    data: { titleKey: 'admin.tabs.i18nLabels' },
    canActivate: [roleGuard('Admin'), capabilityGuard('CAP-ADMIN-I18N')],
    loadComponent: () =>
      import('./i18n-labels/i18n-labels.component').then((m) => m.I18nLabelsComponent),
  },
  // Database dump / clean-rebuild import — the UI face of forge-db's
  // dump/import (same zip layout, archives interchangeable with the CLI).
  // Admin-only via [Authorize(Roles="Admin")] on the API endpoints. Routed
  // before the `:tab` catch-all so the literal segment wins.
  {
    path: 'database',
    data: { titleKey: 'adminDatabase.title' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./database/database-transfer.component').then((m) => m.DatabaseTransferComponent),
  },
  {
    path: 'webhooks',
    data: { titleKey: 'admin.tabs.webhooks' },
    canActivate: [roleGuard('Admin'), capabilityGuard('CAP-CROSS-WEBHOOKS')],
    loadComponent: () => import('./webhooks/webhooks.component').then((m) => m.WebhooksComponent),
  },
  {
    path: 'scheduled-tasks',
    data: { titleKey: 'admin.tabs.scheduledTasks' },
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./scheduled-tasks/scheduled-tasks.component').then((m) => m.ScheduledTasksComponent),
  },
  {
    path: 'cloud-storage',
    data: { titleKey: 'admin.tabs.cloudStorage' },
    canActivate: [roleGuard('Admin'), capabilityGuard('CAP-EXT-CLOUD-STORAGE')],
    loadComponent: () =>
      import('./cloud-storage/cloud-storage.component').then((m) => m.CloudStorageComponent),
  },
  {
    path: 'ai-index',
    data: { titleKey: 'admin.tabs.aiIndex' },
    canActivate: [roleGuard('Admin'), capabilityGuard('CAP-EXT-AI-ASSISTANT')],
    loadComponent: () => import('./ai-index/ai-index.component').then((m) => m.AiIndexComponent),
  },
  {
    path: 'machine-connections',
    data: { titleKey: 'admin.tabs.machineConnections' },
    canActivate: [roleGuard('Admin', 'Manager'), capabilityGuard('CAP-MFG-MACHINE-CONNECT')],
    loadComponent: () =>
      import('./machine-connections/machine-connections.component').then((m) => m.MachineConnectionsComponent),
  },
  // Phase 1m option-3 — /admin/configuration was the parallel admin
  // surface for the descriptor-driven settings. Retired: the existing
  // /admin/integrations page (rendered inside AdminComponent's
  // 'integrations' tab) now drives off IntegrationDescriptorCatalog +
  // ISettingsService, so there's no need for a separate page. The route
  // redirects so old bookmarks land on the new surface.
  {
    path: 'configuration',
    redirectTo: 'integrations',
    pathMatch: 'full',
  },
  {
    path: 'configuration/:group',
    redirectTo: 'integrations',
  },
  { path: ':tab', canActivate: [tabGuard(ADMIN_TABS, () => adminDefaultTab(), ADMIN_TAB_ROLES)], component: AdminComponent, data: { titleTabPrefix: 'admin.tabs.' } },
];

function adminDefaultTab(): string {
  return inject(AuthService).hasRole('Admin') ? 'overview' : 'compliance';
}
