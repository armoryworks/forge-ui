import { Routes } from '@angular/router';

export const MAINTENANCE_ROUTES: Routes = [
  { path: '', redirectTo: 'predictions', pathMatch: 'full' },
  {
    path: 'predictions',
    loadComponent: () =>
      import('./pages/predictions/predictions.component').then((m) => m.PredictionsComponent),
  },
];
