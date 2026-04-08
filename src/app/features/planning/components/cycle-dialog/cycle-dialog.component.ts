import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { PlanningCycleDetail } from '../../models/planning-cycle-detail.model';
import { CreatePlanningCycleRequest } from '../../models/create-planning-cycle-request.model';
import { UpdatePlanningCycleRequest } from '../../models/update-planning-cycle-request.model';

@Component({
  selector: 'app-cycle-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    DialogComponent, InputComponent, DatepickerComponent, TextareaComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './cycle-dialog.component.html',
  styleUrl: './cycle-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CycleDialogComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  readonly cycle = input<PlanningCycleDetail | null>(null);
  readonly saving = input(false);

  readonly saved = output<CreatePlanningCycleRequest | UpdatePlanningCycleRequest>();
  readonly cancelled = output<void>();

  private readonly translate = inject(TranslateService);

  protected readonly isEditMode = computed(() => this.cycle() !== null);
  protected readonly dialogTitle = computed(() => this.isEditMode() ? this.translate.instant('planning.editCycle') : this.translate.instant('planning.newPlanningCycle'));

  protected readonly draftConfig = computed<DraftConfig>(() => ({
    entityType: 'planning-cycle',
    entityId: this.cycle()?.id?.toString() ?? 'new',
    route: '/planning',
  }));

  protected readonly formGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    startDate: new FormControl<Date | null>(null, [Validators.required]),
    endDate: new FormControl<Date | null>(null, [Validators.required]),
    goals: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.formGroup, {
    name: 'Name',
    startDate: 'Start Date',
    endDate: 'End Date',
    goals: 'Goals',
  });

  ngOnInit(): void {
    const existing = this.cycle();
    if (existing) {
      this.formGroup.patchValue({
        name: existing.name,
        startDate: existing.startDate,
        endDate: existing.endDate,
        goals: existing.goals ?? '',
      });
    } else {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 14);
      this.formGroup.patchValue({ startDate: start, endDate: end });
    }
  }

  protected close(): void {
    this.cancelled.emit();
  }

  protected save(): void {
    if (this.formGroup.invalid) return;

    const raw = this.formGroup.getRawValue();

    if (this.isEditMode()) {
      const request: UpdatePlanningCycleRequest = {
        name: raw.name ?? undefined,
        startDate: toIsoDate(raw.startDate) ?? undefined,
        endDate: toIsoDate(raw.endDate) ?? undefined,
        goals: raw.goals ?? undefined,
      };
      this.dialogRef.clearDraft();
      this.saved.emit(request);
    } else {
      const startDate = toIsoDate(raw.startDate);
      const endDate = toIsoDate(raw.endDate);
      if (!startDate || !endDate) return;

      const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
      const durationDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const request: CreatePlanningCycleRequest = {
        name: raw.name!,
        startDate,
        endDate,
        goals: raw.goals || undefined,
        durationDays: durationDays > 0 ? durationDays : undefined,
      };
      this.dialogRef.clearDraft();
      this.saved.emit(request);
    }
  }
}
