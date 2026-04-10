export interface CreateClockEventRequest {
  eventTypeCode: string;
  reason?: string;
  scanMethod?: string;
  source?: string;
}
