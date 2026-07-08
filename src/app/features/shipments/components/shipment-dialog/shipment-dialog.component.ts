import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal, Signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ShipmentService } from '../../services/shipment.service';
import { SalesOrderService } from '../../../sales-orders/services/sales-order.service';
import { SalesOrderListItem } from '../../../sales-orders/models/sales-order-list-item.model';
import { SalesOrderLine } from '../../../sales-orders/models/sales-order-line.model';
import { CreateShipmentLineRequest } from '../../models/create-shipment-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface LineEntry {
  salesOrderLineId: number;
  partId: number | null;
  partNumber: string;
  description: string;
  quantity: number;
}

@Component({
  selector: 'app-shipment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    DialogComponent, InputComponent, TextareaComponent,
    AutocompleteComponent, ValidationButtonComponent, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './shipment-dialog.component.html',
  styleUrl: './shipment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  /** When set (e.g. opened from the Shipping workspace or a Sales Order), pre-selects that order. */
  readonly initialSalesOrderId = input<number | null>(null);
  private readonly shipmentService = inject(ShipmentService);
  private readonly salesOrderService = inject(SalesOrderService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly salesOrders = signal<SalesOrderListItem[]>([]);
  // Lines of the SELECTED sales order — line entry is constrained to these, so a
  // shipment can only fulfil what was ordered (and never more than remaining).
  protected readonly orderLines = signal<SalesOrderLine[]>([]);
  protected readonly lines = signal<LineEntry[]>([]);

  // Only rows backed by a real SalesOrder are shippable — the row `id` may be
  // a Job id on Job-projected rows (see SalesOrderListItem), so the option
  // value must be the resolved salesOrderId, never the ambiguous row id.
  protected readonly salesOrderOptions = computed<AutocompleteOption[]>(() =>
    this.salesOrders()
      .filter(so => so.salesOrderId != null)
      .map(so => ({
        value: so.salesOrderId,
        label: `${so.orderNumber} — ${so.customerName}${so.customerPO ? ' (' + so.customerPO + ')' : ''}`,
      })));

  // Remaining-to-ship on a SO line, net of what's already been added to this
  // shipment in the dialog.
  private remainingFor(salesOrderLineId: number): number {
    const line = this.orderLines().find(l => l.id === salesOrderLineId);
    if (!line) return 0;
    const added = this.lines()
      .filter(l => l.salesOrderLineId === salesOrderLineId)
      .reduce((sum, l) => sum + l.quantity, 0);
    return line.remainingQuantity - added;
  }

  // Only SO lines that still have something left to ship are pickable.
  protected readonly orderLineOptions = computed<AutocompleteOption[]>(() => {
    this.lines(); // re-evaluate as lines are added
    return this.orderLines()
      .filter(l => this.remainingFor(l.id) > 0)
      .map(l => ({
        value: l.id,
        label: `${l.partNumber ? l.partNumber + ' — ' : ''}${l.description} · ${this.remainingFor(l.id)} ${this.translate.instant('shipments.remainingShort')}`,
      }));
  });

  protected readonly shipmentForm = new FormGroup({
    salesOrderId: new FormControl<number | null>(null, [Validators.required]),
    carrier: new FormControl(''),
    trackingNumber: new FormControl(''),
    shippingCost: new FormControl<number | null>(null),
    weight: new FormControl<number | null>(null),
    notes: new FormControl(''),
  });

  private readonly formViolations = FormValidationService.getViolations(this.shipmentForm, {
    salesOrderId: 'Sales Order',
    carrier: 'Carrier',
    trackingNumber: 'Tracking Number',
    shippingCost: 'Shipping Cost',
    weight: 'Weight',
    notes: 'Notes',
  });

  protected readonly violations: Signal<string[]> = computed(() => [
    ...this.formViolations(),
    ...(this.lines().length === 0 ? ['At least one line item is required'] : []),
  ]);

  protected readonly lineForm = new FormGroup({
    salesOrderLineId: new FormControl<number | null>(null, [Validators.required]),
    // Phase 3 / WU-23 (F8-broad): fractional UoM-aware quantities accepted.
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(0.0001)]),
  });

  protected readonly draftConfig: DraftConfig = {
    entityType: 'shipment',
    entityId: 'new',
    route: '/shipments',
    snapshotFn: () => ({ ...this.shipmentForm.getRawValue(), lines: this.lines() }),
    restoreFn: (data) => {
      this.shipmentForm.patchValue(data);
      if (Array.isArray(data['lines'])) this.lines.set(data['lines'] as LineEntry[]);
      this.shipmentForm.markAsDirty();
    },
  };

  constructor() {
    this.salesOrderService.getSalesOrders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.salesOrders.set(list),
    });

    // When the order changes, load its lines and clear any lines staged against
    // the previous order.
    this.shipmentForm.controls.salesOrderId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.lines.set([]);
        this.lineForm.reset({ salesOrderLineId: null, quantity: 1 });
        if (!id) { this.orderLines.set([]); return; }
        this.salesOrderService.getSalesOrderById(id).subscribe({
          next: (order) => this.orderLines.set(order.lines ?? []),
          error: () => this.orderLines.set([]),
        });
      });

    // Picking a SO line prefills the quantity with what's left to ship on it.
    this.lineForm.controls.salesOrderLineId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lineId) => {
        if (lineId == null) return;
        const remaining = this.remainingFor(lineId);
        if (remaining > 0) this.lineForm.controls.quantity.setValue(remaining);
      });
  }

  ngOnInit(): void {
    // Scoped-open: pre-select the passed sales order (valueChanges then loads its lines).
    const soId = this.initialSalesOrderId();
    if (soId != null) {
      this.shipmentForm.controls.salesOrderId.setValue(soId);
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const lineId = f.salesOrderLineId!;
    const orderLine = this.orderLines().find(l => l.id === lineId);
    if (!orderLine) return;

    const remaining = this.remainingFor(lineId);
    const qty = f.quantity!;
    if (qty > remaining) {
      this.snackbar.error(this.translate.instant('shipments.exceedsRemaining', {
        remaining, part: orderLine.partNumber || orderLine.description,
      }));
      return;
    }

    this.lines.update(prev => [...prev, {
      salesOrderLineId: lineId,
      partId: orderLine.partId,
      partNumber: orderLine.partNumber ?? '',
      description: orderLine.description,
      quantity: qty,
    }]);
    this.lineForm.reset({ salesOrderLineId: null, quantity: 1 });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.shipmentForm.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.shipmentForm.getRawValue();
    const lineRequests: CreateShipmentLineRequest[] = this.lines().map(l => ({
      salesOrderLineId: l.salesOrderLineId,
      partId: l.partId ?? undefined,
      quantity: l.quantity,
    }));

    this.shipmentService.createShipment({
      salesOrderId: f.salesOrderId!,
      carrier: f.carrier || undefined,
      trackingNumber: f.trackingNumber || undefined,
      shippingCost: f.shippingCost ?? undefined,
      weight: f.weight ?? undefined,
      notes: f.notes || undefined,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('shipments.shipmentCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
