import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ViewModeToggleComponent } from '../../../../shared/components/view-mode-toggle/view-mode-toggle.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CurrencyCatalogService } from '../../../../shared/services/currency-catalog.service';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';
import {
  ACCOUNTING_VIEW_PREF_KEY,
  AccountingViewMode,
  DEFAULT_ACCOUNTING_VIEW,
} from '../../../../shared/models/accounting-view.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { agingBucketLabel } from '../../utils/aging-bucket-label';
import { ApAging } from '../../models/accounting.models';
import { ApAgingVisualComponent } from './ap-aging-visual.component';
import { StatementPeriodComponent } from '../statement-period/statement-period.component';
import { StatementPeriod, bookIdFromParams, periodFromParams, samePeriod } from '../../utils/statement-period';

/** Flattened aging row — bucket amounts hoisted to top-level b{i} fields so the shared table can render/sort them. */
interface AgingTableRow {
  partyName: string;
  openBalance: number;
  currencyCode: string | null;
  openTxnBalance: number | null;
  discountAvailable: number;
  nextDiscountDeadline: string | null;
  [bucketKey: string]: string | number | null;
}

@Component({
  selector: 'app-ap-aging',
  standalone: true,
  imports: [
    TranslatePipe,
    DateOnlyPipe,
    PageHeaderComponent,
    CurrencyDisplayComponent,
    DataTableComponent,
    ColumnCellDirective,
    ViewModeToggleComponent,
    ApAgingVisualComponent,
    StatementPeriodComponent,
    SelectComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './ap-aging.component.html',
  styleUrl: './ap-aging.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApAgingComponent {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly preferences = inject(UserPreferencesService);
  protected readonly currencyCatalog = inject(CurrencyCatalogService).ensureLoaded();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<ApAging | null>(null);

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
  /** As-of date, mirrored to `?to=`; empty is today. */
  protected readonly period = computed(() => periodFromParams(this.params()), { equal: samePeriod });
  private readonly bookId = computed(() => bookIdFromParams(this.params()));
  /** Currency filter, mirrored to `?currency=`; empty is every currency. */
  protected readonly currencyId = computed(() => {
    const raw = Number(this.params().get('currency'));
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  });
  protected readonly currencyFilter = new FormControl<number | null>(null);
  protected readonly currencyOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('accounting.currency.allCurrencies') },
    ...this.currencyCatalog.currencies().map(c => ({ value: c.id, label: c.code })),
  ]);

  protected setPeriod(period: StatementPeriod): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: null, to: period.to },
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

  protected bucketLabel(label: string): string {
    return agingBucketLabel(label, this.translate);
  }

  /** Dynamic columns: Vendor + one per aging bucket + Open, derived from the report's bucket set. */
  protected readonly columns = computed<ColumnDef[]>(() => {
    const r = this.report();
    if (!r) return [];
    const buckets: ColumnDef[] = r.totalsByBucket.map((b, i) => ({
      field: `b${i}`, header: agingBucketLabel(b.label, this.translate), sortable: true, type: 'number', align: 'right', width: '120px',
    }));
    return [
      { field: 'partyName', header: this.translate.instant('accounting.common.vendor'), sortable: true },
      ...buckets,
      { field: 'openBalance', header: this.translate.instant('accounting.common.open'), sortable: true, type: 'number', align: 'right', width: '130px' },
      ...(this.currencyCatalog.isMultiCurrency()
        ? [{ field: 'openTxnBalance', header: this.translate.instant('accounting.currency.openInDocumentCurrency'), sortable: true, type: 'number' as const, align: 'right' as const, width: '150px' }]
        : []),
      ...(r.vendors.some(p => (p.discountAvailable ?? 0) > 0)
        ? [{ field: 'discountAvailable', header: this.translate.instant('paymentTerms.discountOpen'), sortable: true, type: 'number' as const, align: 'right' as const, width: '170px' }]
        : []),
    ];
  });

  protected readonly rows = computed<AgingTableRow[]>(() => {
    const r = this.report();
    if (!r) return [];
    return r.vendors.map((v) => {
      const row: AgingTableRow = { partyName: v.vendorName ?? '—', openBalance: v.openBalance, currencyCode: v.currencyCode ?? null, openTxnBalance: v.openTxnBalance ?? null,
        discountAvailable: v.discountAvailable ?? 0, nextDiscountDeadline: v.nextDiscountDeadline ?? null };
      v.buckets.forEach((b, i) => (row[`b${i}`] = b.amount));
      return row;
    });
  });

  constructor() {
    autoRefreshOnGlChange(() => this.load());
    effect(() => {
      this.period();
      this.bookId();
      this.currencyId();
      this.load();
    });
    effect(() => this.currencyFilter.setValue(this.currencyId(), { emitEvent: false }));
    this.currencyFilter.valueChanges.pipe(takeUntilDestroyed()).subscribe(currency => {
      this.router.navigate([], { relativeTo: this.route, queryParams: { currency }, queryParamsHandling: 'merge' });
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getApAging(this.bookId(), this.period().to, this.currencyId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.apAgingLoadFailed'));
          this.loading.set(false);
        },
      });
  }
}
