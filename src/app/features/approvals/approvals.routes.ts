import { Routes } from '@angular/router';

export const APPROVALS_ROUTES: Routes = [
  { path: '', redirectTo: 'inbox', pathMatch: 'full' },
  {
    path: ':tab',
    loadComponent: () =>
      import('./approvals.component').then((m) => m.ApprovalsComponent),
  },
];
