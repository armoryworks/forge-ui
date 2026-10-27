import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-project-create-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, TextareaComponent, DatepickerComponent, EntityPickerComponent, ValidationButtonComponent],
  templateUrl: './project-create-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCreateDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ProjectCreateDialogComponent, Project | undefined>);
  private readonly projectService = inject(ProjectService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)] }),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    customerId: new FormControl<number | null>(null),
    budgetTotal: new FormControl<number | null>(0, [Validators.min(0)]),
    plannedStartDate: new FormControl<Date | null>(null),
    plannedEndDate: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('common.name'),
    description: this.translate.instant('common.description'),
    customerId: this.translate.instant('common.customer'),
    budgetTotal: this.translate.instant('projects.budget'),
    plannedStartDate: this.translate.instant('projects.plannedStart'),
    plannedEndDate: this.translate.instant('projects.plannedEnd'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    if (v.plannedStartDate && v.plannedEndDate && v.plannedEndDate < v.plannedStartDate) {
      this.snackbar.error(this.translate.instant('projects.endBeforeStart'));
      return;
    }
    this.saving.set(true);
    this.projectService.create({
      name: v.name.trim(),
      description: v.description.trim() || null,
      customerId: v.customerId,
      budgetTotal: v.budgetTotal ?? 0,
      plannedStartDate: toDateOnly(v.plannedStartDate),
      plannedEndDate: toDateOnly(v.plannedEndDate),
      notes: null,
    }).subscribe({
      next: created => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('projects.created'));
        this.dialogRef.close(created);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'projects.saveFailed');
      },
    });
  }
}
