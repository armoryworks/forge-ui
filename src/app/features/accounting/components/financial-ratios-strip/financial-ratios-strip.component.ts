import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { BalanceSheet, ProfitAndLoss } from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;

/** A directional health cue attached to a ratio, or null when no sane threshold applies. */
type RatioHint = 'good' | 'warn' | 'bad' | null;

/** Pre-resolved view-model for one KPI card — display string + optional health cue. */
interface RatioCard {
  labelKey: string;
  display: string;
  hint: RatioHint;
}

/**
 * Read-only headline financial-ratio strip for the accounting hub. Fetches the current-period P&L and
 * as-of-today balance sheet, derives only ratios that are truthfully computable from the exposed totals,
 * and renders each as a KPI card with a subtle good/warn/bad cue. Divide-by-zero / missing data → "—".
 * When the statements are unreachable (capability off → 403/404) it renders nothing rather than erroring.
 */
@Component({
  selector: 'app-financial-ratios-strip',
  standalone: true,
  imports: [TranslatePipe, LoadingBlockDirective],
  templateUrl: './financial-ratios-strip.component.html',
  styleUrl: './financial-ratios-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialRatiosStripComponent {
  private readonly gl = inject(GeneralLedgerService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  private readonly pnl = signal<ProfitAndLoss | null>(null);
  private readonly balanceSheet = signal<BalanceSheet | null>(null);

  protected readonly cards = computed<RatioCard[]>(() => {
    const p = this.pnl();
    const b = this.balanceSheet();
    if (!p || !b) return [];

    const netMargin = this.divide(p.netIncome, p.totalIncome);
    const roa = this.divide(p.netIncome, b.totalAssets);
    const debtToEquity = this.divide(b.totalLiabilities, b.totalEquityWithEarnings);
    const expenseRatio = this.divide(p.totalExpense, p.totalIncome);

    return [
      { labelKey: 'accounting.ratios.netMargin', display: this.percent(netMargin), hint: this.signHint(netMargin) },
      { labelKey: 'accounting.ratios.roa', display: this.percent(roa), hint: this.signHint(roa) },
      {
        labelKey: 'accounting.ratios.debtToEquity',
        display: this.ratio(debtToEquity),
        hint: this.debtToEquityHint(debtToEquity),
      },
      {
        labelKey: 'accounting.ratios.expenseRatio',
        display: this.percent(expenseRatio),
        hint: this.expenseRatioHint(expenseRatio),
      },
    ];
  });

  constructor() {
    autoRefreshOnGlChange(() => this.load());
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      pnl: this.gl.getProfitAndLoss(DEFAULT_BOOK_ID, null, null),
      balanceSheet: this.gl.getBalanceSheet(DEFAULT_BOOK_ID, null),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ pnl, balanceSheet }) => {
          this.pnl.set(pnl);
          this.balanceSheet.set(balanceSheet);
          this.loading.set(false);
        },
        error: () => {
          this.pnl.set(null);
          this.balanceSheet.set(null);
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  private divide(numerator: number, denominator: number): number | null {
    return denominator === 0 ? null : numerator / denominator;
  }

  private percent(value: number | null): string {
    return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  }

  private ratio(value: number | null): string {
    return value === null ? '—' : value.toFixed(2);
  }

  private signHint(value: number | null): RatioHint {
    if (value === null || value === 0) return null;
    return value > 0 ? 'good' : 'bad';
  }

  private debtToEquityHint(value: number | null): RatioHint {
    if (value === null) return null;
    if (value < 0) return 'bad';
    return value > 2 ? 'warn' : 'good';
  }

  private expenseRatioHint(value: number | null): RatioHint {
    if (value === null) return null;
    if (value < 1) return 'good';
    return value > 1 ? 'bad' : null;
  }
}
