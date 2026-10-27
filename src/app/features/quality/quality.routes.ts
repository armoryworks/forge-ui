import { Routes } from '@angular/router';

import { QualityComponent } from './quality.component';
import { capabilityGuard } from '../../shared/guards/capability.guard';
import { tabGuard } from '../../shared/guards/tab.guard';
import { QUALITY_TABS } from './models/quality-tab.model';

export const QUALITY_ROUTES: Routes = [
  { path: '', redirectTo: 'inspections', pathMatch: 'full' },
  {
    path: 'recalls',
    data: { titleKey: 'recalls.title' },
    canActivate: [capabilityGuard('CAP-QC-RECALL')],
    loadComponent: () =>
      import('./components/recall-list/recall-list.component').then((m) => m.RecallListComponent),
  },
  {
    path: 'fmea',
    data: { titleKey: 'fmea.title' },
    canActivate: [capabilityGuard('CAP-QC-FMEA')],
    loadComponent: () =>
      import('./fmea/pages/fmea-list/fmea-list.component').then((m) => m.FmeaListComponent),
  },
  {
    path: 'fmea/:id',
    data: { titleKey: 'fmea.title' },
    canActivate: [capabilityGuard('CAP-QC-FMEA')],
    loadComponent: () =>
      import('./fmea/pages/fmea-editor/fmea-editor.component').then((m) => m.FmeaEditorComponent),
  },
  {
    path: 'ppap',
    data: { titleKey: 'ppap.title' },
    canActivate: [capabilityGuard('CAP-QC-PPAP')],
    loadComponent: () =>
      import('./ppap/pages/ppap-list/ppap-list.component').then((m) => m.PpapListComponent),
  },
  {
    path: 'ppap/:id',
    data: { titleKey: 'ppap.title' },
    canActivate: [capabilityGuard('CAP-QC-PPAP')],
    loadComponent: () =>
      import('./ppap/pages/ppap-detail/ppap-detail.component').then((m) => m.PpapDetailComponent),
  },
  { path: ':tab', canActivate: [tabGuard([...QUALITY_TABS, 'lots'], 'inspections')], component: QualityComponent },
];
