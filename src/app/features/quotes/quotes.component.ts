import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';

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
import { withFunctionalTotal } from '../../shared/utils/functional-total-column';
import { CurrencyCatalogService } from '../../shared/services/currency-catalog.service';
import { CurrencyService } from '../../shared/services/currency.service';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';
import { QuoteDialogComponent } from './components/quote-dialog/quote-dialog.component';
import { QuoteDetailDialogComponent, QuoteDetailDialogData, QuoteDetailDialogResult } from './components/quote-detail-dialog/quote-detail-dialog.component';
import { SendQuoteEmailDialogComponent, SendQuoteEmailDialogData, SendQuoteEmailDialogResult } from './components/send-quote-email-dialog/send-quote-email-dialog.component';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { DateOnlyPipe } from '../../shared/pipes/date-only.pipe';
import { CapabilityService } from '../../shared/services/capability.service';
import { AuthService } from '../../shared/services/auth.service';
import { ConfigureQuoteDialogComponent } from '../cpq/components/configure-quote-dialog/configure-quote-dialog.component';
import { CPQ_ROLES } from '../cpq/models/cpq-roles.model';

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [
    DateOnlyPipe,
    ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective, MatTooltipModule,
    CurrencyDisplayComponent, QuoteDialogComponent, ConfigureQuoteDialogComponent,
  ],
  templateUrl: './quotes.component.html',
  styleUrl: './quotes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotesComponent implements OnInit {
  private readonly quoteService = inject(QuoteService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly currencyCatalog = inject(CurrencyCatalogService).ensureLoaded();
  private readonly baseCurrency = inject(CurrencyService).baseCurrency;
  private readonly draftResume = inject(DraftResumeService);
  private readonly capabilities = inject(CapabilityService);
  private readonly auth = inject(AuthService);

  protected readonly canConfigure = computed(() =>
    this.capabilities.isEnabled('CAP-O2C-CPQ') && this.auth.hasAnyRole([...CPQ_ROLES]));
  protected readonly showConfigureDialog = signal(false);

  protected readonly showCreateDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly quotes = signal<QuoteListItem[]>([]);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(debounceTime(200)), { initialValue: '' });

  protected readonly filteredQuotes = computed(() => {
    const term = (this.searchTerm() ?? '').trim().toLowerCase();
    const list = this.quotes();
    if (!term) return list;
    return list.filter(q =>
      q.quoteNumber?.toLowerCase().includes(term) || q.customerName?.toLowerCase().includes(term));
  });

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    { value: 'Draft', label: this.translate.instant('status.draft') },
    { value: 'Sent', label: this.translate.instant('quotes.statusSent') },
    { value: 'Accepted', label: this.translate.instant('quotes.statusAccepted') },
    { value: 'Declined', label: this.translate.instant('quotes.statusDeclined') },
    { value: 'Expired', label: this.translate.instant('quotes.statusExpired') },
    { value: 'ConvertedToOrder', label: this.translate.instant('quotes.statusConvertedToOrder') },
    { value: 'Superseded', label: this.translate.instant('quotes.statusSuperseded') },
  ];

  private readonly quoteColumnsBase: ColumnDef[] = [
    { field: 'quoteNumber', header: this.translate.instant('quotes.quoteNumber'), sortable: true, width: '120px' },
    { field: 'customerName', header: this.translate.instant('quotes.customer'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '140px', filterOptions: this.statusOptions.slice(1) },
    { field: 'lineCount', header: this.translate.instant('quotes.lines'), sortable: true, width: '70px', align: 'center' },
    { field: 'total', header: this.translate.instant('common.total'), sortable: true, width: '100px', align: 'right' },
    { field: 'expirationDate', header: this.translate.instant('quotes.expires'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
    { field: 'actions', header: '', width: '70px', align: 'center' },
  ];
  protected readonly quoteColumns = computed<ColumnDef[]>(() => this.currencyCatalog.isMultiCurrency()
    ? withFunctionalTotal(this.quoteColumnsBase, this.translate.instant('accounting.currency.totalFunctional', { code: this.baseCurrency() }))
    : this.quoteColumnsBase);

  constructor() {
    this.statusFilterControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.loadQuotes());
    this.loadQuotes();
  }

  ngOnInit(): void {
    if (this.draftResume.consume('quote')) {
      this.openCreateDialog();
    }
  }

  protected loadQuotes(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value ?? undefined;
    this.quoteService.getQuotes(undefined, status).subscribe({
      next: (list) => {
        this.quotes.set(list);
        this.loading.set(false);
        const detail = this.detailDialog.getDetailFromUrl();
        if (detail?.entityType === 'quote') {
          this.openQuoteDetail({ id: detail.entityId } as QuoteListItem);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadQuotes(); }

  protected openQuoteDetail(item: QuoteListItem): void {
    this.detailDialog.open<QuoteDetailDialogComponent, QuoteDetailDialogData, QuoteDetailDialogResult>(
      'quote',
      item.id,
      QuoteDetailDialogComponent,
      { quoteId: item.id },
    ).afterClosed().subscribe(result => {
      if (result?.changed) this.loadQuotes();
    });
  }

  // --- Send email (S3) ---
  protected openSendEmail(item: QuoteListItem, event: Event): void {
    event.stopPropagation();
    this.quoteService.getRecipientEmail(item.customerId).subscribe(recipientEmail => {
      this.dialog.open<SendQuoteEmailDialogComponent, SendQuoteEmailDialogData, SendQuoteEmailDialogResult | undefined>(
        SendQuoteEmailDialogComponent,
        {
          width: '600px',
          data: { quoteId: item.id, quoteNumber: item.quoteNumber, customerName: item.customerName, recipientEmail },
        },
      ).afterClosed().subscribe(sent => { if (sent) this.loadQuotes(); });
    });
  }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onConfiguredQuoteCreated(quoteId: number): void {
    this.showConfigureDialog.set(false);
    this.loadQuotes();
    this.openQuoteDetail({ id: quoteId } as QuoteListItem);
  }

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
      Superseded: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'quotes.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }
}
