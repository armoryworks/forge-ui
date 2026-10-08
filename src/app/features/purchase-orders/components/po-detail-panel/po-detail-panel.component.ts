import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { PurchaseOrderRelease, CreatePurchaseOrderReleaseRequest } from '../../models/purchase-order-release.model';
import { ReceiveDialogComponent } from '../receive-dialog/receive-dialog.component';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { INCOTERM_OPTIONS } from '../../models/incoterm.const';
import { PO_ORIGIN_CHIP_CLASSES, PO_ORIGIN_ICONS, poOriginLabel, poOriginTooltip } from '../../models/po-origin.const';
import { PurchaseOrderLine } from '../../models/purchase-order-line.model';
import { SendPoEmailDialogData } from '../../models/send-po-email-dialog-data.model';
import { SendPoEmailDialogComponent } from '../send-po-email-dialog/send-po-email-dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { FileUploadZoneComponent } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { FileAttachment } from '../../../../shared/models/file.model';
import { CurrencyService } from '../../../../shared/services/currency.service';
import { VendorService } from '../../../vendors/services/vendor.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { NumberLockInfoComponent } from '../../../../shared/components/number-lock-info/number-lock-info.component';

@Component({
  selector: 'app-po-detail-panel',
  standalone: true,
  imports: [NumberLockInfoComponent, 
    DatePipe, DecimalPipe, TranslatePipe, ReactiveFormsModule,
    MatTooltipModule,
    BarcodeInfoComponent, EntityActivitySectionComponent,
    ReceiveDialogComponent, LoadingBlockDirective,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent,
    ValidationButtonComponent,
    EntityLinkComponent, CurrencyDisplayComponent, CurrencyInputComponent,
    DataTableComponent, ColumnCellDirective,
    EntityPickerComponent, FileUploadZoneComponent,
  ],
  templateUrl: './po-detail-panel.component.html',
  styleUrl: './po-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoDetailPanelComponent implements OnInit {
  private readonly poService = inject(PurchaseOrderService);
  private readonly referenceDataService = inject(ReferenceDataService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly currencyService = inject(CurrencyService);
  private readonly vendorService = inject(VendorService);

  /** Whether the PO number may be renamed (manual numbers on AND PO still in Draft). */
  protected readonly allowManualPoNumbers = computed(() => this.manualNumberSettings.isEnabled('purchaseOrders'));
  /** Manual numbering is on, but this record's lifecycle fixes the number. */
  protected readonly poNumberLocked = computed(() => this.allowManualPoNumbers() && !this.canEditPoNumber());
  protected readonly canEditPoNumber = computed(() => this.allowManualPoNumbers() && this.po()?.status === 'Draft');

  constructor() {
    // Bought-parts effort PR2.5 — load currency options from reference-data
    // (group `currency`). Cached at the service so re-opening the panel
    // doesn't re-fetch.
    this.referenceDataService.getAsOptions('currency').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (options) => this.quoteCurrencyOptions.set(options),
    });
  }

  // Phase 3 / WU-14 / H3 — short-close is gated to roles that handle PO
  // closure / AP follow-up. Mirrors the server-side [Authorize] list.
  protected readonly canShortCloseRole = this.auth.hasAnyRole(['Admin', 'Manager', 'OfficeManager', 'Procurement']);

  readonly purchaseOrderId = input.required<number>();
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly po = signal<PurchaseOrderDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly showReceiveDialog = signal(false);
  protected readonly releases = signal<PurchaseOrderRelease[]>([]);
  protected readonly showCreateReleaseDialog = signal(false);
  protected readonly releaseSaving = signal(false);

  // S4b provenance — header origin chip. Single-entity surface, so computed
  // signals (not row-scoped helper functions) drive the bindings.
  protected readonly originChipClass = computed(() => {
    const source = this.po()?.originSource ?? 'Manual';
    return `chip po-origin-chip ${PO_ORIGIN_CHIP_CLASSES[source] ?? 'chip--muted'}`;
  });

  protected readonly originIcon = computed(() => {
    const source = this.po()?.originSource ?? 'Manual';
    return PO_ORIGIN_ICONS[source] ?? 'person';
  });

  protected readonly originLabel = computed(() => {
    const po = this.po();
    return po ? poOriginLabel(po, key => this.translate.instant(key)) : '';
  });

  protected readonly originTooltip = computed(() => {
    const po = this.po();
    return po ? poOriginTooltip(po, (key, params) => this.translate.instant(key, params)) : '';
  });

  protected readonly incotermLabel = computed(() => {
    const incoterm = this.po()?.incoterm;
    if (!incoterm) return '';
    return INCOTERM_OPTIONS.find(o => o.value === incoterm)?.label ?? incoterm;
  });

  protected readonly showFxRate = computed(() => {
    const po = this.po();
    return !!po && po.fxRate !== null && po.quoteCurrency !== this.currencyService.baseCurrency();
  });

  protected readonly documents = signal<FileAttachment[]>([]);

  protected readonly releaseColumns: ColumnDef[] = [
    { field: 'releaseNumber', header: '#', sortable: true, width: '60px' },
    { field: 'partNumber', header: 'Part', sortable: true, width: '120px' },
    { field: 'quantity', header: 'Qty', sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'requestedDeliveryDate', header: 'Req. Delivery', sortable: true, type: 'date', width: '120px' },
    { field: 'status', header: 'Status', sortable: true, width: '110px' },
  ];

  ngOnInit(): void {
    this.loadDetail();
  }

  protected loadDetail(): void {
    this.loading.set(true);
    this.poService.getPurchaseOrderById(this.purchaseOrderId()).subscribe({
      next: (detail) => {
        this.po.set(detail);
        this.loading.set(false);
        if (detail.isBlanket) this.loadReleases();
        this.loadDocuments(detail.id);
      },
      error: () => this.loading.set(false),
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  // --- Receive ---
  protected openReceiveDialog(): void { this.showReceiveDialog.set(true); }
  protected closeReceiveDialog(): void { this.showReceiveDialog.set(false); }

  protected onReceiveSaved(): void {
    this.closeReceiveDialog();
    this.loadDetail();
    this.changed.emit();
  }

  // --- Status Actions ---
  protected submitPo(): void {
    const po = this.po();
    if (!po) return;
    this.poService.submitPurchaseOrder(po.id).subscribe({
      next: () => {
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.poSubmitted'));
      },
    });
  }

  protected readonly showAcknowledgeDialog = signal(false);
  protected readonly acknowledgeSaving = signal(false);
  protected readonly promisedDateCtrl = new FormControl<Date | null>(null);

  protected acknowledgePo(): void {
    const po = this.po();
    if (!po) return;
    this.promisedDateCtrl.reset(this.toCalendarDate(po.expectedDeliveryDate));
    this.showAcknowledgeDialog.set(true);
  }

  protected confirmAcknowledge(): void {
    const po = this.po();
    if (!po) return;
    this.acknowledgeSaving.set(true);
    this.poService.acknowledgePurchaseOrder(po.id, toIsoDate(this.promisedDateCtrl.value) ?? undefined).subscribe({
      next: () => {
        this.showAcknowledgeDialog.set(false);
        this.acknowledgeSaving.set(false);
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.poAcknowledged'));
      },
      error: () => this.acknowledgeSaving.set(false),
    });
  }

  protected readonly editingExpectedDate = signal(false);
  protected readonly expectedDateSaving = signal(false);
  protected readonly expectedDateCtrl = new FormControl<Date | null>(null, [Validators.required]);

  protected canEditExpectedDate(status: string): boolean {
    return status === 'Draft' || status === 'Submitted' || status === 'Acknowledged' || status === 'PartiallyReceived';
  }

  protected startEditExpectedDate(): void {
    const po = this.po();
    if (!po) return;
    this.expectedDateCtrl.reset(this.toCalendarDate(po.expectedDeliveryDate));
    this.editingExpectedDate.set(true);
  }

  protected cancelEditExpectedDate(): void {
    this.editingExpectedDate.set(false);
  }

  protected saveExpectedDate(): void {
    const po = this.po();
    const expectedDeliveryDate = toIsoDate(this.expectedDateCtrl.value);
    if (!po || !expectedDeliveryDate) return;
    this.expectedDateSaving.set(true);
    this.poService.updatePurchaseOrder(po.id, { expectedDeliveryDate }).subscribe({
      next: () => {
        this.editingExpectedDate.set(false);
        this.expectedDateSaving.set(false);
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('common.saved'));
      },
      error: () => this.expectedDateSaving.set(false),
    });
  }

  protected readonly printing = signal(false);

  protected printPo(): void {
    const po = this.po();
    if (!po) return;
    this.printing.set(true);
    this.poService.getPurchaseOrderPdf(po.id).subscribe({
      next: (blob) => {
        this.printing.set(false);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${po.poNumber}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.printing.set(false),
    });
  }

  private toCalendarDate(value: Date | string | null): Date | null {
    if (!value) return null;
    const iso = typeof value === 'string' ? value : value.toISOString();
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : null;
  }

  protected cancelPo(): void {
    const po = this.po();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('purchaseOrders.cancelPoTitle'),
        message: this.translate.instant('purchaseOrders.cancelPoMessage', { number: po.poNumber }),
        confirmLabel: this.translate.instant('purchaseOrders.cancelPo'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.cancelPurchaseOrder(po.id).subscribe({
        next: () => {
          this.loadDetail();
          this.changed.emit();
          this.snackbar.success(this.translate.instant('purchaseOrders.poCancelled'));
        },
      });
    });
  }

  protected closePo(): void {
    const po = this.po();
    if (!po) return;
    this.poService.closePurchaseOrder(po.id).subscribe({
      next: () => {
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.poClosed'));
      },
    });
  }

  // Phase 3 / WU-14 / H3 — short-close a partially-received PO. Confirm
  // dialog gathers the required reason and POSTs to /short-close.
  protected readonly showShortCloseDialog = signal(false);
  protected readonly shortCloseSaving = signal(false);
  protected readonly shortCloseReasonCtrl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3), Validators.maxLength(2000)],
  });

  protected openShortClose(): void {
    this.shortCloseReasonCtrl.reset('');
    this.showShortCloseDialog.set(true);
  }

  protected confirmShortClose(): void {
    const po = this.po();
    if (!po) return;
    if (this.shortCloseReasonCtrl.invalid) {
      this.shortCloseReasonCtrl.markAsTouched();
      return;
    }
    const reason = this.shortCloseReasonCtrl.value.trim();
    this.shortCloseSaving.set(true);
    this.poService.shortClosePurchaseOrder(po.id, reason).subscribe({
      next: () => {
        this.showShortCloseDialog.set(false);
        this.shortCloseSaving.set(false);
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.poShortClosed'));
      },
      error: () => this.shortCloseSaving.set(false),
    });
  }

  // PO is short-close-eligible when partially-received OR submitted/acknowledged
  // with at least one line received < ordered. Mirror server gate.
  protected canShortClose(po: PurchaseOrderDetail): boolean {
    if (!this.canShortCloseRole) return false;
    if (po.status === 'Draft' || po.status === 'Closed' || po.status === 'Cancelled') return false;
    return po.lines.some(l => l.orderedQuantity > l.receivedQuantity + (l.cancelledShortCloseQuantity ?? 0));
  }

  protected deletePo(): void {
    const po = this.po();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('purchaseOrders.deletePoTitle'),
        message: this.translate.instant('purchaseOrders.deletePoMessage', { number: po.poNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.deletePurchaseOrder(po.id).subscribe({
        next: () => {
          this.changed.emit();
          this.closed.emit();
          this.snackbar.success(this.translate.instant('purchaseOrders.poDeleted'));
        },
      });
    });
  }

  // --- Releases ---
  protected readonly lineOptions = computed<SelectOption[]>(() => {
    const po = this.po();
    if (!po) return [];
    return po.lines.map(l => ({ value: l.id, label: l.partNumber ? `${l.partNumber} — ${l.description}` : l.description }));
  });

  protected readonly releaseForm = new FormGroup({
    purchaseOrderLineId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    requestedDeliveryDate: new FormControl<Date | null>(null, [Validators.required]),
    notes: new FormControl(''),
  });

  protected readonly releaseViolations = FormValidationService.getViolations(this.releaseForm, {
    purchaseOrderLineId: 'Line Item',
    quantity: 'Quantity',
    requestedDeliveryDate: 'Delivery Date',
  });

  protected loadReleases(): void {
    const po = this.po();
    if (!po?.isBlanket) return;
    this.poService.getReleases(po.id).subscribe({
      next: (data) => this.releases.set(data),
    });
  }

  protected openCreateRelease(): void {
    this.releaseForm.reset();
    this.showCreateReleaseDialog.set(true);
  }

  protected saveRelease(): void {
    const po = this.po();
    if (!po || this.releaseForm.invalid) return;
    this.releaseSaving.set(true);
    const form = this.releaseForm.getRawValue();
    const request: CreatePurchaseOrderReleaseRequest = {
      purchaseOrderLineId: form.purchaseOrderLineId!,
      quantity: form.quantity!,
      requestedDeliveryDate: toIsoDate(form.requestedDeliveryDate!)!,
      notes: form.notes || undefined,
    };
    this.poService.createRelease(po.id, request).subscribe({
      next: () => {
        this.snackbar.success('Release created');
        this.showCreateReleaseDialog.set(false);
        this.releaseSaving.set(false);
        this.loadReleases();
        this.loadDetail();
        this.changed.emit();
      },
      error: () => this.releaseSaving.set(false),
    });
  }

  // ─── Bought-parts effort PR2.5 — edit shipping/currency (Draft only) ─────
  // Inline-edit dialog for Incoterm, EstimatedFreight, QuoteCurrency,
  // FxRate, FxRateSource. Server enforces Draft-only on these fields; the
  // UI gates the action button by status. FX rate locks at Submit when
  // QuoteCurrency == base; non-base currencies require an explicit value
  // before Submit.
  protected readonly incotermOptions = INCOTERM_OPTIONS;
  protected readonly quoteCurrencyOptions = signal<SelectOption[]>([]);
  protected readonly showShippingDialog = signal(false);
  protected readonly shippingSaving = signal(false);

  protected readonly shippingForm = new FormGroup({
    incoterm: new FormControl<string>('FOB_Origin', { nonNullable: true, validators: [Validators.required] }),
    estimatedFreight: new FormControl<number | null>(null, [Validators.min(0)]),
    quoteCurrency: new FormControl<string>('USD', { nonNullable: true, validators: [Validators.required] }),
    fxRate: new FormControl<number | null>(null, [Validators.min(0.0001)]),
    fxRateSource: new FormControl<string>(''),
  });

  protected readonly shippingViolations = FormValidationService.getViolations(this.shippingForm, {
    incoterm: 'Incoterm',
    estimatedFreight: 'Estimated Freight',
    quoteCurrency: 'Quote Currency',
    fxRate: 'FX Rate',
    fxRateSource: 'FX Rate Source',
  });

  protected canEditShipping(po: PurchaseOrderDetail): boolean {
    return po.status === 'Draft';
  }

  protected openShippingDialog(): void {
    const po = this.po();
    if (!po) return;
    this.shippingForm.reset({
      incoterm: po.incoterm ?? 'FOB_Origin',
      estimatedFreight: po.estimatedFreight,
      quoteCurrency: po.quoteCurrency ?? 'USD',
      fxRate: po.fxRate,
      fxRateSource: po.fxRateSource ?? '',
    });
    this.showShippingDialog.set(true);
  }

  protected saveShipping(): void {
    const po = this.po();
    if (!po || this.shippingForm.invalid) return;
    this.shippingSaving.set(true);
    const f = this.shippingForm.getRawValue();
    this.poService.updatePurchaseOrder(po.id, {
      incoterm: f.incoterm,
      estimatedFreight: f.estimatedFreight ?? undefined,
      quoteCurrency: f.quoteCurrency,
      fxRate: f.fxRate ?? undefined,
      fxRateSource: f.fxRateSource || undefined,
    }).subscribe({
      next: () => {
        this.showShippingDialog.set(false);
        this.shippingSaving.set(false);
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.shippingUpdated'));
      },
      error: () => this.shippingSaving.set(false),
    });
  }

  // ─── Editable PO number (Draft only, manual numbers enabled) ─────────────
  // Server enforces Draft-only + uniqueness; the UI only surfaces the edit
  // inside that window (see canEditPoNumber).
  protected readonly editingPoNumber = signal(false);
  protected readonly poNumberSaving = signal(false);
  protected readonly poNumberCtrl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(20)],
  });

  protected startEditPoNumber(): void {
    const po = this.po();
    if (!po) return;
    this.poNumberCtrl.reset(po.poNumber);
    this.editingPoNumber.set(true);
  }

  protected cancelEditPoNumber(): void {
    this.editingPoNumber.set(false);
  }

  protected savePoNumber(): void {
    const po = this.po();
    if (!po || this.poNumberCtrl.invalid) return;
    this.poNumberSaving.set(true);
    this.poService.updatePurchaseOrder(po.id, {
      poNumber: this.poNumberCtrl.value.trim() || undefined,
    }).subscribe({
      next: () => {
        this.editingPoNumber.set(false);
        this.poNumberSaving.set(false);
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.poNumberUpdated'));
      },
      error: () => this.poNumberSaving.set(false),
    });
  }

  protected getReleaseStatusClass(status: string): string {
    const map: Record<string, string> = {
      Open: 'chip--info',
      Sent: 'chip--primary',
      PartialReceived: 'chip--warning',
      Received: 'chip--success',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Submitted: 'chip--info',
      Acknowledged: 'chip--primary',
      PartiallyReceived: 'chip--warning',
      Received: 'chip--success',
      Closed: 'chip--muted',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'purchaseOrders.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected canSubmit(status: string): boolean { return status === 'Draft'; }
  protected canAcknowledge(status: string): boolean { return status === 'Submitted'; }
  protected canReceive(status: string): boolean {
    return status === 'Submitted' || status === 'Acknowledged' || status === 'PartiallyReceived';
  }
  protected canEditLines(status: string): boolean { return status === 'Draft'; }
  protected canEmail(status: string): boolean { return status !== 'Cancelled'; }

  protected readonly showAddLineDialog = signal(false);
  protected readonly addLineSaving = signal(false);

  protected readonly addLineForm = new FormGroup({
    partId: new FormControl<number | null>(null),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  protected readonly addLineViolations = FormValidationService.getViolations(this.addLineForm, {
    partId: this.translate.instant('common.part'),
    description: this.translate.instant('common.description'),
    quantity: this.translate.instant('common.quantity'),
    unitPrice: this.translate.instant('purchaseOrders.unitPrice'),
  });

  protected get addLineMissingDescription(): boolean {
    const f = this.addLineForm.getRawValue();
    return f.partId == null && !f.description.trim();
  }

  protected openAddLine(): void {
    this.addLineForm.reset({ partId: null, description: '', quantity: null, unitPrice: null });
    this.showAddLineDialog.set(true);
  }

  protected onAddLinePartPicked(entity: Record<string, unknown> | null): void {
    const name = entity?.['name'];
    if (typeof name === 'string' && !this.addLineForm.controls.description.value.trim()) {
      this.addLineForm.controls.description.setValue(name);
    }
  }

  protected saveAddLine(): void {
    const po = this.po();
    if (!po || this.addLineForm.invalid || this.addLineMissingDescription) return;
    const f = this.addLineForm.getRawValue();
    this.addLineSaving.set(true);
    this.poService.addPurchaseOrderLine(po.id, {
      partId: f.partId ?? null,
      description: f.description.trim() || undefined,
      quantity: f.quantity!,
      unitPrice: f.unitPrice!,
    }).subscribe({
      next: () => {
        this.showAddLineDialog.set(false);
        this.addLineSaving.set(false);
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('poManage.lineAdded'));
      },
      error: () => this.addLineSaving.set(false),
    });
  }

  protected deleteLine(line: PurchaseOrderLine): void {
    const po = this.po();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('poManage.deleteLineTitle'),
        message: this.translate.instant('poManage.deleteLineMessage', { line: line.partNumber ?? line.description, number: po.poNumber }),
        confirmLabel: this.translate.instant('poManage.deleteLine'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.deletePurchaseOrderLine(po.id, line.id).subscribe({
        next: () => {
          this.loadDetail();
          this.changed.emit();
          this.snackbar.success(this.translate.instant('poManage.lineDeleted'));
        },
      });
    });
  }

  protected openEmailDialog(): void {
    const po = this.po();
    if (!po) return;
    if (po.vendorContactEmail) {
      this.launchEmailDialog(po, po.vendorContactEmail);
      return;
    }
    this.vendorService.getVendorById(po.vendorId).subscribe({
      next: (vendor) => this.launchEmailDialog(po, vendor.email ?? ''),
      error: () => this.launchEmailDialog(po, ''),
    });
  }

  private launchEmailDialog(po: PurchaseOrderDetail, recipientEmail: string): void {
    this.dialog.open<SendPoEmailDialogComponent, SendPoEmailDialogData, boolean>(SendPoEmailDialogComponent, {
      width: '600px',
      data: {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        recipientEmail,
      },
    }).afterClosed().subscribe(sent => {
      if (sent) this.loadDetail();
    });
  }

  private loadDocuments(id: number): void {
    this.poService.getFiles(id).subscribe({
      next: (docs) => this.documents.set(docs),
    });
  }

  protected downloadFile(doc: FileAttachment): void {
    window.open(this.poService.downloadFileUrl(doc.id), '_blank');
  }

  protected deleteFile(doc: FileAttachment): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('poManage.deleteFileTitle'),
        message: this.translate.instant('poManage.deleteFileMessage', { name: doc.fileName }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.deleteFile(doc.id).subscribe({
        next: () => {
          this.documents.update(list => list.filter(f => f.id !== doc.id));
          this.snackbar.success(this.translate.instant('poManage.fileDeleted'));
        },
      });
    });
  }

  protected onFileUploaded(): void {
    const po = this.po();
    if (po) this.loadDocuments(po.id);
    this.snackbar.success(this.translate.instant('poManage.fileUploaded'));
  }

  protected getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'table_chart';
    if (contentType.includes('document') || contentType.includes('word')) return 'description';
    return 'attach_file';
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  protected canCancel(status: string): boolean {
    return status === 'Draft' || status === 'Submitted' || status === 'Acknowledged';
  }
  protected canClose(status: string): boolean { return status === 'Received'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }
}
