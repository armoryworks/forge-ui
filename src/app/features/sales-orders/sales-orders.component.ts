import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { SalesOrderService } from './services/sales-order.service';
import { SalesOrderListItem } from './models/sales-order-list-item.model';
import { CustomerService } from '../customers/services/customer.service';
import { CustomerListItem } from '../customers/models/customer-list-item.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';
import { SoDialogComponent } from './components/so-dialog/so-dialog.component';
import { SalesOrderDetailDialogComponent, SalesOrderDetailDialogData } from './components/sales-order-detail-dialog/sales-order-detail-dialog.component';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    CurrencyDisplayComponent, SoDialogComponent,
  ],
  templateUrl: './sales-orders.component.html',
  styleUrl: './sales-orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrdersComponent {
  private readonly soService = inject(SalesOrderService);
  private readonly customerService = inject(CustomerService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showCreateDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly salesOrders = signal<SalesOrderListItem[]>([]);
  protected readonly customers = signal<CustomerListItem[]>([]);
  /** Phase 3 F1 partial / WU-18 — total rows reported by the paged endpoint. */
  protected readonly totalCount = signal(0);

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

  protected readonly soRowClass = (_row: unknown) => '';

  constructor() {
    this.loadSalesOrders();
    this.customerService.getCustomers(undefined, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.customers.set(list),
    });
  }

  protected loadSalesOrders(): void {
    this.loading.set(true);
    const search = (this.searchTerm() ?? '').trim() || undefined;
    const customerId = this.customerFilterControl.value ?? undefined;
    const status = this.statusFilterControl.value ?? undefined;
    // Phase 3 F1 partial / WU-18 — consume the paged Job-projected list.
    // The component still works in-memory inside the data-table within the
    // 200-row server window; totalCount surfaces the full server-side count.
    this.soService.getSalesOrdersPaged({
      customerId,
      status,
      q: search,
      pageSize: 200,
      sort: 'createdAt',
      order: 'desc',
    }).subscribe({
      next: (page) => {
        this.salesOrders.set(page.items);
        this.totalCount.set(page.totalCount);
        this.loading.set(false);
        const detail = this.detailDialog.getDetailFromUrl();
        if (detail?.entityType === 'sales-order') {
          this.openSalesOrderDetail({ id: detail.entityId } as SalesOrderListItem);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadSalesOrders(); }

  protected openSalesOrderDetail(item: SalesOrderListItem): void {
    const ref = this.detailDialog.open<SalesOrderDetailDialogComponent, SalesOrderDetailDialogData>(
      'sales-order',
      item.id,
      SalesOrderDetailDialogComponent,
      { salesOrderId: item.id },
    );
    ref.afterClosed().subscribe(() => this.loadSalesOrders());
  }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadSalesOrders();
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
}
