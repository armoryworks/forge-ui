import { SettingsDirectoryEntry } from './settings-directory-entry.model';

const CONTROLLER_LEDGER = { roles: ['Controller'], capabilities: ['CAP-ACCT-GL-VIEW'] } as const;
const ADMIN = { roles: ['Admin'] } as const;

/** Settings set on screens other than Admin > Settings, each with the access rule of the route it lives on. */
export const SETTINGS_DIRECTORY: SettingsDirectoryEntry[] = [
  {
    key: 'fiscal-year-start',
    textKeys: ['settingsDirectory.fiscalYearStart', 'settingsDirectory.fiscalCalendar'],
    whereKey: 'nav.periodClose',
    route: '/accounting/period-close',
    access: CONTROLLER_LEDGER,
  },
  {
    key: 'maker-checker-threshold',
    textKeys: ['accounting.bookSettings.threshold', 'settingsDirectory.bookSettings'],
    whereKey: 'nav.periodClose',
    route: '/accounting/period-close',
    access: CONTROLLER_LEDGER,
  },
  {
    key: 'book-time-zone',
    textKeys: ['accounting.bookSettings.timeZone', 'settingsDirectory.bookSettings'],
    whereKey: 'nav.periodClose',
    route: '/accounting/period-close',
    access: CONTROLLER_LEDGER,
  },
  {
    key: 'exchange-rates',
    textKeys: ['admin.currencies.ratesTitle'],
    whereKey: 'nav.exchangeRates',
    route: '/accounting/exchange-rates',
    access: { roles: ['Controller'], capabilities: ['CAP-ACCT-GL-VIEW', 'CAP-MD-CURRENCIES'] },
  },
  {
    key: 'account-mapping',
    textKeys: ['accounting.mapping.title', 'settingsDirectory.freightAccounts'],
    whereKey: 'nav.chartOfAccounts',
    route: '/accounting/chart-of-accounts',
    queryParams: { tab: 'mapping' },
    access: { roles: ['Controller'], capabilities: ['CAP-ACCT-GL-VIEW', 'CAP-ACCT-FULLGL'] },
  },
  {
    key: 'form-1099-threshold',
    textKeys: ['accounting.form1099.threshold', 'nav.form1099'],
    whereKey: 'nav.form1099',
    route: '/accounting/1099-report',
    access: CONTROLLER_LEDGER,
  },
  {
    key: 'payment-terms',
    textKeys: ['paymentTerms.title', 'settingsDirectory.earlyPaymentDiscounts'],
    whereKey: 'admin.tabs.paymentTerms',
    route: '/admin/payment-terms',
    access: { roles: ['Admin', 'Manager', 'OfficeManager'] },
  },
  {
    key: 'currencies',
    textKeys: ['admin.currencies.title'],
    whereKey: 'admin.tabs.currencies',
    route: '/admin/currencies',
    access: ADMIN,
  },
  {
    key: 'banking',
    textKeys: ['capabilityAreas.settingsSearch.bankingTitle', 'capabilityAreas.settingsSearch.bankingDesc'],
    whereKey: 'admin.tabs.banking',
    route: '/admin/banking',
    access: ADMIN,
  },
  {
    key: 'mfa-grace-days',
    textKeys: ['adminPanels.mfa.graceDays', 'admin.tabs.mfa'],
    whereKey: 'admin.tabs.mfa',
    route: '/admin/mfa',
    access: ADMIN,
  },
  {
    key: 'expense-auto-approve',
    textKeys: ['expenseSettings.autoApproveThreshold', 'admin.tabs.expenses'],
    whereKey: 'admin.tabs.expenses',
    route: '/admin/expenses',
    access: ADMIN,
  },
  {
    key: 'auto-po',
    textKeys: ['admin.tabs.autoPo'],
    whereKey: 'admin.tabs.autoPo',
    route: '/admin/auto-po',
    access: ADMIN,
  },
  {
    key: 'sales-tax-rates',
    textKeys: ['admin.tabs.salesTax', 'settingsDirectory.freightTaxable'],
    whereKey: 'admin.tabs.salesTax',
    route: '/admin/sales-tax',
    access: { roles: ['Admin', 'Manager'] },
  },
];
