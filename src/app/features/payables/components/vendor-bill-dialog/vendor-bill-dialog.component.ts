import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, output, signal } from '@angular/core';
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
import { DraftConfig } from '../../../../shared/models/draft-config.model';
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

/** Draft shape of one standalone line row (matches StandaloneLineGroup's raw value). */
interface DraftStandaloneLine {
  partId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

/** Draft shape of one PO-mode row — keyed by purchaseOrderLineId so a restore
 *  can re-match drafted edits against the freshly re-fetched PO. */
interface DraftPoLine {
  purchaseOrderLineId: number | null;
  quantityToBill: number;
  unitPrice: number;
}

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
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
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

  /** Status tick mirroring FormValidationService.getViolations' subscription, but on
   *  the root form: statusChanges bubbles up from FormArray children, so row edits,
   *  adds, and removals all re-run the per-line violation walk below. */
  private readonly formStatus = toSignal(
    this.billForm.statusChanges.pipe(startWith(this.billForm.status)),
    { initialValue: this.billForm.status },
  );

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

  /** Form-level violations + per-row line violations. FormValidationService.getViolations
   *  only scans TOP-LEVEL controls (50+ consumers depend on that), so the FormArray
   *  children are enumerated locally into human row-numbered messages. */
  protected readonly violations = computed<string[]>(() => {
    this.formValue();
    this.formStatus();
    const v = [...this.formViolations()];
    if (this.activeLineCount() === 0) {
      v.push(this.translate.instant('payables.violationNoLines'));
    }
    v.push(...(this.fromPo() ? this.collectPoLineViolations() : this.collectStandaloneLineViolations()));
    return v;
  });

  // ── Draft recovery — Form Draft system via <app-dialog [draftConfig]> ──────
  // Same adapter pattern as InvoiceDialog/PaymentDialog (AR siblings). The
  // FormArrays + mode metadata need custom snapshot/restore (see fns below).
  protected readonly draftConfig: DraftConfig = {
    entityType: 'vendor-bill',
    entityId: 'new',
    route: '/payables/bills',
    snapshotFn: () => this.buildDraftSnapshot(),
    restoreFn: (data) => this.restoreDraftSnapshot(data),
  };

  /** PO-mode draft rows waiting for the fresh PO fetch; applied in loadPoLines. */
  private pendingPoLineRestore: DraftPoLine[] | null = null;

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
        this.applyPendingPoLineRestore();
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

  // ── Per-line violation enumeration ────────────────────────────────────────
  private collectStandaloneLineViolations(): string[] {
    const messages: string[] = [];
    this.standaloneLines.controls.forEach((group, i) => {
      const line = i + 1;
      if (group.controls.description.hasError('required')) {
        messages.push(this.translate.instant('payables.lineViolations.descriptionRequired', { line }));
      }
      if (group.controls.quantity.hasError('required') || group.controls.quantity.hasError('min')) {
        messages.push(this.translate.instant('payables.lineViolations.quantityInvalid', { line }));
      }
      if (group.controls.unitPrice.hasError('required') || group.controls.unitPrice.hasError('min')) {
        messages.push(this.translate.instant('payables.lineViolations.unitPriceInvalid', { line }));
      }
    });
    return messages;
  }

  private collectPoLineViolations(): string[] {
    const messages: string[] = [];
    const meta = this.poLineMeta();
    this.poLines.controls.forEach((group, i) => {
      const line = i + 1;
      const qty = group.controls.quantityToBill;
      if (qty.hasError('max')) {
        messages.push(this.translate.instant('payables.lineViolations.quantityExceedsBillable', {
          line, max: meta[i]?.unbilledReceivedQuantity ?? 0,
        }));
      }
      if (qty.hasError('required') || qty.hasError('min')) {
        messages.push(this.translate.instant('payables.lineViolations.qtyToBillNegative', { line }));
      }
      if (group.controls.unitPrice.hasError('required') || group.controls.unitPrice.hasError('min')) {
        messages.push(this.translate.instant('payables.lineViolations.unitPriceInvalid', { line }));
      }
    });
    return messages;
  }

