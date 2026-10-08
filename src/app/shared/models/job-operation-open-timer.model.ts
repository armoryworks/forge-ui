export interface JobOperationOpenTimer {
  timeEntryId: number;
  userId: number;
  userName: string;
  userInitials: string | null;
  entryType: string;
  timerStart: string;
}
