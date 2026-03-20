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
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SoDialogComponent } from './components/so-dialog/so-dialog.component';
import { BarcodeInfoComponent } from '../../shared/components/barcode-info/barcode-info.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    SoDialogComponent, BarcodeInfoComponent, MatTooltipModule,
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
  private readonly translate = inject(TranslateService);

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
    { value: null, label: this.translate.instant('salesOrders.allCustomers') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    { value: 'Draft', label: this.translate.instant('status.draft') },
    { value: 'Confirmed', label: this.translate.instant('salesOrders.statusConfirmed') },
    { value: 'InProduction', label: this.translate.instant('salesOrders.statusInProduction') },
    { value: 'PartiallyShipped', label: this.translate.instant('salesOrders.statusPartiallyShipped') },
    { value: 'Shipped', label: this.translate.instant('salesOrders.statusShipped') },
    { value: 'Completed', label: this.translate.instant('status.completed') },
    { value: 'Cancelled', label: this.translate.instant('status.cancelled') },
  ];

  protected readonly soColumns: ColumnDef[] = [
    { field: 'orderNumber', header: this.translate.instant('salesOrders.orderNumber'), sortable: true, width: '120px' },
    { field: 'customerName', header: this.translate.instant('salesOrders.customer'), sortable: true },
    { field: 'customerPO', header: this.translate.instant('salesOrders.custPo'), sortable: true, width: '100px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '140px', filterOptions: this.statusOptions.slice(1) },
    { field: 'lineCount', header: this.translate.instant('salesOrders.lines'), sortable: true, width: '70px', align: 'center' },
    { field: 'total', header: this.translate.instant('common.total'), sortable: true, width: '100px', align: 'right' },
    { field: 'requestedDeliveryDate', header: this.translate.instant('salesOrders.delivery'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
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
        this.snackbar.success(this.translate.instant('salesOrders.soConfirmed'));
      },
    });
  }

  protected cancelSo(): void {
    const so = this.selectedSo();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.cancelSoTitle'),
        message: this.translate.instant('salesOrders.cancelSoMessage', { number: so.orderNumber }),
        confirmLabel: this.translate.instant('salesOrders.cancelOrder'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.cancelSalesOrder(so.id).subscribe({
        next: () => {
          this.refreshDetail(so.id);
          this.loadSalesOrders();
          this.snackbar.success(this.translate.instant('salesOrders.soCancelled'));
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
        title: this.translate.instant('salesOrders.deleteSoTitle'),
        message: this.translate.instant('salesOrders.deleteSoMessage', { number: so.orderNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.deleteSalesOrder(so.id).subscribe({
        next: () => {
          this.selectedSo.set(null);
          this.loadSalesOrders();
          this.snackbar.success(this.translate.instant('salesOrders.soDeleted'));
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
    const key = 'salesOrders.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected canConfirm(status: string): boolean { return status === 'Draft'; }
  protected canCancel(status: string): boolean { return status === 'Draft' || status === 'Confirmed'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  private refreshDetail(id: number): void {
    this.soService.getSalesOrderById(id).subscribe(d => this.selectedSo.set(d));
  }
}
