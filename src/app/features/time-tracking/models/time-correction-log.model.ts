export interface TimeCorrectionLog {
  id: number;
  timeEntryId: number;
  correctedByUserId: number;
  correctedByName: string;
  reason: string;
  originalJobId: number | null;
  originalJobNumber: string | null;
  originalDate: string;
  originalDurationMinutes: number;
  originalStartTime: string | null;
  originalEndTime: string | null;
  originalCategory: string | null;
  originalNotes: string | null;
  createdAt: string;
}
