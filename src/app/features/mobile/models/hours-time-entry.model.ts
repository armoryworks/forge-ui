export interface HoursTimeEntry {
  id: number;
  jobNumber: string | null;
  date: string;
  durationMinutes: number;
  category: string | null;
  notes: string | null;
  timerStart: string | Date | null;
  timerStop: string | Date | null;
}