  // ── Draft snapshot / restore ──────────────────────────────────────────────
  private buildDraftSnapshot(): Record<string, unknown> {
    const f = this.billForm.getRawValue();
    const meta = this.poLineMeta();
    return {
      vendorId: f.vendorId,
      vendorInvoiceNumber: f.vendorInvoiceNumber,
      purchaseOrderId: f.purchaseOrderId,
      billDate: f.billDate,
      dueDate: f.dueDate,
      taxAmount: f.taxAmount,
      currencyId: f.currencyId,
      fxRate: f.fxRate,
      notes: f.notes,
      fromPo: this.fromPoControl.value,
      lines: f.lines,
      // PO rows carry their purchaseOrderLineId so restore can re-match them
      // against the re-fetched PO (billable balances may have moved meanwhile).
      poLines: f.poLines.map((row, i): DraftPoLine => ({
        purchaseOrderLineId: meta[i]?.purchaseOrderLineId ?? null,
        quantityToBill: row.quantityToBill,
        unitPrice: row.unitPrice,
      })),
    };
  }

  /**
   * Standalone-mode drafts restore fully (rows rebuilt one-by-one, then patched).
   * PO-mode drafts restore the header + vendor + PO selection and re-derive the
   * line rows from the FRESH PO: the drafted qty/price are patched back onto rows
   * whose purchaseOrderLineId still matches (queued in pendingPoLineRestore,
   * applied at the end of the async loadPoLines). Drafted rows whose PO line is
   * no longer billable are dropped; drafted quantities now above the fresh
   * billable max are kept as-is so the per-line violation enumeration flags them.
   */
  private restoreDraftSnapshot(data: Record<string, unknown>): void {
    const fromPo = data['fromPo'] === true;

    // Header scalars first — vendorId must be in place before the from-PO
    // toggle flips so loadVendorPos() queries the right vendor's POs.
    this.billForm.patchValue({
      vendorId: (data['vendorId'] as number | null) ?? null,
      vendorInvoiceNumber: (data['vendorInvoiceNumber'] as string | null) ?? '',
      billDate: this.reviveDate(data['billDate']),
      dueDate: this.reviveDate(data['dueDate']),
      taxAmount: (data['taxAmount'] as number | null) ?? 0,
      currencyId: (data['currencyId'] as number | null) ?? this.billForm.controls.currencyId.value,
      fxRate: (data['fxRate'] as number | null) ?? 1,
      notes: (data['notes'] as string | null) ?? '',
    });

    if (fromPo) {
      this.pendingPoLineRestore = Array.isArray(data['poLines'])
        ? (data['poLines'] as DraftPoLine[])
        : [];
      // Triggers the normal pipeline: toggle → clear lines + load vendor POs,
      // then the PO pick → async loadPoLines → applyPendingPoLineRestore.
      this.fromPoControl.setValue(true);
      this.billForm.controls.purchaseOrderId.setValue(
        (data['purchaseOrderId'] as number | null) ?? null,
      );
    } else {
      const rows = Array.isArray(data['lines']) ? (data['lines'] as DraftStandaloneLine[]) : [];
      this.standaloneLines.clear();
      for (const row of rows) {
        this.addLine();
        this.standaloneLines.at(this.standaloneLines.length - 1).patchValue(row);
      }
    }
  }

  private applyPendingPoLineRestore(): void {
    const drafted = this.pendingPoLineRestore;
    if (!drafted) return;
    this.pendingPoLineRestore = null;
    const meta = this.poLineMeta();
    this.poLines.controls.forEach((group, i) => {
      const match = drafted.find(d => d.purchaseOrderLineId === meta[i]?.purchaseOrderLineId);
      if (match) {
        group.patchValue({ quantityToBill: match.quantityToBill, unitPrice: match.unitPrice });
      }
    });
    this.billForm.markAsDirty();
  }

  /** Drafts round-trip IndexedDB's structured clone (Dates survive), but revive
   *  defensively in case a serialized draft hands back an ISO string. */
  private reviveDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value) return new Date(value);
    return null;
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
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('payables.billCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
