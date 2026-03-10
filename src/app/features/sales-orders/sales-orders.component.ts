import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { SalesOrderService } from './services/sales-order.service';
import { SalesOrderListItem } from './models/sales-order-list-item.model';
import { SalesOrderDetail } from './models/sales-order-detail.model';
import { CustomerService } from '../customers/services/customer.service';
import { CustomerListItem } from '../customers/models/customer-list-item.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SoDialogComponent } from './components/so-dialog/so-dialog.component';

@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    SoDialogComponent,
  ],
  templateUrl: './sales-orders.component.html',
  styleUrl: './sales-orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrdersComponent {
  private readonly soService = inject(SalesOrderService);
  private readonly customerService = inject(CustomerService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly showCreateDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly salesOrders = signal<SalesOrderListItem[]>([]);
  protected readonly selectedSo = signal<SalesOrderDetail | null>(null);
  protected readonly customers = signal<CustomerListItem[]>([]);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly customerFilterControl = new FormControl<number | null>(null);
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'All Customers' },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: 'All Statuses' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Confirmed', label: 'Confirmed' },
    { value: 'InProduction', label: 'In Production' },
    { value: 'PartiallyShipped', label: 'Partially Shipped' },
    { value: 'Shipped', label: 'Shipped' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  protected readonly soColumns: ColumnDef[] = [
    { field: 'orderNumber', header: 'Order #', sortable: true, width: '120px' },
    { field: 'customerName', header: 'Customer', sortable: true },
    { field: 'customerPO', header: 'Cust PO', sortable: true, width: '100px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '140px', filterOptions: [
      { value: 'Draft', label: 'Draft' },
      { value: 'Confirmed', label: 'Confirmed' },
      { value: 'InProduction', label: 'In Production' },
      { value: 'PartiallyShipped', label: 'Partially Shipped' },
      { value: 'Shipped', label: 'Shipped' },
      { value: 'Completed', label: 'Completed' },
      { value: 'Cancelled', label: 'Cancelled' },
    ]},
    { field: 'lineCount', header: 'Lines', sortable: true, width: '70px', align: 'center' },
    { field: 'total', header: 'Total', sortable: true, width: '100px', align: 'right' },
    { field: 'requestedDeliveryDate', header: 'Delivery', sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly soRowClass = (row: unknown) => {
    const so = row as SalesOrderListItem;
    return so.id === this.selectedSo()?.id ? 'row--selected' : '';
  };

  constructor() {
    this.loadSalesOrders();
    this.customerService.getCustomers(undefined, true).subscribe({
      next: (list) => this.customers.set(list),
    });
  }

  protected loadSalesOrders(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const customerId = this.customerFilterControl.value ?? undefined;
    const status = this.statusFilterControl.value ?? undefined;
    this.soService.getSalesOrders(customerId, status, search).subscribe({
      next: (list) => { this.salesOrders.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadSalesOrders(); }

  protected selectSo(item: SalesOrderListItem): void {
    this.soService.getSalesOrderById(item.id).subscribe({
      next: (detail) => this.selectedSo.set(detail),
    });
  }

  protected closeDetail(): void { this.selectedSo.set(null); }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadSalesOrders();
  }

  // --- Status Actions ---
  protected confirmSo(): void {
    const so = this.selectedSo();
    if (!so) return;
    this.soService.confirmSalesOrder(so.id).subscribe({
      next: () => {
        this.refreshDetail(so.id);
        this.loadSalesOrders();
        this.snackbar.success('Sales order confirmed.');
      },
    });
  }

  protected cancelSo(): void {
    const so = this.selectedSo();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Cancel Sales Order?',
        message: `Cancel "${so.orderNumber}"? This action cannot be undone.`,
        confirmLabel: 'Cancel Order',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.cancelSalesOrder(so.id).subscribe({
        next: () => {
          this.refreshDetail(so.id);
          this.loadSalesOrders();
          this.snackbar.success('Sales order cancelled.');
        },
      });
    });
  }

  protected deleteSo(): void {
    const so = this.selectedSo();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Sales Order?',
        message: `Delete draft "${so.orderNumber}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.deleteSalesOrder(so.id).subscribe({
        next: () => {
          this.selectedSo.set(null);
          this.loadSalesOrders();
          this.snackbar.success('Sales order deleted.');
        },
      });
    });
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Confirmed: 'chip--primary',
      InProduction: 'chip--info',
      PartiallyShipped: 'chip--warning',
      Shipped: 'chip--success',
      Completed: 'chip--success',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      InProduction: 'In Production',
      PartiallyShipped: 'Partially Shipped',
    };
    return map[status] ?? status;
  }

  protected canConfirm(status: string): boolean { return status === 'Draft'; }
  protected canCancel(status: string): boolean { return status === 'Draft' || status === 'Confirmed'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  private refreshDetail(id: number): void {
    this.soService.getSalesOrderById(id).subscribe(d => this.selectedSo.set(d));
  }
}
