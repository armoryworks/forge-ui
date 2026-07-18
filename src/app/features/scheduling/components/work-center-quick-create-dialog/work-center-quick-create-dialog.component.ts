import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { SchedulingService } from '../../services/scheduling.service';
import { WorkCenter } from '../../models/scheduling.model';

export interface WorkCenterQuickCreateDialogData {
  /** Pre-fill the name from the caller (e.g. a picker's typed term). */
  initialName?: string;
}

/**
 * Inline-create surface for work centers, invoked from the routing operation
 * dialog's work-center select ("+ New work center"). Two-field form (code +
 * name) — every capacity/cost field on the full work center is optional at
 * the API level, so a bare record is created here with sensible defaults and
 * fleshed out later on the Scheduling > Work Centers page.
 *
 * Returns the created WorkCenter on resolve, or null on dismiss. Counterpart
 * of `<app-vendor-quick-create-dialog>` / `<app-part-quick-create-dialog>`.
 */
@Component({
  selector: 'app-work-center-quick-create-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, ValidationButtonComponent,
  ],
  templateUrl: './work-center-quick-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkCenterQuickCreateDialogComponent {
  private readonly schedulingService = inject(SchedulingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<WorkCenterQuickCreateDialogComponent, WorkCenter | null>);
  protected readonly data = inject<WorkCenterQuickCreateDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    code: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    name: new FormControl<string>(
      this.data.initialName ?? '',
      { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] },
    ),
  });

  protected readonly title = computed(() => this.translate.instant('workCenterQuickCreate.title'));

  protected readonly violations = FormValidationService.getViolations(this.form, {
    code: this.translate.instant('workCenterDialog.code'),
    name: this.translate.instant('workCenterDialog.name'),
  });

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    // Sensible defaults for the fields the quick-create doesn't surface — the
    // full work-center dialog lets the user refine capacity/cost/asset later.
    this.schedulingService.createWorkCenter({
      code: this.form.controls.code.value.trim(),
      name: this.form.controls.name.value.trim(),
      description: null,
      dailyCapacityHours: 8,
      efficiencyPercent: 100,
      numberOfMachines: 1,
      laborCostPerHour: 0,
      burdenRatePerHour: 0,
      assetId: null,
      companyLocationId: null,
      sortOrder: 0,
    }).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('workCenterQuickCreate.created', { name: created.name }));
        this.dialogRef.close(created);
      },
      error: () => this.saving.set(false),
    });
  }
}
