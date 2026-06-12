import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatDialog } from '@angular/material/dialog';

import { VendorBillService } from './services/vendor-bill.service';
import { BankingService } from './services/banking.service';
import { VendorBankAccount } from './models/vendor-bank-account.model';
import { PaymentBatchListItem } from './models/payment-batch-list-item.model';
import { VendorPaymentService } from './services/vendor-payment.service';
import { PaymentTransmissionService } from './services/payment-transmission.service';
import { VendorBillListItem } from './models/vendor-bill-list-item.model';
import { VendorPaymentListItem } from './models/vendor-payment-list-item.model';
import { VendorService } from '../vendors/services/vendor.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { autoRefreshOnGlChange } from '../../shared/utils/accounting-auto-refresh.util';
import { CapabilityService } from '../../shared/services/capability.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

import { VendorBillDialogComponent } from './components/vendor-bill-dialog/vendor-bill-dialog.component';
import { VendorPaymentDialogComponent } from './components/vendor-payment-dialog/vendor-payment-dialog.component';
import { VendorBillDetailDialogComponent, VendorBillDetailDialogData } from './components/vendor-bill-detail-dialog/vendor-bill-detail-dialog.component';
import { PaymentBatchCreateDialogComponent } from './components/payment-batch-create-dialog/payment-batch-create-dialog.component';
import { VendorBankAccountDialogComponent } from './components/vendor-bank-account-dialog/vendor-bank-account-dialog.component';
import { VendorPaymentDetailDialogComponent, VendorPaymentDetailDialogData } from './components/vendor-payment-detail-dialog/vendor-payment-detail-dialog.component';

type PayablesTab = 'bills' | 'payments' | 'batches' | 'accounts';

const VALID_TABS: PayablesTab[] = ['bills', 'payments', 'batches', 'accounts'];

