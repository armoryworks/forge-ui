import { CalendarEventType } from './calendar-event-type.model';

/** compliance-calendar A-3: a Super-Group overlay layer with its Event-Types. */
export interface CalendarSuperGroup {
  id: number;
  key: string;
  name: string;
  color: string | null;
  iconName: string | null;
  defaultVisible: boolean;
  requiresTracking: boolean;
  sortOrder: number;
  eventTypes: CalendarEventType[];
}
