import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { PagedResponse } from '../../../../../shared/models/paged-response.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { CurrencyDisplayComponent } from '../../../../../shared/components/currency-display/currency-display.component';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../../shared/pipes/date-only.pipe';
import { AuthService } from '../../../../../shared/services/auth.service';
import { downloadBlob } from '../../../../../shared/utils/download-blob';
import { CUSTOMER_COMMERCIAL_TERMS_ROLES } from '../../../customer-roles';
import { CustomerService } from '../../../services/customer.service';

interface InvoiceListItem {
  id: number;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  total: number;
  dueDate?: string;
  createdAt: string;
  currencyCode?: string | null;
}

@Component({
  selector: 'app-customer-invoices-tab',
  standalone: true,
  imports: [DateOnlyPipe, DatePipe, TranslatePipe, DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent],
  templateUrl: './customer-invoices-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerInvoicesTabComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly customerService = inject(CustomerService);

  readonly customerId = input.required<number>();
  readonly customerName = input<string | null>(null);

  protected readonly canDownloadStatement = this.auth.hasAnyRole(CUSTOMER_COMMERCIAL_TERMS_ROLES);
  protected readonly downloadingStatement = signal(false);

  protected readonly invoices = signal<InvoiceListItem[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'invoiceNumber', header: this.translate.instant('customers.tabs.colInvoiceNumber'), sortable: true, width: '110px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'total', header: this.translate.instant('customers.tabs.colTotal'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'dueDate', header: this.translate.instant('customers.tabs.colDueDate'), sortable: true, type: 'date', width: '100px' },
    { field: 'createdAt', header: this.translate.instant('customers.colCreated'), sortable: true, type: 'date', width: '100px' },
  ];

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted', Sent: 'chip--info', PartiallyPaid: 'chip--warning',
      Paid: 'chip--success', Overdue: 'chip--error', Void: 'chip--muted',
    };
    return map[status] ?? 'chip--muted';
  }

  ngOnInit(): void {
    // Phase 3 F7-broad / WU-22 — server returns paged envelope on /invoices.
    this.loading.set(true);
    const params = new HttpParams()
      .set('customerId', String(this.customerId()))
      .set('pageSize', '200');
    this.http.get<PagedResponse<InvoiceListItem>>(`${environment.apiUrl}/invoices`, { params }).subscribe({
      next: paged => { this.invoices.set(paged.items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected downloadStatement(): void {
    if (this.downloadingStatement()) return;
    this.downloadingStatement.set(true);
    const id = this.customerId();
    this.customerService.getStatementPdf(id).subscribe({
      next: blob => {
        this.downloadingStatement.set(false);
        downloadBlob(blob, statementFileName(this.customerName(), id, new Date()));
      },
      error: () => this.downloadingStatement.set(false),
    });
  }

  protected openInvoice(invoice: InvoiceListItem): void {
    this.router.navigate(['/invoices'], { queryParams: { id: invoice.id } });
  }
}

export function statementFileName(customerName: string | null, customerId: number, on: Date): string {
  const slug = (customerName ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const date = `${on.getFullYear()}-${String(on.getMonth() + 1).padStart(2, '0')}-${String(on.getDate()).padStart(2, '0')}`;
  return `statement-${slug || customerId}-${date}.pdf`;
}
