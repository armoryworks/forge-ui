import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { InvoiceService } from './services/invoice.service';
import { InvoiceListItem } from './models/invoice-list-item.model';
import { UninvoicedJob } from './models/uninvoiced-job.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ServerPageRequest, ServerPageState } from '../../shared/models/server-page-state.model';
import { TablePreferences } from '../../shared/models/table-preferences.model';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { AccountingService } from '../../shared/services/accounting.service';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';
import { EntityLinkComponent } from '../../shared/components/entity-link/entity-link.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InvoiceDialogComponent } from './components/invoice-dialog/invoice-dialog.component';
import { UninvoicedJobsPanelComponent } from './components/uninvoiced-jobs-panel/uninvoiced-jobs-panel.component';
import { InvoiceDetailDialogComponent, InvoiceDetailDialogData } from './components/invoice-detail-dialog/invoice-detail-dialog.component';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { DateOnlyPipe } from '../../shared/pipes/date-only.pipe';

// ⚡ ACCOUNTING BOUNDARY
@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [
    DateOnlyPipe, ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    CurrencyDisplayComponent, EntityLinkComponent,
    InvoiceDialogComponent, UninvoicedJobsPanelComponent, MatTooltipModule,
  ],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesComponent implements OnInit {
  private readonly invoiceService = inject(InvoiceService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly draftResume = inject(DraftResumeService);
  private readonly snackbar = inject(SnackbarService);
  private readonly accountingService = inject(AccountingService);
  private readonly translate = inject(TranslateService);
  private readonly userPreferences = inject(UserPreferencesService);

  protected readonly isStandalone = this.accountingService.isStandalone;
  protected readonly providerName = this.accountingService.providerName;

  protected readonly showCreateDialog = signal(false);
  protected readonly showUninvoicedPanel = signal(false);
  protected readonly loading = signal(false);
  protected readonly invoices = signal<InvoiceListItem[]>([]);
  // Phase 3 F7-broad / WU-22 — server-side total for the header counter.
  protected readonly totalCount = signal<number>(0);

  private static readonly defaultSort = { sort: 'invoiceDate', order: 'desc' as const };

  protected readonly pageRequest = signal<ServerPageRequest>({
    pageIndex: 0,
    pageSize: this.userPreferences.get<TablePreferences>('table:invoices')?.pageSize ?? 25,
    ...InvoicesComponent.defaultSort,
  });

  protected readonly serverPaging = computed<ServerPageState>(() => ({
    ...this.pageRequest(),
    totalCount: this.totalCount(),
  }));
  protected readonly uninvoicedJobs = signal<UninvoicedJob[]>([]);
  protected readonly uninvoicedCount = signal(0);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('invoices.allStatuses') },
    { value: 'Draft', label: this.translate.instant('invoices.statusDraft') },
    { value: 'Sent', label: this.translate.instant('invoices.statusSent') },
    { value: 'PartiallyPaid', label: this.translate.instant('invoices.statusPartiallyPaid') },
    { value: 'Paid', label: this.translate.instant('invoices.statusPaid') },
    { value: 'Overdue', label: this.translate.instant('invoices.statusOverdue') },
    { value: 'Voided', label: this.translate.instant('invoices.statusVoided') },
  ];

  protected readonly invoiceColumns: ColumnDef[] = [
    { field: 'invoiceNumber', header: this.translate.instant('invoices.invoiceNumber'), sortable: true, width: '120px' },
    { field: 'customerName', header: this.translate.instant('invoices.customer'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '130px', filterOptions: [
      { value: 'Draft', label: this.translate.instant('invoices.statusDraft') },
      { value: 'Sent', label: this.translate.instant('invoices.statusSent') },
      { value: 'PartiallyPaid', label: this.translate.instant('invoices.statusPartiallyPaid') },
      { value: 'Paid', label: this.translate.instant('invoices.statusPaid') },
      { value: 'Overdue', label: this.translate.instant('invoices.statusOverdue') },
      { value: 'Voided', label: this.translate.instant('invoices.statusVoided') },
    ]},
    { field: 'invoiceDate', header: this.translate.instant('invoices.invoiceDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'dueDate', header: this.translate.instant('invoices.dueDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'total', header: this.translate.instant('common.total'), width: '100px', align: 'right' },
    { field: 'amountPaid', header: this.translate.instant('invoices.paid'), width: '100px', align: 'right' },
    { field: 'balanceDue', header: this.translate.instant('invoices.balance'), width: '100px', align: 'right' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.loadInvoices();
    this.loadUninvoicedJobs();

    // Phase 3 F7-broad / WU-22 — debounced search + filter changes refire
    // the standardised paged endpoint.
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadFirstPage());

    this.statusFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadFirstPage());
  }

  ngOnInit(): void {
    if (this.draftResume.consume('invoice')) {
      this.openCreateDialog();
    }
  }

  protected loadInvoices(): void {
    this.loading.set(true);
    const search = (this.searchControl.value ?? '').trim() || undefined;
    const status = this.statusFilterControl.value ?? undefined;
    const page = this.pageRequest();
    this.invoiceService.getInvoicesPaged({
      q: search,
      status,
      page: page.pageIndex + 1,
      pageSize: page.pageSize,
      sort: page.sort ?? InvoicesComponent.defaultSort.sort,
      order: page.sort ? page.order : InvoicesComponent.defaultSort.order,
    }).subscribe({
      next: (paged) => {
        this.invoices.set(paged.items);
        this.totalCount.set(paged.totalCount);
        this.loading.set(false);
        const detail = this.detailDialog.getDetailFromUrl();
        if (detail?.entityType === 'invoice') {
          this.openInvoiceDetail({ id: detail.entityId } as InvoiceListItem);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadFirstPage(); }

  private loadFirstPage(): void {
    this.pageRequest.update(page => ({ ...page, pageIndex: 0 }));
    this.loadInvoices();
  }

  protected onServerPageChange(request: ServerPageRequest): void {
    this.pageRequest.set(request.sort ? request : { ...request, ...InvoicesComponent.defaultSort });
    this.loadInvoices();
  }

  protected openInvoiceDetail(item: InvoiceListItem): void {
    const ref = this.detailDialog.open<InvoiceDetailDialogComponent, InvoiceDetailDialogData, void>(
      'invoice',
      item.id,
      InvoiceDetailDialogComponent,
      { invoiceId: item.id },
    );
    ref.afterClosed().subscribe(() => {
      // Always reload in case actions were taken inside the dialog
      this.loadInvoices();
    });
  }

  // --- Create Dialog ---
  // ⚡ ACCOUNTING BOUNDARY: invoice creation is disabled when a provider is connected
  protected openCreateDialog(): void { if (!this.isStandalone()) return; this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadInvoices();
  }

  // --- Uninvoiced Jobs ---
  protected loadUninvoicedJobs(): void {
    this.invoiceService.getUninvoicedJobs().subscribe({
      next: (jobs) => {
        this.uninvoicedJobs.set(jobs);
        this.uninvoicedCount.set(jobs.length);
      },
    });
  }

  protected openUninvoicedPanel(): void { if (!this.isStandalone()) return; this.showUninvoicedPanel.set(true); }
  protected closeUninvoicedPanel(): void { this.showUninvoicedPanel.set(false); }

  protected createInvoiceFromJob(jobId: number): void {
    if (!this.isStandalone()) return;
    this.invoiceService.createInvoiceFromJob(jobId).subscribe({
      next: (invoice) => {
        this.snackbar.success(this.translate.instant('invoices.invoiceCreatedNumber', { number: invoice.invoiceNumber }));
        this.loadInvoices();
        this.loadUninvoicedJobs();
      },
    });
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Sent: 'chip--info',
      PartiallyPaid: 'chip--warning',
      Paid: 'chip--success',
      Overdue: 'chip--error',
      Voided: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'invoices.status' + status;
    return this.translate.instant(key);
  }
}
