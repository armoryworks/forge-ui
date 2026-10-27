export type CronFrequency = 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';

export interface CronSchedule {
  frequency: CronFrequency;
  time: string;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  custom: string;
}

export interface CronDescription {
  key: string;
  params: Record<string, string | number>;
  dayKey?: string;
}

export const CRON_FREQUENCIES: readonly CronFrequency[] = ['hourly', 'daily', 'weekdays', 'weekly', 'monthly', 'custom'];

export const DEFAULT_CRON_SCHEDULE: CronSchedule = {
  frequency: 'weekly', time: '07:00', minute: 0, dayOfWeek: 1, dayOfMonth: 1, custom: '',
};

const FIELD = /^(\*|\d{1,2})$/;

function splitTime(time: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return [0, 0];
  return [Math.min(23, Number(match[1])), Math.min(59, Number(match[2]))];
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function buildCron(schedule: CronSchedule): string {
  const [hour, minute] = splitTime(schedule.time);
  switch (schedule.frequency) {
    case 'hourly': return `${Math.min(59, Math.max(0, schedule.minute))} * * * *`;
    case 'daily': return `${minute} ${hour} * * *`;
    case 'weekdays': return `${minute} ${hour} * * 1-5`;
    case 'weekly': return `${minute} ${hour} * * ${schedule.dayOfWeek}`;
    case 'monthly': return `${minute} ${hour} ${Math.min(28, Math.max(1, schedule.dayOfMonth))} * *`;
    default: return schedule.custom.trim();
  }
}

export function parseCron(expression: string): CronSchedule {
  const fields = expression.trim().split(/\s+/);
  const custom = { ...DEFAULT_CRON_SCHEDULE, frequency: 'custom' as const, custom: expression.trim() };
  if (fields.length !== 5) return custom;
  const [min, hour, dom, month, dow] = fields;
  if (!/^\d{1,2}$/.test(min) || month !== '*') return custom;
  const minute = Number(min);
  if (hour === '*' && dom === '*' && dow === '*') {
    return { ...DEFAULT_CRON_SCHEDULE, frequency: 'hourly', minute };
  }
  if (!/^\d{1,2}$/.test(hour)) return custom;
  const time = `${pad(Number(hour))}:${pad(minute)}`;
  if (dom === '*' && dow === '*') return { ...DEFAULT_CRON_SCHEDULE, frequency: 'daily', time };
  if (dom === '*' && dow === '1-5') return { ...DEFAULT_CRON_SCHEDULE, frequency: 'weekdays', time };
  if (dom === '*' && /^[0-6]$/.test(dow)) return { ...DEFAULT_CRON_SCHEDULE, frequency: 'weekly', time, dayOfWeek: Number(dow) };
  if (dow === '*' && /^\d{1,2}$/.test(dom)) return { ...DEFAULT_CRON_SCHEDULE, frequency: 'monthly', time, dayOfMonth: Number(dom) };
  return custom;
}

export function isPlausibleCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  return (fields.length === 5 || fields.length === 6)
    && fields.every(f => FIELD.test(f) || /^[\d*,/\-A-Za-z]+$/.test(f));
}

export function describeCron(expression: string): CronDescription {
  const schedule = parseCron(expression);
  switch (schedule.frequency) {
    case 'hourly': return { key: 'cronSchedule.describe.hourly', params: { minute: pad(schedule.minute) } };
    case 'daily': return { key: 'cronSchedule.describe.daily', params: { time: schedule.time } };
    case 'weekdays': return { key: 'cronSchedule.describe.weekdays', params: { time: schedule.time } };
    case 'weekly': return {
      key: 'cronSchedule.describe.weekly', params: { time: schedule.time }, dayKey: `cronSchedule.days.${schedule.dayOfWeek}`,
    };
    case 'monthly': return { key: 'cronSchedule.describe.monthly', params: { day: schedule.dayOfMonth, time: schedule.time } };
    default: return { key: 'cronSchedule.describe.custom', params: { expression: schedule.custom } };
  }
}
