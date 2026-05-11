import { Routes } from '@angular/router';
import { SalesOrdersComponent } from './sales-orders.component';

export const SALES_ORDERS_ROUTES: Routes = [
  { path: '', component: SalesOrdersComponent },
  // Recurring order templates — Hangfire daily job auto-generates SOs from
  // these. Lives under /sales-orders/recurring since the lifecycle is
  // intrinsically tied to sales orders.
  {
    path: 'recurring',
    loadComponent: () => import('./pages/recurring/recurring-orders.component').then(m => m.RecurringOrdersComponent),
  },
];
