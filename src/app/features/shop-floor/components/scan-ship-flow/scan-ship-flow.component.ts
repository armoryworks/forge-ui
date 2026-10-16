import {
  ChangeDetectionStrategy, Component, computed, inject, input, output, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { ScanShipContextLine } from '../../../../shared/models/scan-ship-context-line.model';
import { ShipmentService } from '../../../shipments/services/shipment.service';

type ShipStep = 'select-line' | 'quantity' | 'confirming' | 'done';

@Component({
  selector: 'app-scan-ship-flow',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './scan-ship-flow.component.html',
  styleUrl: './scan-ship-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanShipFlowComponent {
  private readonly shipmentService = inject(ShipmentService);
  private readonly translate = inject(TranslateService);

  // Inputs
  readonly partId = input.required<number>();
  readonly partNumber = input.required<string>();
  readonly openShipmentLines = input.required<ScanShipContextLine[]>();

  // Outputs
  readonly completed = output<void>();
  readonly cancelled = output<void>();

  // State
  protected readonly step = signal<ShipStep>('select-line');
  protected readonly selectedLine = signal<ScanShipContextLine | null>(null);
  protected readonly isPartial = signal(false);
  protected readonly partialQtyControl = new FormControl<number | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly shippingQty = computed(() => {
    if (this.isPartial()) {
      return this.partialQtyControl.value ?? 0;
    }
    return this.selectedLine()?.requiredQuantity ?? 0;
  });

  protected selectLine(line: ScanShipContextLine): void {
    this.selectedLine.set(line);
    this.isPartial.set(false);
    this.partialQtyControl.setValue(line.requiredQuantity);
    this.step.set('quantity');
  }

  protected shipAll(): void {
    this.isPartial.set(false);
    this.step.set('confirming');
  }

  protected showPartial(): void {
    this.isPartial.set(true);
  }

  protected confirmPartial(): void {
    const qty = this.partialQtyControl.value;
    const line = this.selectedLine();
    if (!qty || qty <= 0 || !line || qty > line.requiredQuantity) {
      return;
    }
    this.step.set('confirming');
  }

  protected confirmShip(): void {
    const line = this.selectedLine();
    if (!line || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.shipmentService.shipShipment(line.shipmentId).subscribe({
      next: () => {
        this.submitting.set(false);
        this.step.set('done');
        setTimeout(() => this.completed.emit(), 1500);
      },
      error: () => {
        this.submitting.set(false);
        this.error.set(this.translate.instant('kioskFlows.ship.failed'));
      },
    });
  }

  protected backToSelect(): void {
    this.selectedLine.set(null);
    this.isPartial.set(false);
    this.step.set('select-line');
  }

  protected backToQuantity(): void {
    this.step.set('quantity');
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
