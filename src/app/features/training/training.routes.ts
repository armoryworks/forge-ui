import { Routes } from '@angular/router';

export const TRAINING_ROUTES: Routes = [
  { path: '', redirectTo: 'library', pathMatch: 'full' },
  {
    path: 'module/:id',
    loadComponent: () => import('./training-module/training-module.component').then(m => m.TrainingModuleComponent),
  },
  {
    path: 'path/:id',
    loadComponent: () => import('./training-path/training-path.component').then(m => m.TrainingPathComponent),
  },
  {
    path: ':tab',
    loadComponent: () => import('./training.component').then(m => m.TrainingComponent),
  },
];
