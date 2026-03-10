import { ChangeDetectionStrategy, Component, inject, signal, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ShipmentService } from '../../services/shipment.service';
import { CreateShipmentLineRequest } from '../../models/create-shipment-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface LineEntry {
  salesOrderLineId: number;
  description: string;
  quantity: number;
}

@Component({
  selector: 'app-shipment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './shipment-dialog.component.html',
  styleUrl: './shipment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentDialogComponent {
  private readonly shipmentService = inject(ShipmentService);
  private readonly snackbar = inject(SnackbarService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly lines = signal<LineEntry[]>([]);

  protected readonly form = new FormGroup({
    salesOrderId: new FormControl<number | null>(null, [Validators.required]),
    carrier: new FormControl(''),
    trackingNumber: new FormControl(''),
    shippingCost: new FormControl<number | null>(null),
    weight: new FormControl<number | null>(null),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    salesOrderId: 'Sales Order ID',
    carrier: 'Carrier',
    trackingNumber: 'Tracking Number',
    shippingCost: 'Shipping Cost',
    weight: 'Weight',
    notes: 'Notes',
  });

  // Line item form
  protected readonly lineForm = new FormGroup({
    salesOrderLineId: new FormControl<number | null>(null, [Validators.required]),
    description: new FormControl('', [Validators.required]),
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(1)]),
  });

  protected close(): void {
    this.closed.emit();
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    this.lines.update(prev => [...prev, {
      salesOrderLineId: f.salesOrderLineId!,
      description: f.description!,
      quantity: f.quantity!,
    }]);
    this.lineForm.reset({ salesOrderLineId: null, description: '', quantity: 1 });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.form.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const lineRequests: CreateShipmentLineRequest[] = this.lines().map(l => ({
      salesOrderLineId: l.salesOrderLineId,
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
        this.snackbar.success('Shipment created.');
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
