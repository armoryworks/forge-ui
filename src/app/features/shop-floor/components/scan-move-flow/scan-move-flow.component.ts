import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { ScanContext } from '../../../../shared/models/scan-action.model';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { BarcodeScanInputComponent } from '../../../../shared/components/barcode-scan-input/barcode-scan-input.component';

type MoveStep = 'quantity' | 'destination' | 'confirm';

@Component({
  selector: 'app-scan-move-flow',
  standalone: true,
  imports: [ReactiveFormsModule, SelectComponent, InputComponent, BarcodeScanInputComponent],
  templateUrl: './scan-move-flow.component.html',
  styleUrl: './scan-move-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanMoveFlowComponent implements OnInit {
  private readonly scanAction = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);
  private readonly inventoryService = inject(InventoryService);

  readonly context = input.required<ScanContext>();
  readonly completed = output<void>();
  readonly cancelled = output<void>();

  protected readonly step = signal<MoveStep>('quantity');
  protected readonly moveAll = signal(true);
  protected readonly quantity = signal(0);
  protected readonly submitting = signal(false);
  protected readonly locationOptions = signal<SelectOption[]>([]);
  protected readonly toLocationId = new FormControl<number | null>(null);
  protected readonly partialQty = new FormControl<number>(0);
  protected readonly scannedDestination = signal<string | null>(null);

  ngOnInit(): void {
    this.quantity.set(this.context().currentStock);
    this.partialQty.setValue(this.context().currentStock);
    this.loadLocations();
  }

  private loadLocations(): void {
    this.inventoryService.getBinLocations().subscribe(bins => {
      this.locationOptions.set(
        bins
          .filter(b => b.id !== this.context().currentLocationId)
          .map(b => ({ value: b.id, label: b.locationPath ?? b.name })),
      );
    });
  }

  protected selectAll(): void {
    this.moveAll.set(true);
    this.quantity.set(this.context().currentStock);
    this.step.set('destination');
  }

  protected selectPartial(): void {
    this.moveAll.set(false);
  }

  protected confirmPartial(): void {
    const qty = this.partialQty.value ?? 0;
    if (qty <= 0 || qty > this.context().currentStock) return;
    this.quantity.set(qty);
    this.step.set('destination');
  }

  protected onDestinationScanned(value: string): void {
    // Try to match scanned value to a location
    const match = this.locationOptions().find(
      o => o.label.toLowerCase().includes(value.toLowerCase()),
    );
    if (match) {
      this.toLocationId.setValue(match.value as number);
      this.scannedDestination.set(match.label);
    } else {
      this.scannedDestination.set(null);
      this.snackbar.warn(`Location not found: ${value}`);
    }
  }

  protected confirmDestination(): void {
    if (!this.toLocationId.value) return;
    this.step.set('confirm');
  }

  protected submit(): void {
    const ctx = this.context();
    const toId = this.toLocationId.value;
    if (!ctx.currentLocationId || !toId) return;

    this.submitting.set(true);
    this.scanAction.move({
      partId: ctx.partId,
      fromLocationId: ctx.currentLocationId,
      toLocationId: toId,
      quantity: this.quantity(),
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(`Moved ${this.quantity()} x ${ctx.partNumber}`);
        this.completed.emit();
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error('Move failed. Please try again.');
      },
    });
  }

  protected back(): void {
    const current = this.step();
    if (current === 'confirm') {
      this.step.set('destination');
    } else if (current === 'destination') {
      this.step.set('quantity');
    } else {
      this.cancelled.emit();
    }
  }

  protected getToLocationLabel(): string {
    const opt = this.locationOptions().find(o => o.value === this.toLocationId.value);
    return opt?.label ?? 'Unknown';
  }
}
