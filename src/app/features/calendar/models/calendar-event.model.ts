/** compliance-calendar A-3: a calendar event (subset of the API EventResponseModel). */
export interface CalendarEvent {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  eventType: string;
  isRequired: boolean;
  isCancelled: boolean;
  eventTypeId: number | null;
  superGroupId: number | null;
}
