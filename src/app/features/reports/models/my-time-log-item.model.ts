export interface MyTimeLogItem {
  timeEntryId: number;
  jobNumber: string | null;
  jobTitle: string | null;
  notes: string | null;
  durationMinutes: number;
  category: string | null;
  date: string;
}
