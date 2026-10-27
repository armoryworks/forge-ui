import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TrainingPathDialogData } from './training-path-dialog-data.model';
import { TrainingPathDialogModuleOption } from './training-path-dialog-module-option.model';

@Component({
  selector: 'app-training-path-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    TextareaComponent,
    ToggleComponent,
    SelectComponent,
    ValidationButtonComponent,
    TranslatePipe,
  ],
  templateUrl: './training-path-dialog.component.html',
  styleUrl: './training-path-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPathDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly matDialogRef = inject(MatDialogRef<TrainingPathDialogComponent>);
  private readonly dialogData = inject<TrainingPathDialogData | null>(MAT_DIALOG_DATA);
  private readonly data = this.dialogData?.path ?? null;
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly moduleCatalog: readonly TrainingPathDialogModuleOption[] = this.dialogData?.availableModules ?? [];

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
    title: this.translate.instant('common.title'),
  });

  protected readonly moduleIds = signal<number[]>(this.data?.moduleIds ?? []);
  protected readonly selectedModules = computed(() => {
    const byId = new Map(this.moduleCatalog.map(m => [m.id, m]));
    return this.moduleIds().map(id => byId.get(id) ?? { id, title: `#${id}` });
  });
  protected readonly addOptions = computed<SelectOption[]>(() => {
    const chosen = new Set(this.moduleIds());
    return this.moduleCatalog.filter(m => !chosen.has(m.id)).map(m => ({ value: m.id, label: m.title }));
  });
  protected readonly addModuleControl = new FormControl<number | null>(null);

  protected readonly draftConfig: DraftConfig = {
    entityType: 'training-path',
    entityId: this.data?.id?.toString() ?? 'new',
    route: '/admin?tab=training',
  };

  protected addModule(): void {
    const id = this.addModuleControl.value;
    if (id === null) return;
    this.moduleIds.update(ids => (ids.includes(id) ? ids : [...ids, id]));
    this.addModuleControl.setValue(null, { emitEvent: false });
    this.form.markAsDirty();
  }

  protected moveModule(index: number, delta: number): void {
    this.moduleIds.update(ids => {
      const target = index + delta;
      if (target < 0 || target >= ids.length) return ids;
      const next = [...ids];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    this.form.markAsDirty();
  }

  protected removeModule(index: number): void {
    this.moduleIds.update(ids => ids.filter((_, i) => i !== index));
    this.form.markAsDirty();
  }

  ngOnInit(): void {
    this.addModuleControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.addModule());
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
      moduleIds: this.moduleIds(),
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
