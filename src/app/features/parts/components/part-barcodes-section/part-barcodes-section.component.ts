import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { BarcodeInfo, BarcodeService } from '../../../../shared/services/barcode.service';
import { PartDetail } from '../../models/part-detail.model';

/**
 * Manage a part's scannable barcodes on the Identity tab. Shows the single
 * auto-assigned system code (its internal code, or its GS1 GTIN once assigned)
 * and lets a user add/remove **manual alternate** barcodes on top of it — a
 * manufacturer UPC, a vendor SKU, a legacy label — that all resolve to this
 * part on scan. The auto code itself is never removable here (it is regenerated,
 * not deleted). Complements `app-part-gtin-section` (the GS1 affordance).
 */
@Component({
  selector: 'app-part-barcodes-section',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './part-barcodes-section.component.html',
  styleUrl: './part-barcodes-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartBarcodesSectionComponent {
  private readonly barcodeService = inject(BarcodeService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly part = input.required<PartDetail>();

  protected readonly barcodes = signal<BarcodeInfo[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly newValue = new FormControl<string>('', { nonNullable: true });

  protected readonly systemCode = computed(() => this.barcodes().find(b => b.source === 'System') ?? null);
  protected readonly manualCodes = computed(() => this.barcodes().filter(b => b.source === 'Manual'));

  constructor() {
    effect(() => {
      const id = this.part().id;
      if (id > 0) this.load(id);
    });
  }

  private load(partId: number): void {
    this.loading.set(true);
    this.barcodeService.getEntityBarcodes('Part', partId).subscribe({
      next: (codes) => {
        this.barcodes.set(codes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected add(): void {
    const value = this.newValue.value.trim();
    if (!value || this.saving()) return;
    this.saving.set(true);
    this.barcodeService.addManualBarcode('Part', this.part().id, value).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('parts.barcodes.added'));
        this.newValue.reset();
        this.saving.set(false);
        this.load(this.part().id);
      },
      error: (err) => {
        this.snackbar.error(err?.error?.detail ?? this.translate.instant('parts.barcodes.addFailed'));
        this.saving.set(false);
      },
    });
  }

  protected remove(code: BarcodeInfo): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('parts.barcodes.removeConfirmTitle'),
        message: this.translate.instant('parts.barcodes.removeConfirmMessage', { value: code.value }),
        confirmLabel: this.translate.instant('common.remove'),
        severity: 'danger',
      },
      width: '420px',
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.barcodeService.removeManualBarcode(code.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('parts.barcodes.removed'));
          this.load(this.part().id);
        },
        error: (err) => this.snackbar.error(err?.error?.detail ?? this.translate.instant('parts.barcodes.removeFailed')),
      });
    });
  }
}
