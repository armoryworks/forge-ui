export interface TimeEntry {
  id: number;
  jobId: number | null;
  jobNumber: string | null;
  userId: number;
  userName: string;
  date: string;
  durationMinutes: number;
  category: string | null;
  notes: string | null;
  timerStart: string | null;
  timerStop: string | null;
  isManual: boolean;
  isLocked: boolean;
  createdAt: string;
}
