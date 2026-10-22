import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { TrialBalance } from '../../models/accounting.models';
import { StatementPeriodComponent } from '../statement-period/statement-period.component';
import { StatementPeriod, bookIdFromParams, periodFromParams, samePeriod } from '../../utils/statement-period';

@Component({
  selector: 'app-trial-balance',
  standalone: true,
  imports: [TranslatePipe, PageHeaderComponent, CurrencyDisplayComponent, DataTableComponent, ColumnCellDirective, StatementPeriodComponent],
  templateUrl: './trial-balance.component.html',
  styleUrl: './trial-balance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrialBalanceComponent {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<TrialBalance | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  /** As-of date, mirrored to `?to=`; empty is every posting to date. */
  protected readonly period = computed(() => periodFromParams(this.params()), { equal: samePeriod });
  private readonly bookId = computed(() => bookIdFromParams(this.params()));

  protected readonly columns: ColumnDef[] = [
    { field: 'accountNumber', header: this.translate.instant('accounting.trialBalance.accountNumber'), sortable: true, width: '130px' },
    { field: 'accountName', header: this.translate.instant('accounting.trialBalance.account'), sortable: true },
    { field: 'debitBalance', header: this.translate.instant('accounting.common.debit'), sortable: true, type: 'number', align: 'right', width: '150px' },
    { field: 'creditBalance', header: this.translate.instant('accounting.common.credit'), sortable: true, type: 'number', align: 'right', width: '150px' },
    { field: 'debitTotal', header: this.translate.instant('accounting.trialBalance.debitTurnover'), sortable: true, type: 'number', align: 'right', width: '150px', visible: false },
    { field: 'creditTotal', header: this.translate.instant('accounting.trialBalance.creditTurnover'), sortable: true, type: 'number', align: 'right', width: '150px', visible: false },
  ];

  constructor() {
    autoRefreshOnGlChange(() => this.load());

    effect(() => {
      this.period();
      this.bookId();
      this.load();
    });
  }

  protected setPeriod(period: StatementPeriod): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: null, to: period.to },
      queryParamsHandling: 'merge',
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getTrialBalance(this.bookId(), null, this.period().to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.trialBalanceLoadFailed'));
          this.loading.set(false);
        },
      });
  }
}
