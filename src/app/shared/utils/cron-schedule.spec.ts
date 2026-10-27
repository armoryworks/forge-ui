import { describe, it, expect } from 'vitest';

import { buildCron, describeCron, isPlausibleCron, parseCron, DEFAULT_CRON_SCHEDULE } from './cron-schedule';

describe('cron-schedule', () => {
  it('builds a cron expression for each frequency', () => {
    expect(buildCron({ ...DEFAULT_CRON_SCHEDULE, frequency: 'hourly', minute: 15 })).toBe('15 * * * *');
    expect(buildCron({ ...DEFAULT_CRON_SCHEDULE, frequency: 'daily', time: '06:30' })).toBe('30 6 * * *');
    expect(buildCron({ ...DEFAULT_CRON_SCHEDULE, frequency: 'weekdays', time: '18:05' })).toBe('5 18 * * 1-5');
    expect(buildCron({ ...DEFAULT_CRON_SCHEDULE, frequency: 'weekly', time: '07:00', dayOfWeek: 1 })).toBe('0 7 * * 1');
    expect(buildCron({ ...DEFAULT_CRON_SCHEDULE, frequency: 'monthly', time: '08:00', dayOfMonth: 31 })).toBe('0 8 28 * *');
    expect(buildCron({ ...DEFAULT_CRON_SCHEDULE, frequency: 'custom', custom: ' */10 * * * * ' })).toBe('*/10 * * * *');
  });

  it('parses what it builds back into the same schedule', () => {
    expect(parseCron('0 7 * * 1')).toMatchObject({ frequency: 'weekly', time: '07:00', dayOfWeek: 1 });
    expect(parseCron('30 6 * * *')).toMatchObject({ frequency: 'daily', time: '06:30' });
    expect(parseCron('5 18 * * 1-5')).toMatchObject({ frequency: 'weekdays', time: '18:05' });
    expect(parseCron('0 8 15 * *')).toMatchObject({ frequency: 'monthly', dayOfMonth: 15 });
    expect(parseCron('15 * * * *')).toMatchObject({ frequency: 'hourly', minute: 15 });
    expect(parseCron('*/10 * * * *')).toMatchObject({ frequency: 'custom', custom: '*/10 * * * *' });
  });

  it('describes a schedule with a translation key and parameters', () => {
    expect(describeCron('0 7 * * 1')).toEqual({
      key: 'cronSchedule.describe.weekly', params: { time: '07:00' }, dayKey: 'cronSchedule.days.1',
    });
    expect(describeCron('0 8 15 * *')).toEqual({ key: 'cronSchedule.describe.monthly', params: { day: 15, time: '08:00' } });
    expect(describeCron('*/10 * * * *').key).toBe('cronSchedule.describe.custom');
  });

  it('flags expressions that cannot be cron', () => {
    expect(isPlausibleCron('0 7 * * 1')).toBe(true);
    expect(isPlausibleCron('every monday')).toBe(false);
    expect(isPlausibleCron('')).toBe(false);
  });
});
