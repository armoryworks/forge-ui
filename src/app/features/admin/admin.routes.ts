import { Routes } from '@angular/router';
import { AdminComponent } from './admin.component';

export const ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  // Phase 4 Phase-A — diagnostic page that renders the loaded capability descriptor.
  // Listed before the catch-all `:tab` route so it wins. Replaced by Phase E's
  // full admin UI (4E §Screen 1, 4, 5).
  {
    path: 'capabilities-debug',
    loadComponent: () =>
      import('./capabilities-debug/capabilities-debug.component').then((m) => m.CapabilitiesDebugComponent),
  },
  { path: ':tab', component: AdminComponent },
];
