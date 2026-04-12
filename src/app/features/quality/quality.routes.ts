import { Routes } from '@angular/router';

import { QualityComponent } from './quality.component';

export const QUALITY_ROUTES: Routes = [
  { path: '', redirectTo: 'inspections', pathMatch: 'full' },
  { path: ':tab', component: QualityComponent },
];
