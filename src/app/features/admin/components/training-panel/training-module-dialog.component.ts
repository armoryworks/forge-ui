import { ChangeDetectionStrategy, Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { TrainingModuleRow } from './training-panel.component';

interface TrainingModuleDetail extends TrainingModuleRow {
  slug?: string;
  summary?: string;
  contentJson?: unknown;
}

@Component({
  selector: 'app-training-module-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    ToggleComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './training-module-dialog.component.html',
  styleUrl: './training-module-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingModuleDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly matDialogRef = inject(MatDialogRef<TrainingModuleDialogComponent>);
  private readonly data = inject<TrainingModuleDetail | null>(MAT_DIALOG_DATA);
  private readonly http = inject(HttpClient);
  private readonly snackbar = inject(SnackbarService);

  protected readonly saving = signal(false);
  protected readonly isEditing = !!this.data;

  protected readonly contentTypeOptions: SelectOption[] = [
    { value: 'Article', label: 'Article' },
    { value: 'Video', label: 'Video' },
    { value: 'Walkthrough', label: 'Walkthrough' },
    { value: 'QuickRef', label: 'Quick Reference' },
    { value: 'Quiz', label: 'Quiz' },
  ];

  readonly form = new FormGroup({
    title: new FormControl(this.data?.title ?? '', [Validators.required, Validators.maxLength(200)]),
    slug: new FormControl(this.data?.slug ?? '', [Validators.maxLength(200)]),
    summary: new FormControl(this.data?.summary ?? '', [Validators.required, Validators.maxLength(500)]),
    contentType: new FormControl(this.data?.contentType ?? 'Article', [Validators.required]),
    estimatedMinutes: new FormControl<number>(this.data?.estimatedMinutes ?? 5, [Validators.required, Validators.min(1)]),
    appRoutes: new FormControl(this.data?.appRoutes?.join(', ') ?? ''),
    tags: new FormControl(this.data?.tags?.join(', ') ?? ''),
    isPublished: new FormControl(this.data?.isPublished ?? false),
    contentJson: new FormControl(this.data ? JSON.stringify(this.data.contentJson ?? {}, null, 2) : '{}'),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    title: 'Title',
    summary: 'Summary',
    contentType: 'Content Type',
    estimatedMinutes: 'Estimated Minutes',
  });

  protected readonly selectedContentType = signal<string>(this.data?.contentType ?? 'Article');

  protected readonly draftConfig: DraftConfig = {
    entityType: 'training-module',
    entityId: this.data?.id?.toString() ?? 'new',
    route: '/admin/training',
  };

  protected contentJsonLabel(): string {
    const type = this.selectedContentType();
    switch (type) {
      case 'Article': return 'Article Content JSON';
      case 'Video': return 'Video Content JSON';
      case 'Walkthrough': return 'Walkthrough Steps JSON';
      case 'QuickRef': return 'Quick Reference JSON';
      case 'Quiz': return 'Quiz Questions JSON';
      default: return 'Content JSON';
    }
  }

  ngOnInit(): void {
    this.form.controls.title.valueChanges.subscribe(title => {
      if (!this.isEditing || !this.form.controls.slug.value) {
        this.form.controls.slug.setValue(this.generateSlug(title ?? ''), { emitEvent: false });
      }
    });

    this.form.controls.contentType.valueChanges.subscribe(type => {
      this.selectedContentType.set(type ?? 'Article');
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

    // Validate JSON syntax but send as string — backend expects string ContentJson
    try {
      JSON.parse(v.contentJson ?? '{}');
    } catch {
      this.snackbar.error('Content JSON is not valid JSON');
      this.saving.set(false);
      return;
    }

    const payload = {
      title: v.title!,
      slug: v.slug || this.generateSlug(v.title ?? ''),
      summary: v.summary!,
      contentType: v.contentType!,
      estimatedMinutes: v.estimatedMinutes!,
      appRoutes: v.appRoutes ? v.appRoutes.split(',').map((r: string) => r.trim()).filter(Boolean) : [],
      tags: v.tags ? v.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      isPublished: v.isPublished!,
      contentJson: v.contentJson ?? '{}',
    };

    const request$ = this.isEditing
      ? this.http.put(`/api/v1/training/modules/${this.data!.id}`, payload)
      : this.http.post('/api/v1/training/modules', payload);

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
