import { Routes } from '@angular/router';

import { tabGuard } from '../../shared/guards/tab.guard';
import { CostingComponent } from './costing.component';
import { COSTING_TABS } from './models/costing-tab.model';

export const COSTING_ROUTES: Routes = [
  { path: '', redirectTo: 'periods', pathMatch: 'full' },
  { path: ':tab', canActivate: [tabGuard(COSTING_TABS, 'periods')], component: CostingComponent },
];
