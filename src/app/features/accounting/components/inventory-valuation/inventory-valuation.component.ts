import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { forkJoin } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { InventoryValuationReconciliation, InventoryValuationRow } from '../../models/inventory-valuation.model';
import { bookIdFromParams } from '../../utils/statement-period';

/**
 * Read-only inventory valuation: per part the on-hand quantity, average cost and value from the valuation store,
 * and per inventory control account the GL balance against the store with the variance and what makes it up.
 * Controller, CAP-ACCT-GL-VIEW.
 */
@Component({
  selector: 'app-inventory-valuation',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    PageLayoutComponent,
    CurrencyDisplayComponent,
    DataTableComponent,
    LoadingBlockDirective,
    ColumnCellDirective,
  ],
  templateUrl: './inventory-valuation.component.html',
  styleUrl: './inventory-valuation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryValuationComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly parts = signal<(InventoryValuationRow & { id: number })[]>([]);
  protected readonly reconciliation = signal<InventoryValuationReconciliation | null>(null);
  protected readonly reconcilingItems = computed(() =>
    (this.reconciliation()?.reconcilingItems ?? []).map((item, index) => ({ ...item, id: index + 1 })));

  protected readonly partColumns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('accounting.inventoryValuation.part'), sortable: true },
    { field: 'onHandQuantity', header: this.translate.instant('accounting.inventoryValuation.onHand'), sortable: true, type: 'number', align: 'right', width: '130px' },
    { field: 'averageUnitCost', header: this.translate.instant('accounting.inventoryValuation.averageCost'), sortable: true, type: 'number', align: 'right', width: '150px' },
    { field: 'totalValue', header: this.translate.instant('accounting.inventoryValuation.value'), sortable: true, type: 'number', align: 'right', width: '160px' },
  ];

  protected readonly accountColumns: ColumnDef[] = [
    { field: 'accountNumber', header: this.translate.instant('accounting.trialBalance.accountNumber'), sortable: true, width: '130px' },
    { field: 'accountName', header: this.translate.instant('accounting.trialBalance.account'), sortable: true },
    { field: 'glBalance', header: this.translate.instant('accounting.inventoryValuation.glBalance'), sortable: true, type: 'number', align: 'right', width: '160px' },
    { field: 'storeValue', header: this.translate.instant('accounting.inventoryValuation.storeValue'), sortable: true, type: 'number', align: 'right', width: '160px' },
    { field: 'variance', header: this.translate.instant('accounting.inventoryValuation.variance'), sortable: true, type: 'number', align: 'right', width: '140px' },
  ];

  protected readonly itemColumns: ColumnDef[] = [
    { field: 'accountNumber', header: this.translate.instant('accounting.trialBalance.accountNumber'), width: '130px' },
    { field: 'sourceType', header: this.translate.instant('accounting.inventoryValuation.source'), width: '160px' },
    { field: 'amount', header: this.translate.instant('accounting.inventoryValuation.amount'), type: 'number', align: 'right', width: '140px' },
    { field: 'description', header: this.translate.instant('accounting.common.description') },
  ];

  ngOnInit(): void {
    const bookId = bookIdFromParams(this.route.snapshot.queryParamMap);
    forkJoin({
      parts: this.gl.getInventoryValuation(bookId),
      reconciliation: this.gl.getInventoryValuationReconciliation(bookId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ parts, reconciliation }) => {
          this.parts.set(parts.map((p) => ({ ...p, id: p.partId })));
          this.reconciliation.set(reconciliation);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.inventoryValuation.loadFailed');
        },
      });
  }
}
