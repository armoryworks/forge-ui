import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { BarcodeInfo, BarcodeService } from '../../services/barcode.service';
import { LabelPrintService } from '../../services/label-print.service';
import { SnackbarService } from '../../services/snackbar.service';
import { QrCodeComponent } from '../qr-code/qr-code.component';

@Component({
  selector: 'app-barcode-info',
  standalone: true,
  imports: [QrCodeComponent],
  templateUrl: './barcode-info.component.html',
  styleUrl: './barcode-info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarcodeInfoComponent {
  private readonly barcodeService = inject(BarcodeService);
  private readonly labelPrint = inject(LabelPrintService);
  private readonly snackbar = inject(SnackbarService);

  readonly entityType = input.required<string>();
  readonly entityId = input.required<number>();
  readonly entityLabel = input<string>('');
  readonly naturalIdentifier = input<string>('');
  readonly compact = input(false);

  protected readonly barcode = signal<BarcodeInfo | null>(null);
  protected readonly loading = signal(false);

  constructor() {
    effect(() => {
      const type = this.entityType();
      const id = this.entityId();
      if (type && id > 0) {
        this.loadBarcode(type, id);
      }
    });
  }

  private loadBarcode(entityType: string, entityId: number): void {
    this.loading.set(true);
    this.barcodeService.getEntityBarcodes(entityType, entityId).subscribe({
      next: (barcodes) => {
        const active = barcodes.find(b => b.isActive) ?? barcodes[0] ?? null;
        this.barcode.set(active);
        this.loading.set(false);
      },
      error: () => {
        this.barcode.set(null);
        this.loading.set(false);
      },
    });
  }

  protected copyValue(): void {
    const value = this.barcode()?.value;
    if (value) {
      navigator.clipboard.writeText(value);
      this.snackbar.success('Barcode copied');
    }
  }

  protected async printLabel(): Promise<void> {
    const bc = this.barcode();
    if (!bc) return;

    await this.labelPrint.printLabels([{
      type: 'barcode',
      value: bc.value,
      label: this.entityLabel() || bc.entityType,
      sublabel: this.naturalIdentifier(),
    }]);
  }

  protected regenerate(): void {
    const type = this.entityType();
    const id = this.entityId();
    const naturalId = this.naturalIdentifier();
    if (!type || !id || !naturalId) return;

    this.loading.set(true);
    this.barcodeService.regenerateBarcode(type, id, naturalId).subscribe({
      next: (newBarcode) => {
        this.barcode.set(newBarcode);
        this.loading.set(false);
        this.snackbar.success('Barcode regenerated');
      },
      error: () => {
        this.loading.set(false);
        this.snackbar.error('Failed to regenerate barcode');
      },
    });
  }
}
