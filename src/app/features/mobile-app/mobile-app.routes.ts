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
    ],
  },
];
