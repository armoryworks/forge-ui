import { Routes } from '@angular/router';

import { PlaceholderComponent } from './shared/components/placeholder/placeholder.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  { path: 'kanban', component: PlaceholderComponent, data: { featureName: 'Kanban Board' } },
  { path: 'backlog', component: PlaceholderComponent, data: { featureName: 'Backlog' } },
  { path: 'calendar', component: PlaceholderComponent, data: { featureName: 'Calendar' } },
  { path: 'parts', component: PlaceholderComponent, data: { featureName: 'Parts Catalog' } },
  { path: 'inventory', component: PlaceholderComponent, data: { featureName: 'Inventory' } },
  { path: 'leads', component: PlaceholderComponent, data: { featureName: 'Leads' } },
  { path: 'expenses', component: PlaceholderComponent, data: { featureName: 'Expenses' } },
  { path: 'assets', component: PlaceholderComponent, data: { featureName: 'Assets' } },
  {
    path: 'time-tracking',
    component: PlaceholderComponent,
    data: { featureName: 'Time Tracking' },
  },
  { path: 'reports', component: PlaceholderComponent, data: { featureName: 'Reports' } },
  { path: 'admin', component: PlaceholderComponent, data: { featureName: 'Admin Settings' } },
];
