import { FormControl, FormGroup, Validators } from '@angular/forms';

import { buildCron, CronFrequency, DEFAULT_CRON_SCHEDULE, parseCron } from './cron-schedule';

export type CronScheduleFormGroup = FormGroup<{
  frequency: FormControl<CronFrequency>;
  time: FormControl<string>;
  minute: FormControl<number>;
  dayOfWeek: FormControl<number>;
  dayOfMonth: FormControl<number>;
  custom: FormControl<string>;
}>;

export function createCronScheduleForm(): CronScheduleFormGroup {
  const d = DEFAULT_CRON_SCHEDULE;
  return new FormGroup({
    frequency: new FormControl<CronFrequency>(d.frequency, { nonNullable: true, validators: [Validators.required] }),
    time: new FormControl<string>(d.time, { nonNullable: true }),
    minute: new FormControl<number>(d.minute, { nonNullable: true, validators: [Validators.min(0), Validators.max(59)] }),
    dayOfWeek: new FormControl<number>(d.dayOfWeek, { nonNullable: true }),
    dayOfMonth: new FormControl<number>(d.dayOfMonth, { nonNullable: true, validators: [Validators.min(1), Validators.max(28)] }),
    custom: new FormControl<string>(d.custom, { nonNullable: true, validators: [Validators.maxLength(100)] }),
  });
}

export function loadCronScheduleForm(form: CronScheduleFormGroup, expression: string | null | undefined): void {
  form.reset(expression ? parseCron(expression) : DEFAULT_CRON_SCHEDULE);
}

export function cronFromForm(form: CronScheduleFormGroup): string {
  return buildCron(form.getRawValue());
}
