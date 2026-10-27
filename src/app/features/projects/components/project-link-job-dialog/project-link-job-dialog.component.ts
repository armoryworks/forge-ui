import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ProjectService } from '../../services/project.service';
import { WbsElementSummary } from '../../models/wbs-element-summary.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

export interface ProjectLinkJobDialogData {
  projectId: number;
  elements: WbsElementSummary[];
}

@Component({
  selector: 'app-project-link-job-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, SelectComponent, EntityPickerComponent, ValidationButtonComponent],
  templateUrl: './project-link-job-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectLinkJobDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ProjectLinkJobDialogComponent, boolean>);
  private readonly projectService = inject(ProjectService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<ProjectLinkJobDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly elementOptions: SelectOption[] = this.data.elements.map(e => ({ value: e.id, label: `${e.code} — ${e.name}` }));

  protected readonly form = new FormGroup({
    elementId: new FormControl<number | null>(this.data.elements[0]?.id ?? null, [Validators.required]),
    jobId: new FormControl<number | null>(null, [Validators.required]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    elementId: this.translate.instant('projects.wbsElement'),
    jobId: this.translate.instant('projects.job'),
  });

  protected close(): void { this.dialogRef.close(false); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.projectService.linkJob(this.data.projectId, v.elementId!, v.jobId!).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('projects.jobLinked'));
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'projects.saveFailed');
      },
    });
  }
}
