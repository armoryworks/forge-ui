export interface RecordFmeaActionRequest {
  actionTaken: string;
  revisedSeverity: number | null;
  revisedOccurrence: number | null;
  revisedDetection: number | null;
}
