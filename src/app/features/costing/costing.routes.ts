import { Routes } from '@angular/router';

import { CostingComponent } from './costing.component';

export const COSTING_ROUTES: Routes = [
  { path: '', redirectTo: 'periods', pathMatch: 'full' },
  { path: ':tab', component: CostingComponent },
];
