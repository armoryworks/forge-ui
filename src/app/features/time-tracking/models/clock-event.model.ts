export interface ClockEvent {
  id: number;
  userId: number;
  userName: string;
  eventTypeCode: string;
  reason: string | null;
  scanMethod: string | null;
  timestamp: Date;
  source: string | null;
}
