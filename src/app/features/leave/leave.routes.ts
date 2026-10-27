import { Routes } from '@angular/router';

import { tabGuard } from '../../shared/guards/tab.guard';
import { LEAVE_TAB_ROLES, LEAVE_TABS } from './models/leave-tab.model';

export const LEAVE_ROUTES: Routes = [
  { path: '', redirectTo: 'mine', pathMatch: 'full' },
  {
    path: ':tab',
    canActivate: [tabGuard(LEAVE_TABS, 'mine', LEAVE_TAB_ROLES)],
    data: { titleKey: 'leave.title' },
    loadComponent: () => import('./leave.component').then(m => m.LeaveComponent),
  },
];
