import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { PurchaseOrderService } from './services/purchase-order.service';
import { PurchaseOrderListItem } from './models/purchase-order-list-item.model';
import { VendorService } from '../vendors/services/vendor.service';
import { VendorResponse } from '../vendors/models/vendor-response.model';
import { PoDialogComponent } from './components/po-dialog/po-dialog.component';
import { PoDetailDialogComponent, PoDetailDialogData } from './components/po-detail-dialog/po-detail-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { openDetailDialog } from '../../shared/utils/detail-dialog.utils';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    PoDialogComponent, LoadingBlockDirective,
  ],
  templateUrl: './purchase-orders.component.html',
  styleUrl: './purchase-orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrdersComponent {
  private readonly poService = inject(PurchaseOrderService);
  private readonly vendorService = inject(VendorService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly purchaseOrders = signal<PurchaseOrderListItem[]>([]);
  protected readonly vendors = signal<VendorResponse[]>([]);

  // Dialogs
  protected readonly showCreateDialog = signal(false);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly vendorFilterControl = new FormControl<number | null>(null);
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly vendorOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('purchaseOrders.allVendors') },
    ...this.vendors().map(v => ({ value: v.id, label: v.companyName })),
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    { value: 'Draft', label: this.translate.instant('status.draft') },
    { value: 'Submitted', label: this.translate.instant('purchaseOrders.statusSubmitted') },
    { value: 'Acknowledged', label: this.translate.instant('purchaseOrders.statusAcknowledged') },
    { value: 'PartiallyReceived', label: this.translate.instant('purchaseOrders.statusPartiallyReceived') },
    { value: 'Received', label: this.translate.instant('purchaseOrders.statusReceived') },
    { value: 'Closed', label: this.translate.instant('status.closed') },
    { value: 'Cancelled', label: this.translate.instant('status.cancelled') },
  ];

  protected readonly poColumns: ColumnDef[] = [
    { field: 'poNumber', header: this.translate.instant('purchaseOrders.poNumber'), sortable: true, width: '120px' },
    { field: 'vendorName', header: this.translate.instant('purchaseOrders.vendor'), sortable: true },
    { field: 'jobNumber', header: this.translate.instant('purchaseOrders.job'), sortable: true, width: '100px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '140px', filterOptions: this.statusOptions.slice(1) },
    { field: 'lineCount', header: this.translate.instant('purchaseOrders.lines'), sortable: true, width: '70px', align: 'center' },
    { field: 'totalOrdered', header: this.translate.instant('purchaseOrders.ordered'), sortable: true, width: '90px', align: 'center' },
    { field: 'totalReceived', header: this.translate.instant('purchaseOrders.received'), sortable: true, width: '90px', align: 'center' },
    { field: 'expectedDeliveryDate', header: this.translate.instant('purchaseOrders.expected'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.loadPurchaseOrders();
    this.vendorService.getVendorDropdown().subscribe({
      next: (list) => this.vendors.set(list),
    });
  }

  protected loadPurchaseOrders(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const vendorId = this.vendorFilterControl.value ?? undefined;
    const status = this.statusFilterControl.value ?? undefined;
    this.poService.getPurchaseOrders(vendorId, undefined, status, search).subscribe({
      next: (list) => { this.purchaseOrders.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadPurchaseOrders(); }

  protected openPurchaseOrderDetail(item: PurchaseOrderListItem): void {
    openDetailDialog<PoDetailDialogComponent, PoDetailDialogData, boolean>(
      this.dialog,
      PoDetailDialogComponent,
      { purchaseOrderId: item.id },
    ).afterClosed().subscribe(changed => {
      if (changed) this.loadPurchaseOrders();
    });
  }

  // --- Create ---
  protected openCreatePo(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }

  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadPurchaseOrders();
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Submitted: 'chip--info',
      Acknowledged: 'chip--primary',
      PartiallyReceived: 'chip--warning',
      Received: 'chip--success',
      Closed: 'chip--muted',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'purchaseOrders.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }
}
