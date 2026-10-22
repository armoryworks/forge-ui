import { Routes } from '@angular/router';

import { roleGuard } from '../../shared/guards/role.guard';
import { TimeTrackingComponent } from './time-tracking.component';

export const TIME_TRACKING_ROUTES: Routes = [
  { path: '', component: TimeTrackingComponent },
  {
    path: 'labor-reconciliation',
    canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager', 'Controller')],
    data: { titleKey: 'laborReconciliation.title' },
    loadComponent: () =>
      import('./labor-reconciliation/labor-reconciliation.component').then((m) => m.LaborReconciliationComponent),
  },
];
