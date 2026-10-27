import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FmeaService } from '../../services/fmea.service';
import { FmeaItem } from '../../models/fmea-item.model';
import { FmeaItemRequest } from '../../models/fmea-item-request.model';
import { FMEA_RATINGS } from '../../models/fmea-rating-options.const';
import { FMEA_HIGH_RPN_THRESHOLD, FMEA_HIGH_SEVERITY } from '../../models/fmea-high-rpn.const';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { fromIsoDate, toDateOnly } from '../../../../../shared/utils/date.utils';

export interface FmeaItemDialogData {
  fmeaId: number;
  item: FmeaItem | null;
}

@Component({
  selector: 'app-fmea-item-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent, ValidationButtonComponent],
  templateUrl: './fmea-item-dialog.component.html',
  styleUrl: './fmea-item-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmeaItemDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<FmeaItemDialogComponent, FmeaItem | undefined>);
  private readonly fmeaService = inject(FmeaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<FmeaItemDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly ratingOptions: SelectOption[] = FMEA_RATINGS.map(r => ({ value: r, label: String(r) }));

  private readonly item = this.data.item;

  protected readonly form = new FormGroup({
    processStep: new FormControl<string>(this.item?.processStep ?? '', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    function: new FormControl<string>(this.item?.function ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    failureMode: new FormControl<string>(this.item?.failureMode ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000), Validators.pattern(/\S/)] }),
    potentialEffect: new FormControl<string>(this.item?.potentialEffect ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000), Validators.pattern(/\S/)] }),
    severity: new FormControl<number>(this.item?.severity ?? 5, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(10)] }),
    classification: new FormControl<string>(this.item?.classification ?? '', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    potentialCause: new FormControl<string>(this.item?.potentialCause ?? '', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    occurrence: new FormControl<number>(this.item?.occurrence ?? 5, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(10)] }),
    currentPreventionControls: new FormControl<string>(this.item?.currentPreventionControls ?? '', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    currentDetectionControls: new FormControl<string>(this.item?.currentDetectionControls ?? '', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    detection: new FormControl<number>(this.item?.detection ?? 5, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(10)] }),
    recommendedAction: new FormControl<string>(this.item?.recommendedAction ?? '', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    targetCompletionDate: new FormControl<Date | null>(fromIsoDate(this.item?.targetCompletionDate ?? null)),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly rpn = computed(() => {
    const v = this.value();
    return (v.severity ?? 0) * (v.occurrence ?? 0) * (v.detection ?? 0);
  });

  protected readonly needsAction = computed(() =>
    this.rpn() >= FMEA_HIGH_RPN_THRESHOLD || (this.value().severity ?? 0) >= FMEA_HIGH_SEVERITY);

  protected readonly violations = FormValidationService.getViolations(this.form, {
    processStep: this.translate.instant('fmea.processStep'),
    function: this.translate.instant('fmea.function'),
    failureMode: this.translate.instant('fmea.failureMode'),
    potentialEffect: this.translate.instant('fmea.effect'),
    severity: this.translate.instant('fmea.severity'),
    classification: this.translate.instant('fmea.classification'),
    potentialCause: this.translate.instant('fmea.cause'),
    occurrence: this.translate.instant('fmea.occurrence'),
    currentPreventionControls: this.translate.instant('fmea.preventionControls'),
    currentDetectionControls: this.translate.instant('fmea.detectionControls'),
    detection: this.translate.instant('fmea.detection'),
    recommendedAction: this.translate.instant('fmea.recommendedAction'),
    targetCompletionDate: this.translate.instant('fmea.targetDate'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const request: FmeaItemRequest = {
      processStep: v.processStep.trim() || null,
      function: v.function.trim() || null,
      failureMode: v.failureMode.trim(),
      potentialEffect: v.potentialEffect.trim(),
      severity: v.severity,
      classification: v.classification.trim() || null,
      potentialCause: v.potentialCause.trim() || null,
      occurrence: v.occurrence,
      currentPreventionControls: v.currentPreventionControls.trim() || null,
      currentDetectionControls: v.currentDetectionControls.trim() || null,
      detection: v.detection,
      recommendedAction: v.recommendedAction.trim() || null,
      targetCompletionDate: toDateOnly(v.targetCompletionDate),
    };
    const call = this.item
      ? this.fmeaService.updateItem(this.data.fmeaId, this.item.id, request)
      : this.fmeaService.addItem(this.data.fmeaId, request);
    call.subscribe({
      next: saved => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(this.item ? 'fmea.itemUpdated' : 'fmea.itemAdded'));
        this.dialogRef.close(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'fmea.saveFailed');
      },
    });
  }
}
