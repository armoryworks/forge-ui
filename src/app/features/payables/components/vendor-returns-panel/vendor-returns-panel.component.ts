import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { VendorReturnService } from '../../services/vendor-return.service';
import { VendorReturnListItem } from '../../models/vendor-return-list-item.model';
import { VendorReturnDetailDialogData } from '../../models/vendor-return-detail-dialog-data.model';
import { vendorCreditStatusChip } from '../../vendor-credit-status';
import { VendorReturnDetailDialogComponent } from '../vendor-return-detail-dialog/vendor-return-detail-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DetailDialogService } from '../../../../shared/services/detail-dialog.service';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

const STATUSES = ['Open', 'Shipped', 'Credited', 'Closed'];

/** Payables > Vendor returns: returns to vendor opened by NCR dispositions, to ship and credit. */
@Component({
  selector: 'app-vendor-returns-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateOnlyPipe,
    DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent, SelectComponent, LoadingBlockDirective,
  ],
  templateUrl: './vendor-returns-panel.component.html',
  styleUrl: './vendor-returns-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorReturnsPanelComponent {
  private readonly service = inject(VendorReturnService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly translate = inject(TranslateService);

  readonly vendorOptions = input<SelectOption[]>([]);

  protected readonly loading = signal(false);
  protected readonly returns = signal<VendorReturnListItem[]>([]);

  protected readonly filters = new FormGroup({
    vendorId: new FormControl<number | null>(null),
    status: new FormControl<string | null>(null),
  });

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('payables.allStatuses') },
    ...STATUSES.map(s => ({ value: s, label: this.translate.instant(`vendorReturns.status.${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'returnNumber', header: this.translate.instant('vendorReturns.number'), sortable: true, width: '120px' },
    { field: 'vendorName', header: this.translate.instant('payables.vendor'), sortable: true },
    { field: 'ncrNumber', header: this.translate.instant('vendorReturns.ncr'), sortable: true, width: '120px' },
    { field: 'purchaseOrderNumber', header: this.translate.instant('vendorReturns.purchaseOrder'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'quantity', header: this.translate.instant('vendorReturns.quantity'), sortable: true, width: '90px', align: 'right' },
    { field: 'expectedCredit', header: this.translate.instant('vendorReturns.expectedCredit'), sortable: true, width: '120px', align: 'right' },
    { field: 'shipDate', header: this.translate.instant('vendorReturns.shipDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'vendorCreditMemoNumber', header: this.translate.instant('vendorReturns.vendorCredit'), sortable: true, width: '120px' },
  ];

  constructor() {
    merge(this.filters.controls.vendorId.valueChanges, this.filters.controls.status.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
    this.load();
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'vendor-return') this.openDetail(detail.entityId);
  }

  protected load(): void {
    const { vendorId, status } = this.filters.getRawValue();
    this.loading.set(true);
    this.service.getReturns(vendorId, status).subscribe({
      next: list => {
        this.returns.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(status: string): string {
    return vendorCreditStatusChip(status);
  }

  protected openDetail(id: number): void {
    this.detailDialog.open<VendorReturnDetailDialogComponent, VendorReturnDetailDialogData, boolean>(
      'vendor-return', id, VendorReturnDetailDialogComponent, { returnId: id }, { width: '760px' },
    ).afterClosed().subscribe(changed => {
      if (changed) this.load();
    });
  }
}
