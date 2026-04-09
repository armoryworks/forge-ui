import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { QuoteService } from './services/quote.service';
import { QuoteListItem } from './models/quote-list-item.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { QuoteDialogComponent } from './components/quote-dialog/quote-dialog.component';
import { QuoteDetailDialogComponent, QuoteDetailDialogData, QuoteDetailDialogResult } from './components/quote-detail-dialog/quote-detail-dialog.component';
import { openDetailDialog } from '../../shared/utils/detail-dialog.utils';

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
  private readonly translate = inject(TranslateService);

  protected readonly showCreateDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly quotes = signal<QuoteListItem[]>([]);

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

  protected openQuoteDetail(item: QuoteListItem): void {
    openDetailDialog<QuoteDetailDialogComponent, QuoteDetailDialogData, QuoteDetailDialogResult>(
      this.dialog,
      QuoteDetailDialogComponent,
      { quoteId: item.id },
    ).afterClosed().subscribe(result => {
      if (result?.changed) this.loadQuotes();
    });
  }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadQuotes();
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
}
