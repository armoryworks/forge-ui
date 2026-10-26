import { Routes } from '@angular/router';

import { lockGuard } from '../../shared/guards/lock.guard';
import { mobileScreenGuard } from '../../shared/guards/mobile-screen.guard';
import { roleGuard } from '../../shared/guards/role.guard';
import { PICK_ROLES } from '../../shared/utils/mobile-app-screens';
import { MobileAppShellComponent } from './mobile-app-shell.component';

export const MOBILE_APP_ROUTES: Routes = [
  {
    path: 'lock',
    data: { titleKey: 'routeTitles.lockScreen' },
    loadComponent: () => import('./lock/lock-screen.component').then((m) => m.LockScreenComponent),
  },
  {
    path: 'setup-lock',
    data: { titleKey: 'routeTitles.setupLock' },
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
        data: { titleKey: 'mobileApp.tabs.scan' },
        canActivate: [mobileScreenGuard('CAP-MOBILE-SCAN')],
        loadComponent: () => import('./pages/app-scan.component').then((m) => m.AppScanComponent),
      },
      {
        path: 'account',
        data: { titleKey: 'mobileApp.account.title' },
        loadComponent: () => import('./pages/app-account.component').then((m) => m.AppAccountComponent),
      },
      {
        path: 'clock',
        data: { titleKey: 'mobileApp.tabs.clock' },
        canActivate: [mobileScreenGuard('CAP-MOBILE-CLOCK')],
        loadComponent: () => import('./pages/app-clock.component').then((m) => m.AppClockComponent),
      },
      {
        path: 'move',
        data: { titleKey: 'mobileApp.tabs.move' },
        canActivate: [mobileScreenGuard('CAP-MOBILE-STOCK')],
        loadComponent: () => import('./pages/app-move-stock.component').then((m) => m.AppMoveStockComponent),
      },
      {
        path: 'lookup',
        data: { titleKey: 'mobileApp.tabs.lookup' },
        canActivate: [mobileScreenGuard('CAP-MOBILE-LOOKUP')],
        loadComponent: () => import('./pages/app-lookup.component').then((m) => m.AppLookupComponent),
      },
      {
        path: 'receive/:id',
        data: { titleKey: 'kioskFlows.receive.title' },
        canActivate: [mobileScreenGuard('CAP-MOBILE-SCAN'), mobileScreenGuard('CAP-P2P-PO')],
        loadComponent: () => import('./pages/app-receive.component').then((m) => m.AppReceiveComponent),
      },
      {
        path: 'picks',
        data: { titleKey: 'mobileApp.tabs.picks' },
        canActivate: [mobileScreenGuard('CAP-O2C-PICKPACK'), roleGuard(...PICK_ROLES)],
        loadComponent: () => import('./pages/app-pick-lines.component').then((m) => m.AppPickLinesComponent),
      },
      {
        path: 'jobs',
        data: { titleKey: 'mobileApp.tabs.jobs' },
        canActivate: [mobileScreenGuard('CAP-MOBILE-JOBS')],
        loadComponent: () => import('./pages/app-jobs-home.component').then((m) => m.AppJobsHomeComponent),
      },
      {
        path: 'jobs/:id',
        data: { titleKey: 'mobileApp.tabs.jobs' },
        canActivate: [mobileScreenGuard('CAP-MOBILE-JOBS')],
        loadComponent: () => import('./pages/app-job-status.component').then((m) => m.AppJobStatusComponent),
      },
    ],
  },
];
