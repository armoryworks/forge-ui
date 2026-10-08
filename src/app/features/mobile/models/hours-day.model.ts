import { HoursTimeEntry } from './hours-time-entry.model';

export interface HoursDay {
  date: string;
  weekday: number;
  minutes: number;
  running: boolean;
  entries: HoursTimeEntry[];
}
