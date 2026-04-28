import { Routes } from '@angular/router';
import { AdminComponent } from './admin.component';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
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
  { path: ':tab', component: AdminComponent },
];
