import { ChangeDetectionStrategy, Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { TrainingPathRow } from './training-panel.component';

interface TrainingPathDetail extends TrainingPathRow {
  slug?: string;
  description?: string;
}

@Component({
  selector: 'app-training-path-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    TextareaComponent,
    ToggleComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './training-path-dialog.component.html',
  styleUrl: './training-path-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPathDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly matDialogRef = inject(MatDialogRef<TrainingPathDialogComponent>);
  private readonly data = inject<TrainingPathDetail | null>(MAT_DIALOG_DATA);
  private readonly http = inject(HttpClient);

  protected readonly saving = signal(false);
  protected readonly isEditing = !!this.data;

  readonly form = new FormGroup({
    title: new FormControl(this.data?.title ?? '', [Validators.required, Validators.maxLength(200)]),
    slug: new FormControl(this.data?.slug ?? '', [Validators.maxLength(200)]),
    description: new FormControl(this.data?.description ?? '', [Validators.maxLength(500)]),
    icon: new FormControl(this.data?.icon ?? 'school', [Validators.maxLength(50)]),
    isAutoAssigned: new FormControl(this.data?.isAutoAssigned ?? false),
    isActive: new FormControl(this.data?.isActive ?? true),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    title: 'Title',
  });

  protected readonly draftConfig: DraftConfig = {
    entityType: 'training-path',
    entityId: this.data?.id?.toString() ?? 'new',
    route: '/admin/training',
  };

  ngOnInit(): void {
    this.form.controls.title.valueChanges.subscribe(title => {
      if (!this.isEditing || !this.form.controls.slug.value) {
        this.form.controls.slug.setValue(this.generateSlug(title ?? ''), { emitEvent: false });
      }
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  protected cancel(): void {
    this.matDialogRef.close(false);
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const v = this.form.getRawValue();

    const payload = {
      title: v.title!,
      slug: v.slug || this.generateSlug(v.title ?? ''),
      description: v.description || null,
      icon: v.icon || 'school',
      isAutoAssigned: v.isAutoAssigned!,
      isActive: v.isActive!,
    };

    const request$ = this.isEditing
      ? this.http.put(`/api/v1/training/paths/${this.data!.id}`, payload)
      : this.http.post('/api/v1/training/paths', payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.matDialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }
}
