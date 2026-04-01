import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

interface InvoiceListItem {
  id: number;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  total: number;
  dueDate?: string;
  createdAt: string;
}

@Component({
  selector: 'app-customer-invoices-tab',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './customer-invoices-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerInvoicesTabComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly customerId = input.required<number>();

  protected readonly invoices = signal<InvoiceListItem[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'invoiceNumber', header: 'Invoice #', sortable: true, width: '110px' },
    { field: 'status', header: 'Status', sortable: true, width: '120px' },
    { field: 'total', header: 'Total', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'dueDate', header: 'Due Date', sortable: true, type: 'date', width: '100px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '100px' },
  ];

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted', Sent: 'chip--info', PartiallyPaid: 'chip--warning',
      Paid: 'chip--success', Overdue: 'chip--error', Void: 'chip--muted',
    };
    return map[status] ?? 'chip--muted';
  }

  ngOnInit(): void {
    this.loading.set(true);
    const params = new HttpParams().set('customerId', String(this.customerId()));
    this.http.get<InvoiceListItem[]>(`${environment.apiUrl}/invoices`, { params }).subscribe({
      next: data => { this.invoices.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openInvoice(invoice: InvoiceListItem): void {
    this.router.navigate(['/invoices'], { queryParams: { id: invoice.id } });
  }
}
