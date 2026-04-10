export interface CorrectTimeEntryRequest {
  jobId?: number | null;
  date?: string | null;
  durationMinutes?: number | null;
  category?: string | null;
  notes?: string | null;
  reason: string;
}
