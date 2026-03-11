import { Routes } from '@angular/router';
import { ReportsComponent } from './reports.component';

export const REPORTS_ROUTES: Routes = [
  { path: '', component: ReportsComponent },
  {
    path: 'builder',
    loadComponent: () =>
      import('./components/report-builder/report-builder.component').then(
        m => m.ReportBuilderComponent,
      ),
  },
];
