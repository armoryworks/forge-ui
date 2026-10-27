import { describe, it, expect } from 'vitest';
import { TranslateService } from '@ngx-translate/core';

import { CronScheduleFieldsComponent } from './cron-schedule-fields.component';
import { DEFAULT_CRON_SCHEDULE } from '../../utils/cron-schedule';
import { createCronScheduleForm, cronFromForm, loadCronScheduleForm } from '../../utils/cron-schedule-form';

const translate = {
  instant: (key: string, params?: Record<string, unknown>) => (params ? `${key}|${JSON.stringify(params)}` : key),
} as unknown as TranslateService;

describe('CronScheduleFieldsComponent', () => {
  it('previews a weekly schedule with the translated day name and the cron expression', () => {
    const preview = CronScheduleFieldsComponent.describe({ ...DEFAULT_CRON_SCHEDULE, frequency: 'weekly', dayOfWeek: 3, time: '06:15' }, translate);

    expect(preview.expression).toBe('15 6 * * 3');
    expect(preview.text).toBe('cronSchedule.describe.weekly|{"time":"06:15","day":"cronSchedule.days.3"}');
  });

  it('round-trips a stored expression through the form', () => {
    const form = createCronScheduleForm();

    loadCronScheduleForm(form, '0 8 15 * *');
    expect(form.getRawValue()).toMatchObject({ frequency: 'monthly', dayOfMonth: 15, time: '08:00' });
    expect(cronFromForm(form)).toBe('0 8 15 * *');

    loadCronScheduleForm(form, null);
    expect(cronFromForm(form)).toBe('0 7 * * 1');
  });
});
