export interface CorrectTimeEntryRequest {
  jobId?: number | null;
  date?: string | null;
  durationMinutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  category?: string | null;
  notes?: string | null;
  reason: string;
}
