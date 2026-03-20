import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { PurchaseOrderService } from './services/purchase-order.service';
import { PurchaseOrderListItem } from './models/purchase-order-list-item.model';
import { PurchaseOrderDetail } from './models/purchase-order-detail.model';
import { VendorService } from '../vendors/services/vendor.service';
import { VendorResponse } from '../vendors/models/vendor-response.model';
import { PoDialogComponent } from './components/po-dialog/po-dialog.component';
import { ReceiveDialogComponent } from './components/receive-dialog/receive-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { BarcodeInfoComponent } from '../../shared/components/barcode-info/barcode-info.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    PoDialogComponent, ReceiveDialogComponent, LoadingBlockDirective, BarcodeInfoComponent, MatTooltipModule,
  ],
  templateUrl: './purchase-orders.component.html',
  styleUrl: './purchase-orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrdersComponent {
  private readonly poService = inject(PurchaseOrderService);
  private readonly vendorService = inject(VendorService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly purchaseOrders = signal<PurchaseOrderListItem[]>([]);
  protected readonly selectedPo = signal<PurchaseOrderDetail | null>(null);
  protected readonly vendors = signal<VendorResponse[]>([]);

  // Dialogs
  protected readonly showCreateDialog = signal(false);
  protected readonly showReceiveDialog = signal(false);

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

  protected readonly poRowClass = (row: unknown) => {
    const po = row as PurchaseOrderListItem;
    return po.id === this.selectedPo()?.id ? 'row--selected' : '';
  };

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

  protected selectPo(item: PurchaseOrderListItem): void {
    this.poService.getPurchaseOrderById(item.id).subscribe({
      next: (detail) => this.selectedPo.set(detail),
    });
  }

  protected closeDetail(): void { this.selectedPo.set(null); }

  // --- Create ---
  protected openCreatePo(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }

  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadPurchaseOrders();
  }

  // --- Receive ---
  protected openReceiveDialog(): void { this.showReceiveDialog.set(true); }
  protected closeReceiveDialog(): void { this.showReceiveDialog.set(false); }

  protected onReceiveSaved(): void {
    this.closeReceiveDialog();
    this.loadPurchaseOrders();
    const po = this.selectedPo();
    if (po) {
      this.poService.getPurchaseOrderById(po.id).subscribe(d => this.selectedPo.set(d));
    }
  }

  // --- Status Actions ---
  protected submitPo(): void {
    const po = this.selectedPo();
    if (!po) return;
    this.poService.submitPurchaseOrder(po.id).subscribe({
      next: () => {
        this.refreshDetail(po.id);
        this.loadPurchaseOrders();
        this.snackbar.success(this.translate.instant('purchaseOrders.poSubmitted'));
      },
    });
  }

  protected acknowledgePo(): void {
    const po = this.selectedPo();
    if (!po) return;
    this.poService.acknowledgePurchaseOrder(po.id).subscribe({
      next: () => {
        this.refreshDetail(po.id);
        this.loadPurchaseOrders();
        this.snackbar.success(this.translate.instant('purchaseOrders.poAcknowledged'));
      },
    });
  }

  protected cancelPo(): void {
    const po = this.selectedPo();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('purchaseOrders.cancelPoTitle'),
        message: this.translate.instant('purchaseOrders.cancelPoMessage', { number: po.poNumber }),
        confirmLabel: this.translate.instant('purchaseOrders.cancelPo'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.cancelPurchaseOrder(po.id).subscribe({
        next: () => {
          this.refreshDetail(po.id);
          this.loadPurchaseOrders();
          this.snackbar.success(this.translate.instant('purchaseOrders.poCancelled'));
        },
      });
    });
  }

  protected closePo(): void {
    const po = this.selectedPo();
    if (!po) return;
    this.poService.closePurchaseOrder(po.id).subscribe({
      next: () => {
        this.refreshDetail(po.id);
        this.loadPurchaseOrders();
        this.snackbar.success(this.translate.instant('purchaseOrders.poClosed'));
      },
    });
  }

  protected deletePo(): void {
    const po = this.selectedPo();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('purchaseOrders.deletePoTitle'),
        message: this.translate.instant('purchaseOrders.deletePoMessage', { number: po.poNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.deletePurchaseOrder(po.id).subscribe({
        next: () => {
          this.selectedPo.set(null);
          this.loadPurchaseOrders();
          this.snackbar.success(this.translate.instant('purchaseOrders.poDeleted'));
        },
      });
    });
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

  protected canSubmit(status: string): boolean { return status === 'Draft'; }
  protected canAcknowledge(status: string): boolean { return status === 'Submitted'; }
  protected canReceive(status: string): boolean {
    return status === 'Acknowledged' || status === 'PartiallyReceived';
  }
  protected canCancel(status: string): boolean {
    return status === 'Draft' || status === 'Submitted' || status === 'Acknowledged';
  }
  protected canClose(status: string): boolean { return status === 'Received'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  private refreshDetail(id: number): void {
    this.poService.getPurchaseOrderById(id).subscribe(d => this.selectedPo.set(d));
  }
}
