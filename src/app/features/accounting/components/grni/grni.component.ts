import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { GrniReconciliation } from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;

/** Flattened GRNI-by-PO row — bucket amounts hoisted to b{i} fields for the shared table. */
interface GrniPoTableRow {
  poNumber: string;
  vendorName: string;
  openAmount: number;
  [bucketKey: string]: string | number;
}

@Component({
  selector: 'app-grni',
  standalone: true,
  imports: [TranslatePipe, PageHeaderComponent, CurrencyDisplayComponent, DataTableComponent, ColumnCellDirective],
  templateUrl: './grni.component.html',
  styleUrl: './grni.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrniComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<GrniReconciliation | null>(null);

  /** Open-GRNI-by-PO columns: PO + Vendor + one per aging bucket + Open. */
  protected readonly poColumns = computed<ColumnDef[]>(() => {
    const r = this.report();
    if (!r) return [];
    const buckets: ColumnDef[] = r.totalsByBucket.map((b, i) => ({
      field: `b${i}`, header: b.label, sortable: true, type: 'number', align: 'right', width: '120px',
    }));
    return [
      { field: 'poNumber', header: this.translate.instant('accounting.common.po'), sortable: true, width: '120px' },
      { field: 'vendorName', header: this.translate.instant('accounting.common.vendor'), sortable: true },
      ...buckets,
      { field: 'openAmount', header: this.translate.instant('accounting.common.open'), sortable: true, type: 'number', align: 'right', width: '130px' },
    ];
  });

  protected readonly poRows = computed<GrniPoTableRow[]>(() => {
    const r = this.report();
    if (!r) return [];
    return r.purchaseOrders.map((po) => {
      const row: GrniPoTableRow = { poNumber: po.poNumber, vendorName: po.vendorName, openAmount: po.openAmount };
      po.buckets.forEach((b, i) => (row[`b${i}`] = b.amount));
      return row;
    });
  });

  protected readonly uncoveredColumns: ColumnDef[] = [
    { field: 'receiptNumber', header: this.translate.instant('accounting.grni.receipt'), sortable: true, width: '140px' },
    { field: 'purchaseOrderId', header: this.translate.instant('accounting.common.po'), sortable: true, type: 'number', align: 'right', width: '90px' },
    { field: 'quantityReceived', header: this.translate.instant('accounting.grni.qty'), sortable: true, type: 'number', align: 'right', width: '90px' },
    { field: 'receivedDate', header: this.translate.instant('accounting.grni.received'), sortable: true, type: 'date', width: '130px' },
    { field: 'reason', header: this.translate.instant('accounting.grni.reason') },
  ];

  constructor() {
    autoRefreshOnGlChange(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getGrniReconciliation(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.grniLoadFailed'));
          this.loading.set(false);
        },
      });
  }
}
