import { ClockEventType } from './clock-event-type.type';

export interface CreateClockEventRequest {
  eventType: ClockEventType;
  reason?: string;
  scanMethod?: string;
  source?: string;
}
