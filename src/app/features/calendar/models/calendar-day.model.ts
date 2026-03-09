import { CalendarJob } from './calendar-job.model';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  jobs: CalendarJob[];
}
