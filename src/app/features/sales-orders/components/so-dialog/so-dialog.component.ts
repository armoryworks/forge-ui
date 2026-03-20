import { ChangeDetectionStrategy, Component, inject, signal, output, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { SalesOrderService } from '../../services/sales-order.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CustomerListItem } from '../../../customers/models/customer-list-item.model';
import { CreateSalesOrderLineRequest } from '../../models/create-sales-order-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { CREDIT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

interface LineEntry {
  partId: number | null;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-so-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    ValidationPopoverDirective, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './so-dialog.component.html',
  styleUrl: './so-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoDialogComponent {
  private readonly soService = inject(SalesOrderService);
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  protected readonly lines = signal<LineEntry[]>([]);

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('salesOrders.selectCustomer') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly creditTermsOptions = CREDIT_TERMS_OPTIONS;

  protected readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    customerPO: new FormControl(''),
    creditTerms: new FormControl<string | null>(null),
    requestedDeliveryDate: new FormControl<Date | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    customerId: 'Customer',
    customerPO: 'Customer PO',
    creditTerms: 'Credit Terms',
    requestedDeliveryDate: 'Delivery Date',
    taxRate: 'Tax Rate',
    notes: 'Notes',
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
    this.customerService.getCustomers().subscribe({
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
    const lineRequests: CreateSalesOrderLineRequest[] = this.lines().map(l => ({
      partId: l.partId ?? undefined,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));

    this.soService.createSalesOrder({
      customerId: f.customerId!,
      creditTerms: f.creditTerms || undefined,
      requestedDeliveryDate: toIsoDate(f.requestedDeliveryDate) || undefined,
      customerPO: f.customerPO || undefined,
      notes: f.notes || undefined,
      taxRate: f.taxRate ?? 0,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('salesOrders.soCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
