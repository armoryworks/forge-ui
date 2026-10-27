import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FmeaService } from '../../services/fmea.service';
import { FmeaItem } from '../../models/fmea-item.model';
import { FMEA_RATINGS } from '../../models/fmea-rating-options.const';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

export interface FmeaActionDialogData {
  fmeaId: number;
  item: FmeaItem;
}

@Component({
  selector: 'app-fmea-action-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, SelectComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './fmea-action-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmeaActionDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<FmeaActionDialogComponent, FmeaItem | undefined>);
  private readonly fmeaService = inject(FmeaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<FmeaActionDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly ratingOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('fmea.unchanged') },
    ...FMEA_RATINGS.map(r => ({ value: r, label: String(r) })),
  ];

  protected readonly form = new FormGroup({
    actionTaken: new FormControl<string>(this.data.item.actionTaken ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000), Validators.pattern(/\S/)] }),
    revisedSeverity: new FormControl<number | null>(this.data.item.revisedSeverity),
    revisedOccurrence: new FormControl<number | null>(this.data.item.revisedOccurrence),
    revisedDetection: new FormControl<number | null>(this.data.item.revisedDetection),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly revisedRpn = computed(() => {
    const v = this.value();
    const item = this.data.item;
    return (v.revisedSeverity ?? item.severity) * (v.revisedOccurrence ?? item.occurrence) * (v.revisedDetection ?? item.detection);
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    actionTaken: this.translate.instant('fmea.actionTaken'),
    revisedSeverity: this.translate.instant('fmea.revisedSeverity'),
    revisedOccurrence: this.translate.instant('fmea.revisedOccurrence'),
    revisedDetection: this.translate.instant('fmea.revisedDetection'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.fmeaService.recordAction(this.data.fmeaId, this.data.item.id, {
      actionTaken: v.actionTaken.trim(),
      revisedSeverity: v.revisedSeverity,
      revisedOccurrence: v.revisedOccurrence,
      revisedDetection: v.revisedDetection,
    }).subscribe({
      next: saved => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('fmea.actionRecorded'));
        this.dialogRef.close(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'fmea.saveFailed');
      },
    });
  }
}
