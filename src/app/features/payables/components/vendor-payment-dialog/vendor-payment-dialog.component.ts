import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { VendorPaymentService } from '../../services/vendor-payment.service';
import { VendorBillService } from '../../services/vendor-bill.service';
import { VendorBillListItem } from '../../models/vendor-bill-list-item.model';
import { CreateVendorPaymentApplicationRequest } from '../../models/create-vendor-payment-application-request.model';
import { VendorService } from '../../../vendors/services/vendor.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { toIsoDate, todayEnd } from '../../../../shared/utils/date.utils';

type ApplicationGroup = FormGroup<{
  amount: FormControl<number>;
  settlementFxRate: FormControl<number>;
}>;

/** Draft shape of one application row — keyed by vendorBillId so a restore can
 *  re-match drafted amounts against the re-fetched payable-bills grid. */
interface DraftApplicationRow {
  vendorBillId: number | null;
  amount: number;
  settlementFxRate: number;
}

// ⚡ ACCOUNTING BOUNDARY — AP counterpart of (customer) PaymentDialog. Picking
// a vendor loads its payable (Approved | PartiallyPaid) bills into an
// applications grid with an amount-to-apply per bill.
@Component({
  selector: 'app-vendor-payment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent,
    CurrencyInputComponent, CurrencyDisplayComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './vendor-payment-dialog.component.html',
  styleUrl: './vendor-payment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPaymentDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly paymentService = inject(VendorPaymentService);
  private readonly billService = inject(VendorBillService);
  private readonly vendorService = inject(VendorService);
  private readonly currencyService = inject(ActiveCurrencyService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly today = todayEnd();

  protected readonly vendorOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('payables.selectVendor') },
  ]);

  /** The selected vendor's payable bills, aligned by index with `applications`. */
  protected readonly payableBills = signal<VendorBillListItem[]>([]);
  protected readonly billsLoading = signal(false);
  protected readonly applications = new FormArray<ApplicationGroup>([]);

  // Per-application settlement FX rate is only offered on multi-currency installs.
  protected readonly activeCurrencyCount = signal(0);
  protected readonly showSettlementFxRate = computed(() => this.activeCurrencyCount() > 1);

  protected readonly methodOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('payables.selectMethod') },
    { value: 'Cash', label: this.translate.instant('payables.methodCash') },
    { value: 'Check', label: this.translate.instant('payables.methodCheck') },
    { value: 'CreditCard', label: this.translate.instant('payables.methodCreditCard') },
    { value: 'BankTransfer', label: this.translate.instant('payables.methodBankTransfer') },
    { value: 'Wire', label: this.translate.instant('payables.methodWire') },
    { value: 'Other', label: this.translate.instant('payables.methodOther') },
  ];

  protected readonly paymentForm = new FormGroup({
    vendorId: new FormControl<number | null>(null, [Validators.required]),
    method: new FormControl<string | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    paymentDate: new FormControl<Date | null>(null, [Validators.required]),
    referenceNumber: new FormControl(''),
    notes: new FormControl(''),
    applications: this.applications,
  });

  /** Reactivity tick for computed totals — fires on any nested application edit. */
  private readonly formValue = toSignal(this.paymentForm.valueChanges, { initialValue: null });

  /** Status tick mirroring FormValidationService.getViolations' subscription, but on
   *  the root form: statusChanges bubbles up from FormArray children, so application
   *  row edits (and grid rebuilds on vendor change) re-run the per-row walk below. */
  private readonly formStatus = toSignal(
    this.paymentForm.statusChanges.pipe(startWith(this.paymentForm.status)),
    { initialValue: this.paymentForm.status },
  );

  protected readonly appliedTotal = computed(() => {
    this.formValue();
    return this.applications.controls.reduce((sum, g) => sum + (g.controls.amount.value ?? 0), 0);
  });

  private readonly amountValue = toSignal(
    this.paymentForm.controls.amount.valueChanges.pipe(startWith(this.paymentForm.controls.amount.value)),
    { initialValue: this.paymentForm.controls.amount.value },
  );

  protected readonly unappliedTotal = computed(() => (this.amountValue() ?? 0) - this.appliedTotal());
  /** Σ applications must not exceed the payment amount. */
  protected readonly overApplied = computed(() => this.appliedTotal() > (this.amountValue() ?? 0) + 1e-9);

  private readonly formViolations = FormValidationService.getViolations(this.paymentForm, {
    vendorId: this.translate.instant('payables.vendor'),
    method: this.translate.instant('payables.method'),
    amount: this.translate.instant('payables.amount'),
    paymentDate: this.translate.instant('payables.paymentDate'),
    referenceNumber: this.translate.instant('payables.referenceNumber'),
    notes: this.translate.instant('common.notes'),
  });

  /** Form-level violations + per-row application violations. FormValidationService
   *  .getViolations only scans TOP-LEVEL controls (50+ consumers depend on that), so
   *  the applications FormArray is enumerated locally into row-numbered messages. */
  protected readonly violations = computed<string[]>(() => {
    this.formValue();
    this.formStatus();
    const v = [...this.formViolations()];
    if (this.overApplied()) {
      v.push(this.translate.instant('payables.violationOverApplied'));
    }
    v.push(...this.collectApplicationViolations());
    return v;
  });

  // ── Draft recovery — Form Draft system via <app-dialog [draftConfig]> ──────
  // Same adapter pattern as InvoiceDialog/PaymentDialog (AR siblings). The
  // selected vendor's bills are re-fetched on restore; the draft snapshots
  // vendorId + the application rows keyed by vendorBillId (see fns below).
  protected readonly draftConfig: DraftConfig = {
    entityType: 'vendor-payment',
    entityId: 'new',
    route: '/payables/payments',
    snapshotFn: () => this.buildDraftSnapshot(),
    restoreFn: (data) => this.restoreDraftSnapshot(data),
  };

  /** Drafted application rows waiting for the bills re-fetch; applied in loadPayableBills. */
  private pendingApplicationRestore: DraftApplicationRow[] | null = null;

  constructor() {
    this.vendorService.getVendorDropdown().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.vendorOptions.set([
        { value: null, label: this.translate.instant('payables.selectVendor') },
        ...list.filter(vendor => vendor.isActive).map(vendor => ({ value: vendor.id, label: vendor.companyName })),
      ]),
    });

    this.currencyService.listActiveCurrencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.activeCurrencyCount.set(list.length),
    });

    // Vendor pick loads that vendor's payable bills into the applications grid.
    this.paymentForm.controls.vendorId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((vendorId) => this.loadPayableBills(vendorId));
  }

  protected close(): void {
    this.closed.emit();
  }

  private loadPayableBills(vendorId: number | null): void {
    this.applications.clear();
    this.payableBills.set([]);
    if (!vendorId) return;
    this.billsLoading.set(true);
    // The endpoint takes a single status — load all and filter payable
    // (Approved | PartiallyPaid) client-side.
    this.billService.getVendorBills(vendorId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (bills) => {
        const payable = bills.filter(b => b.status === 'Approved' || b.status === 'PartiallyPaid');
        this.payableBills.set(payable);
        for (const bill of payable) {
          this.applications.push(new FormGroup({
            amount: new FormControl(0, {
              nonNullable: true,
              validators: [Validators.required, Validators.min(0), Validators.max(bill.balanceDue)],
            }),
            settlementFxRate: new FormControl(1, {
              nonNullable: true,
              validators: [Validators.required, Validators.min(0.0000001)],
            }),
          }));
        }
        this.applyPendingApplicationRestore();
        this.billsLoading.set(false);
      },
      error: () => this.billsLoading.set(false),
    });
  }

  // ── Per-row application violation enumeration ─────────────────────────────
  private collectApplicationViolations(): string[] {
    const messages: string[] = [];
    const bills = this.payableBills();
    this.applications.controls.forEach((group, i) => {
      const row = i + 1;
      const amount = group.controls.amount;
      if (amount.hasError('max')) {
        messages.push(this.translate.instant('payables.applicationViolations.amountExceedsBalance', {
          row, max: bills[i]?.balanceDue ?? 0,
        }));
      }
      if (amount.hasError('required') || amount.hasError('min')) {
        messages.push(this.translate.instant('payables.applicationViolations.amountInvalid', { row }));
      }
      const fx = group.controls.settlementFxRate;
      if (fx.hasError('required') || fx.hasError('min')) {
        messages.push(this.translate.instant('payables.applicationViolations.fxRateInvalid', { row }));
      }
    });
    return messages;
  }

  // ── Draft snapshot / restore ──────────────────────────────────────────────
  private buildDraftSnapshot(): Record<string, unknown> {
    const f = this.paymentForm.getRawValue();
    const bills = this.payableBills();
    return {
      vendorId: f.vendorId,
      method: f.method,
      amount: f.amount,
      paymentDate: f.paymentDate,
      referenceNumber: f.referenceNumber,
      notes: f.notes,
      // Rows carry their vendorBillId so restore can re-match them against the
      // re-fetched grid (payable bills may have changed since the draft).
      applications: f.applications.map((row, i): DraftApplicationRow => ({
        vendorBillId: bills[i]?.id ?? null,
        amount: row.amount,
        settlementFxRate: row.settlementFxRate,
      })),
    };
  }

  /**
   * The applications grid is derived from the vendor's CURRENT payable bills,
   * so restore re-fetches rather than rebuilding stale rows: queue the drafted
   * rows, patch the header (vendorId triggers the normal async loadPayableBills),
   * then applyPendingApplicationRestore patches amounts back onto rows whose
   * vendorBillId still matches. Drafted rows whose bill is no longer payable are
   * dropped; drafted amounts now above the fresh balance are kept as-is so the
   * per-row violation enumeration flags them.
   */
  private restoreDraftSnapshot(data: Record<string, unknown>): void {
    this.pendingApplicationRestore = Array.isArray(data['applications'])
      ? (data['applications'] as DraftApplicationRow[])
      : [];
    this.paymentForm.patchValue({
      vendorId: (data['vendorId'] as number | null) ?? null,
      method: (data['method'] as string | null) ?? null,
      amount: (data['amount'] as number | null) ?? null,
      paymentDate: this.reviveDate(data['paymentDate']),
      referenceNumber: (data['referenceNumber'] as string | null) ?? '',
      notes: (data['notes'] as string | null) ?? '',
    });
  }

  private applyPendingApplicationRestore(): void {
    const drafted = this.pendingApplicationRestore;
    if (!drafted) return;
    this.pendingApplicationRestore = null;
    const bills = this.payableBills();
    this.applications.controls.forEach((group, i) => {
      const match = drafted.find(d => d.vendorBillId === bills[i]?.id);
      if (match) {
        group.patchValue({ amount: match.amount, settlementFxRate: match.settlementFxRate });
      }
    });
    this.paymentForm.markAsDirty();
  }

  /** Drafts round-trip IndexedDB's structured clone (Dates survive), but revive
   *  defensively in case a serialized draft hands back an ISO string. */
  private reviveDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value) return new Date(value);
    return null;
  }

  protected save(): void {
    if (this.paymentForm.invalid || this.overApplied() || this.saving()) return;
    this.saving.set(true);

    const f = this.paymentForm.getRawValue();
    const bills = this.payableBills();
    const appRequests: CreateVendorPaymentApplicationRequest[] = this.applications.controls
      .map((g, i) => ({ value: g.getRawValue(), bill: bills[i] }))
      .filter(x => x.value.amount > 0)
      .map(x => ({
        vendorBillId: x.bill.id,
        amount: x.value.amount,
        // Only attach a non-default settlement rate on multi-currency installs;
        // single-currency stays unchanged (server defaults to 1).
        settlementFxRate: this.showSettlementFxRate() ? (x.value.settlementFxRate ?? 1) : undefined,
      }));

    this.paymentService.createVendorPayment({
      vendorId: f.vendorId!,
      method: f.method!,
      amount: f.amount!,
      paymentDate: toIsoDate(f.paymentDate!)!,
      referenceNumber: f.referenceNumber || undefined,
      notes: f.notes || undefined,
      applications: appRequests.length > 0 ? appRequests : undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('payables.paymentCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
