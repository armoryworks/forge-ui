import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { AssetItem } from '../../models/asset-item.model';
import { RecordHoursDialogData } from '../../models/record-hours-dialog-data.model';
import { AssetsService } from '../../services/assets.service';

@Component({
  selector: 'app-record-hours-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, DatepickerComponent, ValidationButtonComponent],
  templateUrl: './record-hours-dialog.component.html',
  styleUrl: './record-hours-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordHoursDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RecordHoursDialogComponent, AssetItem | undefined>);
  protected readonly data = inject<RecordHoursDialogData>(MAT_DIALOG_DATA);
  private readonly assetsService = inject(AssetsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly today = new Date();

  readonly form = new FormGroup({
    currentHours: new FormControl<number | null>(null, [Validators.required, Validators.min(this.data.asset.currentHours)]),
    readingAt: new FormControl<Date | null>(new Date(), [Validators.required]),
  });

  readonly violations = FormValidationService.getViolations(this.form, {
    currentHours: this.translate.instant('assets.meterReading'),
    readingAt: this.translate.instant('assets.readingDate'),
  });

  protected close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.assetsService.updateMachineHours(this.data.asset.id, raw.currentHours ?? 0, toIsoDate(raw.readingAt)).subscribe({
      next: updated => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('assets.hoursRecorded', { hours: updated.currentHours }));
        this.dialogRef.close(updated);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'assets.hoursSaveFailed');
      },
    });
  }
}
