import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, output, signal, Signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { QuoteService } from '../../services/quote.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { AdminService } from '../../../admin/services/admin.service';
import { CustomerTaxEditability } from '../../../customers/models/customer-tax-editability.model';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { CreateQuoteLineRequest } from '../../models/create-quote-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

interface LineEntry {
  partId: number;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

// S2 note: this dialog deliberately has NO payment-schedule editor. Schedules
// attach to SAVED quotes (the PUT is addressed by quoteId), so the quote
// detail panel's "Payment Schedule" section is the single home for authoring
// and editing them (see payment-schedule-dialog.component.ts).
@Component({
  selector: 'app-quote-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    DialogComponent, InputComponent, DatepickerComponent, TextareaComponent,
    EntityPickerComponent, CurrencyDisplayComponent, ValidationButtonComponent, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './quote-dialog.component.html',
  styleUrl: './quote-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  @ViewChild('customerPicker') private customerPicker?: EntityPickerComponent;
  private readonly quoteService = inject(QuoteService);
  private readonly customerService = inject(CustomerService);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  /** Whether the shop allows a manual quote-number override on create/rename. */
  protected readonly allowManualQuoteNumbers = computed(() => this.manualNumberSettings.isEnabled('quotes'));

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly selectedPart = signal<PartListItem | null>(null);
  private readonly customerName = signal('');
  protected readonly lines = signal<LineEntry[]>([]);
  /** True while the unit price reflects the part's list price and hasn't been manually edited. */
  protected readonly priceIsDefault = signal(false);
  /** True while the tax rate was auto-filled from the customer's state and hasn't been manually edited. */
  protected readonly taxAutoFilled = signal(false);
  /** Display label for the auto-filled tax rate (e.g. "CA 7.25%"). */
  protected readonly taxAutoLabel = signal('');
  /** S1 — server verdict on whether this customer's tax rate may be overridden. */
  protected readonly taxEditability = signal<CustomerTaxEditability | null>(null);
  /** S1 — tax field locked: editability is known and no verified certificate is on file. */
  protected readonly taxLocked = computed(() => this.taxEditability()?.canEditTax === false);
  /** True once the user manually edits the tax rate away from the auto-filled default. */
  protected readonly taxOverridden = signal(false);
  /** S1 — the manual override is backed by a verified certificate (badge cue). */
  protected readonly taxCertBacked = computed(
    () => this.taxOverridden() && this.taxEditability()?.canEditTax === true);

  protected readonly customerFilters: Record<string, string> = { isActive: 'true', sort: 'name', order: 'asc' };
  protected readonly partFilters: Record<string, string> = { isActive: 'true', sort: 'partNumber', order: 'asc' };

  readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    // Optional manual override; blank → server auto-generates. Only surfaced when the setting is on.
    quoteNumber: new FormControl('', [Validators.maxLength(20)]),
    expirationDate: new FormControl<Date | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    customerPO: new FormControl('', [Validators.maxLength(50)]),
    notes: new FormControl(''),
  });

  private readonly formViolations = FormValidationService.getViolations(this.form, {
    customerId: 'Customer',
    expirationDate: 'Expiration Date',
    taxRate: 'Tax Rate',
    customerPO: 'Customer P.O.',
    notes: 'Notes',
  });

