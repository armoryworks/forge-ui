import { TimeEntry } from '../../features/time-tracking/models/time-entry.model';

export interface TimerEvent {
  userId: number;
  entry: TimeEntry;
}
