import { Routes } from '@angular/router';

import { tabGuard } from '../../shared/guards/tab.guard';
import { SchedulingComponent } from './scheduling.component';
import { SCHEDULING_TABS } from './models/scheduling-tab.model';

export const SCHEDULING_ROUTES: Routes = [
  { path: '', redirectTo: 'gantt', pathMatch: 'full' },
  { path: ':tab', canActivate: [tabGuard(SCHEDULING_TABS, 'gantt')], component: SchedulingComponent },
];
