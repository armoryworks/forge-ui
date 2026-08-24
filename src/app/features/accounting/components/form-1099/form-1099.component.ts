import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { Form1099Report } from '../../models/accounting.models';

/** Flattened + display-shaped 1099 row for the shared data-table. */
interface Form1099TableRow {
  vendorName: string;
  vendorNumber: string;
  taxIdMasked: string;
  totalPayments: number;
  meetsThreshold: boolean;
}

/**
 * 1099 report — every vendor flagged as a 1099 payee with total cash paid in the
 * selected calendar year and whether it reaches the IRS $600 filing threshold.
 * Read-only. The year filter is URL-driven (`?year=`); tax IDs are masked to the
 * last four digits.
 */
@Component({
  selector: 'app-form-1099',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    CurrencyDisplayComponent,
    DataTableComponent,
    SelectComponent,
    StatusBadgeComponent,
    ColumnCellDirective,
  ],
  templateUrl: './form-1099.component.html',
  styleUrl: './form-1099.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Form1099Component {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<Form1099Report | null>(null);

  private readonly currentYear = new Date().getFullYear();

  /** Selected reporting year mirrored to `?year=` (URL is the source of truth). */
  private readonly yearParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => {
      const n = parseInt(p.get('year') ?? '', 10);
      return Number.isNaN(n) ? this.currentYear : n;
    })),
    { initialValue: this.currentYear },
  );

  protected readonly yearControl = new FormControl<number>(this.currentYear, { nonNullable: true });

  protected readonly yearOptions: SelectOption[] = Array.from({ length: 6 }, (_, i) => {
    const year = this.currentYear - i;
    return { value: year, label: year.toString() };
  });

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'vendorName', header: this.translate.instant('accounting.form1099.vendor'), sortable: true },
    { field: 'vendorNumber', header: this.translate.instant('accounting.form1099.vendorNumber'), sortable: true, width: '140px' },
    { field: 'taxIdMasked', header: this.translate.instant('accounting.form1099.taxId'), width: '140px' },
    { field: 'totalPayments', header: this.translate.instant('accounting.form1099.totalPayments'), sortable: true, type: 'number', align: 'right', width: '160px' },
    { field: 'meetsThreshold', header: this.translate.instant('accounting.form1099.status'), sortable: true, align: 'center', width: '150px' },
  ]);

  protected readonly rows = computed<Form1099TableRow[]>(() => {
    const r = this.report();
    if (!r) return [];
    return r.vendors.map((v) => ({
      vendorName: v.vendorName,
      vendorNumber: v.vendorNumber ?? '',
      taxIdMasked: this.maskTaxId(v.taxId),
      totalPayments: v.totalPayments,
      meetsThreshold: v.meetsThreshold,
    }));
  });

  constructor() {
    autoRefreshOnGlChange(() => this.load());

    // Seed the picker from the URL without looping back to it.
    effect(() => {
      const year = this.yearParam();
      if (this.yearControl.value !== year) {
        this.yearControl.setValue(year, { emitEvent: false });
      }
    });

    // Picker → URL.
    this.yearControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((year) => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { year },
        queryParamsHandling: 'merge',
      });
    });

    // URL year drives the (re)load.
    effect(() => {
      this.yearParam();
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .get1099Report(this.yearParam())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.form1099LoadFailed'));
          this.loading.set(false);
        },
      });
  }

  /** Mask all but the last four digits of the TIN for display. */
  private maskTaxId(taxId: string | null): string {
    if (!taxId) return '—';
    const digits = taxId.replace(/\D/g, '');
    if (digits.length < 4) return '••••';
    return `•••••${digits.slice(-4)}`;
  }
}
