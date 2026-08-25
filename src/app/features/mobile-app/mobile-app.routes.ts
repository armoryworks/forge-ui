import { Routes } from '@angular/router';

import { MobileAppShellComponent } from './mobile-app-shell.component';

export const MOBILE_APP_ROUTES: Routes = [
  {
    path: '',
    component: MobileAppShellComponent,
    children: [
      { path: '', redirectTo: 'scan', pathMatch: 'full' },
      {
        path: 'scan',
        loadComponent: () => import('./pages/app-scan.component').then((m) => m.AppScanComponent),
      },
    ],
  },
];
