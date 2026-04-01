import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

interface QuoteListItem {
  id: number;
  quoteNumber: string;
  status: string;
  lineCount: number;
  total: number;
  expirationDate?: string;
  createdAt: string;
}

@Component({
  selector: 'app-customer-quotes-tab',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './customer-quotes-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerQuotesTabComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly customerId = input.required<number>();

  protected readonly quotes = signal<QuoteListItem[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'quoteNumber', header: 'Quote #', sortable: true, width: '100px' },
    { field: 'status', header: 'Status', sortable: true, width: '110px' },
    { field: 'lineCount', header: 'Lines', sortable: true, width: '70px', align: 'center' },
    { field: 'total', header: 'Total', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'expirationDate', header: 'Expires', sortable: true, type: 'date', width: '100px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '100px' },
  ];

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted', Sent: 'chip--info', Accepted: 'chip--success',
      Rejected: 'chip--error', Expired: 'chip--warning', Converted: 'chip--primary',
    };
    return map[status] ?? 'chip--muted';
  }

  ngOnInit(): void {
    this.loading.set(true);
    const params = new HttpParams().set('customerId', String(this.customerId()));
    this.http.get<QuoteListItem[]>(`${environment.apiUrl}/quotes`, { params }).subscribe({
      next: data => { this.quotes.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openQuote(quote: QuoteListItem): void {
    this.router.navigate(['/quotes'], { queryParams: { id: quote.id } });
  }
}
