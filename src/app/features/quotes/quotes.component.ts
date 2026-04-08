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
import { MatTooltipModule } from '@angular/material/tooltip';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { QuoteDialogComponent } from './components/quote-dialog/quote-dialog.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective, MatTooltipModule,
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
  private readonly translate = inject(TranslateService);

  protected readonly showCreateDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly quotes = signal<QuoteListItem[]>([]);
  protected readonly selectedQuote = signal<QuoteDetail | null>(null);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    { value: 'Draft', label: this.translate.instant('status.draft') },
    { value: 'Sent', label: this.translate.instant('quotes.statusSent') },
    { value: 'Accepted', label: this.translate.instant('quotes.statusAccepted') },
    { value: 'Declined', label: this.translate.instant('quotes.statusDeclined') },
    { value: 'Expired', label: this.translate.instant('quotes.statusExpired') },
    { value: 'ConvertedToOrder', label: this.translate.instant('quotes.statusConvertedToOrder') },
  ];

  protected readonly quoteColumns: ColumnDef[] = [
    { field: 'quoteNumber', header: this.translate.instant('quotes.quoteNumber'), sortable: true, width: '120px' },
    { field: 'customerName', header: this.translate.instant('quotes.customer'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '140px', filterOptions: this.statusOptions.slice(1) },
    { field: 'lineCount', header: this.translate.instant('quotes.lines'), sortable: true, width: '70px', align: 'center' },
    { field: 'total', header: this.translate.instant('common.total'), sortable: true, width: '100px', align: 'right' },
    { field: 'expirationDate', header: this.translate.instant('quotes.expires'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
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
        this.snackbar.success(this.translate.instant('quotes.quoteSent'));
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
        this.snackbar.success(this.translate.instant('quotes.quoteAccepted'));
      },
    });
  }

  protected rejectQuote(): void {
    const quote = this.selectedQuote();
    if (!quote) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('quotes.rejectQuoteTitle'),
        message: this.translate.instant('quotes.rejectQuoteMessage', { number: quote.quoteNumber }),
        confirmLabel: this.translate.instant('quotes.reject'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.rejectQuote(quote.id).subscribe({
        next: () => {
          this.refreshDetail(quote.id);
          this.loadQuotes();
          this.snackbar.success(this.translate.instant('quotes.quoteRejected'));
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
        this.snackbar.success(this.translate.instant('quotes.quoteConverted', { number: order.salesOrderNumber ?? '' }));
      },
    });
  }

  protected deleteQuote(): void {
    const quote = this.selectedQuote();
    if (!quote) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('quotes.deleteQuoteTitle'),
        message: this.translate.instant('quotes.deleteQuoteMessage', { number: quote.quoteNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.quoteService.deleteQuote(quote.id).subscribe({
        next: () => {
          this.selectedQuote.set(null);
          this.loadQuotes();
          this.snackbar.success(this.translate.instant('quotes.quoteDeleted'));
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
      Declined: 'chip--error',
      Expired: 'chip--warning',
      ConvertedToOrder: 'chip--primary',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'quotes.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
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
