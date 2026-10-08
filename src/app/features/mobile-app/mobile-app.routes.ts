import { Routes } from '@angular/router';

import { lockGuard } from '../../shared/guards/lock.guard';
import { mobileScreenGuard } from '../../shared/guards/mobile-screen.guard';
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
        canActivate: [mobileScreenGuard('CAP-MOBILE-SCAN')],
        loadComponent: () => import('./pages/app-scan.component').then((m) => m.AppScanComponent),
      },
      {
        path: 'account',
        loadComponent: () => import('./pages/app-account.component').then((m) => m.AppAccountComponent),
      },
      {
        path: 'clock',
        canActivate: [mobileScreenGuard('CAP-MOBILE-CLOCK')],
        loadComponent: () => import('./pages/app-clock.component').then((m) => m.AppClockComponent),
      },
      {
        path: 'move',
        canActivate: [mobileScreenGuard('CAP-MOBILE-STOCK')],
        loadComponent: () => import('./pages/app-move-stock.component').then((m) => m.AppMoveStockComponent),
      },
      {
        path: 'lookup',
        canActivate: [mobileScreenGuard('CAP-MOBILE-LOOKUP')],
        loadComponent: () => import('./pages/app-lookup.component').then((m) => m.AppLookupComponent),
      },
      {
        path: 'receive/:id',
        canActivate: [mobileScreenGuard('CAP-MOBILE-SCAN'), mobileScreenGuard('CAP-P2P-PO')],
        loadComponent: () => import('./pages/app-receive.component').then((m) => m.AppReceiveComponent),
      },
      {
        path: 'jobs',
        canActivate: [mobileScreenGuard('CAP-MOBILE-JOBS')],
        loadComponent: () => import('./pages/app-jobs-home.component').then((m) => m.AppJobsHomeComponent),
      },
      {
        path: 'jobs/:id',
        canActivate: [mobileScreenGuard('CAP-MOBILE-JOBS')],
        loadComponent: () => import('./pages/app-job-status.component').then((m) => m.AppJobStatusComponent),
      },
    ],
  },
];
