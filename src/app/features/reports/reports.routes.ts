import { Routes } from '@angular/router';
import { roleGuard } from '../../shared/guards/role.guard';
import { ReportsComponent } from './reports.component';

export const REPORTS_ROUTES: Routes = [
  { path: '', component: ReportsComponent },
  {
    path: 'builder',
    canActivate: [roleGuard('Admin', 'Manager', 'PM')],
    loadComponent: () =>
      import('./components/report-builder/report-builder.component').then(
        m => m.ReportBuilderComponent,
      ),
  },
  {
    path: 'sankey',
    data: { titleKey: 'reports.sankey.title' },
    canActivate: [roleGuard('Admin', 'Manager', 'PM')],
    loadComponent: () =>
      import('./components/sankey-reports/sankey-reports.component').then(
        m => m.SankeyReportsComponent,
      ),
  },
];
