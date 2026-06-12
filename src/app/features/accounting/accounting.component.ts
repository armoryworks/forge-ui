import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
  imports: [RouterLink, TranslatePipe, PageHeaderComponent],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingComponent {
  private readonly translate = inject(TranslateService);

  protected readonly tiles: AccountingTile[] = [
    { route: 'trial-balance', label: this.translate.instant('accounting.dashboard.trialBalance'), icon: 'balance', description: this.translate.instant('accounting.dashboard.trialBalanceDesc') },
    { route: 'profit-loss', label: this.translate.instant('accounting.dashboard.profitLoss'), icon: 'trending_up', description: this.translate.instant('accounting.dashboard.profitLossDesc') },
    { route: 'balance-sheet', label: this.translate.instant('accounting.dashboard.balanceSheet'), icon: 'account_balance', description: this.translate.instant('accounting.dashboard.balanceSheetDesc') },
    { route: 'cash-flow', label: this.translate.instant('accounting.dashboard.cashFlow'), icon: 'waterfall_chart', description: this.translate.instant('accounting.dashboard.cashFlowDesc') },
    { route: 'ar-aging', label: this.translate.instant('accounting.dashboard.arAging'), icon: 'trending_flat', description: this.translate.instant('accounting.dashboard.arAgingDesc') },
    { route: 'ap-aging', label: this.translate.instant('accounting.dashboard.apAging'), icon: 'schedule', description: this.translate.instant('accounting.dashboard.apAgingDesc') },
    { route: 'grni', label: this.translate.instant('accounting.dashboard.grni'), icon: 'inventory_2', description: this.translate.instant('accounting.dashboard.grniDesc') },
    { route: 'period-close', label: this.translate.instant('accounting.dashboard.periodClose'), icon: 'event_available', description: this.translate.instant('accounting.dashboard.periodCloseDesc') },
    { route: 'bank-rec', label: this.translate.instant('accounting.dashboard.bankRec'), icon: 'account_balance_wallet', description: this.translate.instant('accounting.dashboard.bankRecDesc') },
    { route: 'exports', label: this.translate.instant('accounting.dashboard.exports'), icon: 'download', description: this.translate.instant('accounting.dashboard.exportsDesc') },
  ];
}
