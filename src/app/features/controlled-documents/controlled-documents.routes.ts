import { Routes } from '@angular/router';

export const CONTROLLED_DOCUMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/controlled-documents/controlled-documents.component').then((m) => m.ControlledDocumentsComponent),
  },
];
