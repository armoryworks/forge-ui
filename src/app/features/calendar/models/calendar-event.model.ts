/** compliance-calendar A-3: a calendar event (subset of the API EventResponseModel). */
export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  eventType: string;
  isRequired: boolean;
  isCancelled: boolean;
  status: string | null;
  eventTypeId: number | null;
  superGroupId: number | null;
}
