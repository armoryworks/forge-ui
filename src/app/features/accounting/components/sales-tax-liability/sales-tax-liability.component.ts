import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { format, parseISO } from 'date-fns';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import {
  DateRange,
  DateRangePickerComponent,
} from '../../../../shared/components/date-range-picker/date-range-picker.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { SalesTaxLiabilityReport } from '../../models/accounting.models';

/** Flattened jurisdiction row for the shared data-table. */
interface SalesTaxTableRow {
  jurisdiction: string;
  taxableBase: number;
  liability: number;
  orderCount: number;
}

/**
 * Sales-tax liability report — what the business owes a taxing authority,
 * grouped by ship-to jurisdiction over a date range. Read-only; sums the
 * seller's own liability (marketplace-facilitator tax the platform remits is
 * excluded server-side). The date-range filter is URL-driven (`?from=&to=`).
 */
@Component({
  selector: 'app-sales-tax-liability',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    CurrencyDisplayComponent,
    DataTableComponent,
    ColumnCellDirective,
    DateRangePickerComponent,
  ],
  templateUrl: './sales-tax-liability.component.html',
  styleUrl: './sales-tax-liability.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesTaxLiabilityComponent {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<SalesTaxLiabilityReport | null>(null);

  /** Date window mirrored to `?from=&to=` (URL is the source of truth). */
  private readonly fromParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('from'))),
    { initialValue: null },
  );
  private readonly toParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('to'))),
    { initialValue: null },
  );

  protected readonly rangeControl = new FormControl<DateRange>(
    { start: null, end: null },
    { nonNullable: true },
  );

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'jurisdiction', header: this.translate.instant('accounting.salesTaxLiability.jurisdiction'), sortable: true },
    { field: 'taxableBase', header: this.translate.instant('accounting.salesTaxLiability.taxableBase'), sortable: true, type: 'number', align: 'right', width: '160px' },
    { field: 'orderCount', header: this.translate.instant('accounting.salesTaxLiability.orders'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'liability', header: this.translate.instant('accounting.salesTaxLiability.liability'), sortable: true, type: 'number', align: 'right', width: '160px' },
  ]);

  protected readonly rows = computed<SalesTaxTableRow[]>(() => {
    const r = this.report();
    if (!r) return [];
    const unassigned = this.translate.instant('accounting.salesTaxLiability.unassigned');
    return r.jurisdictions.map((j) => ({
      jurisdiction: j.jurisdiction ?? unassigned,
      taxableBase: j.taxableBase,
      liability: j.liability,
      orderCount: j.orderCount,
    }));
  });

  constructor() {
    autoRefreshOnGlChange(() => this.load());

    // Seed the picker from the URL without looping back to it.
    effect(() => {
      const from = this.fromParam();
      const to = this.toParam();
      const start = from ? parseISO(from) : null;
      const end = to ? parseISO(to) : null;
      const current = this.rangeControl.value;
      if (this.iso(current.start) !== from || this.iso(current.end) !== to) {
        this.rangeControl.setValue({ start, end }, { emitEvent: false });
      }
    });

    // Picker → URL.
    this.rangeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((range) => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { from: this.iso(range.start), to: this.iso(range.end) },
        queryParamsHandling: 'merge',
      });
    });

    // URL window drives the (re)load. Runs on init and whenever from/to change.
    effect(() => {
      this.fromParam();
      this.toParam();
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getSalesTaxLiability(this.fromParam(), this.toParam())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.salesTaxLiabilityLoadFailed'));
          this.loading.set(false);
        },
      });
  }

  private iso(date: Date | null): string | null {
    return date ? format(date, 'yyyy-MM-dd') : null;
  }
}
