import { ChangeDetectionStrategy, Component, computed, inject, output, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { QuoteService } from '../../services/quote.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { PartsService } from '../../../parts/services/parts.service';
import { AdminService } from '../../../admin/services/admin.service';
import { CustomerListItem } from '../../../customers/models/customer-list-item.model';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { CreateQuoteLineRequest } from '../../models/create-quote-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

interface LineEntry {
  partId: number;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-quote-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent,
    AutocompleteComponent, ValidationPopoverDirective, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './quote-dialog.component.html',
  styleUrl: './quote-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDialogComponent {
  private readonly quoteService = inject(QuoteService);
  private readonly customerService = inject(CustomerService);
  private readonly partsService = inject(PartsService);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  protected readonly parts = signal<PartListItem[]>([]);
  protected readonly lines = signal<LineEntry[]>([]);
  /** True while the unit price reflects the part's list price and hasn't been manually edited. */
  protected readonly priceIsDefault = signal(false);
  /** True while the tax rate was auto-filled from the customer's state and hasn't been manually edited. */
  protected readonly taxAutoFilled = signal(false);
  /** Display label for the auto-filled tax rate (e.g. "CA 7.25%"). */
  protected readonly taxAutoLabel = signal('');

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('quotes.selectCustomer') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly partOptions = computed<AutocompleteOption[]>(() =>
    this.parts().map(p => ({ value: p.id, label: `${p.partNumber} — ${p.description}` })));

  protected readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    expirationDate: new FormControl<Date | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    notes: new FormControl(''),
  });

  private readonly formViolations = FormValidationService.getViolations(this.form, {
    customerId: 'Customer',
    expirationDate: 'Expiration Date',
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

  constructor() {
    this.customerService.getCustomers(undefined, true).subscribe({
      next: (list) => this.customers.set(list),
    });
    // Load all non-deleted parts regardless of status
    this.partsService.getParts().subscribe({
      next: (list) => this.parts.set(list),
    });

    // Auto-fill tax rate from customer's state when customer is selected
    this.form.controls.customerId.valueChanges.subscribe((customerId) => {
      this.taxAutoFilled.set(false);
      this.taxAutoLabel.set('');
      if (customerId == null) return;
      this.adminService.getTaxRateForCustomer(customerId).subscribe({
        next: (rate) => {
          if (rate == null) return;
          const pct = +(rate.rate * 100).toFixed(4);
          this.form.controls.taxRate.setValue(pct, { emitEvent: false });
          this.taxAutoFilled.set(true);
          this.taxAutoLabel.set(
            rate.stateCode ? `${rate.stateCode} ${pct}%` : `Default ${pct}%`
          );
        },
      });
    });

    // When tax rate is manually changed, clear the auto-fill indicator
    this.form.controls.taxRate.valueChanges.subscribe(() => {
      this.taxAutoFilled.set(false);
      this.taxAutoLabel.set('');
    });

    // Pre-fill unit price from part's list price when a part is selected
    this.lineForm.controls.partId.valueChanges.subscribe((partId) => {
      this.onPartSelected(partId);
    });

    // When price is manually changed, clear the "list price" indicator
    this.lineForm.controls.unitPrice.valueChanges.subscribe(() => {
      this.priceIsDefault.set(false);
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  private onPartSelected(partId: number | null): void {
    if (partId == null) {
      this.priceIsDefault.set(false);
      return;
    }
    const part = this.parts().find(p => p.id === partId);
    if (part?.defaultPrice != null) {
      this.lineForm.controls.unitPrice.setValue(part.defaultPrice, { emitEvent: false });
      this.priceIsDefault.set(true);
    } else {
      this.priceIsDefault.set(false);
    }
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
    this.priceIsDefault.set(false);
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.form.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const taxRateDecimal = (f.taxRate ?? 0) / 100;
    const lineRequests: CreateQuoteLineRequest[] = this.lines().map(l => ({
      partId: l.partId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));

    this.quoteService.createQuote({
      customerId: f.customerId!,
      expirationDate: f.expirationDate ? toIsoDate(f.expirationDate)! : undefined,
      taxRate: taxRateDecimal,
      notes: f.notes || undefined,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('quotes.quoteCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
