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
  {
    path: 'sankey',
    loadComponent: () =>
      import('./components/sankey-reports/sankey-reports.component').then(
        m => m.SankeyReportsComponent,
      ),
  },
];
