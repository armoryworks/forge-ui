import { Routes } from '@angular/router';

import { QualityComponent } from './quality.component';
import { capabilityGuard } from '../../shared/guards/capability.guard';

export const QUALITY_ROUTES: Routes = [
  { path: '', redirectTo: 'inspections', pathMatch: 'full' },
  {
    path: 'recalls',
    canActivate: [capabilityGuard('CAP-QC-RECALL')],
    loadComponent: () =>
      import('./components/recall-list/recall-list.component').then((m) => m.RecallListComponent),
  },
  { path: ':tab', component: QualityComponent },
];