  protected readonly violations: Signal<string[]> = computed(() => [
    ...this.formViolations(),
    ...(this.lines().length === 0 ? ['At least one line item is required'] : []),
  ]);

  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    // Phase 3 / WU-23 (F8-broad): fractional UoM-aware quantities accepted.
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  protected readonly lineTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  );

  protected readonly taxRateValue = signal<number>(this.form.controls.taxRate.value ?? 0);

  protected readonly taxAmount = computed(() => (this.taxRateValue() ?? 0) / 100 * this.lineTotal());
  protected readonly grandTotal = computed(() => this.lineTotal() + this.taxAmount());

  protected readonly draftConfig: DraftConfig = {
    entityType: 'quote',
    entityId: 'new',
    route: '/quotes',
    snapshotFn: () => ({ ...this.form.getRawValue(), customerName: this.customerName(), lines: this.lines() }),
    restoreFn: (data) => {
      const customerId = typeof data['customerId'] === 'number' ? data['customerId'] : null;
      const customerName = typeof data['customerName'] === 'string' ? data['customerName'] : '';
      if (customerId != null && customerName) {
        this.customerName.set(customerName);
        this.customerPicker?.setSelected(customerId, customerName);
      }
      this.form.patchValue(data);
      if (Array.isArray(data['lines'])) this.lines.set(data['lines'] as LineEntry[]);
      this.form.markAsDirty();
    },
  };

  constructor() {
    // Auto-fill tax rate from customer's state when customer is selected
    this.form.controls.customerId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((customerId) => {
      this.taxAutoFilled.set(false);
      this.taxAutoLabel.set('');
      // S1 — reset the tax-override gate until the new customer's verdict arrives.
      this.taxOverridden.set(false);
      this.taxEditability.set(null);
      this.form.controls.taxRate.enable({ emitEvent: false });
      if (customerId == null) return;
      this.adminService.getTaxRateForCustomer(customerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (rate) => {
          if (rate == null) return;
          const pct = +(rate.rate * 100).toFixed(4);
          this.form.controls.taxRate.setValue(pct, { emitEvent: false });
          this.taxRateValue.set(pct);
          this.taxAutoFilled.set(true);
          this.taxAutoLabel.set(
            rate.stateCode ? `${rate.stateCode} ${pct}%` : `Default ${pct}%`
          );
        },
      });
      // S1 — the tax rate stays editable only when the customer has a
      // Verified, unexpired tax certificate; otherwise lock the control on
      // the auto-filled default (the server enforces the same gate).
      this.customerService.getTaxEditability(customerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (editability) => {
          this.taxEditability.set(editability);
          if (!editability.canEditTax) {
            this.form.controls.taxRate.disable({ emitEvent: false });
          }
        },
      });
    });

    // When tax rate is manually changed, clear the auto-fill indicator
    this.form.controls.taxRate.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.taxRateValue.set(value ?? 0);
      this.taxAutoFilled.set(false);
      this.taxAutoLabel.set('');
      // S1 — a manual edit is an override (cert-backed badge when allowed).
      this.taxOverridden.set(true);
    });

    this.lineForm.controls.partId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((partId) => {
      if (partId == null) this.onPartPicked(null);
    });

    // When price is manually changed, clear the "list price" indicator
    this.lineForm.controls.unitPrice.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.priceIsDefault.set(false);
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onCustomerSelected(customer: Record<string, unknown> | null): void {
    this.customerName.set(customer ? String(customer['name'] ?? '') : '');
  }

  protected onPartPicked(row: Record<string, unknown> | null): void {
    const part = row as PartListItem | null;
    this.selectedPart.set(part);
    if (part == null) {
      this.priceIsDefault.set(false);
      return;
    }
    // Use the resolver-supplied effective price. When source is "Default" the
    // resolver returned 0 (no pricing configured) — don't pre-fill in that case.
    if (part && part.effectivePriceSource !== 'Default' && part.effectivePrice > 0) {
      this.lineForm.controls.unitPrice.setValue(part.effectivePrice, { emitEvent: false });
      this.priceIsDefault.set(true);
    } else {
      this.priceIsDefault.set(false);
    }
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const part = this.selectedPart();
    if (!part || part.id !== f.partId) return;
    this.lines.update(prev => [...prev, {
      partId: part.id,
      partNumber: part.partNumber,
      // Phase-4 Name+Description split: line carries the part's short
      // identifier — Name is now the canonical short identifier.
      description: part.name,
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
      quoteNumber: this.allowManualQuoteNumbers() ? (f.quoteNumber?.trim() || undefined) : undefined,
      expirationDate: f.expirationDate ? toIsoDate(f.expirationDate)! : undefined,
      taxRate: taxRateDecimal,
      customerPO: f.customerPO || undefined,
      notes: f.notes || undefined,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('quotes.quoteCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
