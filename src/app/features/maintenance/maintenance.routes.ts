import { Routes } from '@angular/router';

import { capabilityGuard } from '../../shared/guards/capability.guard';

export const MAINTENANCE_ROUTES: Routes = [
  { path: '', redirectTo: 'schedules', pathMatch: 'full' },
  {
    path: 'schedules',
    canActivate: [capabilityGuard('CAP-MAINT-PM')],
    loadComponent: () =>
      import('./pages/schedules/schedules.component').then((m) => m.SchedulesComponent),
  },
  {
    path: 'predictions',
    canActivate: [capabilityGuard('CAP-MAINT-PREDICTIVE')],
    loadComponent: () =>
      import('./pages/predictions/predictions.component').then((m) => m.PredictionsComponent),
  },
];
