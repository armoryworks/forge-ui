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
  // Phase 4 Phase-C — minimum viable capability administration page. Phase E
  // adds filtering, search, and area grouping on top of this surface.
  {
    path: 'capabilities',
    loadComponent: () =>
      import('./capabilities/capabilities.component').then((m) => m.CapabilitiesComponent),
  },
  { path: ':tab', component: AdminComponent },
];
