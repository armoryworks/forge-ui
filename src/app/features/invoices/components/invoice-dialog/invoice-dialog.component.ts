import { ChangeDetectionStrategy, Component, inject, signal, output, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CustomerListItem } from '../../../customers/models/customer-list-item.model';
import { CreateInvoiceLineRequest } from '../../models/create-invoice-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { CREDIT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';
import { MatTooltipModule } from '@angular/material/tooltip';

interface LineEntry {
  partId: number | null;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

// ---- ACCOUNTING BOUNDARY ----

@Component({
  selector: 'app-invoice-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent,
    ValidationPopoverDirective, MatTooltipModule,
  ],
  templateUrl: './invoice-dialog.component.html',
  styleUrl: './invoice-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDialogComponent {
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  protected readonly lines = signal<LineEntry[]>([]);

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('invoices.selectCustomer') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly creditTermsOptions = CREDIT_TERMS_OPTIONS;

  protected readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    salesOrderId: new FormControl<number | null>(null),
    shipmentId: new FormControl<number | null>(null),
    invoiceDate: new FormControl<Date | null>(null, [Validators.required]),
    dueDate: new FormControl<Date | null>(null, [Validators.required]),
    creditTerms: new FormControl<string | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    customerId: this.translate.instant('invoices.customer'),
    salesOrderId: this.translate.instant('invoices.salesOrderId'),
    shipmentId: this.translate.instant('invoices.shipmentId'),
    invoiceDate: this.translate.instant('invoices.invoiceDate'),
    dueDate: this.translate.instant('invoices.dueDate'),
    creditTerms: this.translate.instant('invoices.creditTerms'),
    taxRate: this.translate.instant('invoices.taxRate'),
    notes: this.translate.instant('common.notes'),
  });

  // Line item form
  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null),
    partNumber: new FormControl(''),
    description: new FormControl('', [Validators.required]),
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(1)]),
    unitPrice: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  protected readonly lineTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  );

  constructor() {
    this.customerService.getCustomers(undefined, true).subscribe({
      next: (list) => this.customers.set(list),
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    this.lines.update(prev => [...prev, {
      partId: f.partId ?? null,
      partNumber: f.partNumber ?? '',
      description: f.description ?? '',
      quantity: f.quantity!,
      unitPrice: f.unitPrice!,
    }]);
    this.lineForm.reset({ partId: null, partNumber: '', description: '', quantity: 1, unitPrice: 0 });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.form.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const lineRequests: CreateInvoiceLineRequest[] = this.lines().map(l => ({
      partId: l.partId ?? undefined,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));

    this.invoiceService.createInvoice({
      customerId: f.customerId!,
      salesOrderId: f.salesOrderId ?? undefined,
      shipmentId: f.shipmentId ?? undefined,
      invoiceDate: toIsoDate(f.invoiceDate!)!,
      dueDate: toIsoDate(f.dueDate!)!,
      creditTerms: f.creditTerms ?? undefined,
      taxRate: f.taxRate!,
      notes: f.notes || undefined,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('invoices.invoiceCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
