import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { distinctUntilChanged, of, switchMap } from 'rxjs';

import { FmeaService } from '../../services/fmea.service';
import { Fmea } from '../../models/fmea.model';
import { FMEA_TYPES, FmeaType } from '../../models/fmea-type.model';
import { PartsService } from '../../../../parts/services/parts.service';
import { Operation } from '../../../../parts/models/operation.model';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { EntityPickerComponent } from '../../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-fmea-create-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, EntityPickerComponent, ValidationButtonComponent],
  templateUrl: './fmea-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FmeaCreateDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<FmeaCreateDialogComponent, Fmea | undefined>);
  private readonly fmeaService = inject(FmeaService);
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)] }),
    type: new FormControl<FmeaType>('Process', { nonNullable: true, validators: [Validators.required] }),
    partId: new FormControl<number | null>(null),
    operationId: new FormControl<number | null>(null),
    preparedBy: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    responsibility: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  protected readonly typeOptions: SelectOption[] = FMEA_TYPES.map(t => ({ value: t, label: this.translate.instant(`fmea.type${t}`) }));

  private readonly operations = toSignal(
    this.form.controls.partId.valueChanges.pipe(
      distinctUntilChanged(),
      switchMap(partId => {
        this.form.controls.operationId.setValue(null);
        return partId ? this.partsService.getOperations(partId) : of([] as Operation[]);
      }),
    ),
    { initialValue: [] as Operation[] },
  );

  protected readonly operationOptions = (): SelectOption[] => [
    { value: null, label: this.translate.instant('fmea.wholePart') },
    ...this.operations().map(o => ({ value: o.id, label: `${o.stepNumber} — ${o.title}` })),
  ];

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('common.name'),
    type: this.translate.instant('common.type'),
    partId: this.translate.instant('common.part'),
    operationId: this.translate.instant('fmea.operation'),
    preparedBy: this.translate.instant('fmea.preparedBy'),
    responsibility: this.translate.instant('fmea.responsibility'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.fmeaService.create({
      name: v.name.trim(),
      type: v.type,
      partId: v.partId,
      operationId: v.type === 'Process' ? v.operationId : null,
      preparedBy: v.preparedBy.trim() || null,
      responsibility: v.responsibility.trim() || null,
    }).subscribe({
      next: fmea => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('fmea.created'));
        this.dialogRef.close(fmea);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'fmea.saveFailed');
      },
    });
  }
}
