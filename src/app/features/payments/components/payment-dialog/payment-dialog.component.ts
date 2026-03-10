import { ChangeDetectionStrategy, Component, inject, signal, output, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
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
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

interface ApplicationEntry {
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
}

// ⚡ ACCOUNTING BOUNDARY
@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './payment-dialog.component.html',
  styleUrl: './payment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDialogComponent {
  private readonly paymentService = inject(PaymentService);
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  protected readonly applications = signal<ApplicationEntry[]>([]);

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'Select customer...' },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly methodOptions: SelectOption[] = [
    { value: null, label: 'Select method...' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Check', label: 'Check' },
    { value: 'CreditCard', label: 'Credit Card' },
    { value: 'BankTransfer', label: 'Bank Transfer' },
    { value: 'Wire', label: 'Wire' },
    { value: 'Other', label: 'Other' },
  ];

  protected readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    method: new FormControl<string | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    paymentDate: new FormControl<Date | null>(null, [Validators.required]),
    referenceNumber: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
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
  });

  protected readonly totalApplied = computed(() =>
    this.applications().reduce((sum, a) => sum + a.amount, 0)
  );

  constructor() {
    this.customerService.getCustomers(undefined, true).subscribe({
      next: (list) => this.customers.set(list),
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
    }]);
    this.appForm.reset({ invoiceId: null, invoiceNumber: '', amount: null });
  }

  protected removeApplication(index: number): void {
    this.applications.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const appRequests: CreatePaymentApplicationRequest[] = this.applications().map(a => ({
      invoiceId: a.invoiceId,
      amount: a.amount,
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
        this.snackbar.success('Payment created.');
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
