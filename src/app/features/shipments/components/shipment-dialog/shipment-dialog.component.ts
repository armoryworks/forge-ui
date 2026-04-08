import { ChangeDetectionStrategy, Component, computed, inject, output, signal, Signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ShipmentService } from '../../services/shipment.service';
import { PartsService } from '../../../parts/services/parts.service';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { SalesOrderService } from '../../../sales-orders/services/sales-order.service';
import { SalesOrderListItem } from '../../../sales-orders/models/sales-order-list-item.model';
import { CreateShipmentLineRequest } from '../../models/create-shipment-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface LineEntry {
  partId: number;
  partNumber: string;
  description: string;
  quantity: number;
}

@Component({
  selector: 'app-shipment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent,
    AutocompleteComponent, ValidationPopoverDirective, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './shipment-dialog.component.html',
  styleUrl: './shipment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly shipmentService = inject(ShipmentService);
  private readonly partsService = inject(PartsService);
  private readonly salesOrderService = inject(SalesOrderService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly parts = signal<PartListItem[]>([]);
  protected readonly salesOrders = signal<SalesOrderListItem[]>([]);
  protected readonly lines = signal<LineEntry[]>([]);

  protected readonly partOptions = computed<AutocompleteOption[]>(() =>
    this.parts().map(p => ({ value: p.id, label: `${p.partNumber} — ${p.description}` })));

  protected readonly salesOrderOptions = computed<AutocompleteOption[]>(() =>
    this.salesOrders().map(so => ({
      value: so.id,
      label: `${so.orderNumber} — ${so.customerName}${so.customerPO ? ' (' + so.customerPO + ')' : ''}`,
    })));

  protected readonly shipmentForm = new FormGroup({
    salesOrderId: new FormControl<number | null>(null, [Validators.required]),
    carrier: new FormControl(''),
    trackingNumber: new FormControl(''),
    shippingCost: new FormControl<number | null>(null),
    weight: new FormControl<number | null>(null),
    notes: new FormControl(''),
  });

  private readonly formViolations = FormValidationService.getViolations(this.shipmentForm, {
    salesOrderId: 'Sales Order ID',
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
    partId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(1)]),
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
    this.partsService.getParts('Active').subscribe({
      next: (list) => this.parts.set(list),
    });
    this.salesOrderService.getSalesOrders().subscribe({
      next: (list) => this.salesOrders.set(list),
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
    }]);
    this.lineForm.reset({ partId: null, quantity: 1 });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.shipmentForm.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.shipmentForm.getRawValue();
    const lineRequests: CreateShipmentLineRequest[] = this.lines().map(l => ({
      partId: l.partId,
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
