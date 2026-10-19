import { Routes } from '@angular/router';

import { QualityComponent } from './quality.component';
import { capabilityGuard } from '../../shared/guards/capability.guard';
import { tabGuard } from '../../shared/guards/tab.guard';
import { QUALITY_TABS } from './models/quality-tab.model';

export const QUALITY_ROUTES: Routes = [
  { path: '', redirectTo: 'inspections', pathMatch: 'full' },
  {
    path: 'recalls',
    canActivate: [capabilityGuard('CAP-QC-RECALL')],
    loadComponent: () =>
      import('./components/recall-list/recall-list.component').then((m) => m.RecallListComponent),
  },
  { path: ':tab', canActivate: [tabGuard([...QUALITY_TABS, 'lots'], 'inspections')], component: QualityComponent },
];
