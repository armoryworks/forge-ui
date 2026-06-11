import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { VendorBillService } from '../../services/vendor-bill.service';
import { CreateVendorBillLineRequest } from '../../models/create-vendor-bill-line-request.model';
import { VendorService } from '../../../vendors/services/vendor.service';
import { PurchaseOrderService } from '../../../purchase-orders/services/purchase-order.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';
import { ActiveCurrency } from '../../../../shared/models/active-currency.model';
import { toIsoDate, todayEnd } from '../../../../shared/utils/date.utils';

/** Static (non-form) metadata for one billable PO line row. */
interface PoLineMeta {
  purchaseOrderLineId: number;
  partId: number;
  partNumber: string;
  description: string;
  receivedQuantity: number;
  unbilledReceivedQuantity: number;
}

type StandaloneLineGroup = FormGroup<{
  partId: FormControl<number | null>;
  description: FormControl<string>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
}>;

type PoLineGroup = FormGroup<{
  quantityToBill: FormControl<number>;
  unitPrice: FormControl<number>;
}>;

// ⚡ ACCOUNTING BOUNDARY — AP counterpart of InvoiceDialog. Two modes:
// standalone lines, or lines pulled from a vendor PO's unbilled receipts
// (3-way match — price edits against the PO price become PPV on posting).
@Component({
  selector: 'app-vendor-bill-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent,
    ToggleComponent, CurrencyInputComponent, CurrencyDisplayComponent, EntityPickerComponent,
    ValidationButtonComponent, MatTooltipModule,
  ],
  templateUrl: './vendor-bill-dialog.component.html',
  styleUrl: './vendor-bill-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorBillDialogComponent {
  private readonly billService = inject(VendorBillService);
  private readonly vendorService = inject(VendorService);
  private readonly purchaseOrderService = inject(PurchaseOrderService);
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

  // ── Lines — standalone mode ────────────────────────────────────────────────
  protected readonly standaloneLines = new FormArray<StandaloneLineGroup>([]);

  // ── Lines — from-PO mode ──────────────────────────────────────────────────
  protected readonly poLines = new FormArray<PoLineGroup>([]);
  protected readonly poLineMeta = signal<PoLineMeta[]>([]);
  protected readonly poOptions = signal<SelectOption[]>([]);
  protected readonly loadingPoLines = signal(false);
  /** True once a PO was loaded and none of its lines have unbilled receipts. */
  protected readonly poHasNoBillableLines = signal(false);

  // ── Multi-currency (additive) — same conditional pattern as InvoiceDialog ──
  protected readonly currencies = signal<ActiveCurrency[]>([]);
  protected readonly baseCurrencyId = computed<number | null>(
    () => this.currencies().find(c => c.isBaseCurrency)?.id ?? this.currencies()[0]?.id ?? null,
  );
  protected readonly showCurrencySelector = computed(() => this.currencies().length > 1);
  protected readonly currencyOptions = computed<SelectOption[]>(() =>
    this.currencies().map(c => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  );

  protected readonly billForm = new FormGroup({
    vendorId: new FormControl<number | null>(null, [Validators.required]),
    vendorInvoiceNumber: new FormControl(''),
    purchaseOrderId: new FormControl<number | null>(null),
    billDate: new FormControl<Date | null>(null, [Validators.required]),
    dueDate: new FormControl<Date | null>(null, [Validators.required]),
    taxAmount: new FormControl<number | null>(0, [Validators.min(0)]),
    currencyId: new FormControl<number | null>(null),
    fxRate: new FormControl<number>(1, [Validators.required, Validators.min(0.0000001)]),
    notes: new FormControl(''),
    lines: this.standaloneLines,
    poLines: this.poLines,
  });

  /** Mode toggle — false = standalone lines, true = from purchase order. */
  protected readonly fromPoControl = new FormControl<boolean>(false, { nonNullable: true });
  protected readonly fromPo = toSignal(
    this.fromPoControl.valueChanges.pipe(startWith(this.fromPoControl.value)),
    { initialValue: this.fromPoControl.value },
  );

  private readonly selectedCurrencyId = toSignal(
    this.billForm.controls.currencyId.valueChanges.pipe(
      startWith(this.billForm.controls.currencyId.value),
    ),
    { initialValue: this.billForm.controls.currencyId.value },
  );
  /** FX rate is only relevant (and shown) when a non-base currency is chosen. */
  protected readonly showFxRate = computed(() => {
    const base = this.baseCurrencyId();
    const selected = this.selectedCurrencyId();
    return base !== null && selected !== null && selected !== base;
  });

  /** Reactivity tick for the computed totals — fires on any nested line edit. */
  private readonly formValue = toSignal(this.billForm.valueChanges, { initialValue: null });

  protected readonly linesTotal = computed(() => {
    this.formValue();
    if (this.fromPo()) {
      return this.poLines.controls.reduce(
        (sum, g) => sum + (g.controls.quantityToBill.value ?? 0) * (g.controls.unitPrice.value ?? 0), 0);
    }
    return this.standaloneLines.controls.reduce(
      (sum, g) => sum + (g.controls.quantity.value ?? 0) * (g.controls.unitPrice.value ?? 0), 0);
  });

  protected readonly taxAmountValue = toSignal(
    this.billForm.controls.taxAmount.valueChanges.pipe(startWith(this.billForm.controls.taxAmount.value ?? 0)),
    { initialValue: this.billForm.controls.taxAmount.value ?? 0 },
  );

  protected readonly grandTotal = computed(() => this.linesTotal() + (this.taxAmountValue() ?? 0));

  /** Lines that would actually be submitted (PO rows with qty 0 are omitted). */
  protected readonly activeLineCount = computed(() => {
    this.formValue();
    if (this.fromPo()) {
      return this.poLines.controls.filter(g => (g.controls.quantityToBill.value ?? 0) > 0).length;
    }
    return this.standaloneLines.length;
  });

  private readonly formViolations = FormValidationService.getViolations(this.billForm, {
    vendorId: this.translate.instant('payables.vendor'),
    vendorInvoiceNumber: this.translate.instant('payables.vendorInvoiceNumber'),
    purchaseOrderId: this.translate.instant('payables.purchaseOrder'),
    billDate: this.translate.instant('payables.billDate'),
    dueDate: this.translate.instant('common.dueDate'),
    taxAmount: this.translate.instant('payables.tax'),
    currencyId: this.translate.instant('accounting.currency.currency'),
    fxRate: this.translate.instant('accounting.currency.fxRate'),
    notes: this.translate.instant('common.notes'),
  });

  /** Form-level violations + line-array aggregates (FormArray children aren't scanned). */
  protected readonly violations = computed<string[]>(() => {
    this.formValue();
    const v = [...this.formViolations()];
    if (this.activeLineCount() === 0) {
      v.push(this.translate.instant('payables.violationNoLines'));
    }
    if (this.fromPo() ? this.poLines.invalid : this.standaloneLines.invalid) {
      v.push(this.translate.instant('payables.violationInvalidLines'));
    }
    return v;
  });

  constructor() {
    this.vendorService.getVendorDropdown().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.vendorOptions.set([
        { value: null, label: this.translate.instant('payables.selectVendor') },
        ...list.filter(vendor => vendor.isActive).map(vendor => ({ value: vendor.id, label: vendor.companyName })),
      ]),
    });

    // Load active currencies; default the form to the base currency. The
    // selector only renders when >1 active currency exists.
    this.currencyService.listActiveCurrencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        this.currencies.set(list);
        const base = this.baseCurrencyId();
        if (base !== null && this.billForm.controls.currencyId.value === null) {
          this.billForm.controls.currencyId.setValue(base);
        }
      },
    });

    // Returning to the base currency resets the booking rate to 1.
    this.billForm.controls.currencyId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (id === this.baseCurrencyId()) {
          this.billForm.controls.fxRate.setValue(1);
        }
      });

    // Switching mode clears the OTHER mode's lines (the create invariant is
    // all-or-nothing on purchaseOrderLineId).
    this.fromPoControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fromPo) => {
        this.standaloneLines.clear();
        this.clearPoSelection();
        if (fromPo) {
          this.loadVendorPos();
        } else {
          this.poOptions.set([]);
        }
      });

    // Vendor drives which POs are offered; changing vendor resets the PO pick.
    this.billForm.controls.vendorId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.fromPoControl.value) {
          this.clearPoSelection();
          this.loadVendorPos();
        }
      });

    // Picking a PO loads its billable (received − billed > 0) lines.
    this.billForm.controls.purchaseOrderId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((poId) => {
        this.poLines.clear();
        this.poLineMeta.set([]);
        this.poHasNoBillableLines.set(false);
        if (poId) {
          this.loadPoLines(poId);
        }
      });
  }

  protected close(): void {
    this.closed.emit();
  }

  // ── Standalone lines ──────────────────────────────────────────────────────
  protected addLine(): void {
    this.standaloneLines.push(new FormGroup({
      partId: new FormControl<number | null>(null),
      description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.0001)] }),
      unitPrice: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    }));
  }

  protected removeLine(index: number): void {
    this.standaloneLines.removeAt(index);
  }

  // ── From-PO lines ─────────────────────────────────────────────────────────
  private loadVendorPos(): void {
    const vendorId = this.billForm.controls.vendorId.value;
    if (!vendorId) {
      this.poOptions.set([]);
      return;
    }
    // The PO list endpoint filters by vendorId server-side.
    this.purchaseOrderService.getPurchaseOrders(vendorId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.poOptions.set([
        { value: null, label: this.translate.instant('payables.selectPurchaseOrder') },
        ...list.map(po => ({ value: po.id, label: `${po.poNumber} — ${po.vendorName}` })),
      ]),
    });
  }

  private loadPoLines(poId: number): void {
    this.loadingPoLines.set(true);
    this.purchaseOrderService.getPurchaseOrderById(poId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (po) => {
        const billable = po.lines.filter(l => l.unbilledReceivedQuantity > 0);
        this.poLineMeta.set(billable.map(l => ({
          purchaseOrderLineId: l.id,
          partId: l.partId,
          partNumber: l.partNumber,
          description: l.description,
          receivedQuantity: l.receivedQuantity,
          unbilledReceivedQuantity: l.unbilledReceivedQuantity,
        })));
        for (const line of billable) {
          this.poLines.push(new FormGroup({
            // Default to billing everything still unbilled; rows zeroed out are omitted.
            quantityToBill: new FormControl(line.unbilledReceivedQuantity, {
              nonNullable: true,
              validators: [Validators.required, Validators.min(0), Validators.max(line.unbilledReceivedQuantity)],
            }),
            // Prefill the PO price; edits become purchase-price variance on posting.
            unitPrice: new FormControl(line.unitPrice, {
              nonNullable: true,
              validators: [Validators.required, Validators.min(0)],
            }),
          }));
        }
        this.poHasNoBillableLines.set(billable.length === 0);
        this.loadingPoLines.set(false);
      },
      error: () => this.loadingPoLines.set(false),
    });
  }

  private clearPoSelection(): void {
    this.billForm.controls.purchaseOrderId.setValue(null, { emitEvent: false });
    this.poLines.clear();
    this.poLineMeta.set([]);
    this.poHasNoBillableLines.set(false);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  protected save(): void {
    if (this.billForm.invalid || this.activeLineCount() === 0 || this.saving()) return;
    this.saving.set(true);

    const f = this.billForm.getRawValue();
    const fromPo = this.fromPo();

    let lines: CreateVendorBillLineRequest[];
    if (fromPo) {
      const meta = this.poLineMeta();
      lines = this.poLines.controls
        .map((g, i) => ({ value: g.getRawValue(), meta: meta[i] }))
        .filter(x => x.value.quantityToBill > 0)
        .map(x => ({
          partId: x.meta.partId,
          description: x.meta.description,
          quantity: x.value.quantityToBill,
          unitPrice: x.value.unitPrice,
          purchaseOrderLineId: x.meta.purchaseOrderLineId,
        }));
    } else {
      lines = this.standaloneLines.controls.map(g => {
        const value = g.getRawValue();
        return {
          partId: value.partId ?? undefined,
          description: value.description,
          quantity: value.quantity,
          unitPrice: value.unitPrice,
        };
      });
    }

    // Only attach currency when the install is multi-currency; otherwise the
    // server resolves the functional currency. FX rate is 1 for base currency.
    const isBase = f.currencyId === this.baseCurrencyId();
    const currencyId = this.showCurrencySelector() ? (f.currencyId ?? undefined) : undefined;
    const fxRate = isBase ? 1 : (f.fxRate ?? 1);

    this.billService.createVendorBill({
      vendorId: f.vendorId!,
      vendorInvoiceNumber: f.vendorInvoiceNumber || undefined,
      purchaseOrderId: fromPo ? (f.purchaseOrderId ?? undefined) : undefined,
      billDate: toIsoDate(f.billDate!)!,
      dueDate: toIsoDate(f.dueDate!)!,
      taxAmount: f.taxAmount ?? 0,
      notes: f.notes || undefined,
      currencyId,
      fxRate,
      lines,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('payables.billCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
