import { ClockEventType } from './clock-event-type.type';

export interface ClockEvent {
  id: number;
  userId: number;
  userName: string;
  eventType: ClockEventType;
  reason: string | null;
  scanMethod: string | null;
  timestamp: Date;
  source: string | null;
}
