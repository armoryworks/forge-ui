import { Routes } from '@angular/router';

export const ENROLL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./enroll-scan.component').then((m) => m.EnrollScanComponent),
  },
  {
    path: 'manual',
    loadComponent: () =>
      import('./enroll-manual.component').then((m) => m.EnrollManualComponent),
  },
];
