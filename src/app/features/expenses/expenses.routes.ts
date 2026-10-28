import { Routes } from '@angular/router';

import { routeAccessGuards } from '../../shared/guards/route-access.guard';
import { ExpensesComponent } from './expenses.component';

export const EXPENSES_ROUTES: Routes = [
  { path: '', component: ExpensesComponent },
  { path: 'approval', canActivate: routeAccessGuards('expenses/approval'), loadComponent: () => import('./approval-queue/expense-approval-queue.component').then(m => m.ExpenseApprovalQueueComponent), data: { titleKey: 'expenses.approvalQueue' } },
  { path: 'upcoming', canActivate: routeAccessGuards('expenses/upcoming'), loadComponent: () => import('./upcoming/upcoming-expenses.component').then(m => m.UpcomingExpensesComponent), data: { titleKey: 'expenses.ledgerTitle' } },
];
