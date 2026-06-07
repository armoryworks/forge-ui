import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

interface AccountingTile {
  route: string;
  label: string;
  icon: string;
  description: string;
}

/**
 * Accounting landing — links to the dark GL reports. The whole area is reachable only behind the
 * CAP-ACCT-FULLGL route guard, so it is hidden until the suite is switched on.
 */
@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingComponent {
  protected readonly tiles: AccountingTile[] = [
    { route: 'trial-balance', label: 'Trial Balance', icon: 'balance', description: 'Debits and credits by account — proves the ledger is in balance.' },
    { route: 'profit-loss', label: 'Profit & Loss', icon: 'trending_up', description: 'Income and expense over a period.' },
    { route: 'balance-sheet', label: 'Balance Sheet', icon: 'account_balance', description: 'Assets, liabilities and equity as of a date.' },
    { route: 'cash-flow', label: 'Cash Flow', icon: 'waterfall_chart', description: 'Indirect-method cash flow, reconciled to the cash account.' },
    { route: 'ar-aging', label: 'AR Aging', icon: 'trending_flat', description: 'Open receivables by customer and age bucket.' },
    { route: 'ap-aging', label: 'AP Aging', icon: 'schedule', description: 'Open payables by vendor and age bucket.' },
    { route: 'grni', label: 'GRNI Reconciliation', icon: 'inventory_2', description: 'Goods received not invoiced — GL vs operational.' },
    { route: 'period-close', label: 'Period Close', icon: 'event_available', description: 'Soft/hard-close periods, reopen, and run the year-end close.' },
    { route: 'bank-rec', label: 'Bank Reconciliation', icon: 'account_balance_wallet', description: 'Match cleared cash entries to a bank statement and finalize.' },
  ];
}