// ⚡ ACCOUNTING BOUNDARY — AP counterpart of the Invoices + Payments pages.
@Component({
  selector: 'app-payables',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe,
    PageHeaderComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    CurrencyDisplayComponent,
    VendorBillDialogComponent, VendorPaymentDialogComponent,
    PaymentBatchCreateDialogComponent, VendorBankAccountDialogComponent,
    MatTooltipModule,
  ],
  templateUrl: './payables.component.html',
  styleUrl: './payables.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayablesComponent {
  private readonly billService = inject(VendorBillService);
  private readonly paymentService = inject(VendorPaymentService);
  private readonly transmissionService = inject(PaymentTransmissionService);
  private readonly vendorService = inject(VendorService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bankingService = inject(BankingService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly matDialog = inject(MatDialog);

  /** BANK-002 Phase A tabs (batches + bank accounts) show only when NACHA is enabled. */
  protected readonly nachaEnabled = computed(() => {
    this.capabilities.capabilities(); // reactive dependency on the loaded snapshot
    return this.capabilities.isEnabled('CAP-BANK-NACHA');
  });

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => {
      const tab = p.get('tab') as PayablesTab;
      return VALID_TABS.includes(tab) ? tab : 'bills';
    })),
    { initialValue: 'bills' as PayablesTab },
  );

  protected readonly billsLoading = signal(false);
  protected readonly bills = signal<VendorBillListItem[]>([]);
  protected readonly paymentsLoading = signal(false);
  protected readonly payments = signal<VendorPaymentListItem[]>([]);

  protected readonly showBillDialog = signal(false);
  protected readonly showPaymentDialog = signal(false);

  // BANK-002 Phase A — batches + vendor bank accounts
  protected readonly batchesLoading = signal(false);
  protected readonly batches = signal<PaymentBatchListItem[]>([]);
  protected readonly accountsLoading = signal(false);
  protected readonly accounts = signal<VendorBankAccount[]>([]);
  protected readonly showBatchDialog = signal(false);
  protected readonly batchDialogPrenote = signal(false);
  protected readonly showAccountDialog = signal(false);
  protected readonly editingAccount = signal<VendorBankAccount | null>(null);

  /** Failed bank transmission count — drives the triage banner on both tabs. */
  protected readonly failedTransmissionCount = signal(0);

  // Filters
  protected readonly billVendorFilterControl = new FormControl<number | null>(null);
  protected readonly billStatusFilterControl = new FormControl<string | null>(null);
  protected readonly paymentVendorFilterControl = new FormControl<number | null>(null);

  protected readonly vendorOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('payables.allVendors') },
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('payables.allStatuses') },
    { value: 'Draft', label: this.translate.instant('payables.statusDraft') },
    { value: 'Approved', label: this.translate.instant('payables.statusApproved') },
    { value: 'PartiallyPaid', label: this.translate.instant('payables.statusPartiallyPaid') },
    { value: 'Paid', label: this.translate.instant('payables.statusPaid') },
    { value: 'Void', label: this.translate.instant('payables.statusVoid') },
  ];

  protected readonly billColumns: ColumnDef[] = [
    { field: 'billNumber', header: this.translate.instant('payables.billNumber'), sortable: true, width: '120px' },
    { field: 'vendorName', header: this.translate.instant('payables.vendor'), sortable: true },
    { field: 'vendorInvoiceNumber', header: this.translate.instant('payables.vendorInvoiceNumber'), sortable: true, width: '130px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '130px', filterOptions: [
      { value: 'Draft', label: this.translate.instant('payables.statusDraft') },
      { value: 'Approved', label: this.translate.instant('payables.statusApproved') },
      { value: 'PartiallyPaid', label: this.translate.instant('payables.statusPartiallyPaid') },
      { value: 'Paid', label: this.translate.instant('payables.statusPaid') },
      { value: 'Void', label: this.translate.instant('payables.statusVoid') },
    ]},
    { field: 'billDate', header: this.translate.instant('payables.billDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'dueDate', header: this.translate.instant('common.dueDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'total', header: this.translate.instant('common.total'), sortable: true, width: '100px', align: 'right' },
    { field: 'amountPaid', header: this.translate.instant('payables.paid'), sortable: true, width: '100px', align: 'right' },
    { field: 'balanceDue', header: this.translate.instant('payables.balance'), sortable: true, width: '100px', align: 'right' },
  ];

  protected readonly paymentColumns: ColumnDef[] = [
    { field: 'paymentNumber', header: this.translate.instant('payables.paymentNumber'), sortable: true, width: '120px' },
    { field: 'vendorName', header: this.translate.instant('payables.vendor'), sortable: true },
    { field: 'method', header: this.translate.instant('payables.method'), sortable: true, filterable: true, type: 'enum', width: '110px', filterOptions: [
      { value: 'Cash', label: this.translate.instant('payables.methodCash') },
      { value: 'Check', label: this.translate.instant('payables.methodCheck') },
      { value: 'CreditCard', label: this.translate.instant('payables.methodCreditCard') },
      { value: 'BankTransfer', label: this.translate.instant('payables.methodBankTransfer') },
      { value: 'Wire', label: this.translate.instant('payables.methodWire') },
      { value: 'Other', label: this.translate.instant('payables.methodOther') },
    ]},
    { field: 'amount', header: this.translate.instant('payables.amount'), sortable: true, width: '100px', align: 'right' },
    { field: 'appliedAmount', header: this.translate.instant('payables.applied'), sortable: true, width: '100px', align: 'right' },
    { field: 'unappliedAmount', header: this.translate.instant('payables.unapplied'), sortable: true, width: '100px', align: 'right' },
    { field: 'paymentDate', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '110px' },
    { field: 'referenceNumber', header: this.translate.instant('payables.referenceNumber'), sortable: true, width: '120px' },
    { field: 'transmissionStatus', header: this.translate.instant('payables.transmission.column'), sortable: true, filterable: true, type: 'enum', width: '130px', filterOptions: [
      { value: 'Queued', label: this.translate.instant('payables.transmission.statusQueued') },
      { value: 'Retrying', label: this.translate.instant('payables.transmission.statusRetrying') },
      { value: 'Succeeded', label: this.translate.instant('payables.transmission.statusSucceeded') },
      { value: 'Failed', label: this.translate.instant('payables.transmission.statusFailed') },
      { value: 'Cancelled', label: this.translate.instant('payables.transmission.statusCancelled') },
    ]},
  ];

  protected readonly batchColumns: ColumnDef[] = [
    { field: 'batchNumber', header: this.translate.instant('payables.batches.number'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '160px' },
    { field: 'entryCount', header: this.translate.instant('payables.batches.entries'), sortable: true, width: '80px', align: 'right' },
    { field: 'totalAmount', header: this.translate.instant('common.total'), sortable: true, width: '110px', align: 'right' },
    { field: 'effectiveEntryDate', header: this.translate.instant('payables.batches.effectiveDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'createdByName', header: this.translate.instant('payables.batches.createdBy'), sortable: true },
    { field: 'releasedByName', header: this.translate.instant('payables.batches.releasedBy'), sortable: true },
    { field: 'actions', header: this.translate.instant('common.actions'), width: '150px', align: 'right' },
  ];

  protected readonly accountColumns: ColumnDef[] = [
    { field: 'vendorName', header: this.translate.instant('payables.vendor'), sortable: true },
    { field: 'nickname', header: this.translate.instant('payables.bankAccounts.nickname'), sortable: true },
    { field: 'accountType', header: this.translate.instant('payables.bankAccounts.type'), sortable: true, width: '100px' },
    { field: 'routingNumberMasked', header: this.translate.instant('payables.bankAccounts.routing'), width: '120px' },
    { field: 'accountNumberMasked', header: this.translate.instant('payables.bankAccounts.account'), width: '140px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '140px' },
    { field: 'actions', header: this.translate.instant('common.actions'), width: '150px', align: 'right' },
  ];

  /** Error tint on rows whose latest bank transmission failed (table-supported --row-tint hook). */
  protected readonly paymentRowStyle = (row: unknown): Record<string, string> => {
    const payment = row as VendorPaymentListItem;
    return payment.transmissionStatus === 'Failed' ? { '--row-tint': 'var(--error)' } : {};
  };

  constructor() {
    this.vendorService.getVendorDropdown().pipe(takeUntilDestroyed()).subscribe({
      next: (vendors) => this.vendorOptions.set([
        { value: null, label: this.translate.instant('payables.allVendors') },
        ...vendors.map(v => ({ value: v.id, label: v.companyName })),
      ]),
    });

    // Load the active tab's list whenever the tab changes (URL is the source
    // of truth — back/forward navigation re-triggers this effect).
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'bills') this.loadBills();
      else if (tab === 'payments') this.loadPayments();
      else if (tab === 'batches') this.loadBatches();
      else this.loadAccounts();
    });

    this.billVendorFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadBills());
    this.billStatusFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadBills());
    this.paymentVendorFilterControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadPayments());

    this.loadFailedTransmissions();

    // Approving / paying posts GL when FULLGL is on — keep both lists live.
    // (No-op while FULLGL is off: the hub never fires.) Transmission status
    // changes broadcast the same accountingChanged push, so the triage banner
    // stays live too. Open dialogs are intentionally NOT auto-refreshed.
    autoRefreshOnGlChange(() => {
      this.loadBills();
      this.loadPayments();
      this.loadFailedTransmissions();
      if (this.nachaEnabled()) {
        if (this.activeTab() === 'batches') this.loadBatches();
        if (this.activeTab() === 'accounts') this.loadAccounts();
      }
    });
  }

  protected switchTab(tab: PayablesTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected loadBills(): void {
    this.billsLoading.set(true);
    const vendorId = this.billVendorFilterControl.value ?? undefined;
    const status = this.billStatusFilterControl.value ?? undefined;
    this.billService.getVendorBills(vendorId, status).subscribe({
      next: (list) => {
        this.bills.set(list);
        this.billsLoading.set(false);
        this.autoOpenFromUrl();
      },
      error: () => this.billsLoading.set(false),
    });
  }

  protected loadPayments(): void {
    this.paymentsLoading.set(true);
    const vendorId = this.paymentVendorFilterControl.value ?? undefined;
    this.paymentService.getVendorPayments(vendorId).subscribe({
      next: (list) => {
        this.payments.set(list);
        this.paymentsLoading.set(false);
        this.autoOpenFromUrl();
      },
      error: () => this.paymentsLoading.set(false),
    });
  }

  private loadFailedTransmissions(): void {
    this.transmissionService.getPaymentTransmissions('Failed').subscribe({
      next: (list) => this.failedTransmissionCount.set(list.length),
    });
  }

  private autoOpenedFromUrl = false;

  private autoOpenFromUrl(): void {
    if (this.autoOpenedFromUrl) return;
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'vendor-bill') {
      this.autoOpenedFromUrl = true;
      this.openBillDetail({ id: detail.entityId } as VendorBillListItem);
    } else if (detail?.entityType === 'vendor-payment') {
      this.autoOpenedFromUrl = true;
      this.openPaymentDetail({ id: detail.entityId } as VendorPaymentListItem);
    }
  }

  protected openBillDetail(item: VendorBillListItem): void {
    this.detailDialog.open<VendorBillDetailDialogComponent, VendorBillDetailDialogData, boolean>(
      'vendor-bill', item.id, VendorBillDetailDialogComponent,
      { billId: item.id },
      { width: '800px' },
    ).afterClosed().subscribe(changed => {
      if (changed) this.loadBills();
    });
  }

  protected openPaymentDetail(item: VendorPaymentListItem): void {
    this.detailDialog.open<VendorPaymentDetailDialogComponent, VendorPaymentDetailDialogData, boolean>(
      'vendor-payment', item.id, VendorPaymentDetailDialogComponent,
      { paymentId: item.id },
      { width: '800px' },
    ).afterClosed().subscribe(changed => {
      if (changed) this.loadPayments();
    });
  }

  // --- Create Dialogs ---
  protected openBillDialog(): void { this.showBillDialog.set(true); }
  protected closeBillDialog(): void { this.showBillDialog.set(false); }
  protected onBillSaved(): void {
    this.closeBillDialog();
    this.loadBills();
  }

  protected openPaymentDialog(): void { this.showPaymentDialog.set(true); }
  protected closePaymentDialog(): void { this.showPaymentDialog.set(false); }
  protected onPaymentSaved(): void {
    this.closePaymentDialog();
    this.loadPayments();
    this.loadBills();
  }

  // --- BANK-002 Phase A: batches + vendor bank accounts ---
  protected loadBatches(): void {
    if (!this.nachaEnabled()) return;
    this.batchesLoading.set(true);
    this.bankingService.getBatches().subscribe({
      next: (list) => { this.batches.set(list); this.batchesLoading.set(false); },
      error: () => this.batchesLoading.set(false),
    });
  }

  protected loadAccounts(): void {
    if (!this.nachaEnabled()) return;
    this.accountsLoading.set(true);
    this.bankingService.getBankAccounts().subscribe({
      next: (list) => { this.accounts.set(list); this.accountsLoading.set(false); },
      error: () => this.accountsLoading.set(false),
    });
  }

  @ViewChild('returnsFileInput') private returnsFileInput!: ElementRef<HTMLInputElement>;

  protected pickReturnsFile(): void {
    this.returnsFileInput.nativeElement.click();
  }

  protected onReturnsFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.bankingService.importReturns(file).subscribe({
      next: (result) => {
        this.snackbar.success(this.translate.instant('payables.batches.returnsApplied', {
          returned: result.paymentsReturned, prenotes: result.prenotesRejected, nocs: result.nocs,
        }));
        this.loadBatches();
        this.loadAccounts();
        this.loadFailedTransmissions();
      },
    });
  }

  protected openBatchDialog(prenote: boolean): void {
    this.batchDialogPrenote.set(prenote);
    this.showBatchDialog.set(true);
  }
  protected closeBatchDialog(): void { this.showBatchDialog.set(false); }
  protected onBatchSaved(): void {
    this.closeBatchDialog();
    this.loadBatches();
  }

  protected generateBatch(batch: PaymentBatchListItem): void {
    this.bankingService.generateBatch(batch.id).subscribe({
      next: () => { this.loadBatches(); this.snackbar.success(this.translate.instant('payables.batches.generated')); },
    });
  }

  protected downloadBatch(batch: PaymentBatchListItem): void {
    this.bankingService.downloadBatchFile(batch.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${batch.batchNumber}.ach`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  protected releaseBatch(batch: PaymentBatchListItem): void {
    this.matDialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('payables.batches.releaseTitle'),
        message: this.translate.instant('payables.batches.releaseMessage', { number: batch.batchNumber }),
        confirmLabel: this.translate.instant('payables.batches.release'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.bankingService.releaseBatch(batch.id).subscribe({
        next: () => { this.loadBatches(); this.snackbar.success(this.translate.instant('payables.batches.released')); },
      });
    });
  }

  protected cancelBatch(batch: PaymentBatchListItem): void {
    this.matDialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('payables.batches.cancelTitle'),
        message: this.translate.instant('payables.batches.cancelMessage', { number: batch.batchNumber }),
        confirmLabel: this.translate.instant('payables.batches.cancel'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.bankingService.cancelBatch(batch.id).subscribe({
        next: () => { this.loadBatches(); this.snackbar.success(this.translate.instant('payables.batches.cancelled')); },
      });
    });
  }

  protected openAccountDialog(account: VendorBankAccount | null): void {
    this.editingAccount.set(account);
    this.showAccountDialog.set(true);
  }
  protected closeAccountDialog(): void {
    this.showAccountDialog.set(false);
    this.editingAccount.set(null);
  }
  protected onAccountSaved(): void {
    this.closeAccountDialog();
    this.loadAccounts();
  }

  protected approveAccount(account: VendorBankAccount): void {
    this.bankingService.approveBankAccount(account.id).subscribe({
      next: () => { this.loadAccounts(); this.snackbar.success(this.translate.instant('payables.bankAccounts.approved')); },
    });
  }

  protected verifyAccount(account: VendorBankAccount): void {
    this.bankingService.markBankAccountVerified(account.id).subscribe({
      next: () => { this.loadAccounts(); this.snackbar.success(this.translate.instant('payables.bankAccounts.verified')); },
    });
  }

  protected disableAccount(account: VendorBankAccount): void {
    this.matDialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('payables.bankAccounts.disableTitle'),
        message: this.translate.instant('payables.bankAccounts.disableMessage', { nickname: account.nickname }),
        confirmLabel: this.translate.instant('payables.bankAccounts.disable'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.bankingService.disableBankAccount(account.id).subscribe({
        next: () => this.loadAccounts(),
      });
    });
  }

  protected getBatchStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--info',
      Generated: 'chip--primary',
      Released: 'chip--success',
      Cancelled: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getBatchStatusLabel(status: string): string {
    const key = 'payables.batches.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected getAccountStatusClass(status: string): string {
    const map: Record<string, string> = {
      PendingApproval: 'chip--warning',
      Approved: 'chip--info',
      PrenoteSent: 'chip--primary',
      Verified: 'chip--success',
      Disabled: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getAccountStatusLabel(status: string): string {
    const key = 'payables.bankAccounts.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--info',
      Approved: 'chip--primary',
      PartiallyPaid: 'chip--warning',
      Paid: 'chip--success',
      Void: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'payables.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected getMethodLabel(method: string): string {
    const key = 'payables.method' + method;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : method;
  }

  protected getTransmissionChipClass(status: string): string {
    const map: Record<string, string> = {
      Queued: 'chip--info',
      Retrying: 'chip--warning',
      Succeeded: 'chip--success',
      Failed: 'chip--error',
      Cancelled: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getTransmissionLabel(status: string, attempts: number): string {
    if (status === 'Retrying') {
      return this.translate.instant('payables.transmission.statusRetryingCount', { attempts });
    }
    const key = 'payables.transmission.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }
}
