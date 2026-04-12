import { Routes } from '@angular/router';

import { SchedulingComponent } from './scheduling.component';

export const SCHEDULING_ROUTES: Routes = [
  { path: '', redirectTo: 'gantt', pathMatch: 'full' },
  { path: ':tab', component: SchedulingComponent },
];
