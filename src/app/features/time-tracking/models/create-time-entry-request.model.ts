export interface CreateTimeEntryRequest {
  jobId?: number;
  date: string;
  durationMinutes: number;
  category?: string;
  notes?: string;
}
