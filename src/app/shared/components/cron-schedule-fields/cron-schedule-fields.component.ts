import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../input/input.component';
import { SelectComponent, SelectOption } from '../select/select.component';
import { buildCron, CRON_FREQUENCIES, CronSchedule, DEFAULT_CRON_SCHEDULE, describeCron } from '../../utils/cron-schedule';
import { CronScheduleFormGroup } from '../../utils/cron-schedule-form';

@Component({
  selector: 'app-cron-schedule-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent],
  templateUrl: './cron-schedule-fields.component.html',
  styleUrl: './cron-schedule-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CronScheduleFieldsComponent {
  private readonly translate = inject(TranslateService);

  readonly group = input.required<CronScheduleFormGroup>();
  readonly testIdPrefix = input('cron');

  protected readonly current = signal<CronSchedule>(DEFAULT_CRON_SCHEDULE);

  protected readonly frequencyOptions: SelectOption[] = CRON_FREQUENCIES.map(f => ({
    value: f, label: this.translate.instant(`cronSchedule.frequency.${f}`),
  }));

  protected readonly dayOptions: SelectOption[] = [0, 1, 2, 3, 4, 5, 6].map(d => ({
    value: d, label: this.translate.instant(`cronSchedule.days.${d}`),
  }));

  protected readonly preview = computed(() => CronScheduleFieldsComponent.describe(this.current(), this.translate));

  constructor() {
    effect((onCleanup) => {
      const group = this.group();
      this.current.set(group.getRawValue());
      const sub = group.valueChanges.subscribe(() => this.current.set(group.getRawValue()));
      onCleanup(() => sub.unsubscribe());
    });
  }

  static describe(schedule: CronSchedule, translate: TranslateService): { expression: string; text: string } {
    const expression = buildCron(schedule);
    const description = describeCron(expression);
    const day = description.dayKey ? translate.instant(description.dayKey) : '';
    return { expression, text: translate.instant(description.key, { ...description.params, day }) };
  }
}
