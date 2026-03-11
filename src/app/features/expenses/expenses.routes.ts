import { Routes } from '@angular/router';
import { ExpensesComponent } from './expenses.component';

export const EXPENSES_ROUTES: Routes = [
  { path: '', component: ExpensesComponent },
  { path: 'approval', loadComponent: () => import('./approval-queue/expense-approval-queue.component').then(m => m.ExpenseApprovalQueueComponent) },
  { path: 'upcoming', loadComponent: () => import('./upcoming/upcoming-expenses.component').then(m => m.UpcomingExpensesComponent) },
];
