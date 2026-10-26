import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, output, computed, ViewChild, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { PaymentService } from '../../services/payment.service';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { InvoiceListItem } from '../../../invoices/models/invoice-list-item.model';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { CreatePaymentApplicationRequest } from '../../models/create-payment-application-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CurrencyService } from '../../../../shared/services/currency.service';
import { LanguageService } from '../../../../shared/services/language.service';
import { DocumentCurrencyComponent } from '../../../../shared/components/document-currency/document-currency.component';
import { formatDate, toIsoDate, todayEnd, todayStart } from '../../../../shared/utils/date.utils';
import { roundMoney } from '../../../../shared/utils/money.utils';
import { automaticDiscount, inDiscountWindow } from '../../../../shared/utils/payment-terms.utils';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

interface ApplicationEntry {
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  discount: number;
}

// ⚡ ACCOUNTING BOUNDARY
@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent, AutocompleteComponent, EntityPickerComponent,
    CurrencyDisplayComponent, ValidationButtonComponent, TranslatePipe, MatTooltipModule, DocumentCurrencyComponent,
  ],
  templateUrl: './payment-dialog.component.html',
  styleUrl: './payment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  @ViewChild('customerPicker') private customerPicker?: EntityPickerComponent;
  private readonly documentCurrency = viewChild(DocumentCurrencyComponent);
  private readonly paymentService = inject(PaymentService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly language = inject(LanguageService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manualNumbers = inject(ManualNumberSettingsService);

  /** Whether the tenant allows a manual payment-number override on create. */
  protected readonly allowManualPaymentNumbers = computed(() => this.manualNumbers.isEnabled('payments'));

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  private readonly customerName = signal('');
  /** Phase 1l — payment dates record when payment was received; not future. */
  protected readonly today = todayEnd();
  protected readonly applications = signal<ApplicationEntry[]>([]);

  protected readonly customerCurrencyId = signal<number | null>(null);
  protected readonly documentCurrencyCode = computed(() => this.documentCurrency()?.selectedCode() ?? null);

  protected readonly openInvoices = signal<InvoiceListItem[]>([]);

  private readonly baseCurrency = inject(CurrencyService).baseCurrency;

  protected readonly invoiceOptions = computed<AutocompleteOption[]>(() => {
    const currencyId = this.selectedCurrencyId();
    const filterByCurrency = this.documentCurrency()?.visible() ?? false;
    return this.openInvoices()
      .filter(inv => !filterByCurrency || currencyId == null || inv.currencyId == null || inv.currencyId === currencyId)
      .map(inv => ({
        value: inv.id,
        label: this.translate.instant(this.discountOffered(inv) > 0 ? 'payments.invoiceOptionLabelDiscount' : 'payments.invoiceOptionLabel', {
          number: inv.invoiceNumber,
          balance: this.formatMoney(inv.balanceDue, inv.currencyCode ?? this.baseCurrency()),
          percent: inv.discountPercent ?? 0,
          date: formatDate(inv.discountDeadline ?? null),
        }),
      }));
  });

  protected readonly applicationRemaining = signal<number | null>(null);

  protected readonly customerFilters: Record<string, string> = { isActive: 'true' };

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
    paymentNumber: new FormControl(''),
    customerId: new FormControl<number | null>(null, [Validators.required]),
    method: new FormControl<string | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    paymentDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    referenceNumber: new FormControl(''),
    notes: new FormControl(''),
    currencyId: new FormControl<number | null>(null),
    fxRate: new FormControl<number | null>(1, [Validators.min(0.00000001)]),
  });

  private readonly selectedCurrencyId = toSignal(
    this.paymentForm.controls.currencyId.valueChanges.pipe(startWith(this.paymentForm.controls.currencyId.value)),
    { initialValue: this.paymentForm.controls.currencyId.value },
  );
  protected readonly paymentDateValue = toSignal(
    this.paymentForm.controls.paymentDate.valueChanges.pipe(startWith(this.paymentForm.controls.paymentDate.value)),
    { initialValue: this.paymentForm.controls.paymentDate.value },
  );

  protected readonly violations = FormValidationService.getViolations(this.paymentForm, {
    customerId: this.translate.instant('payments.customer'),
    method: this.translate.instant('payments.paymentMethod'),
    amount: this.translate.instant('payments.amount'),
    paymentDate: this.translate.instant('payments.paymentDate'),
    referenceNumber: this.translate.instant('payments.referenceNumber'),
    notes: this.translate.instant('common.notes'),
  });

  // Application form
  protected readonly appForm = new FormGroup({
    invoiceId: new FormControl<number | null>(null, [Validators.required]),
    invoiceNumber: new FormControl('', [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    discount: new FormControl<number | null>(0, [Validators.min(0)]),
  }, { validators: group => this.overAppliedError(group.value as { amount: number | null; discount: number | null }) });

  protected readonly totalApplied = computed(() =>
    this.applications().reduce((sum, a) => sum + a.amount, 0)
  );

  protected readonly totalDiscount = computed(() =>
    roundMoney(this.applications().reduce((sum, a) => sum + a.discount, 0))
  );

  protected readonly draftConfig: DraftConfig = {
    entityType: 'payment',
    entityId: 'new',
    route: '/payments',
    snapshotFn: () => ({ ...this.paymentForm.getRawValue(), customerName: this.customerName(), applications: this.applications() }),
    restoreFn: (data) => {
      const customerId = typeof data['customerId'] === 'number' ? data['customerId'] : null;
      const customerName = typeof data['customerName'] === 'string' ? data['customerName'] : '';
      if (customerId != null && customerName) {
        this.customerName.set(customerName);
        this.customerPicker?.setSelected(customerId, customerName);
      }
      this.paymentForm.patchValue(data);
      if (Array.isArray(data['applications'])) {
        this.applications.set(
          (data['applications'] as Partial<ApplicationEntry>[]).map(a => ({
            invoiceId: a.invoiceId!,
            invoiceNumber: a.invoiceNumber ?? '',
            amount: a.amount!,
            discount: a.discount ?? 0,
          })),
        );
      }
      this.paymentForm.markAsDirty();
    },
  };

  constructor() {
    this.paymentForm.controls.customerId.valueChanges.pipe(
      switchMap(customerId => {
        this.openInvoices.set([]);
        this.appForm.reset({ invoiceId: null, invoiceNumber: '', amount: null, discount: 0 });
        return customerId == null
          ? of<InvoiceListItem[]>([])
          : this.invoiceService.getOpenInvoices(customerId).pipe(
            map(list => list.filter(inv => inv.balanceDue > 0 && inv.status !== 'Draft' && inv.status !== 'Voided')),
            catchError(() => of<InvoiceListItem[]>([])),
          );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(list => this.openInvoices.set(list));

    this.appForm.controls.invoiceId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(invoiceId => {
      const invoice = this.openInvoices().find(inv => inv.id === invoiceId);
      this.appForm.controls.invoiceNumber.setValue(invoice?.invoiceNumber ?? '');
      const remaining = invoice ? this.remainingBalance(invoice) : null;
      this.capApplicationAmount(remaining);
      const discount = invoice ? this.discountOffered(invoice) : 0;
      this.appForm.controls.discount.setValue(discount, { emitEvent: false });
      this.appForm.controls.discount.markAsPristine();
      if (remaining != null && remaining > 0 && this.appForm.controls.amount.value == null) {
        this.appForm.controls.amount.setValue(roundMoney(remaining - discount), { emitEvent: false });
      }
      this.appForm.updateValueAndValidity();
    });

    this.appForm.controls.amount.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(amount => {
      const invoice = this.openInvoices().find(inv => inv.id === this.appForm.controls.invoiceId.value);
      if (!invoice || this.appForm.controls.discount.dirty) return;
      const remaining = this.remainingBalance(invoice);
      this.appForm.controls.discount.setValue(
        automaticDiscount(amount ?? 0, remaining, this.discountOffered(invoice), invoice.discountPercent ?? 0), { emitEvent: false });
    });

    this.paymentForm.controls.paymentDate.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.applications.update(prev => prev.map(a => {
        const invoice = this.openInvoices().find(inv => inv.id === a.invoiceId);
        return invoice && a.discount > 0 && !this.inWindow(invoice) ? { ...a, discount: 0 } : a;
      }));
    });

    this.paymentForm.controls.currencyId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(currencyId => {
      const applied = new Set(this.applications().map(a => a.invoiceId));
      const mismatched = this.openInvoices().some(inv => applied.has(inv.id) && inv.currencyId != null && inv.currencyId !== currencyId);
      if (mismatched) this.applications.set([]);
    });
  }

  protected onCustomerSelected(customer: Record<string, unknown> | null): void {
    this.customerName.set(customer ? String(customer['name'] ?? '') : '');
    const currencyId = customer?.['currencyId'];
    this.customerCurrencyId.set(typeof currencyId === 'number' ? currencyId : null);
  }

  protected close(): void {
    this.closed.emit();
  }

  private formatMoney(value: number, code: string): string {
    try {
      return new Intl.NumberFormat(this.language.intlLocale(), { style: 'currency', currency: code }).format(value);
    } catch {
      return value.toFixed(2);
    }
  }

  private remainingBalance(invoice: InvoiceListItem): number {
    const applied = this.applications().filter(a => a.invoiceId === invoice.id).reduce((sum, a) => sum + a.amount + a.discount, 0);
    return Math.round((invoice.balanceDue - applied) * 100) / 100;
  }

  private inWindow(invoice: InvoiceListItem): boolean {
    return inDiscountWindow(invoice.discountDeadline, this.paymentDateValue());
  }

  /** The discount still open on the invoice for this payment's date, less what this payment already takes. */
  private discountOffered(invoice: InvoiceListItem): number {
    if (!this.inWindow(invoice)) return 0;
    const used = this.applications().filter(a => a.invoiceId === invoice.id).reduce((sum, a) => sum + a.discount, 0);
    return Math.max(0, roundMoney((invoice.discountAvailable ?? 0) - used));
  }

  private overAppliedError(value: { amount: number | null; discount: number | null }): { overApplied: { message: string } } | null {
    const remaining = this.applicationRemaining();
    if (remaining == null) return null;
    return roundMoney((value.amount ?? 0) + (value.discount ?? 0)) > remaining
      ? { overApplied: { message: this.translate.instant('payments.discountExceedsBalance') } }
      : null;
  }

  private capApplicationAmount(remaining: number | null): void {
    const amount = this.appForm.controls.amount;
    amount.setValidators(remaining == null
      ? [Validators.required, Validators.min(0.01)]
      : [Validators.required, Validators.min(0.01), Validators.max(remaining)]);
    amount.updateValueAndValidity();
    this.applicationRemaining.set(remaining);
  }

  protected addApplication(): void {
    if (this.appForm.invalid) return;
    const f = this.appForm.getRawValue();
    this.applications.update(prev => [...prev, {
      invoiceId: f.invoiceId!,
      invoiceNumber: f.invoiceNumber!,
      amount: f.amount!,
      discount: roundMoney(f.discount ?? 0),
    }]);
    this.appForm.reset({ invoiceId: null, invoiceNumber: '', amount: null, discount: 0 });
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
      discountAmount: a.discount,
    }));
    const currencyField = this.documentCurrency();

    this.paymentService.createPayment({
      paymentNumber: this.allowManualPaymentNumbers() ? (f.paymentNumber?.trim() || undefined) : undefined,
      customerId: f.customerId!,
      method: f.method!,
      amount: f.amount!,
      paymentDate: toIsoDate(f.paymentDate!)!,
      referenceNumber: f.referenceNumber || undefined,
      notes: f.notes || undefined,
      currencyId: currencyField?.visible() ? (f.currencyId ?? undefined) : undefined,
      fxRate: currencyField?.visible() && currencyField.isForeign() ? f.fxRate : undefined,
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
