import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PpapService } from '../../services/ppap.service';
import { PpapSubmission } from '../../models/ppap-submission.model';
import { PPAP_REASONS, PpapReason } from '../../models/ppap-reason.model';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../../shared/utils/date.utils';

@Component({
  selector: 'app-ppap-create-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent, EntityPickerComponent, ValidationButtonComponent],
  templateUrl: './ppap-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PpapCreateDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PpapCreateDialogComponent, PpapSubmission | undefined>);
  private readonly ppapService = inject(PpapService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);

  protected readonly levelOptions: SelectOption[] = [1, 2, 3, 4, 5].map(l => ({
    value: l, label: this.translate.instant('ppap.levelOption', { level: l }),
  }));

  protected readonly reasonOptions: SelectOption[] = PPAP_REASONS.map(r => ({
    value: r, label: this.translate.instant(`ppap.reason${r}`),
  }));

  protected readonly form = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    customerId: new FormControl<number | null>(null, [Validators.required]),
    ppapLevel: new FormControl<number>(3, { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<PpapReason>('NewPart', { nonNullable: true, validators: [Validators.required] }),
    partRevision: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    dueDate: new FormControl<Date | null>(null),
    customerContactName: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    internalNotes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partId: this.translate.instant('common.part'),
    customerId: this.translate.instant('common.customer'),
    ppapLevel: this.translate.instant('ppap.level'),
    reason: this.translate.instant('ppap.reason'),
    partRevision: this.translate.instant('ppap.partRevision'),
    dueDate: this.translate.instant('common.dueDate'),
    customerContactName: this.translate.instant('ppap.customerContact'),
    internalNotes: this.translate.instant('ppap.internalNotes'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.ppapService.create({
      partId: v.partId!,
      customerId: v.customerId!,
      ppapLevel: v.ppapLevel,
      reason: v.reason,
      partRevision: v.partRevision.trim() || null,
      dueDate: toIsoDate(v.dueDate),
      customerContactName: v.customerContactName.trim() || null,
      internalNotes: v.internalNotes.trim() || null,
    }).subscribe({
      next: created => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('ppap.created'));
        this.dialogRef.close(created);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'ppap.saveFailed');
      },
    });
  }
}
