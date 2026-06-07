import { Routes } from '@angular/router';
import { AccountingComponent } from './accounting.component';

export const ACCOUNTING_ROUTES: Routes = [
  { path: '', component: AccountingComponent },
  {
    path: 'trial-balance',
    loadComponent: () =>
      import('./components/trial-balance/trial-balance.component').then((m) => m.TrialBalanceComponent),
  },
  {
    path: 'profit-loss',
    loadComponent: () =>
      import('./components/profit-loss/profit-loss.component').then((m) => m.ProfitLossComponent),
  },
  {
    path: 'balance-sheet',
    loadComponent: () =>
      import('./components/balance-sheet/balance-sheet.component').then((m) => m.BalanceSheetComponent),
  },
  {
    path: 'cash-flow',
    loadComponent: () =>
      import('./components/cash-flow/cash-flow.component').then((m) => m.CashFlowComponent),
  },
];
