import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CapDirective } from '../../shared/directives/cap.directive';
import { CapabilityService } from '../../shared/services/capability.service';
import { FinancialRatiosStripComponent } from './components/financial-ratios-strip/financial-ratios-strip.component';

interface AccountingTile {
  route: string;
  label: string;
  icon: string;
  description: string;
  capability?: string;
}

/**
 * Accounting landing — links to the dark GL reports. The whole area is reachable only behind the
 * CAP-ACCT-FULLGL route guard, so it is hidden until the suite is switched on.
 */
@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PageHeaderComponent, CapDirective, FinancialRatiosStripComponent],
  templateUrl: './accounting.component.html',
  styleUrl: './accounting.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingComponent {
  private readonly translate = inject(TranslateService);
  private readonly capabilities = inject(CapabilityService);

  protected readonly tiles: AccountingTile[] = [
    { route: 'ledger', label: this.translate.instant('accounting.dashboard.ledger'), icon: 'receipt_long', description: this.translate.instant('accounting.dashboard.ledgerDesc') },
    { route: '/accounting/opening-journal', label: this.translate.instant('accounting.dashboard.openingJournal'), icon: 'input', description: this.translate.instant('accounting.dashboard.openingJournalDesc'), capability: 'CAP-ACCT-MIGRATION' },
    { route: '/accounting/opening-stock', label: this.translate.instant('accounting.dashboard.openingStock'), icon: 'inventory', description: this.translate.instant('accounting.dashboard.openingStockDesc') },
    { route: 'journal-entries/new', label: this.translate.instant('accounting.dashboard.newEntry'), icon: 'note_add', description: this.translate.instant('accounting.dashboard.newEntryDesc') },
    { route: 'journal-approvals', label: this.translate.instant('accounting.dashboard.journalApprovals'), icon: 'fact_check', description: this.translate.instant('accounting.dashboard.journalApprovalsDesc'), capability: 'CAP-ACCT-FULLGL' },
    { route: 'training', label: this.translate.instant('accounting.dashboard.training'), icon: 'school', description: this.translate.instant('accounting.dashboard.trainingDesc') },
    { route: 'trial-balance', label: this.translate.instant('accounting.dashboard.trialBalance'), icon: 'balance', description: this.translate.instant('accounting.dashboard.trialBalanceDesc') },
    { route: 'profit-loss', label: this.translate.instant('accounting.dashboard.profitLoss'), icon: 'trending_up', description: this.translate.instant('accounting.dashboard.profitLossDesc') },
    { route: 'balance-sheet', label: this.translate.instant('accounting.dashboard.balanceSheet'), icon: 'account_balance', description: this.translate.instant('accounting.dashboard.balanceSheetDesc') },
    { route: 'budgets', label: this.translate.instant('accounting.dashboard.budgets'), icon: 'savings', description: this.translate.instant('accounting.dashboard.budgetsDesc') },
    { route: 'cash-flow', label: this.translate.instant('accounting.dashboard.cashFlow'), icon: 'waterfall_chart', description: this.translate.instant('accounting.dashboard.cashFlowDesc') },
    { route: 'ar-aging', label: this.translate.instant('accounting.dashboard.arAging'), icon: 'trending_flat', description: this.translate.instant('accounting.dashboard.arAgingDesc') },
    { route: 'ap-aging', label: this.translate.instant('accounting.dashboard.apAging'), icon: 'schedule', description: this.translate.instant('accounting.dashboard.apAgingDesc') },
    { route: 'grni', label: this.translate.instant('accounting.dashboard.grni'), icon: 'inventory_2', description: this.translate.instant('accounting.dashboard.grniDesc') },
    { route: 'inventory-valuation', label: this.translate.instant('accounting.dashboard.inventoryValuation'), icon: 'warehouse', description: this.translate.instant('accounting.dashboard.inventoryValuationDesc') },
    { route: 'sales-tax-liability', label: this.translate.instant('accounting.dashboard.salesTaxLiability'), icon: 'percent', description: this.translate.instant('accounting.dashboard.salesTaxLiabilityDesc') },
    { route: '1099-report', label: this.translate.instant('accounting.dashboard.form1099'), icon: 'badge', description: this.translate.instant('accounting.dashboard.form1099Desc') },
    { route: 'period-close', label: this.translate.instant('accounting.dashboard.periodClose'), icon: 'event_available', description: this.translate.instant('accounting.dashboard.periodCloseDesc') },
    { route: 'bank-rec', label: this.translate.instant('accounting.dashboard.bankRec'), icon: 'account_balance_wallet', description: this.translate.instant('accounting.dashboard.bankRecDesc') },
    { route: 'bank-statements', label: this.translate.instant('accounting.dashboard.bankStatements'), icon: 'upload_file', description: this.translate.instant('accounting.dashboard.bankStatementsDesc') },
    { route: 'exports', label: this.translate.instant('accounting.dashboard.exports'), icon: 'download', description: this.translate.instant('accounting.dashboard.exportsDesc') },
  ];

  protected readonly visibleTiles = computed(() => {
    this.capabilities.capabilities();
    return this.tiles.filter((t) => !t.capability || this.capabilities.isEnabled(t.capability));
  });
}
