import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';
import { DepreciationPreview } from '../../models/depreciation-preview.model';
import { DepreciationRunResult } from '../../models/depreciation-run-result.model';
import { FixedAssetService } from '../../services/fixed-asset.service';

export interface DepreciationRunDialogData {
  bookId: number;
}

/**
 * Run a month's depreciation: preview what each active asset would be charged (nothing posts), then post the
 * same amounts, one journal entry per asset, and link to the ledger. Re-running a posted month posts nothing.
 * Closes with true when entries posted.
 */
@Component({
  selector: 'app-depreciation-run-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, TranslatePipe, DialogComponent, DatepickerComponent, DataTableComponent,
    ColumnCellDirective, CurrencyDisplayComponent,
  ],
  templateUrl: './depreciation-run-dialog.component.html',
  styleUrl: './depreciation-run-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepreciationRunDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DepreciationRunDialogComponent, boolean>);
  private readonly service = inject(FixedAssetService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject<DepreciationRunDialogData>(MAT_DIALOG_DATA);

  protected readonly monthControl = new FormControl<Date | null>(firstOfPreviousMonth(), [Validators.required]);
  protected readonly busy = signal(false);
  protected readonly preview = signal<DepreciationPreview | null>(null);
  protected readonly result = signal<DepreciationRunResult | null>(null);
  protected readonly canPost = computed(() => !this.busy() && (this.preview()?.lines.length ?? 0) > 0);

  protected readonly columns: ColumnDef[] = [
    { field: 'assetTag', header: this.translate.instant('accounting.fixedAssets.assetTag'), width: '110px' },
    { field: 'name', header: this.translate.instant('accounting.fixedAssets.name') },
    { field: 'amount', header: this.translate.instant('accounting.fixedAssets.charge'), type: 'number', align: 'right', width: '140px' },
    { field: 'netBookValueAfter', header: this.translate.instant('accounting.fixedAssets.netBookValueAfter'), type: 'number', align: 'right', width: '160px' },
  ];

  constructor() {
    this.monthControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.preview.set(null);
      this.result.set(null);
    });
  }

  protected runPreview(): void {
    const month = this.periodMonth();
    if (!month || this.busy()) return;
    this.busy.set(true);
    this.result.set(null);
    this.service.previewDepreciation(this.data.bookId, month).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.busy.set(false);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'accounting.fixedAssets.previewFailed');
      },
    });
  }

  protected post(): void {
    const month = this.periodMonth();
    if (!month || !this.canPost()) return;
    this.busy.set(true);
    this.service.runDepreciation(this.data.bookId, month).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.preview.set(null);
        this.busy.set(false);
        this.snackbar.success(this.translate.instant('accounting.fixedAssets.runPosted', { count: result.assetsDepreciated }));
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'accounting.fixedAssets.runFailed');
      },
    });
  }

  protected close(): void {
    this.dialogRef.close((this.result()?.assetsDepreciated ?? 0) > 0);
  }

  private periodMonth(): string | null {
    const value = this.monthControl.value;
    if (!value) return null;
    return toDateOnly(new Date(value.getFullYear(), value.getMonth(), 1));
  }
}

function firstOfPreviousMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}
