import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, output, signal, Signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { VendorService } from '../../../vendors/services/vendor.service';
import { PartsService } from '../../../parts/services/parts.service';
import { VendorResponse } from '../../../vendors/models/vendor-response.model';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { PoLineEntry } from '../../models/po-line-entry.model';
import { CheckTierVarianceResult } from '../../models/tier-variance-check.model';
import { PoVendorRef } from '../../models/po-vendor-ref.model';
import { PoVendorRefsService } from '../../services/po-vendor-refs.service';
import { INCOTERM_OPTIONS } from '../../models/incoterm.const';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { VendorPartsService } from '../../../parts/services/vendor-parts.service';
import { PurchaseUnitsService } from '../../../parts/services/purchase-units.service';
import { PartPurchaseUnit } from '../../../parts/models/part-purchase-unit.model';
import { OffTierPromptDialogComponent, OffTierPromptResult } from '../off-tier-prompt-dialog/off-tier-prompt-dialog.component';
import { PriceOverrideReasonDialogComponent } from '../price-override-reason-dialog/price-override-reason-dialog.component';
import {
  resolveAutoLinePrice,
  commitLinePrice,
  confirmLinePriceReason,
  cancelLinePriceReason,
  LinePriceGateResult,
  LinePriceGateState,
  LinePriceGateContext,
} from './po-line-price.util';
import { toCreateLineRequest, toTierVarianceLines } from './po-line-request.util';
import { AuthService } from '../../../../shared/services/auth.service';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';

