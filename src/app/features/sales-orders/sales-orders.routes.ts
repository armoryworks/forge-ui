import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { SalesOrdersComponent } from './sales-orders.component';
import { roleGuard } from '../../shared/guards/role.guard';

export const SALES_ORDERS_ROUTES: Routes = [
  { path: '', component: SalesOrdersComponent },
  // Recurring order templates — Hangfire daily job auto-generates SOs from
  // these. Lives under /sales-orders/recurring since the lifecycle is
  // intrinsically tied to sales orders.
  {
    path: 'recurring',
    canActivate: [roleGuard('Admin', 'Manager', 'OfficeManager')],
    loadComponent: () => import('./pages/recurring/recurring-orders.component').then(m => m.RecurringOrdersComponent),
  },
  {
    path: ':id',
    redirectTo: ({ params }) =>
      inject(Router).createUrlTree(['/sales-orders'], { queryParams: { detail: `sales-order:${params['id']}` } }),
  },
];
