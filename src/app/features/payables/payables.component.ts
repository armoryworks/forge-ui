import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorBillService } from './services/vendor-bill.service';
import { VendorPaymentService } from './services/vendor-payment.service';
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

import { VendorBillDialogComponent } from './components/vendor-bill-dialog/vendor-bill-dialog.component';
import { VendorPaymentDialogComponent } from './components/vendor-payment-dialog/vendor-payment-dialog.component';
import { VendorBillDetailDialogComponent, VendorBillDetailDialogData } from './components/vendor-bill-detail-dialog/vendor-bill-detail-dialog.component';
import { VendorPaymentDetailDialogComponent, VendorPaymentDetailDialogData } from './components/vendor-payment-detail-dialog/vendor-payment-detail-dialog.component';

type PayablesTab = 'bills' | 'payments';

const VALID_TABS: PayablesTab[] = ['bills', 'payments'];

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
  ],
  templateUrl: './payables.component.html',
  styleUrl: './payables.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayablesComponent {
  private readonly billService = inject(VendorBillService);
  private readonly paymentService = inject(VendorPaymentService);
  private readonly vendorService = inject(VendorService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
  ];

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
      else this.loadPayments();
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

    // Approving / paying posts GL when FULLGL is on — keep both lists live.
    // (No-op while FULLGL is off: the hub never fires.) Open dialogs are
    // intentionally NOT auto-refreshed.
    autoRefreshOnGlChange(() => {
      this.loadBills();
      this.loadPayments();
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
}
