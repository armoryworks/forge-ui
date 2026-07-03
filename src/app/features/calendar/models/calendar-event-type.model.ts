/** compliance-calendar A-1: an Event-Type within a Super-Group layer. */
export interface CalendarEventType {
  id: number;
  superGroupId: number;
  key: string;
  name: string;
  color: string | null;
  requiresTracking: boolean;
  sortOrder: number;
}
