import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { forkJoin } from 'rxjs';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CustomFieldDefinition } from '../../../../shared/models/custom-field-definition.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { fromIsoDate, toDateOnly } from '../../../../shared/utils/date.utils';
import { CustomFieldValues } from '../../models/custom-field-values.model';
import { KanbanService } from '../../services/kanban.service';

@Component({
  selector: 'app-job-custom-fields-section',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent, ToggleComponent, DatepickerComponent],
  templateUrl: './job-custom-fields-section.component.html',
  styleUrl: './job-custom-fields-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobCustomFieldsSectionComponent {
  private readonly kanban = inject(KanbanService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly jobId = input.required<number>();
  readonly trackTypeId = input.required<number>();

  protected readonly definitions = signal<CustomFieldDefinition[]>([]);
  protected readonly selectOptions = signal<Record<string, SelectOption[]>>({});
  protected readonly form = signal(new FormGroup<Record<string, FormControl<unknown>>>({}));
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const jobId = this.jobId();
      const trackTypeId = this.trackTypeId();
      untracked(() => this.load(jobId, trackTypeId));
    });
  }

  private load(jobId: number, trackTypeId: number): void {
    forkJoin({
      definitions: this.kanban.getCustomFieldDefinitions(trackTypeId),
      values: this.kanban.getCustomFieldValues(jobId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ definitions, values }) => this.build(definitions ?? [], values ?? {}),
      error: () => this.definitions.set([]),
    });
  }

  private build(definitions: CustomFieldDefinition[], values: CustomFieldValues): void {
    const controls: Record<string, FormControl<unknown>> = {};
    const options: Record<string, SelectOption[]> = {};
    for (const def of definitions) {
      const raw = values[def.key] ?? null;
      const value = def.type === 'date' ? fromIsoDate(raw as string | null)
        : def.type === 'toggle' ? raw === true
        : raw;
      controls[def.key] = new FormControl<unknown>(value, def.isRequired && def.type !== 'toggle' ? [Validators.required] : []);
      if (def.type === 'select') {
        options[def.key] = [{ value: null, label: '—' }, ...(def.options ?? []).map(o => ({ value: o, label: o }))];
      }
    }
    this.selectOptions.set(options);
    this.form.set(new FormGroup(controls));
    this.definitions.set(definitions);
  }

  protected save(): void {
    const form = this.form();
    if (form.invalid || this.saving()) return;
    const values: CustomFieldValues = {};
    for (const def of this.definitions()) {
      const value = form.controls[def.key].value;
      values[def.key] = def.type === 'date' ? toDateOnly(value as Date | null)
        : def.type === 'number' ? (value === null || value === '' ? null : Number(value))
        : def.type === 'toggle' ? value === true
        : value === '' ? null : value;
    }
    this.saving.set(true);
    this.kanban.updateCustomFieldValues(this.jobId(), values).subscribe({
      next: () => {
        this.saving.set(false);
        form.markAsPristine();
        this.snackbar.success(this.translate.instant('kanban.customFields.saved'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'kanban.customFields.saveFailed');
      },
    });
  }
}
