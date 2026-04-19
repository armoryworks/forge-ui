import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';

export interface RecentShipmentItem {
  shipmentLineId: number;
  shipmentNumber: string;
  shippedDate: string;
  quantity: number;
}

export type ReturnReason = 'Defective' | 'WrongItem' | 'Damaged' | 'OverShipped' | 'Other';

export interface ReturnFlowResult {
  shipmentLineId: number;
  quantity: number;
  reason: ReturnReason;
  notes: string;
}

type ReturnStep = 'select-shipment' | 'quantity' | 'reason' | 'confirm';

@Component({
  selector: 'app-scan-return-flow',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SelectComponent, TextareaComponent],
  templateUrl: './scan-return-flow.component.html',
  styleUrl: './scan-return-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanReturnFlowComponent {
  private readonly translate = inject(TranslateService);

  readonly partId = input.required<number>();
  readonly partNumber = input.required<string>();
  readonly recentShipments = input.required<RecentShipmentItem[]>();

  readonly completed = output<ReturnFlowResult>();
  readonly cancelled = output<void>();

  protected readonly step = signal<ReturnStep>('select-shipment');
  protected readonly selectedShipment = signal<RecentShipmentItem | null>(null);
  protected readonly returnQuantity = signal(0);
  protected readonly isPartialReturn = signal(false);
  protected readonly submitting = signal(false);

  protected readonly reasonControl = new FormControl<ReturnReason | null>(null, Validators.required);
  protected readonly notesControl = new FormControl('');
  protected readonly partialQtyControl = new FormControl<number>(1, [Validators.required, Validators.min(1)]);

  protected readonly reasonOptions: SelectOption[] = [
    { value: 'Defective', label: this.translate.instant('shopFloor.returnFlow.reasonDefective') },
    { value: 'WrongItem', label: this.translate.instant('shopFloor.returnFlow.reasonWrongItem') },
    { value: 'Damaged', label: this.translate.instant('shopFloor.returnFlow.reasonDamaged') },
    { value: 'OverShipped', label: this.translate.instant('shopFloor.returnFlow.reasonOverShipped') },
    { value: 'Other', label: this.translate.instant('shopFloor.returnFlow.reasonOther') },
  ];

  protected readonly canConfirm = computed(() => {
    return this.selectedShipment() !== null
      && this.returnQuantity() > 0
      && this.reasonControl.valid
      && !this.submitting();
  });

  protected selectShipment(shipment: RecentShipmentItem): void {
    this.selectedShipment.set(shipment);
    this.returnQuantity.set(shipment.quantity);
    this.isPartialReturn.set(false);
    this.partialQtyControl.setValue(1);
    this.partialQtyControl.setValidators([Validators.required, Validators.min(1), Validators.max(shipment.quantity)]);
    this.step.set('quantity');
  }

  protected returnAll(): void {
    const shipment = this.selectedShipment();
    if (!shipment) return;
    this.returnQuantity.set(shipment.quantity);
    this.isPartialReturn.set(false);
    this.step.set('reason');
  }

  protected startPartial(): void {
    this.isPartialReturn.set(true);
  }

  protected confirmPartialQty(): void {
    const qty = this.partialQtyControl.value ?? 0;
    if (qty > 0 && qty <= (this.selectedShipment()?.quantity ?? 0)) {
      this.returnQuantity.set(qty);
      this.step.set('reason');
    }
  }

  protected confirmReason(): void {
    if (this.reasonControl.valid) {
      this.step.set('confirm');
    }
  }

  protected confirmReturn(): void {
    const shipment = this.selectedShipment();
    const reason = this.reasonControl.value;
    if (!shipment || !reason) return;

    this.submitting.set(true);
    this.completed.emit({
      shipmentLineId: shipment.shipmentLineId,
      quantity: this.returnQuantity(),
      reason,
      notes: this.notesControl.value ?? '',
    });
  }

  protected goBack(): void {
    const current = this.step();
    if (current === 'confirm') {
      this.step.set('reason');
    } else if (current === 'reason') {
      this.step.set('quantity');
    } else if (current === 'quantity') {
      this.step.set('select-shipment');
      this.selectedShipment.set(null);
    } else {
      this.cancelled.emit();
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
