import { Routes } from '@angular/router';

export const CPQ_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/configurators/configurators.component').then(m => m.ConfiguratorsComponent),
  },
];
