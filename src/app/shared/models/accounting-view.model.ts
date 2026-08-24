import { ViewMode } from './view-mode.model';

/** Per-user preference key for the default accounting presentation. */
export const ACCOUNTING_VIEW_PREF_KEY = 'accounting:viewMode';

/** Classic = data tables (source of truth). Visual = charts for visual learners. */
export type AccountingViewMode = ViewMode;

export const DEFAULT_ACCOUNTING_VIEW: AccountingViewMode = 'classic';

/** Options for the profile customization selector. */
export const ACCOUNTING_VIEW_OPTIONS: readonly { value: AccountingViewMode; labelKey: string }[] = [
  { value: 'classic', labelKey: 'account.accountingViewClassic' },
  { value: 'visual', labelKey: 'account.accountingViewVisual' },
];
