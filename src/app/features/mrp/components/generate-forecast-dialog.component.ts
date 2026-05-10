import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { EntityPickerComponent } from '../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ForecastMethod, GenerateForecastRequest } from '../models/mrp.model';

/**
 * Demand-forecast generation form. Smoothing factor only applies to
 * `ExponentialSmoothing` — the field is shown/hidden based on the method
 * choice and validators are toggled accordingly.
 */
@Component({
  selector: 'app-generate-forecast-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent,
    EntityPickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './generate-forecast-dialog.component.html',
  styleUrl: './generate-forecast-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateForecastDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<GenerateForecastDialogComponent, GenerateForecastRequest | undefined>);
  protected readonly translate = inject(TranslateService);

  protected readonly methodOptions: SelectOption[] = [
    { value: 'MovingAverage', label: this.translate.instant('mrp.forecastMethods.movingAverage') },
    { value: 'WeightedMovingAverage', label: this.translate.instant('mrp.forecastMethods.weightedMovingAverage') },
    { value: 'ExponentialSmoothing', label: this.translate.instant('mrp.forecastMethods.exponentialSmoothing') },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    partId: new FormControl<number | null>(null, [Validators.required]),
    method: new FormControl<ForecastMethod>('MovingAverage', { nonNullable: true, validators: [Validators.required] }),
    historicalPeriods: new FormControl<number>(12, { nonNullable: true, validators: [Validators.required, Validators.min(2), Validators.max(60)] }),
    forecastPeriods: new FormControl<number>(6, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(36)] }),
    smoothingFactor: new FormControl<number | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('mrp.forecastDialog.fieldName'),
    partId: this.translate.instant('mrp.forecastDialog.fieldPart'),
    method: this.translate.instant('mrp.forecastDialog.fieldMethod'),
    historicalPeriods: this.translate.instant('mrp.forecastDialog.fieldHistorical'),
    forecastPeriods: this.translate.instant('mrp.forecastDialog.fieldForecast'),
    smoothingFactor: this.translate.instant('mrp.forecastDialog.fieldAlpha'),
  });

  constructor() {
    this.form.controls.method.valueChanges.subscribe(method => {
      const ctrl = this.form.controls.smoothingFactor;
      if (method === 'ExponentialSmoothing') {
        ctrl.addValidators([Validators.required, Validators.min(0.01), Validators.max(1)]);
        if (ctrl.value === null) ctrl.setValue(0.3);
      } else {
        ctrl.clearValidators();
        ctrl.setValue(null);
      }
      ctrl.updateValueAndValidity();
    });
  }

  private readonly methodSignal = toSignal(this.form.controls.method.valueChanges, {
    initialValue: this.form.controls.method.value,
  });
  protected readonly showSmoothing = () => this.methodSignal() === 'ExponentialSmoothing';

  protected confirm(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      partId: v.partId!,
      name: v.name.trim(),
      method: v.method,
      historicalPeriods: v.historicalPeriods,
      forecastPeriods: v.forecastPeriods,
      smoothingFactor: v.smoothingFactor ?? undefined,
    });
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
