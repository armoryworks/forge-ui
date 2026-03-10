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

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    PoDialogComponent, ReceiveDialogComponent, LoadingBlockDirective,
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
    { value: null, label: 'All Vendors' },
    ...this.vendors().map(v => ({ value: v.id, label: v.companyName })),
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: 'All Statuses' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Submitted', label: 'Submitted' },
    { value: 'Acknowledged', label: 'Acknowledged' },
    { value: 'PartiallyReceived', label: 'Partially Received' },
    { value: 'Received', label: 'Received' },
    { value: 'Closed', label: 'Closed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  protected readonly poColumns: ColumnDef[] = [
    { field: 'poNumber', header: 'PO #', sortable: true, width: '120px' },
    { field: 'vendorName', header: 'Vendor', sortable: true },
    { field: 'jobNumber', header: 'Job', sortable: true, width: '100px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '140px', filterOptions: [
      { value: 'Draft', label: 'Draft' },
      { value: 'Submitted', label: 'Submitted' },
      { value: 'Acknowledged', label: 'Acknowledged' },
      { value: 'PartiallyReceived', label: 'Partially Received' },
      { value: 'Received', label: 'Received' },
      { value: 'Closed', label: 'Closed' },
      { value: 'Cancelled', label: 'Cancelled' },
    ]},
    { field: 'lineCount', header: 'Lines', sortable: true, width: '70px', align: 'center' },
    { field: 'totalOrdered', header: 'Ordered', sortable: true, width: '90px', align: 'center' },
    { field: 'totalReceived', header: 'Received', sortable: true, width: '90px', align: 'center' },
    { field: 'expectedDeliveryDate', header: 'Expected', sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
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
        this.snackbar.success('Purchase order submitted.');
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
        this.snackbar.success('Purchase order acknowledged.');
      },
    });
  }

  protected cancelPo(): void {
    const po = this.selectedPo();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Cancel Purchase Order?',
        message: `Cancel "${po.poNumber}"? This action cannot be undone.`,
        confirmLabel: 'Cancel PO',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.cancelPurchaseOrder(po.id).subscribe({
        next: () => {
          this.refreshDetail(po.id);
          this.loadPurchaseOrders();
          this.snackbar.success('Purchase order cancelled.');
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
        this.snackbar.success('Purchase order closed.');
      },
    });
  }

  protected deletePo(): void {
    const po = this.selectedPo();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Purchase Order?',
        message: `Delete draft "${po.poNumber}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.deletePurchaseOrder(po.id).subscribe({
        next: () => {
          this.selectedPo.set(null);
          this.loadPurchaseOrders();
          this.snackbar.success('Purchase order deleted.');
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
    return status === 'PartiallyReceived' ? 'Partially Received' : status;
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
