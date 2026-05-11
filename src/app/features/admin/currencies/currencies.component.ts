import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyService } from '../services/currency.service';
import { Currency, ExchangeRate, CreateCurrencyRequest, UpdateCurrencyRequest, SetExchangeRateRequest } from '../models/currency.model';
import { CurrencyDialogComponent, CurrencyDialogData, CurrencyDialogResult } from './currency-dialog.component';
import { ExchangeRateDialogComponent, ExchangeRateDialogData } from './exchange-rate-dialog.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../shared/services/snackbar.service';

/**
 * Multi-currency admin — Currency catalog on top, exchange rate history
 * below. Both surfaces are tightly coupled (you can't set a rate without
 * picking from the currency list, and the FX rate page can't show
 * meaningful pair labels without the currency catalog), so they share
 * a page rather than living separately.
 *
 * Exchange rates are append-only by design — submitting a new rate for
 * an existing pair on a new effective date creates a row that supersedes
 * the prior at conversion time. The table is descending-by-effective-date
 * so the most recent rate per pair surfaces first.
 */
@Component({
  selector: 'app-admin-currencies',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TranslatePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './currencies.component.html',
  styleUrl: './currencies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrenciesComponent {
  private readonly service = inject(CurrencyService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currencies = signal<Currency[]>([]);
  protected readonly rates = signal<ExchangeRate[]>([]);
  protected readonly loadingCurrencies = signal(true);
  protected readonly loadingRates = signal(true);

  protected readonly currencyColumns: ColumnDef[] = [
    { field: 'code', header: this.translate.instant('admin.currencies.colCode'), sortable: true, width: '90px' },
    { field: 'name', header: this.translate.instant('admin.currencies.colName'), sortable: true },
    { field: 'symbol', header: this.translate.instant('admin.currencies.colSymbol'), sortable: true, width: '80px', align: 'center' },
    { field: 'decimalPlaces', header: this.translate.instant('admin.currencies.colDecimals'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'isBaseCurrency', header: this.translate.instant('admin.currencies.colBase'), sortable: true, width: '90px', align: 'center' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '90px', align: 'center' },
    { field: 'sortOrder', header: this.translate.instant('admin.currencies.colSort'), sortable: true, type: 'number', align: 'right', width: '90px' },
  ];

  protected readonly rateColumns: ColumnDef[] = [
    { field: 'effectiveDate', header: this.translate.instant('admin.currencies.colEffective'), sortable: true, type: 'date', width: '120px' },
    { field: 'pair', header: this.translate.instant('admin.currencies.colPair'), sortable: true, width: '140px' },
    { field: 'rate', header: this.translate.instant('admin.currencies.colRate'), sortable: true, type: 'number', align: 'right' },
    { field: 'source', header: this.translate.instant('admin.currencies.colSource'), sortable: true, width: '100px' },
    { field: 'fetchedAt', header: this.translate.instant('admin.currencies.colFetched'), sortable: true, type: 'date', width: '160px' },
  ];

  constructor() {
    this.loadCurrencies();
    this.loadRates();
  }

  protected loadCurrencies(): void {
    this.loadingCurrencies.set(true);
    this.service.listCurrencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.currencies.set(rows); this.loadingCurrencies.set(false); },
      error: () => this.loadingCurrencies.set(false),
    });
  }

  protected loadRates(): void {
    this.loadingRates.set(true);
    this.service.listExchangeRates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        // Decorate with pair string for sortable display.
        const decorated = rows.map(r => ({ ...r, pair: `${r.fromCurrencyCode} → ${r.toCurrencyCode}` }));
        this.rates.set(decorated as ExchangeRate[]);
        this.loadingRates.set(false);
      },
      error: () => this.loadingRates.set(false),
    });
  }

  protected openNewCurrency(): void {
    this.dialog.open<CurrencyDialogComponent, CurrencyDialogData, CurrencyDialogResult | undefined>(
      CurrencyDialogComponent, { width: '480px', data: {} },
    ).afterClosed().subscribe(payload => {
      if (!payload) return;
      this.service.createCurrency(payload as CreateCurrencyRequest).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.currencies.created'));
          this.loadCurrencies();
        },
      });
    });
  }

  protected openEditCurrency(currency: Currency): void {
    this.dialog.open<CurrencyDialogComponent, CurrencyDialogData, CurrencyDialogResult | undefined>(
      CurrencyDialogComponent, { width: '480px', data: { currency } },
    ).afterClosed().subscribe(payload => {
      if (!payload) return;
      this.service.updateCurrency(currency.id, payload as UpdateCurrencyRequest).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.currencies.updated'));
          this.loadCurrencies();
        },
      });
    });
  }

  protected openNewRate(): void {
    const currencies = this.currencies();
    if (currencies.length < 2) {
      this.snackbar.error(this.translate.instant('admin.currencies.needTwoCurrencies'));
      return;
    }
    this.dialog.open<ExchangeRateDialogComponent, ExchangeRateDialogData, SetExchangeRateRequest | undefined>(
      ExchangeRateDialogComponent, { width: '480px', data: { currencies } },
    ).afterClosed().subscribe(payload => {
      if (!payload) return;
      this.service.setExchangeRate(payload).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('admin.currencies.rateCreated'));
          this.loadRates();
        },
      });
    });
  }
}
