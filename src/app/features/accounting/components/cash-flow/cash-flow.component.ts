import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { ViewModeToggleComponent } from '../../../../shared/components/view-mode-toggle/view-mode-toggle.component';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';
import {
  ACCOUNTING_VIEW_PREF_KEY,
  AccountingViewMode,
  DEFAULT_ACCOUNTING_VIEW,
} from '../../../../shared/models/accounting-view.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { CashFlowStatement } from '../../models/accounting.models';
import { CashFlowVisualComponent } from './cash-flow-visual.component';
import { StatementPeriodComponent } from '../statement-period/statement-period.component';
import { StatementPeriod, bookIdFromParams, periodFromParams, samePeriod } from '../../utils/statement-period';

@Component({
  selector: 'app-cash-flow',
  standalone: true,
  imports: [
    TranslatePipe,
    DateOnlyPipe,
    PageHeaderComponent,
    CurrencyDisplayComponent,
    ViewModeToggleComponent,
    CashFlowVisualComponent,
    StatementPeriodComponent,
  ],
  templateUrl: './cash-flow.component.html',
  styleUrl: './cash-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowComponent {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly preferences = inject(UserPreferencesService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<CashFlowStatement | null>(null);

  /** URL ?view= wins; otherwise the user's saved accounting-view default; else classic. */
  private readonly preferredView = (): AccountingViewMode =>
    this.preferences.get<AccountingViewMode>(ACCOUNTING_VIEW_PREF_KEY) ?? DEFAULT_ACCOUNTING_VIEW;
  protected readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => (p.get('view') as AccountingViewMode) ?? this.preferredView()),
    ),
    { initialValue: this.preferredView() },
  );

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  /** Statement window, mirrored to `?from=&to=`; empty is fiscal year-to-date. */
  protected readonly period = computed(() => periodFromParams(this.params()), { equal: samePeriod });
  private readonly bookId = computed(() => bookIdFromParams(this.params()));

  protected setPeriod(period: StatementPeriod): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: period.from, to: period.to },
      queryParamsHandling: 'merge',
    });
  }

  protected setViewMode(mode: AccountingViewMode): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode === DEFAULT_ACCOUNTING_VIEW ? null : mode },
      queryParamsHandling: 'merge',
    });
    this.preferences.set(ACCOUNTING_VIEW_PREF_KEY, mode);
  }

  constructor() {
    autoRefreshOnGlChange(() => this.load());

    effect(() => {
      this.period();
      this.bookId();
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getCashFlow(this.bookId(), this.period().from, this.period().to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.cashFlowLoadFailed'));
          this.loading.set(false);
        },
      });
  }
}
