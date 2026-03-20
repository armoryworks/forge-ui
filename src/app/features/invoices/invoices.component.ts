import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { InvoiceService } from './services/invoice.service';
import { InvoiceListItem } from './models/invoice-list-item.model';
import { InvoiceDetail } from './models/invoice-detail.model';
import { UninvoicedJob } from './models/uninvoiced-job.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { AccountingService } from '../../shared/services/accounting.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InvoiceDialogComponent } from './components/invoice-dialog/invoice-dialog.component';
import { UninvoicedJobsPanelComponent } from './components/uninvoiced-jobs-panel/uninvoiced-jobs-panel.component';

// ⚡ ACCOUNTING BOUNDARY
@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    InvoiceDialogComponent, UninvoicedJobsPanelComponent, MatTooltipModule,
  ],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesComponent {
  private readonly invoiceService = inject(InvoiceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly accountingService = inject(AccountingService);
  private readonly translate = inject(TranslateService);

  protected readonly isStandalone = this.accountingService.isStandalone;
  protected readonly providerName = this.accountingService.providerName;

  protected readonly showCreateDialog = signal(false);
  protected readonly showUninvoicedPanel = signal(false);
  protected readonly loading = signal(false);
  protected readonly invoices = signal<InvoiceListItem[]>([]);
  protected readonly selectedInvoice = signal<InvoiceDetail | null>(null);
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
    { field: 'total', header: this.translate.instant('common.total'), sortable: true, width: '100px', align: 'right' },
    { field: 'amountPaid', header: this.translate.instant('invoices.paid'), sortable: true, width: '100px', align: 'right' },
    { field: 'balanceDue', header: this.translate.instant('invoices.balance'), sortable: true, width: '100px', align: 'right' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly invoiceRowClass = (row: unknown) => {
    const inv = row as InvoiceListItem;
    return inv.id === this.selectedInvoice()?.id ? 'row--selected' : '';
  };

  constructor() {
    this.loadInvoices();
    this.loadUninvoicedJobs();
  }

  protected loadInvoices(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value ?? undefined;
    this.invoiceService.getInvoices(undefined, status).subscribe({
      next: (list) => { this.invoices.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadInvoices(); }

  protected selectInvoice(item: InvoiceListItem): void {
    this.invoiceService.getInvoiceById(item.id).subscribe({
      next: (detail) => this.selectedInvoice.set(detail),
    });
  }

  protected closeDetail(): void { this.selectedInvoice.set(null); }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
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

  protected openUninvoicedPanel(): void { this.showUninvoicedPanel.set(true); }
  protected closeUninvoicedPanel(): void { this.showUninvoicedPanel.set(false); }

  protected createInvoiceFromJob(jobId: number): void {
    this.invoiceService.createInvoiceFromJob(jobId).subscribe({
      next: (invoice) => {
        this.snackbar.success(this.translate.instant('invoices.invoiceCreatedNumber', { number: invoice.invoiceNumber }));
        this.loadInvoices();
        this.loadUninvoicedJobs();
      },
    });
  }

  // --- Status Actions ---
  protected sendInvoice(): void {
    const inv = this.selectedInvoice();
    if (!inv) return;
    this.invoiceService.sendInvoice(inv.id).subscribe({
      next: () => {
        this.refreshDetail(inv.id);
        this.loadInvoices();
        this.snackbar.success(this.translate.instant('invoices.invoiceSent'));
      },
    });
  }

  protected voidInvoice(): void {
    const inv = this.selectedInvoice();
    if (!inv) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('invoices.voidInvoiceTitle'),
        message: this.translate.instant('invoices.voidInvoiceMessage', { number: inv.invoiceNumber }),
        confirmLabel: this.translate.instant('invoices.void'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.invoiceService.voidInvoice(inv.id).subscribe({
        next: () => {
          this.refreshDetail(inv.id);
          this.loadInvoices();
          this.snackbar.success(this.translate.instant('invoices.invoiceVoided'));
        },
      });
    });
  }

  protected deleteInvoice(): void {
    const inv = this.selectedInvoice();
    if (!inv) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('invoices.deleteInvoiceTitle'),
        message: this.translate.instant('invoices.deleteInvoiceMessage', { number: inv.invoiceNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.invoiceService.deleteInvoice(inv.id).subscribe({
        next: () => {
          this.selectedInvoice.set(null);
          this.loadInvoices();
          this.snackbar.success(this.translate.instant('invoices.invoiceDeleted'));
        },
      });
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

  protected canSend(status: string): boolean { return status === 'Draft'; }
  protected canVoid(status: string): boolean { return status === 'Draft' || status === 'Sent'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  private refreshDetail(id: number): void {
    this.invoiceService.getInvoiceById(id).subscribe(d => this.selectedInvoice.set(d));
  }
}
