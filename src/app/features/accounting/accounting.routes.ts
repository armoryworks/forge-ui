import { Routes } from '@angular/router';
import { AccountingComponent } from './accounting.component';
import { capabilityGuard } from '../../shared/guards/capability.guard';
import { unsavedChangesGuard } from '../../shared/guards/unsaved-changes.guard';

export const ACCOUNTING_ROUTES: Routes = [
  { path: '', component: AccountingComponent },
  {
    path: 'ledger',
    data: { titleKey: 'nav.ledger' },
    loadComponent: () =>
      import('./components/ledger-view/ledger-view.component').then((m) => m.LedgerViewComponent),
  },
  {
    path: 'ledger/:accountId',
    data: { titleKey: 'nav.ledger' },
    loadComponent: () =>
      import('./components/ledger-view/ledger-view.component').then((m) => m.LedgerViewComponent),
  },
  {
    path: 'training',
    data: { titleKey: 'accounting.training.title' },
    loadComponent: () =>
      import('./components/training/training.component').then((m) => m.TrainingComponent),
  },
  {
    // Write surface — posting a manual journal entry needs full GL, not just the view capability.
    path: 'chart-of-accounts',
    data: { titleKey: 'nav.chartOfAccounts' },
    canActivate: [capabilityGuard('CAP-ACCT-FULLGL')],
    loadComponent: () =>
      import('./components/chart-of-accounts/chart-of-accounts.component').then((m) => m.ChartOfAccountsComponent),
  },
  {
    path: 'journal-entries/new',
    data: { titleKey: 'accounting.journalEditor.title' },
    canActivate: [capabilityGuard('CAP-ACCT-FULLGL')],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./components/journal-entry-editor/journal-entry-editor.component').then((m) => m.JournalEntryEditorComponent),
  },
  {
    path: 'journal-approvals',
    data: { titleKey: 'nav.journalApprovals' },
    canActivate: [capabilityGuard('CAP-ACCT-FULLGL')],
    loadComponent: () =>
      import('./components/journal-approvals/journal-approvals.component').then((m) => m.JournalApprovalsComponent),
  },
  {
    path: 'trial-balance',
    data: { titleKey: 'nav.trialBalance' },
    loadComponent: () =>
      import('./components/trial-balance/trial-balance.component').then((m) => m.TrialBalanceComponent),
  },
  {
    path: 'profit-loss',
    data: { titleKey: 'nav.profitLoss' },
    loadComponent: () =>
      import('./components/profit-loss/profit-loss.component').then((m) => m.ProfitLossComponent),
  },
  {
    path: 'balance-sheet',
    data: { titleKey: 'nav.balanceSheet' },
    loadComponent: () =>
      import('./components/balance-sheet/balance-sheet.component').then((m) => m.BalanceSheetComponent),
  },
  {
    // Budget entry is a write surface — needs full GL, like chart-of-accounts.
    path: 'budgets',
    data: { titleKey: 'nav.budgets' },
    canActivate: [capabilityGuard('CAP-ACCT-FULLGL')],
    loadComponent: () =>
      import('./components/budgets/budgets.component').then((m) => m.BudgetsComponent),
  },
  {
    path: 'inventory-valuation',
    data: { titleKey: 'nav.inventoryValuation' },
    loadComponent: () =>
      import('./components/inventory-valuation/inventory-valuation.component').then((m) => m.InventoryValuationComponent),
  },
  {
    path: 'cash-flow',
    data: { titleKey: 'nav.cashFlow' },
    loadComponent: () =>
      import('./components/cash-flow/cash-flow.component').then((m) => m.CashFlowComponent),
  },
  {
    path: 'ar-aging',
    data: { titleKey: 'nav.arAging' },
    loadComponent: () =>
      import('./components/ar-aging/ar-aging.component').then((m) => m.ArAgingComponent),
  },
  {
    path: 'ap-aging',
    data: { titleKey: 'nav.apAging' },
    loadComponent: () =>
      import('./components/ap-aging/ap-aging.component').then((m) => m.ApAgingComponent),
  },
  {
    path: 'grni',
    data: { titleKey: 'nav.grni' },
    loadComponent: () => import('./components/grni/grni.component').then((m) => m.GrniComponent),
  },
  {
    path: 'sales-tax-liability',
    data: { titleKey: 'nav.salesTaxLiability' },
    loadComponent: () =>
      import('./components/sales-tax-liability/sales-tax-liability.component').then((m) => m.SalesTaxLiabilityComponent),
  },
  {
    path: '1099-report',
    data: { titleKey: 'nav.form1099' },
    loadComponent: () =>
      import('./components/form-1099/form-1099.component').then((m) => m.Form1099Component),
  },
  {
    path: 'period-close',
    data: { titleKey: 'nav.periodClose' },
    loadComponent: () =>
      import('./components/period-close/period-close.component').then((m) => m.PeriodCloseComponent),
  },
  {
    path: 'exchange-rates',
    data: { titleKey: 'nav.exchangeRates', ratesOnly: true },
    loadComponent: () =>
      import('../admin/currencies/currencies.component').then((m) => m.CurrenciesComponent),
  },
  {
    path: 'bank-rec',
    data: { titleKey: 'nav.bankRec' },
    loadComponent: () =>
      import('./components/bank-rec/bank-rec.component').then((m) => m.BankRecComponent),
  },
  {
    path: 'exports',
    data: { titleKey: 'nav.exports' },
    loadComponent: () =>
      import('./components/exports/exports.component').then((m) => m.ExportsComponent),
  },
  {
    path: 'bank-statements',
    data: { titleKey: 'nav.bankStatements' },
    loadComponent: () =>
      import('./components/bank-statements/bank-statements.component').then((m) => m.BankStatementsComponent),
  },
];
