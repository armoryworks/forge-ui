import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { DraftConfig } from '../../../shared/models/draft-config.model';
import { StageRequest } from '../models/stage-request.model';
import { TrackTypeStageAdmin } from '../models/track-type-stage-admin.model';
import { TrackTypeStagesService } from '../services/track-type-stages.service';
import { TrackType } from '../../../shared/models/track-type.model';

const STAGE_COLORS = [
  '#94a3b8', '#0d9488', '#7c3aed', '#1d4ed8', '#15803d',
  '#c2410c', '#be123c', '#92400e', '#f59e0b', '#6d28d9',
];

@Component({
  selector: 'app-track-type-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ValidationButtonComponent, EmptyStateComponent, MatTooltipModule],
  templateUrl: './track-type-dialog.component.html',
  styleUrl: './track-type-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackTypeDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly translate = inject(TranslateService);
  private readonly stagesService = inject(TrackTypeStagesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly trackType = input<TrackType | null>(null);
  readonly saving = input(false);
  readonly closed = output<void>();
  readonly saved = output<{ name: string; code: string; description: string | null; stages: StageRequest[] }>();

  readonly form = new FormGroup({
    name: new FormControl('', [Validators.required]),
    code: new FormControl('', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/)]),
    description: new FormControl(''),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name', code: 'Code', description: 'Description',
  });

  protected readonly stages = signal<StageRequest[]>([]);
  protected readonly isEdit = computed(() => this.trackType() !== null);
  protected readonly title = computed(() => this.isEdit() ? this.translate.instant('trackTypeDialog.editTrackType') : this.translate.instant('trackTypeDialog.createTrackType'));
  protected readonly hasStages = computed(() => this.stages().length > 0);
  protected readonly savedStages = signal<ReadonlyMap<string, TrackTypeStageAdmin>>(new Map());
  protected readonly hideError = signal<string | null>(null);
  protected readonly startStage = computed(() => this.stages().find(s => s.isActive) ?? null);
  protected readonly hasVisibleStage = computed(() => this.startStage() !== null);
  protected readonly accountingWarnings = computed(() => {
    const saved = this.savedStages();
    return this.stages()
      .filter(s => !s.isActive && saved.get(s.code)?.isActive && saved.get(s.code)?.accountingDocumentType)
      .map(s => s.name);
  });

  protected readonly draftConfig = computed<DraftConfig>(() => ({
    entityType: 'track-type',
    entityId: this.trackType()?.id?.toString() ?? 'new',
    route: '/admin?tab=track-types',
  }));

  constructor() {
    // Initialize form when trackType input is set
    const tt = this.trackType;
    queueMicrotask(() => {
      const existing = tt();
      if (existing) {
        this.form.patchValue({
          name: existing.name,
          code: existing.code,
          description: existing.description ?? '',
        });
        const initial = existing.stages.map(s => ({
          name: s.name,
          code: s.code,
          sortOrder: s.sortOrder,
          color: s.color,
          wipLimit: s.wipLimit,
          isIrreversible: s.isIrreversible,
          isActive: true,
        }));
        this.stages.set(initial);
        this.savedStages.set(new Map(existing.stages.map(s => [s.code, { ...s, isActive: true, openJobCount: 0 }])));
        this.loadAllStages(existing.id, initial);
      }
    });
  }

  private loadAllStages(trackTypeId: number, initial: StageRequest[]): void {
    this.stagesService.getStages(trackTypeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: all => {
          this.savedStages.set(new Map(all.map(s => [s.code, s])));
          const current = this.stages();
          const edited = current !== initial;
          const kept = edited ? current : [];
          const keptCodes = new Set(kept.map(s => s.code));
          const loaded = all.filter(s => !keptCodes.has(s.code)).map(s => ({
            name: s.name,
            code: s.code,
            sortOrder: s.sortOrder,
            color: s.color,
            wipLimit: s.wipLimit,
            isIrreversible: s.isIrreversible,
            isActive: edited ? false : s.isActive,
          }));
          const merged = [...kept, ...loaded].sort((a, b) => a.sortOrder - b.sortOrder);
          this.stages.set(edited ? merged.map((s, i) => ({ ...s, sortOrder: i + 1 })) : merged);
        },
        error: () => undefined,
      });
  }

  protected isSaved(stage: StageRequest): boolean {
    return this.savedStages().has(stage.code);
  }

  protected hideStage(index: number): void {
    const stage = this.stages()[index];
    const saved = this.savedStages().get(stage.code);
    if (saved?.isMandatory) {
      this.hideError.set(this.translate.instant('trackStages.hideBlockedMandatory', { stage: stage.name }));
      return;
    }
    if (saved?.isActive && saved.openJobCount > 0) {
      this.hideError.set(this.translate.instant(
        saved.openJobCount === 1 ? 'trackStages.hideBlockedOpenJob' : 'trackStages.hideBlockedOpenJobs',
        { count: saved.openJobCount, stage: stage.name }));
      return;
    }
    this.hideError.set(null);
    this.updateStage(index, 'isActive', false);
  }

  protected showStage(index: number): void {
    this.hideError.set(null);
    this.updateStage(index, 'isActive', true);
  }

  protected addStage(): void {
    const currentStages = this.stages();
    const nextOrder = currentStages.length > 0
      ? Math.max(...currentStages.map(s => s.sortOrder)) + 1
      : 1;
    const color = STAGE_COLORS[currentStages.length % STAGE_COLORS.length];
    this.stages.set([...currentStages, {
      name: '',
      code: '',
      sortOrder: nextOrder,
      color,
      wipLimit: null,
      isIrreversible: false,
      isActive: true,
    }]);
  }

  protected removeStage(index: number): void {
    const updated = this.stages().filter((_, i) => i !== index);
    this.stages.set(updated);
  }

  protected updateStage(index: number, field: keyof StageRequest, value: unknown): void {
    const updated = [...this.stages()];
    updated[index] = { ...updated[index], [field]: value };
    this.stages.set(updated);
  }

  protected moveStageUp(index: number): void {
    if (index === 0) return;
    const updated = [...this.stages()];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updated.forEach((s, i) => s.sortOrder = i + 1);
    this.stages.set(updated);
  }

  protected moveStageDown(index: number): void {
    const updated = [...this.stages()];
    if (index >= updated.length - 1) return;
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated.forEach((s, i) => s.sortOrder = i + 1);
    this.stages.set(updated);
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.stages().length === 0 || !this.hasVisibleStage()) return;
    this.dialogRef.clearDraft();
    const val = this.form.getRawValue();
    this.saved.emit({
      name: val.name!,
      code: val.code!,
      description: val.description || null,
      stages: this.stages(),
    });
  }
}
