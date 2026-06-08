import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, output, computed, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { PaymentService } from '../../services/payment.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CustomerListItem } from '../../../customers/models/customer-list-item.model';
import { CreatePaymentApplicationRequest } from '../../models/create-payment-application-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';
import { toIsoDate, todayEnd } from '../../../../shared/utils/date.utils';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

interface ApplicationEntry {
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  /** Settlement FX rate for this application; 1 for base-currency invoices. */
  settlementFxRate: number;
}

// ⚡ ACCOUNTING BOUNDARY
@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    CurrencyDisplayComponent, ValidationButtonComponent, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './payment-dialog.component.html',
  styleUrl: './payment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly paymentService = inject(PaymentService);
  private readonly customerService = inject(CustomerService);
  private readonly currencyService = inject(ActiveCurrencyService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  /** Phase 1l — payment dates record when payment was received; not future. */
  protected readonly today = todayEnd();
  protected readonly applications = signal<ApplicationEntry[]>([]);

  // ── Multi-currency (additive) ──────────────────────────────────────────────
  // The per-application settlement FX-rate input is hidden for single-currency
  // installs. We don't know each applied invoice's currency from this form, so
  // we gate purely on ">1 active currency exists" and let the user enter the
  // settlement rate; it defaults to 1 (correct for base-currency invoices).
  protected readonly activeCurrencyCount = signal(0);
  protected readonly showSettlementFxRate = computed(() => this.activeCurrencyCount() > 1);

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('payments.selectCustomer') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly methodOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('payments.selectMethod') },
    { value: 'Cash', label: this.translate.instant('payments.methodCash') },
    { value: 'Check', label: this.translate.instant('payments.methodCheck') },
    { value: 'CreditCard', label: this.translate.instant('payments.methodCreditCard') },
    { value: 'BankTransfer', label: this.translate.instant('payments.methodBankTransfer') },
    { value: 'Wire', label: this.translate.instant('payments.methodWire') },
    { value: 'Other', label: this.translate.instant('payments.methodOther') },
  ];

  protected readonly paymentForm = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    method: new FormControl<string | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    paymentDate: new FormControl<Date | null>(null, [Validators.required]),
    referenceNumber: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.paymentForm, {
    customerId: 'Customer',
    method: 'Payment Method',
    amount: 'Amount',
    paymentDate: 'Payment Date',
    referenceNumber: 'Reference #',
    notes: 'Notes',
  });

  // Application form
  protected readonly appForm = new FormGroup({
    invoiceId: new FormControl<number | null>(null, [Validators.required]),
    invoiceNumber: new FormControl('', [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    settlementFxRate: new FormControl<number>(1, [Validators.required, Validators.min(0.0000001)]),
  });

  protected readonly totalApplied = computed(() =>
    this.applications().reduce((sum, a) => sum + a.amount, 0)
  );

  protected readonly draftConfig: DraftConfig = {
    entityType: 'payment',
    entityId: 'new',
    route: '/payments',
    snapshotFn: () => ({ ...this.paymentForm.getRawValue(), applications: this.applications() }),
    restoreFn: (data) => {
      this.paymentForm.patchValue(data);
      if (Array.isArray(data['applications'])) {
        // Older drafts predate settlementFxRate — default it to 1 on restore.
        this.applications.set(
          (data['applications'] as Partial<ApplicationEntry>[]).map(a => ({
            invoiceId: a.invoiceId!,
            invoiceNumber: a.invoiceNumber ?? '',
            amount: a.amount!,
            settlementFxRate: a.settlementFxRate ?? 1,
          })),
        );
      }
      this.paymentForm.markAsDirty();
    },
  };

  constructor() {
    this.customerService.getCustomers(undefined, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.customers.set(list),
    });

    // Load active currencies only to decide whether the per-application
    // settlement FX-rate input should appear (>1 active currency).
    this.currencyService.listActiveCurrencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.activeCurrencyCount.set(list.length),
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected addApplication(): void {
    if (this.appForm.invalid) return;
    const f = this.appForm.getRawValue();
    this.applications.update(prev => [...prev, {
      invoiceId: f.invoiceId!,
      invoiceNumber: f.invoiceNumber!,
      amount: f.amount!,
      settlementFxRate: f.settlementFxRate ?? 1,
    }]);
    this.appForm.reset({ invoiceId: null, invoiceNumber: '', amount: null, settlementFxRate: 1 });
  }

  protected removeApplication(index: number): void {
    this.applications.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.paymentForm.invalid) return;
    this.saving.set(true);

    const f = this.paymentForm.getRawValue();
    const appRequests: CreatePaymentApplicationRequest[] = this.applications().map(a => ({
      invoiceId: a.invoiceId,
      amount: a.amount,
      // Only attach a non-default settlement rate for multi-currency installs;
      // single-currency stays byte-for-byte unchanged (server defaults to 1).
      settlementFxRate: this.showSettlementFxRate() ? (a.settlementFxRate ?? 1) : undefined,
    }));

    this.paymentService.createPayment({
      customerId: f.customerId!,
      method: f.method!,
      amount: f.amount!,
      paymentDate: toIsoDate(f.paymentDate!)!,
      referenceNumber: f.referenceNumber || undefined,
      notes: f.notes || undefined,
      applications: appRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('payments.paymentCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
