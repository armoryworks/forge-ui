import { Routes } from '@angular/router';

import { lockGuard } from '../../shared/guards/lock.guard';
import { MobileAppShellComponent } from './mobile-app-shell.component';

export const MOBILE_APP_ROUTES: Routes = [
  {
    path: 'lock',
    loadComponent: () => import('./lock/lock-screen.component').then((m) => m.LockScreenComponent),
  },
  {
    path: 'setup-lock',
    loadComponent: () => import('./lock/lock-setup.component').then((m) => m.LockSetupComponent),
  },
  {
    path: '',
    component: MobileAppShellComponent,
    canActivateChild: [lockGuard],
    children: [
      { path: '', redirectTo: 'scan', pathMatch: 'full' },
      {
        path: 'scan',
        loadComponent: () => import('./pages/app-scan.component').then((m) => m.AppScanComponent),
      },
      {
        path: 'clock',
        loadComponent: () => import('./pages/app-clock.component').then((m) => m.AppClockComponent),
      },
      {
        path: 'move',
        loadComponent: () => import('./pages/app-move-stock.component').then((m) => m.AppMoveStockComponent),
      },
      {
        path: 'lookup',
        loadComponent: () => import('./pages/app-lookup.component').then((m) => m.AppLookupComponent),
      },
      {
        path: 'jobs',
        loadComponent: () => import('./pages/app-jobs-home.component').then((m) => m.AppJobsHomeComponent),
      },
      {
        path: 'jobs/:id',
        loadComponent: () => import('./pages/app-job-status.component').then((m) => m.AppJobStatusComponent),
      },
    ],
  },
];
