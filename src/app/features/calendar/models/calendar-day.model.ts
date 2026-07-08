import { CalendarJob } from './calendar-job.model';

export interface CalendarDay {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  jobs: CalendarJob[];
}
