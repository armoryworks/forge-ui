import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { QuoteService } from './services/quote.service';
import { QuoteListItem } from './models/quote-list-item.model';
import { QuoteDetail } from './models/quote-detail.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { QuoteDialogComponent } from './components/quote-dialog/quote-dialog.component';

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    QuoteDialogComponent,
  ],
  templateUrl: './quotes.component.html',
  styleUrl: './quotes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotesComponent {
  private readonly quoteService = inject(QuoteService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly showCreateDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly quotes = signal<QuoteListItem[]>([]);
  protected readonly selectedQuote = signal<QuoteDetail | null>(null);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: 'All Statuses' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Sent', label: 'Sent' },
    { value: 'Accepted', label: 'Accepted' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Expired', label: 'Expired' },
    { value: 'ConvertedToOrder', label: 'Converted to Order' },
  ];

  protected readonly quoteColumns: ColumnDef[] = [
    { field: 'quoteNumber', header: 'Quote #', sortable: true, width: '120px' },
    { field: 'customerName', header: 'Customer', sortable: true },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '140px', filterOptions: [
      { value: 'Draft', label: 'Draft' },
      { value: 'Sent', label: 'Sent' },
      { value: 'Accepted', label: 'Accepted' },
      { value: 'Rejected', label: 'Rejected' },
      { value: 'Expired', label: 'Expired' },
      { value: 'ConvertedToOrder', label: 'Converted to Order' },
    ]},
    { field: 'lineCount', header: 'Lines', sortable: true, width: '70px', align: 'center' },
    { field: 'total', header: 'Total', sortable: true, width: '100px', align: 'right' },
    { field: 'expirationDate', header: 'Expires', sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly quoteRowClass = (row: unknown) => {
    const quote = row as QuoteListItem;
    return quote.id === this.selectedQuote()?.id ? 'row--selected' : '';
  };

  constructor() {
    this.loadQuotes();
  }

  protected loadQuotes(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value ?? undefined;
    this.quoteService.getQuotes(undefined, status).subscribe({
      next: (list) => { this.quotes.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadQuotes(); }

  protected selectQuote(item: QuoteListItem): void {
    this.quoteService.getQuoteById(item.id).subscribe({
      next: (detail) => this.selectedQuote.set(detail),
    });
  }

  protected closeDetail(): void { this.selectedQuote.set(null); }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadQuotes();
  }

  // --- Status Actions ---
  protected sendQuote(): void {
    const quote = this.selectedQuote();
    if (!quote) return;
    this.quoteService.sendQuote(quote.id).subscribe({
      next: () => {
        this.refreshDetail(quote.id);
        this.loadQuotes();
        this.snackbar.success('Quote sent.');
      },
    });
  }

  protected acceptQuote(): void {
    const quote = this.selectedQuote();
    if (!quote) return;
    this.quoteService.acceptQuote(quote.id).subscribe({
      next: () => {
        this.refreshDetail(quote.id);
        this.loadQuotes();
        this.snackbar.success('Quote accepted.');
      },
    });
  }

  protected rejectQuote(): void {
    const quote = this.selectedQuote();
    if (!quote) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Reject Quote?',
        message: `Reject "${quote.quoteNumber}"? This action cannot be undone.`,
        confirmLabel: 'Reject',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.rejectQuote(quote.id).subscribe({
        next: () => {
          this.refreshDetail(quote.id);
          this.loadQuotes();
          this.snackbar.success('Quote rejected.');
        },
      });
    });
  }

  protected convertToOrder(): void {
    const quote = this.selectedQuote();
    if (!quote) return;
    this.quoteService.convertToOrder(quote.id).subscribe({
      next: (order) => {
        this.refreshDetail(quote.id);
        this.loadQuotes();
        this.snackbar.success(`Quote converted to order ${order.salesOrderNumber ?? ''}.`);
      },
    });
  }

  protected deleteQuote(): void {
    const quote = this.selectedQuote();
    if (!quote) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Quote?',
        message: `Delete draft "${quote.quoteNumber}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.deleteQuote(quote.id).subscribe({
        next: () => {
          this.selectedQuote.set(null);
          this.loadQuotes();
          this.snackbar.success('Quote deleted.');
        },
      });
    });
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Sent: 'chip--info',
      Accepted: 'chip--success',
      Rejected: 'chip--error',
      Expired: 'chip--warning',
      ConvertedToOrder: 'chip--primary',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    return status === 'ConvertedToOrder' ? 'Converted to Order' : status;
  }

  protected canSend(status: string): boolean { return status === 'Draft'; }
  protected canAccept(status: string): boolean { return status === 'Sent'; }
  protected canReject(status: string): boolean { return status === 'Sent'; }
  protected canConvert(status: string): boolean { return status === 'Accepted'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  private refreshDetail(id: number): void {
    this.quoteService.getQuoteById(id).subscribe(d => this.selectedQuote.set(d));
  }
}
