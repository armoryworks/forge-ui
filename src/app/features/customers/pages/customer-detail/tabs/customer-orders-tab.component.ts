import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { CurrencyDisplayComponent } from '../../../../../shared/components/currency-display/currency-display.component';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

interface SalesOrderListItem {
  id: number;
  orderNumber: string;
  status: string;
  lineCount: number;
  total: number;
  requestedDeliveryDate?: string;
  createdAt: string;
}

@Component({
  selector: 'app-customer-orders-tab',
  standalone: true,
  imports: [DatePipe, TranslatePipe, DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent],
  templateUrl: './customer-orders-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerOrdersTabComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly customerId = input.required<number>();

  protected readonly orders = signal<SalesOrderListItem[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'orderNumber', header: this.translate.instant('customers.tabs.colOrderNumber'), sortable: true, width: '100px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'lineCount', header: this.translate.instant('customers.tabs.colLines'), sortable: true, width: '70px', align: 'center' },
    { field: 'total', header: this.translate.instant('customers.tabs.colTotal'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'requestedDeliveryDate', header: this.translate.instant('customers.tabs.colReqDate'), sortable: true, type: 'date', width: '100px' },
    { field: 'createdAt', header: this.translate.instant('customers.colCreated'), sortable: true, type: 'date', width: '100px' },
  ];

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted', Confirmed: 'chip--info', InProduction: 'chip--primary',
      Shipped: 'chip--success', Completed: 'chip--success', Cancelled: 'chip--error',
    };
    return map[status] ?? 'chip--muted';
  }

  ngOnInit(): void {
    this.loading.set(true);
    const params = new HttpParams().set('customerId', String(this.customerId()));
    this.http.get<SalesOrderListItem[]>(`${environment.apiUrl}/orders`, { params }).subscribe({
      next: data => { this.orders.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openOrder(order: SalesOrderListItem): void {
    this.router.navigate(['/sales-orders'], { queryParams: { id: order.id } });
  }
}
