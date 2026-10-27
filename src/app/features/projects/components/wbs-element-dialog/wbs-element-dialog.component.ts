import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ProjectService } from '../../services/project.service';
import { WbsElementSummary } from '../../models/wbs-element-summary.model';
import { WBS_ELEMENT_TYPES, WbsElementType } from '../../models/wbs-element-type.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';

export interface WbsElementDialogData {
  projectId: number;
  elements: WbsElementSummary[];
}

@Component({
  selector: 'app-wbs-element-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, DatepickerComponent, ValidationButtonComponent],
  templateUrl: './wbs-element-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WbsElementDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<WbsElementDialogComponent, boolean>);
  private readonly projectService = inject(ProjectService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<WbsElementDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly parentOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('projects.topLevel') },
    ...this.data.elements.map(e => ({ value: e.id, label: `${e.code} — ${e.name}` })),
  ];

  protected readonly typeOptions: SelectOption[] = WBS_ELEMENT_TYPES.map(t => ({
    value: t, label: this.translate.instant(`projects.wbsType${t}`),
  }));

  protected readonly form = new FormGroup({
    parentElementId: new FormControl<number | null>(null),
    code: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50), Validators.pattern(/\S/)] }),
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)] }),
    type: new FormControl<WbsElementType>('WorkPackage', { nonNullable: true }),
    budgetLabor: new FormControl<number | null>(0, [Validators.min(0)]),
    budgetMaterial: new FormControl<number | null>(0, [Validators.min(0)]),
    budgetOther: new FormControl<number | null>(0, [Validators.min(0)]),
    plannedStart: new FormControl<Date | null>(null),
    plannedEnd: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    parentElementId: this.translate.instant('projects.parentElement'),
    code: this.translate.instant('projects.wbsCode'),
    name: this.translate.instant('common.name'),
    type: this.translate.instant('common.type'),
    budgetLabor: this.translate.instant('projects.budgetLabor'),
    budgetMaterial: this.translate.instant('projects.budgetMaterial'),
    budgetOther: this.translate.instant('projects.budgetOther'),
    plannedStart: this.translate.instant('projects.plannedStart'),
    plannedEnd: this.translate.instant('projects.plannedEnd'),
  });

  protected close(): void { this.dialogRef.close(false); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.projectService.addWbsElement(this.data.projectId, {
      parentElementId: v.parentElementId,
      code: v.code.trim(),
      name: v.name.trim(),
      type: v.type,
      budgetLabor: v.budgetLabor ?? 0,
      budgetMaterial: v.budgetMaterial ?? 0,
      budgetOther: v.budgetOther ?? 0,
      plannedStart: toDateOnly(v.plannedStart),
      plannedEnd: toDateOnly(v.plannedEnd),
      sortOrder: this.data.elements.length + 1,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('projects.wbsAdded'));
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'projects.saveFailed');
      },
    });
  }
}
