import { ChangeDetectionStrategy, Component, computed, inject, output, signal, Signal, ViewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { SalesOrderService } from '../../services/sales-order.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { PartsService } from '../../../parts/services/parts.service';
import { CustomerListItem } from '../../../customers/models/customer-list-item.model';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { CreateSalesOrderLineRequest } from '../../models/create-sales-order-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { CREDIT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';

interface LineEntry {
  partId: number;
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
    AutocompleteComponent, ValidationPopoverDirective, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './so-dialog.component.html',
  styleUrl: './so-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly soService = inject(SalesOrderService);
  private readonly customerService = inject(CustomerService);
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  protected readonly parts = signal<PartListItem[]>([]);
  protected readonly lines = signal<LineEntry[]>([]);

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('salesOrders.selectCustomer') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly partOptions = computed<AutocompleteOption[]>(() =>
    this.parts().map(p => ({ value: p.id, label: `${p.partNumber} — ${p.description}` })));

  protected readonly creditTermsOptions = CREDIT_TERMS_OPTIONS;

  readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    customerPO: new FormControl(''),
    creditTerms: new FormControl<string | null>(null),
    requestedDeliveryDate: new FormControl<Date | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    notes: new FormControl(''),
  });

  private readonly formViolations = FormValidationService.getViolations(this.form, {
    customerId: 'Customer',
    customerPO: 'Customer PO',
    creditTerms: 'Credit Terms',
    requestedDeliveryDate: 'Delivery Date',
    taxRate: 'Tax Rate',
    notes: 'Notes',
  });

  protected readonly violations: Signal<string[]> = computed(() => [
    ...this.formViolations(),
    ...(this.lines().length === 0 ? ['At least one line item is required'] : []),
  ]);

  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(1)]),
    unitPrice: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  protected readonly lineTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  );

  protected readonly taxRateValue = toSignal(
    this.form.controls.taxRate.valueChanges.pipe(startWith(this.form.controls.taxRate.value ?? 0)),
    { initialValue: this.form.controls.taxRate.value ?? 0 }
  );
  protected readonly taxAmount = computed(() => (this.taxRateValue() ?? 0) / 100 * this.lineTotal());
  protected readonly grandTotal = computed(() => this.lineTotal() + this.taxAmount());

  protected readonly draftConfig: DraftConfig = {
    entityType: 'sales-order',
    entityId: 'new',
    route: '/sales-orders',
    snapshotFn: () => ({ ...this.form.getRawValue(), lines: this.lines() }),
    restoreFn: (data) => {
      this.form.patchValue(data);
      if (Array.isArray(data['lines'])) this.lines.set(data['lines'] as LineEntry[]);
      this.form.markAsDirty();
    },
  };

  constructor() {
    this.customerService.getCustomers().subscribe({
      next: (list) => this.customers.set(list),
    });
    this.partsService.getParts('Active').subscribe({
      next: (list) => this.parts.set(list),
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const part = this.parts().find(p => p.id === f.partId);
    if (!part) return;
    this.lines.update(prev => [...prev, {
      partId: part.id,
      partNumber: part.partNumber,
      description: part.description,
      quantity: f.quantity!,
      unitPrice: f.unitPrice!,
    }]);
    this.lineForm.reset({ partId: null, quantity: 1, unitPrice: 0 });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.form.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const lineRequests: CreateSalesOrderLineRequest[] = this.lines().map(l => ({
      partId: l.partId,
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
      taxRate: (f.taxRate ?? 0) / 100,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('salesOrders.soCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
