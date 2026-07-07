import { Routes } from '@angular/router';
import { AccountingComponent } from './accounting.component';

export const ACCOUNTING_ROUTES: Routes = [
  { path: '', component: AccountingComponent },
  {
    path: 'ledger',
    loadComponent: () =>
      import('./components/ledger-view/ledger-view.component').then((m) => m.LedgerViewComponent),
  },
  {
    path: 'ledger/:accountId',
    loadComponent: () =>
      import('./components/ledger-view/ledger-view.component').then((m) => m.LedgerViewComponent),
  },
  {
    path: 'training',
    loadComponent: () =>
      import('./components/training/training.component').then((m) => m.TrainingComponent),
  },
  {
    path: 'journal-entries/new',
    loadComponent: () =>
      import('./components/journal-entry-editor/journal-entry-editor.component').then((m) => m.JournalEntryEditorComponent),
  },
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
  {
    path: 'ar-aging',
    loadComponent: () =>
      import('./components/ar-aging/ar-aging.component').then((m) => m.ArAgingComponent),
  },
  {
    path: 'ap-aging',
    loadComponent: () =>
      import('./components/ap-aging/ap-aging.component').then((m) => m.ApAgingComponent),
  },
  {
    path: 'grni',
    loadComponent: () => import('./components/grni/grni.component').then((m) => m.GrniComponent),
  },
  {
    path: 'period-close',
    loadComponent: () =>
      import('./components/period-close/period-close.component').then((m) => m.PeriodCloseComponent),
  },
  {
    path: 'bank-rec',
    loadComponent: () =>
      import('./components/bank-rec/bank-rec.component').then((m) => m.BankRecComponent),
  },
  {
    path: 'exports',
    loadComponent: () =>
      import('./components/exports/exports.component').then((m) => m.ExportsComponent),
  },
  {
    path: 'bank-statements',
    loadComponent: () =>
      import('./components/bank-statements/bank-statements.component').then((m) => m.BankStatementsComponent),
  },
];
