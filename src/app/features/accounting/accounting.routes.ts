import { Routes } from '@angular/router';
import { AccountingComponent } from './accounting.component';
import { capabilityGuard } from '../../shared/guards/capability.guard';

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
    // Write surface — posting a manual journal entry needs full GL, not just the view capability.
    path: 'chart-of-accounts',
    canActivate: [capabilityGuard('CAP-ACCT-FULLGL')],
    loadComponent: () =>
      import('./components/chart-of-accounts/chart-of-accounts.component').then((m) => m.ChartOfAccountsComponent),
  },
  {
    path: 'journal-entries/new',
    canActivate: [capabilityGuard('CAP-ACCT-FULLGL')],
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
    // Budget entry is a write surface — needs full GL, like chart-of-accounts.
    path: 'budgets',
    canActivate: [capabilityGuard('CAP-ACCT-FULLGL')],
    loadComponent: () =>
      import('./components/budgets/budgets.component').then((m) => m.BudgetsComponent),
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
    path: 'sales-tax-liability',
    loadComponent: () =>
      import('./components/sales-tax-liability/sales-tax-liability.component').then((m) => m.SalesTaxLiabilityComponent),
  },
  {
    path: '1099-report',
    loadComponent: () =>
      import('./components/form-1099/form-1099.component').then((m) => m.Form1099Component),
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