@Component({
  selector: 'app-po-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    AutocompleteComponent, CurrencyDisplayComponent, CurrencyInputComponent,
    DatepickerComponent, EntityPickerComponent, ToggleComponent,
    ValidationButtonComponent, TranslatePipe, MatTooltipModule,
    OffTierPromptDialogComponent, PriceOverrideReasonDialogComponent,
  ],
  templateUrl: './po-dialog.component.html',
  styleUrl: './po-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly poService = inject(PurchaseOrderService);
  private readonly vendorService = inject(VendorService);
  private readonly partsService = inject(PartsService);
  private readonly vendorPartsService = inject(VendorPartsService);
  private readonly purchaseUnitsService = inject(PurchaseUnitsService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly vendorRefsService = inject(PoVendorRefsService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  /** Whether the operator may supply a manual PO number override on create. */
  protected readonly allowManualPoNumbers = computed(() => this.manualNumberSettings.isEnabled('purchaseOrders'));

  protected readonly saving = signal(false);
  protected readonly vendors = signal<VendorResponse[]>([]);
  private readonly allParts = signal<PartListItem[]>([]);
  protected readonly parts = computed(() =>
    this.allParts().filter(p => p.procurementSource === 'Buy' || p.procurementSource === 'Subcontract'));
  protected readonly partSearch = signal('');
  protected readonly vendorContacts = signal<PoVendorRef[]>([]);
  protected readonly vendorAddresses = signal<PoVendorRef[]>([]);
  protected readonly shipToLocations = signal<PoVendorRef[]>([]);
  protected readonly vendorParts = signal<Map<number, boolean> | null>(null);
  protected readonly lines = signal<PoLineEntry[]>([]);
  /** True while the unit price reflects the part's list price and hasn't been manually edited. */
  protected readonly priceIsDefault = signal(false);
  /** Temporary storage for an override reason supplied while editing the add-line row. */
  protected readonly pendingLineOverrideReason = signal<string | null>(null);
  protected readonly showPriceReasonDialog = signal(false);
  private lastComputedPrice: number | null = null;
  private defaultFilledPrice: number | null = null;

  /**
   * Phase 3 H2 / WU-12 — when false (default), the vendor & part pickers
   * exclude deactivated entries. The toggle reveals them, labelled
   * "(deactivated)" so the operator knows what they are picking. The
   * server-side active-check is the source of truth: even if the UI lets
   * an inactive entity slip through (form preloaded, toggle on), the
   * server rejects with a 400 envelope naming the inactive record.
   */
  protected readonly showInactiveVendors = signal(false);
  protected readonly showInactiveParts = signal(false);

  protected readonly vendorOptions = computed<SelectOption[]>(() => {
    const includeInactive = this.showInactiveVendors();
    const list = this.vendors().filter(v => includeInactive || v.isActive);
    return [
      { value: null, label: this.translate.instant('purchaseOrders.selectVendor') },
      ...list.map(v => ({
        value: v.id,
        label: v.isActive ? v.companyName : `${v.companyName} ${this.translate.instant('common.deactivatedSuffix')}`,
      })),
    ];
  });

  protected readonly partOptions = computed<AutocompleteOption[]>(() => {
    const includeInactive = this.showInactiveParts();
    return this.parts()
      .filter(p => includeInactive || p.status !== 'Obsolete')
      .sort((a, b) => a.partNumber.localeCompare(b.partNumber, undefined, { numeric: true, sensitivity: 'base' }))
      .map(p => ({ value: p.id, label: this.partLabel(p) }));
  });

  protected readonly makePartHint = computed<string | null>(() => {
    const search = this.partSearch().trim().toLowerCase();
    if (!search) return null;
    const matches = (label: unknown) => String(label).toLowerCase().includes(search);
    if (this.partOptions().some(o => matches(o['label']))) return null;
    const makeParts = this.allParts().filter(p => p.procurementSource === 'Make');
    const made = makeParts.find(p => p.partNumber.toLowerCase() === search)
      ?? makeParts.find(p => matches(this.partLabel(p)));
    return made ? this.translate.instant('poCreate.makePartOnly', { partNumber: made.partNumber }) : null;
  });

  protected readonly contactOptions = computed<SelectOption[]>(() =>
    this.refOptions(this.vendorContacts(), 'poCreate.noContact'));
  protected readonly addressOptions = computed<SelectOption[]>(() =>
    this.refOptions(this.vendorAddresses(), 'poCreate.noAddress'));
  protected readonly shipToOptions = computed<SelectOption[]>(() =>
    this.refOptions(this.shipToLocations(), 'poCreate.noShipTo'));

  protected readonly unapprovedSourceWarning = computed<string | null>(() => {
    const parts = this.lines()
      .filter(l => this.lineSourceApproved(l) === false)
      .map(l => l.partNumber);
    if (parts.length === 0) return null;
    return this.translate.instant('poCreate.unapprovedSourceWarning', { parts: [...new Set(parts)].join(', ') });
  });

  /**
   * Phase 3 H2 / WU-12 — inline-error when the currently-selected vendor
   * is deactivated (form was loaded with one previously selected, or the
   * toggle is on and an inactive vendor was chosen). Mirrors the server's
   * active-check error shape so the operator sees the same wording before
   * submission attempt.
   */
  protected readonly selectedVendorWarning = computed<string | null>(() => {
    const id = this.form.controls.vendorId.value;
    if (id == null) return null;
    const v = this.vendors().find(x => x.id === id);
    if (v && !v.isActive) {
      return this.translate.instant('purchaseOrders.vendorDeactivatedWarning', { name: v.companyName });
    }
    return null;
  });

  /**
   * Inline-error when any line refers to an obsolete part. Produces a
   * single human-readable message naming the offending parts.
   */
  protected readonly inactiveLineWarning = computed<string | null>(() => {
    const obsoleteRefs: string[] = [];
    for (const line of this.lines()) {
      if (line.partId == null) continue;
      const p = this.parts().find(x => x.id === line.partId);
      if (p && p.status === 'Obsolete') obsoleteRefs.push(p.partNumber);
    }
    if (obsoleteRefs.length === 0) return null;
    return this.translate.instant('purchaseOrders.obsoleteLinesWarning', { parts: obsoleteRefs.join(', ') });
  });

  // Bought-parts effort PR2.5 — landed cost header. Defaults: Incoterm
  // FOB_Origin (most common US-domestic case), QuoteCurrency USD. Server
  // overrides these from the preferred VendorPart of the first line at
  // create time when the user hasn't touched them. EstimatedFreight stays
  // null = "no quote yet" (distinct from $0 free shipping).
  protected readonly incotermOptions = INCOTERM_OPTIONS;
  // Currencies are admin-extensible via reference-data group `currency`;
  // fetched once and cached by ReferenceDataService.
  protected readonly quoteCurrencyOptions = signal<SelectOption[]>([]);

  readonly form = new FormGroup({
    poNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    vendorId: new FormControl<number | null>(null, [Validators.required]),
    vendorContactId: new FormControl<number | null>(null),
    vendorAddressId: new FormControl<number | null>(null),
    shipToLocationId: new FormControl<number | null>(null),
    jobId: new FormControl<number | null>(null),
    expectedDeliveryDate: new FormControl<Date | null>(null),
    notes: new FormControl(''),
    incoterm: new FormControl<string>('FOB_Origin', { nonNullable: true }),
    estimatedFreight: new FormControl<number | null>(null, [Validators.min(0)]),
    quoteCurrency: new FormControl<string>('USD', { nonNullable: true }),
  });

  private readonly formViolations = FormValidationService.getViolations(this.form, {
    vendorId: 'Vendor',
    jobId: 'Job',
    expectedDeliveryDate: 'Expected Delivery',
    notes: 'Notes',
    incoterm: 'Incoterm',
    estimatedFreight: 'Estimated Freight',
    quoteCurrency: 'Quote Currency',
  });

  protected readonly violations: Signal<string[]> = computed(() => [
    ...this.formViolations(),
    ...(this.lines().length === 0 ? [this.translate.instant('purchaseOrders.lineRequired')] : []),
    // Phase 3 H2 / WU-12: surface deactivated-master-data warnings inline
    // and block submit when present (the server would reject anyway with a
    // 400; this saves a round trip and gives a friendlier message).
    ...(this.selectedVendorWarning() ? [this.selectedVendorWarning()!] : []),
    ...(this.inactiveLineWarning() ? [this.inactiveLineWarning()!] : []),
  ]);

  protected readonly lineForm = new FormGroup({
    nonStock: new FormControl<boolean>(false, { nonNullable: true }),
    partId: new FormControl<number | null>(null, [Validators.required]),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    purchaseUnitId: new FormControl<number | null>(null),
    // Phase 3 / WU-10 / F8-partial — fractional qty allowed (decimal(18,4) on
    // server). Min is 0.0001 — no zero / negative. Default still 1 for the
    // common whole-unit case (caller can override).
    orderedQuantity: new FormControl<number>(1, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  // UoM purchase-units effort — the selected part's purchase units, loaded when a part is
  // picked. When the part has options the line-add row shows a size/form selector; ordering then
  // counts in options and the price is per option (receiving converts to base UoM server-side).
  protected readonly lineOptions = signal<PartPurchaseUnit[]>([]);
  protected readonly lineOptionSelectOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('purchaseOrders.perBaseUnit') },
    ...this.lineOptions().map(o => ({
      value: o.id,
      label: o.contentUomLabel ? `${o.label} (${o.contentQuantity} ${o.contentUomLabel})` : o.label,
    })),
  ]);

  protected readonly lineTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.orderedQuantity * l.unitPrice, 0)
  );

  protected readonly draftConfig: DraftConfig = {
    entityType: 'purchase-order',
    entityId: 'new',
    route: '/purchase-orders',
    snapshotFn: () => ({
      ...this.form.getRawValue(),
      lines: this.lines(),
      incotermChosen: this.form.controls.incoterm.dirty,
      quoteCurrencyChosen: this.form.controls.quoteCurrency.dirty,
    }),
    restoreFn: (data) => {
      this.form.patchValue(data);
      if (Array.isArray(data['lines'])) this.lines.set(data['lines'] as PoLineEntry[]);
      this.restoreChosen(this.form.controls.incoterm, data['incotermChosen']);
      this.restoreChosen(this.form.controls.quoteCurrency, data['quoteCurrencyChosen']);
      this.form.markAsDirty();
    },
  };

  constructor() {
    this.referenceDataService.getAsOptions('currency').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (options) => this.quoteCurrencyOptions.set(options),
    });
    this.vendorService.getVendorDropdown().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.vendors.set(list),
    });
    this.partsService.getParts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.allParts.set(list),
    });
    this.vendorRefsService.getShipToLocations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (locations) => {
        this.shipToLocations.set(locations);
        this.applyDefaultRef(this.form.controls.shipToLocationId, locations);
      },
    });
    this.form.controls.vendorId.valueChanges
      .pipe(distinctUntilChanged(), switchMap(vendorId => this.loadVendorRefs(vendorId)), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ contacts, addresses, vendorParts }) => {
        this.vendorContacts.set(contacts);
        this.vendorAddresses.set(addresses);
        this.vendorParts.set(vendorParts);
        this.applyDefaultRef(this.form.controls.vendorContactId, contacts);
        this.applyDefaultRef(this.form.controls.vendorAddressId, addresses);
      });

    // Pre-fill unit price from part's list price when a part is selected
    this.lineForm.controls.partId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((partId) => {
      this.onPartSelected(partId);
    });

    this.lineForm.controls.nonStock.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((nonStock) => {
      this.applyNonStockMode(nonStock);
    });

    // Recompute price when quantity or purchase unit changes (if price still default).
    // Debounce to avoid cascading requests during form reset or rapid user input.
    this.lineForm.controls.orderedQuantity.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.maybeRecomputePrice((price) => this.lastComputedPrice = price));
    this.lineForm.controls.purchaseUnitId.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.maybeRecomputePrice((price) => this.lastComputedPrice = price));
    this.form.controls.vendorId.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.maybeRecomputePrice((price) => this.lastComputedPrice = price));
  }

  private loadVendorRefs(vendorId: number | null): Observable<{
    contacts: PoVendorRef[]; addresses: PoVendorRef[]; vendorParts: Map<number, boolean> | null;
  }> {
    if (vendorId == null) return of({ contacts: [], addresses: [], vendorParts: null });
    return forkJoin({
      contacts: this.vendorRefsService.getContacts(vendorId),
      addresses: this.vendorRefsService.getOrderFromAddresses(vendorId),
      vendorParts: this.vendorPartsService.listForVendor(vendorId).pipe(
        map(list => new Map(list.map(vp => [vp.partId, vp.isApproved]))),
        catchError(() => of(null)),
      ),
    });
  }

  private applyDefaultRef(control: FormControl<number | null>, refs: PoVendorRef[]): void {
    if (control.value != null && refs.some(r => r.id === control.value)) return;
    control.setValue(refs.find(r => r.isDefault)?.id ?? null);
  }

  private refOptions(refs: PoVendorRef[], noneKey: string): SelectOption[] {
    return [
      { value: null, label: this.translate.instant(noneKey) },
      ...refs.map(r => ({ value: r.id, label: r.label })),
    ];
  }

  private partLabel(p: PartListItem): string {
    const displayName = p.name ?? p.description ?? '(no name)';
    return p.status === 'Obsolete'
      ? `${p.partNumber} — ${displayName} ${this.translate.instant('common.deactivatedSuffix')}`
      : `${p.partNumber} — ${displayName}`;
  }

  protected lineSourceApproved(line: PoLineEntry): boolean | null {
    const approvals = this.vendorParts();
    if (line.partId == null || approvals == null) return null;
    return approvals.get(line.partId) ?? false;
  }

  protected onPartSearch(event: Event): void {
    this.partSearch.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  private restoreChosen(control: FormControl<string>, chosen: unknown): void {
    if (chosen === true || control.value !== control.defaultValue) control.markAsDirty();
  }

  protected onPriceCommitted(): boolean {
    return this.applyPriceGate(commitLinePrice(this.priceGateState(), this.priceGateContext()));
  }

  protected onPriceReasonConfirmed(reason: string): void {
    this.applyPriceGate(confirmLinePriceReason(this.priceGateState(), reason));
  }

  protected onPriceReasonCancelled(): void {
    this.applyPriceGate(cancelLinePriceReason(this.priceGateState(), this.priceGateContext()));
  }

  private priceGateState(): LinePriceGateState {
    return {
      unitPrice: this.lineForm.controls.unitPrice.value,
      priceIsDefault: this.priceIsDefault(),
      reasonDialogOpen: this.showPriceReasonDialog(),
      overrideReason: this.pendingLineOverrideReason(),
    };
  }

  private priceGateContext(): LinePriceGateContext {
    return {
      canOverride: this.auth.hasRole('Admin') || this.auth.hasRole('Manager'),
      lastComputedPrice: this.lastComputedPrice,
      defaultFilledPrice: this.defaultFilledPrice,
    };
  }

  private applyPriceGate({ state, notice, canAdd }: LinePriceGateResult): boolean {
    const price = this.lineForm.controls.unitPrice;
    if (price.value !== state.unitPrice) price.setValue(state.unitPrice, { emitEvent: false });
    this.priceIsDefault.set(state.priceIsDefault);
    this.showPriceReasonDialog.set(state.reasonDialogOpen);
    this.pendingLineOverrideReason.set(state.overrideReason);
    if (notice === 'purchaseOrders.overrideRecorded') this.snackbar.info(this.translate.instant(notice));
    else if (notice) this.snackbar.error(this.translate.instant(notice));
    return canAdd;
  }

  private applyNonStockMode(nonStock: boolean): void {
    const { partId, description } = this.lineForm.controls;
    this.partSearch.set('');
    if (nonStock) {
      partId.setValue(null);
      this.lineForm.controls.unitPrice.setValue(0, { emitEvent: false });
      partId.setValidators([]);
      description.setValidators([Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]);
    } else {
      description.setValue('');
      partId.setValidators([Validators.required]);
      description.setValidators([Validators.maxLength(500)]);
    }
    partId.updateValueAndValidity({ emitEvent: false });
    description.updateValueAndValidity();
  }

  private maybeRecomputePrice(snapshotLastComputed?: (price: number | null) => void): void {
    if (!this.priceIsDefault() || this.showPriceReasonDialog()) return;
    const partId = this.lineForm.controls.partId.value;
    const vendorId = this.form.controls.vendorId.value;
    const qty = this.lineForm.controls.orderedQuantity.value ?? 1;
    const purchaseUnitId = this.lineForm.controls.purchaseUnitId.value ?? null;
    if (!partId) return;

    // Try vendor-specific tiers first
    this.vendorPartsService.listForPart(partId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        // Selection rules (vendor preference, option-match/null fallback,
        // qty-break, then part effective price) live in resolveAutoLinePrice
        // so they're unit-tested in isolation (forge#8).
        const part = this.parts().find(p => p.id === partId);
        const chosenPrice = resolveAutoLinePrice(list, vendorId, qty, purchaseUnitId, part?.effectivePrice);

        if (chosenPrice != null) {
          this.lineForm.controls.unitPrice.setValue(chosenPrice, { emitEvent: false });
          this.priceIsDefault.set(true);
          this.defaultFilledPrice = chosenPrice;
          if (snapshotLastComputed) snapshotLastComputed(chosenPrice);
        }
      },
      error: (err) => {
        console.error(`Failed to recompute price for part ${partId}:`, err);
        // Don't disturb user input on vendorParts failure
      },
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  private onPartSelected(partId: number | null): void {
    // Reset the option selector for the newly chosen part, then load its options.
    this.lineForm.controls.purchaseUnitId.setValue(null, { emitEvent: false });
    this.lineOptions.set([]);
    this.lastComputedPrice = null;
    this.defaultFilledPrice = null;
    this.pendingLineOverrideReason.set(null);
    if (partId == null) {
      this.priceIsDefault.set(false);
      return;
    }
    this.purchaseUnitsService.list(partId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (opts) => this.lineOptions.set(opts),
      error: (err) => {
        console.error(`Failed to load purchase units for part ${partId}:`, err);
        this.lineOptions.set([]);
      },
    });
    const part = this.parts().find(p => p.id === partId);
    // Use the resolver-supplied effective price. When source is "Default" the
    // resolver returned 0 (no pricing configured) — don't pre-fill in that case.
    if (part && part.effectivePriceSource !== 'Default' && part.effectivePrice > 0) {
      this.lineForm.controls.unitPrice.setValue(part.effectivePrice, { emitEvent: false });
      this.priceIsDefault.set(true);
      this.defaultFilledPrice = part.effectivePrice;
    } else {
      this.priceIsDefault.set(false);
    }
  }

  protected addLine(): void {
    if (!this.onPriceCommitted() || this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const notes = f.notes.trim() || null;
    if (f.nonStock) {
      this.lines.update(prev => [...prev, {
        partId: null,
        partNumber: null,
        description: f.description.trim(),
        orderedQuantity: f.orderedQuantity!,
        unitPrice: f.unitPrice!,
        purchaseUnitId: null,
        purchaseUnitLabel: null,
        notes,
      }]);
      this.resetLineForm(true);
      return;
    }
    const part = this.parts().find(p => p.id === f.partId);
    if (!part) return;
    const option = f.purchaseUnitId != null ? this.lineOptions().find(o => o.id === f.purchaseUnitId) : undefined;
    this.lines.update(prev => [...prev, {
      partId: part.id,
      partNumber: part.partNumber,
      // Phase-4 Name+Description split: PO line carries the part's short
      // identifier (formerly stored as Description) — Name is now canonical.
      description: part.name,
      orderedQuantity: f.orderedQuantity!,
      unitPrice: f.unitPrice!,
      purchaseUnitId: f.purchaseUnitId ?? null,
      purchaseUnitLabel: option ? option.label : null,
      notes,
      overrideReason: this.pendingLineOverrideReason(),
    }]);
    this.resetLineForm(false);
  }

  private resetLineForm(nonStock: boolean): void {
    this.lineForm.reset(
      { nonStock, partId: null, description: '', notes: '', purchaseUnitId: null, orderedQuantity: 1, unitPrice: 0 },
      { emitEvent: false },
    );
    this.lineOptions.set([]);
    this.priceIsDefault.set(false);
    this.lastComputedPrice = null;
    this.defaultFilledPrice = null;
    this.pendingLineOverrideReason.set(null);
    this.partSearch.set('');
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  // Bought-parts effort PR4 — off-tier prompt state. Checked on save;
  // when any line is off-tier the prompt opens and the PO submission
  // pauses until the user confirms (or cancels).
  protected readonly showOffTierPrompt = signal(false);
  protected readonly offTierLines = signal<CheckTierVarianceResult[]>([]);
  protected readonly noTierLines = signal<CheckTierVarianceResult[]>([]);
  protected readonly offTierThresholdPct = signal(5);
  protected readonly partLookup = computed(() => {
    const map = new Map<number, { partNumber: string; description: string }>();
    for (const p of this.parts()) {
      map.set(p.id, { partNumber: p.partNumber, description: p.description ?? p.name });
    }
    return map;
  });

  protected save(): void {
    if (this.form.invalid || this.lines().length === 0) return;
    // Phase 3 H2 / WU-12: refuse client-side when a deactivated vendor or
    // obsolete part is referenced — the server will 400 anyway, but this
    // keeps the user out of a flicker.
    if (this.selectedVendorWarning() || this.inactiveLineWarning()) return;
    this.saving.set(true);

    // Bought-parts effort PR4 — variance check before submit. One round
    // trip evaluates every part line; if any are off-tier the prompt fires
    // before the PO is created.
    const f = this.form.getRawValue();
    const vendorId = f.vendorId!;
    const varianceLines = toTierVarianceLines(this.lines());
    if (varianceLines.length === 0) {
      this.submitPo();
      return;
    }
    this.vendorPartsService.checkTierVariance({
      vendorId,
      lines: varianceLines,
    }).subscribe({
      next: (result) => {
        const offTier = result.lines.filter(l => l.isOffTier && l.hasTier !== false);
        if (offTier.length === 0) {
          this.submitPo();
          return;
        }
        this.offTierLines.set(offTier);
        this.noTierLines.set(result.lines.filter((l, i, all) =>
          l.hasTier === false && all.findIndex(o => o.hasTier === false && o.partId === l.partId) === i));
        this.offTierThresholdPct.set(result.thresholdPct);
        this.showOffTierPrompt.set(true);
        this.saving.set(false);
      },
      error: () => {
        // If the variance check itself fails, don't block submit — log a
        // soft toast and proceed. The variance prompt is informational; a
        // server hiccup shouldn't block legitimate PO creation.
        this.submitPo();
      },
    });
  }

  protected onOffTierCancel(): void {
    this.showOffTierPrompt.set(false);
    this.offTierLines.set([]);
    this.noTierLines.set([]);
  }

  protected onOffTierConfirm(result: OffTierPromptResult): void {
    this.showOffTierPrompt.set(false);
    this.saving.set(true);

    // For lines flagged "update tier", upsert a new VendorPartPriceTier.
    // Skip lines that already exist with no VendorPartId — those need a
    // VendorPart row first, which is admin-managed; we'd rather record
    // the line as exception and leave the tier insert for a follow-up.
    const tierUpserts = result.updateTierLines
      .filter(l => l.vendorPartId !== null)
      .map(l => this.vendorPartsService.addPriceTier(l.vendorPartId!, {
        minQuantity: l.quantity,
        unitPrice: l.unitPrice,
        effectiveFrom: toIsoDate(new Date()),
      }).pipe(catchError(() => of(null))));

    const priceSaves = result.savePriceLines.map(l => this.saveVendorPrice(l));

    if (tierUpserts.length === 0 && priceSaves.length === 0) {
      this.submitPo();
      return;
    }

    forkJoin([...tierUpserts, ...priceSaves]).subscribe({
      next: (outcomes) => {
        if (outcomes.slice(tierUpserts.length).some(saved => saved === false)) {
          this.snackbar.error(this.translate.instant('poCreate.savePriceFailed'));
        }
        this.submitPo();
      },
      error: () => {
        // Tier upsert failed — surface to user but don't block PO submit.
        // The PO is still legitimate; tier update can be retried later.
        this.snackbar.error(this.translate.instant('purchaseOrders.offTier.updateTierFailed'));
        this.submitPo();
      },
    });
  }

  private saveVendorPrice(line: CheckTierVarianceResult): Observable<boolean> {
    const f = this.form.getRawValue();
    const poLine = this.lines().find(l =>
      l.partId === line.partId && l.orderedQuantity === line.quantity && l.unitPrice === line.unitPrice);
    const vendorPartId$ = line.vendorPartId !== null
      ? of(line.vendorPartId)
      : this.vendorPartsService.create({
        vendorId: f.vendorId!,
        partId: line.partId,
        isApproved: false,
        isPreferred: false,
        currency: f.quoteCurrency,
      }).pipe(map(vp => vp.id));
    return vendorPartId$.pipe(
      switchMap(vendorPartId => this.vendorPartsService.addPriceTier(vendorPartId, {
        minQuantity: Math.min(1, line.quantity),
        unitPrice: line.unitPrice,
        effectiveFrom: toIsoDate(new Date()),
        purchaseUnitId: poLine?.purchaseUnitId ?? null,
      })),
      map(() => true),
      catchError(() => of(false)),
    );
  }

  private submitPo(): void {
    this.saving.set(true);
    const f = this.form.getRawValue();
    const controls = this.form.controls;

    this.poService.createPurchaseOrder({
      vendorId: f.vendorId!,
      vendorContactId: f.vendorContactId ?? undefined,
      vendorAddressId: f.vendorAddressId ?? undefined,
      shipToLocationId: f.shipToLocationId ?? undefined,
      jobId: f.jobId ?? undefined,
      notes: f.notes || undefined,
      poNumber: this.allowManualPoNumbers() ? (f.poNumber?.trim() || undefined) : undefined,
      lines: this.lines().map(toCreateLineRequest),
      incoterm: controls.incoterm.dirty ? f.incoterm : undefined,
      estimatedFreight: f.estimatedFreight ?? undefined,
      quoteCurrency: controls.quoteCurrency.dirty ? f.quoteCurrency : undefined,
      expectedDeliveryDate: toIsoDate(f.expectedDeliveryDate) ?? undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('purchaseOrders.poCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
