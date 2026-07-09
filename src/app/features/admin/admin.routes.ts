import { Routes } from '@angular/router';
import { AdminComponent } from './admin.component';
import { capabilityGuard } from '../../shared/guards/capability.guard';

export const ADMIN_ROUTES: Routes = [
  // Admin Overview is the landing surface for /admin. Previously redirected
  // to /admin/users which forced the people-management page to act as both
  // entry point and full-screen task page even when the admin was here to
  // do something else. Overview is a launchpad — people / capabilities /
  // integrations / recent audit — that deep-links into the relevant tab.
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  // Phase 4 Phase-A — diagnostic page that renders the loaded capability descriptor.
  // Listed before the catch-all `:tab` route so it wins. Phase C added the
  // working `/admin/capabilities` page below; the debug page stays as a
  // diagnostic and will be replaced/folded into Phase E's full admin UI.
  {
    path: 'capabilities-debug',
    loadComponent: () =>
      import('./capabilities-debug/capabilities-debug.component').then((m) => m.CapabilitiesDebugComponent),
  },
  // Phase 4 Phase-E — full admin capability management surface (replaces
  // Phase C minimum). List page at `/admin/capabilities`; per-capability
  // detail page at `/admin/capabilities/:id`. Detail route MUST be listed
  // before the `:tab` catch-all so the AdminComponent doesn't intercept the
  // capability code as a tab name. Both lazy-loaded.
  {
    path: 'capabilities',
    loadComponent: () =>
      import('./capabilities/capabilities.component').then((m) => m.CapabilitiesComponent),
  },
  {
    path: 'capabilities/:id',
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
    loadComponent: () =>
      import('./discovery/discovery.component').then((m) => m.DiscoveryComponent),
  },
  // Phase 4 Phase-G — preset browser + apply. Lazy-loaded admin-only routes.
  // Specific routes (compare, custom) listed BEFORE the :id catch-all so
  // their literal segments win over the dynamic route.
  {
    path: 'presets',
    loadComponent: () =>
      import('./presets/preset-browser/preset-browser.component').then((m) => m.PresetBrowserComponent),
  },
  {
    path: 'presets/compare',
    loadComponent: () =>
      import('./presets/preset-compare/preset-compare.component').then((m) => m.PresetCompareComponent),
  },
  {
    path: 'presets/custom',
    loadComponent: () =>
      import('./presets/preset-custom/preset-custom.component').then((m) => m.PresetCustomComponent),
  },
  {
    path: 'presets/:id',
    loadComponent: () =>
      import('./presets/preset-detail/preset-detail.component').then((m) => m.PresetDetailComponent),
  },
  // Phase-4 entity-completeness — admin CRUD over the requirement-row catalog
  // that drives the per-entity completeness chip + badge. Routed before the
  // `:tab` catch-all so AdminComponent doesn't intercept the literal segment.
  {
    path: 'entity-completeness',
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
    loadComponent: () =>
      import('./working-calendars/working-calendars.component').then(
        (m) => m.WorkingCalendarsComponent,
      ),
  },
  // Bought-parts effort PR4 — TariffRate admin page. Admin imports HTS-code
  // tariffs that feed the landed-cost duty component on the part Cost tab.
  {
    path: 'tariffs',
    loadComponent: () =>
      import('./tariffs/tariffs.component').then((m) => m.TariffsComponent),
  },
  // Phase 1r / Batch 9 — LeadSource admin. Admin-managed catalog of formal
  // lead sources (replaces the legacy free-text Lead.Source field). Quality
  // score is owned by the nightly recompute job — admin manages name +
  // description + active flag.
  {
    path: 'lead-sources',
    loadComponent: () =>
      import('./lead-sources/lead-sources.component').then((m) => m.LeadSourcesComponent),
  },
  // Phase 1r / Batch 10 — ICP rubric admin. Admins define the scoring
  // scheme + dimensions used by the nightly LeadScore recompute job.
  {
    path: 'icp-rubrics',
    loadComponent: () =>
      import('./icp-rubrics/icp-rubrics.component').then((m) => m.IcpRubricsComponent),
  },
  // Phase 1r / Batch 11 — lead assignment rules. Admin-configured priority-
  // ordered rules that route incoming leads to reps (round-robin / territory
  // / industry / account-based).
  {
    path: 'assignment-rules',
    loadComponent: () =>
      import('./assignment-rules/assignment-rules.component').then((m) => m.AssignmentRulesComponent),
  },
  // Multi-currency admin — currencies catalog + per-day FX rates.
  {
    path: 'currencies',
    loadComponent: () =>
      import('./currencies/currencies.component').then((m) => m.CurrenciesComponent),
  },
  // Shipping carriers — list carriers, create custom shippers, and enter per-carrier API
  // credentials (encrypted, write-only). Routed before the `:tab` catch-all.
  {
    path: 'carriers',
    loadComponent: () =>
      import('./carriers/carriers.component').then((m) => m.CarriersComponent),
  },
  // S3 — Terms & Conditions admin. Company-scope T&Cs plus a scope filter to
  // browse/manage customer- and part-scoped terms. Company mutations are
  // Admin-only (server-enforced + gated in-page). Lives in the terms feature.
  {
    path: 'terms',
    loadComponent: () =>
      import('../terms/admin/terms-admin.component').then((m) => m.TermsAdminComponent),
  },
  // Costing Tier 2 — departmental cost rates. Switches the active costing profile
  // to per-work-center overhead percentages of direct labor. Gated by
  // CAP-COSTING-TIER2-DEPTRATES (route guard) + Admin/Manager on the server.
  {
    path: 'costing',
    canActivate: [capabilityGuard('CAP-COSTING-TIER2-DEPTRATES')],
    loadComponent: () =>
      import('./costing/costing.component').then((m) => m.CostingComponent),
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
  { path: ':tab', component: AdminComponent },
];
