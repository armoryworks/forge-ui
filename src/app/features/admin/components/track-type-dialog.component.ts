import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../shared/directives/validation-popover.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StageRequest } from '../models/stage-request.model';
import { TrackType } from '../../../shared/models/track-type.model';

const STAGE_COLORS = [
  '#94a3b8', '#0d9488', '#7c3aed', '#1d4ed8', '#15803d',
  '#c2410c', '#be123c', '#92400e', '#f59e0b', '#6d28d9',
];

@Component({
  selector: 'app-track-type-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DialogComponent, InputComponent, ToggleComponent, ValidationPopoverDirective, EmptyStateComponent],
  templateUrl: './track-type-dialog.component.html',
  styleUrl: './track-type-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackTypeDialogComponent {
  readonly trackType = input<TrackType | null>(null);
  readonly saving = input(false);
  readonly closed = output<void>();
  readonly saved = output<{ name: string; code: string; description: string | null; stages: StageRequest[] }>();

  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required]),
    code: new FormControl('', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/)]),
    description: new FormControl(''),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name', code: 'Code', description: 'Description',
  });

  protected readonly stages = signal<StageRequest[]>([]);
  protected readonly isEdit = computed(() => this.trackType() !== null);
  protected readonly title = computed(() => this.isEdit() ? 'Edit Track Type' : 'Create Track Type');
  protected readonly hasStages = computed(() => this.stages().length > 0);

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
        this.stages.set(existing.stages.map(s => ({
          name: s.name,
          code: s.code,
          sortOrder: s.sortOrder,
          color: s.color,
          wipLimit: s.wipLimit,
          isIrreversible: s.isIrreversible,
        })));
      }
    });
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
    if (this.form.invalid || this.stages().length === 0) return;
    const val = this.form.getRawValue();
    this.saved.emit({
      name: val.name!,
      code: val.code!,
      description: val.description || null,
      stages: this.stages(),
    });
  }
}
