import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ExecuteMrpRunRequest, MrpRunType } from '../models/mrp.model';

export interface ExecuteMrpRunDialogData {
  /** When true, the dialog header + footer wording switches to "simulate" so
   *  the operator knows the run won't persist planned-orders to live state. */
  isSimulation?: boolean;
}

export interface ExecuteMrpRunDialogResult {
  request: ExecuteMrpRunRequest;
  isSimulation: boolean;
}

/**
 * Parameterizes the run-execute action that was previously hardcoded to
 * Full + 90 days. Net-change runs only re-plan parts whose demand or
 * supply has shifted since the last full run, which is much faster
 * once the install has accumulated history.
 */
@Component({
  selector: 'app-execute-mrp-run-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './execute-mrp-run-dialog.component.html',
  styleUrl: './execute-mrp-run-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecuteMrpRunDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ExecuteMrpRunDialogComponent, ExecuteMrpRunDialogResult | undefined>);
  private readonly data = inject<ExecuteMrpRunDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly translate = inject(TranslateService);

  protected readonly isSimulation = this.data.isSimulation === true;

  protected readonly runTypeOptions: SelectOption[] = this.isSimulation
    ? [{ value: 'Simulation', label: this.translate.instant('mrp.runTypes.simulation') }]
    : [
        { value: 'Full', label: this.translate.instant('mrp.runTypes.full') },
        { value: 'NetChange', label: this.translate.instant('mrp.runTypes.netChange') },
      ];

  protected readonly form = new FormGroup({
    runType: new FormControl<MrpRunType>(
      this.isSimulation ? 'Simulation' : 'Full',
      { nonNullable: true, validators: [Validators.required] },
    ),
    planningHorizonDays: new FormControl<number>(
      90,
      { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(730)] },
    ),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    runType: this.translate.instant('mrp.runDialog.fieldRunType'),
    planningHorizonDays: this.translate.instant('mrp.runDialog.fieldHorizon'),
  });

  protected readonly title = this.translate.instant(
    this.isSimulation ? 'mrp.runDialog.titleSimulate' : 'mrp.runDialog.title',
  );

  protected confirm(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      request: {
        runType: v.runType,
        planningHorizonDays: v.planningHorizonDays,
      },
      isSimulation: this.isSimulation,
    });
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
