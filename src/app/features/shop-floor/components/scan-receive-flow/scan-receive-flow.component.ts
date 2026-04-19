import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { ScanContext, ScanReceiveContextLine } from '../../../../shared/models/scan-action.model';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { BarcodeScanInputComponent } from '../../../../shared/components/barcode-scan-input/barcode-scan-input.component';

type ReceiveStep = 'select-po' | 'quantity' | 'destination' | 'confirm';

@Component({
  selector: 'app-scan-receive-flow',
  standalone: true,
  imports: [ReactiveFormsModule, SelectComponent, InputComponent, BarcodeScanInputComponent],
  templateUrl: './scan-receive-flow.component.html',
  styleUrl: './scan-receive-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanReceiveFlowComponent implements OnInit {
  private readonly scanAction = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);
  private readonly inventoryService = inject(InventoryService);

  readonly context = input.required<ScanContext>();
  readonly completed = output<void>();
  readonly cancelled = output<void>();

  protected readonly step = signal<ReceiveStep>('select-po');
  protected readonly poLines = signal<ScanReceiveContextLine[]>([]);
  protected readonly selectedLine = signal<ScanReceiveContextLine | null>(null);
  protected readonly receiveAll = signal(true);
  protected readonly quantity = signal(0);
  protected readonly submitting = signal(false);
  protected readonly locationOptions = signal<SelectOption[]>([]);
  protected readonly toLocationId = new FormControl<number | null>(null);
  protected readonly partialQty = new FormControl<number>(0);

  ngOnInit(): void {
    // Extract PO lines from the context's available actions
    const receiveAction = this.context().availableActions.find(a => a.action === 'Receive');
    if (receiveAction?.context) {
      this.poLines.set((receiveAction.context as { poLines: ScanReceiveContextLine[] }).poLines ?? []);
    }

    if (this.poLines().length === 1) {
      this.selectPoLine(this.poLines()[0]);
    }

    this.loadLocations();
  }

  private loadLocations(): void {
    this.inventoryService.getBinLocations().subscribe(bins => {
      this.locationOptions.set(
        bins.map(b => ({ value: b.id, label: b.locationPath ?? b.name })),
      );
    });
  }

  protected selectPoLine(line: ScanReceiveContextLine): void {
    this.selectedLine.set(line);
    this.quantity.set(line.remainingQuantity);
    this.partialQty.setValue(line.remainingQuantity);
    this.step.set('quantity');
  }

  protected selectAll(): void {
    this.receiveAll.set(true);
    const line = this.selectedLine();
    if (line) this.quantity.set(line.remainingQuantity);
    this.step.set('destination');
  }

  protected selectPartial(): void {
    this.receiveAll.set(false);
  }

  protected confirmPartial(): void {
    const qty = this.partialQty.value ?? 0;
    const max = this.selectedLine()?.remainingQuantity ?? 0;
    if (qty <= 0 || qty > max) return;
    this.quantity.set(qty);
    this.step.set('destination');
  }

  protected confirmDestination(): void {
    if (!this.toLocationId.value) return;
    this.step.set('confirm');
  }

  protected submit(): void {
    const line = this.selectedLine();
    const toId = this.toLocationId.value;
    if (!line || !toId) return;

    this.submitting.set(true);
    this.scanAction.receive({
      partId: this.context().partId,
      purchaseOrderLineId: line.purchaseOrderLineId,
      quantity: this.quantity(),
      toLocationId: toId,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(`Received ${this.quantity()} x ${this.context().partNumber} from ${line.poNumber}`);
        this.completed.emit();
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error('Receive failed. Please try again.');
      },
    });
  }

  protected back(): void {
    const current = this.step();
    if (current === 'confirm') {
      this.step.set('destination');
    } else if (current === 'destination') {
      this.step.set('quantity');
    } else if (current === 'quantity') {
      if (this.poLines().length > 1) {
        this.step.set('select-po');
      } else {
        this.cancelled.emit();
      }
    } else {
      this.cancelled.emit();
    }
  }

  protected getToLocationLabel(): string {
    const opt = this.locationOptions().find(o => o.value === this.toLocationId.value);
    return opt?.label ?? 'Unknown';
  }
}
